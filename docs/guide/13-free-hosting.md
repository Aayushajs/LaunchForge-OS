# 13. Run LaunchForge for free

LaunchForge needs a real Linux machine: it runs Docker Swarm, binds ports 80 and 443, and builds images. Platforms such as Heroku, Render, Railway or Vercel cannot host it, because they run your code inside their own containers and do not give you a Docker daemon.

The good news: one cloud gives away a machine large enough to run LaunchForge and a dozen small apps, permanently.

## Which free option to use

| Option | What you get | Enough for LaunchForge? | Lasts |
|---|---|---|---|
| **Oracle Cloud Always Free** (recommended) | Up to 4 Arm CPUs, 24 GB RAM, 200 GB disk, 10 TB traffic a month | Yes, comfortably | Permanently |
| GitHub Student Developer Pack | $200 DigitalOcean credit and $100 Azure credit, among others | Yes, any 2–4 GB droplet | About a year |
| Google Cloud e2-micro | 2 shared vCPU, 1 GB RAM, 30 GB disk | Only with swap and a lower memory check; one or two tiny apps | Permanently |
| AWS or Azure free tiers | 1 GB RAM instances or starter credits | Same as above | 6–12 months |
| Your own PC or a Raspberry Pi 4/5 (4 GB+) | Whatever it has | Yes, with a tunnel for public access | As long as it runs |

LaunchForge publishes images for both `amd64` and `arm64`, so Oracle's Arm machines work out of the box.

## Oracle Cloud Always Free, step by step

### 1. Create the account

Sign up at [cloud.oracle.com](https://www.oracle.com/cloud/free/). A card is needed to verify identity; Always Free resources are never charged.

The **home region** you pick cannot be changed, and Always Free Arm machines are only available there. Pick one close to your visitors that is not the busiest in your area. If you later see *Out of capacity*, that region's free Arm machines are temporarily used up; see the tips at the end.

### 2. Create the machine

**Compute → Instances → Create instance**:

| Setting | Value |
|---|---|
| Image | Canonical Ubuntu 24.04 (or 22.04) |
| Shape | **Ampere → VM.Standard.A1.Flex**, 4 OCPU and 24 GB memory (any size up to that is free) |
| Networking | Create a new virtual cloud network with a public subnet; **Assign a public IPv4 address** on |
| SSH keys | Upload your public key, or download the generated private key |
| Boot volume | 100 GB (up to 200 GB in total is free) |

Create it and copy the **public IP address** once it is running.

### 3. Open the ports in Oracle's firewall

Oracle blocks everything except SSH in two places, and both must be opened.

**a. Security list.** Instance → subnet → **Security Lists → Default Security List → Add Ingress Rules**. Add one rule per port with source `0.0.0.0/0`, IP protocol TCP:

| Destination port | Used for |
|---|---|
| 80 | HTTP and Let's Encrypt certificate checks |
| 443 | HTTPS |
| 3000 | The dashboard, until it has its own domain |

**b. The machine's own firewall.** Oracle's Ubuntu images ship `iptables` rules that reject these ports even after step a. SSH in and run:

```bash
ssh ubuntu@<public-ip>

sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 3000 -j ACCEPT
sudo netfilter-persistent save
```

Forgetting step b is the most common reason a fresh Oracle install looks unreachable.

### 4. Install LaunchForge

Still on the machine:

```bash
curl -fsSL https://raw.githubusercontent.com/Aayushajs/LaunchForge-OS/main/scripts/install.sh | sudo bash
```

It takes about five minutes and ends with the address to open: `http://<public-ip>:3000`. Create the owner account there. Details on every step the installer takes are in the [Installation guide](../09-release/INSTALLATION_GUIDE.md).

### 5. Get a free domain with HTTPS

Let's Encrypt only issues certificates for domain names, not bare IP addresses. Free choices:

| Service | You get | How |
|---|---|---|
| [DuckDNS](https://www.duckdns.org) | `yourname.duckdns.org`, and every `*.yourname.duckdns.org` below it | Sign in, create the subdomain, set its IP to your server. Subdomains like `blog.yourname.duckdns.org` resolve automatically. |
| [is-a.dev](https://www.is-a.dev) | `yourname.is-a.dev` | Open a pull request with an `A` record for your server IP. Meant for developers' personal sites. |
| A paid domain | `yourname.dev` | About $10 a year; worth it for a portfolio on a resume. |

With DuckDNS, a good layout is:

| Hostname | Points to |
|---|---|
| `deploy.yourname.duckdns.org` | the LaunchForge dashboard |
| `yourname.duckdns.org` | your portfolio |
| `<anything>.yourname.duckdns.org` | any other app you deploy |

### 6. Put the dashboard behind HTTPS

**Settings → Web Server**: set the domain `deploy.yourname.duckdns.org` and an email for Let's Encrypt, then save. Open `https://deploy.yourname.duckdns.org`.

You can now close port 3000 again: remove its ingress rule and run

```bash
sudo iptables -D INPUT -m state --state NEW -p tcp --dport 3000 -j ACCEPT
sudo netfilter-persistent save
```

### 7. Deploy your portfolio

Follow [Tutorial: deploy your portfolio](03-tutorial-portfolio.md) with the host `yourname.duckdns.org`.

## Running on a 1 GB machine

The installer refuses machines under 2 GB RAM by default, because builds of Node.js apps easily need more. To try anyway, add swap first and lower the check:

```bash
sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

curl -fsSL https://raw.githubusercontent.com/Aayushajs/LaunchForge-OS/main/scripts/install.sh \
  | sudo LAUNCHFORGE_MIN_MEMORY_MB=900 bash
```

Expect slow builds. A static portfolio is fine; a Next.js build may take several minutes.

## Running on your own computer

LaunchForge installs on any Ubuntu or Debian machine at home, including a Raspberry Pi with 4 GB or more. Home internet usually blocks incoming ports 80 and 443, so publish the dashboard and apps through a free [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) instead of opening ports. In that setup Cloudflare provides HTTPS, so add domains in LaunchForge with HTTPS **off**.

## Tips for Oracle

- **Out of capacity** when creating the Arm machine: try a different availability domain in the same region, a smaller shape (1 OCPU, 6 GB) that you resize later, or try again at a quieter hour. Upgrading the account to *Pay As You Go* usually removes the wait and still costs nothing as long as you stay within the Always Free limits.
- **Idle reclaim**: Oracle may reclaim Always Free machines that stay almost completely idle for a week. A machine serving LaunchForge and a few sites is not idle; on a *Pay As You Go* account this does not apply.
- **Backups**: the free tier includes 20 GB of Object Storage, which is S3-compatible. Add it under **Settings → S3 Destinations** and schedule database backups to it ([Databases and backups](05-databases.md)).
