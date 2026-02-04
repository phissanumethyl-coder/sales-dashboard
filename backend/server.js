const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// PostgreSQL Connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

app.use(cors());
app.use(express.json());

// Initialize Database Tables
const initDatabase = async () => {
  const client = await pool.connect();
  try {
    // Users table
    await client.query(`CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      role VARCHAR(50) DEFAULT 'user',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    // Branches table
    await client.query(`CREATE TABLE IF NOT EXISTS branches (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      color VARCHAR(50) DEFAULT '#3b82f6',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    // Employees table
    await client.query(`CREATE TABLE IF NOT EXISTS employees (
      id SERIAL PRIMARY KEY,
      branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    // Monthly Targets table
    await client.query(`CREATE TABLE IF NOT EXISTS monthly_targets (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
      year INTEGER,
      month INTEGER,
      target_facebook DECIMAL DEFAULT 0,
      target_shopee DECIMAL DEFAULT 0,
      target_lazada DECIMAL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(employee_id, year, month)
    )`);

    // Sales table
    await client.query(`CREATE TABLE IF NOT EXISTS sales (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
      channel VARCHAR(50) CHECK(channel IN ('facebook', 'shopee', 'lazada')),
      amount DECIMAL NOT NULL,
      sale_date DATE NOT NULL,
      year INTEGER,
      month INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    // Expenses table
    await client.query(`CREATE TABLE IF NOT EXISTS expenses (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
      type VARCHAR(50) CHECK(type IN ('cost', 'ads', 'fees')),
      amount DECIMAL NOT NULL,
      expense_date DATE NOT NULL,
      year INTEGER,
      month INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    // Create admin user if not exists
    const adminCheck = await client.query('SELECT id FROM users WHERE username = $1', ['admin']);
    if (adminCheck.rows.length === 0) {
      const hashedPassword = bcrypt.hashSync('admin123', 10);
      await client.query('INSERT INTO users (username, password, name, role) VALUES ($1, $2, $3, $4)', 
        ['admin', hashedPassword, 'ผู้ดูแลระบบ', 'admin']);
      console.log('✅ Created admin user');
    }

    console.log('✅ Database initialized successfully');
  } catch (err) {
    console.error('❌ Database initialization error:', err);
  } finally {
    client.release();
  }
};

// Auth Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'ไม่พบ Token' });
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token ไม่ถูกต้องหรือหมดอายุ' });
    req.user = user;
    next();
  });
};

// Routes
app.get('/', (req, res) => res.json({ message: '🚀 Sales Dashboard API v4 (PostgreSQL)', status: 'ok' }));
app.get('/api', (req, res) => res.json({ message: '🚀 Sales Dashboard API v4 (PostgreSQL)', status: 'ok' }));

// Auth
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    const user = result.rows[0];
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
    }
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, username: user.username, name: user.name, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Branches
app.get('/api/branches', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM branches ORDER BY id');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/branches', authenticateToken, async (req, res) => {
  try {
    const { name, color } = req.body;
    const result = await pool.query('INSERT INTO branches (name, color) VALUES ($1, $2) RETURNING *', [name, color || '#3b82f6']);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/branches/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, color } = req.body;
    await pool.query('UPDATE branches SET name = $1, color = $2 WHERE id = $3', [name, color || '#3b82f6', id]);
    res.json({ id, name, color });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/branches/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM branches WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Employees
app.get('/api/employees', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT e.*, b.name as branch_name 
      FROM employees e 
      JOIN branches b ON e.branch_id = b.id 
      ORDER BY e.id
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/employees', authenticateToken, async (req, res) => {
  try {
    const { branch_id, name } = req.body;
    const result = await pool.query('INSERT INTO employees (branch_id, name) VALUES ($1, $2) RETURNING *', [branch_id, name]);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/employees/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    await pool.query('UPDATE employees SET name = $1 WHERE id = $2', [name, id]);
    res.json({ id, name });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/employees/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM employees WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Monthly Targets
app.get('/api/targets', authenticateToken, async (req, res) => {
  try {
    const { employee_id, year, month } = req.query;
    let sql = 'SELECT * FROM monthly_targets WHERE 1=1';
    const params = [];
    let paramIndex = 1;
    if (employee_id) { sql += ` AND employee_id = $${paramIndex++}`; params.push(employee_id); }
    if (year) { sql += ` AND year = $${paramIndex++}`; params.push(year); }
    if (month) { sql += ` AND month = $${paramIndex++}`; params.push(month); }
    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/targets', authenticateToken, async (req, res) => {
  try {
    const { employee_id, year, month, target_facebook, target_shopee, target_lazada } = req.body;
    const existing = await pool.query('SELECT id FROM monthly_targets WHERE employee_id = $1 AND year = $2 AND month = $3', [employee_id, year, month]);
    
    if (existing.rows.length > 0) {
      await pool.query('UPDATE monthly_targets SET target_facebook = $1, target_shopee = $2, target_lazada = $3 WHERE id = $4',
        [target_facebook || 0, target_shopee || 0, target_lazada || 0, existing.rows[0].id]);
      res.json({ id: existing.rows[0].id, updated: true });
    } else {
      const result = await pool.query('INSERT INTO monthly_targets (employee_id, year, month, target_facebook, target_shopee, target_lazada) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [employee_id, year, month, target_facebook || 0, target_shopee || 0, target_lazada || 0]);
      res.json(result.rows[0]);
    }
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Sales
app.post('/api/sales', authenticateToken, async (req, res) => {
  try {
    const { employee_id, channel, amount, year, month } = req.body;
    const sale_date = `${year}-${String(month).padStart(2, '0')}-01`;
    const existing = await pool.query('SELECT id FROM sales WHERE employee_id = $1 AND channel = $2 AND year = $3 AND month = $4', [employee_id, channel, year, month]);
    
    if (existing.rows.length > 0) {
      await pool.query('UPDATE sales SET amount = $1 WHERE id = $2', [amount, existing.rows[0].id]);
      res.json({ id: existing.rows[0].id, updated: true });
    } else {
      const result = await pool.query('INSERT INTO sales (employee_id, channel, amount, sale_date, year, month) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [employee_id, channel, amount, sale_date, year, month]);
      res.json(result.rows[0]);
    }
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Expenses
app.post('/api/expenses', authenticateToken, async (req, res) => {
  try {
    const { employee_id, type, amount, year, month } = req.body;
    const expense_date = `${year}-${String(month).padStart(2, '0')}-01`;
    const existing = await pool.query('SELECT id FROM expenses WHERE employee_id = $1 AND type = $2 AND year = $3 AND month = $4', [employee_id, type, year, month]);
    
    if (existing.rows.length > 0) {
      await pool.query('UPDATE expenses SET amount = $1 WHERE id = $2', [amount, existing.rows[0].id]);
      res.json({ id: existing.rows[0].id, updated: true });
    } else {
      const result = await pool.query('INSERT INTO expenses (employee_id, type, amount, expense_date, year, month) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [employee_id, type, amount, expense_date, year, month]);
      res.json(result.rows[0]);
    }
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Dashboard
app.get('/api/dashboard', authenticateToken, async (req, res) => {
  try {
    const { year = 2026, month = 1 } = req.query;
    const y = parseInt(year);
    const m = parseInt(month);

    const branchesResult = await pool.query('SELECT * FROM branches ORDER BY id');
    const branches = branchesResult.rows;
    
    const result = await Promise.all(branches.map(async (branch) => {
      const employeesResult = await pool.query('SELECT * FROM employees WHERE branch_id = $1 ORDER BY id', [branch.id]);
      const employees = employeesResult.rows;
      
      const employeesWithData = await Promise.all(employees.map(async (emp) => {
        // Get target
        const targetResult = await pool.query('SELECT * FROM monthly_targets WHERE employee_id = $1 AND year = $2 AND month = $3', [emp.id, y, m]);
        const target = targetResult.rows[0] || {};
        
        // Get sales
        const salesResult = await pool.query('SELECT channel, SUM(amount) as total FROM sales WHERE employee_id = $1 AND year = $2 AND month = $3 GROUP BY channel', [emp.id, y, m]);
        const sales = { facebook: 0, shopee: 0, lazada: 0 };
        salesResult.rows.forEach(s => sales[s.channel] = parseFloat(s.total) || 0);
        
        // Get expenses
        const expenseResult = await pool.query('SELECT type, SUM(amount) as total FROM expenses WHERE employee_id = $1 AND year = $2 AND month = $3 GROUP BY type', [emp.id, y, m]);
        const expenses = { cost: 0, ads: 0, fees: 0 };
        expenseResult.rows.forEach(e => expenses[e.type] = parseFloat(e.total) || 0);
        
        const totalSales = sales.facebook + sales.shopee + sales.lazada;
        const totalTarget = parseFloat(target.target_facebook || 0) + parseFloat(target.target_shopee || 0) + parseFloat(target.target_lazada || 0);
        const totalExpenses = expenses.cost + expenses.ads + expenses.fees;
        
        return {
          ...emp,
          targets: { facebook: parseFloat(target.target_facebook) || 0, shopee: parseFloat(target.target_shopee) || 0, lazada: parseFloat(target.target_lazada) || 0, total: totalTarget },
          sales, expenses, totalSales, totalExpenses,
          netProfit: totalSales - totalExpenses,
          performancePct: totalTarget > 0 ? ((totalSales / totalTarget) * 100).toFixed(1) : '0.0',
          diffFromTarget: totalSales - totalTarget,
          costPct: totalSales > 0 ? ((expenses.cost / totalSales) * 100).toFixed(1) : '0.0',
          adsPct: totalSales > 0 ? ((expenses.ads / totalSales) * 100).toFixed(1) : '0.0',
          feesPct: totalSales > 0 ? ((expenses.fees / totalSales) * 100).toFixed(1) : '0.0',
          totalExpPct: totalSales > 0 ? ((totalExpenses / totalSales) * 100).toFixed(1) : '0.0',
        };
      }));

      const branchTotalSales = employeesWithData.reduce((sum, e) => sum + e.totalSales, 0);
      const branchTotalTarget = employeesWithData.reduce((sum, e) => sum + e.targets.total, 0);
      const branchTotalExpenses = employeesWithData.reduce((sum, e) => sum + e.totalExpenses, 0);
      
      const branchSales = { facebook: employeesWithData.reduce((sum, e) => sum + e.sales.facebook, 0), shopee: employeesWithData.reduce((sum, e) => sum + e.sales.shopee, 0), lazada: employeesWithData.reduce((sum, e) => sum + e.sales.lazada, 0) };
      const branchTargets = { facebook: employeesWithData.reduce((sum, e) => sum + e.targets.facebook, 0), shopee: employeesWithData.reduce((sum, e) => sum + e.targets.shopee, 0), lazada: employeesWithData.reduce((sum, e) => sum + e.targets.lazada, 0), total: branchTotalTarget };
      const branchExpenses = { cost: employeesWithData.reduce((sum, e) => sum + e.expenses.cost, 0), ads: employeesWithData.reduce((sum, e) => sum + e.expenses.ads, 0), fees: employeesWithData.reduce((sum, e) => sum + e.expenses.fees, 0) };

      return {
        ...branch,
        employees: employeesWithData,
        targets: branchTargets, sales: branchSales, expenses: branchExpenses,
        totalSales: branchTotalSales, totalTarget: branchTotalTarget, totalExpenses: branchTotalExpenses,
        netProfit: branchTotalSales - branchTotalExpenses,
        performancePct: branchTotalTarget > 0 ? ((branchTotalSales / branchTotalTarget) * 100).toFixed(1) : '0.0',
        diffFromTarget: branchTotalSales - branchTotalTarget,
        costPct: branchTotalSales > 0 ? ((branchExpenses.cost / branchTotalSales) * 100).toFixed(1) : '0.0',
        adsPct: branchTotalSales > 0 ? ((branchExpenses.ads / branchTotalSales) * 100).toFixed(1) : '0.0',
        feesPct: branchTotalSales > 0 ? ((branchExpenses.fees / branchTotalSales) * 100).toFixed(1) : '0.0',
        totalExpPct: branchTotalSales > 0 ? ((branchTotalExpenses / branchTotalSales) * 100).toFixed(1) : '0.0',
      };
    }));

    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Dashboard History - 12 months
app.get('/api/dashboard/history', authenticateToken, async (req, res) => {
  try {
    const { year = 2026, month = 1 } = req.query;
    const y = parseInt(year);
    const m = parseInt(month);
    
    const history = [];
    
    for (let i = 11; i >= 0; i--) {
      let histYear = y;
      let histMonth = m - i;
      while (histMonth <= 0) { histMonth += 12; histYear -= 1; }
      
      const salesResult = await pool.query('SELECT channel, SUM(amount) as total FROM sales WHERE year = $1 AND month = $2 GROUP BY channel', [histYear, histMonth]);
      const sales = { facebook: 0, shopee: 0, lazada: 0 };
      salesResult.rows.forEach(s => sales[s.channel] = parseFloat(s.total) || 0);
      
      const targetResult = await pool.query('SELECT SUM(target_facebook) as fb, SUM(target_shopee) as sp, SUM(target_lazada) as lz FROM monthly_targets WHERE year = $1 AND month = $2', [histYear, histMonth]);
      const targets = targetResult.rows[0] || {};
      
      const expenseResult = await pool.query('SELECT SUM(amount) as total FROM expenses WHERE year = $1 AND month = $2', [histYear, histMonth]);
      
      const totalSales = sales.facebook + sales.shopee + sales.lazada;
      const totalTarget = parseFloat(targets.fb || 0) + parseFloat(targets.sp || 0) + parseFloat(targets.lz || 0);
      const totalExpenses = parseFloat(expenseResult.rows[0]?.total) || 0;
      
      history.push({ year: histYear, month: histMonth, sales, totalSales, totalTarget, totalExpenses, netProfit: totalSales - totalExpenses });
    }
    
    res.json(history);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Start server
const startServer = async () => {
  await initDatabase();
  app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════╗
║     🚀 Sales Dashboard API Server v4              ║
║        with PostgreSQL (Persistent Data)          ║
╠═══════════════════════════════════════════════════╣
║  Server: http://localhost:${PORT}                    ║
║  Login: admin / admin123                          ║
╚═══════════════════════════════════════════════════╝
    `);
  });
};

startServer();
