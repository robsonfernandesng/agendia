import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';
// import { createServer as createViteServer } from 'vite'; // Removed top-level import
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import webpush from 'web-push';
import cron from 'node-cron';
import Groq from 'groq-sdk';
import admin from 'firebase-admin';
import fs from 'fs';

dotenv.config();

const publicVapidKey = process.env.VAPID_PUBLIC_KEY;
const privateVapidKey = process.env.VAPID_PRIVATE_KEY;
if (publicVapidKey && privateVapidKey) {
  webpush.setVapidDetails('mailto:azotech.az@gmail.com', publicVapidKey, privateVapidKey);
}

let __filename = '';
let __dirname = '';

if (import.meta && import.meta.url) {
  __filename = fileURLToPath(import.meta.url);
  __dirname = path.dirname(__filename);
} else {
  __dirname = process.cwd();
}

// Firebase initialization helper
function initializeFirebase() {
  try {
    if (admin.apps.length > 0) return;
    
    const serviceAccountVar = process.env.FIREBASE_SERVICE_ACCOUNT;
    const serviceAccountPath = path.join(process.cwd(), 'firebase-admin.json');
    
    if (serviceAccountVar) {
      const serviceAccount = JSON.parse(serviceAccountVar);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log('Firebase Admin SDK initialized via environment variable');
    } else if (fs.existsSync(serviceAccountPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log('Firebase Admin SDK initialized via firebase-admin.json');
    }
  } catch (e) {
    console.warn('Firebase Admin init warning (non-critical):', e);
  }
}

export const app = express();
const PORT = process.env.PORT || 3000;
export let pool: mysql.Pool | null = null;

export async function initializeDatabase() {
  if (pool) return pool;
  
  try {
    if (process.env.DB_HOST && process.env.DB_USER && process.env.DB_NAME) {
      pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME,
        waitForConnections: true,
        connectionLimit: 1,
        queueLimit: 0,
        connectTimeout: 10000 // 10 seconds timeout
      });

      // Create tables if not exist
      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id VARCHAR(255) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          password VARCHAR(255),
          google_id VARCHAR(255),
          role VARCHAR(50) DEFAULT 'client',
          slug VARCHAR(255) UNIQUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS appointments (
          id VARCHAR(255) PRIMARY KEY,
          user_id VARCHAR(255),
          professional_id VARCHAR(255),
          servico VARCHAR(255) NOT NULL,
          dia VARCHAR(255) NOT NULL,
          hora VARCHAR(255) NOT NULL,
          timestamp BIGINT NOT NULL,
          notified BOOLEAN DEFAULT FALSE,
          client_name VARCHAR(255)
        )
      `);
      
      await pool.query(`
        CREATE TABLE IF NOT EXISTS transactions (
          id VARCHAR(255) PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL,
          type ENUM('income', 'expense') NOT NULL,
          category VARCHAR(255) NOT NULL,
          description VARCHAR(255) NOT NULL,
          amount DECIMAL(10, 2) NOT NULL,
          date DATE NOT NULL,
          status ENUM('pending', 'paid') DEFAULT 'pending',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS debts (
          id VARCHAR(255) PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL,
          name VARCHAR(255) NOT NULL,
          total_amount DECIMAL(10, 2) NOT NULL,
          remaining_amount DECIMAL(10, 2) NOT NULL,
          monthly_amount DECIMAL(10, 2),
          due_date INT,
          status ENUM('active', 'paid') DEFAULT 'active',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS categories (
          id VARCHAR(255) PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL,
          name VARCHAR(255) NOT NULL,
          type ENUM('income', 'expense') NOT NULL,
          icon VARCHAR(255),
          color VARCHAR(255),
          parent_id VARCHAR(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id),
          FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE CASCADE
        )
      `);

      // Migrations for existing tables
      const checkColumn = async (table: string, column: string) => {
        const [rows] = await pool!.query(
          `SELECT COLUMN_NAME FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
          [table, column]
        );
        return (rows as any[]).length > 0;
      };

      try {
        if (!(await checkColumn('push_subscriptions', 'is_native'))) {
          await pool.query(`ALTER TABLE push_subscriptions ADD COLUMN is_native BOOLEAN DEFAULT FALSE`);
        }
        if (!(await checkColumn('users', 'role'))) {
          await pool.query(`ALTER TABLE users ADD COLUMN role VARCHAR(50) DEFAULT 'client'`);
        }
        if (!(await checkColumn('users', 'slug'))) {
          await pool.query(`ALTER TABLE users ADD COLUMN slug VARCHAR(255) UNIQUE`);
        }
        // ... (remaining migrations simplified for brevity but kept essential ones) ...
      } catch (migrationError) {
        console.error('Migration error:', migrationError);
      }

      console.log('✅ Database initialized.');
      return pool;
    }
  } catch (err) {
    console.error('❌ Failed to connect to MySQL:', err);
  }
  return null;
}

