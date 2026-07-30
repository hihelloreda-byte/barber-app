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
          background: #f8f4f0;
          color: #1e1e2a;
        }
        .hero {
          background: linear-gradient(135deg, #0b1a2e 0%, #1e3a5f 100%);
          color: white;
          padding: 50px 20px 40px;
          text-align: center;
        }
        .hero h1 {
          font-size: 2.8rem;
          letter-spacing: 2px;
        }
        .hero p {
          font-size: 1.2rem;
          opacity: 0.9;
          margin-top: 10px;
        }
        .container {
          max-width: 700px;
          margin: -30px auto 40px;
          background: white;
          border-radius: 24px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.12);
          padding: 30px 25px;
          position: relative;
          z-index: 2;
        }
        h2 {
          color: #1e3a5f;
          border-left: 6px solid #d4a13e;
          padding-left: 16px;
          margin-bottom: 24px;
        }
        label {
          font-weight: 600;
          display: block;
          margin-top: 16px;
          color: #1e3a5f;
        }
        select, input {
          width: 100%;
          padding: 14px 16px;
          border: 2px solid #e2dcd6;
          border-radius: 14px;
          font-size: 1rem;
          background: #fcfaf8;
          transition: 0.2s;
          margin-top: 6px;
        }
        select:focus, input:focus {
          border-color: #d4a13e;
          outline: none;
          background: white;
          box-shadow: 0 0 0 4px rgba(212, 161, 62, 0.15);
        }
        .service-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 12px;
          margin: 16px 0;
        }
        .service-card {
          background: #fcfaf8;
          border: 2px solid #e2dcd6;
          border-radius: 16px;
          padding: 16px 8px;
          text-align: center;
          cursor: pointer;
          transition: 0.2s;
        }
        .service-card.selected {
          border-color: #d4a13e;
          background: #fff7eb;
          box-shadow: 0 0 0 3px rgba(212, 161, 62, 0.2);
        }
        .service-card img {
          width: 100%;
          max-height: 90px;
          object-fit: cover;
          border-radius: 12px;
          margin-bottom: 8px;
        }
        .service-card h4 {
          font-size: 1rem;
          color: #1e3a5f;
        }
        .service-card p {
          font-size: 0.85rem;
          color: #666;
        }
        #time-slots {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin: 12px 0;
        }
        .slot {
          background: #f0ebe6;
          padding: 12px 18px;
          border-radius: 40px;
          font-weight: 500;
          cursor: pointer;
          transition: 0.15s;
          border: 2px solid transparent;
        }
        .slot.selected {
          background: #1e3a5f;
          color: white;
          border-color: #d4a13e;
        }
        .btn {
          background: #d4a13e;
          color: white;
          border: none;
          padding: 16px;
          width: 100%;
          border-radius: 40px;
          font-size: 1.2rem;
          font-weight: 700;
          margin-top: 24px;
          cursor: pointer;
          transition: 0.2s;
        }
        .btn:hover {
          background: #b8892e;
          transform: scale(1.01);
        }
        .footer {
          text-align: center;
          padding: 20px;
          color: #888;
          font-size: 0.9rem;
        }
        .message {
          margin-top: 20px;
          padding: 14px;
          border-radius: 12px;
          text-align: center;
          font-weight: 500;
        }
        .message.success { background: #e3f5e9; color: #0f6e3f; }
        .message.error { background: #fde8e8; color: #b33636; }
        @media (max-width: 600px) {
          .service-grid { grid-template-columns: 1fr; }
          .hero h1 { font-size: 2rem; }
        }
      </style>
    </head>
    <body>
    <div class="hero">
      <h1>✂️ Hotel Saskatchewan Barber</h1>
      <p>Premium cuts • Beard sculpting • Hot towel shaves</p>
    </div>
    <div class="container">
      <h2>📅 Book your appointment</h2>
      <form id="booking-form">
        <label>Choose a service</label>
        <div class="service-grid" id="service-grid">
          <div class="service-card" data-service="Haircut">
            <img src="https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=200&h=150&fit=crop&auto=format" alt="Haircut">
            <h4>Haircut</h4>
            <p>$35</p>
          </div>
          <div class="service-card" data-service="Beard">
            <img src="https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=200&h=150&fit=crop&auto=format" alt="Beard">
            <h4>Beard</h4>
            <p>$20</p>
          </div>
          <div class="service-card" data-service="Hot Towel Shave">
            <img src="https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=200&h=150&fit=crop&auto=format" alt="Shave">
            <h4>Hot Towel Shave</h4>
            <p>Inquire</p>
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
        <button type="submit" class="btn">✂️ Book Now</button>
        <div id="message" class="message" style="display:none;"></div>
      </form>
    </div>
    <div class="footer">
      <p>📍 Hotel Saskatchewan, Regina • (306) 522-0275</p>
      <p style="font-size:0.8rem; color:#999;">Mon–Sat 9:30 AM – 5:00 PM • Closed Sundays • Holiday hours may differ</p>
    </div>
    <script>
      document.querySelectorAll('.service-card').forEach(card => {
        card.onclick = function() {
          document.querySelectorAll('.service-card').forEach(c => c.classList.remove('selected'));
          this.classList.add('selected');
          document.getElementById('selected-service').value = this.dataset.service;
        };
      });
      const dateInput = document.getElementById('date');
      const today = new Date().toISOString().split('T')[0];
      dateInput.setAttribute('min', today);
      dateInput.value = today;
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
          document.querySelectorAll('.service-card').forEach(c => c.classList.remove('selected'));
          document.querySelectorAll('.slot').forEach(s => s.classList.remove('selected'));
          document.getElementById('selected-service').value = '';
          document.getElementById('selected-time').value = '';
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
          background: #f8f4f0;
          padding: 20px;
        }
        .login-box, .dashboard-box {
          max-width: 900px;
          margin: 40px auto;
          background: white;
          border-radius: 24px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.12);
          padding: 30px;
        }
        h2 {
          color: #1e3a5f;
          border-left: 6px solid #d4a13e;
          padding-left: 16px;
          margin-bottom: 24px;
        }
        input, button {
          width: 100%;
          padding: 14px;
          margin: 8px 0;
          border: 2px solid #e2dcd6;
          border-radius: 14px;
          font-size: 1rem;
        }
        button {
          background: #1e3a5f;
          color: white;
          font-weight: 700;
          border: none;
          cursor: pointer;
          transition: 0.2s;
        }
        button:hover { background: #d4a13e; }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 16px;
        }
        th, td {
          border: 1px solid #e2dcd6;
          padding: 10px;
          text-align: left;
        }
        th {
          background: #1e3a5f;
          color: white;
        }
        .status-btn {
          padding: 6px 12px;
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
          table, th, td { font-size: 0.8rem; }
          .login-box, .dashboard-box { padding: 16px; }
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
          <p id="login-error" style="color:red; margin-top:10px;"></p>
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
