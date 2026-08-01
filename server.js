const express = require('express');
const { Pool } = require('pg');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 10000;

// PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('localhost')
    ? false
    : { rejectUnauthorized: false }
});

// In-memory sessions
const sessions = new Map();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Cookie helper
function parseCookies(req) {
  const header = req.headers.cookie || '';
  const cookies = {};
  header.split(';').forEach(c => {
    const [k, v] = c.trim().split('=');
    if (k) cookies[k] = v;
  });
  return cookies;
}

function setCookie(res, name, value, maxAge = 86400000) {
  res.setHeader('Set-Cookie', `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(maxAge / 1000)}`);
}

function clearCookie(res, name) {
  res.setHeader('Set-Cookie', `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

function requireAuth(req, res, next) {
  const cookies = parseCookies(req);
  const sid = cookies.session;
  if (sid && sessions.has(sid)) {
    req.user = sessions.get(sid);
    return next();
  }
  return res.redirect('/login');
}

// Initialize DB
async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS owner (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS bookings (
        id SERIAL PRIMARY KEY,
        service VARCHAR(100) NOT NULL,
        customer_name VARCHAR(255) NOT NULL,
        customer_phone VARCHAR(50) NOT NULL,
        booking_date DATE NOT NULL,
        booking_time VARCHAR(20) NOT NULL,
        status VARCHAR(50) DEFAULT 'Pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    // Seed owner if not exists (username stored in email column)
    const check = await client.query('SELECT id FROM owner WHERE email = $1', ['saskbarber']);
    if (check.rows.length === 0) {
      await client.query(
        'INSERT INTO owner (email, password) VALUES ($1, $2)',
        ['saskbarber', 'hotelsask']
      );
      console.log('Owner seeded: saskbarber');
    }
    console.log('Database initialized');
  } finally {
    client.release();
  }
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ========== CUSTOMER SITE ==========
app.get('/', (req, res) => {
  res.send(getCustomerHTML());
});

// Booking API
app.post('/api/book', async (req, res) => {
  try {
    const { service, name, phone, date, time } = req.body;
    if (!service || !name || !phone || !date || !time) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    // Block Sundays
    const d = new Date(date + 'T12:00:00');
    if (d.getDay() === 0) {
      return res.status(400).json({ error: 'We are closed on Sundays. Please choose another day.' });
    }
    await pool.query(
      `INSERT INTO bookings (service, customer_name, customer_phone, booking_date, booking_time, status)
       VALUES ($1, $2, $3, $4, $5, 'Pending')`,
      [service, name.trim(), phone.trim(), date, time]
    );
    res.json({ success: true, message: 'Booking confirmed! We look forward to seeing you.' });
  } catch (err) {
    console.error('Booking error:', err);
    res.status(500).json({ error: 'Unable to save booking. Please try again or call us.' });
  }
});

// ========== OWNER AUTH ==========
app.get('/login', (req, res) => {
  const cookies = parseCookies(req);
  if (cookies.session && sessions.has(cookies.session)) {
    return res.redirect('/dashboard');
  }
  res.send(getLoginHTML());
});

app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const result = await pool.query(
      'SELECT * FROM owner WHERE email = $1 AND password = $2',
      [username, password]
    );
    if (result.rows.length === 0) {
      return res.send(getLoginHTML('Invalid username or password'));
    }
    const sid = crypto.randomBytes(32).toString('hex');
    sessions.set(sid, { username: result.rows[0].email, id: result.rows[0].id });
    setCookie(res, 'session', sid);
    res.redirect('/dashboard');
  } catch (err) {
    console.error('Login error:', err);
    res.send(getLoginHTML('Server error. Please try again.'));
  }
});

app.get('/logout', (req, res) => {
  const cookies = parseCookies(req);
  if (cookies.session) sessions.delete(cookies.session);
  clearCookie(res, 'session');
  res.redirect('/login');
});

// ========== DASHBOARD ==========
app.get('/dashboard', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM bookings ORDER BY booking_date DESC, booking_time DESC'
    );
    res.send(getDashboardHTML(req.user.username, result.rows));
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).send('Error loading dashboard');
  }
});

app.post('/api/booking/:id/status', requireAuth, async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['Arrived', 'No-Show', 'Cancelled', 'Pending'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    await pool.query('UPDATE bookings SET status = $1 WHERE id = $2', [status, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Status update error:', err);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// ========== HTML GENERATORS ==========
function getCustomerHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">
  <title>Hotel Saskatchewan Barber | Regina</title>
  <meta name="description" content="Quality you deserve, prices you'll love. Traditional barbershop at Hotel Saskatchewan, Regina. Est. 1927.">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #faf8f5;
      --bg-card: #ffffff;
      --text: #1a1a1a;
      --text-muted: #5c5c5c;
      --accent: #8b6914;
      --accent-dark: #6b5010;
      --accent-light: #c9a227;
      --border: #e8e2d9;
      --shadow: 0 4px 20px rgba(26, 26, 26, 0.08);
      --shadow-hover: 0 8px 30px rgba(26, 26, 26, 0.12);
      --radius: 12px;
      --nav-h: 64px;
      --success: #2d6a4f;
      --error: #9b2226;
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { scroll-behavior: smooth; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
      font-size: 16px;
      -webkit-font-smoothing: antialiased;
    }
    h1, h2, h3 { font-family: 'Playfair Display', Georgia, serif; font-weight: 600; line-height: 1.25; }
    a { color: inherit; text-decoration: none; }
    img { max-width: 100%; }

    /* NAV */
    .nav {
      position: sticky; top: 0; z-index: 1000;
      background: rgba(250, 248, 245, 0.95);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--border);
      height: var(--nav-h);
    }
    .nav-inner {
      max-width: 1200px; margin: 0 auto;
      padding: 0 20px; height: 100%;
      display: flex; align-items: center; justify-content: space-between;
    }
    .nav-logo {
      font-family: 'Playfair Display', serif;
      font-size: 1.15rem; font-weight: 700;
      color: var(--text); letter-spacing: -0.02em;
    }
    .nav-logo span { color: var(--accent); }
    .nav-links {
      display: flex; align-items: center; gap: 8px; list-style: none;
    }
    .nav-links a {
      padding: 10px 16px; border-radius: 8px;
      font-size: 0.9rem; font-weight: 500; color: var(--text-muted);
      transition: color 0.2s, background 0.2s; min-height: 44px;
      display: inline-flex; align-items: center;
    }
    .nav-links a:hover { color: var(--text); background: rgba(139, 105, 20, 0.08); }
    .nav-links a.cta {
      background: var(--accent); color: #fff; font-weight: 600;
    }
    .nav-links a.cta:hover { background: var(--accent-dark); color: #fff; }
    .hamburger {
      display: none; background: none; border: none; cursor: pointer;
      padding: 10px; min-width: 44px; min-height: 44px;
      flex-direction: column; justify-content: center; gap: 5px;
    }
    .hamburger span {
      display: block; width: 22px; height: 2px;
      background: var(--text); border-radius: 2px;
      transition: transform 0.25s, opacity 0.25s;
    }
    .hamburger.open span:nth-child(1) { transform: translateY(7px) rotate(45deg); }
    .hamburger.open span:nth-child(2) { opacity: 0; }
    .hamburger.open span:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }

    /* HERO */
    .hero {
      max-width: 1200px; margin: 0 auto;
      padding: 48px 20px 56px;
      text-align: center;
    }
    .hero-badge {
      display: inline-flex; align-items: center; gap: 8px;
      background: rgba(139, 105, 20, 0.1);
      color: var(--accent-dark);
      padding: 6px 14px; border-radius: 100px;
      font-size: 0.8rem; font-weight: 600; letter-spacing: 0.04em;
      text-transform: uppercase; margin-bottom: 20px;
    }
    .hero h1 {
      font-size: clamp(2rem, 5vw, 3.25rem);
      margin-bottom: 12px; color: var(--text);
    }
    .hero-tagline {
      font-size: clamp(1rem, 2.5vw, 1.2rem);
      color: var(--text-muted); max-width: 520px;
      margin: 0 auto 20px; font-weight: 400;
    }
    .hero-meta {
      display: flex; flex-wrap: wrap; justify-content: center;
      align-items: center; gap: 16px 24px;
      font-size: 0.95rem; color: var(--text-muted);
    }
    .stars { color: var(--accent-light); letter-spacing: 2px; font-size: 1.1rem; }
    .rating-text { font-weight: 600; color: var(--text); }

    /* SECTIONS */
    section { padding: 48px 20px; }
    .section-inner { max-width: 1200px; margin: 0 auto; }
    .section-title {
      text-align: center; font-size: clamp(1.6rem, 3.5vw, 2.25rem);
      margin-bottom: 8px;
    }
    .section-sub {
      text-align: center; color: var(--text-muted);
      margin-bottom: 36px; font-size: 1rem;
    }

    /* SERVICES */
    .services-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 20px;
    }
    .service-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 28px 24px;
      box-shadow: var(--shadow);
      transition: transform 0.25s, box-shadow 0.25s;
      display: flex; flex-direction: column; align-items: center;
      text-align: center;
    }
    .service-card:hover {
      transform: translateY(-4px);
      box-shadow: var(--shadow-hover);
    }
    .service-icon {
      font-size: 2.5rem; margin-bottom: 14px;
      line-height: 1;
    }
    .service-card h3 {
      font-size: 1.25rem; margin-bottom: 8px;
    }
    .service-price {
      color: var(--text-muted); font-size: 0.95rem;
      margin-bottom: 16px; min-height: 24px;
    }
    .service-price a {
      color: var(--accent); font-weight: 600;
      border-bottom: 1px solid transparent;
      transition: border-color 0.2s;
    }
    .service-price a:hover { border-bottom-color: var(--accent); }
    .btn {
      display: inline-flex; align-items: center; justify-content: center;
      padding: 12px 24px; min-height: 48px;
      border-radius: 8px; font-size: 0.95rem; font-weight: 600;
      border: none; cursor: pointer;
      transition: background 0.2s, transform 0.15s, box-shadow 0.2s;
      font-family: inherit;
    }
    .btn-primary {
      background: var(--accent); color: #fff;
    }
    .btn-primary:hover {
      background: var(--accent-dark);
      transform: translateY(-1px);
    }
    .btn-outline {
      background: transparent; color: var(--accent);
      border: 1.5px solid var(--accent);
    }
    .btn-outline:hover {
      background: rgba(139, 105, 20, 0.08);
    }
    .btn-reveal {
      background: transparent; color: var(--accent);
      border: 1.5px solid var(--border);
      font-size: 0.9rem; padding: 8px 16px; min-height: 40px;
    }
    .btn-reveal:hover { border-color: var(--accent); }

    /* TESTIMONIALS */
    .testimonials-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 20px;
    }
    .testimonial-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 28px 24px;
      box-shadow: var(--shadow);
    }
    .testimonial-card p {
      font-size: 0.98rem; color: var(--text);
      margin-bottom: 16px; font-style: italic;
      line-height: 1.7;
    }
    .testimonial-author {
      font-weight: 600; font-size: 0.9rem;
      color: var(--accent-dark);
    }
    .testimonial-author span {
      display: block; font-weight: 400;
      color: var(--text-muted); font-size: 0.85rem;
      margin-top: 2px; font-style: normal;
    }

    /* BOOKING */
    .booking-section {
      background: linear-gradient(180deg, var(--bg) 0%, #f0ebe3 100%);
    }
    .booking-form {
      max-width: 520px; margin: 0 auto;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 32px 24px;
      box-shadow: var(--shadow);
    }
    .form-group { margin-bottom: 20px; }
    .form-group label {
      display: block; font-size: 0.85rem; font-weight: 600;
      color: var(--text); margin-bottom: 8px;
      letter-spacing: 0.02em;
    }
    .service-options {
      display: grid; grid-template-columns: 1fr;
      gap: 10px;
    }
    .service-opt {
      display: flex; align-items: center; gap: 12px;
      padding: 14px 16px; min-height: 52px;
      border: 1.5px solid var(--border);
      border-radius: 8px; cursor: pointer;
      transition: border-color 0.2s, background 0.2s;
      background: #fff; font-size: 0.95rem; font-weight: 500;
    }
    .service-opt:hover { border-color: var(--accent-light); }
    .service-opt.selected {
      border-color: var(--accent);
      background: rgba(139, 105, 20, 0.06);
    }
    .service-opt input { display: none; }
    .service-opt .check {
      width: 20px; height: 20px; border-radius: 50%;
      border: 2px solid var(--border);
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; transition: border-color 0.2s, background 0.2s;
    }
    .service-opt.selected .check {
      border-color: var(--accent); background: var(--accent);
    }
    .service-opt.selected .check::after {
      content: ''; width: 6px; height: 6px;
      background: #fff; border-radius: 50%;
    }
    input[type="text"], input[type="tel"], input[type="date"], select {
      width: 100%; padding: 14px 16px; min-height: 48px;
      border: 1.5px solid var(--border); border-radius: 8px;
      font-size: 1rem; font-family: inherit; color: var(--text);
      background: #fff; transition: border-color 0.2s, box-shadow 0.2s;
      -webkit-appearance: none; appearance: none;
    }
    input:focus, select:focus {
      outline: none; border-color: var(--accent);
      box-shadow: 0 0 0 3px rgba(139, 105, 20, 0.15);
    }
    select {
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%235c5c5c' d='M1.4 0L6 4.6 10.6 0 12 1.4 6 7.4 0 1.4z'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 16px center;
      padding-right: 40px;
    }
    .btn-submit {
      width: 100%; margin-top: 8px;
      background: var(--accent); color: #fff;
      font-size: 1.05rem; min-height: 52px;
    }
    .btn-submit:hover { background: var(--accent-dark); }
    .btn-submit:disabled {
      opacity: 0.6; cursor: not-allowed; transform: none;
    }
    .form-message {
      margin-top: 16px; padding: 14px 16px;
      border-radius: 8px; font-size: 0.95rem; font-weight: 500;
      display: none; text-align: center;
    }
    .form-message.success {
      display: block; background: rgba(45, 106, 79, 0.1);
      color: var(--success); border: 1px solid rgba(45, 106, 79, 0.25);
    }
    .form-message.error {
      display: block; background: rgba(155, 34, 38, 0.08);
      color: var(--error); border: 1px solid rgba(155, 34, 38, 0.2);
    }

    /* FOOTER */
    footer {
      background: #1a1a1a; color: #c8c4bc;
      padding: 40px 20px 28px;
    }
    .footer-inner {
      max-width: 1200px; margin: 0 auto;
      display: grid; grid-template-columns: 1fr;
      gap: 28px; text-align: center;
    }
    .footer-brand {
      font-family: 'Playfair Display', serif;
      font-size: 1.2rem; font-weight: 700; color: #fff;
      margin-bottom: 6px;
    }
    .footer-brand span { color: var(--accent-light); }
    .footer-info p { font-size: 0.9rem; margin-bottom: 6px; }
    .footer-info a {
      color: var(--accent-light); font-weight: 500;
      border-bottom: 1px solid transparent;
    }
    .footer-info a:hover { border-bottom-color: var(--accent-light); }
    .footer-note {
      font-size: 0.8rem; color: #8a8680;
      margin-top: 8px; padding-top: 16px;
      border-top: 1px solid #333;
    }

    /* TABLET */
    @media (min-width: 768px) {
      .nav-inner { padding: 0 32px; }
      .hero { padding: 64px 32px 72px; }
      section { padding: 56px 32px; }
      .services-grid {
        grid-template-columns: repeat(2, 1fr);
        gap: 24px;
      }
      .services-grid .service-card:last-child:nth-child(odd) {
        grid-column: 1 / -1;
        max-width: 50%;
        justify-self: center;
        width: 100%;
      }
      .testimonials-grid {
        grid-template-columns: repeat(2, 1fr);
        gap: 24px;
      }
      .service-options {
        grid-template-columns: repeat(3, 1fr);
      }
      .booking-form { padding: 40px 36px; }
      .footer-inner {
        grid-template-columns: 1fr 1fr 1fr;
        text-align: left; gap: 32px;
      }
      .footer-note { grid-column: 1 / -1; text-align: center; }
    }

    /* DESKTOP */
    @media (min-width: 1024px) {
      .nav-inner { padding: 0 40px; }
      .hero { padding: 80px 40px 88px; }
      section { padding: 64px 40px; }
      .services-grid {
        grid-template-columns: repeat(3, 1fr);
        gap: 28px;
      }
      .services-grid .service-card:last-child:nth-child(odd) {
        grid-column: auto; max-width: none;
      }
      .nav-logo { font-size: 1.3rem; }
    }

    /* MOBILE NAV */
    @media (max-width: 767px) {
      .hamburger { display: flex; }
      .nav-links {
        position: fixed; top: var(--nav-h); left: 0; right: 0;
        background: var(--bg); border-bottom: 1px solid var(--border);
        flex-direction: column; padding: 12px 16px 20px;
        gap: 4px; transform: translateY(-120%);
        opacity: 0; pointer-events: none;
        transition: transform 0.3s ease, opacity 0.3s ease;
        box-shadow: var(--shadow);
      }
      .nav-links.open {
        transform: translateY(0); opacity: 1; pointer-events: auto;
      }
      .nav-links a {
        width: 100%; justify-content: center;
        padding: 14px; font-size: 1rem;
      }
      .nav-links a.cta { margin-top: 8px; }
      body { font-size: 15px; }
      .hero { padding: 36px 16px 44px; }
      section { padding: 40px 16px; }
      .service-card, .testimonial-card, .booking-form {
        padding: 24px 18px;
      }
      .btn, .btn-submit { min-height: 48px; }
      .service-opt { min-height: 48px; }
    }

    @media (max-width: 374px) {
      .nav-logo { font-size: 1rem; }
      .hero h1 { font-size: 1.75rem; }
    }
  </style>
</head>
<body>
  <!-- NAV -->
  <nav class="nav" id="nav">
    <div class="nav-inner">
      <a href="#home" class="nav-logo">Hotel <span>Saskatchewan</span> Barber</a>
      <button class="hamburger" id="hamburger" aria-label="Menu" aria-expanded="false">
        <span></span><span></span><span></span>
      </button>
      <ul class="nav-links" id="navLinks">
        <li><a href="#home">Home</a></li>
        <li><a href="#services">Services</a></li>
        <li><a href="#reviews">Reviews</a></li>
        <li><a href="#book" class="cta">Book</a></li>
      </ul>
    </div>
  </nav>

  <!-- HERO -->
  <header class="hero" id="home">
    <div class="hero-badge">Trusted since 1927</div>
    <h1>Hotel Saskatchewan Barber</h1>
    <p class="hero-tagline">Quality you deserve, prices you'll love, and a name you can trust.</p>
    <div class="hero-meta">
      <span class="stars" aria-label="4.5 out of 5 stars">★★★★☆</span>
      <span class="rating-text">4.5</span>
      <span>· 50+ reviews</span>
      <span>· Hotel Saskatchewan, Regina</span>
    </div>
  </header>

  <!-- SERVICES -->
  <section id="services">
    <div class="section-inner">
      <h2 class="section-title">Our Services</h2>
      <p class="section-sub">Classic cuts and traditional barbering, done right.</p>
      <div class="services-grid">
        <article class="service-card">
          <div class="service-icon" aria-hidden="true">✂️</div>
          <h3>Haircut</h3>
          <p class="service-price">
            <button type="button" class="btn-reveal price-btn" data-service="Haircut">Call for pricing</button>
            <a href="tel:3065220275" class="price-link" style="display:none;">(306) 522-0275</a>
          </p>
          <a href="#book" class="btn btn-primary book-scroll" data-service="Haircut">Book Now</a>
        </article>
        <article class="service-card">
          <div class="service-icon" aria-hidden="true">🧔</div>
          <h3>Beard Sculpting</h3>
          <p class="service-price">
            <button type="button" class="btn-reveal price-btn" data-service="Beard">Call for pricing</button>
            <a href="tel:3065220275" class="price-link" style="display:none;">(306) 522-0275</a>
          </p>
          <a href="#book" class="btn btn-primary book-scroll" data-service="Beard">Book Now</a>
        </article>
        <article class="service-card">
          <div class="service-icon" aria-hidden="true">🪒</div>
          <h3>Hot Towel Shave</h3>
          <p class="service-price">
            <button type="button" class="btn-reveal price-btn" data-service="Hot Towel Shave">Call for pricing</button>
            <a href="tel:3065220275" class="price-link" style="display:none;">(306) 522-0275</a>
          </p>
          <a href="#book" class="btn btn-primary book-scroll" data-service="Hot Towel Shave">Book Now</a>
        </article>
      </div>
    </div>
  </section>

  <!-- REVIEWS -->
  <section id="reviews">
    <div class="section-inner">
      <h2 class="section-title">What Our Clients Say</h2>
      <p class="section-sub">Real experiences from regulars and first-timers.</p>
      <div class="testimonials-grid">
        <blockquote class="testimonial-card">
          <p>"I have been going to this barber shop for a little over 5 years now (I'm talking consistently, every 3-4 weeks). Service exceptional, appointments are always kept and on time. Truly a prodigious place to venture and cannot recommend it enough! I have always walked out feeling fresh, fly, and dapper!"</p>
          <div class="testimonial-author">— Long-time Client</div>
        </blockquote>
        <blockquote class="testimonial-card">
          <p>"Roy is a phenomenal, polite and professional barber with a definite respect for the old-school class a traditional barber shop should present. You make an appointment and receive the exact service you expect. Highly recommend for both his skill and the barbershop experience."</p>
          <div class="testimonial-author">— Satisfied Customer</div>
        </blockquote>
      </div>
    </div>
  </section>

  <!-- BOOKING -->
  <section class="booking-section" id="book">
    <div class="section-inner">
      <h2 class="section-title">Book an Appointment</h2>
      <p class="section-sub">Choose your service and preferred time. We'll take care of the rest.</p>
      <form class="booking-form" id="bookingForm" novalidate>
        <div class="form-group">
          <label>Service</label>
          <div class="service-options" role="radiogroup" aria-label="Select service">
            <label class="service-opt" data-value="Haircut">
              <input type="radio" name="service" value="Haircut" required>
              <span class="check"></span>
              <span>✂️ Haircut</span>
            </label>
            <label class="service-opt" data-value="Beard">
              <input type="radio" name="service" value="Beard">
              <span class="check"></span>
              <span>🧔 Beard</span>
            </label>
            <label class="service-opt" data-value="Hot Towel Shave">
              <input type="radio" name="service" value="Hot Towel Shave">
              <span class="check"></span>
              <span>🪒 Hot Towel Shave</span>
            </label>
          </div>
        </div>
        <div class="form-group">
          <label for="name">Your Name</label>
          <input type="text" id="name" name="name" placeholder="John Smith" required autocomplete="name">
        </div>
        <div class="form-group">
          <label for="phone">Phone Number</label>
          <input type="tel" id="phone" name="phone" placeholder="(306) 555-1234" required autocomplete="tel">
        </div>
        <div class="form-group">
          <label for="date">Date</label>
          <input type="date" id="date" name="date" required>
        </div>
        <div class="form-group">
          <label for="time">Time</label>
          <select id="time" name="time" required>
            <option value="">Select a time</option>
            <option value="9:30 AM">9:30 AM</option>
            <option value="10:00 AM">10:00 AM</option>
            <option value="10:30 AM">10:30 AM</option>
            <option value="11:00 AM">11:00 AM</option>
            <option value="11:30 AM">11:30 AM</option>
            <option value="12:00 PM">12:00 PM</option>
            <option value="12:30 PM">12:30 PM</option>
            <option value="1:00 PM">1:00 PM</option>
            <option value="1:30 PM">1:30 PM</option>
            <option value="2:00 PM">2:00 PM</option>
            <option value="2:30 PM">2:30 PM</option>
            <option value="3:00 PM">3:00 PM</option>
            <option value="3:30 PM">3:30 PM</option>
            <option value="4:00 PM">4:00 PM</option>
            <option value="4:30 PM">4:30 PM</option>
          </select>
        </div>
        <button type="submit" class="btn btn-submit" id="submitBtn">Confirm Booking</button>
        <div class="form-message" id="formMessage" role="alert"></div>
      </form>
    </div>
  </section>

  <!-- FOOTER -->
  <footer>
    <div class="footer-inner">
      <div>
        <div class="footer-brand">Hotel <span>Saskatchewan</span> Barber</div>
        <p style="font-size:0.9rem;color:#8a8680;">Est. 1927</p>
      </div>
      <div class="footer-info">
        <p>Hotel Saskatchewan, Regina</p>
        <p><a href="tel:3065220275">(306) 522-0275</a></p>
      </div>
      <div class="footer-info">
        <p>Mon–Sat 9:30 AM – 5:00 PM</p>
        <p>Closed Sundays</p>
      </div>
      <p class="footer-note">Closed Sundays • Holiday hours may differ</p>
    </div>
  </footer>

  <script>
    // Hamburger
    const hamburger = document.getElementById('hamburger');
    const navLinks = document.getElementById('navLinks');
    hamburger.addEventListener('click', () => {
      const open = navLinks.classList.toggle('open');
      hamburger.classList.toggle('open', open);
      hamburger.setAttribute('aria-expanded', open);
    });
    navLinks.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        navLinks.classList.remove('open');
        hamburger.classList.remove('open');
        hamburger.setAttribute('aria-expanded', 'false');
      });
    });

    // Price reveal
    document.querySelectorAll('.price-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        this.style.display = 'none';
        this.nextElementSibling.style.display = 'inline';
      });
    });

    // Service selection highlight
    document.querySelectorAll('.service-opt').forEach(opt => {
      opt.addEventListener('click', function() {
        document.querySelectorAll('.service-opt').forEach(o => o.classList.remove('selected'));
        this.classList.add('selected');
        this.querySelector('input').checked = true;
      });
    });

    // Book Now preselect service
    document.querySelectorAll('.book-scroll').forEach(btn => {
      btn.addEventListener('click', function(e) {
        const svc = this.dataset.service;
        setTimeout(() => {
          const opt = document.querySelector('.service-opt[data-value="' + svc + '"]');
          if (opt) {
            document.querySelectorAll('.service-opt').forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            opt.querySelector('input').checked = true;
          }
        }, 300);
      });
    });

    // Date picker: min today, block Sundays
    const dateInput = document.getElementById('date');
    const timeSelect = document.getElementById('time');
    function setMinDate() {
      const today = new Date();
      const y = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, '0');
      const d = String(today.getDate()).padStart(2, '0');
      dateInput.min = y + '-' + m + '-' + d;
    }
    setMinDate();

    dateInput.addEventListener('change', function() {
      if (!this.value) return;
      const d = new Date(this.value + 'T12:00:00');
      if (d.getDay() === 0) {
        alert('We are closed on Sundays. Please choose another day.');
        this.value = '';
        timeSelect.disabled = true;
        timeSelect.value = '';
        return;
      }
      timeSelect.disabled = false;
    });

    // Form submit
    const form = document.getElementById('bookingForm');
    const formMessage = document.getElementById('formMessage');
    const submitBtn = document.getElementById('submitBtn');

    form.addEventListener('submit', async function(e) {
      e.preventDefault();
      formMessage.className = 'form-message';
      formMessage.textContent = '';

      const service = (form.querySelector('input[name="service"]:checked') || {}).value;
      const name = form.name.value.trim();
      const phone = form.phone.value.trim();
      const date = form.date.value;
      const time = form.time.value;

      if (!service || !name || !phone || !date || !time) {
        formMessage.className = 'form-message error';
        formMessage.textContent = 'Please fill in all fields.';
        return;
      }

      const d = new Date(date + 'T12:00:00');
      if (d.getDay() === 0) {
        formMessage.className = 'form-message error';
        formMessage.textContent = 'We are closed on Sundays. Please choose another day.';
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Booking...';

      try {
        const res = await fetch('/api/book', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ service, name, phone, date, time })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          formMessage.className = 'form-message success';
          formMessage.textContent = data.message;
          form.reset();
          document.querySelectorAll('.service-opt').forEach(o => o.classList.remove('selected'));
          timeSelect.disabled = false;
        } else {
          formMessage.className = 'form-message error';
          formMessage.textContent = data.error || 'Something went wrong. Please try again.';
        }
      } catch (err) {
        formMessage.className = 'form-message error';
        formMessage.textContent = 'Network error. Please call us at (306) 522-0275.';
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Confirm Booking';
      }
    });
  </script>
</body>
</html>`;
}

function getLoginHTML(errorMsg) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Owner Login | Hotel Saskatchewan Barber</title>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #faf8f5; --text: #1a1a1a; --muted: #5c5c5c;
      --accent: #8b6914; --accent-dark: #6b5010; --border: #e8e2d9;
      --error: #9b2226; --radius: 12px;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', sans-serif; background: var(--bg);
      color: var(--text); min-height: 100vh;
      display: flex; align-items: center; justify-content: center;
      padding: 24px 16px;
    }
    .login-card {
      width: 100%; max-width: 400px;
      background: #fff; border: 1px solid var(--border);
      border-radius: var(--radius); padding: 40px 28px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.08);
    }
    h1 {
      font-family: 'Playfair Display', serif;
      font-size: 1.5rem; text-align: center; margin-bottom: 6px;
    }
    .sub { text-align: center; color: var(--muted); font-size: 0.9rem; margin-bottom: 28px; }
    label { display: block; font-size: 0.85rem; font-weight: 600; margin-bottom: 8px; }
    input {
      width: 100%; padding: 14px 16px; min-height: 48px;
      border: 1.5px solid var(--border); border-radius: 8px;
      font-size: 1rem; font-family: inherit; margin-bottom: 18px;
    }
    input:focus {
      outline: none; border-color: var(--accent);
      box-shadow: 0 0 0 3px rgba(139,105,20,0.15);
    }
    button {
      width: 100%; padding: 14px; min-height: 52px;
      background: var(--accent); color: #fff; border: none;
      border-radius: 8px; font-size: 1rem; font-weight: 600;
      cursor: pointer; font-family: inherit;
      transition: background 0.2s;
    }
    button:hover { background: var(--accent-dark); }
    .error {
      background: rgba(155,34,38,0.08); color: var(--error);
      border: 1px solid rgba(155,34,38,0.2);
      padding: 12px 14px; border-radius: 8px;
      font-size: 0.9rem; margin-bottom: 18px; text-align: center;
    }
    .back {
      display: block; text-align: center; margin-top: 20px;
      color: var(--muted); font-size: 0.9rem; text-decoration: none;
    }
    .back:hover { color: var(--accent); }
  </style>
