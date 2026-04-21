# Servers & Load Balancing

---

## The Scaling Problem

A single server has hard limits on CPU, RAM, and network I/O.

**Vertical scaling (scale up):** Buy a bigger machine.
- Simple, no code changes
- Has a ceiling (you can't buy a machine with infinite RAM)
- Single point of failure

**Horizontal scaling (scale out):** Add more machines.
- Effectively unlimited
- Requires a load balancer to distribute traffic
- Requires stateless servers (or shared state layer)

---

## Load Balancers

A load balancer sits in front of a server pool and distributes incoming requests.

```
           ┌─────────────┐
Clients ──→│ Load Balancer│──→ Server 1
           │             │──→ Server 2
           └─────────────┘──→ Server 3
```

### L4 vs L7

| | L4 (Transport Layer) | L7 (Application Layer) |
|---|---|---|
| Operates on | TCP/UDP packets | HTTP requests |
| Routing basis | IP + port | URL, headers, cookies, body |
| Speed | Faster (less inspection) | Slower (more inspection) |
| Features | Basic routing | Path-based routing, SSL termination, header rewriting |
| Use case | High-throughput non-HTTP | Most web applications |

**Example L7 routing:**
```
/api/*     → API servers
/images/*  → Media servers
/admin/*   → Admin servers (+ IP whitelist)
```

### Load Balancing Algorithms

| Algorithm | How It Works | Best For |
|---|---|---|
| Round Robin | Rotate through servers in order | Uniform requests |
| Weighted Round Robin | More traffic to higher-capacity servers | Mixed server sizes |
| Least Connections | Send to server with fewest active connections | Variable-length requests |
| IP Hash | Hash client IP to always route to same server | Sticky sessions without cookies |
| Least Response Time | Send to fastest-responding server | Latency-sensitive |

### Sticky Sessions (Session Affinity)
Route requests from the same client to the same server. Required when server-side session state isn't shared.

**Problem:** Defeats horizontal scaling if not careful. Prefer stateless servers + shared session store (Redis) instead.

---

## Reverse Proxy

A reverse proxy receives requests on behalf of servers. The client never connects directly to the app server.

```
Client → Reverse Proxy → App Server(s)
```

### What It Provides
- **SSL termination** — decrypt HTTPS once at the proxy, use plain HTTP internally
- **Compression** — gzip responses
- **Caching** — serve cached responses without hitting app servers
- **Rate limiting** — throttle abusive clients
- **Request buffering** — absorb slow clients so app servers aren't blocked
- **Security** — hides internal server IPs

**Common tools:** Nginx, HAProxy, Caddy, AWS ALB/NLB

### Forward Proxy vs Reverse Proxy
| | Forward Proxy | Reverse Proxy |
|---|---|---|
| Represents | Clients | Servers |
| Client knows about | Proxy, not origin | Neither (transparent) |
| Use case | VPN, content filtering | Load balancing, SSL, caching |

---

## Stateless vs Stateful Servers

### Stateful Server (avoid for horizontal scaling)
```
Request 1 → Server A (stores session in memory)
Request 2 → Server B (no session → user logged out!)
```

### Stateless Server (preferred)
All state lives in a shared external store (DB, Redis, JWT).
```
Request 1 → Server A (reads session from Redis)
Request 2 → Server B (reads same session from Redis)
```

**Result:** Any server can handle any request. You can freely add/remove servers.

---

## Service Discovery

In a microservices architecture, services need to find each other. IPs change as servers scale up/down.

### Client-Side Discovery
The client queries a registry (e.g. Consul) and picks a server itself.

### Server-Side Discovery
The client sends a request to a load balancer, which queries the registry.

### DNS-Based Discovery
Each service has a DNS name that resolves to healthy instance IPs. TTL controls refresh rate.

**Tools:** Consul, Eureka, Kubernetes DNS, AWS Cloud Map

---

## Health Checks

Load balancers continuously probe servers to detect failures.

- **Active health check:** LB pings `/health` endpoint every N seconds
- **Passive health check:** LB monitors error rates on real traffic

When a server fails health checks, it's removed from rotation. When it recovers, it's re-added.

---

## Self-Check Questions

- [ ] What is the difference between vertical and horizontal scaling?
- [ ] When would you use L4 vs L7 load balancing?
- [ ] Why are sticky sessions problematic for scaling?
- [ ] What does SSL termination at the load balancer mean?
- [ ] How does a stateless server differ from a stateful one, and why does it matter?
- [ ] What is service discovery and why is it needed?
