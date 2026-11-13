/**
 * DRISHYA MEDIA - Backend Server & Booking Engine
 * Node.js (v24+) + Express + Native SQLite (node:sqlite)
 *
 * RBAC Policy:
 * - Single-Email Role-Based Access Control: strictly ONE authorized email (ADMIN_EMAIL)
 *   can authenticate and access CRM endpoints and customer leads.
 * - Public Booking API (/api/enquiries POST) remains completely open for client submissions.
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');

// Load environment variables from .env if present
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
        if (key && !process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  });
}

const app = express();
const PORT = process.env.PORT || 8001;

// 1. RBAC Single-Email Configuration
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'drishyamedia693@gmail.com').toLowerCase().trim();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'ASC123@dmedia';

// 1b. Automatic WhatsApp Lead Forwarding Configuration (2nd contact number by default)
const WHATSAPP_NOTIFY_PHONE = (process.env.WHATSAPP_NOTIFY_PHONE || '+919284085058').trim();
const CALLMEBOT_API_KEY = (process.env.CALLMEBOT_API_KEY || '').trim();
const LEAD_WEBHOOK_URL = (process.env.LEAD_WEBHOOK_URL || '').trim();

// 2. Initialize SQLite Database
const dbPath = path.join(__dirname, 'bookings.db');
const db = new DatabaseSync(dbPath);

// Initialize Tables: Enquiries + Admin Sessions
db.exec(`
  CREATE TABLE IF NOT EXISTS enquiries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    brand_name TEXT,
    service TEXT DEFAULT 'General Inquiry',
    budget TEXT DEFAULT 'Not specified',
    preferred_date TEXT,
    message TEXT,
    status TEXT DEFAULT 'new',
    notes TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS admin_sessions (
    token TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'super_admin',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL
  );
`);

console.log('✅ SQLite Database connected:', dbPath);
console.log(`🛡️  RBAC Policy Active: Only 1 authorized email [${ADMIN_EMAIL}] has CRM access.`);

// 3. Middlewares & Helpers
// CORS Middleware - allow Vercel frontend, local dev, or any origin
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Native cookie parser
function parseCookies(req) {
  const list = {};
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return list;
  cookieHeader.split(';').forEach(cookie => {
    const parts = cookie.split('=');
    const name = parts.shift()?.trim();
    if (!name) return;
    const value = parts.join('=').trim();
    try {
      list[name] = decodeURIComponent(value);
    } catch {
      list[name] = value;
    }
  });
  return list;
}

// Request Logger
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    console.log(`[${new Date().toISOString().slice(11, 19)}] ${req.method} ${req.path}`);
  }
  next();
});

// RBAC Middleware to protect CRM routes
function requireAdminAuth(req, res, next) {
  const cookies = parseCookies(req);
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '') ||
                cookies['drishya_session'] ||
                req.query.token;

  if (!token) {
    return res.status(401).json({
      error: 'Authentication required. Please sign in to access the CRM.',
      code: 'AUTH_REQUIRED',
    });
  }

  try {
    const session = db.prepare(`
      SELECT * FROM admin_sessions 
      WHERE token = ? AND datetime(expires_at) > datetime('now')
    `).get(token);

    if (!session) {
      return res.status(401).json({
        error: 'Session expired or invalid. Please sign in again.',
        code: 'SESSION_EXPIRED',
      });
    }

    // RBAC: Verify that the session email matches the singular authorized admin email
    if (session.email.toLowerCase().trim() !== ADMIN_EMAIL) {
      console.warn(`⛔ [RBAC Alert] Blocked non-authorized email session: ${session.email}`);
      return res.status(403).json({
        error: 'Access Denied: Unauthorized administrator session.',
        code: 'RBAC_FORBIDDEN',
      });
    }

    req.admin = {
      email: session.email,
      role: session.role,
    };
    next();
  } catch (err) {
    console.error('RBAC validation error:', err);
    return res.status(500).json({ error: 'Internal security verification error' });
  }
}

// 4. Authentication Endpoints (with in-memory rate limiting)
const loginAttempts = new Map();
const MAX_LOGIN_ATTEMPTS = 6;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

function checkLoginRateLimit(ip) {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now - entry.windowStart > LOGIN_WINDOW_MS) {
    return { allowed: true };
  }
  if (entry.count >= MAX_LOGIN_ATTEMPTS) {
    return { allowed: false, retryMinutes: Math.ceil((LOGIN_WINDOW_MS - (now - entry.windowStart)) / 60000) };
  }
  return { allowed: true };
}

function recordFailedLogin(ip) {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now - entry.windowStart > LOGIN_WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, windowStart: now });
  } else {
    entry.count += 1;
  }
}

/**
 * POST /api/auth/login
 * Validates credentials and strictly enforces single-email RBAC
 */
