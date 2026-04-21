# Messaging & Queues

---

## Why Async Messaging?

Synchronous calls create tight coupling and fragility:
```
User Request → API → Email Service (down!) → 500 Error
```

Async messaging decouples producer from consumer:
```
User Request → API → Queue → Email Service (processes when ready)
                 ↓
           Return 200 immediately
```

**Benefits:**
- **Resilience:** If consumer is down, messages queue up; no data loss
- **Load leveling:** Absorbs traffic spikes; consumers process at their own pace
- **Decoupling:** Producer doesn't know about consumers
- **Retry logic:** Failed messages can be retried without the producer knowing

---

## Message Queue vs Pub/Sub

### Message Queue (Point-to-Point)
- Each message is consumed by **exactly one consumer**
- Good for **task distribution** (work queues)
- Consumer competes for messages with other consumers

```
Producer → [Queue] → Consumer A (gets message 1)
                  → Consumer B (gets message 2)
                  → Consumer A (gets message 3)
```

**Use case:** Process uploaded images, send emails, background jobs

### Pub/Sub (Publish-Subscribe)
- Each message is delivered to **all subscribers**
- Good for **event broadcasting**

```
Publisher → [Topic] → Subscriber A (gets the event)
                    → Subscriber B (gets the same event)
                    → Subscriber C (gets the same event)
```

**Use case:** User signup → trigger email service + analytics service + recommendation service

---

## Kafka Deep Dive

Kafka is the dominant distributed event streaming platform. Understand it well.

### Core Concepts

**Topic:** A named stream of records. Like a database table but append-only.

**Partition:** Topics are split into partitions for parallelism. Each partition is an ordered, immutable log.

**Offset:** The position of a record within a partition. Consumers track their offset.

**Consumer Group:** A group of consumers that together consume all partitions of a topic. Each partition is assigned to exactly one consumer in the group.

```
Topic "orders" with 3 partitions:

Partition 0: [msg1, msg4, msg7, ...]
Partition 1: [msg2, msg5, msg8, ...]
Partition 2: [msg3, msg6, msg9, ...]

Consumer Group "order-processor":
  Consumer A → Partition 0
  Consumer B → Partition 1
  Consumer C → Partition 2
```

### Kafka Guarantees
- **Ordering:** Guaranteed within a partition, NOT across partitions
- **Retention:** Messages retained for a configurable period (e.g., 7 days), regardless of consumption
- **Replay:** Consumers can re-read old messages by resetting their offset
- **At-least-once delivery** by default (consumers must handle duplicates)

### Partition Key
Determines which partition a message goes to. Same key → same partition → ordering guaranteed.
```
// All orders for user 123 go to the same partition (ordered)
produce(topic="orders", key="user_123", value=order_data)
```

### When to Choose Kafka
- High throughput (millions of events/second)
- Need replay / event sourcing
- Multiple independent consumers for the same stream
- Stream processing (Kafka Streams, Flink)

---

## SQS / RabbitMQ (Traditional Queues)

### SQS (AWS Simple Queue Service)
- Managed, serverless
- **Standard:** At-least-once, best-effort ordering, very high throughput
- **FIFO:** Exactly-once, strict ordering, lower throughput (3,000 msg/s)
- Messages deleted after consumer ACKs
- Visibility timeout: message hidden from other consumers while being processed

### RabbitMQ
- Open source AMQP broker
- Supports complex routing: direct, fanout, topic, headers exchanges
- Good for traditional enterprise messaging patterns
- Better for lower-throughput, complex routing needs

---

## Idempotency

Consumers must handle duplicate messages.

**Why duplicates happen:**
- Consumer processes message, crashes before ACKing → redelivered
- Network issue causes duplicate delivery
- Retry logic triggers

**How to handle:**
1. **Idempotent operations:** Same message processed twice = same result (e.g., `SET balance = 100` is idempotent, `ADD 10 to balance` is not)
2. **Deduplication key:** Store processed message IDs in Redis/DB; skip if already seen
3. **Database upsert:** Use `INSERT ... ON CONFLICT DO NOTHING` or `ON DUPLICATE KEY UPDATE`

---

## Dead Letter Queue (DLQ)

When a message fails processing repeatedly, move it to a DLQ instead of blocking the main queue.

```
Main Queue → Consumer (fails 3 times) → Dead Letter Queue
                                          ↓
                                    Alert + manual inspection
```

Prevents a single bad message from blocking all processing.

---

## Backpressure

When consumers can't keep up with producers, the queue grows unboundedly.

**Solutions:**
- **Scale consumers horizontally** (add more consumer instances)
- **Rate limit producers** at the source
- **Shed load:** Drop non-critical messages when queue depth exceeds threshold
- **Circuit breaker on producer side**

---

## Self-Check Questions

- [ ] What is the difference between a message queue and pub/sub?
- [ ] Why do Kafka partitions guarantee ordering within a partition but not across?
- [ ] What happens if a Kafka consumer crashes mid-processing?
- [ ] Why must message consumers be idempotent?
- [ ] What is a dead letter queue and why is it important?
- [ ] How does a consumer group enable parallel consumption in Kafka?
