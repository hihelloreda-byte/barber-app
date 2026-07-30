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
        html { scroll-behavior: smooth; }
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background: #f8f6f2;
          color: #1a1a1a;
        }
        .navbar {
          background: #0a0a0a;
          padding: 18px 40px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 2px solid #d4a13e;
          flex-wrap: wrap;
          position: sticky;
          top: 0;
          z-index: 100;
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
          cursor: pointer;
        }
        .navbar .nav-links a:hover {
          color: #d4a13e;
        }
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
          border: 4px solid #e0e0e0;
          transition: 0.3s ease;
          cursor: pointer;
        }
        .service-card:hover {
          transform: translateY(-6px);
          box-shadow: 0 16px 50px rgba(0, 123, 255, 0.15);
        }
        .service-card.selected {
          border-color: #007bff;
          background: #f0f7ff;
          box-shadow: 0 0 0 4px rgba(0, 123, 255, 0.2), 0 8px 30px rgba(0,0,0,0.08);
          transform: scale(1.02);
        }
        .service-card .icon { font-size: 3.6rem; margin-bottom: 12px; }
        .service-card h3 { font-size: 1.5rem; color: #1a1a1a; font-weight: 600; }
        .service-card .price { color: #007bff; font-size: 1.3rem; font-weight: 700; margin: 8px 0 12px; }
        .service-card .desc { color: #666; font-size: 0.95rem; line-height: 1.5; margin-bottom: 16px; }
        .service-card .btn-book {
          background: #1a1a1a;
          color: white;
          border: none;
          padding: 12px 30px;
          border-radius: 40px;
          font-weight: 600;
          cursor: pointer;
          transition: 0.3s;
          font-size: 0.95rem;
          pointer-events: auto;
          position: relative;
          z-index: 2;
        }
        .service-card.selected .btn-book {
          background: #007bff;
          color: white;
        }
        .service-card .btn-book:hover {
          background: #0056b3;
          color: white;
        }
        .service-card.selected .btn-book:hover {
          background: #0056b3;
        }
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
        .testimonial-card .stars { color: #d4a13e; font-size: 1.4rem; letter-spacing: 2px; margin-bottom: 10px; }
        .testimonial-card p { font-size: 1rem; line-height: 1.7; color: #333; font-style: italic; }
        .testimonial-card .author { margin-top: 14px; font-weight: 600; color: #1a1a1a; font-style: normal; }
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
          color: #333;
        }
        select:focus, input:focus {
          border-color: #007bff;
          outline: none;
          background: white;
          box-shadow: 0 0 0 4px rgba(0, 123, 255, 0.1);
        }
        select option:disabled { color: #ccc; }
        .service-select-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin: 16px 0 10px;
        }
        .service-option {
          background: #fafafa;
          border: 3px solid #e0e0e0;
          border-radius: 16px;
          padding: 16px 10px;
          text-align: center;
          cursor: pointer;
          transition: 0.25s ease;
        }
        .service-option:hover {
          transform: translateY(-3px);
          box-shadow: 0 6px 20px rgba(0,0,0,0.06);
        }
        .service-option.selected {
          border-color: #007bff;
          background: #f0f7ff;
          box-shadow: 0 0 0 4px rgba(0, 123, 255, 0.15), 0 4px 15px rgba(0,0,0,0.05);
          transform: scale(1.02);
        }
        .service-option h4 { font-size: 1.1rem; color: #1a1a1a; }
        .service-option p { color: #888; font-size: 0.9rem; }
        .service-option.selected h4 { color: #007bff; }
        .service-option.selected p { color: #007bff; opacity: 0.8; }
        .btn-primary {
          background: #007bff;
          color: white;
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
          background: #0056b3;
          transform: scale(1.01);
          box-shadow: 0 10px 30px rgba(0, 123, 255, 0.25);
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
          .service-grid, .testimonial-grid, .service-select-grid { grid-template-columns: 1fr; }
          .navbar { flex-direction: column; gap: 12px; }
          .hero h1 { font-size: 2.8rem; }
          .booking-box { padding: 24px 18px; }
        }
      </style>
    </head>
    <body>
    <nav class="navbar">
      <div class="logo">✂️ Hotel Saskatchewan Barber</div>
      <div class="nav-links">
        <a href="#home">Home</a>
        <a href="#services">Services</a>
        <a href="#reviews">Reviews</a>
        <a href="#booking">Book</a>
      </div>
    </nav>
    <section id="home" class="hero">
      <h1>✂️ Hotel Saskatchewan Barber</h1>
      <p class="tagline">Quality you deserve, prices you'll love, and a name you can trust.</p>
      <p class="sub">Your trusted shop since 1927 • Located in the Hotel Saskatchewan</p>
      <div class="stars">★★★★½ <span>4.5 / 5.0 • 50+ reviews</span></div>
    </section>
    <div class="container">
      <h2 id="services" class="section-title">Our Services</h2>
      <div class="service-grid" id="mainServiceGrid">
        <div class="service-card" data-service="Haircut">
          <div class="icon">✂️</div>
          <h3>Haircut</h3>
          <div class="price">Call for pricing</div>
          <p class="desc">Classic or modern — precision cutting tailored to your style.</p>
          <button class="btn-book">Book Now</button>
        </div>
        <div class="service-card" data-service="Beard">
          <div class="icon">🧔</div>
          <h3>Beard Sculpting</h3>
          <div class="price">Call for pricing</div>
          <p class="desc">Expert shaping, line-ups, and grooming for a refined look.</p>
          <button class="btn-book">Book Now</button>
        </div>
        <div class="service-card" data-service="Hot Towel Shave">
          <div class="icon">🪒</div>
          <h3>Hot Towel Shave</h3>
          <div class="price">Call for pricing</div>
          <p class="desc">Traditional straight-razor shave with a luxurious hot towel finish.</p>
          <button class="btn-book">Book Now</button>
        </div>
      </div>
      <h2 id="reviews" class="section-title">What Our Clients Say</h2>
      <div class="testimonial-grid">
        <div class="testimonial-card">
          <div class="stars">★★★★★</div>
          <p>"I have been going to this barber shop for a little over 5 years now (I'm talking consistently, every 3-4 weeks). Service exceptional, appointments are always kept and on time. Truly a prodigious place to venture and cannot recommend it enough! I have always walked out feeling fresh, fly, and dapper!"</p>
          <div class="author">— Long-time Client</div>
        </div>
        <div class="testimonial-card">
          <div class="stars">★★★★★</div>
          <p>"Roy is a phenomenal, polite and professional barber with a definite respect for the old-school class a traditional barber shop should present. You make an appointment and receive the exact service you expect. Highly recommend for both his skill and the barbershop experience."</p>
          <div class="author">— Satisfied Customer</div>
        </div>
      </div>
      <div id="booking" class="booking-box">
        <h2>📅 Book Your Appointment</h2>
        <form id="booking-form">
          <label>Choose a service</label>
          <div class="service-select-grid" id="serviceGrid">
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
          <select id="time" required>
            <option value="">-- Select a time --</option>
            <option value="09:30">9:30 AM</option>
            <option value="10:00">10:00 AM</option>
            <option value="10:30">10:30 AM</option>
            <option value="11:00">11:00 AM</option>
            <option value="11:30">11:30 AM</option>
            <option value="12:00">12:00 PM</option>
            <option value="12:30">12:30 PM</option>
            <option value="13:00">1:00 PM</option>
            <option value="13:30">1:30 PM</option>
            <option value="14:00">2:00 PM</option>
            <option value="14:30">2:30 PM</option>
            <option value="15:00">3:00 PM</option>
            <option value="15:30">3:30 PM</option>
            <option value="16:00">4:00 PM</option>
            <option value="16:30">4:30 PM</option>
          </select>
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
      (function() {
        var mainCards = document.querySelectorAll('#mainServiceGrid .service-card');
        var formOptions = document.querySelectorAll('#serviceGrid .service-option');
        var hiddenService = document.getElementById('selected-service');
        var dateInput = document.getElementById('date');
        var timeSelect = document.getElementById('time');
        var form = document.getElementById('booking-form');
        var msgDiv = document.getElementById('message');
        var bookingSection = document.getElementById('booking');

        function deselectAll() {
          mainCards.forEach(function(c) { c.classList.remove('selected'); });
          formOptions.forEach(function(o) { o.classList.remove('selected'); });
        }

        function selectService(serviceName) {
          deselectAll();
          mainCards.forEach(function(c) {
            if (c.dataset.service === serviceName) c.classList.add('selected');
          });
          formOptions.forEach(function(o) {
            if (o.dataset.service === serviceName) o.classList.add('selected');
          });
          hiddenService.value = serviceName;
        }

        // Click on main card → select service + scroll to booking
        mainCards.forEach(function(card) {
          card.addEventListener('click', function(e) {
            // If the click is on the button, let the button handle scrolling
            if (e.target.classList.contains('btn-book')) {
              return;
            }
            var service = this.dataset.service;
            selectService(service);
            // Scroll to booking form
            bookingSection.scrollIntoView({ behavior: 'smooth' });
          });
        });

        // "Book Now" buttons inside main cards → scroll to booking
        document.querySelectorAll('.service-card .btn-book').forEach(function(btn) {
          btn.addEventListener('click', function(e) {
            e.stopPropagation(); // Prevent card click from also firing
            var card = this.closest('.service-card');
            var service = card.dataset.service;
            selectService(service);
            bookingSection.scrollIntoView({ behavior: 'smooth' });
          });
        });

        // Click on form options → select service
        formOptions.forEach(function(opt) {
          opt.addEventListener('click', function() {
            selectService(this.dataset.service);
          });
        });

        function isSunday(dateStr) {
          if (!dateStr) return false;
          var d = new Date(dateStr + 'T00:00:00');
          return d.getDay() === 0;
        }

        function updateTimeOptions() {
          var selectedDate = dateInput.value;
          var isSun = isSunday(selectedDate);
          for (var i = 1; i < timeSelect.options.length; i++) {
            timeSelect.options[i].disabled = isSun;
          }
          if (isSun) {
            timeSelect.value = '';
          }
        }

        var today = new Date().toISOString().split('T')[0];
        dateInput.setAttribute('min', today);
        dateInput.value = today;

        dateInput.addEventListener('input', function() {
          var val = this.value;
          if (isSunday(val)) {
            this.value = '';
            alert('We are closed on Sundays. Please select another day (Mon–Sat).');
            timeSelect.value = '';
            updateTimeOptions();
          } else {
            updateTimeOptions();
          }
        });

        updateTimeOptions();

        form.addEventListener('submit', async function(e) {
          e.preventDefault();
          var service = hiddenService.value;
          var name = document.getElementById('name').value.trim();
          var phone = document.getElementById('phone').value.trim();
          var date = dateInput.value;
          var time = timeSelect.value;

          if (!service) { alert('Please select a service.'); return; }
          if (!name || !phone || !date || !time) {
            alert('Please fill in all fields and select a time.');
            return;
          }
          if (isSunday(date)) {
            alert('We are closed on Sundays. Please select another day.');
            return;
          }

          try {
            var res = await fetch('/api/book', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ service: service, name: name, phone: phone, date: date, time: time })
            });
            var data = await res.json();
            msgDiv.style.display = 'block';
            if (data.success) {
              msgDiv.className = 'message success';
              msgDiv.textContent = '✅ Booking confirmed! We\'ll see you soon.';
              form.reset();
              deselectAll();
              hiddenService.value = '';
              dateInput.value = today;
              timeSelect.value = '';
              updateTimeOptions();
            } else {
              msgDiv.className = 'message error';
              msgDiv.textContent = '❌ Something went wrong. Please try again.';
            }
          } catch (err) {
            msgDiv.style.display = 'block';
            msgDiv.className = 'message error';
            msgDiv.textContent = '❌ Network error. Please check your connection.';
          }
        });
      })();
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
        button:hover { background: #007bff; color: white; }
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
        var token = null;
        async function login() {
          var email = document.getElementById('login-email').value;
          var password = document.getElementById('login-password').value;
          var res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email, password: password })
          });
          var data = await res.json();
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
          var res = await fetch('/api/bookings?token=' + token);
          var bookings = await res.json();
          if (!bookings.length) {
            document.getElementById('bookings-list').innerHTML = '<p>✨ No bookings yet.</p>';
            return;
          }
          var html = '<table><tr><th>Service</th><th>Name</th><th>Phone</th><th>Date</th><th>Time</th><th>Status</th><th>Actions</th></tr>';
          bookings.forEach(function(b) {
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
            body: JSON.stringify({ id: id, status: status, token: token })
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
