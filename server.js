const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');

const PORT = process.env.PORT || 3000;
const PORTAL_ROUTE = process.env.AVIGO_PORTAL_PATH || '/avigo-portal';

const DATA_DIR = path.join(__dirname, 'data');
const PUBLIC_DIR = path.join(__dirname, 'public');
const VIEWS_DIR = path.join(__dirname, 'views');
const UPLOADS_DIR = path.join(PUBLIC_DIR, 'uploads');
const REVISIONS_DIR = path.join(DATA_DIR, 'revisions');

const SEED_PATH = path.join(DATA_DIR, 'seed-content.json');
const DB_PATH = path.join(DATA_DIR, 'cms-db.json');
const AUTH_PATH = path.join(DATA_DIR, 'auth.json');
const INQUIRIES_PATH = path.join(DATA_DIR, 'inquiries.json');

[DATA_DIR, PUBLIC_DIR, VIEWS_DIR, UPLOADS_DIR, REVISIONS_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Synchronize cms-db.json with Phase 3 unnumbered, TOC-free seed schema
function initDatabase() {
  const seedData = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'));
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(seedData, null, 2));
    return seedData;
  }
  try {
    const dbData = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    if (dbData.contents || !dbData.hero?.pillars) {
      delete dbData.contents;
      dbData.siteSettings = seedData.siteSettings;
      dbData.hero = Object.assign({}, seedData.hero, dbData.hero || {});
      delete dbData.hero.pageNumber;
      fs.writeFileSync(DB_PATH, JSON.stringify(dbData, null, 2));
    }
    return dbData;
  } catch (e) {
    fs.writeFileSync(DB_PATH, JSON.stringify(seedData, null, 2));
    return seedData;
  }
}

// Ultra-lightweight in-memory cache for <1ms reads
let memoryContentCache = initDatabase();

function updateContentStore(newContent) {
  memoryContentCache = newContent;
  fs.writeFileSync(DB_PATH, JSON.stringify(newContent, null, 2));
}

if (!fs.existsSync(INQUIRIES_PATH)) {
  fs.writeFileSync(INQUIRIES_PATH, JSON.stringify([
    {
      id: 'inq-initial-1',
      name: 'Engr. Tunde Adeyemi',
      company: 'Niger Delta Energy Partners',
      email: 't.adeyemi@ndenergy.ng',
      phone: '+2348030001122',
      sector: 'Energy Solutions (Oil and Gas)',
      message: 'Requesting corporate pre-qualification documentation and pipeline maintenance service schedule for Port Harcourt operations.',
      createdAt: new Date().toISOString(),
      status: 'unread'
    }
  ], null, 2));
}

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 12000, 64, 'sha512').toString('hex');
}

if (!fs.existsSync(AUTH_PATH)) {
  const salt = crypto.randomBytes(16).toString('hex');
  const defaultAuth = {
    username: 'admin',
    salt,
    passwordHash: hashPassword('avigo2026', salt),
    secret: crypto.randomBytes(32).toString('hex')
  };
  fs.writeFileSync(AUTH_PATH, JSON.stringify(defaultAuth, null, 2));
}

const loginAttempts = new Map();

function checkRateLimit(ip) {
  const now = Date.now();
  const record = loginAttempts.get(ip) || { count: 0, resetAt: now + 10 * 60 * 1000 };
  if (now > record.resetAt) {
    record.count = 0;
    record.resetAt = now + 10 * 60 * 1000;
  }
  return record.count < 10;
}

function recordFailedAttempt(ip) {
  const now = Date.now();
  const record = loginAttempts.get(ip) || { count: 0, resetAt: now + 10 * 60 * 1000 };
  record.count += 1;
  loginAttempts.set(ip, record);
}

function clearAttempts(ip) {
  loginAttempts.delete(ip);
}

function getAuthConfig() {
  return JSON.parse(fs.readFileSync(AUTH_PATH, 'utf8'));
}

