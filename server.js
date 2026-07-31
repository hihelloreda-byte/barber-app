const express = require('express');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 10000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---------- Database init ----------
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS owner (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS bookings (
        id SERIAL PRIMARY KEY,
        service VARCHAR(100) NOT NULL,
        customer_name VARCHAR(255) NOT NULL,
        customer_phone VARCHAR(50) NOT NULL,
        booking_date DATE NOT NULL,
        booking_time VARCHAR(20) NOT NULL,
        status VARCHAR(50) DEFAULT 'Pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    const check = await pool.query('SELECT id FROM owner WHERE email = $1', ['saskbarber']);
    if (check.rows.length === 0) {
      await pool.query(
        'INSERT INTO owner (email, password) VALUES ($1, $2)',
        ['saskbarber', 'hotelsask']
      );
    }
    console.log('Database ready');
  } catch (err) {
    console.error('DB init error:', err.message);
  }
}
initDB();

// Simple in-memory sessions
const sessions = new Map();
function makeToken() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
function requireAuth(req, res, next) {
  const token = req.headers['x-auth-token'] || req.query.token;
  if (token && sessions.has(token)) {
    req.owner = sessions.get(token);
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized' });
}

// ---------- API ----------
app.post('/api/bookings', async (req, res) => {
  try {
    const { service, name, phone, date, time } = req.body;
    if (!service || !name || !phone || !date || !time) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    const d = new Date(date + 'T12:00:00');
    if (d.getDay() === 0) {
      return res.status(400).json({ error: 'We are closed on Sundays' });
    }
    const result = await pool.query(
      `INSERT INTO bookings (service, customer_name, customer_phone, booking_date, booking_time, status)
       VALUES ($1, $2, $3, $4, $5, 'Pending') RETURNING *`,
      [service, name.trim(), phone.trim(), date, time]
    );
    res.json({ success: true, booking: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save booking' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const result = await pool.query(
      'SELECT id, email FROM owner WHERE email = $1 AND password = $2',
      [username, password]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    const token = makeToken();
    sessions.set(token, result.rows[0]);
    res.json({ success: true, token, username: result.rows[0].email });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/api/bookings', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, service, customer_name, customer_phone, booking_date, booking_time, status, created_at
       FROM bookings ORDER BY booking_date DESC, booking_time ASC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

app.patch('/api/bookings/:id', requireAuth, async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['Arrived', 'No-Show', 'Cancelled', 'Pending'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const result = await pool.query(
      'UPDATE bookings SET status = $1 WHERE id = $2 RETURNING *',
      [status, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

app.post('/api/logout', (req, res) => {
  const token = req.headers['x-auth-token'];
  if (token) sessions.delete(token);
  res.json({ success: true });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ---------- Shared CSS (unchanged) ----------
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Playfair+Display:wght@600;700&display=swap');

:root {
  --bg: #08080c;
  --bg-card: #14141c;
  --bg-elev: #1a1a24;
  --gold: #d4af37;
  --gold-soft: #e8c547;
  --gold-dim: rgba(212, 175, 55, 0.15);
  --blue: #4f8cff;
  --blue-bright: #6ba3ff;
  --blue-glow: rgba(79, 140, 255, 0.45);
  --purple: #8b5cf6;
  --teal: #2dd4bf;
  --text: #f4f4f7;
  --muted: #9a9aab;
  --border: #262633;
  --border-glow: rgba(212, 175, 55, 0.25);
  --green: #34d399;
  --red: #f87171;
  --gray: #6b7280;
  --radius: 16px;
  --shadow: 0 8px 32px rgba(0,0,0,0.4);
}
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; }
body {
  font-family: 'DM Sans', system-ui, -apple-system, sans-serif;
  background: var(--bg);
  color: var(--text);
  line-height: 1.65;
  min-height: 100vh;
  background-image:
    radial-gradient(ellipse 80% 50% at 50% -20%, rgba(79,140,255,0.12), transparent),
    radial-gradient(ellipse 60% 40% at 100% 50%, rgba(212,175,55,0.06), transparent),
    radial-gradient(ellipse 50% 30% at 0% 80%, rgba(139,92,246,0.07), transparent);
}
a { color: inherit; text-decoration: none; }
.container { width: 100%; max-width: 1100px; margin: 0 auto; padding: 0 1.35rem; }
.navbar {
  position: sticky; top: 0; z-index: 1000;
  background: rgba(8,8,12,0.85);
  backdrop-filter: blur(20px) saturate(1.4);
  border-bottom: 1px solid var(--border);
}
.nav-inner {
  display: flex; align-items: center; justify-content: space-between;
  max-width: 1100px; margin: 0 auto; padding: 1rem 1.35rem;
}
.logo {
  font-family: 'Playfair Display', Georgia, serif;
  font-size: 1.2rem; font-weight: 700;
  background: linear-gradient(135deg, var(--gold), var(--gold-soft));
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  background-clip: text;
}
.logo span {
  font-family: 'DM Sans', sans-serif;
  font-weight: 400;
  -webkit-text-fill-color: var(--muted);
  background: none;
}
.nav-links { display: flex; gap: 0.25rem; list-style: none; }
.nav-links a {
  color: var(--muted); font-size: 0.92rem; font-weight: 500;
  padding: 0.45rem 0.9rem; border-radius: 8px;
  transition: color 0.2s, background 0.2s;
}
.nav-links a:hover { color: var(--gold-soft); background: var(--gold-dim); }
.nav-toggle {
  display: none; background: none; border: none; color: var(--text);
  font-size: 1.5rem; cursor: pointer; line-height: 1;
}
.hero {
  padding: 6rem 0 5rem;
  text-align: center;
  position: relative;
  overflow: hidden;
}
.hero::before {
  content: '';
  position: absolute; inset: 0;
  background:
    radial-gradient(circle at 30% 40%, rgba(79,140,255,0.1), transparent 50%),
    radial-gradient(circle at 70% 60%, rgba(212,175,55,0.08), transparent 45%);
  pointer-events: none;
}
.hero h1 {
  font-family: 'Playfair Display', Georgia, serif;
  font-size: clamp(2.2rem, 5.5vw, 3.4rem);
  font-weight: 700;
  background: linear-gradient(135deg, var(--gold-soft) 0%, var(--gold) 40%, #f0d060 100%);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  background-clip: text;
  letter-spacing: -0.02em; margin-bottom: 0.85rem;
  position: relative;
}
.hero .tagline {
  font-size: clamp(1.02rem, 2.4vw, 1.22rem);
  color: var(--muted); max-width: 520px; margin: 0 auto 1.4rem;
  font-weight: 400; position: relative;
}
.badge-since {
  display: inline-flex; align-items: center; gap: 0.4rem;
  font-size: 0.8rem; font-weight: 600;
  color: var(--gold-soft);
  background: linear-gradient(135deg, rgba(212,175,55,0.12), rgba(79,140,255,0.08));
  border: 1px solid var(--border-glow);
  padding: 0.4rem 1.1rem; border-radius: 999px; margin-bottom: 1.6rem;
  position: relative; letter-spacing: 0.03em;
}
.rating-row {
  display: flex; align-items: center; justify-content: center; gap: 0.55rem;
  position: relative;
}
.stars {
  background: linear-gradient(90deg, var(--gold), var(--gold-soft));
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  background-clip: text;
  font-size: 1.25rem; letter-spacing: 0.06em;
}
.rating-text { color: var(--muted); font-size: 0.95rem; font-weight: 500; }
section { padding: 4.5rem 0; }
.section-title {
  text-align: center;
  font-family: 'Playfair Display', Georgia, serif;
  font-size: clamp(1.7rem, 3.2vw, 2.15rem);
  font-weight: 700; margin-bottom: 0.45rem; color: var(--text);
}
.section-sub { text-align: center; color: var(--muted); margin-bottom: 2.6rem; font-size: 1rem; }
.services-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 1.5rem;
}
.service-card {
  background: linear-gradient(165deg, var(--bg-card) 0%, #12121a 100%);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 2rem 1.5rem 1.75rem;
  text-align: center;
  transition: border-color 0.3s, transform 0.3s, box-shadow 0.3s;
  position: relative; overflow: hidden;
}
.service-card::before {
  content: '';
  position: absolute; top: 0; left: 0; right: 0; height: 2px;
  background: linear-gradient(90deg, transparent, var(--gold), var(--blue), transparent);
  opacity: 0; transition: opacity 0.3s;
}
.service-card:hover {
  border-color: rgba(212,175,55,0.35);
  transform: translateY(-5px);
  box-shadow: 0 12px 40px rgba(0,0,0,0.35), 0 0 0 1px rgba(212,175,55,0.08);
}
.service-card:hover::before { opacity: 1; }
.svc-icon {
  width: 60px; height: 60px; margin: 0 auto 1.15rem;
  background: linear-gradient(145deg, rgba(212,175,55,0.18), rgba(79,140,255,0.12));
  border: 1px solid rgba(212,175,55,0.2);
  border-radius: 14px;
  display: flex; align-items: center; justify-content: center;
  font-size: 1.65rem;
  box-shadow: 0 4px 16px rgba(0,0,0,0.2);
}
.service-card h3 { font-size: 1.2rem; font-weight: 600; color: var(--gold-soft); margin-bottom: 0.5rem; }
.service-card p { color: var(--muted); font-size: 0.92rem; margin-bottom: 1rem; min-height: 2.9em; }
.price-wrap { margin-bottom: 1.15rem; min-height: 1.7em; }
.price-btn {
  background: none; border: none; padding: 0;
  font-size: 0.86rem; color: var(--blue-bright);
  font-weight: 600; cursor: pointer; font-family: inherit;
  text-decoration: underline; text-underline-offset: 3px;
  transition: color 0.2s;
}
.price-btn:hover { color: var(--teal); }
.price-phone { display: none; font-size: 1rem; font-weight: 600; letter-spacing: 0.02em; }
.price-phone a {
  background: linear-gradient(135deg, var(--gold-soft), var(--gold));
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  background-clip: text;
  border-bottom: 1px solid rgba(212,175,55,0.35);
}
.price-wrap.revealed .price-btn { display: none; }
.price-wrap.revealed .price-phone { display: inline; }
.btn {
  display: inline-block; padding: 0.72rem 1.45rem; border-radius: 10px;
  font-weight: 600; font-size: 0.92rem; cursor: pointer; border: none;
  font-family: inherit;
  transition: transform 0.2s, box-shadow 0.25s, filter 0.2s;
}
.btn-gold {
  background: linear-gradient(135deg, #e0bc4a 0%, var(--gold) 50%, #b8941f 100%);
  color: #0a0a0c;
  box-shadow: 0 4px 16px rgba(212,175,55,0.3);
}
.btn-gold:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 24px rgba(212,175,55,0.45);
  filter: brightness(1.05);
}
.btn-blue {
  background: linear-gradient(135deg, var(--blue-bright), var(--blue) 60%, #3b6fd9);
  color: #fff;
  box-shadow: 0 4px 16px var(--blue-glow);
}
.btn-blue:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 24px rgba(79,140,255,0.55);
  filter: brightness(1.06);
}
.btn-outline {
  background: transparent; border: 1px solid var(--border); color: var(--muted);
}
.btn-outline:hover {
  border-color: var(--gold); color: var(--gold-soft); background: var(--gold-dim);
}
.btn-sm { padding: 0.4rem 0.75rem; font-size: 0.78rem; border-radius: 7px; }
.btn-green {
  background: linear-gradient(135deg, #34d399, #10b981);
  color: #064e3b; box-shadow: 0 2px 10px rgba(52,211,153,0.3);
}
.btn-red {
  background: linear-gradient(135deg, #f87171, #ef4444);
  color: #fff; box-shadow: 0 2px 10px rgba(248,113,113,0.3);
}
.btn-gray {
  background: linear-gradient(135deg, #6b7280, #4b5563);
  color: #fff;
}
.testimonials-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(290px, 1fr));
  gap: 1.5rem;
}
.testimonial {
  background: linear-gradient(165deg, var(--bg-card), #12121a);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 1.9rem 1.7rem;
  position: relative;
  transition: border-color 0.3s, box-shadow 0.3s;
}
.testimonial:hover {
  border-color: rgba(139,92,246,0.3);
  box-shadow: 0 8px 28px rgba(0,0,0,0.25);
}
.testimonial::before {
  content: '"';
  position: absolute; top: 0.55rem; left: 1.1rem;
  font-size: 3.2rem;
  background: linear-gradient(135deg, var(--gold), var(--purple));
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  background-clip: text;
  opacity: 0.35;
  font-family: Georgia, serif; line-height: 1;
}
.testimonial p {
  color: var(--muted); font-size: 0.96rem;
  margin-bottom: 1.1rem; padding-top: 0.85rem;
  font-style: italic;
}
.testimonial .author {
  font-weight: 600; font-size: 0.9rem;
  background: linear-gradient(135deg, var(--gold-soft), var(--blue-bright));
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  background-clip: text;
}
.booking-section { position: relative; }
.booking-section::before {
  content: '';
  position: absolute; inset: 0;
  background: radial-gradient(ellipse 70% 60% at 50% 50%, rgba(79,140,255,0.06), transparent);
  pointer-events: none;
}
.form-card {
  max-width: 520px; margin: 0 auto;
  background: linear-gradient(165deg, var(--bg-card) 0%, #111118 100%);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 2.25rem 1.9rem;
  box-shadow: var(--shadow), 0 0 0 1px rgba(79,140,255,0.05);
  position: relative;
}
.form-card::before {
  content: '';
  position: absolute; top: 0; left: 10%; right: 10%; height: 1px;
  background: linear-gradient(90deg, transparent, var(--blue), var(--gold), transparent);
}
.service-options {
  display: grid; grid-template-columns: 1fr; gap: 0.75rem; margin-bottom: 1.5rem;
}
.service-option {
  display: flex; align-items: center; gap: 0.75rem;
  padding: 0.95rem 1.15rem;
  background: var(--bg-elev);
  border: 2px solid var(--border);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.25s;
  color: var(--muted);
  font-weight: 500;
  font-size: 0.96rem;
}
.service-option:hover {
  border-color: rgba(79,140,255,0.4);
  background: rgba(79,140,255,0.06);
}
.service-option.selected {
  border-color: var(--blue);
  background: linear-gradient(135deg, rgba(79,140,255,0.15), rgba(139,92,246,0.08));
  color: #a5c4ff;
  box-shadow: 0 0 24px var(--blue-glow), inset 0 0 20px rgba(79,140,255,0.05);
}
.service-option input { display: none; }
.form-group { margin-bottom: 1.15rem; }
.form-group label {
  display: block; font-size: 0.8rem; font-weight: 600;
  color: var(--muted); margin-bottom: 0.4rem;
  letter-spacing: 0.03em; text-transform: uppercase;
}
.form-group input,
.form-group select {
  width: 100%; padding: 0.8rem 1.05rem;
  background: var(--bg-elev);
  border: 1px solid var(--border);
  border-radius: 10px;
  color: var(--text); font-size: 1rem;
  font-family: inherit;
  outline: none; transition: border-color 0.2s, box-shadow 0.2s;
}
.form-group input:focus,
.form-group select:focus {
  border-color: var(--blue);
  box-shadow: 0 0 0 3px rgba(79,140,255,0.15);
}
.form-group select:disabled { opacity: 0.4; cursor: not-allowed; }
.form-msg {
  margin-top: 1.1rem; padding: 0.8rem 1.05rem;
  border-radius: 10px; font-size: 0.92rem; display: none;
}
.form-msg.success {
  display: block;
  background: rgba(52,211,153,0.12);
  border: 1px solid rgba(52,211,153,0.35);
  color: #6ee7b7;
}
.form-msg.error {
  display: block;
  background: rgba(248,113,113,0.12);
  border: 1px solid rgba(248,113,113,0.35);
  color: #fca5a5;
}
.form-submit { width: 100%; margin-top: 0.5rem; padding: 0.95rem; font-size: 1.05rem; }
.footer {
  background: linear-gradient(180deg, transparent, #050508);
  border-top: 1px solid var(--border);
  padding: 3rem 0 2.5rem;
  text-align: center;
}
.footer h3 {
  font-family: 'Playfair Display', Georgia, serif;
  font-size: 1.2rem; margin-bottom: 0.7rem;
  background: linear-gradient(135deg, var(--gold), var(--gold-soft));
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  background-clip: text;
}
.footer p { color: var(--muted); font-size: 0.9rem; margin-bottom: 0.3rem; }
.footer a:hover { color: var(--gold-soft); }
.footer .hours-block {
  margin-top: 1.2rem; padding-top: 1.2rem;
  border-top: 1px solid var(--border);
  display: inline-block;
}
.footer .note { font-size: 0.8rem; color: var(--muted); margin-top: 0.55rem; opacity: 0.8; }
.auth-page {
  min-height: 100vh; display: flex; align-items: center; justify-content: center;
  padding: 2rem 1rem;
  background-image:
    radial-gradient(ellipse 60% 50% at 50% 0%, rgba(79,140,255,0.1), transparent),
    radial-gradient(ellipse 40% 40% at 80% 80%, rgba(212,175,55,0.06), transparent);
}
.auth-card {
  width: 100%; max-width: 400px;
  background: linear-gradient(165deg, var(--bg-card), #111118);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 2.25rem;
  box-shadow: var(--shadow);
}
.auth-card h1 {
  text-align: center;
  font-family: 'Playfair Display', Georgia, serif;
  font-size: 1.55rem; margin-bottom: 0.35rem;
  background: linear-gradient(135deg, var(--gold-soft), var(--gold));
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  background-clip: text;
}
.auth-card .sub { text-align: center; color: var(--muted); font-size: 0.9rem; margin-bottom: 1.75rem; }
.dash-page { min-height: 100vh; display: flex; flex-direction: column; }
.dash-header {
  background: rgba(14,14,20,0.95);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border);
  padding: 1.1rem 0;
}
.dash-header-inner {
  max-width: 1100px; margin: 0 auto; padding: 0 1.35rem;
  display: flex; align-items: center; justify-content: space-between;
  flex-wrap: wrap; gap: 0.75rem;
}
.dash-header h1 {
  font-family: 'Playfair Display', Georgia, serif;
  font-size: 1.3rem;
  background: linear-gradient(135deg, var(--gold), var(--gold-soft));
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  background-clip: text;
}
.dash-body { flex: 1; padding: 2.25rem 0; }
.table-wrap {
  overflow-x: auto;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 14px;
  box-shadow: var(--shadow);
}
table { width: 100%; border-collapse: collapse; min-width: 720px; }
th, td {
  padding: 0.9rem 1.1rem; text-align: left;
  border-bottom: 1px solid var(--border); font-size: 0.9rem;
}
th {
  background: var(--bg-elev); color: var(--muted);
  font-weight: 600; font-size: 0.72rem;
  text-transform: uppercase; letter-spacing: 0.05em;
}
tr:last-child td { border-bottom: none; }
tr:hover td { background: rgba(79,140,255,0.03); }
.status-badge {
  display: inline-block; padding: 0.28rem 0.65rem;
  border-radius: 999px; font-size: 0.72rem; font-weight: 600;
}
.status-Pending { background: rgba(79,140,255,0.18); color: #93c5fd; }
.status-Arrived { background: rgba(52,211,153,0.18); color: #6ee7b7; }
.status-No-Show { background: rgba(248,113,113,0.18); color: #fca5a5; }
.status-Cancelled { background: rgba(107,114,128,0.25); color: #d1d5db; }
.actions { display: flex; gap: 0.4rem; flex-wrap: wrap; }
.empty { text-align: center; padding: 3.5rem 1rem; color: var(--muted); }
@media (max-width: 768px) {
  .nav-links {
    display: none; position: absolute; top: 100%; left: 0; right: 0;
    background: rgba(8,8,12,0.98); flex-direction: column;
    padding: 0.5rem 0; gap: 0; border-bottom: 1px solid var(--border);
    backdrop-filter: blur(16px);
  }
  .nav-links.open { display: flex; }
  .nav-links a {
    padding: 0.85rem 1.35rem; border-bottom: 1px solid var(--border);
    border-radius: 0;
  }
  .nav-toggle { display: block; }
  .hero { padding: 4rem 0 3.5rem; }
  section { padding: 3.25rem 0; }
  .form-card { padding: 1.65rem 1.35rem; }
  th, td { padding: 0.65rem 0.75rem; font-size: 0.84rem; }
}
`;

// ---------- Customer page ----------
const customerPage = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Hotel Saskatchewan Barber — Quality Cuts Since 1927</title>
  <style>${CSS}</style>
</head>
<body>
  <nav class="navbar">
    <div class="nav-inner">
      <a href="#home" class="logo">Hotel Saskatchewan <span>Barber</span></a>
      <button class="nav-toggle" id="navToggle" aria-label="Menu">☰</button>
      <ul class="nav-links" id="navLinks">
        <li><a href="#home">Home</a></li>
        <li><a href="#services">Services</a></li>
        <li><a href="#reviews">Reviews</a></li>
        <li><a href="#book">Book</a></li>
      </ul>
    </div>
  </nav>

  <section class="hero" id="home">
    <div class="container">
      <h1>Hotel Saskatchewan Barber</h1>
      <p class="tagline">Quality you deserve, prices you'll love, and a name you can trust.</p>
      <div class="badge-since">Trusted since 1927</div>
      <div class="rating-row">
        <span class="stars">★★★★½</span>
        <span class="rating-text">4.5 · 50+ reviews</span>
      </div>
    </div>
  </section>

  <section id="services">
    <div class="container">
      <h2 class="section-title">Our Services</h2>
      <p class="section-sub">Classic cuts and grooming, done right</p>
      <div class="services-grid">
        <div class="service-card">
          <div class="svc-icon">✂️</div>
          <h3>Haircut</h3>
          <p>Precision cuts tailored to your style — classic or contemporary.</p>
          <div class="price-wrap">
            <button type="button" class="price-btn">Call for pricing</button>
            <span class="price-phone"><a href="tel:3065220275">(306) 522-0275</a></span>
          </div>
          <a href="#book" class="btn btn-gold">Book Now</a>
        </div>
        <div class="service-card">
          <div class="svc-icon">🧔</div>
          <h3>Beard Sculpting</h3>
          <p>Shape, trim, and define your beard for a polished look.</p>
          <div class="price-wrap">
            <button type="button" class="price-btn">Call for pricing</button>
            <span class="price-phone"><a href="tel:3065220275">(306) 522-0275</a></span>
          </div>
          <a href="#book" class="btn btn-gold">Book Now</a>
        </div>
        <div class="service-card">
          <div class="svc-icon">🪒</div>
          <h3>Hot Towel Shave</h3>
          <p>Traditional straight-razor shave with hot towels and aftershave.</p>
          <div class="price-wrap">
            <button type="button" class="price-btn">Call for pricing</button>
            <span class="price-phone"><a href="tel:3065220275">(306) 522-0275</a></span>
          </div>
          <a href="#book" class="btn btn-gold">Book Now</a>
        </div>
      </div>
    </div>
  </section>

  <section id="reviews">
    <div class="container">
      <h2 class="section-title">What Our Clients Say</h2>
      <p class="section-sub">Decades of trusted service in Regina</p>
      <div class="testimonials-grid">
        <div class="testimonial">
          <p>I have been going to this barber shop for a little over 5 years now (I'm talking consistently, every 3-4 weeks). Service exceptional, appointments are always kept and on time. Truly a prodigious place to venture and cannot recommend it enough! I have always walked out feeling fresh, fly, and dapper!</p>
          <div class="author">— Long-time Client</div>
        </div>
        <div class="testimonial">
          <p>Roy is a phenomenal, polite and professional barber with a definite respect for the old-school class a traditional barber shop should present. You make an appointment and receive the exact service you expect. Highly recommend for both his skill and the barbershop experience.</p>
          <div class="author">— Satisfied Customer</div>
        </div>
      </div>
    </div>
  </section>

  <section class="booking-section" id="book">
    <div class="container">
      <h2 class="section-title">Book an Appointment</h2>
      <p class="section-sub">Select a service and preferred time — we'll confirm by phone</p>
      <div class="form-card">
        <form id="bookingForm">
          <div class="form-group">
            <label>Service</label>
            <div class="service-options">
              <label class="service-option" data-value="Haircut">
                <input type="radio" name="service" value="Haircut" />
                ✂️ Haircut
              </label>
              <label class="service-option" data-value="Beard">
                <input type="radio" name="service" value="Beard" />
                🧔 Beard Sculpting
              </label>
              <label class="service-option" data-value="Hot Towel Shave">
                <input type="radio" name="service" value="Hot Towel Shave" />
                🪒 Hot Towel Shave
              </label>
            </div>
          </div>
          <div class="form-group">
            <label for="name">Full Name</label>
            <input type="text" id="name" name="name" required placeholder="Your name" autocomplete="name" />
          </div>
          <div class="form-group">
            <label for="phone">Phone Number</label>
            <input type="tel" id="phone" name="phone" required placeholder="(306) 555-1234" autocomplete="tel" />
          </div>
          <div class="form-group">
            <label for="date">Preferred Date</label>
            <input type="date" id="date" name="date" required />
          </div>
          <div class="form-group">
            <label for="time">Preferred Time</label>
            <select id="time" name="time" required>
              <option value="">Select a time</option>
            </select>
          </div>
          <button type="submit" class="btn btn-blue form-submit">Request Booking</button>
          <div id="formMsg" class="form-msg"></div>
        </form>
      </div>
    </div>
  </section>

  <footer class="footer">
    <div class="container">
      <h3>Hotel Saskatchewan Barber</h3>
      <p>Hotel Saskatchewan, Regina</p>
      <p><a href="tel:3065220275">(306) 522-0275</a></p>
      <div class="hours-block">
        <p><strong>Hours</strong></p>
        <p>Monday – Saturday: 9:30 AM – 5:00 PM</p>
        <p>Sunday: Closed</p>
        <p class="note">Closed Sundays • Holiday hours may differ</p>
      </div>
    </div>
  </footer>

  <script>
    // Mobile nav
    const navToggle = document.getElementById('navToggle');
    const navLinks = document.getElementById('navLinks');
    navToggle.addEventListener('click', () => navLinks.classList.toggle('open'));
    navLinks.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => navLinks.classList.remove('open'));
    });

    // Call for pricing → reveal phone number
    document.querySelectorAll('.price-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        this.closest('.price-wrap').classList.add('revealed');
      });
    });

    // Service selection (form only — Book Now cards only scroll)
    const serviceOptions = document.querySelectorAll('.service-option');
    serviceOptions.forEach(opt => {
      opt.addEventListener('click', () => {
        serviceOptions.forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        opt.querySelector('input').checked = true;
      });
    });

    // Time slots 9:30 AM – 4:30 PM, 30-min
    const cleanTimes = [
      '9:30 AM','10:00 AM','10:30 AM','11:00 AM','11:30 AM',
      '12:00 PM','12:30 PM','1:00 PM','1:30 PM','2:00 PM',
      '2:30 PM','3:00 PM','3:30 PM','4:00 PM','4:30 PM'
    ];
    const timeSelect = document.getElementById('time');

    function populateTimes(disabled) {
      timeSelect.innerHTML = '<option value="">Select a time</option>';
      cleanTimes.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t;
        opt.textContent = t;
        if (disabled) opt.disabled = true;
        timeSelect.appendChild(opt);
      });
      timeSelect.disabled = !!disabled;
    }
    populateTimes(false);

    // Date: min today, block Sundays
    const dateInput = document.getElementById('date');
    const today = new Date();
    dateInput.min = today.getFullYear() + '-' +
      String(today.getMonth() + 1).padStart(2, '0') + '-' +
      String(today.getDate()).padStart(2, '0');

    dateInput.addEventListener('change', function () {
      if (!this.value) {
        populateTimes(false);
        return;
      }
      const d = new Date(this.value + 'T12:00:00');
      if (d.getDay() === 0) {
        alert('We are closed on Sundays. Please choose another day.');
        this.value = '';
        populateTimes(true);
        return;
      }
      populateTimes(false);
    });

    // Submit
    document.getElementById('bookingForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      const msg = document.getElementById('formMsg');
      msg.className = 'form-msg';
      msg.textContent = '';

      const serviceEl = document.querySelector('input[name="service"]:checked');
      if (!serviceEl) {
        msg.className = 'form-msg error';
        msg.textContent = 'Please select a service.';
        return;
      }
      const name = document.getElementById('name').value.trim();
      const phone = document.getElementById('phone').value.trim();
      const date = document.getElementById('date').value;
      const time = document.getElementById('time').value;

      if (!name || !phone || !date || !time) {
        msg.className = 'form-msg error';
        msg.textContent = 'Please fill in all fields.';
        return;
      }

      const d = new Date(date + 'T12:00:00');
      if (d.getDay() === 0) {
        msg.className = 'form-msg error';
        msg.textContent = 'We are closed on Sundays.';
        return;
      }

      try {
        const res = await fetch('/api/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            service: serviceEl.value,
            name, phone, date, time
          })
        });
        const data = await res.json();
        if (!res.ok) {
          msg.className = 'form-msg error';
          msg.textContent = data.error || 'Booking failed. Please try again.';
          return;
        }
        msg.className = 'form-msg success';
        msg.textContent = 'Booking requested! We will confirm by phone shortly.';
        this.reset();
        serviceOptions.forEach(o => o.classList.remove('selected'));
        populateTimes(false);
      } catch (err) {
        msg.className = 'form-msg error';
        msg.textContent = 'Network error. Please try again.';
      }
    });
  </script>
</body>
</html>`;

// ---------- Login page ----------
const loginPage = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Owner Login — Hotel Saskatchewan Barber</title>
  <style>${CSS}</style>
</head>
<body>
  <div class="auth-page">
    <div class="auth-card">
      <h1>Owner Login</h1>
      <p class="sub">Hotel Saskatchewan Barber Dashboard</p>
      <form id="loginForm">
        <div class="form-group">
          <label for="username">Username</label>
          <input type="text" id="username" required placeholder="Enter your username" autocomplete="username" />
        </div>
        <div class="form-group">
          <label for="password">Password</label>
          <input type="password" id="password" required placeholder="••••••••" autocomplete="current-password" />
        </div>
        <button type="submit" class="btn btn-blue form-submit">Sign In</button>
        <div id="loginMsg" class="form-msg"></div>
      </form>
      <p style="text-align:center;margin-top:1.5rem;font-size:0.85rem;">
        <a href="/" style="color:var(--muted);">← Back to website</a>
      </p>
    </div>
  </div>
  <script>
    document.getElementById('loginForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      const msg = document.getElementById('loginMsg');
      msg.className = 'form-msg';
      const username = document.getElementById('username').value.trim();
      const password = document.getElementById('password').value;
      try {
        const res = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (!res.ok) {
          msg.className = 'form-msg error';
          msg.textContent = data.error || 'Login failed';
          return;
        }
        localStorage.setItem('ownerToken', data.token);
        localStorage.setItem('ownerUsername', data.username);
        window.location.href = '/dashboard';
      } catch (err) {
        msg.className = 'form-msg error';
        msg.textContent = 'Network error';
      }
    });
  </script>
</body>
</html>`;

// ---------- Dashboard page ----------
const dashboardPage = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Dashboard — Hotel Saskatchewan Barber</title>
  <style>${CSS}</style>
</head>
<body>
  <div class="dash-page">
    <header class="dash-header">
      <div class="dash-header-inner">
        <h1>Bookings Dashboard</h1>
        <div style="display:flex;align-items:center;gap:1rem;">
          <span id="ownerUsername" style="color:var(--muted);font-size:0.9rem;"></span>
          <button class="btn btn-outline btn-sm" id="logoutBtn">Logout</button>
        </div>
      </div>
    </header>
    <div class="dash-body">
      <div class="container">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Service</th>
                <th>Name</th>
                <th>Phone</th>
                <th>Date</th>
                <th>Time</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="bookingsBody">
              <tr><td colspan="7" class="empty">Loading…</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
  <script>
    const token = localStorage.getItem('ownerToken');
    if (!token) window.location.href = '/login';
    document.getElementById('ownerUsername').textContent = localStorage.getItem('ownerUsername') || '';

    function escapeHtml(s) {
      if (s == null) return '';
      return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    async function loadBookings() {
      const tbody = document.getElementById('bookingsBody');
      try {
        const res = await fetch('/api/bookings', {
          headers: { 'x-auth-token': token }
        });
        if (res.status === 401) {
          localStorage.removeItem('ownerToken');
          window.location.href = '/login';
          return;
        }
        const rows = await res.json();
        if (!rows.length) {
          tbody.innerHTML = '<tr><td colspan="7" class="empty">No bookings yet</td></tr>';
          return;
        }
        tbody.innerHTML = rows.map(b => {
          const dateStr = b.booking_date
            ? new Date(b.booking_date).toLocaleDateString('en-CA')
            : '';
          return (
            '<tr data-id="' + b.id + '">' +
              '<td>' + escapeHtml(b.service) + '</td>' +
              '<td>' + escapeHtml(b.customer_name) + '</td>' +
              '<td>' + escapeHtml(b.customer_phone) + '</td>' +
              '<td>' + dateStr + '</td>' +
              '<td>' + escapeHtml(b.booking_time) + '</td>' +
              '<td><span class="status-badge status-' + escapeHtml(b.status) + '">' +
                escapeHtml(b.status) + '</span></td>' +
              '<td class="actions">' +
                '<button class="btn btn-green btn-sm" data-status="Arrived">Arrived</button>' +
                '<button class="btn btn-red btn-sm" data-status="No-Show">No-Show</button>' +
                '<button class="btn btn-gray btn-sm" data-status="Cancelled">Cancelled</button>' +
              '</td>' +
            '</tr>'
          );
        }).join('');

        tbody.querySelectorAll('button[data-status]').forEach(btn => {
          btn.addEventListener('click', async function () {
            const id = this.closest('tr').dataset.id;
            const status = this.dataset.status;
            try {
              const r = await fetch('/api/bookings/' + id, {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                  'x-auth-token': token
                },
                body: JSON.stringify({ status })
              });
              if (r.ok) loadBookings();
            } catch (e) { console.error(e); }
          });
        });
      } catch (err) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty">Failed to load bookings</td></tr>';
      }
    }

    document.getElementById('logoutBtn').addEventListener('click', async () => {
      try {
        await fetch('/api/logout', {
          method: 'POST',
          headers: { 'x-auth-token': token }
        });
      } catch (e) {}
      localStorage.removeItem('ownerToken');
      localStorage.removeItem('ownerUsername');
      window.location.href = '/login';
    });

    loadBookings();
    setInterval(loadBookings, 30000);
  </script>
</body>
</html>`;

// ---------- Routes ----------
app.get('/', (req, res) => res.send(customerPage));
app.get('/login', (req, res) => res.send(loginPage));
app.get('/dashboard', (req, res) => res.send(dashboardPage));

app.listen(PORT, () => {
  console.log('Server running on port ' + PORT);
});
