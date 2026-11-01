h# Avigo Oil and Gas Integrated Ltd.
## Corporate Portfolio Website & Executive Content Management Engine

---

### Executive Overview

**Avigo Oil and Gas Integrated Ltd.** is an indigenous energy services company in Nigeria, registered under the Companies and Allied Matters Act 1990 (RC 1445778). The company delivers specialized engineering, construction, procurement, and environmental management solutions to multinational exploration and production operators across the Niger Delta and Sub-Saharan Africa.

This repository contains the official, high-performance web platform and executive content management system (CMS) for Avigo Oil and Gas Integrated Ltd. The entire platform is engineered to corporate standards, featuring a zero-dependency native Node.js core, in-memory caching, standalone multi-page architecture, high-definition asset optimization, and an administrative portal located at `/avigo-portal`.

---

### Key Architectural Highlights

#### 1. Ultra-Lightweight Zero-Dependency Engine
- Built strictly using Node.js core modules (`http`, `fs`, `path`, `crypto`, `zlib`).
- Zero third-party `node_modules` required for production runtime, eliminating external supply-chain vulnerabilities and bloat.
- High-efficiency in-memory RAM caching for fast response times (< 5ms response time on static assets and API endpoints).
- Native Gzip compression and ETag validation with `304 Not Modified` support.
- RAM usage remains under 35 MB under standard operating loads.

#### 2. Standalone Multi-Page Architecture
- **Home (`/`)**: Full-bleed hero background slider with opacity overlay and Ken Burns motion, corporate overview, key service highlights, company statistics, and client trust carousel.
- **About Us (`/about`)**: Dedicated corporate profile detailing corporate governance, mission, vision, operational philosophy, health and safety policies, and executive leadership.
- **Services Portfolio (`/services`)**: Comprehensive catalog covering core engineering divisions, pipeline construction, procurement, environmental remediation, renewable energy transition, and petrochemical infrastructure.
- **Contact & Headquarters (`/contact`)**: Headquarters locator, direct executive phone lines, official communications dispatch, and an integrated inquiry submission pipeline.

#### 3. High-Definition Visuals & Corporate Styling
- Verified high-definition corporate assets for offshore facilities, gas manifolds, engineering blueprints, pipeline spreads, and logistics infrastructure.
- Strict corporate color palette:
  - Deep Teal: `#0B5D69`
  - Primary Green: `#76B843`
  - Forest Green: `#16794B`
  - Navy Accent: `#3B3E79`
  - Amber Gold: `#F5C431`
  - Slate Dark: `#051A20`
- Professional staggered scroll animations and mobile-responsive viewport scaling.

#### 4. Protected Executive Admin Portal (`/avigo-portal`)
- **Restricted Endpoint**: Standard administrative routes (`/admin`, `/login`, `/dashboard`) return 404 Not Found to prevent automated scanning.
- **Confidential Authentication Gate**: Clean executive login screen with hidden credentials, password show/hide eye toggles, and token-based session verification.
- **Admin Profile Governance**: Administrators can manage display names, corporate emails, role designations, phone numbers, and profile avatars.
- **Cryptographic Password Management**: Passwords are securely hashed using PBKDF2 with SHA-512 and 12,000 rounds with individual cryptographic salt generation.
- **Live Studio Split-Screen Preview**: Real-time content editing with responsive device frame toggles (Desktop 100%, Tablet 768px, Mobile 375px).
- **Media Vault**: Asset manager supporting image upload, asset selection, and instant cache invalidation.
- **Inquiry Management Vault**: Real-time tracking, review, and status management for incoming project inquiries.
- **Revision History & Rollback**: Automatic point-in-time snapshots created before saves or resets, enabling immediate restoration.

---

### Project Structure

