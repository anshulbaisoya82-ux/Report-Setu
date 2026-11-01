# 🚀 ReportSetu — Complete VPS Production Deployment Guide

This guide provides end-to-end instructions for deploying the **ReportSetu** medical platform onto any Linux Virtual Private Server (Ubuntu 22.04 LTS or Ubuntu 24.04 LTS) such as **Hetzner, DigitalOcean, Linode, AWS Lightsail, or Hostinger**.

---

## 🏗️ Architecture Overview

The ReportSetu stack consists of 4 primary services:
1. **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS (Built into static files, served with ultra-low RAM via Nginx).
2. **Backend API:** Node.js 20+ Express + Prisma ORM + Socket.io + REST API v1 (Runs on port `5000` via PM2).
3. **Database:** PostgreSQL 16 (Houses core clinical data + **253,973 indexed Indian Medicines** on port `5432`).
4. **AI & ML Microservice:** Python 3.11+ FastAPI + LangGraph + OCR Document Parser (Runs on port `8001` via PM2 / Uvicorn).
5. **Reverse Proxy & SSL:** Nginx with HTTP/2 and Let's Encrypt SSL (Ports `80` & `443`).

---

## 🖥️ Recommended VPS Sizing

| Tier | vCPU | RAM | NVMe SSD | Swap | Ideal For |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Minimum / Budget** | 2 Cores | **4 GB** | 40–50 GB | 4 GB | Testing, Staging, Demo, 1–3 Doctors |
| **Production Recommended** ⭐ | 4 Cores | **8 GB** | 80–100 GB | 4 GB | Clinics, Hospitals, High OCR / Concurrency |

---

