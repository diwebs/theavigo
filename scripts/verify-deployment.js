// ==============================================================================
// Avigo Oil and Gas Integrated Ltd. - Production Deployment Verification Suite
// Validates file integrity, data consistency, security boundaries, and routes.
// ==============================================================================

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const PORT = process.env.PORT || 3000;
const PORTAL_PATH = process.env.AVIGO_PORTAL_PATH || '/avigo-portal';

let passCount = 0;
let failCount = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`[PASS] ${testName}`);
    passCount++;
  } else {
    console.error(`[FAIL] ${testName} - ${details}`);
    failCount++;
  }
}

function checkFileExists(relPath, minBytes = 1) {
  const fullPath = path.join(ROOT_DIR, relPath);
  const exists = fs.existsSync(fullPath);
  let size = 0;
  if (exists) {
    size = fs.statSync(fullPath).size;
  }
  assert(exists && size >= minBytes, `File present: ${relPath} (${size} bytes)`);
}

function checkJsonValid(relPath) {
  const fullPath = path.join(ROOT_DIR, relPath);
  try {
    const raw = fs.readFileSync(fullPath, 'utf8');
    const parsed = JSON.parse(raw);
    assert(typeof parsed === 'object' && parsed !== null, `JSON valid: ${relPath}`);
  } catch (err) {
    assert(false, `JSON valid: ${relPath}`, err.message);
  }
}

function probeHttp(pathname) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${PORT}${pathname}`, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, headers: res.headers, body: data });
      });
    });
    req.on('error', (err) => {
      resolve({ error: err.message });
    });
  });
}

async function runVerification() {
  console.log('====================================================================');
  console.log('Avigo Oil and Gas Integrated Ltd. - Verification Suite');
  console.log('====================================================================\n');

  console.log('--- 1. Core Source & View Files ---');
  checkFileExists('server.js', 500);
  checkFileExists('package.json', 100);
  checkFileExists('views/avigo-portal.html', 500);
  checkFileExists('public/index.html', 500);
  checkFileExists('public/about.html', 500);
  checkFileExists('public/services.html', 500);
  checkFileExists('public/contact.html', 500);
  checkFileExists('public/css/site.css', 500);
  checkFileExists('public/css/admin.css', 500);
  checkFileExists('public/js/site.js', 500);
  checkFileExists('public/js/admin.js', 500);

  console.log('\n--- 2. Production Deployment Configs ---');
  checkFileExists('Dockerfile', 50);
  checkFileExists('docker-compose.yml', 50);
  checkFileExists('.dockerignore', 10);
  checkFileExists('.env.example', 20);

  console.log('\n--- 3. JSON Data Stores ---');
  checkJsonValid('data/auth.json');
  checkJsonValid('data/cms-db.json');
  checkJsonValid('data/seed-content.json');

  console.log('\n--- 4. Essential Uploaded Media Assets ---');
  checkFileExists('public/uploads/logo.png', 1000);
  checkFileExists('public/uploads/page01-hero-pipeline.jpg', 10000);
  checkFileExists('public/uploads/page02-gas-manifold.jpg', 10000);
  checkFileExists('public/uploads/page03-intro-banner.jpg', 10000);
  checkFileExists('public/uploads/page07-solar-wind.jpg', 10000);
  checkFileExists('public/uploads/page08-petrochemical-plant.jpg', 10000);

  console.log('\n--- 5. Live Server Network Probes ---');
  const healthRes = await probeHttp('/api/health');
  if (healthRes.error) {
    console.warn(`[INFO] Server is currently not reachable on port ${PORT}: ${healthRes.error}`);
    console.warn('[INFO] Skipping live HTTP probes (start server via "npm start" to run live route tests).');
  } else {
    assert(healthRes.statusCode === 200, 'GET /api/health returns 200 OK');

    const homeRes = await probeHttp('/');
    assert(homeRes.statusCode === 200, 'GET / returns 200 OK');

    const aboutRes = await probeHttp('/about');
    assert(aboutRes.statusCode === 200, 'GET /about returns 200 OK');

    const servicesRes = await probeHttp('/services');
    assert(servicesRes.statusCode === 200, 'GET /services returns 200 OK');

    const contactRes = await probeHttp('/contact');
    assert(contactRes.statusCode === 200, 'GET /contact returns 200 OK');

    const portalRes = await probeHttp(PORTAL_PATH);
    assert(portalRes.statusCode === 200, `GET ${PORTAL_PATH} returns 200 OK`);

    const admin404 = await probeHttp('/admin');
    assert(admin404.statusCode === 404, 'GET /admin returns 404 (Obfuscated portal route security)');

    const login404 = await probeHttp('/login');
    assert(login404.statusCode === 404, 'GET /login returns 404 (Obfuscated login route security)');

    const dashboard404 = await probeHttp('/dashboard');
    assert(dashboard404.statusCode === 404, 'GET /dashboard returns 404 (Obfuscated dashboard route security)');

    const contentRes = await probeHttp('/api/content');
    assert(contentRes.statusCode === 200, 'GET /api/content returns 200 OK');
  }

  console.log('\n====================================================================');
  console.log(`Results: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('====================================================================');

  if (failCount > 0) {
    process.exit(1);
  }
}

runVerification();