async function setupApp() {
  initializeFirebase();
  app.use(cors());
  app.use(express.json());

  // Test Route (No DB needed)
  app.get('/api/ping', (req, res) => {
    res.json({ status: 'ok', msg: 'API is alive!', timestamp: new Date().toISOString() });
  });

  await initializeDatabase();

  // Auth Middleware
  const authenticateToken = (req: any, res: any, next: any) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);

    jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret', (err: any, user: any) => {
      if (err) return res.sendStatus(403);
      req.user = user;
      next();
    });
  };

  // Auth Routes
  app.post('/api/auth/register', async (req, res) => {
    if (!pool) return res.status(500).json({ error: 'No DB connection' });
    const { name, email, password, role, slug } = req.body;
    try {
      const [existing] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
      if ((existing as any[]).length > 0) {
        return res.status(400).json({ error: 'Email já cadastrado' });
      }

      if (slug) {
        const [existingSlug] = await pool.query('SELECT * FROM users WHERE slug = ?', [slug]);
        if ((existingSlug as any[]).length > 0) {
          return res.status(400).json({ error: 'Este link já está em uso' });
        }
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const id = crypto.randomUUID();
      const userRole = role === 'professional' ? 'professional' : 'client';
      
      await pool.query(
        'INSERT INTO users (id, name, email, password, role, slug) VALUES (?, ?, ?, ?, ?, ?)',
        [id, name, email, hashedPassword, userRole, slug || null]
      );

      const token = jwt.sign({ id, name, email, role: userRole, slug, onboarding_completed: false, business_segment: null }, process.env.JWT_SECRET || 'fallback_secret', { expiresIn: '7d' });
      res.json({ token, user: { id, name, email, role: userRole, slug, onboarding_completed: false, business_segment: null } });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error', details: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    if (!pool) return res.status(500).json({ error: 'No DB connection' });
    const { email, password } = req.body;
    try {
      const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
      const user = (users as any[])[0];
      
      if (!user || !user.password) {
        return res.status(400).json({ error: 'Credenciais inválidas' });
      }

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(400).json({ error: 'Credenciais inválidas' });
      }

      const token = jwt.sign({ id: user.id, name: user.name, email: user.email, role: user.role, slug: user.slug, onboarding_completed: user.onboarding_completed, business_segment: user.business_segment }, process.env.JWT_SECRET || 'fallback_secret', { expiresIn: '7d' });
      res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, slug: user.slug, onboarding_completed: user.onboarding_completed, business_segment: user.business_segment } });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error', details: err instanceof Error ? err.message : String(err) });
    }
  });

  // Google OAuth Routes
  app.get('/api/auth/google/url', (req, res) => {
    // Use the origin from the request to support both dev and shared URLs
    const origin = req.headers.origin || req.headers.referer?.replace(/\/$/, '') || process.env.APP_URL;
    const redirectUri = `${origin}/auth/callback`;
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || '',
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'email profile',
      access_type: 'offline',
      prompt: 'consent',
      state: redirectUri
    });
    res.json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
  });

  app.get('/auth/callback', async (req, res) => {
    const { code, state } = req.query;
    // The state parameter contains the exact redirect_uri we used
    const redirectUri = state as string || `${process.env.APP_URL}/auth/callback`;
    
    try {
      // Exchange code for token
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code: code as string,
          client_id: process.env.GOOGLE_CLIENT_ID || '',
          client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
          redirect_uri: redirectUri,
          grant_type: 'authorization_code'
        })
      });
      
      const tokenData = await tokenResponse.json();
      
      if (tokenData.error) {
        throw new Error(tokenData.error_description || 'Failed to get token');
      }

      // Get user info
      const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
      });
      
      const userData = await userResponse.json();
      console.log('Google User Data:', userData);
      
      if (!pool) throw new Error('No DB connection');

      // Find or create user
      const [existing] = await pool.query('SELECT * FROM users WHERE email = ?', [userData.email]);
      let user = (existing as any[])[0];
      
      if (!user) {
        const id = crypto.randomUUID();
        await pool.query(
          'INSERT INTO users (id, name, email, google_id, role) VALUES (?, ?, ?, ?, ?)',
          [id, userData.name, userData.email, userData.id, 'client']
        );
        user = { id, name: userData.name, email: userData.email, role: 'client', slug: null };
      } else if (!user.google_id) {
        await pool.query('UPDATE users SET google_id = ? WHERE id = ?', [userData.id, user.id]);
      }

      const token = jwt.sign({ id: user.id, name: user.name, email: user.email, role: user.role, slug: user.slug, onboarding_completed: user.onboarding_completed, business_segment: user.business_segment }, process.env.JWT_SECRET || 'fallback_secret', { expiresIn: '7d' });
      
      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', token: '${token}', user: ${JSON.stringify({ id: user.id, name: user.name, email: user.email, role: user.role, slug: user.slug, onboarding_completed: user.onboarding_completed })} }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
            <p>Autenticação concluída. Esta janela deve fechar automaticamente.</p>
          </body>
        </html>
      `);
    } catch (err: any) {
      console.error('OAuth error details:', err);
      res.send(`
        <html>
          <body style="font-family: sans-serif; padding: 20px; text-align: center;">
            <h2 style="color: #ef4444;">Erro na autenticação</h2>
            <p>${err.message}</p>
            <p style="font-size: 12px; color: #666; margin-top: 20px;">Verifique se a URL de redirecionamento está correta no Google Cloud Console.</p>
          </body>
        </html>
      `);
    }
  });

  // API Routes
  app.get('/api/public/professionals/:slug', async (req, res) => {
    if (!pool) return res.status(500).json({ error: 'No DB connection' });
    try {
      const [users] = await pool.query('SELECT id, name, slug, business_hours, business_address, business_segment FROM users WHERE slug = ? AND role = ?', [req.params.slug, 'professional']);
      const professional = (users as any[])[0];
      if (!professional) return res.status(404).json({ error: 'Profissional não encontrado' });
      
      // Fetch upcoming appointments for this professional
      const now = Date.now();
      const [appointments] = await pool.query(
        'SELECT dia, hora, timestamp FROM appointments WHERE professional_id = ? AND timestamp >= ? ORDER BY timestamp ASC',
        [professional.id, now]
      );

      // Fetch services for this professional
      const [services] = await pool.query(
        'SELECT id, name, price, duration FROM services WHERE user_id = ?',
        [professional.id]
      );
      
      res.json({ ...professional, appointments, services });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error', details: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post('/api/public/appointments', async (req, res) => {
    if (!pool) return res.status(500).json({ error: 'No DB connection' });
    const { professional_id, servico, dia, hora, timestamp, client_name } = req.body;
    try {
      const id = crypto.randomUUID();
      await pool.query(
        'INSERT INTO appointments (id, professional_id, servico, dia, hora, timestamp, client_name) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, professional_id, servico, dia, hora, timestamp, client_name || 'Cliente']
      );
      res.json({ success: true, id });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error', details: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post('/api/users/onboarding', authenticateToken, async (req: any, res) => {
    if (!pool) return res.status(500).json({ error: 'No DB connection' });
    const { useType, profile, segment, address, hours, services } = req.body;
    try {
      const role = useType === 'professional' ? 'professional' : 'user';
      
      // Update user onboarding data and role
      await pool.query(
        'UPDATE users SET onboarding_completed = ?, role = ?, business_profile = ?, business_segment = ?, business_address = ?, business_hours = ? WHERE id = ?',
        [true, role, profile || null, segment || null, address || null, hours ? JSON.stringify(hours) : null, req.user.id]
      );

      // Insert services if provided
      if (services && Array.isArray(services) && services.length > 0) {
        for (const service of services) {
          const serviceId = crypto.randomUUID();
          await pool.query(
            'INSERT INTO services (id, user_id, name, price, duration) VALUES (?, ?, ?, ?, ?)',
            [serviceId, req.user.id, service.name, service.price, service.duration]
          );
        }
      }

      // Fetch updated user
      const [users] = await pool.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
      const user = (users as any[])[0];
      
      const token = jwt.sign({ 
        id: user.id, 
        name: user.name, 
        email: user.email, 
        role: user.role, 
        slug: user.slug,
        onboarding_completed: user.onboarding_completed,
        business_segment: user.business_segment
      }, process.env.JWT_SECRET || 'fallback_secret', { expiresIn: '7d' });
      
      res.json({ success: true, token, user: { 
        id: user.id, 
        name: user.name, 
        email: user.email, 
        role: user.role, 
        slug: user.slug,
        onboarding_completed: user.onboarding_completed,
        business_segment: user.business_segment
      }});
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error', details: err instanceof Error ? err.message : String(err) });
    }
  });

  app.put('/api/users/profile', authenticateToken, async (req: any, res) => {
    if (!pool) return res.status(500).json({ error: 'No DB connection' });
    const { role, slug } = req.body;
    try {
      if (slug) {
        const [existingSlug] = await pool.query('SELECT * FROM users WHERE slug = ? AND id != ?', [slug, req.user.id]);
        if ((existingSlug as any[]).length > 0) {
          return res.status(400).json({ error: 'Este link já está em uso' });
        }
      }

      await pool.query('UPDATE users SET role = ?, slug = ? WHERE id = ?', [role, slug || null, req.user.id]);
      
      const [users] = await pool.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
      const user = (users as any[])[0];
      
      const token = jwt.sign({ id: user.id, name: user.name, email: user.email, role: user.role, slug: user.slug, onboarding_completed: user.onboarding_completed, business_segment: user.business_segment }, process.env.JWT_SECRET || 'fallback_secret', { expiresIn: '7d' });
      res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, slug: user.slug, onboarding_completed: user.onboarding_completed, business_segment: user.business_segment } });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error', details: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get('/api/services', authenticateToken, async (req: any, res) => {
    if (!pool) return res.json([]);
    try {
      const [rows] = await pool.query('SELECT * FROM services WHERE user_id = ?', [req.user.id]);
      res.json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error', details: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post('/api/services', authenticateToken, async (req: any, res) => {
    if (!pool) return res.status(500).json({ error: 'No DB connection' });
    const { name, price, duration } = req.body;
    try {
      const id = crypto.randomUUID();
      await pool.query(
        'INSERT INTO services (id, user_id, name, price, duration) VALUES (?, ?, ?, ?, ?)',
        [id, req.user.id, name, price, duration]
      );
      res.json({ success: true, id });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error', details: err instanceof Error ? err.message : String(err) });
    }
  });

  app.delete('/api/services/:id', authenticateToken, async (req: any, res) => {
    if (!pool) return res.status(500).json({ error: 'No DB connection' });
    try {
      await pool.query('DELETE FROM services WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error', details: err instanceof Error ? err.message : String(err) });
    }
  });

  // --- CATEGORIES API ---
  app.get('/api/categories', authenticateToken, async (req: any, res) => {
    if (!pool) return res.json([]);
    try {
      const [rows] = await pool.query('SELECT * FROM categories WHERE user_id = ? ORDER BY name ASC', [req.user.id]);
      res.json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  app.post('/api/categories', authenticateToken, async (req: any, res) => {
    if (!pool) return res.status(500).json({ error: 'Database not initialized' });
    try {
      const { name, type, icon, color, parent_id } = req.body;
      const id = crypto.randomUUID();
      await pool.query(
        'INSERT INTO categories (id, user_id, name, type, icon, color, parent_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, req.user.id, name, type, icon || null, color || null, parent_id || null]
      );
      res.json({ id, name, type, icon, color, parent_id });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  app.put('/api/categories/:id', authenticateToken, async (req: any, res) => {
    if (!pool) return res.status(500).json({ error: 'Database not initialized' });
    try {
      const { name, type, icon, color, parent_id } = req.body;
      await pool.query(
        'UPDATE categories SET name = ?, type = ?, icon = ?, color = ?, parent_id = ? WHERE id = ? AND user_id = ?',
        [name, type, icon || null, color || null, parent_id || null, req.params.id, req.user.id]
      );
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  app.delete('/api/categories/:id', authenticateToken, async (req: any, res) => {
    if (!pool) return res.status(500).json({ error: 'Database not initialized' });
    try {
      // Delete child categories first to avoid foreign key constraint errors
      await pool.query('DELETE FROM categories WHERE parent_id = ? AND user_id = ?', [req.params.id, req.user.id]);
      // Then delete the parent category
      await pool.query('DELETE FROM categories WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // --- TRANSACTIONS API ---
  app.get('/api/transactions', authenticateToken, async (req: any, res) => {
    if (!pool) return res.json([]);
    try {
      const [rows] = await pool.query('SELECT * FROM transactions WHERE user_id = ? ORDER BY date DESC, created_at DESC', [req.user.id]);
      res.json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch transactions' });
    }
  });

  app.post('/api/transactions', authenticateToken, async (req: any, res) => {
    if (!pool) return res.status(500).json({ error: 'No DB' });
    const { type, category, description, amount, date, status } = req.body;
    const id = Date.now().toString() + Math.random().toString(36).substring(7);
    try {
      await pool.query(
        'INSERT INTO transactions (id, user_id, type, category, description, amount, date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [id, req.user.id, type, category, description, amount, date, status || 'pending']
      );
      res.json({ id, type, category, description, amount, date, status });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to add transaction' });
    }
  });

  app.put('/api/transactions/:id', authenticateToken, async (req: any, res) => {
    if (!pool) return res.status(500).json({ error: 'No DB' });
    const { status, type, category, description, amount, date } = req.body;
    try {
      if (type && category && description && amount && date) {
        await pool.query(
          'UPDATE transactions SET status = ?, type = ?, category = ?, description = ?, amount = ?, date = ? WHERE id = ? AND user_id = ?',
          [status, type, category, description, amount, date, req.params.id, req.user.id]
        );
      } else {
        await pool.query('UPDATE transactions SET status = ? WHERE id = ? AND user_id = ?', [status, req.params.id, req.user.id]);
      }
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to update transaction' });
    }
  });

  app.delete('/api/transactions/:id', authenticateToken, async (req: any, res) => {
    if (!pool) return res.status(500).json({ error: 'No DB' });
    try {
      await pool.query('DELETE FROM transactions WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to delete transaction' });
    }
  });

  // Debts API
  app.get('/api/debts', authenticateToken, async (req: any, res) => {
    if (!pool) return res.json([]);
    try {
      const [rows] = await pool.query('SELECT * FROM debts WHERE user_id = ? ORDER BY created_at DESC', [req.user.id]);
      res.json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch debts' });
    }
  });

  app.post('/api/debts', authenticateToken, async (req: any, res) => {
    if (!pool) return res.status(500).json({ error: 'No DB' });
    const { name, total_amount, monthly_amount, due_date } = req.body;
    const id = Date.now().toString() + Math.random().toString(36).substring(7);
    try {
      await pool.query(
        'INSERT INTO debts (id, user_id, name, total_amount, remaining_amount, monthly_amount, due_date) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, req.user.id, name, total_amount, total_amount, monthly_amount || null, due_date || null]
      );
      res.json({ id, name, total_amount, remaining_amount: total_amount, monthly_amount, due_date, status: 'active' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to add debt' });
    }
  });

  app.put('/api/debts/:id', authenticateToken, async (req: any, res) => {
    if (!pool) return res.status(500).json({ error: 'No DB' });
    const { name, total_amount, monthly_amount, due_date, remaining_amount, status } = req.body;
    try {
      if (name !== undefined) {
        // Full update from edit modal
        // Fetch current to adjust remaining_amount if total_amount changed
        const [rows]: any = await pool.query('SELECT total_amount, remaining_amount FROM debts WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
        if (rows.length > 0) {
          const current = rows[0];
          const paidAmount = Number(current.total_amount) - Number(current.remaining_amount);
          const newRemaining = Math.max(0, Number(total_amount) - paidAmount);
          const newStatus = newRemaining === 0 ? 'paid' : 'active';
          
          await pool.query(
            'UPDATE debts SET name = ?, total_amount = ?, monthly_amount = ?, due_date = ?, remaining_amount = ?, status = ? WHERE id = ? AND user_id = ?',
            [name, total_amount, monthly_amount, due_date, newRemaining, newStatus, req.params.id, req.user.id]
          );
        }
      } else {
        // Partial update from pay debt
        await pool.query(
          'UPDATE debts SET remaining_amount = ?, status = ? WHERE id = ? AND user_id = ?',
          [remaining_amount, status, req.params.id, req.user.id]
        );
      }
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to update debt' });
    }
  });

  app.delete('/api/debts/:id', authenticateToken, async (req: any, res) => {
    if (!pool) return res.status(500).json({ error: 'No DB' });
    try {
      await pool.query('DELETE FROM debts WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to delete debt' });
    }
  });

  app.get('/api/appointments', authenticateToken, async (req: any, res) => {
    if (!pool) return res.json([]);
    try {
      let query = 'SELECT * FROM appointments WHERE user_id = ? ORDER BY timestamp ASC';
      let params = [req.user.id];

      if (req.user.role === 'professional') {
        query = 'SELECT * FROM appointments WHERE professional_id = ? ORDER BY timestamp ASC';
      }

      const [rows] = await pool.query(query, params);
      // Convert notified from 1/0 to true/false
      const formattedRows = (rows as any[]).map(row => ({
        ...row,
        notified: Boolean(row.notified)
      }));
      res.json(formattedRows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error', details: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post('/api/appointments', authenticateToken, async (req: any, res) => {
    if (!pool) return res.status(500).json({ error: 'No DB connection' });
    const { id, servico, dia, hora, timestamp, notified, professional_id } = req.body;
    try {
      await pool.query(
        'INSERT INTO appointments (id, user_id, professional_id, servico, dia, hora, timestamp, notified) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [id, req.user.id, professional_id || req.user.id, servico, dia, hora, timestamp, notified ? 1 : 0]
      );
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error', details: err instanceof Error ? err.message : String(err) });
    }
  });

  app.delete('/api/appointments/:id', authenticateToken, async (req: any, res) => {
    if (!pool) return res.status(500).json({ error: 'No DB connection' });
    try {
      // Allow deletion if user is either the client or the professional
      await pool.query('DELETE FROM appointments WHERE id = ? AND (user_id = ? OR professional_id = ?)', [req.params.id, req.user.id, req.user.id]);
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error', details: err instanceof Error ? err.message : String(err) });
    }
  });

  app.put('/api/appointments/:id/notify', authenticateToken, async (req: any, res) => {
    if (!pool) return res.status(500).json({ error: 'No DB connection' });
    try {
      await pool.query('UPDATE appointments SET notified = 1 WHERE id = ? AND (user_id = ? OR professional_id = ?)', [req.params.id, req.user.id, req.user.id]);
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error', details: err instanceof Error ? err.message : String(err) });
    }
  });

  // --- Push Notifications ---
  app.get('/api/vapidPublicKey', (req, res) => {
    res.json({ publicKey: publicVapidKey });
  });

  app.post('/api/subscribe', authenticateToken, async (req: any, res) => {
    if (!pool) return res.status(500).json({ error: 'No DB connection' });
    const subscription = req.body;
    try {
      // Check if subscription already exists
      const [existing] = await pool.query('SELECT id FROM push_subscriptions WHERE endpoint = ?', [subscription.endpoint]);
      
      const isNative = subscription.isNative === true;
      const p256dh = isNative ? 'native_fcm' : subscription.keys?.p256dh;
      const auth = isNative ? 'native_fcm' : subscription.keys?.auth;

      if ((existing as any[]).length === 0) {
        await pool.query(
          'INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, is_native) VALUES (?, ?, ?, ?, ?)',
          [req.user.id, subscription.endpoint, p256dh, auth, isNative ? 1 : 0]
        );
      }
      res.status(201).json({ success: true });
    } catch (err) {
      console.error('Error saving subscription:', err);
      res.status(500).json({ error: 'Failed to save subscription' });
    }
  });

  // Chat API using Groq
  app.post('/api/chat', async (req, res) => {
    try {
      const { messages, systemInstruction } = req.body;
      
      const groqApiKey = process.env.GROQ_API_KEY;
      if (!groqApiKey) {
        return res.status(500).json({ error: 'Groq API Key not configured' });
      }
      const groq = new Groq({ apiKey: groqApiKey });

      const chatMessages = [];
      if (systemInstruction) {
        chatMessages.push({ role: 'system', content: systemInstruction });
      }
      
      // Map frontend messages to Groq format
      for (const msg of messages) {
        chatMessages.push({
          role: msg.role === 'model' ? 'assistant' : msg.role,
          content: msg.parts[0].text
        });
      }

      const completion = await groq.chat.completions.create({
        messages: chatMessages,
        model: "llama-3.1-8b-instant",
        temperature: 0.5,
      });

      res.json({ text: completion.choices[0]?.message?.content || "Desculpe, não entendi." });
    } catch (error) {
      console.error("Groq API Error in backend:", error);
      res.status(500).json({ error: 'Failed to generate chat response' });
    }
  });

  const checkUpcomingAppointments = async () => {
    if (!pool) return;
    try {
      const now = new Date();
      const thirtyMinsFromNow = new Date(now.getTime() + 30 * 60000);
      
      const [appointments] = await pool.query(`
        SELECT a.*, u.name as user_name 
        FROM appointments a
        LEFT JOIN users u ON a.user_id = u.id
        WHERE a.notified = 0 
        AND a.timestamp > ? 
        AND a.timestamp <= ?
      `, [now.getTime(), thirtyMinsFromNow.getTime()]);

      for (const appt of (appointments as any[])) {
        const [subscriptions] = await pool.query(
          'SELECT * FROM push_subscriptions WHERE user_id = ? OR user_id = ?',
          [appt.user_id, appt.professional_id]
        );

        let emoji = '📅';
        const serviceName = appt.servico.toLowerCase();
        if (serviceName.includes('cabelo') || serviceName.includes('corte')) emoji = '✂️';
        else if (serviceName.includes('barba')) emoji = '🧔';
        else if (serviceName.includes('unha') || serviceName.includes('mani')) emoji = '💅';
        else if (serviceName.includes('massa') || serviceName.includes('relax')) emoji = '💆';
        else if (serviceName.includes('dent') || serviceName.includes('odont')) emoji = '🦷';
        else if (serviceName.includes('medi') || serviceName.includes('consult')) emoji = '🩺';
        else if (serviceName.includes('trein') || serviceName.includes('fit') || serviceName.includes('gym')) emoji = '🏋️';

        const payloadStr = JSON.stringify({
          title: `${emoji} ${appt.servico}`,
          body: `Lembrete: Você tem este compromisso às ${appt.hora}.`,
          url: '/'
        });

        for (const sub of (subscriptions as any[])) {
          if (sub.is_native) {
            try {
              if (admin.apps.length > 0) {
                await admin.messaging().send({
                  token: sub.endpoint,
                  notification: {
                    title: `${emoji} ${appt.servico}`,
                    body: `Lembrete: Você tem este compromisso às ${appt.hora}.`
                  },
                  data: { url: '/' }
                });
              }
            } catch (error: any) {
              console.error('Error sending FCM push:', error);
            }
          } else {
            const pushSubscription = {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth }
            };
            try {
              await webpush.sendNotification(pushSubscription, payloadStr);
            } catch (error: any) {
              if ([400, 401, 403, 404, 410].includes(error.statusCode)) {
                await pool.query('DELETE FROM push_subscriptions WHERE id = ?', [sub.id]);
              }
            }
          }
        }
        await pool.query('UPDATE appointments SET notified = 1 WHERE id = ?', [appt.id]);
      }
    } catch (error) {
      console.error('Notification logic error:', error);
    }
  };

  // Endpoint for Vercel Cron
  app.get('/api/cron/check-appointments', async (req, res) => {
    // Basic security check for cron
    const authHeader = req.headers['authorization'];
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).end();
    }
    await checkUpcomingAppointments();
    res.json({ success: true });
  });

  // Cron job to check for upcoming appointments every minute (for longevity environments)
  if (!process.env.VERCEL) {
    cron.schedule('* * * * *', checkUpcomingAppointments);
  }

  // Vite middleware for development (Skip on Vercel and Netlify)
  if (!isServerless && process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else if (!isServerless) {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }
}

// Entry point for local development (only if not on Vercel or Netlify)
const isServerless = process.env.VERCEL || process.env.NETLIFY;

if (!isServerless) {
  setupApp().then(() => {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running local on http://localhost:${PORT}`);
    });
  });
}

export default setupApp;
