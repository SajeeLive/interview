# Design a Rate Limiter

Tests: algorithm knowledge, Redis, distributed systems, middleware patterns.

---

## Step 1: Requirements

### Functional
- Limit number of requests a client can make within a time window
- Return HTTP 429 when limit exceeded
- Support different limits per: user, IP, API key, endpoint

### Non-Functional
- Low latency (must not add significant overhead to every request)
- Accurate (no significant over/under counting)
- Works across multiple API server instances (distributed)
- Fault tolerant (rate limiter failure should not take down the API)

---

## Step 2: Where to Place the Rate Limiter

### Option A: API Gateway / Load Balancer
- Centralized enforcement before requests hit app servers
- Off-the-shelf: AWS API Gateway, Kong, Nginx
- App servers don't need to implement it

### Option B: Application Middleware
- More flexible (custom logic, per-route limits)
- Must use shared state (Redis) to work across instances

### Recommendation
Start with an API Gateway for simple cases. Application middleware for complex, per-feature rate limiting.

---

## Step 3: Algorithm Choice

### Token Bucket (recommended for most cases)
```
bucket_capacity = 100
refill_rate = 10 tokens/second

On each request:
  current_tokens = min(capacity, stored_tokens + elapsed * refill_rate)
  if current_tokens >= 1:
    consume 1 token → allow request
  else:
    reject with 429
```

- Allows bursting up to `capacity` then throttles to `refill_rate`
- Redis keys: `{user_id}:tokens`, `{user_id}:last_refill_time`

### Sliding Window Counter (simpler Redis implementation)
```
window = 60 seconds
limit = 100 requests

key = "rate:{user_id}:{current_minute}"
count = INCR key
if count == 1: EXPIRE key 120
if count > limit: reject
```

Use two adjacent windows and interpolate:

```
rate = prev_window_count × (1 - elapsed/window) + current_window_count
```

---

## Step 4: Redis Implementation

### Token Bucket with Lua Script (atomic)
```lua
-- Lua script (executes atomically in Redis)
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refill_rate = tonumber(ARGV[2])
local now = tonumber(ARGV[3])

local data = redis.call("HMGET", key, "tokens", "last_refill")
local tokens = tonumber(data[1]) or capacity
local last_refill = tonumber(data[2]) or now

-- Refill tokens
local elapsed = now - last_refill
tokens = math.min(capacity, tokens + elapsed * refill_rate)

if tokens >= 1 then
  tokens = tokens - 1
  redis.call("HMSET", key, "tokens", tokens, "last_refill", now)
  redis.call("EXPIRE", key, 3600)
  return 1  -- allowed
else
  return 0  -- rejected
end
```

**Why Lua?** Ensures the check-and-decrement is atomic. No race conditions.

---

## Step 5: High-Level Architecture

```
Client
  │
  ▼
[API Gateway / Load Balancer]
  │
  ▼
[Rate Limiter Middleware]
  │  Check: "is this client over limit?"
  │
  ├──→ [Redis Cluster] ← single source of truth for counters
  │
  │  If allowed: continue
  │  If denied: return 429
  ▼
[API Servers]
```

---

## Step 6: Response Headers

Return helpful headers so clients know their quota:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 42
X-RateLimit-Reset: 1704067200   (unix timestamp when bucket resets)
Retry-After: 30                 (seconds until they can retry, on 429)
```

---

## Step 7: Edge Cases

### Distributed Race Conditions
Two API servers both read "99 requests" and both allow the 100th → 101 requests processed.

**Solution:** Use Redis Lua scripts (atomic read-modify-write) or Redis transactions (`WATCH/MULTI/EXEC`).

### Redis Failure
If Redis is down, do you:
- **Fail open:** Allow all requests (availability > accuracy) — preferred for most APIs
- **Fail closed:** Reject all requests (safety > availability) — for billing-sensitive endpoints

Default: fail open with circuit breaker to Redis.

### Different Limits Per User Tier
```
free_tier: 100 req/hour
pro_tier: 10,000 req/hour
enterprise: unlimited
```
Store tier in JWT or look up from DB (cache this lookup).

### IP-Based Limiting
Watch for NAT: many users behind one IP → legitimate traffic looks like abuse.
Prefer user-level limiting when authenticated; add IP limiting as a second layer.

### Multi-Layer Rate Limiting
```
Layer 1: IP-based (prevent DDoS)              → 1,000 req/min per IP
Layer 2: User-based (enforce fair usage)       → 100 req/min per user
Layer 3: Endpoint-based (protect heavy routes) → 10 req/min per user for /search
```

---

## Self-Check

- [ ] What is the difference between token bucket and leaky bucket?
- [ ] Why use a Lua script in Redis rather than two separate Redis commands?
- [ ] Should your rate limiter fail open or closed? Why?
- [ ] How would you implement different limits for different API tiers?
- [ ] What headers should you return on a 429 response?
