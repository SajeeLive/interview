# Reliability Patterns

---

## Circuit Breaker

Prevents cascading failures when a downstream service is unhealthy.

### The Problem
```
Service A → Service B (slow/down)
          ↓
Service A threads pile up waiting
          ↓
Service A runs out of threads
          ↓
Service A goes down
          ↓
Service C (depends on A) goes down
```
One failing service takes down everything.

### The Solution: Circuit Breaker States

```
           failures > threshold
CLOSED ──────────────────────────→ OPEN
(normal, requests pass)            (fail fast, no requests sent)
          ↑                              │
          │                    timeout elapsed
          │                              │
          └──── success ──── HALF-OPEN ←┘
                              (probe: send one request)
```

- **Closed:** All requests pass through. Tracks failure rate.
- **Open:** Requests fail immediately (no waiting). Returns cached/default response.
- **Half-Open:** Allows a probe request. If success → Closed. If fail → Open again.

**Libraries:** Hystrix (Java, deprecated), Resilience4j (Java), Polly (.NET), `pybreaker` (Python)

---

## Retry with Exponential Backoff

Retrying immediately after a failure usually makes things worse (hammers the recovering service).

### Naive Retry (bad)
```
Fail → Wait 1s → Retry → Fail → Wait 1s → Retry ...
```
If 1000 clients do this simultaneously, the struggling service gets 1000 requests per second indefinitely.

### Exponential Backoff
```
Fail → Wait 1s → Fail → Wait 2s → Fail → Wait 4s → Fail → Wait 8s
```
Each retry doubles the wait. Service gets breathing room.

### With Jitter (best practice)
```
Wait = min(cap, base * 2^attempt) + random_jitter
```
Jitter prevents retry thundering herd (all clients retrying at the same instant).

**Rule of thumb:** Set a max retry count. After that, fail or route to DLQ.

---

## Rate Limiting

Controls how many requests a client can make in a time window.

### Why It Matters
- Prevents abuse and DoS attacks
- Enforces fair usage (one customer can't starve others)
- Protects downstream services

### Algorithms

**Token Bucket**
- Bucket holds N tokens. Each request consumes one token. Tokens refill at rate R/second.
- Allows bursting up to N requests, then throttles to R/second
- Most common algorithm

**Leaky Bucket**
- Requests enter a queue (bucket). Processed at a fixed rate regardless of input.
- Smooths out bursts — no spikes pass through
- Bad for bursty but legitimate traffic

**Fixed Window Counter**
- Count requests per time window (e.g., 100 requests per minute)
- Edge case: 100 requests at end of minute + 100 at start of next = 200 in 2 seconds

**Sliding Window Log**
- Record timestamp of each request. Count those within the window.
- Accurate but high memory usage (stores all timestamps)

**Sliding Window Counter**
- Interpolate between current and previous window counts
- Good accuracy, low memory — production favorite

### Implementation
Rate limiting state must be centralized (Redis) for distributed systems.

```
key = "rate_limit:{user_id}"
current = INCR key
if current == 1: EXPIRE key 60
if current > limit: reject request
```

---

## Consistent Hashing

When you have N cache/DB nodes, `hash(key) % N` means that adding or removing one node reassigns ~N-1/N of all keys (massive rehashing).

Consistent hashing minimizes the keys that need remapping when nodes are added/removed.

### How It Works
- Hash both nodes and keys onto a circular ring (0 to 2^32)
- Each key is assigned to the first node clockwise from its position
- Adding a node: only the keys between the new node and its predecessor need remapping
- Removing a node: only that node's keys move to the next node

```
         Key A
          ↓
Ring: ── Node1 ── Key B ── Node2 ── Key C ── Node3 ── Key A ──
```

**Virtual nodes:** Each physical node occupies multiple positions on the ring for more even distribution.

**Used by:** Cassandra, DynamoDB, Amazon's Dynamo, distributed caches

---

## Bulkhead Pattern

Isolate failures so one slow resource doesn't exhaust all shared resources.

### Example
Without bulkhead: all API calls share one thread pool
```
Slow /search endpoint consumes all threads
→ /checkout (critical) can't get a thread
→ Revenue loss
```

With bulkhead: separate thread pools per endpoint type
```
/search  → thread pool A (10 threads)
/checkout → thread pool B (20 threads)
/profile  → thread pool C (5 threads)
```

Each compartment can fail independently.

---

## Timeout

Always set timeouts on outbound calls. Without them, threads pile up waiting forever.

### Three Types
- **Connection timeout:** How long to wait to establish a connection
- **Read timeout:** How long to wait for a response after connecting
- **Request timeout:** Overall end-to-end timeout

### Cascading Timeout Budget
Set internal timeouts shorter than the caller's timeout, so you have time to return a meaningful error.

```
User (5s timeout)
  → Service A (4s timeout)
    → Service B (3s timeout)
      → DB (2s timeout)
```

---

## Idempotency Keys

For write operations (payments, order creation), clients include a unique idempotency key.

```
POST /charge
Idempotency-Key: "unique-uuid-123"
{amount: 100}
```

If the request is retried (due to timeout), the server detects the duplicate key and returns the original result without double-charging.

---

## Self-Check Questions

- [ ] Explain the three states of a circuit breaker and when each applies
- [ ] Why is exponential backoff + jitter better than plain exponential backoff?
- [ ] What problem does the fixed window rate limiting algorithm have?
- [ ] When would you use consistent hashing over modulo hashing?
- [ ] What is the bulkhead pattern and what failure mode does it prevent?
- [ ] Why must all outbound calls have timeouts?
