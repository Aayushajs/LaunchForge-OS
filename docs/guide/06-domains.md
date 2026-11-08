# 6. Domains and HTTPS

## Add a domain

Service → **Domains → Add Domain**:

| Field | Meaning |
|---|---|
| Host | `app.example.com` (internationalized names are accepted) |
| Path | Route only this path prefix to the service (`/api`); **Strip path** removes it before forwarding |
| Internal path | Prefix added before forwarding |
| Container port | Port the app listens on inside the container |
| HTTPS | Redirect HTTP to HTTPS and serve a certificate |
| Certificate provider | **Let's Encrypt** (automatic), **None**, or **Custom** (uploaded under Settings → Certificates) |

Create a DNS `A`/`AAAA` record for the host pointing at the server (or a `CNAME` to another name that does). Let's Encrypt issues the certificate over HTTP on the first request after DNS resolves; port 80 must be reachable.

**Generate sslip.io domain** creates a hostname like `site-1a2b3c-203-0-113-10.sslip.io` that resolves to your server without any DNS setup — useful for testing.

## Ownership rules

- A hostname is owned by the first workspace that routes it. Another workspace on the same installation cannot add the same host or a path under it (`… is already in use by another workspace`).
- Inside one workspace, a host can be split by path between services (`example.com/` → web, `example.com/api` → API), but each host+path goes to one service.
- Hosts are compared case-insensitively, without a trailing dot, and in punycode, so `Example.com.` and `example.com` are the same host.
- Duplicating a project skips domains the original still uses.

## Redirects, basic auth, middlewares

Service → **Advanced**: regex redirects (e.g. `www` → apex), HTTP basic auth, and Traefik middlewares defined in **Traefik File System**.

## The dashboard's own domain

**Settings → Web Server**: domain, Let's Encrypt email and HTTPS for the dashboard itself.

## DNS providers

**Settings → DNS Providers** (Cloudflare, Route 53, Porkbun, Infomaniak, OVH) lets LaunchForge create the DNS record for a domain for you.

## Not yet supported

DNS TXT ownership verification, wildcard certificates via DNS-01, and a platform wildcard domain (`*.apps.example.com`) — see the [roadmap](../engineering/ROADMAP.md).
