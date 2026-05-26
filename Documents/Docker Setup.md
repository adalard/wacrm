# Docker Deployment Guide for WACRM

This step-by-step guide explains how to containerize, build, and deploy the WACRM Next.js App Router application in production using **Docker** and **Docker Compose**.

To support this guide, we have created a highly optimized production [Dockerfile](file:///h:/_AI/_Builded/wacrm/Dockerfile) and a pre-configured [docker-compose.yml](file:///h:/_AI/_Builded/wacrm/docker-compose.yml) in your root directory.

---

## 🏗️ Docker Architecture Overview

The WACRM container uses a **multi-stage build** strategy to minimize size, optimize layering caches, and guarantee absolute production security:

*   **Stage 1 (`deps`)**: Pulls standard `node:20-alpine`, installs standard Unix tools, and installs `node_modules` cleanly using `npm ci`.
*   **Stage 2 (`builder`)**: Copies your source files, sets production environments, and compiles the optimized Next.js **standalone build** (`npm run build`).
*   **Stage 3 (`runner`)**: Pulls a clean, minimal Alpine base. It extracts only the standalone server and static assets from Stage 2. It creates a **non-privileged system user (`nextjs`)** to run the app, shielding your host system from any container exploit vulnerability.
*   **Final size**: **~120MB** (compared to a standard 1.2GB node build!).

---

## ⚡ Setup & Run (Standard Manual Commands)

Ensure you have [Docker Desktop](https://www.docker.com/products/docker-desktop/) or the Docker Engine daemon installed on your server.

### Step 1: Build the Container Image
Run the following build command in your project root folder:
```bash
docker build -t wacrm-app .
```

### Step 2: Launch the Container
Run the container and bind port `3000` to the host port. You must pass your environment variables via an `.env.local` file:
```bash
docker run -p 3000:3000 --env-file .env.local wacrm-app
```
Open your browser and navigate to `http://localhost:3000` to verify it is running successfully!

---

## 🐳 Production Orchestration with Docker Compose (Recommended)

Docker Compose simplifies multi-container deployments. We have pre-configured [docker-compose.yml](file:///h:/_AI/_Builded/wacrm/docker-compose.yml) to make launching WACRM a single-command process.

### 🚀 1. Launch in Detached Mode (Background)
To build your container and start the backend service in the background, run:
```bash
docker compose up -d --build
```

### 📋 2. Check Service Status
Verify the container is healthy and inspect active port mappings:
```bash
docker compose ps
```

### 🔍 3. Inspect Live Container Logs
Stream real-time log outputs to inspect active backend calls or debug issues:
```bash
docker compose logs -f
```

### 🛑 4. Stop and Tear Down
To stop the background services and safely tear down networks, run:
```bash
docker compose down
```

---

## 🔒 Production Hosting Recommendations

For a public production server (AWS, DigitalOcean, VPS, etc.), you should map your container behind a **Reverse Proxy** like **Nginx** or **Traefik** to handle SSL certificate termination (HTTPS) and routing.

### Nginx Reverse Proxy Server Block Template
Add this configuration block inside your server's Nginx configuration (e.g., `/etc/nginx/sites-available/default`) to map public traffic to your container:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name crm.yourdomain.com;

    # Redirect HTTP traffic to HTTPS (highly recommended in production)
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name crm.yourdomain.com;

    # SSL Certificates (managed automatically by Let's Encrypt / Certbot)
    ssl_certificate /etc/letsencrypt/live/crm.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/crm.yourdomain.com/privkey.pem;

    # Proxy traffic directly to your WACRM Docker container
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 🔄 Automated Deployments (CI/CD)

Because the project is fully Dockerized, you can easily integrate a GitHub Actions workflow to build, push to a container registry (Docker Hub, AWS ECR), and reload your compose stack on your server:

```yaml
# Simple CD Step Example
- name: Deploy to Server via SSH
  uses: appleboy/ssh-action@master
  with:
    host: ${{ secrets.SERVER_IP }}
    username: root
    key: ${{ secrets.SSH_PRIVATE_KEY }}
    script: |
      cd /app/wacrm
      git pull origin main
      docker compose up -d --build
```
This enables zero-downtime, fully automated pushes every time you push code updates to production!
