const express = require('express');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 10000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));

pool.query(`
  CREATE TABLE IF NOT EXISTS bookings (
    id SERIAL PRIMARY KEY,
    service TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    booking_date DATE NOT NULL,
    booking_time TIME NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS owner (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL
  );
  INSERT INTO owner (email, password) 
  VALUES ('hihelloreda@gmail.com', 'hotelsask')
  ON CONFLICT (email) DO NOTHING;
`).catch(err => console.log('Table creation error:', err));

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Hotel Saskatchewan Barber</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background: #f8f6f2;
          color: #1a1a1a;
        }
        /* Navigation */
        .navbar {
          background: #0a0a0a;
          padding: 18px 40px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 2px solid #d4a13e;
          flex-wrap: wrap;
        }
        .navbar .logo {
          font-size: 1.8rem;
          font-weight: 300;
          letter-spacing: 4px;
          color: #d4a13e;
        }
        .navbar .nav-links {
          display: flex;
          gap: 30px;
          flex-wrap: wrap;
        }
        .navbar .nav-links a {
          color: #e0e0e0;
          text-decoration: none;
          font-weight: 500;
          transition: 0.3s;
        }
        .navbar .nav-links a:hover {
          color: #d4a13e;
        }
        /* Hero */
        .hero {
          background: linear-gradient(135deg, #0a0a0a 0%, #1a0f08 100%);
          padding: 80px 20px 70px;
          text-align: center;
          border-bottom: 3px solid #d4a13e;
        }
        .hero h1 {
          font-size: 4.5rem;
          font-weight: 300;
          letter-spacing: 10px;
          color: #d4a13e;
          margin-bottom: 12px;
        }
        .hero .tagline {
          font-size: 1.4rem;
          color: #ccc;
          font-weight: 300;
          letter-spacing: 2px;
        }
        .hero .sub {
          margin-top: 16px;
          color: #999;
          font-size: 1rem;
        }
        .hero .stars {
          margin-top: 20px;
          font-size: 2.2rem;
          color: #d4a13e;
          letter-spacing: 4px;
        }
        .hero .stars span {
          color: #555;
          font-size: 1rem;
          margin-left: 12px;
        }
        .container {
          max-width: 1100px;
          margin: 0 auto;
          padding: 40px 20px;
        }
        .section-title {
          color: #1a1a1a;
          font-size: 2.6rem;
          font-weight: 300;
          text-align: center;
          border-bottom: 2px solid #d4a13e;
          padding-bottom: 16px;
          margin-bottom: 40px;
          letter-spacing: 2px;
        }
        /* Service Cards (Product style) */
        .service-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 30px;
          margin: 20px 0 40px;
        }
        .service-card {
          background: white;
          border-radius: 20px;
          padding: 30px 20px 25px;
          text-align: center;
          box-shadow: 0 8px 30px rgba(0,0,0,0.06);
          border: 1px solid #eee;
          transition: 0.3s ease;
        }
        .service-card:hover {
          transform: translateY(-6px);
          box-shadow: 0 16px 50px rgba(212, 161, 62, 0.12);
          border-color: #d4a13e;
        }
        .service-card .icon {
          font-size: 3.6rem;
          margin-bottom: 12px;
        }
        .service-card h3 {
          font-size: 1.5rem;
          color: #1a1a1a;
          font-weight: 600;
        }
        .service-card .price {
          color: #d4a13e;
          font-size: 1.3rem;
          font-weight: 700;
          margin: 8px 0 12px;
        }
        .service-card .desc {
          color: #666;
          font-size: 0.95rem;
          line-height: 1.5;
          margin-bottom: 16px;
        }
        .btn-book {
          background: #1a1a1a;
          color: white;
          border: none;
          padding: 12px 30px;
          border-radius: 40px;
          font-weight: 600;
          cursor: pointer;
          transition: 0.3s;
          font-size: 0.95rem;
        }
        .btn-book:hover {
          background: #d4a13e;
          color: #0a0a0a;
        }
        /* Testimonials */
        .testimonial-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 30px;
          margin: 30px 0 50px;
        }
        .testimonial-card {
          background: white;
          border-radius: 20px;
          padding: 30px 28px;
          border-left: 5px solid #d4a13e;
          box-shadow: 0 4px 20px rgba(0,0,0,0.04);
        }
        .testimonial-card .stars {
          color: #d4a13e;
          font-size: 1.4rem;
          letter-spacing: 2px;
          margin-bottom: 10px;
        }
        .testimonial-card p {
          font-size: 1rem;
          line-height: 1.7;
          color: #333;
          font-style: italic;
        }
        .testimonial-card .author {
          margin-top: 14px;
          font-weight: 600;
          color: #1a1a1a;
          font-style: normal;
        }
        /* Booking Box */
        .booking-box {
          background: white;
          border-radius: 32px;
          padding: 40px 35px;
          box-shadow: 0 12px 50px rgba(0,0,0,0.06);
          border: 1px solid #eee;
          margin-top: 30px;
        }
        .booking-box h2 {
          color: #1a1a1a;
          font-size: 2rem;
          font-weight: 300;
          border-left: 6px solid #d4a13e;
          padding-left: 20px;
          margin-bottom: 30px;
        }
        label {
          font-weight: 600;
          display: block;
          margin-top: 20px;
          color: #333;
          font-size: 0.95rem;
        }
        select, input {
          width: 100%;
          padding: 16px 20px;
          border: 2px solid #e0e0e0;
          border-radius: 16px;
          font-size: 1rem;
          background: #fafafa;
          transition: 0.3s;
          margin-top: 8px;
        }
        select:focus, input:focus {
          border-color: #d4a13e;
          outline: none;
          background: white;
          box-shadow: 0 0 0 4px rgba(212, 161, 62, 0.08);
        }
        .service-select-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin: 16px 0 10px;
        }
        .service-option {
          background: #fafafa;
          border: 2px solid #e0e0e0;
          border-radius: 16px;
          padding: 16px 10px;
          text-align: center;
          cursor: pointer;
          transition: 0.2s;
        }
        .service-option.selected {
          border-color: #d4a13e;
          background: #fdf6ed;
          box-shadow: 0 0 0 3px rgba(212, 161, 62, 0.12);
        }
        .service-option h4 {
          font-size: 1.1rem;
          color: #1a1a1a;
        }
        .service-option p {
          color: #888;
          font-size: 0.9rem;
        }
        #time-slots {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin: 16px 0 8px;
          min-height: 60px;
        }
        .slot {
          background: #f0f0f0;
          padding: 14px 22px;
          border-radius: 40px;
          font-weight: 500;
          cursor: pointer;
          transition: 0.2s;
          border: 2px solid transparent;
          color: #333;
        }
        .slot.selected {
          background: #1a1a1a;
          color: white;
          border-color: #d4a13e;
        }
        .btn-primary {
          background: #d4a13e;
          color: #0a0a0a;
          border: none;
          padding: 18px;
          width: 100%;
          border-radius: 40px;
          font-size: 1.3rem;
          font-weight: 700;
          margin-top: 30px;
          cursor: pointer;
          transition: 0.3s;
          letter-spacing: 1px;
        }
        .btn-primary:hover {
          background: #b8892e;
          transform: scale(1.01);
          box-shadow: 0 10px 30px rgba(212, 161, 62, 0.2);
        }
        .message {
          margin-top: 24px;
          padding: 16px;
          border-radius: 16px;
          text-align: center;
          font-weight: 600;
        }
        .message.success { background: #e6f5e6; color: #1a6e1a; }
        .message.error { background: #fde8e8; color: #b33636; }
        .footer {
          text-align: center;
          padding: 30px 20px;
          color: #888;
          font-size: 0.9rem;
          border-top: 1px solid #e0e0e0;
          margin-top: 40px;
        }
        @media (max-width: 768px) {
          .service-grid { grid-template-columns: 1fr; }
          .testimonial-grid { grid-template-columns: 1fr; }
          .service-select-grid { grid-template-columns: 1fr; }
          .navbar { flex-direction: column; gap: 12px; }
          .hero h1 { font-size: 2.8rem; }
          .booking-box { padding: 24px 18px; }
        }
      </style>
    </head>
    <body>

    <!-- Navigation -->
    <nav class="navbar">
      <div class="logo">✂️ Hotel Saskatchewan Barber</div>
      <div class="nav-links">
        <a href="#home">Home</a>
        <a href="#services">Services</a>
        <a href="#reviews">Reviews</a>
        <a href="#booking">Book</a>
      </div>
    </nav>

    <!-- Hero -->
    <section id="home" class="hero">
      <h1>✂️ Hotel Saskatchewan Barber</h1>
      <p class="tagline">Quality you deserve, prices you'll love, and a name you can trust.</p>
      <p class="sub">Your trusted shop since 2023 • Located in the Hotel Saskatchewan</p>
      <div class="stars">
        ★★★★½ <span>4.5 / 5.0 • 50+ reviews</span>
      </div>
    </section>

    <div class="container">

      <!-- Services (Product-style Cards) -->
      <h2 id="services" class="section-title">Our Services</h2>
      <div class="service-grid">
        <div class="service-card">
          <div class="icon">✂️</div>
          <h3>Haircut</h3>
          <div class="price">Call for pricing</div>
          <p class="desc">Classic or modern — precision cutting tailored to your style.</p>
          <button class="btn-book" onclick="document.getElementById('booking').scrollIntoView({behavior:'smooth'})">Book Now</button>
        </div>
        <div class="service-card">
          <div class="icon">🧔</div>
          <h3>Beard Sculpting</h3>
          <div class="price">Call for pricing</div>
          <p class="desc">Expert shaping, line‑ups, and grooming for a refined look.</p>
          <button class="btn-book" onclick="document.getElementById('booking').scrollIntoView({behavior:'smooth'})">Book Now</button>
        </div>
        <div class="service-card">
          <div class="icon">🪒</div>
          <h3>Hot Towel Shave</h3>
          <div class="price">Call for pricing</div>
          <p class="desc">Traditional straight‑razor shave with a luxurious hot towel finish.</p>
          <button class="btn-book" onclick="document.getElementById('booking').scrollIntoView({behavior:'smooth'})">Book Now</button>
        </div>
      </div>

      <!-- Testimonials -->
      <h2 id="reviews" class="section-title">What Our Clients Say</h2>
      <div class="testimonial-grid">
        <div class="testimonial-card">
          <div class="stars">★★★★★</div>
          <p>"I have been going to this barber shop for a little over 5 years now (I'm talking consistently, every 3‑4 weeks). Service exceptional, appointments are always kept and on time. Truly a prodigious place to venture and cannot recommend it enough! I have always walked out feeling fresh, fly, and dapper!"</p>
          <div class="author">— Long‑time Client</div>
        </div>
        <div class="testimonial-card">
          <div class="stars">★★★★★</div>
          <p>"Roy is a phenomenal, polite and professional barber with a definite respect for the old‑school class a traditional barber shop should present. You make an appointment and receive the exact service you expect. Highly recommend for both his skill and the barbershop experience."</p>
          <div class="author">— Satisfied Customer</div>
        </div>
      </div>

      <!-- Booking Section -->
      <div id="booking" class="booking-box">
        <h2>📅 Book Your Appointment</h2>
        <form id="booking-form">
          <label>Choose a service</label>
          <div class="service-select-grid" id="service-grid">
            <div class="service-option" data-service="Haircut">
              <h4>✂️ Haircut</h4>
              <p>Call for pricing</p>
            </div>
            <div class="service-option" data-service="Beard">
              <h4>🧔 Beard</h4>
              <p>Call for pricing</p>
            </div>
            <div class="service-option" data-service="Hot Towel Shave">
              <h4>🪒 Hot Towel Shave</h4>
              <p>Call for pricing</p>
            </div>
          </div>
          <input type="hidden" id="selected-service" required>

          <label>Your name</label>
          <input type="text" id="name" placeholder="e.g. John Doe" required>

          <label>Phone number</label>
          <input type="tel" id="phone" placeholder="(306) 555-1234" required>

          <label>Date</label>
          <input type="date" id="date" required>

          <label>Select a time</label>
          <div id="time-slots"></div>
          <input type="hidden" id="selected-time" required>

          <button type="submit" class="btn-primary">✂️ Book Now</button>
          <div id="message" class="message" style="display:none;"></div>
        </form>
      </div>
    </div>

    <div class="footer">
      <p>📍 Hotel Saskatchewan, Regina • (306) 522-0275</p>
      <p style="color:#aaa;">Mon–Sat 9:30 AM – 5:00 PM • Closed Sundays • Holiday hours may differ</p>
    </div>

    <script>
      // Service selection
      document.querySelectorAll('.service-option').forEach(el => {
        el.onclick = function() {
          document.querySelectorAll('.service-option').forEach(s => s.classList.remove('selected'));
          this.classList.add('selected');
          document.getElementById('selected-service').value = this.dataset.service;
        };
      });

      // Date setup
      const dateInput = document.getElementById('date');
      const today = new Date().toISOString().split('T')[0];
      dateInput.setAttribute('min', today);
      dateInput.value = today;

      // Generate time slots (9:30 AM – 4:30 PM, 30-min intervals)
      function generateTimeSlots() {
        const slots = [];
        for (let h = 9; h <= 16; h++) {
          for (let m = 0; m < 60; m += 30) {
            if (h === 16 && m > 0) break;
            if (h === 9 && m === 0) continue;
            const hour = h.toString().padStart(2, '0');
            const min = m.toString().padStart(2, '0');
            slots.push(hour + ':' + min);
          }
        }
        return slots;
      }

      function renderSlots() {
        const slots = generateTimeSlots();
        const container = document.getElementById('time-slots');
        if (!container) return;
        container.innerHTML = slots.map(time =>
          '<span class="slot" data-time="' + time + '">' + time + '</span>'
        ).join('');

        document.querySelectorAll('.slot').forEach(el => {
          el.onclick = function() {
            document.querySelectorAll('.slot').forEach(s => s.classList.remove('selected'));
            this.classList.add('selected');
            document.getElementById('selected-time').value = this.dataset.time;
          };
        });
      }
      renderSlots();
      dateInput.onchange = renderSlots;

      // Form submission
      document.getElementById('booking-form').onsubmit = async (e) => {
        e.preventDefault();

        const service = document.getElementById('selected-service').value;
        const name = document.getElementById('name').value;
        const phone = document.getElementById('phone').value;
        const date = document.getElementById('date').value;
        const time = document.getElementById('selected-time').value;

        if (!service || !name || !phone || !date || !time) {
          alert('Please fill in everything and pick a time.');
          return;
        }

        const res = await fetch('/api/book', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ service, name, phone, date, time })
        });

        const data = await res.json();
        const msg = document.getElementById('message');
        msg.style.display = 'block';
        if (data.success) {
          msg.className = 'message success';
          msg.textContent = '✅ Booking confirmed! We\'ll see you soon.';
          document.getElementById('booking-form').reset();
          document.querySelectorAll('.service-option').forEach(s => s.classList.remove('selected'));
          document.querySelectorAll('.slot').forEach(s => s.classList.remove('selected'));
          document.getElementById('selected-service').value = '';
          document.getElementById('selected-time').value = '';
          renderSlots();
        } else {
          msg.className = 'message error';
          msg.textContent = '❌ Something went wrong. Please try again.';
        }
      };
    </script>
    </body>
    </html>
  `);
});

app.post('/api/book', async (req, res) => {
  const { service, name, phone, date, time } = req.body;
  try {
    await pool.query(
      'INSERT INTO bookings (service, customer_name, customer_phone, booking_date, booking_time) VALUES ($1, $2, $3, $4, $5)',
      [service, name, phone, date, time]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

app.get('/dashboard', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Owner Dashboard</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background: #f8f6f2;
          color: #1a1a1a;
          padding: 20px;
        }
        .login-box, .dashboard-box {
          max-width: 1100px;
          margin: 40px auto;
          background: white;
          border-radius: 32px;
          padding: 35px;
          box-shadow: 0 12px 50px rgba(0,0,0,0.06);
          border: 1px solid #eee;
        }
        h2 {
          color: #1a1a1a;
          border-left: 6px solid #d4a13e;
          padding-left: 20px;
          margin-bottom: 24px;
          font-weight: 300;
        }
        input, button {
          width: 100%;
          padding: 14px;
          margin: 8px 0;
          border: 2px solid #e0e0e0;
          border-radius: 16px;
          font-size: 1rem;
          background: #fafafa;
        }
        button {
          background: #1a1a1a;
          color: white;
          font-weight: 700;
          border: none;
          cursor: pointer;
          transition: 0.3s;
        }
        button:hover { background: #d4a13e; color: #0a0a0a; }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 16px;
        }
        th, td {
          border: 1px solid #e0e0e0;
          padding: 12px;
          text-align: left;
        }
        th {
          background: #f0f0f0;
          color: #1a1a1a;
        }
        .status-btn {
          padding: 6px 14px;
          margin: 2px;
          border: none;
          border-radius: 30px;
          cursor: pointer;
          font-weight: 600;
          font-size: 0.8rem;
        }
        .status-btn.arrived { background: #2e7d32; color: white; }
        .status-btn.noshow { background: #b33636; color: white; }
        .status-btn.cancel { background: #888; color: white; }
        .logout-btn {
          background: #b33636;
          color: white;
          padding: 10px 20px;
          border: none;
          border-radius: 30px;
          cursor: pointer;
          font-weight: 600;
          margin-bottom: 16px;
        }
        .logout-btn:hover { background: #8a2626; }
        @media (max-width: 600px) {
          table, th, td { font-size: 0.75rem; }
          .login-box, .dashboard-box { padding: 18px; }
        }
      </style>
    </head>
    <body>
      <div id="app">
        <div id="login-section" class="login-box">
          <h2>🔐 Owner Login</h2>
          <input type="email" id="login-email" placeholder="Email" value="hihelloreda@gmail.com">
          <input type="password" id="login-password" placeholder="Password">
          <button onclick="login()">Login</button>
          <p id="login-error" style="color:#b33636; margin-top:10px;"></p>
        </div>
        <div id="dashboard-section" class="dashboard-box" style="display:none;">
          <h2>📋 Bookings</h2>
          <button class="logout-btn" onclick="logout()">Logout</button>
          <div id="bookings-list"><p>Loading...</p></div>
        </div>
      </div>
      <script>
        let token = null;
        async function login() {
          const email = document.getElementById('login-email').value;
          const password = document.getElementById('login-password').value;
          const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
          });
          const data = await res.json();
          if (data.success) {
            token = data.token;
            document.getElementById('login-section').style.display = 'none';
            document.getElementById('dashboard-section').style.display = 'block';
            loadBookings();
          } else {
            document.getElementById('login-error').textContent = '❌ Invalid email or password';
          }
        }
        async function loadBookings() {
          const res = await fetch('/api/bookings?token=' + token);
          const bookings = await res.json();
          if (!bookings.length) {
            document.getElementById('bookings-list').innerHTML = '<p>✨ No bookings yet.</p>';
            return;
          }
          let html = '<table><tr><th>Service</th><th>Name</th><th>Phone</th><th>Date</th><th>Time</th><th>Status</th><th>Actions</th></tr>';
          bookings.forEach(b => {
            html += '<tr>' +
              '<td>' + b.service + '</td>' +
              '<td>' + b.customer_name + '</td>' +
              '<td>' + b.customer_phone + '</td>' +
              '<td>' + b.booking_date + '</td>' +
              '<td>' + b.booking_time + '</td>' +
              '<td><strong>' + b.status + '</strong></td>' +
              '<td>' +
                '<button class="status-btn arrived" onclick="updateStatus(' + b.id + ', \'arrived\')">Arrived</button>' +
                '<button class="status-btn noshow" onclick="updateStatus(' + b.id + ', \'no-show\')">No-Show</button>' +
                '<button class="status-btn cancel" onclick="updateStatus(' + b.id + ', \'cancelled\')">Cancel</button>' +
              '</td>' +
            '</tr>';
          });
          html += '</table>';
          document.getElementById('bookings-list').innerHTML = html;
        }
        async function updateStatus(id, status) {
          await fetch('/api/update-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, status, token })
          });
          loadBookings();
        }
        function logout() {
          token = null;
          document.getElementById('login-section').style.display = 'block';
          document.getElementById('dashboard-section').style.display = 'none';
        }
      </script>
    </body>
    </html>
  `);
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const result = await pool.query('SELECT * FROM owner WHERE email = $1 AND password = $2', [email, password]);
  if (result.rows.length > 0) {
    res.json({ success: true, token: 'simple-token' });
  } else {
    res.json({ success: false });
  }
});

app.get('/api/bookings', async (req, res) => {
  if (req.query.token !== 'simple-token') return res.status(401).json([]);
  const result = await pool.query('SELECT * FROM bookings ORDER BY booking_date DESC, booking_time ASC');
  res.json(result.rows);
});

app.post('/api/update-status', async (req, res) => {
  const { id, status, token } = req.body;
  if (token !== 'simple-token') return res.status(401).json({ error: 'Unauthorized' });
  await pool.query('UPDATE bookings SET status = $1 WHERE id = $2', [status, id]);
  res.json({ success: true });
});

app.listen(port, () => console.log('✅ Barber app running on port ' + port));