app.post('/api/auth/login', (req, res) => {
  try {
    const clientIp = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().split(',')[0].trim();
    const rate = checkLoginRateLimit(clientIp);
    if (!rate.allowed) {
      return res.status(429).json({
        error: `Too many failed login attempts. Try again in ${rate.retryMinutes} minute(s).`,
        code: 'RATE_LIMITED',
      });
    }

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // STRICT RBAC + PASSWORD CHECK (generic error avoids email enumeration)
    if (normalizedEmail !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
      recordFailedLogin(clientIp);
      console.warn(`⛔ [RBAC Denial] Failed admin login attempt for: ${normalizedEmail}`);
      return res.status(401).json({
        error: 'Invalid email or password. Access denied.',
        code: 'INVALID_CREDENTIALS',
      });
    }

    loginAttempts.delete(clientIp);

    // Generate Session Token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

    db.prepare(`
      INSERT INTO admin_sessions (token, email, role, expires_at)
      VALUES (?, ?, 'super_admin', ?)
    `).run(token, normalizedEmail, expiresAt);

    console.log(`✨ [RBAC Auth Success] Admin signed in: ${normalizedEmail}`);

    // Set HTTP-Only Cookie
    res.setHeader('Set-Cookie', `drishya_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`);

    return res.json({
      success: true,
      token,
      user: {
        email: normalizedEmail,
        role: 'super_admin',
        authorized: true,
      },
      message: 'Access granted. Welcome to Drishya Media CRM.',
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Authentication failed. Please try again.' });
  }
});

/**
 * POST /api/auth/logout
 * Destroys session
 */
app.post('/api/auth/logout', (req, res) => {
  try {
    const cookies = parseCookies(req);
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '') ||
                  cookies['drishya_session'];

    if (token) {
      db.prepare('DELETE FROM admin_sessions WHERE token = ?').run(token);
    }

    res.setHeader('Set-Cookie', 'drishya_session=; Path=/; HttpOnly; Max-Age=0');
    return res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    return res.status(500).json({ error: 'Logout failed' });
  }
});

/**
 * GET /api/auth/me
 * Checks if current caller is authenticated and authorized
 */
app.get('/api/auth/me', (req, res) => {
  try {
    const cookies = parseCookies(req);
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '') ||
                  cookies['drishya_session'] ||
                  req.query.token;

    if (!token) {
      return res.json({
        authenticated: false,
      });
    }

    const session = db.prepare(`
      SELECT * FROM admin_sessions 
      WHERE token = ? AND datetime(expires_at) > datetime('now')
    `).get(token);

    if (!session || session.email.toLowerCase().trim() !== ADMIN_EMAIL) {
      return res.json({
        authenticated: false,
      });
    }

    return res.json({
      authenticated: true,
      user: {
        email: session.email,
        role: session.role,
      },
    });
  } catch (err) {
    return res.json({
      authenticated: false,
    });
  }
});

// 5. PUBLIC Enquiries Route (Client submissions from portfolio)

/**
 * Forwards new enquiry details to configured WhatsApp (CallMeBot) and/or Webhook URL.
 * Runs non-blocking so client form submissions never stall if external services are slow.
 */
