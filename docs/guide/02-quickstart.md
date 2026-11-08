# 2. Quickstart

From an empty server to a running app in about 15 minutes.

## 1. Get a server

Any VPS provider works (Hetzner, DigitalOcean, AWS Lightsail, Oracle Cloud, …).

- Ubuntu 24.04 (or 22.04 / Debian 12), x86_64 or arm64
- 2 GB RAM minimum, 4 GB recommended; 40 GB disk
- Firewall: allow TCP 22, 80, 443 and 3000

## 2. Install

SSH into the server and run:

```bash
curl -fsSL https://raw.githubusercontent.com/Aayushajs/LaunchForge-OS/main/scripts/install.sh | sudo bash
```

The installer checks the server, installs Docker, generates all secrets and starts everything. It ends with:

```text
LaunchForge is installed.
Open http://203.0.113.10:3000 to create the owner account.
```

## 3. Create the owner account

Open that URL and register. The first account owns the installation (it is the **platform operator**) and gets a workspace called *My Organization* — rename it under **Settings → Profile**.

## 4. Deploy a first app

1. **Projects → Create Project** → name it `hello`.
2. Inside the project, **Create Service → Application** → name `web`.
3. In the **General** tab choose **Provider: Git**, repository URL `https://github.com/<you>/<repo>.git`, branch `main`. Leave **Build type: Nixpacks** (it detects Node, Python, Go, PHP, Java, Ruby, Rust, static sites and more).
4. Click **Deploy**. Open the **Deployments** tab to watch the build log live.
5. **Domains** tab → **Add Domain** → **Generate sslip.io domain** gives you a working hostname immediately (`*.sslip.io`, which resolves to your server's IP). Open it.

You now have a running app. Next: give it your own domain and deploy on every push — [Tutorial: deploy your portfolio](03-tutorial-portfolio.md).

## 5. Give the dashboard a domain (recommended)

Create a DNS `A` record such as `deploy.example.com → <server IP>`, then **Settings → Web Server**: set the domain and a Let's Encrypt email. The dashboard is then served over HTTPS at `https://deploy.example.com`, and you can close port 3000 in the firewall.
