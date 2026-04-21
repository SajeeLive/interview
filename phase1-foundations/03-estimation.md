# Back-of-Envelope Estimation

The first 5 minutes of every system design interview. Get this wrong and the rest of the design is ungrounded.

## The Goal

Produce **order-of-magnitude** estimates to:
1. Determine if your design can handle the required scale
2. Decide which bottlenecks to prioritize
3. Size your infrastructure (number of servers, storage, bandwidth)

You don't need exact numbers. Being off by 2x is fine. Being off by 1000x is not.

---

## Key Conversion Facts

### Time
| Period | Seconds |
|---|---|
| 1 minute | 60 |
| 1 hour | 3,600 |
| 1 day | 86,400 ≈ 100,000 |
| 1 month | ~2.5M |
| 1 year | ~31.5M ≈ 30M |

**Shortcut:** 1 day ≈ 10^5 seconds

### Data sizes
| Unit | Bytes |
|---|---|
| KB | 10^3 |
| MB | 10^6 |
| GB | 10^9 |
| TB | 10^12 |
| PB | 10^15 |

### Common object sizes (approximate)
| Object | Size |
|---|---|
| ASCII character | 1 byte |
| UUID | 36 bytes |
| Tweet / short text | ~300 bytes |
| Metadata row (DB) | ~1 KB |
| Small image (thumbnail) | ~50 KB |
| Web page | ~100 KB |
| HD photo | ~3 MB |
| 1 min video (720p) | ~10 MB |

---

## The Estimation Template

For any system, work through these four numbers:

### 1. QPS (Queries Per Second)
```
Daily Active Users (DAU) × actions per user per day
÷ 86,400 (seconds in a day)
= average QPS

peak QPS ≈ 2–3× average
```

**Example:** Twitter-like system
- 300M DAU, 5 tweets/day read per user
- Read QPS = 300M × 5 / 100K = 15,000 QPS
- Peak read QPS ≈ 45,000 QPS

### 2. Storage
```
writes per day × average object size × retention period
= total storage
```

**Example:** Photo storage
- 10M photos/day × 3MB/photo = 30 TB/day
- 1 year = 30TB × 365 ≈ 10 PB

### 3. Bandwidth (Ingress / Egress)
```
QPS × average response size = bytes/second
```

**Example:** Video streaming
- 1M concurrent viewers × 5 Mbps = 5 Tbps egress

### 4. Server Count
```
total QPS / QPS per server = number of servers
```

A general-purpose server handles ~1,000–10,000 simple requests/second depending on workload.

---

## Worked Example: URL Shortener

**Given:** 100M new URLs/day, 10:1 read/write ratio

| Metric | Calculation | Result |
|---|---|---|
| Write QPS | 100M / 86,400 | ~1,200 QPS |
| Read QPS | 1,200 × 10 | ~12,000 QPS |
| Peak QPS | 12,000 × 2 | ~24,000 QPS |
| Storage / day | 100M × 500 bytes | ~50 GB/day |
| Storage / 5 years | 50 GB × 365 × 5 | ~90 TB |

**Conclusion:** This is a read-heavy system. Cache aggressively. A few servers can handle writes; reads need caching layer.

---

## Worked Example: Instagram-scale Photo Storage

**Given:** 100M DAU, 10M photo uploads/day, 200M photo views/day

| Metric | Calculation | Result |
|---|---|---|
| Upload QPS | 10M / 86,400 | ~115 QPS |
| View QPS | 200M / 86,400 | ~2,300 QPS |
| Storage / day | 10M × 3 MB | 30 TB/day |
| Storage / year | 30 TB × 365 | ~10 PB/year |
| Egress bandwidth | 2,300 × 3MB | ~6.9 GB/s |

**Conclusion:** Storage and bandwidth dominate. Object store (S3-like) + CDN is non-negotiable.

---

## Common Mistakes

- **Forgetting replication** — 3x replication factor means 3x storage
- **Ignoring peak traffic** — always multiply by 2-3x for peak
- **Mixing read/write ratios** — size read path and write path separately
- **Forgetting metadata** — even if the blob is on object storage, DB stores metadata

---

## Self-Check Questions

- [ ] 1M requests/day → what is the average QPS?
- [ ] 50M DAU, 3 actions/user/day → average QPS? Peak?
- [ ] A tweet is 300 bytes. 500M tweets/day → storage per year?
- [ ] A server handles 5,000 QPS. You need 50,000 peak QPS → how many servers?
