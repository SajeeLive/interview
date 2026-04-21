# Networking & VPN

---

## DNS (Domain Name System)

DNS translates human-readable names (`api.example.com`) into IP addresses.

### Resolution Chain
```
Browser → OS cache → Local resolver (ISP/router)
       → Root nameserver → TLD nameserver (.com)
       → Authoritative nameserver → IP address
```

Full resolution only happens on cache miss. Most lookups are cached.

### Key Record Types
| Record | Purpose | Example |
|---|---|---|
| A | Domain → IPv4 | `api.example.com → 1.2.3.4` |
| AAAA | Domain → IPv6 | `api.example.com → 2001:db8::1` |
| CNAME | Domain → Domain (alias) | `www.example.com → example.com` |
| MX | Mail server | `example.com → mail.example.com` |
| TXT | Arbitrary text (SPF, verification) | |
| NS | Authoritative nameserver for a zone | |

### TTL (Time to Live)
- Controls how long DNS responses are cached
- **Low TTL (60s):** Fast failover, more DNS queries (higher load)
- **High TTL (3600s):** Fewer queries, but slow to propagate changes
- Reduce TTL **before** a planned migration, then increase afterward

### DNS-Based Load Balancing
Return multiple A records for the same name. Clients pick one (usually round-robin).
- Simple but no health awareness — clients may get a down server
- Better: Use Anycast or a proper LB

---

## HTTP Protocol Versions

### HTTP/1.1
- One request at a time per TCP connection (head-of-line blocking)
- Workaround: browsers open 6 parallel connections per domain
- Keep-Alive: reuse TCP connections across requests

### HTTP/2
- **Multiplexing:** Multiple requests on a single TCP connection simultaneously
- **Header compression** (HPACK): reduces overhead
- **Server push:** Server can proactively send resources
- Still has TCP-level head-of-line blocking

### HTTP/3 (QUIC)
- Built on UDP instead of TCP
- Eliminates TCP head-of-line blocking
- Faster connection establishment (0-RTT or 1-RTT)
- Better performance on lossy networks (mobile)

### Interview Tip
> "I'd use HTTP/2 between the client and load balancer, and potentially HTTP/1.1 between internal services where the overhead matters less. For mobile clients on unreliable networks, HTTP/3 would reduce latency."

---

## TCP vs UDP

| | TCP | UDP |
|---|---|---|
| Connection | Connection-oriented (3-way handshake) | Connectionless |
| Delivery | Guaranteed, ordered | Best-effort, may drop/reorder |
| Overhead | Higher (ACKs, retransmission) | Lower |
| Latency | Higher | Lower |
| Use cases | HTTP, file transfer, email, DB connections | DNS, video streaming, gaming, VoIP |

**When UDP makes sense:**
- Real-time: losing an old video frame is better than waiting for retransmission
- DNS: small query/response, retry at application level is fine
- Multicast/broadcast: TCP doesn't support these

---

## TLS / HTTPS

TLS (Transport Layer Security) provides encryption, authentication, and integrity over TCP.

### TLS Handshake (simplified)
```
Client → Server: "Hello, here are cipher suites I support"
Server → Client: "Hello, here's my certificate + chosen cipher"
Client:         Verifies certificate against trusted CAs
Client → Server: Key exchange (generates shared secret)
Both:           Derive symmetric encryption keys
                Encrypted communication begins
```

### Certificate Chain
```
Root CA (self-signed, in browser trust store)
  └── Intermediate CA
        └── Your server certificate (signed by intermediate)
```

Browsers trust Root CAs (pre-installed). The chain of signatures validates your cert.

### Mutual TLS (mTLS)
Both client and server present certificates. Used for service-to-service authentication in microservices.

---

## VPC (Virtual Private Cloud)

A VPC is a logically isolated network within a cloud provider (AWS, GCP, Azure).

