# Design a Distributed Cache

Tests: consistent hashing, eviction, replication, failure handling.

---

## Step 1: Requirements

### Functional
- `get(key)` → value or null
- `set(key, value, ttl)`
- `delete(key)`

### Non-Functional
- Sub-millisecond read latency
- High availability (cache node failures shouldn't cause total cache miss)
- Horizontal scalability (add nodes without full resharding)
- Consistent hashing for key distribution

---

## Step 2: Estimation

- 10M QPS (read-heavy)
- Each entry: avg 1 KB
- 100 GB total cache size target
- Single Redis node handles ~100K QPS → need 100+ nodes (or cluster)

---

## Step 3: Consistent Hashing

Use a hash ring to distribute keys across nodes. When a node is added/removed, only adjacent keys are remapped.

```
Ring: ── Node1 ── Node2 ── Node3 ──
Key "foo" → hash → position on ring → assigned to next clockwise node
```

**Virtual nodes:** Each physical node maps to multiple ring positions for even distribution.

---

## Step 4: Architecture

```
Client
  │
  ▼
[Cache Client Library]   ← handles routing, consistent hashing, retries
  │
  ├──→ Cache Node 1 (shard 1)
  ├──→ Cache Node 2 (shard 2)
  └──→ Cache Node 3 (shard 3)
```

### Replication for High Availability
Each shard has a primary + 1-2 replicas. On primary failure, replica is promoted.

---

## Step 5: Eviction

- **LRU** (default) — evict least recently used
- **TTL** — explicit expiry on each key
- **Memory limit** — trigger eviction when memory threshold hit

---

## Step 6: Failure Scenarios

| Failure | Behavior |
|---|---|
| Cache node down | Requests for that shard go to replica; bg process promotes replica |
| Network partition | Cache client routes to available nodes; affected shard degrades gracefully |
| Cache miss storm | Thundering herd protection: mutex / stale-while-revalidate |

---

## Self-Check

- [ ] Why is consistent hashing better than modulo hashing for a distributed cache?
- [ ] What happens to keys when a cache node is added with consistent hashing?
- [ ] How does replication affect read latency vs write latency?
