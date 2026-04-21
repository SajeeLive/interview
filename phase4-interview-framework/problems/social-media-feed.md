# Design a Social Media Feed (Twitter/Instagram)

One of the hardest and most common problems. Tests: fan-out, caching, sharding, the celebrity problem.

---

## Step 1: Requirements

### Functional
- Users can post content (tweets/photos)
- Users can follow other users
- Users see a feed of posts from people they follow (reverse-chronological)

### Non-Functional (assume)
- 300M DAU, 100M posts/day
- Reads >> Writes (users scroll feeds constantly)
- Feed should be near real-time (eventual consistency is OK — 1-2 second lag acceptable)
- p99 feed load < 200ms

---

## Step 2: Estimation

| Metric | Calculation | Result |
|---|---|---|
| Write QPS | 100M / 86,400 | ~1,200 QPS |
| Read QPS (5 feed views/user/day) | 300M × 5 / 86,400 | ~17,000 QPS |
| Peak read QPS | 17,000 × 3 | ~50,000 QPS |
| Storage/post | ~300 bytes | |
| Storage/day | 100M × 300 bytes | ~30 GB/day |
| Storage/year | 30 GB × 365 | ~11 TB/year |

Conclusion: Read-heavy (15:1). Optimize the read path.

---

## Step 3: Data Model

```sql
users:    id, username, follower_count, following_count
posts:    id, user_id, content, created_at
follows:  follower_id, followee_id, created_at
```

For the feed: we need all posts from users you follow, sorted by time.

Naive query:
```sql
SELECT p.* FROM posts p
JOIN follows f ON p.user_id = f.followee_id
WHERE f.follower_id = :user_id
ORDER BY p.created_at DESC
LIMIT 20;
```
This works with 100 users. It **does not work at scale** (join across billions of rows).

---

## Step 4: Fan-Out Approaches

### Option A: Fan-Out on Write (Push Model)
When a user posts, immediately push the post ID to every follower's feed cache.

```
User posts
  → Write post to DB
  → For each follower: append post_id to follower's feed list in Redis
```

**Pros:** Feed reads are O(1) — just read from Redis
**Cons:**
- Writing to millions of followers is slow (Justin Bieber has 100M followers)
- Wastes cache space for inactive users (followers who never open the app)

### Option B: Fan-Out on Read (Pull Model)
When a user opens their feed, fetch recent posts from everyone they follow.

```
User opens feed
  → Get list of followees
  → For each followee: fetch recent posts
  → Merge and sort
```

**Pros:** No fan-out problem; always fresh data
**Cons:** Very slow for users who follow many people; hammers DB on every feed load

### Option C: Hybrid (production approach)
- **Regular users (< 10K followers):** Fan-out on write → push to follower caches
- **Celebrity users (> 10K followers):** Fan-out on read → fetch and merge at read time

```
Feed assembly:
  1. Read pre-computed feed from Redis (fan-out on write users)
  2. Fetch recent posts from celebrities you follow (fan-out on read)
  3. Merge the two lists, deduplicate, sort by time
  4. Return top N results
```

---

## Step 5: Architecture

```
[Client]
  │
  ▼
[API Gateway] → [Write Service] → [Post DB (sharded by user_id)]
                     │
                     ▼
              [Message Queue]  ← e.g., Kafka topic "new-posts"
                     │
                     ▼
              [Fan-Out Workers]
                     │
           ┌─────────┴─────────┐
           ▼                   ▼
   [Regular followers]   [Celebrity check:
   Feed updated in        skip if > 10K followers]
   Redis immediately

[Feed Read Service]
  1. Read from Redis feed cache
  2. Merge celebrity posts (fetched live)
  3. Hydrate post data (fetch full post details)
  4. Return paginated result
```

---

## Step 6: Feed Storage in Redis

Store each user's feed as a **Redis Sorted Set** (score = timestamp):

```
Key: "feed:{user_id}"
Members: post_ids (sorted by created_at timestamp as score)
```

```
ZADD feed:123 1704067200 post_456
ZRANGE feed:123 0 19 WITHSCORES  ← get latest 20 posts
```

Keep only the last N (e.g., 1000) posts in the feed list to bound memory usage.

---

## Step 7: Post Hydration

The feed cache stores only `post_id`. You still need to fetch post content.

### Option A: Fetch from DB (slow for 20 posts)
`SELECT * FROM posts WHERE id IN (...)` — 20 separate lookups or one IN query.

### Option B: Post cache in Redis
```
Key: "post:{post_id}"
Value: JSON blob of post data
TTL: 24 hours
```
Feed assembly: read post IDs from feed cache → batch lookup in post cache → return.

---

## Step 8: Following/Unfollowing

- **Follow:** Add to `follows` table + fan-out service picks it up
- **Unfollow:** Remove from `follows` table + remove posts from feed cache (eventually)
- **Feed cache on follow:** Backfill recent posts from the new followee into the fan-out worker

---

## Step 9: Edge Cases

| Problem | Solution |
|---|---|
| Celebrity posts (millions of followers) | Hybrid fan-out: pull for celebrities at read time |
| User with millions of followees | Cap feed to last 1000 posts, paginate with cursor |
| Deleted post still in feed cache | TTL or tombstone; check post cache at read time |
| New user (cold start, no feed) | Show trending/recommended posts |
| Feed cache miss | Fall back to DB query; asynchronously populate cache |
| Ordering with same timestamp | Use post ID as tiebreaker (Snowflake IDs are time-ordered) |

---

## Self-Check

- [ ] What is the fan-out problem and why does it affect only large accounts?
- [ ] Why use a sorted set in Redis for the feed instead of a list?
- [ ] How does the hybrid model combine push and pull?
- [ ] What happens when a user unfollows someone — how do you clean up their feed?
- [ ] How would you add a ranking algorithm (not just reverse-chronological) to this design?
