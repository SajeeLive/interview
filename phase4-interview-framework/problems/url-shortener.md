# Design a URL Shortener

A classic starter problem. Tests: estimation, storage design, hashing, caching, redirects.

---

## Step 1: Requirements

### Functional
- User submits a long URL → receives a short URL
- User visits short URL → redirected to original URL
- (Optional) Custom aliases, expiration, analytics

### Non-Functional (assume for this design)
- 100M new URLs/day (write-heavy by URL creation volume, read-heavy by redirect volume)
- 10:1 read:write ratio
- Short URLs never change after creation
- Low latency redirect (<10ms)
- High availability (99.99%)

---

## Step 2: Estimation

| Metric | Calculation | Result |
|---|---|---|
| Write QPS | 100M / 86,400 | ~1,200 QPS |
| Read QPS | 1,200 × 10 | ~12,000 QPS |
| Peak read QPS | 12,000 × 3 | ~36,000 QPS |
| Storage/day | 100M × 500 bytes | ~50 GB/day |
| Storage/5 years | 50 GB × 365 × 5 | ~90 TB |

**Insight:** This is a read-heavy system. The redirect path must be optimized aggressively.

---

## Step 3: Data Model

### URL Table
```
id:           BIGINT (primary key)
short_code:   VARCHAR(8) (unique, indexed)
original_url: TEXT
created_at:   TIMESTAMP
expires_at:   TIMESTAMP (nullable)
user_id:      BIGINT (nullable, FK to users)
```

**DB choice:** Relational (PostgreSQL) for URL metadata. Simple key-value lookup on `short_code`.
- Alternatively: DynamoDB with `short_code` as partition key for easy horizontal scaling.

---

## Step 4: High-Level Design

```
Client
  │
  ▼
[Load Balancer]
  │
  ├──→ [Write API Servers]──→ [ID Generator] → [Primary DB]
  │
  └──→ [Read API Servers] ──→ [Redis Cache]
                                 │ (cache miss)
                                 ▼
                             [DB Read Replicas]
```

---

## Step 5: APIs

```
POST /api/v1/shorten
  Request:  { "url": "https://very-long-url.com/..." }
  Response: { "short_url": "https://sho.rt/abc123" }

GET /{short_code}
  Response: 301 or 302 redirect to original URL
```

### 301 vs 302 Redirect
- **301 Permanent:** Browser caches redirect. Reduces server load. Can't change destination later.
- **302 Temporary:** Browser always hits our server. Enables analytics, allows destination changes.

**Pick 302** if you want click analytics or the ability to update/expire URLs.

---

## Step 6: Short Code Generation

### Option A: Random + Uniqueness Check
- Generate random 6-8 character base62 string
- Check if it exists in DB
- If collision, regenerate

**Problem:** At scale, collision probability increases; DB lookup required for every write.

### Option B: Hash the URL
```
short_code = base62(md5(original_url))[:7]
```
- Deterministic: same URL always produces same short code (deduplication)
- Risk of hash collisions → need collision resolution strategy

### Option C: ID Generator → Base62 (preferred)
1. Generate a globally unique integer ID (see below)
2. Convert to base62 (chars: `a-z`, `A-Z`, `0-9`)

```
base62(12345678) → "AzY3"
7 characters of base62 = 62^7 ≈ 3.5 trillion unique codes
```

**Why this is clean:** IDs are unique by construction; no collision checking needed.

### ID Generation Options
| Method | Pros | Cons |
|---|---|---|
| DB auto-increment | Simple | Single point, slow at scale |
| UUID v4 | Distributed, no coordination | 128-bit (wastes space), random (bad for DB indexes) |
| Snowflake ID | 64-bit, time-ordered, distributed | Need to manage worker IDs |
| Redis INCR | Fast, atomic | Redis becomes critical dependency |

**Snowflake format:**
```
[41 bits timestamp][10 bits worker id][12 bits sequence]
→ 64-bit integer, sortable by time, ~4000 IDs/ms per worker
```

---

## Step 7: Caching

Redirect is the hot path. Cache it aggressively.

```
Redis: short_code → original_url
TTL: 24 hours (or match URL expiry)
Eviction: LRU
```

Cache hit rate on popular URLs is high (Zipf distribution — top 20% of URLs get 80% of traffic).

**Cache-aside pattern:**
1. Check Redis for `short_code`
2. If miss: query DB, write to Redis, return
3. If hit: return immediately

Expected cache hit rate: ~80–90% for popular systems → reduces DB load by ~10x

---

## Step 8: Edge Cases

- **Expiration:** Background worker scans for expired URLs and deletes them (+ Redis TTL alignment)
- **Duplicate URLs:** Hash-based generation naturally deduplicates. Or add a unique constraint on `original_url`.
- **Hot URLs:** Top URLs cached in Redis; thundering herd protected by Redis cache-aside + single-flight pattern
- **Malicious URLs:** Integrate a URL safety API (Google Safe Browsing) at creation time
- **Custom aliases:** Store in same table; validate uniqueness; premium feature

---

## Self-Check

- [ ] Why use 302 over 301 for analytics use cases?
- [ ] Why is Snowflake ID better than UUID for DB indexes?
- [ ] What base62 gives us 3.5 trillion codes with 7 characters?
- [ ] How would you handle a "celebrity URL" that gets 10M hits per minute?
- [ ] How would you add click analytics without slowing down the redirect?