async function forwardLeadToWhatsApp(lead) {
  const lines = [
    `*New Drishya Media Lead (#${lead.id})*`,
    `Name: ${lead.name}`,
    `Email: ${lead.email}`,
    lead.phone ? `Phone: ${lead.phone}` : null,
    lead.brand_name ? `Brand: ${lead.brand_name}` : null,
    `Service: ${lead.service}`,
    `Package: ${lead.budget}`,
    lead.preferred_date ? `Start Date: ${lead.preferred_date}` : null,
    lead.message ? `Message: ${lead.message}` : null,
  ].filter(Boolean);

  const text = lines.join('\n');

  if (CALLMEBOT_API_KEY && WHATSAPP_NOTIFY_PHONE) {
    try {
      const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(WHATSAPP_NOTIFY_PHONE)}&text=${encodeURIComponent(text)}&apikey=${encodeURIComponent(CALLMEBOT_API_KEY)}`;
      const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (resp.ok) {
        console.log(`📲 [WhatsApp] Forwarded lead #${lead.id} to ${WHATSAPP_NOTIFY_PHONE}`);
      } else {
        console.warn(`⚠️ [WhatsApp] CallMeBot returned HTTP ${resp.status} for lead #${lead.id}`);
      }
    } catch (err) {
      console.warn(`⚠️ [WhatsApp] CallMeBot forwarding failed for lead #${lead.id}:`, err.message);
    }
  } else {
    console.log(`ℹ️ [WhatsApp] Lead #${lead.id} saved. Set CALLMEBOT_API_KEY in Render env vars to forward to ${WHATSAPP_NOTIFY_PHONE}.`);
  }

  if (LEAD_WEBHOOK_URL) {
    try {
      const resp = await fetch(LEAD_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...lead, notify_phone: WHATSAPP_NOTIFY_PHONE, text }),
        signal: AbortSignal.timeout(8000),
      });
      if (!resp.ok) {
        console.warn(`⚠️ [Webhook] Returned HTTP ${resp.status} for lead #${lead.id}`);
      }
    } catch (err) {
      console.warn(`⚠️ [Webhook] Forwarding failed for lead #${lead.id}:`, err.message);
    }
  }
}

/**
 * POST /api/enquiries
 * Public booking & enquiry intake
 */
app.post('/api/enquiries', (req, res) => {
  try {
    const { name, email, phone, brand_name, service, budget, preferred_date, message } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }
    if (!email || !email.trim() || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email address is required' });
    }

    const cleanLead = {
      name: name.trim(),
      email: email.trim(),
      phone: (phone || '').trim(),
      brand_name: (brand_name || '').trim(),
      service: (service || 'General Inquiry').trim(),
      budget: (budget || 'Flexible').trim(),
      preferred_date: (preferred_date || '').trim(),
      message: (message || '').trim(),
    };

    const stmt = db.prepare(`
      INSERT INTO enquiries (name, email, phone, brand_name, service, budget, preferred_date, message)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      cleanLead.name,
      cleanLead.email,
      cleanLead.phone,
      cleanLead.brand_name,
      cleanLead.service,
      cleanLead.budget,
      cleanLead.preferred_date,
      cleanLead.message
    );

    const leadId = Number(result.lastInsertRowid);
    console.log(`🎉 New enquiry received [#${leadId}] from ${cleanLead.name} (${cleanLead.email}) for ${cleanLead.service}`);

    // Forward lead asynchronously to WhatsApp / Webhook
    forwardLeadToWhatsApp({ id: leadId, ...cleanLead }).catch(() => {});

    return res.status(201).json({
      success: true,
      id: leadId,
      message: "Thank you! We've received your enquiry and will respond within 24 hours.",
    });
  } catch (err) {
    console.error('Error saving enquiry:', err);
    return res.status(500).json({ error: 'Failed to process enquiry. Please try again or email us directly.' });
  }
});

// 6. PROTECTED CRM Routes (RBAC Protected: ADMIN_EMAIL only)

/**
 * GET /api/enquiries
 * Retrieves all enquiries with optional filters: ?status=new&search=...
 */
app.get('/api/enquiries', requireAdminAuth, (req, res) => {
  try {
    const { status, search } = req.query;
    let query = 'SELECT * FROM enquiries';
    const params = [];
    const conditions = [];

    if (status && status !== 'all') {
      conditions.push('status = ?');
      params.push(status);
    }

    if (search && search.trim()) {
      conditions.push('(name LIKE ? OR email LIKE ? OR brand_name LIKE ? OR service LIKE ?)');
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY id DESC';

    const stmt = db.prepare(query);
    const rows = stmt.all(...params);

    return res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    console.error('Error fetching enquiries:', err);
    return res.status(500).json({ error: 'Failed to fetch enquiries' });
  }
});

/**
 * GET /api/enquiries/:id
 */
app.get('/api/enquiries/:id', requireAdminAuth, (req, res) => {
  try {
    const stmt = db.prepare('SELECT * FROM enquiries WHERE id = ?');
    const row = stmt.get(req.params.id);
    if (!row) {
      return res.status(404).json({ error: 'Enquiry not found' });
    }
    return res.json({ success: true, data: row });
  } catch (err) {
    return res.status(500).json({ error: 'Database error' });
  }
});

/**
 * PATCH /api/enquiries/:id
 * Update status or internal notes
 */
app.patch('/api/enquiries/:id', requireAdminAuth, (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    const existing = db.prepare('SELECT * FROM enquiries WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Enquiry not found' });
    }

    const newStatus = status !== undefined ? status : existing.status;
    const newNotes = notes !== undefined ? notes : existing.notes;

    const stmt = db.prepare('UPDATE enquiries SET status = ?, notes = ? WHERE id = ?');
    stmt.run(newStatus, newNotes, id);

    return res.json({ success: true, message: 'Updated successfully' });
  } catch (err) {
    console.error('Error updating enquiry:', err);
    return res.status(500).json({ error: 'Failed to update enquiry' });
  }
});