function createToken(username) {
  const auth = getAuthConfig();
  const payload = Buffer.from(JSON.stringify({
    sub: username,
    iat: Date.now(),
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7
  })).toString('base64url');
  const sig = crypto.createHmac('sha256', auth.secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  const auth = getAuthConfig();
  const expectedSig = crypto.createHmac('sha256', auth.secret).update(payload).digest('base64url');
  if (sig !== expectedSig) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (data.exp < Date.now()) return null;
    return data;
  } catch (e) {
    return null;
  }
}

function requireAuth(req, res) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const user = verifyToken(token);
  if (!user) {
    sendJson(req, res, 401, { error: 'Unauthorized access. Avigo Admin authentication required.' });
    return null;
  }
  return user;
}

function sendJson(req, res, status, data) {
  const rawBuf = Buffer.from(JSON.stringify(data), 'utf8');
  const acceptEncoding = req.headers['accept-encoding'] || '';
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN'
  };

  if (rawBuf.length > 1024 && acceptEncoding.includes('gzip')) {
    const gz = zlib.gzipSync(rawBuf);
    headers['Content-Encoding'] = 'gzip';
    headers['Content-Length'] = gz.length;
    res.writeHead(status, headers);
    return res.end(gz);
  }

  headers['Content-Length'] = rawBuf.length;
  res.writeHead(status, headers);
  res.end(rawBuf);
}

function readJsonBody(req, maxBytes = 25 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(new Error('Payload too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(new Error('Invalid JSON payload'));
      }
    });
    req.on('error', reject);
  });
}