```
theavigo/
├── data/
│   ├── auth.json              # Administrative credentials, profile attributes, and salts
│   ├── cms-db.json            # Active corporate content database
│   ├── seed-content.json      # Immutable seed content from corporate profile
│   ├── inquiries.json         # Contact inquiries database
│   └── revisions/             # Automatic timestamped backup snapshots
├── public/
│   ├── index.html             # Corporate homepage
│   ├── about.html             # Standalone About Us page
│   ├── services.html          # Standalone Services & Expansion page
│   ├── contact.html           # Standalone Contact & Operations page
│   ├── css/
│   │   ├── site.css           # Public responsive stylesheet and animations
│   │   └── admin.css          # Executive admin portal styling
│   ├── js/
│   │   ├── site.js            # Public interactive scripts, hero slider, and mobile navigation
│   │   └── admin.js           # Administrative CMS controller and live preview engine
│   └── uploads/               # High-definition imagery and media assets
├── views/
│   └── avigo-portal.html      # Protected administrative portal view
├── scripts/
│   ├── verify-deployment.js   # Automated pre-deployment verification suite
│   ├── enhance-all-hd.ps1     # Asset resolution enhancement script
│   └── extract-pdf-assets.js  # Source document extraction tool
├── Dockerfile                 # Hardened Alpine-based production container configuration
├── docker-compose.yml         # Container orchestration with persistent volume mounts
├── .dockerignore              # Deployment exclusion rules
├── .env.example               # Environment variable specification template
├── package.json               # Project manifest, validation, and execution scripts
└── server.js                  # Native HTTP engine and RESTful API gateway
```

---

### Quickstart & Local Execution

#### Prerequisites
- Node.js version 18.0.0 or higher.
- No package installations (`npm install`) are required because all modules are native to the Node.js runtime.

#### 1. Clone or Extract the Project
```bash
cd theavigo
```

#### 2. Configure Environment (Optional)
```bash
cp .env.example .env
```
Default values:
- `PORT`: `3000`
- `NODE_ENV`: `production`
- `AVIGO_PORTAL_PATH`: `/avigo-portal`

#### 3. Run Pre-Deployment Verification
```bash
npm run test
node scripts/verify-deployment.js
```

#### 4. Start the Application
```bash
npm start
```
The server will bind to `http://localhost:3000`.

---

### Default Administrative Credentials

The administrative console is available exclusively at the configured portal route:

- **Portal URL**: `http://localhost:3000/avigo-portal`
- **Default Username**: `admin`
- **Default Password**: `avigo2026`

> **Security Advisory**: Immediately after deploying the portal to a production environment, authenticate using the default credentials, navigate to the **Executive Governance -> Admin Profile & Security** tab, and update both your admin password and profile details.

---

### Production Deployment Instructions

#### Option A: Docker Container (Recommended)

The included `Dockerfile` utilizes a minimal `node:20-alpine` image (< 60 MB total image size) configured to run as a non-privileged `node` user with an automated container health check.

1. **Build the Production Image:**
```bash
docker build -t theavigo-corporate:latest .
```

2. **Run the Container with Persistent Storage:**
```bash
docker run -d \
  --name avigo_portal \
  -p 3000:3000 \
  -e PORT=3000 \
  -e NODE_ENV=production \
  -e AVIGO_PORTAL_PATH=/avigo-portal \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/public/uploads:/app/public/uploads \
  --restart unless-stopped \
  theavigo-corporate:latest
```

3. **Check Container Status and Logs:**
```bash
docker ps
docker logs -f avigo_portal
```

---

#### Option B: Docker Compose

For automated service orchestration with persistent data volume mapping:

```bash
docker compose up -d
```

To view running containers and health checks:
```bash
docker compose ps
docker compose logs -f
```

---

#### Option C: Linux Host with PM2

When deploying directly on an Ubuntu/Debian Linux virtual machine:

1. **Install PM2 Globally:**
```bash
npm install -g pm2
```

2. **Start the Service under PM2:**
```bash
NODE_ENV=production PORT=3000 pm2 start server.js --name "theavigo" -i max
pm2 save
pm2 startup
```

3. **Monitor PM2 Status:**
```bash
pm2 status
pm2 logs theavigo
```

---

#### Option D: Linux Host with Systemd Service