</head>
<body>
  <div class="login-card">
    <h1>Owner Login</h1>
    <p class="sub">Hotel Saskatchewan Barber</p>
    ${errorMsg ? `<div class="error">${errorMsg}</div>` : ''}
    <form method="POST" action="/login">
      <label for="username">Username</label>
      <input type="text" id="username" name="username" required autocomplete="username" autofocus>
      <label for="password">Password</label>
      <input type="password" id="password" name="password" required autocomplete="current-password">
      <button type="submit">Sign In</button>
    </form>
    <a href="/" class="back">← Back to website</a>
  </div>
</body>
</html>`;
}

function getDashboardHTML(username, bookings) {
  const rows = bookings.map(b => {
    const dateStr = b.booking_date
      ? (typeof b.booking_date === 'string'
          ? b.booking_date.slice(0, 10)
          : new Date(b.booking_date).toISOString().slice(0, 10))
      : '';
    const statusClass =
      b.status === 'Arrived' ? 'status-arrived' :
      b.status === 'No-Show' ? 'status-noshow' :
      b.status === 'Cancelled' ? 'status-cancelled' : 'status-pending';
    return `<tr data-id="${b.id}">
      <td data-label="Service">${esc(b.service)}</td>
      <td data-label="Name">${esc(b.customer_name)}</td>
      <td data-label="Phone"><a href="tel:${esc(String(b.customer_phone).replace(/\D/g, ''))}">${esc(b.customer_phone)}</a></td>
      <td data-label="Date">${dateStr}</td>
      <td data-label="Time">${esc(b.booking_time)}</td>
      <td data-label="Status"><span class="status-badge ${statusClass}">${esc(b.status)}</span></td>
      <td data-label="Actions" class="actions">
        <button type="button" class="btn-status btn-arrived" data-status="Arrived">Arrived</button>
        <button type="button" class="btn-status btn-noshow" data-status="No-Show">No-Show</button>
        <button type="button" class="btn-status btn-cancelled" data-status="Cancelled">Cancelled</button>
      </td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dashboard | Hotel Saskatchewan Barber</title>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #faf8f5; --text: #1a1a1a; --muted: #5c5c5c;
      --accent: #8b6914; --accent-dark: #6b5010; --border: #e8e2d9;
      --success: #2d6a4f; --error: #9b2226; --gray: #6c757d;
      --radius: 10px;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', sans-serif; background: var(--bg);
      color: var(--text); min-height: 100vh; font-size: 15px;
    }
    .topbar {
      background: #1a1a1a; color: #fff;
      padding: 14px 20px; display: flex; align-items: center;
      justify-content: space-between; flex-wrap: wrap; gap: 12px;
    }
    .topbar h1 {
      font-family: 'Playfair Display', serif;
      font-size: 1.15rem; font-weight: 700;
    }
    .topbar-right {
      display: flex; align-items: center; gap: 16px; flex-wrap: wrap;
    }
    .topbar-user { font-size: 0.9rem; color: #c8c4bc; }
    .topbar-user strong { color: #fff; }
    .btn-logout {
      background: transparent; color: #fff;
      border: 1.5px solid #555; padding: 8px 16px;
      border-radius: 6px; font-size: 0.85rem; font-weight: 600;
      cursor: pointer; text-decoration: none; min-height: 40px;
      display: inline-flex; align-items: center; font-family: inherit;
    }
    .btn-logout:hover { border-color: #fff; }
    .container { max-width: 1200px; margin: 0 auto; padding: 24px 16px; }
    h2 { font-family: 'Playfair Display', serif; font-size: 1.4rem; margin-bottom: 20px; }
    .table-wrap {
      overflow-x: auto; background: #fff;
      border: 1px solid var(--border); border-radius: var(--radius);
      box-shadow: 0 2px 12px rgba(0,0,0,0.05);
    }
    table { width: 100%; border-collapse: collapse; min-width: 700px; }
    th, td {
      padding: 12px 14px; text-align: left;
      border-bottom: 1px solid var(--border); font-size: 0.9rem;
    }
    th {
      background: #f5f1eb; font-weight: 600; font-size: 0.8rem;
      text-transform: uppercase; letter-spacing: 0.03em; color: var(--muted);
    }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: #faf8f5; }
    a { color: var(--accent); font-weight: 500; }
    .status-badge {
      display: inline-block; padding: 4px 10px; border-radius: 100px;
      font-size: 0.8rem; font-weight: 600;
    }
    .status-pending { background: #fff3cd; color: #856404; }
    .status-arrived { background: #d1e7dd; color: var(--success); }
    .status-noshow { background: #f8d7da; color: var(--error); }
    .status-cancelled { background: #e9ecef; color: var(--gray); }
    .actions { white-space: nowrap; }
    .btn-status {
      padding: 6px 10px; min-height: 36px; border: none;
      border-radius: 6px; font-size: 0.75rem; font-weight: 600;
      cursor: pointer; margin-right: 4px; margin-bottom: 4px;
      font-family: inherit; transition: opacity 0.15s;
    }
    .btn-status:hover { opacity: 0.85; }
    .btn-arrived { background: var(--success); color: #fff; }
    .btn-noshow { background: var(--error); color: #fff; }
    .btn-cancelled { background: var(--gray); color: #fff; }
    .empty {
      text-align: center; padding: 48px 20px; color: var(--muted);
    }
    @media (max-width: 767px) {
      .container { padding: 16px 12px; }
      table { min-width: 0; }
      thead { display: none; }
      tr {
        display: block; margin-bottom: 16px;
        border: 1px solid var(--border); border-radius: 8px;
        background: #fff; padding: 12px;
      }
      td {
        display: flex; justify-content: space-between;
        align-items: center; padding: 8px 4px;
        border-bottom: 1px solid #f0ebe3;
      }
      td:last-child { border-bottom: none; flex-wrap: wrap; gap: 6px; }
      td::before {
        content: attr(data-label);
        font-weight: 600; font-size: 0.8rem;
        color: var(--muted); text-transform: uppercase;
        margin-right: 12px; flex-shrink: 0;
      }
      .actions { justify-content: flex-start !important; }
      .btn-status { min-height: 40px; padding: 8px 12px; font-size: 0.8rem; }
    }
  </style>
</head>
<body>
  <div class="topbar">
    <h1>Hotel Saskatchewan Barber</h1>
    <div class="topbar-right">
      <span class="topbar-user">Logged in as <strong>${esc(username)}</strong></span>
      <a href="/logout" class="btn-logout">Logout</a>
    </div>
  </div>
  <div class="container">
    <h2>Bookings</h2>
    <div class="table-wrap">
      ${bookings.length === 0
        ? '<div class="empty">No bookings yet.</div>'
        : `<table>
            <thead>
              <tr>
                <th>Service</th><th>Name</th><th>Phone</th>
                <th>Date</th><th>Time</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>`}
    </div>
  </div>
  <script>
    document.querySelectorAll('.btn-status').forEach(btn => {
      btn.addEventListener('click', async function() {
        const row = this.closest('tr');
        const id = row.dataset.id;
        const status = this.dataset.status;
        try {
          const res = await fetch('/api/booking/' + id + '/status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
          });
          if (res.ok) {
            const badge = row.querySelector('.status-badge');
            badge.textContent = status;
            badge.className = 'status-badge ' + (
              status === 'Arrived' ? 'status-arrived' :
              status === 'No-Show' ? 'status-noshow' :
              status === 'Cancelled' ? 'status-cancelled' : 'status-pending'
            );
          } else {
            alert('Failed to update status');
          }
        } catch (e) {
          alert('Network error');
        }
      });
    });
  </script>
</body>
</html>`;
}

function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Start
initDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Hotel Saskatchewan Barber running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('Failed to initialize database:', err);
    // Still start so /health works and deploy doesn't crash loop immediately
    app.listen(PORT, () => {
      console.log(`Server started on port ${PORT} (DB init failed — check DATABASE_URL)`);
    });
  });