function saveRevisionSnapshot(label = 'Auto-save before update') {
  try {
    const id = `rev-${Date.now()}`;
    const revObj = {
      id,
      timestamp: new Date().toISOString(),
      label,
      content: memoryContentCache
    };
    fs.writeFileSync(path.join(REVISIONS_DIR, `${id}.json`), JSON.stringify(revObj, null, 2));

    const files = fs.readdirSync(REVISIONS_DIR)
      .filter((f) => f.endsWith('.json'))
      .sort()
      .reverse();
    if (files.length > 15) {
      files.slice(15).forEach((oldFile) => {
        fs.unlinkSync(path.join(REVISIONS_DIR, oldFile));
      });
    }
  } catch (e) {
    console.error('Revision save error:', e.message);
  }
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const STANDALONE_PUBLIC_ROUTES = new Set([
  '/',
  '/index.html',
  '/about',
  '/about/',
  '/about.html',
  '/services',
  '/services/',
  '/services.html',
  '/contact',
  '/contact/',
  '/contact.html'
]);

const BLOCKED_GENERIC_ADMIN_PATHS = new Set([
  '/admin',
  '/admin/',
  '/admin.html',
  '/login',
  '/dashboard'
]);

const server = http.createServer(async (req, res) => {
  try {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = decodeURIComponent(parsedUrl.pathname);
    const clientIp = req.socket.remoteAddress || 'unknown';

    if (BLOCKED_GENERIC_ADMIN_PATHS.has(pathname.toLowerCase())) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('404 Not Found');
    }

    // 1. Auth Login
    if (pathname === '/api/auth/login' && req.method === 'POST') {
      if (!checkRateLimit(clientIp)) {
        return sendJson(req, res, 429, { error: 'Too many login attempts. Please wait 10 minutes.' });
      }
      const body = await readJsonBody(req);
      const auth = getAuthConfig();
      const inputHash = hashPassword(String(body.password || ''), auth.salt);
      if (String(body.username || '').trim() === auth.username && inputHash === auth.passwordHash) {
        clearAttempts(clientIp);
        auth.lastLogin = new Date().toISOString();
        fs.writeFileSync(AUTH_PATH, JSON.stringify(auth, null, 2));
        const token = createToken(auth.username);
        return sendJson(req, res, 200, {
          token,
          username: auth.username,
          displayName: auth.displayName || 'Executive Administrator',
          role: auth.role || 'Super Administrator',
          avatarUrl: auth.avatarUrl || '/uploads/logo.png',
          portalPath: PORTAL_ROUTE
        });
      }
      recordFailedAttempt(clientIp);
      return sendJson(req, res, 401, { error: 'Invalid Avigo Admin credentials.' });
    }

    // 2. Auth Verify
    if (pathname === '/api/auth/verify' && req.method === 'GET') {
      const user = requireAuth(req, res);
      if (!user) return;
      const auth = getAuthConfig();
      return sendJson(req, res, 200, {
        authenticated: true,
        username: auth.username,
        displayName: auth.displayName || 'Executive Administrator',
        email: auth.email || 'admin@theavigo.com',
        role: auth.role || 'Super Administrator',
        phone: auth.phone || '+2349069655238',
        avatarUrl: auth.avatarUrl || '/uploads/logo.png',
        lastLogin: auth.lastLogin,
        portalPath: PORTAL_ROUTE
      });
    }

    // 2b. GET Admin Profile
    if (pathname === '/api/auth/profile' && req.method === 'GET') {
      const user = requireAuth(req, res);
      if (!user) return;
      const auth = getAuthConfig();
      return sendJson(req, res, 200, {
        username: auth.username,
        displayName: auth.displayName || 'Executive Administrator',
        email: auth.email || 'admin@theavigo.com',
        role: auth.role || 'Super Administrator',
        phone: auth.phone || '+2349069655238',
        avatarUrl: auth.avatarUrl || '/uploads/logo.png',
        lastLogin: auth.lastLogin,
        portalPath: PORTAL_ROUTE
      });
    }

    // 2c. PUT Admin Profile
    if (pathname === '/api/auth/profile' && req.method === 'PUT') {
      const user = requireAuth(req, res);
      if (!user) return;
      const body = await readJsonBody(req);
      const auth = getAuthConfig();
      if (body.displayName) auth.displayName = String(body.displayName).trim();
      if (body.email) auth.email = String(body.email).trim();
      if (body.role) auth.role = String(body.role).trim();
      if (body.phone) auth.phone = String(body.phone).trim();
      if (body.avatarUrl) auth.avatarUrl = String(body.avatarUrl).trim();
      fs.writeFileSync(AUTH_PATH, JSON.stringify(auth, null, 2));
      return sendJson(req, res, 200, {
        message: 'Admin profile updated successfully.',
        profile: {
          username: auth.username,
          displayName: auth.displayName,
          email: auth.email,
          role: auth.role,
          phone: auth.phone,
          avatarUrl: auth.avatarUrl,
          lastLogin: auth.lastLogin,
          portalPath: PORTAL_ROUTE
        }
      });
    }

    // 3. Auth Change Credentials / Password
    if (pathname === '/api/auth/password' && req.method === 'POST') {
      const user = requireAuth(req, res);
      if (!user) return;
      const body = await readJsonBody(req);
      const auth = getAuthConfig();
      const currentHash = hashPassword(String(body.currentPassword || ''), auth.salt);
      if (currentHash !== auth.passwordHash) {
        return sendJson(req, res, 400, { error: 'Current password is incorrect.' });
      }
      if (!body.newPassword || String(body.newPassword).length < 5) {
        return sendJson(req, res, 400, { error: 'New password must be at least 5 characters.' });
      }
      if (body.confirmPassword && String(body.newPassword) !== String(body.confirmPassword)) {
        return sendJson(req, res, 400, { error: 'New password and confirmation do not match.' });
      }
      const newSalt = crypto.randomBytes(16).toString('hex');
      const newUsername = body.newUsername ? String(body.newUsername).trim() : auth.username;
      auth.username = newUsername;
      auth.salt = newSalt;
      auth.passwordHash = hashPassword(String(body.newPassword), newSalt);
      fs.writeFileSync(AUTH_PATH, JSON.stringify(auth, null, 2));
      const newToken = createToken(newUsername);
      return sendJson(req, res, 200, {
        message: 'Admin credentials updated successfully.',
        token: newToken,
        username: newUsername
      });
    }

    // Health Check Endpoint (Used by Docker, load balancers, and monitoring)
    if (pathname === '/api/health' && req.method === 'GET') {
      return sendJson(req, res, 200, {
        status: 'healthy',
        service: 'theavigo-engine',
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString()
      });
    }

    // 4. GET Public Content (Served from In-Memory RAM Cache)
    if (pathname === '/api/content' && req.method === 'GET') {
      return sendJson(req, res, 200, memoryContentCache);
    }

    // 5. PUT Content (Protected)
    if (pathname === '/api/content' && req.method === 'PUT') {
      const user = requireAuth(req, res);
      if (!user) return;
      const body = await readJsonBody(req);
      if (!body || typeof body !== 'object') {
        return sendJson(req, res, 400, { error: 'Invalid content payload.' });
      }
      const label = body._revisionLabel || 'Avigo Admin Content Update';
      delete body._revisionLabel;

      saveRevisionSnapshot(label);
      updateContentStore(body);
      return sendJson(req, res, 200, { message: 'Content published to Avigo live website.', content: memoryContentCache });
    }

    // 6. Reset Content to Original Seed (Protected)
    if (pathname === '/api/content/reset' && req.method === 'POST') {
      const user = requireAuth(req, res);
      if (!user) return;
      saveRevisionSnapshot('Before Reset to Original Corporate Content');
      const seedData = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'));
      updateContentStore(seedData);
      return sendJson(req, res, 200, { message: 'Restored to original corporate profile content.', content: seedData });
    }

    // 7. Revisions List & Restore
    if (pathname === '/api/revisions' && req.method === 'GET') {
      const user = requireAuth(req, res);
      if (!user) return;
      const files = fs.readdirSync(REVISIONS_DIR)
        .filter((f) => f.endsWith('.json'))
        .sort()
        .reverse();
      const list = files.map((f) => {
        const data = JSON.parse(fs.readFileSync(path.join(REVISIONS_DIR, f), 'utf8'));
        return { id: data.id, timestamp: data.timestamp, label: data.label };
      });
      return sendJson(req, res, 200, { revisions: list });
    }

    if (pathname === '/api/revisions/restore' && req.method === 'POST') {
      const user = requireAuth(req, res);
      if (!user) return;
      const body = await readJsonBody(req);
      const revFile = path.join(REVISIONS_DIR, `${path.basename(String(body.id || ''))}.json`);
      if (!fs.existsSync(revFile)) {
        return sendJson(req, res, 404, { error: 'Revision snapshot not found.' });
      }
      const revData = JSON.parse(fs.readFileSync(revFile, 'utf8'));
      saveRevisionSnapshot(`Before restoring ${revData.id}`);
      updateContentStore(revData.content);
      return sendJson(req, res, 200, { message: 'Revision restored.', content: revData.content });
    }

    // 8. Client Inquiries API
    if (pathname === '/api/inquiries' && req.method === 'POST') {
      const body = await readJsonBody(req);
      if (!body.name || !body.email || !body.message) {
        return sendJson(req, res, 400, { error: 'Please provide your name, email address, and message.' });
      }
      const inquiries = JSON.parse(fs.readFileSync(INQUIRIES_PATH, 'utf8'));
      const newEntry = {
        id: `inq-${Date.now()}`,
        name: String(body.name).trim(),
        company: String(body.company || '').trim(),
        email: String(body.email).trim(),
        phone: String(body.phone || '').trim(),
        sector: String(body.sector || 'General Corporate Inquiry').trim(),
        message: String(body.message).trim(),
        createdAt: new Date().toISOString(),
        status: 'unread'
      };
      inquiries.unshift(newEntry);
      fs.writeFileSync(INQUIRIES_PATH, JSON.stringify(inquiries, null, 2));
      return sendJson(req, res, 201, { message: 'Thank you. Your inquiry has been received by Avigo Oil and Gas Integrated Ltd.' });
    }

    if (pathname === '/api/inquiries' && req.method === 'GET') {
      const user = requireAuth(req, res);
      if (!user) return;
      const inquiries = JSON.parse(fs.readFileSync(INQUIRIES_PATH, 'utf8'));
      return sendJson(req, res, 200, { inquiries });
    }

    if (pathname.startsWith('/api/inquiries/') && req.method === 'DELETE') {
      const user = requireAuth(req, res);
      if (!user) return;
      const id = path.basename(pathname.replace('/api/inquiries/', ''));
      let inquiries = JSON.parse(fs.readFileSync(INQUIRIES_PATH, 'utf8'));
      inquiries = inquiries.filter((i) => i.id !== id);
      fs.writeFileSync(INQUIRIES_PATH, JSON.stringify(inquiries, null, 2));
      return sendJson(req, res, 200, { message: 'Inquiry deleted.', inquiries });
    }

    // 9. Media Vault List & Upload
    if (pathname === '/api/media' && req.method === 'GET') {
      const user = requireAuth(req, res);
      if (!user) return;
      const files = fs.readdirSync(UPLOADS_DIR)
        .filter((f) => /\.(png|jpe?g|webp|svg)$/i.test(f))
        .map((f) => {
          const stat = fs.statSync(path.join(UPLOADS_DIR, f));
          return {
            name: f,
            url: `/uploads/${f}`,
            size: stat.size,
            modified: stat.mtime.toISOString()
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name));
      return sendJson(req, res, 200, { media: files });
    }

    if (pathname === '/api/media' && req.method === 'POST') {
      const user = requireAuth(req, res);
      if (!user) return;
      const body = await readJsonBody(req);
      if (!body.filename || !body.dataUrl) {
        return sendJson(req, res, 400, { error: 'Missing filename or dataUrl.' });
      }
      const safeName = path.basename(String(body.filename)).replace(/[^a-zA-Z0-9._-]/g, '-');
      const match = String(body.dataUrl).match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
      if (!match) {
        return sendJson(req, res, 400, { error: 'Invalid base64 dataUrl format.' });
      }
      const buffer = Buffer.from(match[2], 'base64');
      const finalName = fs.existsSync(path.join(UPLOADS_DIR, safeName))
        ? `${Date.now()}-${safeName}`
        : safeName;
      fs.writeFileSync(path.join(UPLOADS_DIR, finalName), buffer);
      return sendJson(req, res, 201, {
        message: 'Media uploaded to Avigo Vault.',
        item: {
          name: finalName,
          url: `/uploads/${finalName}`,
          size: buffer.length
        }
      });
    }

    // --- PROTECTED ADMIN PORTAL VIEW ROUTE (/avigo-portal) ---
    if (pathname === PORTAL_ROUTE || pathname === `${PORTAL_ROUTE}/`) {
      const portalHtmlPath = path.join(VIEWS_DIR, 'avigo-portal.html');
      if (fs.existsSync(portalHtmlPath)) {
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
          'X-Robots-Tag': 'noindex, nofollow'
        });
        return fs.createReadStream(portalHtmlPath).pipe(res);
      }
    }

    // --- PUBLIC MULTI-PAGE & STATIC ASSET ROUTES ---
    let filePath = pathname;
    if (STANDALONE_PUBLIC_ROUTES.has(filePath.toLowerCase())) {
      filePath = '/index.html';
    }

    const fullPath = path.normalize(path.join(PUBLIC_DIR, filePath));
    if (!fullPath.startsWith(PUBLIC_DIR)) {
      res.writeHead(403);
      return res.end('Forbidden');
    }

    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      const ext = path.extname(fullPath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      const isImage = /\.(png|jpe?g|webp|svg|ico)$/.test(ext);
      const headers = {
        'Content-Type': contentType,
        'Cache-Control': isImage ? 'public, max-age=3600' : 'no-cache'
      };

      const acceptEncoding = req.headers['accept-encoding'] || '';
      if (!isImage && acceptEncoding.includes('gzip')) {
        const raw = fs.readFileSync(fullPath);
        const gz = zlib.gzipSync(raw);
        headers['Content-Encoding'] = 'gzip';
        headers['Content-Length'] = gz.length;
        res.writeHead(200, headers);
        return res.end(gz);
      }

      res.writeHead(200, headers);
      fs.createReadStream(fullPath).pipe(res);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
    }
  } catch (err) {
    console.error('Server error:', err);
    sendJson(req, res, 500, { error: err.message || 'Internal Server Error' });
  }
});

server.listen(PORT, () => {
  console.log(`Avigo Lightweight Engine running at http://localhost:${PORT}`);
  console.log(`Standalone Public Pages: / | /about | /services | /contact`);
  console.log(`Protected Avigo Admin Portal: http://localhost:${PORT}${PORTAL_ROUTE}`);
});