/**
 * DELETE /api/enquiries/:id
 */
app.delete('/api/enquiries/:id', requireAdminAuth, (req, res) => {
  try {
    const { id } = req.params;
    const stmt = db.prepare('DELETE FROM enquiries WHERE id = ?');
    stmt.run(id);
    return res.json({ success: true, message: 'Deleted successfully' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete' });
  }
});

/**
 * GET /api/stats
 * Overview numbers for the Admin dashboard
 */
app.get('/api/stats', requireAdminAuth, (req, res) => {
  try {
    const total = db.prepare('SELECT COUNT(*) as count FROM enquiries').get().count;
    const newCount = db.prepare("SELECT COUNT(*) as count FROM enquiries WHERE status = 'new'").get().count;
    const contacted = db.prepare("SELECT COUNT(*) as count FROM enquiries WHERE status = 'contacted'").get().count;
    const booked = db.prepare("SELECT COUNT(*) as count FROM enquiries WHERE status = 'booked'").get().count;
    const completed = db.prepare("SELECT COUNT(*) as count FROM enquiries WHERE status = 'completed'").get().count;

    const services = db.prepare(`
      SELECT service, COUNT(*) as count 
      FROM enquiries 
      GROUP BY service 
      ORDER BY count DESC
    `).all();

    return res.json({
      success: true,
      stats: {
        total,
        new: newCount,
        contacted,
        booked,
        completed,
        services,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

/**
 * GET /api/enquiries/export/csv
 * Direct CSV download of all leads (Protected)
 */
app.get('/api/enquiries/export/csv', requireAdminAuth, (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM enquiries ORDER BY id DESC').all();

    const headers = ['ID', 'Date', 'Name', 'Email', 'Phone', 'Brand', 'Service', 'Budget', 'Preferred Date', 'Status', 'Message', 'Notes'];
    const escape = (val) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    let csv = headers.join(',') + '\n';
    rows.forEach(r => {
      csv += [
        r.id,
        escape(r.created_at),
        escape(r.name),
        escape(r.email),
        escape(r.phone),
        escape(r.brand_name),
        escape(r.service),
        escape(r.budget),
        escape(r.preferred_date),
        escape(r.status),
        escape(r.message),
        escape(r.notes),
      ].join(',') + '\n';
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="drishya_enquiries_${new Date().toISOString().slice(0, 10)}.csv"`);
    return res.send(csv);
  } catch (err) {
    return res.status(500).send('Error generating CSV');
  }
});

// 7. Admin Dashboard HTML Route (noindex, hidden from search engines)
app.get('/admin', (req, res) => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// Block direct static access to sensitive backend/admin/database files
const BLOCKED_FILES = new Set(['/admin.html', '/server.js', '/bookings.db', '/package.json', '/package-lock.json', '/.env', '/.gitignore']);
app.use((req, res, next) => {
  const reqPath = req.path.toLowerCase();
  if (BLOCKED_FILES.has(reqPath) || reqPath.startsWith('/.') || reqPath.endsWith('.db') || reqPath.endsWith('.md')) {
    return res.status(404).send('Not found');
  }
  next();
});

// 8. Explicit Root & Static Assets
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.use(express.static(__dirname));

// Start Server locally or when run directly
if (require.main === module || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`\n🚀 Drishya Media Server running at: http://localhost:${PORT}/`);
    console.log(`🛡️  RBAC Protected CRM Dashboard: http://localhost:${PORT}/admin`);
    console.log(`🔒 Single Authorized Email: ${ADMIN_EMAIL}\n`);
  });
}

// Export for Vercel Serverless Function runtime
module.exports = app;
