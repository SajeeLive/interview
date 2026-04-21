# Data Consistency in Distributed Systems

---

## Consistency Models (Weakest to Strongest)

### Eventual Consistency
- Replicas will converge to the same value — eventually
- Reads may return stale data
- **Example:** DNS propagation, Cassandra at consistency level ONE

### Monotonic Read Consistency
- If you read value X, you will never see an older value on subsequent reads
- You won't go back in time
- **Example:** Routing all your reads to the same replica

### Read-Your-Writes Consistency
- After you write, you will always see that write in subsequent reads
- Other users might still see stale data
- **Example:** After posting a tweet, you see it immediately (but others might not yet)
- **Implementation:** Route reads to primary for N seconds after a write, or use sync replication

### Causal Consistency
- Causally related operations are seen in order by all users
- If A happens before B (and B depends on A), everyone sees A before B

### Sequential Consistency
- All operations appear to execute in some global sequential order
- Every client sees the same order of operations

### Linearizability (Strongest)
- Operations appear to execute instantaneously at some point between their start and end
- Reads always return the most recent committed write
- **Example:** A distributed lock (etcd, Zookeeper) must be linearizable

---

## Distributed Transactions

### The Problem
```
Transfer $100 from Account A to Account B:
  1. Debit A by $100
  2. Credit B by $100
```
What if step 1 succeeds but step 2 fails? The money disappears.

This is trivial with ACID on one DB. Across multiple services/DBs, it requires distributed transaction protocols.

### 2PC (Two-Phase Commit)

**Phase 1 — Prepare:**
Coordinator asks all participants: "Can you commit?"
Each participant locks resources and responds Yes/No.

**Phase 2 — Commit or Abort:**
If all said Yes → Coordinator sends Commit.
If any said No → Coordinator sends Abort.

```
Coordinator → [Prepare?] → DB1, DB2, DB3
Coordinator ← [Yes/No]  ← DB1, DB2, DB3
Coordinator → [Commit!] → DB1, DB2, DB3
```

**Problems with 2PC:**
- **Blocking:** If coordinator crashes after Phase 1, participants are stuck holding locks forever
- **Slow:** Two round-trips, all participants must respond
- **Single point of failure:** Coordinator

**Used by:** Traditional distributed databases, XA transactions

### Saga Pattern (preferred for microservices)

Break a distributed transaction into a sequence of local transactions, each publishing an event that triggers the next.

If a step fails, execute compensating transactions to undo previous steps.

**Choreography (event-driven):**
```
OrderService → [OrderCreated event]
  → PaymentService → [PaymentProcessed event]
    → InventoryService → [InventoryReserved event]
      → ShippingService → [OrderShipped event]
```

If InventoryService fails:
```
InventoryService → [InventoryFailed event]
  → PaymentService → [RefundPayment] ← compensating transaction
    → OrderService → [CancelOrder] ← compensating transaction
```

**Orchestration (centralized):**
A saga orchestrator sends commands and waits for responses. Easier to understand, single place for error handling.

**Tradeoffs vs 2PC:**
| | 2PC | Saga |
|---|---|---|
| Consistency | Strong | Eventual |
| Failure handling | Automatic rollback | Compensating transactions |
| Coupling | Tight (coordinator knows all) | Loose |
| Scalability | Poor (blocking) | Good |
| Complexity | Protocol complexity | Business logic complexity |

---

## Optimistic vs Pessimistic Locking

### Pessimistic Locking
Lock the row before reading it. No one else can modify it until you're done.

```sql
SELECT * FROM accounts WHERE id = 1 FOR UPDATE;  -- lock acquired
-- do your thing
UPDATE accounts SET balance = ... WHERE id = 1;
COMMIT;  -- lock released
```

**Good for:** High contention, short transactions
**Bad for:** Long transactions, many readers

### Optimistic Locking
Don't lock. Track a version number. On update, verify version hasn't changed.

```sql
-- Read
SELECT balance, version FROM accounts WHERE id = 1;
-- (balance=100, version=5)

-- Later: update only if version still 5
UPDATE accounts SET balance=90, version=6
WHERE id=1 AND version=5;
-- If 0 rows updated → someone else modified it → retry
```

**Good for:** Low contention, read-heavy workloads
**Bad for:** High contention (many retries, degraded performance)

---

## Vector Clocks

Used to track causality in distributed systems. Each node maintains a counter; clocks are compared to determine if events are causally related or concurrent.

```
Node A: [A:1, B:0, C:0] → sends to B
Node B: [A:1, B:1, C:0] → sends to C
Node C: [A:1, B:1, C:1]
```

If event X has a vector clock that is strictly less than event Y's, X happened before Y (causal relationship).
If neither is strictly less, the events are concurrent (conflict → merge or user resolution needed).

**Used by:** DynamoDB, Riak, CRDTs

---

## CRDTs (Conflict-free Replicated Data Types)

Data structures designed to be merged from multiple replicas without conflicts.

**Examples:**
- **G-Counter:** Only increments, merge by taking max per node — always consistent
- **PN-Counter:** Positive + negative counters, supports increment and decrement
- **OR-Set:** Set that handles concurrent add/remove correctly
- **LWW-Register (Last-Write-Wins):** Use timestamp to resolve conflicts

**Used by:** Redis Cluster, Riak, collaborative editing (Google Docs)

---

## Self-Check Questions

- [ ] What is the difference between eventual consistency and linearizability?
- [ ] What is the read-your-writes problem and how do you solve it?
- [ ] Why does 2PC have a blocking problem?
- [ ] Walk through a saga for an e-commerce order: what compensating transactions are needed?
- [ ] When is optimistic locking better than pessimistic?
- [ ] What does it mean for two events to be "concurrent" in the vector clock sense?
