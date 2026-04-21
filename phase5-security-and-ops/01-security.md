# Security

---

## Authentication vs Authorization

| | Authentication (AuthN) | Authorization (AuthZ) |
|---|---|---|
| Question | Who are you? | What are you allowed to do? |
| Mechanism | Passwords, tokens, biometrics | Roles, permissions, ACLs |
| When | Login | Every request |
| Example | Validating a JWT signature | Checking if user has `admin` role |

---

## OAuth 2.0

A delegation protocol. Lets a third-party app access a user's resources without seeing their password.

### Roles
- **Resource Owner:** The user
- **Client:** The third-party app (e.g., "Login with Google" app)
- **Authorization Server:** Issues tokens (e.g., Google's auth server)
- **Resource Server:** Holds the protected data (e.g., Google's API)

### Authorization Code Flow (most common for web/mobile)
```
1. User clicks "Login with Google"
2. App redirects to Google auth server
3. User authenticates + consents
4. Google redirects back with authorization code
5. App exchanges code for access_token + refresh_token (server-to-server)
6. App uses access_token to call Google APIs
```

**Why the code exchange?** Tokens never touch the browser URL bar → not in browser history, not in server logs.

### Access Token vs Refresh Token
| | Access Token | Refresh Token |
|---|---|---|
| Lifespan | Short (15 min – 1 hour) | Long (days – weeks) |
| Sent | On every API request | Only to auth server |
| Purpose | Prove identity to resource server | Get new access token when expired |
| If stolen | Attacker has short window | Attacker can get unlimited access tokens |

---

## JWT (JSON Web Token)

A compact, self-contained token. Three base64-encoded parts separated by dots:

```
HEADER.PAYLOAD.SIGNATURE

Header:  { "alg": "HS256", "typ": "JWT" }
Payload: { "user_id": 123, "role": "admin", "exp": 1704067200 }
Signature: HMAC-SHA256(header + "." + payload, secret_key)
```

### How Verification Works
Server receives JWT → recomputes signature → if it matches, token is valid.
No DB lookup needed — the signature proves the token wasn't tampered with.

### JWT Tradeoffs
**Pros:**
- Stateless — no session store needed
- Works across services (microservices can verify tokens independently)
- Can embed claims (role, permissions) to avoid DB lookups

**Cons:**
- Can't be invalidated before expiry (logout is a lie unless you maintain a blacklist)
- Grows with each claim added
- If secret is leaked, all tokens are compromised

### Interview Tip
> "JWTs are great for stateless auth across microservices, but they can't be revoked instantly. For high-security operations (password change, account compromise), I'd maintain a token blacklist in Redis with the JWT's `jti` (JWT ID) claim."

---

## TLS / HTTPS

Transport Layer Security encrypts data in transit.

### What It Protects Against
- Eavesdropping (passive interception)
- Man-in-the-middle attacks (active interception)
- Tampering (data integrity)

### How Certificate Trust Works
```
Root CA (in your browser's trust store)
  └── Intermediate CA
        └── Your cert (example.com)
              └── Signs connection to user
```

Your cert says "I am example.com" and is signed by a trusted CA. Browser verifies the chain.

### mTLS (Mutual TLS)
Both sides present certificates. Used for service-to-service auth in microservices.

```
Service A → [presents cert] → Service B
Service A ← [presents cert] ← Service B
Both verify each other → establish encrypted channel
```

**Used by:** Istio (service mesh), internal APIs, bank-to-bank connections

---

## Encryption at Rest vs in Transit

| | In Transit | At Rest |
|---|---|---|
| What | Data moving across the network | Data stored on disk |
| How | TLS | AES-256 encryption of DB/files |
| Who manages keys | TLS cert + CA | KMS (Key Management Service) |
| Example | HTTPS API call | Encrypted S3 bucket, encrypted DB volume |

**Key Management:** Never store encryption keys next to encrypted data. Use AWS KMS, HashiCorp Vault, or GCP Cloud KMS.

---

## Common Attack Vectors

### SQL Injection
```sql
-- Attacker input: "'; DROP TABLE users; --"
query = "SELECT * FROM users WHERE name = '" + input + "'"
```
**Defense:** Parameterized queries (prepared statements). Never concatenate user input into SQL.

### XSS (Cross-Site Scripting)
Attacker injects malicious script into a web page.
**Defense:** Escape output, Content-Security-Policy header, `HttpOnly` cookies.

### CSRF (Cross-Site Request Forgery)
Malicious site tricks a logged-in user's browser into making a request to your site.
**Defense:** CSRF tokens, `SameSite=Strict` cookies, check `Origin`/`Referer` header.

### SSRF (Server-Side Request Forgery)
Attacker tricks your server into making requests to internal services.
**Defense:** Validate/whitelist URLs, block requests to private IP ranges (169.254.x.x, 10.x.x.x).

### Secrets in Code
Never hardcode API keys, passwords, or secrets in source code.
**Defense:** Environment variables, secrets manager (AWS Secrets Manager, Vault).

---

## Principle of Least Privilege

Every service, user, and process should have the minimum permissions needed to do its job.

```
DB user for read-only service:  SELECT only
DB user for write service:      SELECT, INSERT, UPDATE
DB admin:                       Full access (used rarely)
```

Applied to:
- IAM roles (AWS)
- DB users
- Service accounts
- API scopes (OAuth)
- Network access (security groups)

---

## Defense in Depth

Layered security — no single point of failure.

```
Layer 1: WAF (block malicious requests at edge)
Layer 2: Rate limiting (prevent brute force)
Layer 3: Authentication (verify identity)
Layer 4: Authorization (check permissions)
Layer 5: Input validation (reject malformed input)
Layer 6: Parameterized queries (prevent SQLi)
Layer 7: Encryption at rest (protect stored data)
Layer 8: Audit logging (detect and investigate)
```

---

## Self-Check Questions

- [ ] What is the difference between authentication and authorization?
- [ ] Why does OAuth use an authorization code instead of giving the access token directly?
- [ ] Why can't you "log out" with JWTs and how would you work around it?
- [ ] What is the difference between mTLS and regular TLS?
- [ ] What is SSRF and why is it especially dangerous in cloud environments?
- [ ] How does principle of least privilege reduce blast radius of a compromise?
