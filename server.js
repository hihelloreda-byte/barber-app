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
    const check = await pool.query('SELECT id FROM owner WHERE email = $1', ['hihelloreda@gmail.com']);
    if (check.rows.length === 0) {
      await pool.query(
        'INSERT INTO owner (email, password) VALUES ($1, $2)',
        ['hihelloreda@gmail.com', 'hotelsask']
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
    const { email, password } = req.body;
    const result = await pool.query(
      'SELECT id, email FROM owner WHERE email = $1 AND password = $2',
      [email, password]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const token = makeToken();
    sessions.set(token, result.rows[0]);
    res.json({ success: true, token, email: result.rows[0].email });
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

// ---------- Shared CSS ----------
const CSS = `
:root {
  --bg: #0c0c0e;
  --bg-card: #151518;
  --bg-elev: #1a1a1f;
  --gold: #c9a227;
  --gold-soft: #e0bc4a;
  --blue: #3b82f6;
  --blue-glow: rgba(59,130,246,0.4);
  --text: #f2f2f4;
  --muted: #9b9ba8;
  --border: #2a2a32;
  --green: #22c55e;
  --red: #ef4444;
  --gray: #6b7280;
}
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; }
body {
  font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
  background: var(--bg);
  color: var(--text);
  line-height: 1.6;
  min-height: 100vh;
}
a { color: inherit; text-decoration: none; }
.container { width: 100%; max-width: 1080px; margin: 0 auto; padding: 0 1.25rem; }

/* NAV */
.navbar {
  position: sticky; top: 0; z-index: 1000;
  background: rgba(12,12,14,0.94);
  backdrop-filter: blur(14px);
  border-bottom: 1px solid var(--border);
}
.nav-inner {
  display: flex; align-items: center; justify-content: space-between;
  max-width: 1080px; margin: 0 auto; padding: 0.9rem 1.25rem;
}
.logo { font-size: 1.1rem; font-weight: 700; color: var(--gold); letter-spacing: 0.01em; }
.logo span { color: var(--text); font-weight: 400; }
.nav-links { display: flex; gap: 1.6rem; list-style: none; }
.nav-links a { color: var(--muted); font-size: 0.95rem; font-weight: 500; transition: color 0.2s; }
.nav-links a:hover { color: var(--gold); }
.nav-toggle {
  display: none; background: none; border: none; color: var(--text);
  font-size: 1.5rem; cursor: pointer; line-height: 1;
}

/* HERO */
.hero {
  padding: 5rem 0 4rem;
  text-align: center;
  background: linear-gradient(180deg, #121214 0%, var(--bg) 100%);
  border-bottom: 1px solid var(--border);
}
.hero h1 {
  font-size: clamp(2rem, 5vw, 3.1rem);
  font-weight: 800; color: var(--gold);
  letter-spacing: -0.02em; margin-bottom: 0.7rem;
}
.hero .tagline {
  font-size: clamp(1rem, 2.4vw, 1.2rem);
  color: var(--muted); max-width: 540px; margin: 0 auto 1.2rem;
}
.badge-since {
  display: inline-block; font-size: 0.82rem; color: var(--gold-soft);
  border: 1px solid rgba(201,162,39,0.45);
  padding: 0.3rem 0.95rem; border-radius: 999px; margin-bottom: 1.4rem;
}
.rating-row {
  display: flex; align-items: center; justify-content: center; gap: 0.5rem;
}
.stars { color: var(--gold); font-size: 1.15rem; letter-spacing: 0.04em; }
.rating-text { color: var(--muted); font-size: 0.95rem; }

/* SECTIONS */
section { padding: 4rem 0; }
.section-title {
  text-align: center; font-size: clamp(1.55rem, 3vw, 2rem);
  font-weight: 700; margin-bottom: 0.4rem;
}
.section-sub { text-align: center; color: var(--muted); margin-bottom: 2.4rem; font-size: 0.98rem; }

/* SERVICES */
.services-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.4rem;
}
.service-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 1.7rem 1.4rem;
  text-align: center;
  transition: border-color 0.25s, transform 0.25s;
}
.service-card:hover {
  border-color: rgba(201,162,39,0.4);
  transform: translateY(-3px);
}
.svc-icon {
  width: 54px; height: 54px; margin: 0 auto 1rem;
  background: linear-gradient(135deg, rgba(201,162,39,0.14), rgba(59,130,246,0.08));
  border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  font-size: 1.55rem;
}
.service-card h3 { font-size: 1.15rem; color: var(--gold-soft); margin-bottom: 0.45rem; }
.service-card p { color: var(--muted); font-size: 0.9rem; margin-bottom: 0.9rem; min-height: 2.8em; }
.price-note { font-size: 0.84rem; color: var(--blue); font-weight: 500; margin-bottom: 1.05rem; }

/* BUTTONS */
.btn {
  display: inline-block; padding: 0.65rem 1.3rem; border-radius: 8px;
  font-weight: 600; font-size: 0.92rem; cursor: pointer; border: none;
  transition: background 0.2s, box-shadow 0.2s, transform 0.15s;
}
.btn-gold {
  background: linear-gradient(135deg, var(--gold), #a8841c);
  color: #0c0c0e;
}
.btn-gold:hover { box-shadow: 0 4px 18px rgba(201,162,39,0.35); transform: translateY(-1px); }
.btn-blue { background: var(--blue); color: #fff; }
.btn-blue:hover { background: #2563eb; box-shadow: 0 4px 16px var(--blue-glow); }
.btn-outline {
  background: transparent; border: 1px solid var(--border); color: var(--muted);
}
.btn-outline:hover { border-color: var(--gold); color: var(--gold); }
.btn-sm { padding: 0.38rem 0.7rem; font-size: 0.78rem; }
.btn-green { background: var(--green); color: #fff; }
.btn-red { background: var(--red); color: #fff; }
.btn-gray { background: var(--gray); color: #fff; }

/* TESTIMONIALS */
.testimonials-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.4rem;
}
.testimonial {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 1.7rem;
  position: relative;
}
.testimonial::before {
  content: '"';
  position: absolute; top: 0.5rem; left: 1rem;
  font-size: 2.8rem; color: rgba(201,162,39,0.18);
  font-family: Georgia, serif; line-height: 1;
}
.testimonial p {
  color: var(--muted); font-size: 0.95rem;
  margin-bottom: 1rem; padding-top: 0.7rem;
}
.testimonial .author {
  font-weight: 600; color: var(--gold-soft); font-size: 0.88rem;
}

/* BOOKING */
.booking-section {
  background: linear-gradient(180deg, var(--bg) 0%, #101012 100%);
}
.form-card {
  max-width: 500px; margin: 0 auto;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 2rem 1.75rem;
}
.service-options {
  display: grid; grid-template-columns: 1fr; gap: 0.7rem; margin-bottom: 1.4rem;
}
.service-option {
  display: flex; align-items: center; gap: 0.7rem;
  padding: 0.85rem 1.05rem;
  background: var(--bg-elev);
  border: 2px solid var(--border);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
  color: var(--muted);
  font-weight: 500;
  font-size: 0.95rem;
}
.service-option:hover { border-color: rgba(59,130,246,0.4); }
.service-option.selected {
  border-color: var(--blue);
  background: rgba(59,130,246,0.12);
  color: #93c5fd;
  box-shadow: 0 0 18px var(--blue-glow);
}
.service-option input { display: none; }
.form-group { margin-bottom: 1.1rem; }
.form-group label {
  display: block; font-size: 0.82rem; font-weight: 600;
  color: var(--muted); margin-bottom: 0.35rem;
}
.form-group input,
.form-group select {
  width: 100%; padding: 0.72rem 0.95rem;
  background: var(--bg-elev);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text); font-size: 1rem;
  outline: none; transition: border-color 0.2s;
}
.form-group input:focus,
.form-group select:focus { border-color: var(--blue); }
.form-group select:disabled { opacity: 0.45; cursor: not-allowed; }
.form-msg {
  margin-top: 1rem; padding: 0.7rem 0.95rem;
  border-radius: 8px; font-size: 0.9rem; display: none;
}
.form-msg.success {
  display: block;
  background: rgba(34,197,94,0.12);
  border: 1px solid rgba(34,197,94,0.35);
  color: #86efac;
}
.form-msg.error {
  display: block;
  background: rgba(239,68,68,0.12);
  border: 1px solid rgba(239,68,68,0.35);
  color: #fca5a5;
}
.form-submit { width: 100%; margin-top: 0.4rem; padding: 0.85rem; font-size: 1.02rem; }

/* FOOTER */
.footer {
  background: #08080a;
  border-top: 1px solid var(--border);
  padding: 2.5rem 0;
  text-align: center;
}
.footer h3 { color: var(--gold); font-size: 1.1rem; margin-bottom: 0.6rem; }
.footer p { color: var(--muted); font-size: 0.88rem; margin-bottom: 0.3rem; }
.footer .hours-block {
  margin-top: 1rem; padding-top: 1rem;
  border-top: 1px solid var(--border);
  display: inline-block;
}
.footer .note { font-size: 0.8rem; color: var(--muted); margin-top: 0.5rem; opacity: 0.85; }

/* OWNER */
.auth-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 2rem 1rem; }
.auth-card {
  width: 100%; max-width: 400px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 2rem;
}
.auth-card h1 { text-align: center; color: var(--gold); font-size: 1.45rem; margin-bottom: 0.3rem; }
.auth-card .sub { text-align: center; color: var(--muted); font-size: 0.88rem; margin-bottom: 1.6rem; }
.dash-page { min-height: 100vh; display: flex; flex-direction: column; }
.dash-header {
  background: var(--bg-card);
  border-bottom: 1px solid var(--border);
  padding: 1rem 0;
}
.dash-header-inner {
  max-width: 1080px; margin: 0 auto; padding: 0 1.25rem;
  display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.7rem;
}
.dash-header h1 { font-size: 1.2rem; color: var(--gold); }
.dash-body { flex: 1; padding: 2rem 0; }
.table-wrap {
  overflow-x: auto;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 12px;
}
table { width: 100%; border-collapse: collapse; min-width: 720px; }
th, td {
  padding: 0.8rem 1rem; text-align: left;
  border-bottom: 1px solid var(--border); font-size: 0.88rem;
}
th {
  background: var(--bg-elev); color: var(--muted);
  font-weight: 600; font-size: 0.75rem;
  text-transform: uppercase; letter-spacing: 0.04em;
}
tr:last-child td { border-bottom: none; }
tr:hover td { background: rgba(255,255,255,0.015); }
.status-badge {
  display: inline-block; padding: 0.22rem 0.55rem;
  border-radius: 999px; font-size: 0.72rem; font-weight: 600;
}
.status-Pending { background: rgba(59,130,246,0.18); color: #93c5fd; }
.status-Arrived { background: rgba(34,197,94,0.18); color: #86efac; }
.status-No-Show { background: rgba(239,68,68,0.18); color: #fca5a5; }
.status-Cancelled { background: rgba(107,114,128,0.25); color: #d1d5db; }
.actions { display: flex; gap: 0.35rem; flex-wrap: wrap; }
.empty { text-align: center; padding: 3rem 1rem; color: var(--muted); }

/* MOBILE */
@media (max-width: 768px) {
  .nav-links {
    display: none; position: absolute; top: 100%; left: 0; right: 0;
    background: rgba(12,12,14,0.98); flex-direction: column;
    padding: 0.5rem 0; gap: 0; border-bottom: 1px solid var(--border);
  }
  .nav-links.open { display: flex; }
  .nav-links a { padding: 0.75rem 1.25rem; border-bottom: 1px solid var(--border); }
  .nav-toggle { display: block; }
  .hero { padding: 3.5rem 0 3rem; }
  section { padding: 3rem 0; }
  .form-card { padding: 1.5rem 1.25rem; }
  th, td { padding: 0.6rem 0.7rem; font-size: 0.82rem; }
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
          <div class="price-note">Call for pricing</div>
          <a href="#book" class="btn btn-gold">Book Now</a>
        </div>
        <div class="service-card">
          <div class="svc-icon">🧔</div>
          <h3>Beard Sculpting</h3>
          <p>Shape, trim, and define your beard for a polished look.</p>
          <div class="price-note">Call for pricing</div>
          <a href="#book" class="btn btn-gold">Book Now</a>
        </div>
        <div class="service-card">
          <div class="svc-icon">🪒</div>
          <h3>Hot Towel Shave</h3>
          <p>Traditional straight-razor shave with hot towels and aftershave.</p>
          <div class="price-note">Call for pricing</div>
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
          <label for="email">Email</label>
          <input type="email" id="email" required placeholder="you@example.com" autocomplete="username" />
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
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      try {
        const res = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (!res.ok) {
          msg.className = 'form-msg error';
          msg.textContent = data.error || 'Login failed';
          return;
        }
        localStorage.setItem('ownerToken', data.token);
        localStorage.setItem('ownerEmail', data.email);
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
          <span id="ownerEmail" style="color:var(--muted);font-size:0.9rem;"></span>
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
    document.getElementById('ownerEmail').textContent = localStorage.getItem('ownerEmail') || '';

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
      localStorage.removeItem('ownerEmail');
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
