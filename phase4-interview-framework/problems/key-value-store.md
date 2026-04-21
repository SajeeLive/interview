# Design a Distributed Key-Value Store

The deepest distributed systems problem. Tests: CAP, consistent hashing, replication, conflict resolution.

This is essentially "design DynamoDB or Cassandra."

---

## Step 1: Requirements

### Functional
- `get(key)` → value
- `put(key, value)`
- `delete(key)`

### Non-Functional
- High availability (AP system — tolerate node failures)
- Horizontal scalability (10s of nodes → 1000s)
- Tunable consistency (eventual by default, strong on demand)
- Low latency: p99 read/write < 10ms

---

## Step 2: CAP Choice

We choose **AP** (Available + Partition Tolerant).
- System stays available even if some nodes are unreachable
- Reads may return stale data
- Conflict resolution needed for concurrent writes

---

## Step 3: Data Distribution — Consistent Hashing

- Keys distributed across nodes via consistent hashing ring
- Each node is responsible for a range of the key space
- Virtual nodes for even distribution and graceable scaling

---

## Step 4: Replication

Each key is replicated to N nodes (typically N=3).

**Replication factor N=3:**
```
Key "foo" → primary node → replicated to next 2 nodes on the ring
```

### Quorum (Tunable Consistency)
- **W** = write quorum (how many nodes must ack a write)
- **R** = read quorum (how many nodes must respond to a read)
- **N** = total replicas

Rules:
```
W + R > N → strong consistency (reads see latest write)
W + R ≤ N → eventual consistency (faster, more available)
```

Common configurations:
| W | R | N | Property |
|---|---|---|---|
| 1 | 1 | 3 | Fastest, eventual consistency |
| 2 | 2 | 3 | Strong consistency |
| 3 | 1 | 3 | Strong write, fast read |
| 1 | 3 | 3 | Fast write, strong read |

---

## Step 5: Conflict Resolution

When two writes to the same key happen concurrently (before replication syncs):

### Last-Write-Wins (LWW)
Use timestamp. Higher timestamp wins.
**Problem:** Clock skew across nodes can cause data loss.

### Vector Clocks
Track causality. Detect when writes are truly concurrent (not just reordered).
On conflict: return both versions to the client, let the application resolve.

**Used by:** Amazon DynamoDB (originally), Riak

---

## Step 6: Failure Handling

### Hinted Handoff
If the target node for a write is down, route to a nearby "hint" node temporarily.
When the target recovers, the hint node replays the writes.

### Anti-Entropy (Read Repair)
On read, coordinator compares responses from R nodes.
If inconsistent: background repair to sync the straggler.

### Gossip Protocol
Nodes periodically exchange state with random neighbors.
Eventually, all nodes know about failures and updates without central coordinator.

```
Node A ← gossips → Node B ← gossips → Node C
"Node D seems down" spreads across the cluster
```

---

## Step 7: Architecture

```
[Client]
  │
  ▼
[Coordinator Node]  ← any node can be coordinator
  │
  ├── Hash key → identify N responsible nodes
  │
  ├──→ [Node A]  ← primary for this key range
  ├──→ [Node B]  ← replica
  └──→ [Node C]  ← replica

Wait for W writes / R reads before responding to client.
```

---

## Step 8: Storage Engine (Deep Dive)

### LSM Tree (Log-Structured Merge Tree) — used by Cassandra, RocksDB
- All writes go to in-memory memtable (fast)
- Periodically flushed to immutable SSTable files on disk
- Background compaction merges SSTables
- **Write-optimized** — sequential disk writes

### B-Tree — used by PostgreSQL, traditional RDBMS
- Balanced tree stored on disk
- In-place updates
- **Read-optimized** — predictable read performance

---

## Self-Check

- [ ] With N=3, W=2, R=2, is this CP or AP? What happens during a partition?
- [ ] What is hinted handoff and when does it apply?
- [ ] Why does last-write-wins with timestamps cause problems?
- [ ] What is the gossip protocol and why is it used instead of a central coordinator?
- [ ] Why is LSM tree write-optimized? What is the cost?
