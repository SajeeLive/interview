# CAP Theorem

## The Theorem

A distributed system can only guarantee **two of three** properties simultaneously:

| Property | Definition |
|---|---|
| **C**onsistency | Every read returns the most recent write (or an error) |
| **A**vailability | Every request receives a response (not necessarily the latest data) |
| **P**artition Tolerance | The system continues operating when network partitions occur |

**The catch:** Network partitions are unavoidable in real distributed systems.
This means you're really choosing between **CP** or **AP** — not CA.

---

## CP vs AP

### CP (Consistency + Partition Tolerance)
- Returns an error rather than stale data
- Right choice when **correctness is critical**
- Examples: banking, inventory counts, distributed locks

**Real systems:** HBase, Zookeeper, etcd, traditional RDBMS (with sync replication)

### AP (Availability + Partition Tolerance)
- Returns the best available data even if stale
- Right choice when **uptime and responsiveness matter more**
- Examples: social media feeds, DNS, shopping carts

**Real systems:** Cassandra, DynamoDB (by default), CouchDB

---

## Common Interview Trap

Interviewers expect you to challenge the binary framing:

> "CAP says I have to give up consistency OR availability — but in practice, I can tune the level of consistency. Cassandra lets me choose consistency level per query: `QUORUM` for strong consistency, `ONE` for high availability."

This shows you understand **tunable consistency** — a real-world nuance that matters.

---

## PACELC Extension

CAP only applies during a **partition**. PACELC extends it:

> Even when the system is running **normally (no partition)**, you still face a tradeoff between **Latency** and **Consistency**.

- **PA/EL** (e.g. Dynamo): Available during partition, low latency normally
- **PC/EC** (e.g. HBase): Consistent during partition, consistent normally
- **PA/EC** (e.g. Cassandra with tuning): Available during partition, consistent normally

---

## Key Takeaways for Interviews

1. Always ask: "What are the consistency requirements?" before picking a database.
2. Know that you're almost always choosing **CP vs AP** (not CA).
3. Mention tunable consistency to show depth.
4. Connect to real systems — don't leave it abstract.

---

## Self-Check Questions

- [ ] Explain CAP in plain English without using the word "theorem"
- [ ] Give a concrete example of a system that must be CP
- [ ] Give a concrete example of a system where AP is fine
- [ ] What does eventual consistency mean in practice?
- [ ] Why can't you have CA in a real distributed system?
