# Design a Notification System

Tests: async messaging, fan-out, multi-channel delivery, reliability.

---

## Step 1: Requirements

### Functional
- Send notifications via: push (mobile), email, SMS
- Support: transactional (1:1) and broadcast (1:many)
- User can manage notification preferences (opt-out per channel/type)

### Non-Functional
- At-least-once delivery (no missed critical notifications)
- Scale: 10M notifications/day
- Low latency for push (<5s), email/SMS best-effort
- Respect user preferences and quiet hours

---

## Step 2: Estimation

| Channel | Volume | QPS |
|---|---|---|
| Push | 7M/day | ~80 |
| Email | 2M/day | ~23 |
| SMS | 1M/day | ~12 |

Peak ~3x = 350 QPS. Not heavy compute, but needs reliable delivery.

---

## Step 3: High-Level Architecture

```
[Notification API]       ← receives requests from other services
  │
  ▼
[Message Queue]          ← Kafka topics per channel
  │
  ├──→ [Push Worker]    → APNs (Apple) / FCM (Google)
  ├──→ [Email Worker]   → SendGrid / SES
  └──→ [SMS Worker]     → Twilio / SNS
          │
          ▼
    [Delivery Receipt Store]  ← track delivery status
```

---

## Step 4: Key Design Decisions

### Preference Filtering
Before enqueueing, check user preferences:
```
GET /preferences/{user_id} → { push: true, email: false, sms: true }
```
Cache preferences in Redis (hot path). Invalidate on update.

### Deduplication
Notification service may receive the same event twice (at-least-once from upstream).
Use idempotency keys: hash of `(user_id, notification_type, entity_id)` to deduplicate.

### Retry Logic
External providers (APNs, Twilio) fail occasionally.
- Retry with exponential backoff
- After N failures → move to DLQ
- Alert on DLQ growth

### Device Token Management
Push notifications require device tokens.
- Tokens expire or become invalid (user uninstalls app)
- On 410 response from APNs → remove token from DB

---

## Step 5: Reliability Patterns

- Kafka guarantees at-least-once delivery to workers
- Workers are idempotent (deduplication store in Redis)
- DLQ for failed deliveries
- Delivery status stored for each notification attempt

---

## Self-Check

- [ ] Why use a message queue instead of synchronously calling push/email/SMS services?
- [ ] How would you handle a user who has disabled email but enabled push?
- [ ] What happens if a push notification token is stale?
- [ ] How would you implement "quiet hours" (no notifications 10pm–8am)?