## 📋 Table of Contents
1. [Initial Server Setup & Swap Memory](#step-1-initial-server-setup--swap-memory)
2. [Installing Required Runtimes & Packages](#step-2-installing-required-runtimes--packages)
3. [PostgreSQL 16 Database Setup](#step-3-postgresql-16-database-setup)
4. [Cloning the Repository & Directory Permissions](#step-4-cloning-the-repository)
5. [Configuring Environment Variables](#step-5-configuring-environment-variables)
6. [Backend Deployment & Medicine Database Seeding](#step-6-backend-deployment--seeding)
7. [Machine Learning Microservice Setup (Python FastAPI)](#step-7-machine-learning-microservice-setup)
8. [Frontend Production Build](#step-8-frontend-production-build)
9. [Process Management with PM2](#step-9-process-management-with-pm2)
10. [Nginx Reverse Proxy & Let's Encrypt SSL Configuration](#step-10-nginx-reverse-proxy--ssl-configuration)
11. [Verification, Health Pings & Maintenance](#step-11-verification--maintenance)

---

## Step 1: Initial Server Setup & Swap Memory

Connect to your VPS via SSH as `root`:
```bash
ssh root@YOUR_SERVER_IP
```

### 1.1 Update and Upgrade Packages
```bash
sudo apt update && sudo apt upgrade -y
```

### 1.2 Create a 4 GB Swap File (Mandatory)
Swap memory prevents process termination (Out-Of-Memory) during heavy PDF report OCR or database queries:
```bash
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Make swap permanent across reboots
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### 1.3 Configure Firewall (UFW)
```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
```

### 1.4 Set Timezone to Indian Standard Time (IST)
```bash
sudo timedatectl set-timezone Asia/Kolkata
```

---

## Step 2: Installing Required Runtimes & Packages

### 2.1 Install System Utilities & Build Tools
```bash
sudo apt install -y curl wget git build-essential software-properties-common jq unzip
```

### 2.2 Install Node.js 20 LTS & PM2
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify versions
node -v   # Should be v20.x.x
npm -v

# Install PM2 globally for background process persistence
sudo npm install -g pm2
```

### 2.3 Install Python 3.11/3.12, venv & Tesseract OCR (for Medical PDF Parsing)
```bash
sudo apt install -y python3 python3-pip python3-venv tesseract-ocr libtesseract-dev libpq-dev
python3 --version
```

### 2.4 Install Nginx Web Server & Certbot
```bash
sudo apt install -y nginx certbot python3-certbot-nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

---

## Step 3: PostgreSQL 16 Database Setup

### 3.1 Install PostgreSQL 16
```bash
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable postgresql
sudo systemctl start postgresql
```

### 3.2 Create Database & Dedicated User
Switch to the `postgres` user and launch `psql`:
```bash
sudo -u postgres psql
```

Run the following SQL commands (Replace `YOUR_STRONG_DB_PASSWORD` with a strong password):
```sql
CREATE DATABASE reportsetu;
CREATE USER reportsetu WITH ENCRYPTED PASSWORD 'YOUR_STRONG_DB_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE reportsetu TO reportsetu;
ALTER DATABASE reportsetu OWNER TO reportsetu;

-- Switch to the database and grant public schema permissions
\c reportsetu
GRANT ALL ON SCHEMA public TO reportsetu;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO reportsetu;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO reportsetu;

\q
```

---

## Step 4: Cloning the Repository

We recommend placing the application in `/var/www/reportsetu`:

```bash
# Create directory and give ownership to the current user
sudo mkdir -p /var/www/reportsetu
sudo chown -R $USER:$USER /var/www/reportsetu

# Clone repository
git clone -b frontend https://github.com/thethirdhuman/Report-Setu.git /var/www/reportsetu
cd /var/www/reportsetu
```

---

## Step 5: Configuring Environment Variables

### 5.1 Backend Environment Configuration
Navigate to `backend/` and create `.env`:
```bash
cd /var/www/reportsetu/backend
nano .env
```

Paste and adjust the following configuration:
```env
PORT=5000
NODE_ENV=production

# Database Connection (Replace YOUR_STRONG_DB_PASSWORD)
DATABASE_URL="postgresql://reportsetu:YOUR_STRONG_DB_PASSWORD@127.0.0.1:5432/reportsetu?schema=public"

# JWT Secrets (Generate random 64-character strings: `openssl rand -hex 32`)
JWT_ACCESS_SECRET="generate_random_64_char_secret_access_key"
JWT_REFRESH_SECRET="generate_random_64_char_secret_refresh_key"

# CORS Allowed Origins
CORS_ORIGIN="https://yourdomain.com,https://www.yourdomain.com"

# Google Gemini API Key (For AI Doctor Copilot)
GEMINI_API_KEY="your_google_gemini_api_key_here"

# Python ML Microservice URL
ML_SERVICE_URL="http://127.0.0.1:8001"

# Upload limits
MAX_FILE_SIZE_MB=25
```
Save and exit (`Ctrl + O`, `Enter`, `Ctrl + X`).

### 5.2 Frontend Environment Configuration
Navigate to `Frontend/` and create `.env`:
```bash
cd /var/www/reportsetu/Frontend
nano .env
```

Paste:
```env
VITE_API_BASE_URL=https://yourdomain.com/api/v1
```
Save and exit (`Ctrl + O`, `Enter`, `Ctrl + X`).

### 5.3 Machine Learning Microservice Configuration
Navigate to `Machine learning/` and create `.env`:
```bash
cd "/var/www/reportsetu/Machine learning"
nano .env
```

Paste:
```env
PORT=8001
GEMINI_API_KEY="your_google_gemini_api_key_here"
```
Save and exit (`Ctrl + O`, `Enter`, `Ctrl + X`).

---

## Step 6: Backend Deployment & Seeding

### 6.1 Install Dependencies & Generate Prisma Client
```bash
cd /var/www/reportsetu/backend
npm install

# Generate Prisma Client & Run Migrations
npm run db:generate
npm run db:migrate
```

### 6.2 Import the 253,973 Indian Medicine Dataset (Automatic Fast Batch)
Run the dedicated batch import script which streams all 253,973 medicines into PostgreSQL in ~35-45 seconds:
```bash
npm run db:import-medicines
```
*Expected Output:*
```text
--- ReportSetu Medicine Importer ---
Progress: 20,000 medicines imported...
...
Import complete! Total 253,973 medicines stored in PostgreSQL in 38.4s.
```

### 6.3 Build TypeScript Backend
```bash
npm run build
```

---

## Step 7: Machine Learning Microservice Setup

Set up the dedicated Python virtual environment for FastAPI, OCR, and LangGraph:

```bash
cd "/var/www/reportsetu/Machine learning"

# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate

# Install requirements
pip install --upgrade pip
pip install -r requirements.txt

# Verify service runs
uvicorn api:app --host 127.0.0.1 --port 8001 &
sleep 2

# Test health ping
curl -s http://127.0.0.1:8001/health | jq .
# Kill the test background process
kill %1
deactivate
```

---

## Step 8: Frontend Production Build

Build the React + Vite single-page application into optimized static assets:

```bash
cd /var/www/reportsetu/Frontend
npm install
npm run build
```
*The compiled assets will be created in `/var/www/reportsetu/Frontend/dist`.*

---

## Step 9: Process Management with PM2

We use **PM2** to keep both the Node.js backend and Python FastAPI ML engine running 24/7 with automatic restarts on crash or system reboot.

### 9.1 Create PM2 Ecosystem File
In `/var/www/reportsetu`:
```bash
cd /var/www/reportsetu
nano ecosystem.config.js
```

Paste the following configuration:
```javascript
module.exports = {
  apps: [
    {
      name: 'reportsetu-backend',
      cwd: '/var/www/reportsetu/backend',
      script: 'dist/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'reportsetu-ml',
      cwd: '/var/www/reportsetu/Machine learning',
      script: 'venv/bin/uvicorn',
      args: 'api:app --host 127.0.0.1 --port 8001',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1200M',
    },
  ],
};
```
Save and exit.

### 9.2 Launch Services with PM2
```bash
pm2 start ecosystem.config.js

# Save process list for system reboot persistence
pm2 save
pm2 startup
# (Run the exact `sudo env PATH=...` command that PM2 outputs if prompted)
```

Check status:
```bash
pm2 status
```
Both `reportsetu-backend` and `reportsetu-ml` should show status **`online`**.

---

## Step 10: Nginx Reverse Proxy & SSL Configuration

### 10.1 Create Nginx Site Configuration
```bash
sudo nano /etc/nginx/sites-available/reportsetu
```

Paste the following configuration (Replace `yourdomain.com` with your real domain or VPS public IP):
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    client_max_body_size 25M;

    # Gzip Compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private auth;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml application/json;
    gzip_disable "MSIE [1-6]\.";

    # 1. Frontend Static Files
    root /var/www/reportsetu/Frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # 2. REST API v1 Endpoints (Node.js Express)
    location /api/ {
        proxy_pass http://127.0.0.1:5000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 90s;
    }

    # 3. Direct Route Alias for /admin
    location /admin {
        try_files $uri $uri/ /index.html;
    }

    # 4. WebSocket Connections (Socket.IO)
    location /socket.io/ {
        proxy_pass http://127.0.0.1:5000/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    # 5. Direct ML Engine Health Check
    location /ml/health {
        proxy_pass http://127.0.0.1:8001/health;
        proxy_http_version 1.1;
    }
}
```
Save and exit (`Ctrl + O`, `Enter`, `Ctrl + X`).

### 10.2 Enable Configuration & Restart Nginx
```bash
sudo ln -sf /etc/nginx/sites-available/reportsetu /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test configuration syntax
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

### 10.3 Obtain Free SSL Certificate (HTTPS)
Ensure your domain's DNS `A` records point to your VPS IP, then run:
```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```
Follow prompts to enable automatic HTTPS redirect. Certbot will configure auto-renewal automatically.

---

## Step 11: Verification & Maintenance

### 11.1 Verify Endpoints
Run these commands from your local machine or server to test:

1. **Backend Health:**
   ```bash
   curl -s https://yourdomain.com/api/v1/health | jq .
   ```
2. **253k Medicine Database Search:**
   ```bash
   curl -s "https://yourdomain.com/api/v1/medicines/search?q=Augmentin" | jq .
   ```
3. **Python AI Microservice Health:**
   ```bash
   curl -s https://yourdomain.com/ml/health | jq .
   ```

### 11.2 Access High-Tech Admin Vault
Open in browser:
`https://yourdomain.com/admin`

- **Security Identifier (ID):** `SETU-ROOT-ADMIN`
- **Vault Passkey:** `SetuVault#2026@Root`

### 11.3 Useful Day-to-Day Maintenance Commands
```bash
# View real-time logs
pm2 logs reportsetu-backend
pm2 logs reportsetu-ml

# Restart services
pm2 restart all

# Pull code updates & rebuild
cd /var/www/reportsetu
git pull origin frontend
cd backend && npm run build && pm2 restart reportsetu-backend
cd ../Frontend && npm run build
```

---

*ReportSetu is now live, secured with HTTPS, and running with production-grade fault tolerance!*
