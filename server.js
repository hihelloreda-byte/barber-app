// Hotel Saskatchewan Barber — single-file Express + PostgreSQL booking app
'use strict';

const express = require('express');
const crypto = require('crypto');
const { Pool } = require('pg');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 10000;

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('localhost')
    ? false
    : { rejectUnauthorized: false }
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS owner (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS bookings (
      id SERIAL PRIMARY KEY,
      service TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      booking_date DATE NOT NULL,
      booking_time TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Booked',
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  const existing = await pool.query('SELECT id FROM owner WHERE username = $1', ['saskbarber']);
  if (existing.rows.length === 0) {
    await pool.query('INSERT INTO owner (username, password) VALUES ($1, $2)', ['saskbarber', 'hotelsask']);
    console.log('Seeded default owner account (saskbarber).');
  }
}

// ---------------------------------------------------------------------------
// In-memory sessions
// ---------------------------------------------------------------------------
const sessions = new Map(); // token -> { username, createdAt }
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

function createSession(username) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { username, createdAt: Date.now() });
  return token;
}

function getSession(token) {
  const s = sessions.get(token);
  if (!s) return null;
  if (Date.now() - s.createdAt > SESSION_TTL_MS) {
    sessions.delete(token);
    return null;
  }
  return s;
}

function requireAuth(req, res, next) {
  const token = req.cookies_token || (req.headers.authorization || '').replace('Bearer ', '');
  const session = getSession(token);
  if (!session) return res.status(401).json({ error: 'Not authenticated' });
  req.session = session;
  next();
}

// crude cookie parser (avoid extra deps)
app.use((req, res, next) => {
  const raw = req.headers.cookie || '';
  const parts = raw.split(';').map(p => p.trim()).filter(Boolean);
  let token = null;
  for (const p of parts) {
    const idx = p.indexOf('=');
    if (idx > -1 && p.slice(0, idx) === 'session') {
      token = decodeURIComponent(p.slice(idx + 1));
    }
  }
  req.cookies_token = token;
  next();
});

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------
const PHONE = '(306) 522-0275';

