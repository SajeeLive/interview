# Latency Numbers Every Engineer Should Know

Originally from Jeff Dean (Google). Essential for back-of-envelope estimation.

## The Numbers

| Operation | Latency | Notes |
|---|---|---|
| L1 cache reference | ~1 ns | |
| L2 cache reference | ~4 ns | 4x L1 |
| L3 cache reference | ~10 ns | |
| Main memory (RAM) access | ~100 ns | 100x L1 |
| SSD random read | ~100 μs | 100,000x RAM |
| HDD random seek | ~10 ms | 100x SSD |
| Read 1MB from RAM | ~250 μs | |
| Read 1MB from SSD | ~1 ms | |
| Read 1MB from HDD | ~20 ms | |
| Same datacenter round trip | ~500 μs | |
| Cross-region round trip (US→EU) | ~150 ms | |
| Cross-continent round trip | ~300 ms | |

## Order of Magnitude Summary

```
L1 cache:       1 ns
L2 cache:       4 ns
RAM:          100 ns
SSD:          100 μs   (100,000 ns)
HDD:           10 ms   (10,000,000 ns)
Network LAN:  500 μs
Network WAN: 100-300 ms
```

---

## Why This Matters in Interviews

Use these numbers to justify design decisions:

- **"Why cache in Redis instead of hitting the DB every time?"**
  → DB on SSD = ~100μs per read. Redis in RAM = ~100ns. That's 1000x faster.

- **"Why keep frequently-read data in-process (local cache)?"**
  → Network call to Redis = ~500μs. Local memory = ~100ns. ~5000x faster.

- **"Why use a CDN?"**
  → Cross-continent = ~300ms. CDN edge node (nearby) = ~10ms. 30x faster.

- **"Why avoid cross-region synchronous replication?"**
  → Every write waits 150-300ms for the ack. Kills throughput.

---

## Derived Rules of Thumb

| Rule | Implication |
|---|---|
| RAM is 1000x faster than SSD | Always cache hot data in memory |
| Disk seeks are expensive | Batch writes, use sequential I/O |
| Same-DC network is fast (~0.5ms) | Microservices within a DC are fine |
| Cross-region is slow (150ms+) | Avoid synchronous cross-region calls in the critical path |
| Compression is worth it | CPU is cheaper than bandwidth/IO |

---

## Bandwidth Numbers (also useful)

| Medium | Throughput |
|---|---|
| RAM | ~10 GB/s |
| SSD | ~500 MB/s |
| Gigabit Ethernet | ~125 MB/s |
| HDD | ~100 MB/s |
| Cross-DC network | ~1 Gbps (shared) |

---

## Self-Check Questions

- [ ] How much faster is RAM than SSD? (order of magnitude)
- [ ] Given 1M requests/day, what's the average QPS? (≈ 12 QPS)
- [ ] If a DB query takes 10ms, how many can one thread handle per second? (100)
- [ ] Why would you avoid a synchronous call to another region in a user-facing API?