```
VPC: 10.0.0.0/16
├── Public Subnet: 10.0.1.0/24    (internet-accessible)
│   ├── Load Balancer
│   └── NAT Gateway
└── Private Subnet: 10.0.2.0/24  (no direct internet access)
    ├── App Servers
    └── Database
```

### Key Components

**Subnets:** Subdivisions of the VPC CIDR range.
- **Public subnet:** Has route to Internet Gateway — instances can have public IPs
- **Private subnet:** No direct internet route — instances use NAT for outbound only

**Internet Gateway:** Allows public subnet instances to communicate with the internet.

**NAT Gateway:** Allows private subnet instances to initiate outbound internet connections (e.g., package downloads) without being reachable inbound from the internet.

**Security Groups:** Stateful firewall rules applied to instances.
- Define allowed inbound and outbound traffic by IP, port, protocol
- Stateful: if inbound is allowed, return traffic is automatically allowed

**Network ACLs (NACLs):** Stateless firewall rules applied at the subnet level.
- Must define both inbound and outbound rules explicitly
- Evaluated in rule number order, first match wins

---

## VPN

A VPN (Virtual Private Network) creates an encrypted tunnel over a public network.

### Use Cases in System Design
1. **Connecting on-premises network to cloud VPC** (Site-to-site VPN)
2. **Remote employee access to internal systems** (Client-to-site VPN)
3. **Connecting two cloud VPCs** (though VPC Peering is usually preferred)

### Site-to-Site VPN
```
On-prem Network ←──[encrypted tunnel over internet]──→ Cloud VPC
(192.168.0.0/24)                                       (10.0.0.0/16)
```
- Uses IPSec protocol suite
- Traffic between the two networks is encrypted
- Alternative: AWS Direct Connect / Azure ExpressRoute (dedicated physical link, no internet)

### VPN Protocols
| Protocol | Notes |
|---|---|
| IPSec | Industry standard, widely supported, used for site-to-site |
| WireGuard | Modern, faster, simpler config, growing adoption |
| OpenVPN | Open source, cross-platform, slower than WireGuard |
| SSL/TLS VPN | Browser-based, good for remote access |

### Split Tunneling
- **Full tunnel:** All client traffic goes through VPN (private + internet)
- **Split tunnel:** Only traffic to private networks goes through VPN; internet traffic goes direct

---

## CDN (Content Delivery Network)

A globally distributed network of edge servers that cache and serve content close to users.

```
User in Tokyo    → Tokyo edge node    (cache hit → ~5ms)
User in New York → NYC edge node      (cache hit → ~5ms)
                   (cache miss → origin server → ~200ms, then cached)
```

### What to Put on a CDN
- Static assets (JS, CSS, images, fonts)
- Video/audio files
- Large file downloads
- API responses that are identical for all users (public data)

### CDN Caching Strategy
- Cache-Control headers control CDN TTL
- **Immutable assets:** Long TTL (1 year) + content hash in filename for cache busting
- **Dynamic responses:** Short TTL or no caching

---

## Firewalls & Security Groups in Practice

### Defense in Depth

```
Internet
   │
   ▼
[CDN / WAF]           ← Layer 7 filtering, DDoS protection
   │
   ▼
[Load Balancer]       ← SG: allow 80/443 from internet
   │
   ▼
[App Servers]         ← SG: allow 8080 from LB only
   │
   ▼
[Database]            ← SG: allow 5432 from app servers only
```

Each layer only accepts traffic from the layer directly above it. The DB is never exposed to the internet.

---

## Self-Check Questions

- [ ] What is TTL in DNS and when would you lower it?
- [ ] What problem does HTTP/2 multiplexing solve?
- [ ] When would you use UDP over TCP?
- [ ] What is the difference between a public and private subnet?
- [ ] What does a NAT Gateway do and why is it needed?
- [ ] What is the difference between a Security Group and a NACL?
- [ ] What is split tunneling in a VPN?
- [ ] Why would you put a database in a private subnet?