1. Create a service file at `/etc/systemd/system/theavigo.service`:
```ini
[Unit]
Description=Avigo Oil and Gas Corporate Web Platform
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/theavigo
ExecStart=/usr/bin/node /var/www/theavigo/server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=AVIGO_PORTAL_PATH=/avigo-portal

[Install]
WantedBy=multi-user.target
```

2. Enable and start the systemd unit:
```bash
sudo systemctl daemon-reload
sudo systemctl enable theavigo
sudo systemctl start theavigo
sudo systemctl status theavigo
```

---

#### Option E: Nginx Reverse Proxy with TLS/SSL

To serve the application securely on standard ports 80 and 443 with an SSL certificate:

```nginx
server {
    listen 80;
    server_name theavigo.com www.theavigo.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name theavigo.com www.theavigo.com;

    ssl_certificate /etc/letsencrypt/live/theavigo.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/theavigo.com/privkey.pem;

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

#### Option F: Cloud Container Platforms (Cloud Run, Railway, Render)

The project includes container specifications for direct cloud deployments:

- **Google Cloud Run**:
  ```bash
  gcloud run deploy avigo-corporate \
    --source . \
    --platform managed \
    --region europe-west1 \
    --allow-unauthenticated \
    --port 3000
  ```

- **Railway / Render**: Connect the Git repository and select Node.js or Docker environment. Specify `npm start` as the start command.

---

### RESTful API Reference

All API operations run through the native HTTP gateway in `server.js`:

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Public | System uptime, health status, and ISO timestamp probe. |
| `GET` | `/api/content` | Public | Returns active CMS content JSON directly from RAM cache. |
| `POST` | `/api/inquiries` | Public | Submits a new client service inquiry from the contact form. |
| `POST` | `/api/auth/login` | Public | Authenticates credentials and returns a 12-hour session token. |
| `GET` | `/api/auth/verify` | Protected | Validates the current administrative session token. |
| `GET` | `/api/auth/profile` | Protected | Returns administrative profile, email, role, and avatar. |
| `PUT` | `/api/auth/profile` | Protected | Updates administrative profile attributes. |
| `POST` | `/api/auth/password` | Protected | Verifies current password and sets a new salted PBKDF2 hash. |
| `PUT` | `/api/content` | Protected | Saves modified content, writes to disk, and updates RAM cache. |
| `POST` | `/api/content/reset`| Protected | Restores database content to initial corporate seed profile. |
| `GET` | `/api/revisions` | Protected | Lists timestamped historical content snapshots. |
| `POST` | `/api/revisions/rollback` | Protected | Restores content from a specified revision snapshot. |
| `GET` | `/api/media` | Protected | Catalogs all assets stored within `public/uploads/`. |
| `POST` | `/api/media/upload` | Protected | Uploads and registers new visual assets in the Media Vault. |
| `GET` | `/api/inquiries` | Protected | Retrieves registered client inquiries. |
| `PATCH` | `/api/inquiries/:id` | Protected | Updates the workflow status of an inquiry (`pending`/`reviewed`/`closed`). |

---

### Quality Assurance & Verification

The repository includes an automated verification script that executes 34 distinct validation checks across files, data stores, security restrictions, and live HTTP routes.

Run the verification suite:
```bash
node scripts/verify-deployment.js
```

Validation scope includes:
- File existence and minimum byte size checks for core views, stylesheets, and scripts.
- Schema and JSON parse integrity for `data/auth.json`, `data/cms-db.json`, and `data/seed-content.json`.
- Asset verification for high-definition photography in `public/uploads/`.
- HTTP 200 responses on `/`, `/about`, `/services`, `/contact`, `/avigo-portal`, and `/api/health`.
- Security verification verifying that generic administrative routes (`/admin`, `/login`, `/dashboard`) return 404 Not Found.

---

### Corporate Identity & Governance

**Avigo Oil and Gas Integrated Ltd.**  
Registration No: RC 1445778  
Corporate Headquarters: 10, Chief Alcon Close, Woji, Port Harcourt, Rivers State, Nigeria.  
Operational Inquiries: info@theavigo.com | +234 906 965 5238 | +234 803 336 2959  
Official Web Portal: https://theavigo.com
