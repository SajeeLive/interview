# Databases

The most important topic in system design interviews. Every system stores data; the DB choice defines the architecture.

---

## SQL vs NoSQL — When to Choose Each

### Choose SQL (Relational) when:
- Data has **clear relationships** (foreign keys, joins)
- You need **ACID transactions** (money, inventory)
- Schema is **stable and known upfront**
- You need **complex queries** (aggregations, reporting)

**Systems:** PostgreSQL, MySQL, SQLite

### Choose NoSQL when:
- You need **horizontal scalability** beyond what a single SQL node can handle
- Data is **document-shaped** or **variable schema**
- You need **extremely low latency** at scale (key-value lookups)
- **Write throughput** is the bottleneck

**Systems:**
| Type | System | Use Case |
|---|---|---|
| Key-Value | Redis, DynamoDB | Sessions, caching, simple lookups |
| Document | MongoDB, Firestore | JSON documents, content management |
| Wide-Column | Cassandra, HBase | Time series, event logs, high write throughput |
| Graph | Neo4j | Social graphs, recommendation engines |

---

## Indexes

### What They Do
An index is a separate data structure (usually a B-tree) that allows the DB to find rows without a full table scan.

```
Without index: O(n) — scan every row
With index:    O(log n) — traverse the B-tree
```

### B-Tree Indexes (Default)
- Great for **equality** (`WHERE id = 5`) and **range** queries (`WHERE created_at > '2024-01-01'`)
- Not great for full-text search or similarity

### Tradeoffs
- Reads get faster
- **Writes get slower** — every insert/update must update all indexes
- **Storage cost** — indexes take disk space

### Composite Indexes
Index on multiple columns `(user_id, created_at)`:
- Efficient for `WHERE user_id = 5 ORDER BY created_at`
- Column **order matters** — leftmost prefix rule

### Interview Tip
> "I'd add an index on `user_id` and a composite index on `(user_id, created_at)` for timeline queries. But I'd monitor write latency since each index adds overhead."

---

## Replication

### Primary-Replica (Master-Slave)
```
            Writes
Client ──────────→ Primary
                      │
              Replication (async)
                      │
              ┌───────┴───────┐
           Replica1        Replica2
              ↑                ↑
           Reads             Reads
```

- **Reads** scale horizontally (add replicas)
- **Writes** are still bottlenecked at primary
- **Replication lag** — replicas may be slightly behind (eventual consistency)

### Sync vs Async Replication
| | Sync | Async |
|---|---|---|
| Data durability | Higher (no data loss) | Lower (can lose recent writes on failure) |
| Write latency | Higher (wait for replica ack) | Lower (fire and forget) |
| Use case | Banking, critical data | High-throughput, tolerable lag |

### Read-Your-Writes Problem
After writing, if you immediately read from a replica, you might not see your own write.
**Solutions:** Route reads to primary for a short window after a write, or use sync replication for critical reads.

---

## Sharding (Horizontal Partitioning)

Split data across multiple DB nodes, each responsible for a subset.

### Strategies

**Key-based (Hash) Sharding**
```
shard = hash(user_id) % num_shards
```
- Even distribution
- Can't do range queries across shards
- Adding shards requires reshuffling (mitigated by consistent hashing)

**Range-based Sharding**
```
Shard 1: user_id 0–999999
Shard 2: user_id 1000000–1999999
```
- Range queries are efficient
- Risk of **hotspots** (all new users hit the latest shard)

**Directory-based Sharding**
- A lookup table maps keys to shards
- Flexible, but the lookup table becomes a bottleneck/SPOF

### Problems with Sharding
- **Cross-shard joins** — very expensive, usually avoided
- **Cross-shard transactions** — require distributed transaction protocols (2PC)
- **Resharding** — painful when a shard gets too large
- **Hotspots** — one shard handling disproportionate traffic (e.g. a celebrity user)

---

## ACID vs BASE

### ACID (SQL guarantee)
| Property | Meaning |
|---|---|
| **A**tomicity | All-or-nothing: the whole transaction commits or none of it does |
| **C**onsistency | DB moves from one valid state to another |
| **I**solation | Concurrent transactions don't interfere |
| **D**urability | Committed data survives crashes |

### BASE (NoSQL tradeoff)
| Property | Meaning |
|---|---|
| **B**asically **A**vailable | System is available even if some nodes fail |
| **S**oft state | State may change over time even without input |
| **E**ventually consistent | System will become consistent given enough time |

---

## Connection Pooling

Establishing a DB connection is expensive (~20–100ms). Connection pooling maintains a pool of open connections that can be reused.

- Each app server has a pool of N connections to the DB
- Requests borrow a connection, execute the query, return it to the pool
- **Too few connections:** requests queue up
- **Too many connections:** DB runs out of memory handling them

**Tools:** PgBouncer (Postgres), HikariCP (Java), built-in pooling in most ORMs

---

## Self-Check Questions

- [ ] When would you choose Cassandra over PostgreSQL?
- [ ] What happens to write performance as you add indexes?
- [ ] Explain replication lag and when it causes problems
- [ ] What is a hotspot in sharding and how do you fix it?
- [ ] What does "eventually consistent" mean in plain English?
- [ ] Why would you use connection pooling?
