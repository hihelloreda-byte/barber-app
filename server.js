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
        /* --- MAIN SERVICE CARDS (Selectable) --- */
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
          border: 3px solid #eee;
          transition: 0.3s ease;
          cursor: pointer;
        }
        .service-card:hover {
          transform: translateY(-6px);
          box-shadow: 0 16px 50px rgba(212, 161, 62, 0.12);
        }
        .service-card.selected {
          border-color: #d4a13e;
          box-shadow: 0 0 0 4px rgba(212, 161, 62, 0.2), 0 8px 30px rgba(0,0,0,0.08);
          background: #fdf6ed;
        }
        .service-card .icon { font-size: 3.6rem; margin-bottom: 12px; }
        .service-card h3 { font-size: 1.5rem; color: #1a1a1a; font
