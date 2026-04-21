# System Design Interview Framework

---

## The RESHADED Framework

Use this structure for every design problem. It keeps you organized and covers what interviewers evaluate.

| Step | What to Do | Time (~45 min interview) |
|---|---|---|
| **R** — Requirements | Clarify scope | 5 min |
| **E** — Estimation | Back-of-envelope | 3 min |
| **S** — Storage | Data model + DB choice | 5 min |
| **H** — High-Level Design | Boxes and arrows | 5 min |
| **A** — APIs | Key endpoints | 3 min |
| **D** — Detailed Design | Deep dive on 2-3 components | 15 min |
| **E** — Edge Cases | Failures, hotspots, limits | 5 min |
| **D** — Deep Dives | Interviewer-guided | 4 min |

---

## Step 1: Requirements

Never start designing until you've clarified requirements. This is what separates senior engineers from juniors.

### Functional Requirements
What does the system do?
- "Users can shorten URLs"
- "Users can post tweets and follow others"

Ask: "Should I focus on any specific feature?" (interviewers often want you to scope down)

### Non-Functional Requirements
This is where the interesting design happens.

- **Scale:** How many users? DAU? Writes/reads per second?
- **Latency:** What's the acceptable p99? Is this real-time?
- **Availability:** 99.9%? 99.99%? What's the cost of downtime?
- **Consistency:** Is stale data acceptable? For how long?
- **Durability:** Can we lose any data?
- **Geography:** Global? Single region?

### Template Questions to Ask
```
1. How many daily active users?
2. What is the read:write ratio?
3. Is this globally distributed or single region?
4. What is the acceptable latency for reads? Writes?
5. Can we tolerate eventual consistency, or is strong consistency required?
6. What is the data retention requirement?
```

---

## Step 2: Estimation

Show your math. Speak out loud.

```
"With 100M DAU and ~5 reads per user per day,
 that's 500M reads/day = ~6,000 read QPS.
 Peak is roughly 3x that = ~18,000 QPS.
 We'll need a caching layer for sure."
```

Key things to estimate:
- Read QPS and write QPS (separately)
- Storage (per day, per year)
- Bandwidth (ingress and egress)
- Number of servers needed

---

## Step 3: Storage (Data Model)

Sketch the data model before drawing boxes.

- What are the entities? (User, Post, URL, Message...)
- What are the relationships?
- Which queries will be most common? (This drives your DB and index choices)
- Is the data structured, semi-structured, or unstructured?

Then choose your database:
```
"Given we need fast key-value lookups by short URL and don't need
 complex queries, a NoSQL store like DynamoDB or Redis would work.
 User data has relationships, so I'd keep that in PostgreSQL."
```

---

## Step 4: High-Level Design

Draw the system at a high level. Boxes and arrows. Don't optimize yet.

Typical components to consider:
- Clients (web, mobile, API)
- Load balancer / API gateway
- Application servers
- Cache layer (Redis)
- Primary database
- Object storage (S3)
- CDN
- Message queue (Kafka, SQS)
- Background workers

Start simple, then add components as the problem demands.

---

## Step 5: APIs

Define the key endpoints. Be precise.

```
POST /api/v1/urls
  Request:  { "original_url": "https://example.com/..." }
  Response: { "short_url": "https://sho.rt/abc123" }

GET /{short_code}
  Response: 301/302 redirect to original URL
```

Mention:
- Auth mechanism (JWT, API key, OAuth)
- Rate limiting (per user, per IP)
- Versioning strategy

---

## Step 6: Detailed Design

Pick 2-3 components and go deep. The interviewer may guide this.

### What to Discuss Per Component
- **How does it work internally?**
- **What are the failure modes?**
- **How does it scale?**
- **What are the tradeoffs vs alternatives?**

Common deep-dive topics:
- How does your DB handle high write throughput? (Sharding strategy)
- How does your cache stay consistent with the DB?
- How does your ID generation work at scale?
- How do you handle the fan-out problem for a social feed?

---

## Step 7: Edge Cases

Proactively identify what can go wrong.

- **What if a server dies?** (Replication, health checks, auto-recovery)
- **What if the DB is the bottleneck?** (Read replicas, sharding, caching)
- **What about hotspots?** (Celebrity user posting; single shard getting all traffic)
- **What if the queue backs up?** (Consumer lag, autoscaling, back-pressure)
- **What about data consistency during failure?** (Idempotency, at-least-once)
- **What about security?** (Auth on endpoints, encryption at rest/in transit)

---

## Step 8: Deep Dives (Interviewer-Guided)

The interviewer will often say: "Let's talk more about X."

Common areas:
- ID generation (UUID vs auto-increment vs Snowflake)
- Pagination (offset vs cursor-based)
- Search (Elasticsearch integration)
- Real-time features (WebSockets, SSE, long polling)
- Global distribution (multi-region, data residency)

---

## Common Traps to Avoid

| Trap | Better Approach |
|---|---|
| Jumping into design without clarifying | Always ask questions first |
| Designing in silence | Narrate your thinking |
| Over-engineering immediately | Start simple, add complexity only if needed |
| Ignoring failures | Proactively discuss failure modes |
| "I would use microservices" without explaining why | Justify every architectural choice |
| Picking a DB without explaining tradeoffs | Always compare alternatives briefly |

---

## Phrases That Signal Seniority

- "Before I design anything, let me clarify the scale..."
- "There are two approaches here. Option A optimizes for... Option B optimizes for... I'd lean toward B because..."
- "This is a read-heavy system, so I want to focus on the read path first."
- "The bottleneck here is the DB. Let me talk through how I'd handle that."
- "This design has a weakness: [X]. We could mitigate it by..."
