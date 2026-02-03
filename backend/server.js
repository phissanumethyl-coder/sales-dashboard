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

  // Users table
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  // Branches table (ไม่มี target แล้ว เพราะจะรวมจาก employees)
  db.run(`CREATE TABLE IF NOT EXISTS branches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#3b82f6',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  // Employees table พร้อมเป้าหมายแยกแต่ละช่องทาง
  db.run(`CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    branch_id INTEGER,
    name TEXT NOT NULL,
    target_facebook REAL DEFAULT 0,
    target_shopee REAL DEFAULT 0,
    target_lazada REAL DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (branch_id) REFERENCES branches(id)
  )`);

  // Sales table
  db.run(`CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER,
    channel TEXT CHECK(channel IN ('facebook', 'shopee', 'lazada')),
    amount REAL NOT NULL,
    sale_date TEXT NOT NULL,
    year INTEGER,
    month INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id)
  )`);

  // Expenses table
  db.run(`CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER,
    type TEXT CHECK(type IN ('cost', 'ads', 'fees')),
    amount REAL NOT NULL,
    expense_date TEXT NOT NULL,
    year INTEGER,
    month INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id)
  )`);

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
    while (stmt.step()) results.push(stmt.getAsObject());
    stmt.free();
    return results;
  } catch (err) {
    console.error('SQL Error:', err);
    return [];
  }
};

const dbGet = (sql, params = []) => dbAll(sql, params)[0] || null;

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

const seedDatabase = () => {
  const userCount = dbGet('SELECT COUNT(*) as count FROM users');
  if (userCount && userCount.count > 0) {
    console.log('✅ มี admin user อยู่แล้ว');
    return;
  }
  console.log('🌱 กำลังสร้าง admin user...');
  const hashedPassword = bcrypt.hashSync('admin123', 10);
  dbRun('INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)', ['admin', hashedPassword, 'ผู้ดูแลระบบ', 'admin']);
  console.log('✅ สร้าง admin user เรียบร้อย!');
  console.log('📝 Login: admin / admin123');
};

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
app.get('/', (req, res) => res.json({ message: '🚀 Sales Dashboard API is running!', status: 'ok' }));
app.get('/api', (req, res) => res.json({ message: '🚀 Sales Dashboard API is running!', status: 'ok' }));

// Auth
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const user = dbGet('SELECT * FROM users WHERE username = ?', [username]);
  if (!user || !bcrypt.compareSync(password, user.password)) return res.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
  const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, username: user.username, name: user.name, role: user.role } });
});

// Branches
app.get('/api/branches', authenticateToken, (req, res) => res.json(dbAll('SELECT * FROM branches ORDER BY id')));

app.post('/api/branches', authenticateToken, (req, res) => {
  const { name, color } = req.body;
  const result = dbRun('INSERT INTO branches (name, color) VALUES (?, ?)', [name, color || '#3b82f6']);
  res.json({ id: result.lastID, name, color });
});

app.put('/api/branches/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { name, color } = req.body;
  dbRun('UPDATE branches SET name = ?, color = ? WHERE id = ?', [name, color || '#3b82f6', id]);
  res.json({ id, name, color });
});

app.delete('/api/branches/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  dbRun('DELETE FROM sales WHERE employee_id IN (SELECT id FROM employees WHERE branch_id = ?)', [id]);
  dbRun('DELETE FROM expenses WHERE employee_id IN (SELECT id FROM employees WHERE branch_id = ?)', [id]);
  dbRun('DELETE FROM employees WHERE branch_id = ?', [id]);
  dbRun('DELETE FROM branches WHERE id = ?', [id]);
  res.json({ success: true });
});

// Employees
app.get('/api/employees', authenticateToken, (req, res) => {
  const { branch } = req.query;
  if (branch) return res.json(dbAll('SELECT e.*, b.name as branch_name FROM employees e JOIN branches b ON e.branch_id = b.id WHERE e.branch_id = ? ORDER BY e.id', [branch]));
  res.json(dbAll('SELECT e.*, b.name as branch_name FROM employees e JOIN branches b ON e.branch_id = b.id ORDER BY e.id'));
});

app.post('/api/employees', authenticateToken, (req, res) => {
  const { branch_id, name, target_facebook, target_shopee, target_lazada } = req.body;
  const result = dbRun(
    'INSERT INTO employees (branch_id, name, target_facebook, target_shopee, target_lazada) VALUES (?, ?, ?, ?, ?)',
    [branch_id, name, target_facebook || 0, target_shopee || 0, target_lazada || 0]
  );
  res.json({ id: result.lastID, branch_id, name, target_facebook, target_shopee, target_lazada });
});

app.put('/api/employees/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { name, target_facebook, target_shopee, target_lazada } = req.body;
  dbRun(
    'UPDATE employees SET name = ?, target_facebook = ?, target_shopee = ?, target_lazada = ? WHERE id = ?',
    [name, target_facebook || 0, target_shopee || 0, target_lazada || 0, id]
  );
  res.json({ id, name, target_facebook, target_shopee, target_lazada });
});

app.delete('/api/employees/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  dbRun('DELETE FROM sales WHERE employee_id = ?', [id]);
  dbRun('DELETE FROM expenses WHERE employee_id = ?', [id]);
  dbRun('DELETE FROM employees WHERE id = ?', [id]);
  res.json({ success: true });
});

// Sales - บันทึกยอดขายรายเดือน
app.get('/api/sales', authenticateToken, (req, res) => {
  const { employee_id, year, month } = req.query;
  let sql = 'SELECT * FROM sales WHERE 1=1';
  const params = [];
  if (employee_id) { sql += ' AND employee_id = ?'; params.push(employee_id); }
  if (year) { sql += ' AND year = ?'; params.push(year); }
  if (month) { sql += ' AND month = ?'; params.push(month); }
  res.json(dbAll(sql, params));
});

app.post('/api/sales', authenticateToken, (req, res) => {
  const { employee_id, channel, amount, year, month } = req.body;
  const sale_date = `${year}-${String(month).padStart(2, '0')}-01`;
  
  // ตรวจสอบว่ามีข้อมูลเดือนนี้หรือยัง ถ้ามีให้ update
  const existing = dbGet(
    'SELECT id FROM sales WHERE employee_id = ? AND channel = ? AND year = ? AND month = ?',
    [employee_id, channel, year, month]
  );
  
  if (existing) {
    dbRun('UPDATE sales SET amount = ? WHERE id = ?', [amount, existing.id]);
    res.json({ id: existing.id, employee_id, channel, amount, year, month, updated: true });
  } else {
    const result = dbRun(
      'INSERT INTO sales (employee_id, channel, amount, sale_date, year, month) VALUES (?, ?, ?, ?, ?, ?)',
      [employee_id, channel, amount, sale_date, year, month]
    );
    res.json({ id: result.lastID, employee_id, channel, amount, year, month });
  }
});

// Expenses - บันทึกค่าใช้จ่ายรายเดือน
app.get('/api/expenses', authenticateToken, (req, res) => {
  const { employee_id, year, month } = req.query;
  let sql = 'SELECT * FROM expenses WHERE 1=1';
  const params = [];
  if (employee_id) { sql += ' AND employee_id = ?'; params.push(employee_id); }
  if (year) { sql += ' AND year = ?'; params.push(year); }
  if (month) { sql += ' AND month = ?'; params.push(month); }
  res.json(dbAll(sql, params));
});

app.post('/api/expenses', authenticateToken, (req, res) => {
  const { employee_id, type, amount, year, month } = req.body;
  const expense_date = `${year}-${String(month).padStart(2, '0')}-01`;
  
  // ตรวจสอบว่ามีข้อมูลเดือนนี้หรือยัง ถ้ามีให้ update
  const existing = dbGet(
    'SELECT id FROM expenses WHERE employee_id = ? AND type = ? AND year = ? AND month = ?',
    [employee_id, type, year, month]
  );
  
  if (existing) {
    dbRun('UPDATE expenses SET amount = ? WHERE id = ?', [amount, existing.id]);
    res.json({ id: existing.id, employee_id, type, amount, year, month, updated: true });
  } else {
    const result = dbRun(
      'INSERT INTO expenses (employee_id, type, amount, expense_date, year, month) VALUES (?, ?, ?, ?, ?, ?)',
      [employee_id, type, amount, expense_date, year, month]
    );
    res.json({ id: result.lastID, employee_id, type, amount, year, month });
  }
});

// Dashboard - แสดงข้อมูลรวม
app.get('/api/dashboard', authenticateToken, (req, res) => {
  const { year = 2026, month = 2 } = req.query;
  const y = parseInt(year);
  const m = parseInt(month);

  const branches = dbAll('SELECT * FROM branches ORDER BY id');
  
  const result = branches.map(branch => {
    const employees = dbAll('SELECT * FROM employees WHERE branch_id = ? ORDER BY id', [branch.id]);
    
    const employeesWithData = employees.map(emp => {
      // ดึงยอดขายของเดือนนี้
      const salesData = dbAll(
        'SELECT channel, SUM(amount) as total FROM sales WHERE employee_id = ? AND year = ? AND month = ? GROUP BY channel',
        [emp.id, y, m]
      );
      const sales = { facebook: 0, shopee: 0, lazada: 0 };
      salesData.forEach(s => sales[s.channel] = s.total || 0);
      
      // ดึงค่าใช้จ่ายของเดือนนี้
      const expenseData = dbAll(
        'SELECT type, SUM(amount) as total FROM expenses WHERE employee_id = ? AND year = ? AND month = ? GROUP BY type',
        [emp.id, y, m]
      );
      const expenses = { cost: 0, ads: 0, fees: 0 };
      expenseData.forEach(e => expenses[e.type] = e.total || 0);
      
      // คำนวณ
      const totalSales = sales.facebook + sales.shopee + sales.lazada;
      const totalTarget = (emp.target_facebook || 0) + (emp.target_shopee || 0) + (emp.target_lazada || 0);
      const totalExpenses = expenses.cost + expenses.ads + expenses.fees;
      
      return {
        ...emp,
        targets: {
          facebook: emp.target_facebook || 0,
          shopee: emp.target_shopee || 0,
          lazada: emp.target_lazada || 0,
          total: totalTarget
        },
        sales,
        expenses,
        totalSales,
        totalExpenses,
        netProfit: totalSales - totalExpenses,
        // % เทียบกับเป้า
        performancePct: totalTarget > 0 ? ((totalSales / totalTarget) * 100).toFixed(1) : '0.0',
        diffFromTarget: totalSales - totalTarget,
        // % ค่าใช้จ่ายต่อยอดขาย
        costPct: totalSales > 0 ? ((expenses.cost / totalSales) * 100).toFixed(1) : '0.0',
        adsPct: totalSales > 0 ? ((expenses.ads / totalSales) * 100).toFixed(1) : '0.0',
        feesPct: totalSales > 0 ? ((expenses.fees / totalSales) * 100).toFixed(1) : '0.0',
        totalExpPct: totalSales > 0 ? ((totalExpenses / totalSales) * 100).toFixed(1) : '0.0',
      };
    });

    // รวมข้อมูลสาขา
    const branchTotalSales = employeesWithData.reduce((sum, e) => sum + e.totalSales, 0);
    const branchTotalTarget = employeesWithData.reduce((sum, e) => sum + e.targets.total, 0);
    const branchTotalExpenses = employeesWithData.reduce((sum, e) => sum + e.totalExpenses, 0);
    
    const branchSales = {
      facebook: employeesWithData.reduce((sum, e) => sum + e.sales.facebook, 0),
      shopee: employeesWithData.reduce((sum, e) => sum + e.sales.shopee, 0),
      lazada: employeesWithData.reduce((sum, e) => sum + e.sales.lazada, 0),
    };
    
    const branchTargets = {
      facebook: employeesWithData.reduce((sum, e) => sum + e.targets.facebook, 0),
      shopee: employeesWithData.reduce((sum, e) => sum + e.targets.shopee, 0),
      lazada: employeesWithData.reduce((sum, e) => sum + e.targets.lazada, 0),
      total: branchTotalTarget
    };
    
    const branchExpenses = {
      cost: employeesWithData.reduce((sum, e) => sum + e.expenses.cost, 0),
      ads: employeesWithData.reduce((sum, e) => sum + e.expenses.ads, 0),
      fees: employeesWithData.reduce((sum, e) => sum + e.expenses.fees, 0),
    };

    return {
      ...branch,
      employees: employeesWithData,
      targets: branchTargets,
      sales: branchSales,
      expenses: branchExpenses,
      totalSales: branchTotalSales,
      totalTarget: branchTotalTarget,
      totalExpenses: branchTotalExpenses,
      netProfit: branchTotalSales - branchTotalExpenses,
      performancePct: branchTotalTarget > 0 ? ((branchTotalSales / branchTotalTarget) * 100).toFixed(1) : '0.0',
      diffFromTarget: branchTotalSales - branchTotalTarget,
      costPct: branchTotalSales > 0 ? ((branchExpenses.cost / branchTotalSales) * 100).toFixed(1) : '0.0',
      adsPct: branchTotalSales > 0 ? ((branchExpenses.ads / branchTotalSales) * 100).toFixed(1) : '0.0',
      feesPct: branchTotalSales > 0 ? ((branchExpenses.fees / branchTotalSales) * 100).toFixed(1) : '0.0',
      totalExpPct: branchTotalSales > 0 ? ((branchTotalExpenses / branchTotalSales) * 100).toFixed(1) : '0.0',
    };
  });

  res.json(result);
});

const startServer = async () => {
  await initDatabase();
  app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════╗
║     🚀 Sales Dashboard API Server v3              ║
╠═══════════════════════════════════════════════════╣
║  Server: http://localhost:${PORT}                    ║
║  Login: admin / admin123                          ║
║                                                   ║
║  ✨ Features:                                     ║
║     - เป้าหมายรายพนักงาน (FB/Shopee/Lazada)       ║
║     - เป้าสาขา = รวมเป้าพนักงาน                   ║
║     - ค่าใช้จ่าย % ต่อยอดขาย                      ║
║     - เปรียบเทียบ ขาด/เกิน เป้า                   ║
╚═══════════════════════════════════════════════════╝
    `);
  });
};

startServer();