// ---------------------------------------------------------------------------
// API routes
// ---------------------------------------------------------------------------
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.post('/api/bookings', async (req, res) => {
  try {
    const { service, customer_name, customer_phone, booking_date, booking_time } = req.body;

    if (!service || !customer_name || !customer_phone || !booking_date || !booking_time) {
      return res.status(400).json({ error: 'All fields are required.' });
    }

    const dateObj = new Date(booking_date + 'T00:00:00');
    if (isNaN(dateObj.getTime())) {
      return res.status(400).json({ error: 'Invalid date.' });
    }
    if (dateObj.getUTCDay() === 0) {
      return res.status(400).json({ error: 'We are closed on Sundays. Please pick another day.' });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (dateObj < today) {
      return res.status(400).json({ error: 'Please choose a date today or later.' });
    }

    const result = await pool.query(
      `INSERT INTO bookings (service, customer_name, customer_phone, booking_date, booking_time, status)
       VALUES ($1, $2, $3, $4, $5, 'Booked') RETURNING id`,
      [service, customer_name, customer_phone, booking_date, booking_time]
    );

    res.json({ success: true, id: result.rows[0].id });
  } catch (err) {
    console.error('Booking error:', err);
    res.status(500).json({ error: 'Something went wrong saving your booking. Please call us instead.' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }
    const result = await pool.query('SELECT * FROM owner WHERE username = $1', [username]);
    const user = result.rows[0];
    if (!user || user.password !== password) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }
    const token = createSession(user.username);
    res.setHeader('Set-Cookie', `session=${token}; HttpOnly; Path=/; Max-Age=${SESSION_TTL_MS / 1000}; SameSite=Lax`);
    res.json({ success: true, username: user.username });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

app.post('/api/logout', (req, res) => {
  const token = req.cookies_token;
  if (token) sessions.delete(token);
  res.setHeader('Set-Cookie', 'session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax');
  res.json({ success: true });
});

app.get('/api/me', requireAuth, (req, res) => {
  res.json({ username: req.session.username });
});

app.get('/api/bookings', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, service, customer_name, customer_phone, booking_date, booking_time, status, created_at
       FROM bookings ORDER BY booking_date ASC, booking_time ASC`
    );
    res.json({ bookings: result.rows });
  } catch (err) {
    console.error('Fetch bookings error:', err);
    res.status(500).json({ error: 'Could not load bookings.' });
  }
});

app.patch('/api/bookings/:id/status', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const allowed = ['Booked', 'Arrived', 'No-Show', 'Cancelled'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: 'Invalid status.' });
    }
    await pool.query('UPDATE bookings SET status = $1 WHERE id = $2', [status, id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Update status error:', err);
    res.status(500).json({ error: 'Could not update status.' });
  }
});

// ---------------------------------------------------------------------------
// Shared head (fonts, base styles)
// ---------------------------------------------------------------------------
function baseStyles() {
  return `
    :root {
      --bg: #0a0a0f;
      --bg-2: #12121c;
      --gold: #d4af37;
      --gold-light: #f2d879;
      --blue: #3b6fd6;
      --purple: #7c5cff;
      --text: #f5f3ec;
      --text-dim: #b8b4a8;
      --card-border: rgba(212, 175, 55, 0.18);
      --glass: rgba(255, 255, 255, 0.04);
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    html { scroll-behavior: smooth; }

    body {
      font-family: 'DM Sans', -apple-system, sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      overflow-x: hidden;
      position: relative;
    }

    body::before {
      content: '';
      position: fixed;
      inset: 0;
      background:
        radial-gradient(circle at 15% 20%, rgba(124, 92, 255, 0.14), transparent 45%),
        radial-gradient(circle at 85% 10%, rgba(212, 175, 55, 0.12), transparent 40%),
        radial-gradient(circle at 50% 90%, rgba(59, 111, 214, 0.14), transparent 50%);
      pointer-events: none;
      z-index: 0;
    }

    h1, h2, h3, .font-serif {
      font-family: 'Playfair Display', serif;
    }

    .gradient-text {
      background: linear-gradient(120deg, var(--gold-light), var(--gold) 40%, #b8860b 70%, var(--gold-light));
      background-size: 200% auto;
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
      animation: shine 6s ease-in-out infinite;
    }

    @keyframes shine {
      0%, 100% { background-position: 0% center; }
      50% { background-position: 100% center; }
    }

    a { color: inherit; text-decoration: none; }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 14px 32px;
      border-radius: 100px;
      font-family: 'DM Sans', sans-serif;
      font-weight: 600;
      font-size: 15px;
      letter-spacing: 0.3px;
      border: none;
      cursor: pointer;
      transition: transform 0.35s cubic-bezier(.2,.9,.3,1.3), box-shadow 0.35s ease, filter 0.3s ease;
      position: relative;
    }

    .btn-primary {
      background: linear-gradient(135deg, var(--gold-light), var(--gold) 55%, #b8860b);
      color: #1a1408;
      box-shadow: 0 4px 20px rgba(212, 175, 55, 0.25);
    }

    .btn-primary:hover {
      transform: translateY(-3px) scale(1.03);
      box-shadow: 0 10px 34px rgba(212, 175, 55, 0.45);
      filter: brightness(1.05);
    }

    .btn-outline {
      background: transparent;
      color: var(--text);
      border: 1px solid rgba(245, 243, 236, 0.25);
    }

    .btn-outline:hover {
      transform: translateY(-3px);
      background: rgba(255,255,255,0.06);
      border-color: rgba(245,243,236,0.5);
    }

    .container {
      max-width: 1140px;
      margin: 0 auto;
      padding: 0 24px;
      position: relative;
      z-index: 1;
    }

    ::selection { background: var(--gold); color: #1a1408; }

    .fade-in {
      opacity: 0;
      transform: translateY(24px);
      animation: fadeInUp 0.9s cubic-bezier(.2,.7,.3,1) forwards;
    }

    @keyframes fadeInUp {
      to { opacity: 1; transform: translateY(0); }
    }

    ::-webkit-scrollbar { width: 10px; }
    ::-webkit-scrollbar-track { background: var(--bg); }
    ::-webkit-scrollbar-thumb { background: rgba(212,175,55,0.35); border-radius: 10px; }
    ::-webkit-scrollbar-thumb:hover { background: rgba(212,175,55,0.55); }
  `;
}

function fontsHead() {
  return `<link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@0,500;0,600;0,700;0,800;1,500&display=swap" rel="stylesheet">`;
}

// ---------------------------------------------------------------------------
// Customer-facing site
// ---------------------------------------------------------------------------
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Hotel Saskatchewan Barber — Regina's Trusted Barbershop Since 1927</title>
${fontsHead()}
<style>
${baseStyles()}

/* ---------- Navbar ---------- */
.navbar {
  position: fixed;
  top: 0; left: 0; right: 0;
  z-index: 100;
  padding: 18px 0;
  background: rgba(10, 10, 15, 0.55);
  backdrop-filter: blur(16px) saturate(160%);
  -webkit-backdrop-filter: blur(16px) saturate(160%);
  border-bottom: 1px solid rgba(212,175,55,0.12);
  transition: padding 0.3s ease, background 0.3s ease;
}
.navbar.scrolled { padding: 12px 0; background: rgba(10,10,15,0.85); }
.nav-inner { display: flex; align-items: center; justify-content: space-between; }
.brand { font-family: 'Playfair Display', serif; font-weight: 700; font-size: 20px; }
.brand span { color: var(--gold); }
.nav-links { display: flex; gap: 32px; align-items: center; }
.nav-links a {
  font-size: 14px; font-weight: 500; color: var(--text-dim);
  position: relative; transition: color 0.25s ease;
}
.nav-links a::after {
  content: ''; position: absolute; left: 0; bottom: -6px; width: 0; height: 1px;
  background: var(--gold); transition: width 0.3s ease;
}
.nav-links a:hover { color: var(--text); }
.nav-links a:hover::after { width: 100%; }
.nav-cta { padding: 10px 22px; font-size: 13px; }
.nav-toggle { display: none; background: none; border: none; color: var(--text); font-size: 24px; cursor: pointer; }

/* ---------- Hero ---------- */
.hero {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 140px 24px 80px;
  position: relative;
}
.hero-badge {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 8px 18px; border-radius: 100px;
  background: var(--glass); border: 1px solid var(--card-border);
  font-size: 13px; color: var(--gold-light); margin-bottom: 28px;
  backdrop-filter: blur(6px);
}
.hero h1 {
  font-size: clamp(2.6rem, 6vw, 5rem);
  line-height: 1.08;
  font-weight: 700;
  margin-bottom: 22px;
}
.hero .tagline {
  font-size: clamp(1rem, 2vw, 1.25rem);
  color: var(--text-dim);
  max-width: 560px;
  margin: 0 auto 36px;
  font-weight: 400;
}
.hero-stars { font-size: 20px; color: var(--gold); margin-bottom: 6px; letter-spacing: 3px; }
.hero-rating-text { font-size: 13px; color: var(--text-dim); margin-bottom: 36px; }
.hero-ctas { display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; }

/* ---------- Section shared ---------- */
section { padding: 110px 0; position: relative; }
.section-eyebrow {
  text-align: center; font-size: 13px; letter-spacing: 3px; text-transform: uppercase;
  color: var(--gold); font-weight: 600; margin-bottom: 14px;
}
.section-title { text-align: center; font-size: clamp(2rem, 4vw, 2.8rem); margin-bottom: 60px; }

/* ---------- Services ---------- */
.services-grid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px;
}
.service-card {
  background: linear-gradient(160deg, rgba(255,255,255,0.045), rgba(255,255,255,0.015));
  border: 1px solid var(--card-border);
  border-radius: 20px;
  padding: 40px 32px;
  text-align: center;
  backdrop-filter: blur(10px);
  transition: transform 0.45s cubic-bezier(.2,.8,.3,1.1), box-shadow 0.45s ease, border-color 0.4s ease;
  cursor: pointer;
  display: flex; flex-direction: column; align-items: center;
}
.service-card:hover {
  transform: translateY(-10px);
  box-shadow: 0 24px 48px rgba(0,0,0,0.4), 0 0 0 1px rgba(212,175,55,0.25);
  border-color: rgba(212,175,55,0.4);
}
.service-icon {
  font-size: 40px; margin-bottom: 20px;
  filter: drop-shadow(0 4px 12px rgba(212,175,55,0.3));
}
.service-card h3 { font-size: 1.4rem; margin-bottom: 10px; }
.service-price {
  font-size: 14px; color: var(--text-dim); margin-bottom: 8px;
  min-height: 42px; display: flex; align-items: center; justify-content: center;
  transition: all 0.4s ease;
}
.service-price.revealed { color: var(--gold-light); font-weight: 600; font-size: 15px; }
.reveal-hint { font-size: 12px; color: rgba(245,243,236,0.4); margin-bottom: 22px; }
.service-card .btn { width: 100%; margin-top: 8px; }

/* ---------- Reviews ---------- */
.reviews-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 28px; }
.review-card {
  background: var(--glass);
  border: 1px solid var(--card-border);
  border-radius: 20px;
  padding: 36px;
  backdrop-filter: blur(10px);
  transition: transform 0.4s ease, box-shadow 0.4s ease;
}
.review-card:hover { transform: translateY(-6px); box-shadow: 0 20px 40px rgba(0,0,0,0.35); }
.review-stars { color: var(--gold); font-size: 16px; margin-bottom: 16px; letter-spacing: 2px; }
.review-text { font-size: 15px; line-height: 1.75; color: var(--text-dim); margin-bottom: 20px; font-style: italic; }
.review-author { font-size: 14px; font-weight: 600; color: var(--gold-light); }

/* ---------- Booking ---------- */
.booking-wrap {
  max-width: 640px; margin: 0 auto;
  background: linear-gradient(160deg, rgba(255,255,255,0.05), rgba(255,255,255,0.015));
  border: 1px solid var(--card-border);
  border-radius: 24px;
  padding: 48px;
  backdrop-filter: blur(14px);
  box-shadow: 0 30px 70px rgba(0,0,0,0.35);
}
.service-select { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 26px; }
.service-option {
  padding: 16px 10px; text-align: center; border-radius: 12px;
  border: 1px solid rgba(245,243,236,0.15);
  background: rgba(255,255,255,0.03);
  cursor: pointer; font-size: 13.5px; font-weight: 600;
  transition: all 0.3s cubic-bezier(.2,.8,.3,1.1);
}
.service-option:hover { border-color: rgba(212,175,55,0.4); transform: translateY(-2px); }
.service-option.selected {
  background: linear-gradient(135deg, var(--blue), #2a52a8);
  border-color: var(--blue);
  color: #fff;
  transform: translateY(-2px) scale(1.02);
  box-shadow: 0 10px 26px rgba(59,111,214,0.4);
}
.form-group { margin-bottom: 20px; }
.form-group label {
  display: block; font-size: 13px; color: var(--text-dim); margin-bottom: 8px; font-weight: 500;
}
.form-group input, .form-group select {
  width: 100%; padding: 14px 16px; border-radius: 12px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(245,243,236,0.15);
  color: var(--text); font-size: 14.5px; font-family: 'DM Sans', sans-serif;
  transition: border-color 0.3s ease, background 0.3s ease, box-shadow 0.3s ease;
}
.form-group input::placeholder { color: rgba(245,243,236,0.35); }
.form-group input:focus, .form-group select:focus {
  outline: none; border-color: var(--gold);
  background: rgba(255,255,255,0.06);
  box-shadow: 0 0 0 3px rgba(212,175,55,0.15);
}
.form-group select:disabled { opacity: 0.4; cursor: not-allowed; }
.form-group input[type="date"] { color-scheme: dark; }
#book-submit { width: 100%; padding: 16px; font-size: 15px; margin-top: 8px; }
.form-message {
  margin-top: 18px; padding: 14px 16px; border-radius: 12px; font-size: 14px; text-align: center;
  opacity: 0; max-height: 0; overflow: hidden;
  transition: opacity 0.4s ease, max-height 0.4s ease, padding 0.4s ease, margin 0.4s ease;
}
.form-message.show { opacity: 1; max-height: 100px; margin-top: 18px; padding: 14px 16px; }
.form-message.success { background: rgba(74, 222, 128, 0.12); border: 1px solid rgba(74,222,128,0.3); color: #86efac; }
.form-message.error { background: rgba(248, 113, 113, 0.12); border: 1px solid rgba(248,113,113,0.3); color: #fca5a5; }

/* ---------- Footer ---------- */
footer {
  padding: 60px 0 40px; border-top: 1px solid rgba(212,175,55,0.12);
  text-align: center;
}
.footer-brand { font-family: 'Playfair Display', serif; font-size: 22px; margin-bottom: 16px; }
.footer-brand span { color: var(--gold); }
.footer-info { color: var(--text-dim); font-size: 14px; line-height: 1.9; margin-bottom: 18px; }
.footer-note { color: rgba(245,243,236,0.35); font-size: 12.5px; }
.footer-login-link { display: inline-block; margin-top: 20px; font-size: 12px; color: rgba(245,243,236,0.3); transition: color 0.3s ease; }
.footer-login-link:hover { color: var(--gold-light); }

@media (max-width: 860px) {
  .services-grid, .reviews-grid { grid-template-columns: 1fr; }
  .service-select { grid-template-columns: 1fr; }
  .nav-links { display: none; }
  .booking-wrap { padding: 32px 24px; }
  section { padding: 80px 0; }
}
</style>
</head>
<body>

<nav class="navbar" id="navbar">
  <div class="container nav-inner">
    <div class="brand">Hotel Saskatchewan <span>Barber</span></div>
    <div class="nav-links">
      <a href="#home">Home</a>
      <a href="#services">Services</a>
      <a href="#reviews">Reviews</a>
      <a href="#book" class="btn btn-primary nav-cta">Book Now</a>
    </div>
  </div>
</nav>

<section class="hero" id="home">
  <div class="container">
    <div class="hero-badge fade-in">✦ Trusted since 1927</div>
    <h1 class="fade-in" style="animation-delay:0.1s">Hotel Saskatchewan <span class="gradient-text">Barber</span></h1>
    <p class="tagline fade-in" style="animation-delay:0.2s">Quality you deserve, prices you'll love, and a name you can trust.</p>
    <div class="fade-in" style="animation-delay:0.3s">
      <div class="hero-stars">★★★★☆</div>
      <div class="hero-rating-text">4.5 stars from 50+ reviews</div>
    </div>
    <div class="hero-ctas fade-in" style="animation-delay:0.4s">
      <a href="#book" class="btn btn-primary">Book an Appointment</a>
      <a href="#services" class="btn btn-outline">View Services</a>
    </div>
  </div>
</section>

<section id="services">
  <div class="container">
    <div class="section-eyebrow fade-in">What We Offer</div>
    <h2 class="section-title fade-in">Our <span class="gradient-text">Services</span></h2>
    <div class="services-grid">
      <div class="service-card fade-in" data-phone="${PHONE}">
        <div class="service-icon">✂️</div>
        <h3>Haircut</h3>
        <div class="service-price">Call for pricing</div>
        <div class="reveal-hint">tap card to reveal phone</div>
        <a href="#book" class="btn btn-primary" onclick="event.stopPropagation()">Book Now</a>
      </div>
      <div class="service-card fade-in" style="animation-delay:0.1s" data-phone="${PHONE}">
        <div class="service-icon">🧔</div>
        <h3>Beard Sculpting</h3>
        <div class="service-price">Call for pricing</div>
        <div class="reveal-hint">tap card to reveal phone</div>
        <a href="#book" class="btn btn-primary" onclick="event.stopPropagation()">Book Now</a>
      </div>
      <div class="service-card fade-in" style="animation-delay:0.2s" data-phone="${PHONE}">
        <div class="service-icon">🪒</div>
        <h3>Hot Towel Shave</h3>
        <div class="service-price">Call for pricing</div>
        <div class="reveal-hint">tap card to reveal phone</div>
        <a href="#book" class="btn btn-primary" onclick="event.stopPropagation()">Book Now</a>
      </div>
    </div>
  </div>
</section>

<section id="reviews">
  <div class="container">
    <div class="section-eyebrow fade-in">Testimonials</div>
    <h2 class="section-title fade-in">What Our <span class="gradient-text">Clients Say</span></h2>
    <div class="reviews-grid">
      <div class="review-card fade-in">
        <div class="review-stars">★★★★★</div>
        <p class="review-text">"I have been going to this barber shop for a little over 5 years now (I'm talking consistently, every 3-4 weeks). Service exceptional, appointments are always kept and on time. Truly a prodigious place to venture and cannot recommend it enough! I have always walked out feeling fresh, fly, and dapper!"</p>
        <div class="review-author">— Long-time Client</div>
      </div>
      <div class="review-card fade-in" style="animation-delay:0.1s">
        <div class="review-stars">★★★★★</div>
        <p class="review-text">"Roy is a phenomenal, polite and professional barber with a definite respect for the old-school class a traditional barber shop should present. You make an appointment and receive the exact service you expect. Highly recommend for both his skill and the barbershop experience."</p>
        <div class="review-author">— Satisfied Customer</div>
      </div>
    </div>
  </div>
</section>

<section id="book">
  <div class="container">
    <div class="section-eyebrow fade-in">Reserve Your Spot</div>
    <h2 class="section-title fade-in">Book an <span class="gradient-text">Appointment</span></h2>

    <div class="booking-wrap fade-in">
      <div class="form-group">
        <label>Select a Service</label>
        <div class="service-select">
          <div class="service-option" data-service="Haircut">Haircut</div>
          <div class="service-option" data-service="Beard Sculpting">Beard Sculpting</div>
          <div class="service-option" data-service="Hot Towel Shave">Hot Towel Shave</div>
        </div>
      </div>

      <div class="form-group">
        <label for="cust-name">Full Name</label>
        <input type="text" id="cust-name" placeholder="John Smith" autocomplete="name">
      </div>

      <div class="form-group">
        <label for="cust-phone">Phone Number</label>
        <input type="tel" id="cust-phone" placeholder="(306) 555-0123" autocomplete="tel">
      </div>

      <div class="form-group">
        <label for="book-date">Date</label>
        <input type="date" id="book-date">
      </div>

      <div class="form-group">
        <label for="book-time">Time</label>
        <select id="book-time" disabled>
          <option value="">Select a date first</option>
        </select>
      </div>

      <button class="btn btn-primary" id="book-submit">Confirm Booking</button>
      <div class="form-message" id="form-message"></div>
    </div>
  </div>
</section>

<footer>
  <div class="container">
    <div class="footer-brand">Hotel Saskatchewan <span>Barber</span></div>
    <div class="footer-info">
      Hotel Saskatchewan, Regina<br>
      ${PHONE}<br>
      Mon–Sat 9:30 AM – 5:00 PM
    </div>
    <div class="footer-note">Closed Sundays • Holiday hours may differ</div>
    <a href="/login" class="footer-login-link">Owner Login</a>
  </div>
</footer>

<script>
// Navbar shrink on scroll
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 20);
});

// Reveal phone number on service card click
document.querySelectorAll('.service-card').forEach(card => {
  card.addEventListener('click', () => {
    const priceEl = card.querySelector('.service-price');
    const hint = card.querySelector('.reveal-hint');
    if (!priceEl.classList.contains('revealed')) {
      priceEl.textContent = card.dataset.phone;
      priceEl.classList.add('revealed');
      hint.style.opacity = '0';
    }
  });
});

// Service selection in booking form
const serviceOptions = document.querySelectorAll('.service-option');
let selectedService = null;
serviceOptions.forEach(opt => {
  opt.addEventListener('click', () => {
    serviceOptions.forEach(o => o.classList.remove('selected'));
    opt.classList.add('selected');
    selectedService = opt.dataset.service;
  });
});

// Time slots 9:30 AM - 4:30 PM, 30 min increments
function buildTimeSlots() {
  const slots = [];
  let h = 9, m = 30;
  while (h < 16 || (h === 16 && m <= 30)) {
    const hour12 = h > 12 ? h - 12 : h;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const mm = m === 0 ? '00' : '30';
    slots.push(\`\${hour12}:\${mm} \${ampm}\`);
    m += 30;
    if (m >= 60) { m = 0; h += 1; }
  }
  return slots;
}
const TIME_SLOTS = buildTimeSlots();

const dateInput = document.getElementById('book-date');
const timeSelect = document.getElementById('book-time');

const today = new Date();
today.setHours(0,0,0,0);
const yyyy = today.getFullYear();
const mm = String(today.getMonth() + 1).padStart(2, '0');
const dd = String(today.getDate()).padStart(2, '0');
dateInput.min = \`\${yyyy}-\${mm}-\${dd}\`;

dateInput.addEventListener('change', () => {
  if (!dateInput.value) return;
  const parts = dateInput.value.split('-').map(Number);
  const chosen = new Date(parts[0], parts[1] - 1, parts[2]);
  if (chosen.getDay() === 0) {
    alert('We are closed on Sundays. Please choose another day.');
    dateInput.value = '';
    timeSelect.disabled = true;
    timeSelect.innerHTML = '<option value="">Select a date first</option>';
    return;
  }
  timeSelect.disabled = false;
  timeSelect.innerHTML = '<option value="">Select a time</option>' +
    TIME_SLOTS.map(t => \`<option value="\${t}">\${t}</option>\`).join('');
});

// Submit booking
const messageEl = document.getElementById('form-message');
function showMessage(text, type) {
  messageEl.textContent = text;
  messageEl.className = 'form-message show ' + type;
  setTimeout(() => { messageEl.classList.remove('show'); }, 6000);
}

document.getElementById('book-submit').addEventListener('click', async () => {
  const name = document.getElementById('cust-name').value.trim();
  const phone = document.getElementById('cust-phone').value.trim();
  const date = dateInput.value;
  const time = timeSelect.value;

  if (!selectedService) return showMessage('Please select a service.', 'error');
  if (!name) return showMessage('Please enter your name.', 'error');
  if (!phone) return showMessage('Please enter your phone number.', 'error');
  if (!date) return showMessage('Please select a date.', 'error');
  if (!time) return showMessage('Please select a time.', 'error');

  const btn = document.getElementById('book-submit');
  btn.disabled = true;
  btn.textContent = 'Booking...';

  try {
    const res = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service: selectedService,
        customer_name: name,
        customer_phone: phone,
        booking_date: date,
        booking_time: time
      })
    });
    const data = await res.json();
    if (res.ok) {
      showMessage('You\\'re booked! We look forward to seeing you.', 'success');
      document.getElementById('cust-name').value = '';
      document.getElementById('cust-phone').value = '';
      dateInput.value = '';
      timeSelect.disabled = true;
      timeSelect.innerHTML = '<option value="">Select a date first</option>';
      serviceOptions.forEach(o => o.classList.remove('selected'));
      selectedService = null;
    } else {
      showMessage(data.error || 'Something went wrong. Please try again.', 'error');
    }
  } catch (err) {
    showMessage('Network error. Please call us at ${PHONE}.', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Confirm Booking';
  }
});

// Fade-in on scroll for elements below the fold
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.animationPlayState = 'running';
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.1 });
document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));
</script>

</body>
</html>`);
});

// ---------------------------------------------------------------------------
// Login page
// ---------------------------------------------------------------------------
app.get('/login', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Owner Login — Hotel Saskatchewan Barber</title>
${fontsHead()}
<style>
${baseStyles()}
body { display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 24px; }
.login-card {
  width: 100%; max-width: 420px;
  background: linear-gradient(160deg, rgba(255,255,255,0.05), rgba(255,255,255,0.015));
  border: 1px solid var(--card-border);
  border-radius: 24px;
  padding: 48px 40px;
  backdrop-filter: blur(14px);
  box-shadow: 0 30px 70px rgba(0,0,0,0.4);
  position: relative; z-index: 1;
}
.login-brand { text-align: center; font-family: 'Playfair Display', serif; font-size: 22px; margin-bottom: 6px; }
.login-brand span { color: var(--gold); }
.login-sub { text-align: center; font-size: 13px; color: var(--text-dim); margin-bottom: 34px; }
.form-group { margin-bottom: 20px; }
.form-group label { display: block; font-size: 13px; color: var(--text-dim); margin-bottom: 8px; font-weight: 500; }
.form-group input {
  width: 100%; padding: 14px 16px; border-radius: 12px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(245,243,236,0.15);
  color: var(--text); font-size: 14.5px; font-family: 'DM Sans', sans-serif;
  transition: border-color 0.3s ease, background 0.3s ease, box-shadow 0.3s ease;
}
.form-group input:focus {
  outline: none; border-color: var(--gold);
  background: rgba(255,255,255,0.06);
  box-shadow: 0 0 0 3px rgba(212,175,55,0.15);
}
#login-btn { width: 100%; padding: 15px; font-size: 15px; margin-top: 6px; }
.form-message {
  margin-top: 16px; padding: 12px 14px; border-radius: 12px; font-size: 13.5px; text-align: center;
  opacity: 0; max-height: 0; overflow: hidden;
  transition: opacity 0.4s ease, max-height 0.4s ease;
}
.form-message.show { opacity: 1; max-height: 100px; }
.form-message.error { background: rgba(248, 113, 113, 0.12); border: 1px solid rgba(248,113,113,0.3); color: #fca5a5; }
.back-link { display: block; text-align: center; margin-top: 24px; font-size: 12.5px; color: rgba(245,243,236,0.4); transition: color 0.3s ease; }
.back-link:hover { color: var(--gold-light); }
</style>
</head>
<body>

<div class="login-card fade-in">
  <div class="login-brand">Hotel Saskatchewan <span>Barber</span></div>
  <div class="login-sub">Owner Login</div>

  <div class="form-group">
    <label for="username">Username</label>
    <input type="text" id="username" placeholder="Enter username" autocomplete="username">
  </div>
  <div class="form-group">
    <label for="password">Password</label>
    <input type="password" id="password" placeholder="Enter password" autocomplete="current-password">
  </div>
  <button class="btn btn-primary" id="login-btn">Log In</button>
  <div class="form-message" id="form-message"></div>
  <a href="/" class="back-link">← Back to site</a>
</div>

<script>
const messageEl = document.getElementById('form-message');
function showError(text) {
  messageEl.textContent = text;
  messageEl.className = 'form-message show error';
}

async function doLogin() {
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  if (!username || !password) return showError('Please enter both fields.');

  const btn = document.getElementById('login-btn');
  btn.disabled = true;
  btn.textContent = 'Logging in...';

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (res.ok) {
      window.location.href = '/dashboard';
    } else {
      showError(data.error || 'Login failed.');
    }
  } catch (err) {
    showError('Network error. Please try again.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Log In';
  }
}

document.getElementById('login-btn').addEventListener('click', doLogin);
document.getElementById('password').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
document.getElementById('username').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
</script>

</body>
</html>`);
});

// ---------------------------------------------------------------------------
// Dashboard (owner)
// ---------------------------------------------------------------------------
app.get('/dashboard', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Dashboard — Hotel Saskatchewan Barber</title>
${fontsHead()}
<style>
${baseStyles()}
.dash-nav {
  padding: 20px 0;
  background: rgba(10,10,15,0.85);
  backdrop-filter: blur(16px);
  border-bottom: 1px solid rgba(212,175,55,0.12);
  position: sticky; top: 0; z-index: 50;
}
.dash-nav-inner { display: flex; align-items: center; justify-content: space-between; }
.dash-brand { font-family: 'Playfair Display', serif; font-size: 19px; }
.dash-brand span { color: var(--gold); }
.dash-user { display: flex; align-items: center; gap: 18px; font-size: 13.5px; color: var(--text-dim); }
.dash-user strong { color: var(--gold-light); }
#logout-btn { padding: 9px 20px; font-size: 13px; }

.dash-main { padding: 48px 0 80px; }
.dash-title { font-size: 1.9rem; margin-bottom: 8px; }
.dash-sub { color: var(--text-dim); font-size: 14px; margin-bottom: 36px; }

.table-wrap {
  background: linear-gradient(160deg, rgba(255,255,255,0.045), rgba(255,255,255,0.015));
  border: 1px solid var(--card-border);
  border-radius: 20px;
  overflow: hidden;
  backdrop-filter: blur(10px);
}
table { width: 100%; border-collapse: collapse; font-size: 14px; }
thead th {
  text-align: left; padding: 16px 20px; font-size: 12px; letter-spacing: 1px; text-transform: uppercase;
  color: var(--gold-light); background: rgba(212,175,55,0.06); font-weight: 600;
  border-bottom: 1px solid var(--card-border);
}
tbody td { padding: 16px 20px; border-bottom: 1px solid rgba(255,255,255,0.05); color: var(--text); }
tbody tr { transition: background 0.25s ease; }
tbody tr:hover { background: rgba(255,255,255,0.03); }
tbody tr:last-child td { border-bottom: none; }

.status-badge {
  display: inline-block; padding: 5px 12px; border-radius: 100px; font-size: 12px; font-weight: 600;
}
.status-Booked { background: rgba(59,111,214,0.15); color: #8fb4f0; }
.status-Arrived { background: rgba(74,222,128,0.15); color: #86efac; }
.status-No-Show { background: rgba(248,113,113,0.15); color: #fca5a5; }
.status-Cancelled { background: rgba(160,160,160,0.15); color: #c4c4c4; }

.status-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.status-btn {
  padding: 7px 14px; border-radius: 8px; font-size: 12px; font-weight: 600; border: none; cursor: pointer;
  transition: transform 0.25s ease, filter 0.25s ease, box-shadow 0.25s ease; color: #0a0a0f;
}
.status-btn:hover { transform: translateY(-2px); filter: brightness(1.1); }
.status-btn.arrived { background: #4ade80; }
.status-btn.noshow { background: #f87171; }
.status-btn.cancelled { background: #a0a0a0; }

.empty-state { text-align: center; padding: 60px 20px; color: var(--text-dim); font-size: 14px; }
.loading-state { text-align: center; padding: 60px 20px; color: var(--text-dim); font-size: 14px; }

@media (max-width: 860px) {
  .table-wrap { overflow-x: auto; }
  table { min-width: 780px; }
}
</style>
</head>
<body>

<nav class="dash-nav">
  <div class="container dash-nav-inner">
    <div class="dash-brand">Hotel Saskatchewan <span>Barber</span></div>
    <div class="dash-user">
      <span>Logged in as <strong id="username-display">…</strong></span>
      <button class="btn btn-outline" id="logout-btn">Log Out</button>
    </div>
  </div>
</nav>

<main class="dash-main">
  <div class="container">
    <h2 class="dash-title">Booking <span class="gradient-text">Dashboard</span></h2>
    <p class="dash-sub">All upcoming and past appointments, sorted by date.</p>

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
          </tr>
        </thead>
        <tbody id="bookings-body">
          <tr><td colspan="6"><div class="loading-state">Loading bookings…</div></td></tr>
        </tbody>
      </table>
    </div>
  </div>
</main>

<script>
async function checkAuth() {
  const res = await fetch('/api/me');
  if (!res.ok) {
    window.location.href = '/login';
    return null;
  }
  const data = await res.json();
  document.getElementById('username-display').textContent = data.username;
  return data;
}

function fmtDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });
}

function statusClass(status) {
  return 'status-' + status.replace(/\\s+/g, '-');
}

async function loadBookings() {
  const tbody = document.getElementById('bookings-body');
  try {
    const res = await fetch('/api/bookings');
    if (!res.ok) {
      if (res.status === 401) { window.location.href = '/login'; return; }
      throw new Error('Failed to load');
    }
    const data = await res.json();
    if (!data.bookings.length) {
      tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state">No bookings yet.</div></td></tr>';
      return;
    }
    tbody.innerHTML = data.bookings.map(b => \`
      <tr data-id="\${b.id}">
        <td>\${b.service}</td>
        <td>\${b.customer_name}</td>
        <td>\${b.customer_phone}</td>
        <td>\${fmtDate(b.booking_date)}</td>
        <td>\${b.booking_time}</td>
        <td>
          <div class="status-badge \${statusClass(b.status)}" style="margin-bottom:8px;">\${b.status}</div>
          <div class="status-actions">
            <button class="status-btn arrived" data-status="Arrived">Arrived</button>
            <button class="status-btn noshow" data-status="No-Show">No-Show</button>
            <button class="status-btn cancelled" data-status="Cancelled">Cancelled</button>
          </div>
        </td>
      </tr>
    \`).join('');

    document.querySelectorAll('.status-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const row = e.target.closest('tr');
        const id = row.dataset.id;
        const status = e.target.dataset.status;
        btn.disabled = true;
        try {
          const res = await fetch(\`/api/bookings/\${id}/status\`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
          });
          if (res.ok) {
            loadBookings();
          }
        } finally {
          btn.disabled = false;
        }
      });
    });
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state">Could not load bookings. Please refresh.</div></td></tr>';
  }
}

document.getElementById('logout-btn').addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST' });
  window.location.href = '/login';
});

(async () => {
  const user = await checkAuth();
  if (user) loadBookings();
})();
</script>

</body>
</html>`);
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Hotel Saskatchewan Barber running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
