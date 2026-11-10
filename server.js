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
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'agency@drishyamedia.com').toLowerCase().trim();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'drishya2026';

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
        error: `Access Denied: Only '${ADMIN_EMAIL}' has administrative permissions to view or edit CRM data.`,
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

// 4. Authentication Endpoints

/**
 * POST /api/auth/login
 * Validates credentials and strictly enforces single-email RBAC
 */
app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // STRICT RBAC CHECK: Only 1 email is authorized
    if (normalizedEmail !== ADMIN_EMAIL) {
      console.warn(`⛔ [RBAC Denial] Unauthorized email attempted login: ${normalizedEmail}`);
      return res.status(403).json({
        error: `Access Denied: '${email}' is not authorized. Only the designated administrator (${ADMIN_EMAIL}) can access this CRM.`,
        code: 'RBAC_UNAUTHORIZED_EMAIL',
      });
    }

    // Password Check
    if (password !== ADMIN_PASSWORD) {
      return res.status(401).json({
        error: 'Invalid password. Please enter the correct agency admin password.',
        code: 'INVALID_CREDENTIALS',
      });
    }

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
        authorizedEmail: ADMIN_EMAIL,
      });
    }

    const session = db.prepare(`
      SELECT * FROM admin_sessions 
      WHERE token = ? AND datetime(expires_at) > datetime('now')
    `).get(token);

    if (!session || session.email.toLowerCase().trim() !== ADMIN_EMAIL) {
      return res.json({
        authenticated: false,
        authorizedEmail: ADMIN_EMAIL,
      });
    }

    return res.json({
      authenticated: true,
      user: {
        email: session.email,
        role: session.role,
      },
      authorizedEmail: ADMIN_EMAIL,
    });
  } catch (err) {
    return res.json({
      authenticated: false,
      authorizedEmail: ADMIN_EMAIL,
    });
  }
});

// 5. PUBLIC Enquiries Route (Client submissions from portfolio)

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

    const stmt = db.prepare(`
      INSERT INTO enquiries (name, email, phone, brand_name, service, budget, preferred_date, message)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      name.trim(),
      email.trim(),
      (phone || '').trim(),
      (brand_name || '').trim(),
      (service || 'General Inquiry').trim(),
      (budget || 'Flexible').trim(),
      (preferred_date || '').trim(),
      (message || '').trim()
    );

    console.log(`🎉 New enquiry received [#${result.lastInsertRowid}] from ${name} (${email}) for ${service}`);

    return res.status(201).json({
      success: true,
      id: Number(result.lastInsertRowid),
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

// 7. Admin Dashboard HTML Route
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// 8. Static Assets (index.html, style.css, script.js, images)
app.use(express.static(__dirname));

// Start Server
app.listen(PORT, () => {
  console.log(`\n🚀 Drishya Media Server running at: http://localhost:${PORT}/`);
  console.log(`🛡️  RBAC Protected CRM Dashboard: http://localhost:${PORT}/admin`);
  console.log(`🔒 Single Authorized Email: ${ADMIN_EMAIL}\n`);
});
