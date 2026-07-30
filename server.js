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
          background: #121212;
          color: #e0e0e0;
        }
        .hero {
          background: linear-gradient(135deg, #0a0a0a 0%, #2a1a0e 100%);
          padding: 80px 20px 60px;
          text-align: center;
          border-bottom: 3px solid #d4a13e;
        }
        .hero h1 {
          font-size: 4.2rem;
          font-weight: 300;
          letter-spacing: 8px;
          color: #d4a13e;
          text-shadow: 0 4px 40px rgba(212, 161, 62, 0.25);
        }
        .hero p {
          font-size: 1.4rem;
          opacity: 0.8;
          margin-top: 12px;
          color: #ccc;
        }
        .container {
          max-width: 1100px;
          margin: 0 auto;
          padding: 40px 20px;
        }
        .section-title {
          color: #d4a13e;
          font-size: 2.4rem;
          font-weight: 300;
          text-align: center;
          border-bottom: 2px solid #d4a13e;
          padding-bottom: 16px;
          margin-bottom: 40px;
          letter-spacing: 2px;
        }
        .testimonial {
          background: #1e1e1e;
          border-radius: 24px;
          padding: 40px 35px;
          border-left: 6px solid #d4a13e;
          margin-bottom: 50px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.5);
        }
        .testimonial p {
          font-size: 1.15rem;
          line-height: 1.8;
          color: #ccc;
          font-style: italic;
        }
        .testimonial .source {
          margin-top: 16px;
          color: #d4a13e;
          font-style: normal;
          font-weight: 600;
        }
        .gallery-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
          margin: 40px 0 50px;
        }
        .gallery-grid img {
          width: 100%;
          height: 260px;
          object-fit: cover;
          border-radius: 20px;
          border: 2px solid #333;
          transition: 0.4s ease;
          box-shadow: 0 8px 30px rgba(0,0,0,0.6);
        }
        .gallery-grid img:hover {
          transform: scale(1.02);
          border-color: #d4a13e;
          box-shadow: 0 12px 40px rgba(212, 161, 62, 0.2);
        }
        .booking-box {
          background: #1a1a1a;
          border-radius: 32px;
          padding: 40px 35px;
          border: 1px solid #2a2a2a;
          box-shadow: 0 20px 60px rgba(0,0,0,0.6);
          margin-top: 20px;
        }
        .booking-box h2 {
          color: #d4a13e;
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
          color: #bbb;
          font-size: 0.95rem;
          letter-spacing: 0.5px;
        }
        select, input {
          width: 100%;
          padding: 16px 20px;
          border: 2px solid #333;
          border-radius: 16px;
          font-size: 1rem;
          background: #0f0f0f;
          color: #e0e0e0;
          transition: 0.3s;
          margin-top: 8px;
        }
        select:focus, input:focus {
          border-color: #d4a13e;
          outline: none;
          background: #1a1a1a;
          box-shadow: 0 0 0 4px rgba(212, 161, 62, 0.1);
        }
        .service-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
          margin: 20px 0 10px;
        }
        .service-card {
          background: #0f0f0f;
          border: 2px solid #2a2a2a;
          border-radius: 20px;
          padding: 20px 12px;
          text-align: center;
          cursor: pointer;
          transition: 0.3s ease;
        }
        .service-card.selected {
          border-color: #d4a13e;
          background: #1f140a;
          box-shadow: 0 0 0 3px rgba(212, 161, 62, 0.2);
          transform: scale(1.02);
        }
        .service-card h4 {
          font-size: 1.2rem;
          color: #d4a13e;
          margin: 8px 0 4px;
        }
        .service-card p {
          color: #999;
          font-size: 0.95rem;
        }
        #time-slots {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin: 16px 0 8px;
        }
        .slot {
          background: #0f0f0f;
          padding: 14px 22px;
          border-radius: 40px;
          font-weight: 500;
          cursor: pointer;
          transition: 0.2s;
          border: 2px solid #2a2a2a;
          color: #bbb;
        }
        .slot.selected {
          background: #d4a13e;
          color: #121212;
          border-color: #d4a13e;
          font-weight: 700;
        }
        .btn {
          background: #d4a13e;
          color: #121212;
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
        .btn:hover {
          background: #b8892e;
          transform: scale(1.01);
          box-shadow: 0 10px 30px rgba(212, 161, 62, 0.25);
        }
        .message {
          margin-top: 24px;
          padding: 16px;
          border-radius: 16px;
          text-align: center;
          font-weight: 600;
        }
        .message.success { background: #1a2a1a; color: #8bc34a; }
        .message.error { background: #2a1a1a; color: #ef5350; }
        .footer {
          text-align: center;
          padding: 30px 20px;
          color: #666;
          font-size: 0.9rem;
          border-top: 1px solid #2a2a2a;
          margin-top: 40px;
        }
        @media (max-width: 768px) {
          .gallery-grid { grid-template-columns: 1fr; }
          .service-grid { grid-template-columns: 1fr; }
          .hero h1 { font-size: 2.6rem; }
          .booking-box { padding: 24px 18px; }
        }
      </style>
    </head>
    <body>

    <div class="hero">
      <h1>✂️ Hotel Saskatchewan Barber</h1>
      <p>Premium cuts • Beard sculpting • Hot towel shaves</p>
    </div>

    <div class="container">

      <!-- Testimonial Section -->
      <div class="testimonial">
        <p>“Customer feedback indicates that Hotel Saskatchewan Barber Shop offers a notably welcoming atmosphere with friendly staff and attractive, stylish surroundings. Many customers praise the professionalism of barbers like Roy, highlighting their skillful techniques and attentive service. The shop’s sophisticated ambiance adds to an overall positive experience appreciated by visitors seeking quality grooming in a refined setting.</p>
        <p style="margin-top:16px;">Notable points include appreciation for the cozy environment within the elegant hotel itself and recognition of helpful staff members who create a comfortable visit.”</p>
        <div class="source">— Hotel Saskatchewan Barber Shop • Regina</div>
      </div>

      <!-- Gallery Section -->
      <h2 class="section-title">Our Space</h2>
      <div class="gallery-grid">
        <img src="https://s3-media0.fl.yelpcdn.com/bphoto/bPQs5Kz7I6rrKqp_jSk_bA/348s.jpg" alt="Barber shop interior">
        <img src="https://pointsmilesandbling.com/wp-content/uploads/2025/07/SK-Hotel-Barber-shop-scaled.jpg" alt="Barber shop styling">
        <img src="https://s3-media0.fl.yelpcdn.com/bphoto/kwma-GgeP6sssWD7jAdWBQ/348s.jpg" alt="Barber at work">
      </div>

      <!-- Booking Section -->
      <div class="booking-box">
        <h2>📅 Book your appointment</h2>
        <form id="booking-form">
          <label>Choose a service</label>
          <div class="service-grid" id="service-grid">
            <div class="service-card" data-service="Haircut">
              <h4>✂️ Haircut</h4>
              <p>$35</p>
            </div>
            <div class="service-card" data-service="Beard">
              <h4>🧔 Beard</h4>
              <p>$20</p>
            </div>
            <div class="service-card" data-service="Hot Towel Shave">
              <h4>🪒 Hot Towel Shave</h4>
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
    </div>

    <div class="footer">
      <p>📍 Hotel Saskatchewan, Regina • (306) 522-0275</p>
      <p style="color:#555;">Mon–Sat 9:30 AM – 5:00 PM • Closed Sundays • Holiday hours may differ</p>
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
          background: #121212;
          color: #e0e0e0;
          padding: 20px;
        }
        .login-box, .dashboard-box {
          max-width: 1000px;
          margin: 40px auto;
          background: #1a1a1a;
          border-radius: 32px;
          padding: 35px;
          border: 1px solid #2a2a2a;
          box-shadow: 0 20px 60px rgba(0,0,0,0.6);
        }
        h2 {
          color: #d4a13e;
          border-left: 6px solid #d4a13e;
          padding-left: 20px;
          margin-bottom: 24px;
        }
        input, button {
          width: 100%;
          padding: 14px;
          margin: 8px 0;
          border: 2px solid #2a2a2a;
          border-radius: 16px;
          font-size: 1rem;
          background: #0f0f0f;
          color: #e0e0e0;
        }
        button {
          background: #d4a13e;
          color: #121212;
          font-weight: 700;
          border: none;
          cursor: pointer;
          transition: 0.3s;
        }
        button:hover { background: #b8892e; }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 16px;
        }
        th, td {
          border: 1px solid #2a2a2a;
          padding: 12px;
          text-align: left;
        }
        th {
          background: #0f0f0f;
          color: #d4a13e;
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
        .status-btn.cancel { background: #666; color: white; }
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
          <p id="login-error" style="color:#ef5350; margin-top:10px;"></p>
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
