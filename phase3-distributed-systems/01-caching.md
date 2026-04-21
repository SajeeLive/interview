# Caching

Caching is one of the highest-ROI topics in system design. Almost every high-scale system depends on it.

---

## Why Cache?

- DB reads: ~1-10ms
- Redis (in-memory): ~100μs–1ms
- Local in-process cache: ~100ns

Caching reduces latency, reduces DB load, and increases throughput — often by orders of magnitude.

---

## Cache Hierarchy (Closest to Farthest)

```
1. In-process memory (local cache)     ← fastest, not shared
2. Distributed cache (Redis, Memcached) ← shared across servers
3. DB query cache                       ← deprecated in modern DBs
4. CDN                                  ← for static/cacheable HTTP responses
5. DNS cache                            ← for name resolution
```

---

## Cache Strategies

### Cache-Aside (Lazy Loading) — most common
App manages the cache explicitly.

```
Read:
  1. Check cache
  2. Cache hit → return data
  3. Cache miss → query DB, write to cache, return data

Write:
  1. Write to DB
  2. Invalidate (delete) or update cache entry
```

**Pros:** Only caches what's actually needed; cache failure doesn't break the app
**Cons:** First request is always slow (cache miss); potential for stale data

### Write-Through
Write to cache and DB simultaneously on every write.

```
Write:
  1. Write to cache
  2. Write to DB (synchronously)
```

**Pros:** Cache always consistent with DB
**Cons:** Write latency increases; cache fills with data that may never be read

### Write-Behind (Write-Back)
Write to cache immediately, write to DB asynchronously.

```
Write:
  1. Write to cache
  2. Return to client
  3. Async: flush cache to DB later
```

**Pros:** Very low write latency
**Cons:** Risk of data loss if cache crashes before flush; more complex

### Read-Through
Cache sits in front of DB; fetches from DB automatically on miss.

```
Read:
  Client → Cache → (on miss) → DB → Cache → Client
```

**Pros:** App code simpler (doesn't manage cache explicitly)
**Cons:** First request is slow; cache library must support it

---

## Eviction Policies

When the cache is full, something must be evicted.

| Policy | How It Works | Best For |
|---|---|---|
| **LRU** (Least Recently Used) | Evict the item not accessed for the longest time | General purpose |
| **LFU** (Least Frequently Used) | Evict the item accessed least often overall | Skewed access patterns |
| **FIFO** | Evict oldest item | Rarely optimal |
| **TTL** (Time to Live) | Items expire after a fixed duration | Data with known staleness tolerance |
| **Random** | Evict a random item | Simple, surprisingly competitive |

**Redis default:** LRU with `maxmemory-policy`. LFU available as an option.

---

## Cache Invalidation

> "There are only two hard things in Computer Science: cache invalidation and naming things." — Phil Karlton

### Strategies
1. **TTL expiry** — simplest; tolerate some staleness
2. **Write-through** — update/delete cache on every write
3. **Event-driven** — pub/sub: when DB changes, publish event, cache subscribes and invalidates
4. **Cache-aside delete** — on write to DB, delete the cache key; next read repopulates

### Stale-While-Revalidate
Serve stale cache data while asynchronously refreshing it. Reduces latency spikes during refresh.

---

## The Thundering Herd Problem

When a cache key expires, thousands of concurrent requests all miss the cache simultaneously and hammer the DB.

**Solutions:**
1. **Mutex/lock:** Only one request fetches from DB; others wait. (Redis `SET NX` lock)
2. **Probabilistic early expiration:** Randomly expire hot keys slightly before actual TTL
3. **Stale-while-revalidate:** Serve stale data while background refresh happens
4. **Jitter on TTLs:** Add random variance to TTLs so not everything expires at once

---

## Cache Stampede vs Hot Key

- **Stampede:** Many keys expire simultaneously → DB flood
- **Hot key:** One key receives extreme traffic → single cache node overloaded

**Hot key solutions:**
- Replicate the hot key across multiple cache nodes
- Local in-process cache (L1) for the hottest keys
- Read from multiple replicas

---

## Redis vs Memcached

| | Redis | Memcached |
|---|---|---|
| Data structures | Strings, lists, sets, sorted sets, hashes, streams | String only |
| Persistence | RDB snapshots + AOF log | None |
| Replication | Yes (primary-replica) | No |
| Pub/Sub | Yes | No |
| Lua scripting | Yes | No |
| Clustering | Yes | Yes |
| Use case | General purpose, pub/sub, distributed locks, queues | Pure high-speed cache |

**Pick Redis** unless you have a very specific reason for Memcached.

---

## Distributed Locks with Redis

```
SET lock_key unique_id NX PX 30000
```
- `NX` — only set if not exists
- `PX 30000` — auto-expire after 30 seconds (prevents deadlock if holder crashes)

Use Redlock algorithm for distributed lock across multiple Redis nodes.

---

## Self-Check Questions

- [ ] What is the difference between cache-aside and write-through?
- [ ] What causes the thundering herd problem and how do you prevent it?
- [ ] When would you use LFU eviction over LRU?
- [ ] What happens if Redis goes down and you're using cache-aside?
- [ ] What is a hot key problem and how do you solve it?
- [ ] Why does adding jitter to TTLs help?
