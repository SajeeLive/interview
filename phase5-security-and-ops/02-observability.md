# Observability

---

## The Three Pillars

### 1. Metrics
Numeric measurements aggregated over time.

```
http_requests_total{method="GET", status="200"} = 1234567
http_request_duration_p99 = 145ms
db_connections_active = 87
```

**Use for:** Dashboards, alerting, capacity planning
**Tools:** Prometheus, Datadog, CloudWatch

### 2. Logs
Structured or unstructured text records of discrete events.

```json
{
  "timestamp": "2024-01-01T10:00:00Z",
  "level": "ERROR",
  "service": "payment-service",
  "trace_id": "abc-123",
  "message": "Payment failed",
  "user_id": 456,
  "error": "timeout after 5000ms"
}
```

**Use for:** Debugging, auditing, compliance
**Tools:** Elasticsearch + Kibana (ELK), Datadog Logs, CloudWatch Logs

### 3. Traces
Records the path of a single request through multiple services.

```
Request abc-123:
  API Gateway (2ms)
    └── Auth Service (5ms)
    └── Order Service (50ms)
          └── DB query: SELECT (30ms)
          └── Inventory Service (15ms)
    └── Response (1ms)
  Total: 73ms
```

**Use for:** Finding where latency comes from, understanding dependencies
**Tools:** Jaeger, Zipkin, Datadog APM, AWS X-Ray

---

## SLI / SLO / SLA

### SLI (Service Level Indicator)
A metric you measure. The "what."

```
SLI = (successful requests / total requests) × 100%
```

Common SLIs:
- Availability: `% of requests returning 2xx/3xx`
- Latency: `% of requests completing < 200ms`
- Error rate: `% of requests returning 5xx`
- Throughput: `requests per second`

### SLO (Service Level Objective)
Your target for an SLI. The "how good."

```
SLO: 99.9% of requests return 2xx over a 30-day rolling window
SLO: p99 latency < 200ms
```

**Error budget:** How much you can fail and still meet the SLO.
```
99.9% availability → 0.1% failure allowed
= 43.8 minutes downtime/month
```

### SLA (Service Level Agreement)
A contract with customers. The "what happens if we fail."
- Typically set lower than SLO (leave a buffer)
- Breach results in financial penalties or credits

### How to Use Error Budgets
If you're burning error budget fast → slow down feature releases, focus on reliability.
If error budget is barely touched → teams can take more risk with deploys.

---

## What to Alert On

### Alert on Symptoms, Not Causes
```
Bad:  Alert when CPU > 80%
Good: Alert when error rate > 1% (the symptom the user experiences)
```

CPU at 80% might be fine. A 1% error rate is definitely affecting users.

### Four Golden Signals (Google SRE)
1. **Latency** — how long requests take (separately: success vs error latency)
2. **Traffic** — how many requests per second
3. **Errors** — rate of failed requests
4. **Saturation** — how full the system is (CPU, memory, queue depth)

### Alert Fatigue
Too many alerts → engineers ignore them. Every alert should be:
- **Actionable** — requires a human to do something
- **Urgent** — waking someone at 3am is justified
- **Not handled automatically** — if automation can fix it, it should

---

## Structured Logging

Logs should be machine-parseable JSON, not free-form text.

**Bad:**
```
2024-01-01 10:00:00 ERROR Payment failed for user 456 after 5000ms
```

**Good:**
```json
{
  "timestamp": "2024-01-01T10:00:00Z",
  "level": "ERROR",
  "event": "payment_failed",
  "user_id": 456,
  "duration_ms": 5000,
  "trace_id": "abc-123",
  "error_code": "TIMEOUT"
}
```

Structured logs are filterable, aggregatable, and can trigger automated alerts.

---

## Distributed Tracing Implementation

Every request gets a **trace ID** at the entry point. Every service passes it downstream in headers.

```
Client → API Gateway
  Header: X-Trace-ID: abc-123

API Gateway → Auth Service
  Header: X-Trace-ID: abc-123

API Gateway → Order Service
  Header: X-Trace-ID: abc-123

Order Service → DB
  Logs: trace_id=abc-123, query=..., duration=30ms
```

All spans with `trace_id=abc-123` can be assembled into a complete trace visualization.

---

## Health Checks

### Liveness Check
"Is the service running?" If no → restart it.
```
GET /health/live → 200 OK
```

### Readiness Check
"Is the service ready to accept traffic?" If no → remove from load balancer.
```
GET /health/ready → checks DB connection, cache connection, etc.
```

### Deep Health Check
Verify all dependencies are healthy. Use for monitoring, not for load balancer routing (too slow).

---

## Key Dashboards to Build

| Dashboard | Key Metrics |
|---|---|
| Service Overview | Request rate, error rate, p50/p99 latency |
| Database | Query latency, connection pool usage, replication lag |
| Cache | Hit rate, eviction rate, memory usage |
| Queue | Queue depth, consumer lag, DLQ size |
| Infrastructure | CPU, memory, disk I/O, network throughput |

---

## Self-Check Questions

- [ ] What is the difference between a metric and a log?
- [ ] What is an error budget and how would you use it to make release decisions?
- [ ] Why should you alert on error rate rather than CPU usage?
- [ ] What is a trace ID and how does it flow through a distributed system?
- [ ] What is the difference between a liveness check and a readiness check?
- [ ] What are the four golden signals?
