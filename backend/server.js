// =====================================================
// 📁 server.js - Backend API สำหรับ Sales Dashboard
// =====================================================
// ไม่มีข้อมูลตัวอย่าง + Filter แบบเดือน
// =====================================================

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const DB_PATH = path.join(__dirname, 'sales_dashboard.db');

app.use(cors());
app.use(express.json());

let db = null;

// =====================================================
// 📦 DATABASE SETUP
// =====================================================

const initDatabase = async () => {
  const SQL = await initSqlJs();
  
  try {
    if (fs.existsSync(DB_PATH)) {
      const buffer = fs.readFileSync(DB_PATH);
      db = new SQL.Database(buffer);
      console.log('📂 โหลด database จากไฟล์เดิม');
    } else {
      db = new SQL.Database();
      console.log('🆕 สร้าง database ใหม่');
    }
  } catch (err) {
    db = new SQL.Database();
    console.log('🆕 สร้าง database ใหม่');
  }

  // สร้างตาราง
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS branches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      target REAL DEFAULT 0,
      color TEXT DEFAULT '#3b82f6',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      branch_id INTEGER,
      name TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (branch_id) REFERENCES branches(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER,
      channel TEXT CHECK(channel IN ('facebook', 'shopee', 'lazada')),
      amount REAL NOT NULL,
      sale_date TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER,
      type TEXT CHECK(type IN ('cost', 'ads', 'fees')),
      amount REAL NOT NULL,
      expense_date TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id)
    )
  `);

  saveDatabase();
  seedDatabase();
};

const saveDatabase = () => {
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  } catch (err) {
    console.error('❌ ไม่สามารถบันทึก database:', err);
  }
};

const dbAll = (sql, params = []) => {
  try {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  } catch (err) {
    console.error('SQL Error:', err);
    return [];
  }
};

const dbGet = (sql, params = []) => {
  const results = dbAll(sql, params);
  return results[0] || null;
};

const dbRun = (sql, params = []) => {
  try {
    db.run(sql, params);
    saveDatabase();
    return { lastID: db.exec("SELECT last_insert_rowid()")[0]?.values[0][0] };
  } catch (err) {
    console.error('SQL Error:', err);
    return { error: err.message };
  }
};

// =====================================================
// 🌱 SEED DATA - เฉพาะ Admin User เท่านั้น (ไม่มีข้อมูลตัวอย่าง)
// =====================================================

const seedDatabase = () => {
  const userCount = dbGet('SELECT COUNT(*) as count FROM users');
  if (userCount && userCount.count > 0) {
    console.log('✅ มี admin user อยู่แล้ว');
    return;
  }

  console.log('🌱 กำลังสร้าง admin user...');

  // สร้าง admin user เท่านั้น (password: admin123)
  const hashedPassword = bcrypt.hashSync('admin123', 10);
  dbRun('INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)', 
    ['admin', hashedPassword, 'ผู้ดูแลระบบ', 'admin']);

  console.log('✅ สร้าง admin user เรียบร้อย!');
  console.log('📝 Login: admin / admin123');
};

// =====================================================
// 🔐 AUTHENTICATION MIDDLEWARE
// =====================================================

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'ไม่พบ Token' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token ไม่ถูกต้องหรือหมดอายุ' });
    }
    req.user = user;
    next();
  });
};

// =====================================================
// 🚀 API ROUTES
// =====================================================

app.get('/', (req, res) => {
  res.json({ message: '🚀 Sales Dashboard API is running!', status: 'ok' });
});

app.get('/api', (req, res) => {
  res.json({ message: '🚀 Sales Dashboard API is running!', status: 'ok' });
});

// --- AUTH ---

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;

  const user = dbGet('SELECT * FROM users WHERE username = ?', [username]);
  
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({
    token,
    user: { id: user.id, username: user.username, name: user.name, role: user.role }
  });
});

app.post('/api/auth/register', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'ไม่มีสิทธิ์' });
  }

  const { username, password, name, role = 'user' } = req.body;
  const hashedPassword = bcrypt.hashSync(password, 10);

  try {
    const result = dbRun('INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)', 
      [username, hashedPassword, name, role]);
    res.json({ id: result.lastID, username, name, role });
  } catch (err) {
    res.status(400).json({ error: 'Username ซ้ำ' });
  }
});

// --- BRANCHES ---

app.get('/api/branches', authenticateToken, (req, res) => {
  const branches = dbAll('SELECT * FROM branches ORDER BY id');
  res.json(branches);
});

app.post('/api/branches', authenticateToken, (req, res) => {
  const { name, target, color } = req.body;
  const result = dbRun('INSERT INTO branches (name, target, color) VALUES (?, ?, ?)', 
    [name, target || 0, color || '#3b82f6']);
  res.json({ id: result.lastID, name, target, color });
});

app.delete('/api/branches/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  dbRun('DELETE FROM sales WHERE employee_id IN (SELECT id FROM employees WHERE branch_id = ?)', [id]);
  dbRun('DELETE FROM expenses WHERE employee_id IN (SELECT id FROM employees WHERE branch_id = ?)', [id]);
  dbRun('DELETE FROM employees WHERE branch_id = ?', [id]);
  dbRun('DELETE FROM branches WHERE id = ?', [id]);
  res.json({ success: true });
});

// --- EMPLOYEES ---

app.get('/api/employees', authenticateToken, (req, res) => {
  const { branch } = req.query;
  let employees;
  
  if (branch) {
    employees = dbAll('SELECT e.*, b.name as branch_name FROM employees e JOIN branches b ON e.branch_id = b.id WHERE e.branch_id = ? ORDER BY e.id', [branch]);
  } else {
    employees = dbAll('SELECT e.*, b.name as branch_name FROM employees e JOIN branches b ON e.branch_id = b.id ORDER BY e.id');
  }
  
  res.json(employees);
});

app.post('/api/employees', authenticateToken, (req, res) => {
  const { branch_id, name } = req.body;
  const result = dbRun('INSERT INTO employees (branch_id, name) VALUES (?, ?)', [branch_id, name]);
  res.json({ id: result.lastID, branch_id, name });
});

app.delete('/api/employees/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  dbRun('DELETE FROM sales WHERE employee_id = ?', [id]);
  dbRun('DELETE FROM expenses WHERE employee_id = ?', [id]);
  dbRun('DELETE FROM employees WHERE id = ?', [id]);
  res.json({ success: true });
});

// --- SALES ---

app.get('/api/sales', authenticateToken, (req, res) => {
  const { employee_id, year, month } = req.query;
  
  let sql = 'SELECT * FROM sales WHERE 1=1';
  const params = [];

  if (employee_id) {
    sql += ' AND employee_id = ?';
    params.push(employee_id);
  }

  if (year && month) {
    // Filter by year and month
    const startDate = `${year}-${month.padStart(2, '0')}-01`;
    const endDate = `${year}-${month.padStart(2, '0')}-31`;
    sql += ' AND sale_date BETWEEN ? AND ?';
    params.push(startDate, endDate);
  }

  const sales = dbAll(sql, params);
  res.json(sales);
});

app.post('/api/sales', authenticateToken, (req, res) => {
  const { employee_id, channel, amount, sale_date } = req.body;
  const result = dbRun('INSERT INTO sales (employee_id, channel, amount, sale_date) VALUES (?, ?, ?, ?)', 
    [employee_id, channel, amount, sale_date]);
  res.json({ id: result.lastID, employee_id, channel, amount, sale_date });
});

// --- EXPENSES ---

app.get('/api/expenses', authenticateToken, (req, res) => {
  const { employee_id, year, month } = req.query;
  
  let sql = 'SELECT * FROM expenses WHERE 1=1';
  const params = [];

  if (employee_id) {
    sql += ' AND employee_id = ?';
    params.push(employee_id);
  }

  if (year && month) {
    const startDate = `${year}-${month.padStart(2, '0')}-01`;
    const endDate = `${year}-${month.padStart(2, '0')}-31`;
    sql += ' AND expense_date BETWEEN ? AND ?';
    params.push(startDate, endDate);
  }

  const expenses = dbAll(sql, params);
  res.json(expenses);
});

app.post('/api/expenses', authenticateToken, (req, res) => {
  const { employee_id, type, amount, expense_date } = req.body;
  const result = dbRun('INSERT INTO expenses (employee_id, type, amount, expense_date) VALUES (?, ?, ?, ?)', 
    [employee_id, type, amount, expense_date]);
  res.json({ id: result.lastID, employee_id, type, amount, expense_date });
});

// --- DASHBOARD ---

app.get('/api/dashboard', authenticateToken, (req, res) => {
  const { year = '2024', month = '12' } = req.query;
  
  // Filter by year and month
  const startDate = `${year}-${month.padStart(2, '0')}-01`;
  const endDate = `${year}-${month.padStart(2, '0')}-31`;

  const branches = dbAll('SELECT * FROM branches ORDER BY id');
  
  const result = branches.map(branch => {
    const employees = dbAll('SELECT * FROM employees WHERE branch_id = ? ORDER BY id', [branch.id]);
    
    const employeesWithData = employees.map(emp => {
      const salesData = dbAll(`
        SELECT channel, SUM(amount) as total
        FROM sales
        WHERE employee_id = ? AND sale_date BETWEEN ? AND ?
        GROUP BY channel
      `, [emp.id, startDate, endDate]);

      const channels = { facebook: 0, shopee: 0, lazada: 0 };
      salesData.forEach(s => channels[s.channel] = s.total || 0);

      const expenseData = dbAll(`
        SELECT type, SUM(amount) as total
        FROM expenses
        WHERE employee_id = ? AND expense_date BETWEEN ? AND ?
        GROUP BY type
      `, [emp.id, startDate, endDate]);

      const expenses = { cost: 0, ads: 0, fees: 0 };
      expenseData.forEach(e => expenses[e.type] = e.total || 0);

      return {
        ...emp,
        channels,
        expenses
      };
    });

    return {
      ...branch,
      employees: employeesWithData
    };
  });

  res.json(result);
});

// =====================================================
// 🎯 START SERVER
// =====================================================

const startServer = async () => {
  await initDatabase();
  
  app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════╗
║     🚀 Sales Dashboard API Server                 ║
╠═══════════════════════════════════════════════════╣
║  Server running at: http://localhost:${PORT}         ║
║  Database: SQLite (sql.js)                        ║
║                                                   ║
║  📝 Login: admin / admin123                       ║
║                                                   ║
║  🆕 ไม่มีข้อมูลตัวอย่าง                              ║
║     - เพิ่มสาขาเอง                                 ║
║     - เพิ่มพนักงานเอง                              ║
║     - บันทึกยอดขาย/ค่าใช้จ่ายเอง                    ║
╚═══════════════════════════════════════════════════╝
    `);
  });
};

startServer();
