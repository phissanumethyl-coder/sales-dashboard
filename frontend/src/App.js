import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const api = {
  login: async (username, password) => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      return res.json();
    } catch (err) {
      return { error: 'ไม่สามารถเชื่อมต่อ Server ได้' };
    }
  },
  getBranches: async (token) => {
    try {
      const res = await fetch(`${API_BASE_URL}/branches`, { headers: { 'Authorization': `Bearer ${token}` }});
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch { return []; }
  },
  addBranch: async (token, data) => {
    try {
      const res = await fetch(`${API_BASE_URL}/branches`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return res.json();
    } catch (err) { return { error: err.message }; }
  },
  deleteBranch: async (token, id) => {
    try {
      const res = await fetch(`${API_BASE_URL}/branches/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return res.json();
    } catch (err) { return { error: err.message }; }
  },
  getEmployees: async (token) => {
    try {
      const res = await fetch(`${API_BASE_URL}/employees`, { headers: { 'Authorization': `Bearer ${token}` }});
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch { return []; }
  },
  addEmployee: async (token, data) => {
    try {
      const res = await fetch(`${API_BASE_URL}/employees`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return res.json();
    } catch (err) { return { error: err.message }; }
  },
  deleteEmployee: async (token, id) => {
    try {
      const res = await fetch(`${API_BASE_URL}/employees/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return res.json();
    } catch (err) { return { error: err.message }; }
  },
  addSale: async (token, data) => {
    try {
      const res = await fetch(`${API_BASE_URL}/sales`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return res.json();
    } catch (err) { return { error: err.message }; }
  },
  addExpense: async (token, data) => {
    try {
      const res = await fetch(`${API_BASE_URL}/expenses`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return res.json();
    } catch (err) { return { error: err.message }; }
  },
  getDashboard: async (token, year, month) => {
    try {
      const res = await fetch(`${API_BASE_URL}/dashboard?year=${year}&month=${month}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch { return []; }
  }
};

const formatCurrency = (num) => new Intl.NumberFormat('th-TH').format(num || 0);
const getPerformanceColor = (pct) => pct >= 100 ? '#10b981' : pct >= 80 ? '#f59e0b' : '#ef4444';
const getExpenseColor = (pct) => pct <= 15 ? '#10b981' : pct <= 25 ? '#f59e0b' : '#ef4444';
const getStatus = (pct) => pct >= 100 ? { text: 'เกินเป้า', emoji: '🎯', cls: 'success' } : pct >= 80 ? { text: 'ใกล้เป้า', emoji: '📈', cls: 'warning' } : { text: 'ต่ำกว่าเป้า', emoji: '⚠️', cls: 'danger' };

const channelConfig = {
  facebook: { color: '#1877f2', icon: '📘', name: 'Facebook' },
  shopee: { color: '#ee4d2d', icon: '🛒', name: 'Shopee' },
  lazada: { color: '#0f146d', icon: '🛍️', name: 'Lazada' }
};

const expenseConfig = {
  cost: { color: '#ef4444', name: 'ต้นทุน', icon: '📦' },
  ads: { color: '#f59e0b', name: 'ค่าโฆษณา', icon: '📢' },
  fees: { color: '#8b5cf6', name: 'ค่าธรรมเนียม', icon: '💳' }
};

const monthNames = [
  { value: '01', label: 'มกราคม' }, { value: '02', label: 'กุมภาพันธ์' },
  { value: '03', label: 'มีนาคม' }, { value: '04', label: 'เมษายน' },
  { value: '05', label: 'พฤษภาคม' }, { value: '06', label: 'มิถุนายน' },
  { value: '07', label: 'กรกฎาคม' }, { value: '08', label: 'สิงหาคม' },
  { value: '09', label: 'กันยายน' }, { value: '10', label: 'ตุลาคม' },
  { value: '11', label: 'พฤศจิกายน' }, { value: '12', label: 'ธันวาคม' },
];

const processData = (branches) => {
  if (!Array.isArray(branches)) return [];
  return branches.map(branch => {
    const employees = Array.isArray(branch.employees) ? branch.employees.map(emp => {
      const channels = emp.channels || { facebook: 0, shopee: 0, lazada: 0 };
      const expenses = emp.expenses || { cost: 0, ads: 0, fees: 0 };
      const totalSales = (channels.facebook || 0) + (channels.shopee || 0) + (channels.lazada || 0);
      const totalExpenses = (expenses.cost || 0) + (expenses.ads || 0) + (expenses.fees || 0);
      return {
        ...emp, channels, expenses, totalSales, totalExpenses,
        netProfit: totalSales - totalExpenses,
        costPct: totalSales > 0 ? ((expenses.cost || 0) / totalSales * 100).toFixed(1) : '0.0',
        adsPct: totalSales > 0 ? ((expenses.ads || 0) / totalSales * 100).toFixed(1) : '0.0',
        feesPct: totalSales > 0 ? ((expenses.fees || 0) / totalSales * 100).toFixed(1) : '0.0',
        totalExpPct: totalSales > 0 ? (totalExpenses / totalSales * 100).toFixed(1) : '0.0',
      };
    }) : [];
    const sales = employees.reduce((sum, e) => sum + e.totalSales, 0);
    const expensesTotal = employees.reduce((sum, e) => sum + e.totalExpenses, 0);
    const channelTotals = {
      facebook: employees.reduce((sum, e) => sum + (e.channels?.facebook || 0), 0),
      shopee: employees.reduce((sum, e) => sum + (e.channels?.shopee || 0), 0),
      lazada: employees.reduce((sum, e) => sum + (e.channels?.lazada || 0), 0),
    };
    const expenseTotals = {
      cost: employees.reduce((sum, e) => sum + (e.expenses?.cost || 0), 0),
      ads: employees.reduce((sum, e) => sum + (e.expenses?.ads || 0), 0),
      fees: employees.reduce((sum, e) => sum + (e.expenses?.fees || 0), 0),
    };
    return {
      ...branch, employees, sales, expenses: expensesTotal, netProfit: sales - expensesTotal,
      channelTotals, expenseTotals,
      costPct: sales > 0 ? (expenseTotals.cost / sales * 100).toFixed(1) : '0.0',
      adsPct: sales > 0 ? (expenseTotals.ads / sales * 100).toFixed(1) : '0.0',
      feesPct: sales > 0 ? (expenseTotals.fees / sales * 100).toFixed(1) : '0.0',
      totalExpPct: sales > 0 ? (expensesTotal / sales * 100).toFixed(1) : '0.0',
    };
  });
};

const LoginPage = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const result = await api.login(username, password);
    if (result.token) {
      localStorage.setItem('token', result.token);
      localStorage.setItem('user', JSON.stringify(result.user));
      onLogin(result.user);
    } else {
      setError(result.error || 'เข้าสู่ระบบไม่สำเร็จ');
    }
    setLoading(false);
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">📊</div>
          <h1>Sales Dashboard</h1>
          <p>เข้าสู่ระบบเพื่อดูข้อมูล</p>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>👤 ชื่อผู้ใช้</label>
            <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="admin" required />
          </div>
          <div className="form-group">
            <label>🔒 รหัสผ่าน</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
          </div>
          {error && <div className="error-msg">{error}</div>}
          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? '⏳ กำลังเข้าสู่ระบบ...' : '🚀 เข้าสู่ระบบ'}
          </button>
        </form>
        <div className="demo-hint"><p>🔑 Demo: admin / admin123</p></div>
      </div>
    </div>
  );
};

const DataEntryPage = ({ token, onDataChange }) => {
  const [branches, setBranches] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [activeForm, setActiveForm] = useState('sales');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [branchForm, setBranchForm] = useState({ name: '', target: '', color: '#3b82f6' });
  const [employeeForm, setEmployeeForm] = useState({ branch_id: '', name: '' });
  const [salesForm, setSalesForm] = useState({ employee_id: '', sale_date: new Date().toISOString().split('T')[0], facebook: '', shopee: '', lazada: '' });
  const [expenseForm, setExpenseForm] = useState({ employee_id: '', expense_date: new Date().toISOString().split('T')[0], cost: '', ads: '', fees: '' });

  useEffect(() => { loadData(); }, [token]);

  const loadData = async () => {
    const [branchData, empData] = await Promise.all([api.getBranches(token), api.getEmployees(token)]);
    setBranches(branchData);
    setEmployees(empData);
  };

  const showMessage = (msg, isError = false) => {
    setMessage({ text: msg, isError });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleAddBranch = async (e) => {
    e.preventDefault();
    setLoading(true);
    const result = await api.addBranch(token, { name: branchForm.name, target: parseFloat(branchForm.target) || 0, color: branchForm.color });
    if (!result.error) {
      showMessage('✅ เพิ่มสาขาสำเร็จ!');
      setBranchForm({ name: '', target: '', color: '#3b82f6' });
      loadData();
      onDataChange();
    } else { showMessage('❌ ' + result.error, true); }
    setLoading(false);
  };

  const handleDeleteBranch = async (id, name) => {
    if (window.confirm(`ต้องการลบ "${name}"?\n(ข้อมูลพนักงานและยอดขายจะถูกลบด้วย)`)) {
      await api.deleteBranch(token, id);
      showMessage('✅ ลบสาขาสำเร็จ!');
      loadData();
      onDataChange();
    }
  };

  const handleAddEmployee = async (e) => {
    e.preventDefault();
    setLoading(true);
    const result = await api.addEmployee(token, { branch_id: parseInt(employeeForm.branch_id), name: employeeForm.name });
    if (!result.error) {
      showMessage('✅ เพิ่มพนักงานสำเร็จ!');
      setEmployeeForm({ branch_id: '', name: '' });
      loadData();
      onDataChange();
    } else { showMessage('❌ ' + result.error, true); }
    setLoading(false);
  };

  const handleDeleteEmployee = async (id, name) => {
    if (window.confirm(`ต้องการลบ "${name}"?`)) {
      await api.deleteEmployee(token, id);
      showMessage('✅ ลบพนักงานสำเร็จ!');
      loadData();
      onDataChange();
    }
  };

  const handleAddSales = async (e) => {
    e.preventDefault();
    setLoading(true);
    for (const ch of ['facebook', 'shopee', 'lazada']) {
      if (salesForm[ch] && parseFloat(salesForm[ch]) > 0) {
        await api.addSale(token, { employee_id: parseInt(salesForm.employee_id), channel: ch, amount: parseFloat(salesForm[ch]), sale_date: salesForm.sale_date });
      }
    }
    showMessage('✅ บันทึกยอดขายสำเร็จ!');
    setSalesForm({ ...salesForm, facebook: '', shopee: '', lazada: '' });
    onDataChange();
    setLoading(false);
  };

  const handleAddExpenses = async (e) => {
    e.preventDefault();
    setLoading(true);
    for (const t of ['cost', 'ads', 'fees']) {
      if (expenseForm[t] && parseFloat(expenseForm[t]) > 0) {
        await api.addExpense(token, { employee_id: parseInt(expenseForm.employee_id), type: t, amount: parseFloat(expenseForm[t]), expense_date: expenseForm.expense_date });
      }
    }
    showMessage('✅ บันทึกค่าใช้จ่ายสำเร็จ!');
    setExpenseForm({ ...expenseForm, cost: '', ads: '', fees: '' });
    onDataChange();
    setLoading(false);
  };

  return (
    <div className="data-entry">
      <div className="entry-tabs">
        {[['sales', '💰 ยอดขาย'], ['expenses', '📉 ค่าใช้จ่าย'], ['employee', '👤 พนักงาน'], ['branch', '🏢 สาขา']].map(([key, label]) => (
          <button key={key} className={`entry-tab ${activeForm === key ? 'active' : ''}`} onClick={() => setActiveForm(key)}>{label}</button>
        ))}
      </div>
      {message && <div className={`message ${message.isError ? 'error' : 'success'}`}>{message.text}</div>}

      {activeForm === 'sales' && (
        <form className="entry-form" onSubmit={handleAddSales}>
          <h3>💰 บันทึกยอดขาย</h3>
          {employees.length === 0 ? <div className="empty-state"><p>⚠️ กรุณาเพิ่มสาขาและพนักงานก่อน</p></div> : (
            <>
              <div className="form-group">
                <label>👤 พนักงาน</label>
                <select value={salesForm.employee_id} onChange={e => setSalesForm({...salesForm, employee_id: e.target.value})} required>
                  <option value="">-- เลือก --</option>
                  {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name} ({emp.branch_name})</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>📅 วันที่</label>
                <input type="date" value={salesForm.sale_date} onChange={e => setSalesForm({...salesForm, sale_date: e.target.value})} required />
              </div>
              <div className="form-row">
                <div className="form-group"><label>📘 Facebook</label><input type="number" min="0" value={salesForm.facebook} onChange={e => setSalesForm({...salesForm, facebook: e.target.value})} placeholder="0" /></div>
                <div className="form-group"><label>🛒 Shopee</label><input type="number" min="0" value={salesForm.shopee} onChange={e => setSalesForm({...salesForm, shopee: e.target.value})} placeholder="0" /></div>
                <div className="form-group"><label>🛍️ Lazada</label><input type="number" min="0" value={salesForm.lazada} onChange={e => setSalesForm({...salesForm, lazada: e.target.value})} placeholder="0" /></div>
              </div>
              <button type="submit" className="submit-btn" disabled={loading}>{loading ? '⏳...' : '💾 บันทึก'}</button>
            </>
          )}
        </form>
      )}

      {activeForm === 'expenses' && (
        <form className="entry-form" onSubmit={handleAddExpenses}>
          <h3>📉 บันทึกค่าใช้จ่าย</h3>
          {employees.length === 0 ? <div className="empty-state"><p>⚠️ กรุณาเพิ่มสาขาและพนักงานก่อน</p></div> : (
            <>
              <div className="form-group">
                <label>👤 พนักงาน</label>
                <select value={expenseForm.employee_id} onChange={e => setExpenseForm({...expenseForm, employee_id: e.target.value})} required>
                  <option value="">-- เลือก --</option>
                  {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name} ({emp.branch_name})</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>📅 วันที่</label>
                <input type="date" value={expenseForm.expense_date} onChange={e => setExpenseForm({...expenseForm, expense_date: e.target.value})} required />
              </div>
              <div className="form-row">
                <div className="form-group"><label>📦 ต้นทุน</label><input type="number" min="0" value={expenseForm.cost} onChange={e => setExpenseForm({...expenseForm, cost: e.target.value})} placeholder="0" /></div>
                <div className="form-group"><label>📢 ค่าโฆษณา</label><input type="number" min="0" value={expenseForm.ads} onChange={e => setExpenseForm({...expenseForm, ads: e.target.value})} placeholder="0" /></div>
                <div className="form-group"><label>💳 ค่าธรรมเนียม</label><input type="number" min="0" value={expenseForm.fees} onChange={e => setExpenseForm({...expenseForm, fees: e.target.value})} placeholder="0" /></div>
              </div>
              <button type="submit" className="submit-btn" disabled={loading}>{loading ? '⏳...' : '💾 บันทึก'}</button>
            </>
          )}
        </form>
      )}

      {activeForm === 'employee' && (
        <div className="entry-form">
          <h3>👤 จัดการพนักงาน</h3>
          {branches.length === 0 ? <div className="empty-state"><p>⚠️ กรุณาเพิ่มสาขาก่อน</p></div> : (
            <form onSubmit={handleAddEmployee}>
              <div className="form-group">
                <label>🏢 สาขา</label>
                <select value={employeeForm.branch_id} onChange={e => setEmployeeForm({...employeeForm, branch_id: e.target.value})} required>
                  <option value="">-- เลือก --</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>👤 ชื่อพนักงาน</label>
                <input type="text" value={employeeForm.name} onChange={e => setEmployeeForm({...employeeForm, name: e.target.value})} placeholder="ชื่อ-นามสกุล" required />
              </div>
              <button type="submit" className="submit-btn" disabled={loading}>{loading ? '⏳...' : '➕ เพิ่ม'}</button>
            </form>
          )}
          {employees.length > 0 && (
            <div className="data-list">
              <h4>📋 พนักงาน ({employees.length} คน)</h4>
              {employees.map(emp => (
                <div key={emp.id} className="data-item">
                  <span>{emp.name} <small>({emp.branch_name})</small></span>
                  <button className="delete-btn" onClick={() => handleDeleteEmployee(emp.id, emp.name)}>🗑️</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeForm === 'branch' && (
        <div className="entry-form">
          <h3>🏢 จัดการสาขา</h3>
          <form onSubmit={handleAddBranch}>
            <div className="form-group">
              <label>🏷️ ชื่อสาขา</label>
              <input type="text" value={branchForm.name} onChange={e => setBranchForm({...branchForm, name: e.target.value})} placeholder="เช่น สาขาสีลม" required />
            </div>
            <div className="form-group">
              <label>🎯 เป้าหมาย/เดือน (บาท)</label>
              <input type="number" min="0" value={branchForm.target} onChange={e => setBranchForm({...branchForm, target: e.target.value})} placeholder="500000" />
            </div>
            <div className="form-group">
              <label>🎨 สี</label>
              <input type="color" value={branchForm.color} onChange={e => setBranchForm({...branchForm, color: e.target.value})} />
            </div>
            <button type="submit" className="submit-btn" disabled={loading}>{loading ? '⏳...' : '➕ เพิ่ม'}</button>
          </form>
          {branches.length > 0 && (
            <div className="data-list">
              <h4>📋 สาขา ({branches.length})</h4>
              {branches.map(b => (
                <div key={b.id} className="data-item">
                  <span style={{display:'flex',alignItems:'center',gap:'8px'}}>
                    <span style={{width:'12px',height:'12px',borderRadius:'3px',background:b.color}}></span>
                    {b.name} <small>(เป้า: ฿{formatCurrency(b.target)})</small>
                  </span>
                  <button className="delete-btn" onClick={() => handleDeleteBranch(b.id, b.name)}>🗑️</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState(null);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const now = new Date();
  const [period, setPeriod] = useState({ year: now.getFullYear().toString(), month: (now.getMonth() + 1).toString().padStart(2, '0') });

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) { try { setUser(JSON.parse(savedUser)); } catch { localStorage.clear(); } }
    setLoading(false);
  }, []);

  useEffect(() => { if (user) loadDashboardData(); }, [user, period]);

  const loadDashboardData = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    const data = await api.getDashboard(token, period.year, period.month);
    setBranches(processData(data));
  };

  const handleLogout = () => { localStorage.clear(); setUser(null); setBranches([]); };
  const getMonthLabel = () => monthNames.find(m => m.value === period.month)?.label || '';

  if (loading) return <><style>{styles}</style><div className="loading">⏳ กำลังโหลด...</div></>;
  if (!user) return <><style>{styles}</style><LoginPage onLogin={setUser} /></>;

  const token = localStorage.getItem('token');
  const totalSales = branches.reduce((s, b) => s + (b.sales || 0), 0);
  const totalTarget = branches.reduce((s, b) => s + (b.target || 0), 0);
  const totalExpenses = branches.reduce((s, b) => s + (b.expenses || 0), 0);
  const totalNet = totalSales - totalExpenses;
  const performance = totalTarget > 0 ? ((totalSales / totalTarget) * 100).toFixed(1) : '0.0';
  const totalChannels = { facebook: branches.reduce((s, b) => s + (b.channelTotals?.facebook || 0), 0), shopee: branches.reduce((s, b) => s + (b.channelTotals?.shopee || 0), 0), lazada: branches.reduce((s, b) => s + (b.channelTotals?.lazada || 0), 0) };
  const totalExpenseBreakdown = { cost: branches.reduce((s, b) => s + (b.expenseTotals?.cost || 0), 0), ads: branches.reduce((s, b) => s + (b.expenseTotals?.ads || 0), 0), fees: branches.reduce((s, b) => s + (b.expenseTotals?.fees || 0), 0) };
  const totalCostPct = totalSales > 0 ? (totalExpenseBreakdown.cost / totalSales * 100).toFixed(1) : '0.0';
  const totalAdsPct = totalSales > 0 ? (totalExpenseBreakdown.ads / totalSales * 100).toFixed(1) : '0.0';
  const totalFeesPct = totalSales > 0 ? (totalExpenseBreakdown.fees / totalSales * 100).toFixed(1) : '0.0';
  const totalExpPct = totalSales > 0 ? (totalExpenses / totalSales * 100).toFixed(1) : '0.0';

  return (
    <><style>{styles}</style>
      <div className="dashboard">
        <header className="header">
          <div className="logo"><div className="logo-icon">📊</div><div><h1 className="title">Sales Dashboard</h1><p className="subtitle">{getMonthLabel()} {period.year}</p></div></div>
          <div className="header-actions"><div className="user-info">👤 {user.name}</div><button className="logout-btn" onClick={handleLogout}>🚪 ออก</button></div>
        </header>

        <nav className="tabs">
          {[['overview', '📈 ภาพรวม'], ['branches', '🏢 สาขา'], ['entry', '📝 กรอกข้อมูล']].map(([key, label]) => (
            <button key={key} className={`tab ${activeTab === key ? 'active' : ''}`} onClick={() => { setActiveTab(key); setSelectedBranch(null); }}>{label}</button>
          ))}
        </nav>

        <div className="filters">
          <div className="filter"><span>📅 ปี:</span><select value={period.year} onChange={e => setPeriod({...period, year: e.target.value})}><option value="2024">2024</option><option value="2025">2025</option></select></div>
          <div className="filter"><span>📆 เดือน:</span><select value={period.month} onChange={e => setPeriod({...period, month: e.target.value})}>{monthNames.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}</select></div>
          <button className="refresh-btn" onClick={loadDashboardData}>🔄 รีเฟรช</button>
        </div>

        {activeTab === 'overview' && (
          branches.length === 0 ? (
            <div className="empty-dashboard"><div className="empty-icon">📭</div><h2>ยังไม่มีข้อมูล</h2><p>ไปที่ "📝 กรอกข้อมูล" เพื่อเพิ่มสาขา พนักงาน และยอดขาย</p><button className="start-btn" onClick={() => setActiveTab('entry')}>🚀 เริ่มต้น</button></div>
          ) : (
            <>
              <div className="summary-grid">
                <div className="summary-card" style={{'--accent':'#3b82f6'}}><div className="card-icon">💰</div><div className="card-label">ยอดขายรวม</div><div className="card-value">฿{formatCurrency(totalSales)}</div><div className="card-sub">เป้า: ฿{formatCurrency(totalTarget)}</div></div>
                <div className="summary-card" style={{'--accent':'#10b981'}}><div className="card-icon">🎯</div><div className="card-label">Performance</div><div className="card-value" style={{color:getPerformanceColor(parseFloat(performance))}}>{performance}%</div><div className="card-sub">{branches.filter(b=>b.sales>=b.target).length}/{branches.length} สาขาถึงเป้า</div></div>
                <div className="summary-card" style={{'--accent':'#f59e0b'}}><div className="card-icon">📉</div><div className="card-label">ค่าใช้จ่าย</div><div className="card-value">฿{formatCurrency(totalExpenses)}</div><div className="card-sub" style={{color:getExpenseColor(parseFloat(totalExpPct))}}>{totalExpPct}%</div></div>
                <div className="summary-card" style={{'--accent':'#8b5cf6'}}><div className="card-icon">✨</div><div className="card-label">กำไรสุทธิ</div><div className="card-value" style={{color:totalNet>=0?'#34d399':'#f87171'}}>฿{formatCurrency(totalNet)}</div><div className="card-sub">Margin: {totalSales>0?(totalNet/totalSales*100).toFixed(1):0}%</div></div>
              </div>
              <div className="expense-summary">
                {Object.entries(expenseConfig).map(([key, cfg]) => {
                  const pct = key==='cost'?totalCostPct:key==='ads'?totalAdsPct:totalFeesPct;
                  return (<div key={key} className="expense-card"><div className="expense-header"><span>{cfg.icon} {cfg.name}</span><span className="expense-pct" style={{color:getExpenseColor(parseFloat(pct))}}>{pct}%</span></div><div className="expense-bar"><div className="expense-fill" style={{width:`${Math.min(parseFloat(pct)*3,100)}%`,background:cfg.color}}></div></div><div className="expense-value">฿{formatCurrency(totalExpenseBreakdown[key])}</div></div>);
                })}
              </div>
              <div className="channels-grid">
                {Object.entries(channelConfig).map(([key, cfg]) => (<div key={key} className="channel-card"><div className="channel-icon" style={{background:`${cfg.color}20`}}>{cfg.icon}</div><div><div className="channel-name">{cfg.name}</div><div className="channel-value">฿{formatCurrency(totalChannels[key])}</div><span className="channel-pct" style={{background:`${cfg.color}20`,color:cfg.color}}>{totalSales>0?(totalChannels[key]/totalSales*100).toFixed(1):0}%</span></div></div>))}
              </div>
              {branches.length > 0 && (<div className="chart-section"><h3>📊 ยอดขายแยกช่องทาง</h3><ResponsiveContainer width="100%" height={250}><BarChart data={branches.map(b=>({name:b.name?.replace('สาขา','')||'N/A',Facebook:b.channelTotals?.facebook||0,Shopee:b.channelTotals?.shopee||0,Lazada:b.channelTotals?.lazada||0}))}><CartesianGrid strokeDasharray="3 3" stroke="#334155"/><XAxis dataKey="name" tick={{fill:'#94a3b8',fontSize:11}}/><YAxis tick={{fill:'#94a3b8'}} tickFormatter={v=>`${(v/1000)}k`}/><Tooltip contentStyle={{background:'#1e293b',border:'1px solid #334155',borderRadius:'8px'}} formatter={v=>[`฿${formatCurrency(v)}`,'']} /><Legend/><Bar dataKey="Facebook" fill="#1877f2" radius={[4,4,0,0]}/><Bar dataKey="Shopee" fill="#ee4d2d" radius={[4,4,0,0]}/><Bar dataKey="Lazada" fill="#0f146d" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div>)}
            </>
          )
        )}

        {activeTab === 'branches' && (
          branches.length === 0 ? <div className="empty-dashboard"><div className="empty-icon">🏢</div><h2>ยังไม่มีสาขา</h2><button className="start-btn" onClick={() => setActiveTab('entry')}>➕ เพิ่มสาขา</button></div> : (
            <>
              <div className="branch-grid">
                {branches.map(branch => {
                  const pct = branch.target > 0 ? (branch.sales / branch.target) * 100 : 0;
                  const status = getStatus(pct);
                  return (<div key={branch.id} className={`branch-card ${selectedBranch?.id === branch.id ? 'selected' : ''}`} onClick={() => setSelectedBranch(selectedBranch?.id === branch.id ? null : branch)}>
                    <div className="branch-header"><div><div className="branch-name">{branch.name}</div><div className="branch-emp">👥 {branch.employees?.length||0} คน</div></div><span className={`status ${status.cls}`}>{status.emoji} {status.text}</span></div>
                    <div className="progress"><div className="progress-header"><span>เป้า: ฿{formatCurrency(branch.target)}/เดือน</span><span style={{color:getPerformanceColor(pct)}}>{pct.toFixed(1)}%</span></div><div className="progress-bar"><div className="progress-fill" style={{width:`${Math.min(pct,100)}%`,background:getPerformanceColor(pct)}}></div></div></div>
                    <div className="mini-channels">{Object.entries(branch.channelTotals||{}).map(([k,v])=>(<div key={k} className="mini-ch" style={{background:channelConfig[k]?.color||'#666'}}>{channelConfig[k]?.icon} <div className="mini-ch-value">฿{(v/1000).toFixed(0)}k</div></div>))}</div>
                    <div className="branch-expenses-row"><span>📦 {branch.costPct}%</span><span>📢 {branch.adsPct}%</span><span>💳 {branch.feesPct}%</span></div>
                    <div className="branch-stats"><div className="stat"><div className="stat-label">ยอดขาย</div><div className="stat-value">฿{formatCurrency(branch.sales)}</div></div><div className="stat"><div className="stat-label">ค่าใช้จ่าย</div><div className="stat-value neg">{branch.totalExpPct}%</div></div><div className="stat"><div className="stat-label">กำไร</div><div className="stat-value pos">฿{formatCurrency(branch.netProfit)}</div></div></div>
                  </div>);
                })}
              </div>
              {selectedBranch && (<div className="emp-section"><div className="emp-header"><h3>👥 พนักงาน {selectedBranch.name}</h3><button className="close-btn" onClick={()=>setSelectedBranch(null)}>✕</button></div>
                {selectedBranch.employees?.length > 0 ? (<div className="emp-grid">{[...selectedBranch.employees].sort((a,b)=>(b.netProfit||0)-(a.netProfit||0)).map((emp,idx)=>(<div key={emp.id} className="emp-card"><div className="emp-card-header"><div className="emp-avatar">{emp.name?.charAt(0)||'?'}</div><div><div className="emp-name">{emp.name}</div><div className="emp-rank">อันดับ {idx+1}</div></div><span className={`rank-badge ${idx<3?`rank-${idx+1}`:'rank-n'}`}>{idx+1}</span></div><div className="emp-channels">{Object.entries(emp.channels||{}).map(([k,v])=>(<div key={k} className="emp-ch" style={{background:channelConfig[k]?.color||'#666'}}>{channelConfig[k]?.icon} ฿{((v||0)/1000).toFixed(0)}k</div>))}</div><div className="emp-expenses-row"><span style={{color:expenseConfig.cost.color}}>📦 {emp.costPct}%</span><span style={{color:expenseConfig.ads.color}}>📢 {emp.adsPct}%</span><span style={{color:expenseConfig.fees.color}}>💳 {emp.feesPct}%</span></div><div className="emp-summary"><div><span>ยอดขาย</span><strong>฿{formatCurrency(emp.totalSales)}</strong></div><div><span>ค่าใช้จ่าย</span><strong style={{color:'#f87171'}}>{emp.totalExpPct}%</strong></div><div><span>กำไร</span><strong style={{color:'#34d399'}}>฿{formatCurrency(emp.netProfit)}</strong></div></div></div>))}</div>) : <p style={{textAlign:'center',color:'#64748b',padding:'20px'}}>ยังไม่มีพนักงาน</p>}
              </div>)}
            </>
          )
        )}

        {activeTab === 'entry' && <DataEntryPage token={token} onDataChange={loadDashboardData} />}
      </div>
    </>
  );
}

const styles = `
@import url('https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;500;600&family=Sarabun:wght@300;400;500&display=swap');
*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Sarabun',sans-serif}
.loading{min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0f172a;color:white;font-size:20px}
.login-page{min-height:100vh;background:linear-gradient(135deg,#0f172a,#1e293b);display:flex;align-items:center;justify-content:center;padding:20px}
.login-card{background:rgba(30,41,59,.9);border:1px solid rgba(148,163,184,.2);border-radius:20px;padding:40px;width:100%;max-width:400px}
.login-header{text-align:center;margin-bottom:30px}.login-logo{font-size:50px;margin-bottom:16px}.login-header h1{font-family:'Kanit',sans-serif;font-size:24px;color:white;margin-bottom:8px}.login-header p{color:#94a3b8;font-size:14px}
.form-group{margin-bottom:20px}.form-group label{display:block;color:#94a3b8;font-size:13px;margin-bottom:8px}.form-group input,.form-group select{width:100%;padding:14px 16px;background:rgba(15,23,42,.8);border:1px solid rgba(148,163,184,.2);border-radius:10px;color:white;font-family:'Sarabun',sans-serif;font-size:15px}.form-group input:focus,.form-group select:focus{outline:none;border-color:#3b82f6}
.form-row{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}@media(max-width:600px){.form-row{grid-template-columns:1fr}}
.error-msg{background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);color:#f87171;padding:12px;border-radius:8px;font-size:13px;margin-bottom:20px}
.login-btn,.submit-btn,.start-btn{width:100%;padding:14px;background:linear-gradient(135deg,#3b82f6,#6366f1);border:none;border-radius:10px;color:white;font-family:'Sarabun',sans-serif;font-size:15px;font-weight:500;cursor:pointer;transition:transform .2s}.login-btn:hover:not(:disabled),.submit-btn:hover:not(:disabled),.start-btn:hover{transform:translateY(-2px)}.login-btn:disabled,.submit-btn:disabled{opacity:.7;cursor:not-allowed}.start-btn{width:auto;padding:14px 32px;margin-top:20px}
.demo-hint{margin-top:24px;padding-top:20px;border-top:1px solid rgba(148,163,184,.1);text-align:center}.demo-hint p{color:#64748b;font-size:12px}
.dashboard{min-height:100vh;background:linear-gradient(135deg,#0f172a,#1e293b);color:#e2e8f0;padding:20px}
.header{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:16px}
.logo{display:flex;align-items:center;gap:14px}.logo-icon{width:50px;height:50px;background:linear-gradient(135deg,#3b82f6,#8b5cf6);border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:26px}.title{font-family:'Kanit',sans-serif;font-size:24px;font-weight:600;color:white}.subtitle{font-size:12px;color:#64748b}
.header-actions{display:flex;align-items:center;gap:12px}.user-info{padding:8px 14px;background:rgba(30,41,59,.8);border-radius:10px;font-size:13px}.logout-btn{padding:8px 14px;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);border-radius:8px;color:#f87171;font-size:12px;cursor:pointer}
.tabs{display:flex;background:rgba(30,41,59,.8);border-radius:10px;padding:4px;gap:4px;margin-bottom:20px;overflow-x:auto}.tab{padding:12px 24px;border:none;background:transparent;color:#94a3b8;font-family:'Sarabun',sans-serif;font-size:14px;cursor:pointer;border-radius:8px;white-space:nowrap}.tab.active{background:linear-gradient(135deg,#3b82f6,#6366f1);color:white}.tab:hover:not(.active){background:rgba(59,130,246,.1)}
.filters{display:flex;gap:16px;margin-bottom:20px;flex-wrap:wrap;align-items:center}.filter{display:flex;align-items:center;gap:8px;font-size:13px;color:#94a3b8}.filter select{padding:8px 14px;background:rgba(30,41,59,.8);border:1px solid rgba(148,163,184,.2);border-radius:8px;color:#e2e8f0;font-family:'Sarabun',sans-serif}.refresh-btn{padding:8px 16px;background:rgba(16,185,129,.1);border:1px solid rgba(16,185,129,.3);border-radius:8px;color:#34d399;font-size:13px;cursor:pointer}.refresh-btn:hover{background:rgba(16,185,129,.2)}
.empty-dashboard{text-align:center;padding:60px 20px;background:rgba(30,41,59,.6);border:1px solid rgba(148,163,184,.1);border-radius:14px}.empty-icon{font-size:64px;margin-bottom:20px}.empty-dashboard h2{font-family:'Kanit',sans-serif;font-size:24px;margin-bottom:12px}.empty-dashboard p{color:#94a3b8;margin-bottom:8px}
.empty-state{text-align:center;padding:30px;color:#94a3b8}
.summary-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:14px;margin-bottom:20px}.summary-card{background:rgba(30,41,59,.6);border:1px solid rgba(148,163,184,.1);border-radius:14px;padding:16px;position:relative;overflow:hidden}.summary-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:var(--accent)}.card-icon{font-size:20px;margin-bottom:8px}.card-label{font-size:10px;color:#94a3b8;text-transform:uppercase}.card-value{font-family:'Kanit',sans-serif;font-size:20px;font-weight:600;margin-top:4px}.card-sub{font-size:11px;color:#64748b;margin-top:4px}
.expense-summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;margin-bottom:20px}.expense-card{background:rgba(30,41,59,.6);border:1px solid rgba(148,163,184,.1);border-radius:12px;padding:14px}.expense-header{display:flex;justify-content:space-between;margin-bottom:8px;font-size:13px}.expense-pct{font-family:'Kanit',sans-serif;font-weight:600}.expense-bar{height:6px;background:rgba(148,163,184,.2);border-radius:3px;overflow:hidden}.expense-fill{height:100%;border-radius:3px}.expense-value{font-size:12px;color:#94a3b8;margin-top:8px}
.channels-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;margin-bottom:20px}.channel-card{background:rgba(30,41,59,.6);border:1px solid rgba(148,163,184,.1);border-radius:14px;padding:16px;display:flex;align-items:center;gap:14px}.channel-icon{width:46px;height:46px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:22px}.channel-name{font-size:12px;color:#94a3b8}.channel-value{font-family:'Kanit',sans-serif;font-size:18px;font-weight:600}.channel-pct{font-size:11px;padding:3px 8px;border-radius:6px;margin-top:4px;display:inline-block}
.chart-section{background:rgba(30,41,59,.6);border:1px solid rgba(148,163,184,.1);border-radius:14px;padding:20px;margin-bottom:20px}.chart-section h3{font-family:'Kanit',sans-serif;font-size:15px;margin-bottom:16px}
.branch-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px}.branch-card{background:rgba(30,41,59,.6);border:1px solid rgba(148,163,184,.1);border-radius:14px;padding:16px;cursor:pointer;transition:all .2s}.branch-card:hover{transform:translateY(-2px);border-color:rgba(59,130,246,.3)}.branch-card.selected{border-color:#3b82f6;box-shadow:0 0 0 1px #3b82f6}.branch-header{display:flex;justify-content:space-between;margin-bottom:12px}.branch-name{font-family:'Kanit',sans-serif;font-size:14px;font-weight:500}.branch-emp{font-size:11px;color:#64748b}.status{padding:4px 10px;border-radius:20px;font-size:10px}.status.success{background:rgba(16,185,129,.15);color:#34d399}.status.warning{background:rgba(245,158,11,.15);color:#fbbf24}.status.danger{background:rgba(239,68,68,.15);color:#f87171}.progress{margin-bottom:12px}.progress-header{display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px;color:#94a3b8}.progress-bar{height:5px;background:rgba(148,163,184,.2);border-radius:3px;overflow:hidden}.progress-fill{height:100%;border-radius:3px}.mini-channels{display:flex;gap:6px;margin-bottom:10px}.mini-ch{flex:1;padding:8px 4px;border-radius:8px;text-align:center;font-size:10px;color:white}.mini-ch-value{font-family:'Kanit',sans-serif;font-size:11px;font-weight:500}.branch-expenses-row{display:flex;justify-content:space-around;font-size:11px;margin-bottom:10px;padding:8px;background:rgba(15,23,42,.5);border-radius:8px}.branch-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.stat{text-align:center;padding:8px 4px;background:rgba(15,23,42,.5);border-radius:8px}.stat-label{font-size:9px;color:#64748b}.stat-value{font-family:'Kanit',sans-serif;font-size:12px;font-weight:500}.stat-value.pos{color:#34d399}.stat-value.neg{color:#f87171}
.emp-section{background:rgba(30,41,59,.6);border:1px solid rgba(148,163,184,.1);border-radius:14px;padding:18px;margin-top:20px;animation:slideUp .3s ease}@keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}.emp-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}.emp-header h3{font-family:'Kanit',sans-serif;font-size:16px;font-weight:500}.close-btn{width:28px;height:28px;border:none;background:rgba(148,163,184,.1);color:#94a3b8;border-radius:6px;cursor:pointer;font-size:16px}.close-btn:hover{background:rgba(239,68,68,.2);color:#f87171}.emp-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px}.emp-card{background:rgba(15,23,42,.5);border-radius:10px;padding:14px}.emp-card-header{display:flex;align-items:center;gap:10px;margin-bottom:12px}.emp-avatar{width:36px;height:36px;border-radius:8px;background:linear-gradient(135deg,#3b82f6,#8b5cf6);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:600;color:white}.emp-name{font-weight:500;font-size:13px}.emp-rank{font-size:10px;color:#64748b}.rank-badge{width:24px;height:24px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;margin-left:auto}.rank-1{background:linear-gradient(135deg,#fbbf24,#f59e0b);color:#1e293b}.rank-2{background:linear-gradient(135deg,#94a3b8,#64748b);color:#1e293b}.rank-3{background:linear-gradient(135deg,#a78bfa,#7c3aed);color:white}.rank-n{background:rgba(148,163,184,.2);color:#94a3b8}
.emp-performance{margin-bottom:10px}.perf-bar{height:6px;background:rgba(148,163,184,.2);border-radius:3px;overflow:hidden;margin-bottom:4px}.perf-fill{height:100%;border-radius:3px}.perf-info{display:flex;justify-content:space-between;font-size:11px}
.emp-channels{margin-bottom:10px}.emp-ch-row{display:flex;align-items:center;gap:8px;font-size:11px;padding:4px 0;border-bottom:1px solid rgba(148,163,184,.1)}.emp-ch-row:last-child{border-bottom:none}.ch-target{color:#64748b;font-size:10px}
.emp-expenses-row{display:flex;justify-content:space-around;font-size:11px;margin-bottom:10px;padding:6px;background:rgba(15,23,42,.3);border-radius:6px}.emp-summary{display:flex;justify-content:space-between;padding-top:10px;border-top:1px solid rgba(148,163,184,.1);font-size:11px}.emp-summary div{text-align:center}.emp-summary span{display:block;color:#64748b;font-size:9px}.emp-summary strong{font-family:'Kanit',sans-serif}
.data-entry{max-width:600px;margin:0 auto}.entry-tabs{display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap}.entry-tab{padding:10px 16px;background:rgba(30,41,59,.6);border:1px solid rgba(148,163,184,.2);border-radius:8px;color:#94a3b8;font-size:13px;cursor:pointer;transition:all .2s}.entry-tab:hover{background:rgba(59,130,246,.1)}.entry-tab.active{background:linear-gradient(135deg,#3b82f6,#6366f1);color:white;border-color:transparent}.entry-form{background:rgba(30,41,59,.6);border:1px solid rgba(148,163,184,.1);border-radius:14px;padding:24px;margin-bottom:20px}.entry-form h3{font-family:'Kanit',sans-serif;font-size:18px;margin-bottom:20px}.message{padding:12px;border-radius:8px;margin-bottom:16px;font-size:14px;text-align:center}.message.success{background:rgba(16,185,129,.1);color:#34d399;border:1px solid rgba(16,185,129,.3)}.message.error{background:rgba(239,68,68,.1);color:#f87171;border:1px solid rgba(239,68,68,.3)}
.data-list{margin-top:24px;padding-top:20px;border-top:1px solid rgba(148,163,184,.1)}.data-list h4{font-family:'Kanit',sans-serif;font-size:14px;margin-bottom:12px;color:#94a3b8}.data-item{display:flex;justify-content:space-between;align-items:center;padding:12px;background:rgba(15,23,42,.5);border-radius:8px;margin-bottom:8px;font-size:13px;flex-wrap:wrap;gap:8px}.data-item small{color:#64748b}
.emp-item{flex-direction:column;align-items:stretch}.emp-info{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px}.emp-targets{display:flex;gap:12px;font-size:11px;flex-wrap:wrap;margin-top:4px}
.item-actions{display:flex;gap:6px;justify-content:flex-end}
.edit-btn{padding:6px 10px;background:rgba(59,130,246,.1);border:1px solid rgba(59,130,246,.3);border-radius:6px;color:#60a5fa;font-size:12px;cursor:pointer}.edit-btn:hover{background:rgba(59,130,246,.2)}
.delete-btn{padding:6px 10px;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);border-radius:6px;color:#f87171;font-size:12px;cursor:pointer}.delete-btn:hover{background:rgba(239,68,68,.2)}
.edit-modal{background:rgba(15,23,42,.8);border:1px solid rgba(59,130,246,.3);border-radius:12px;padding:20px;margin-bottom:20px}.edit-modal h4{font-family:'Kanit',sans-serif;font-size:16px;margin-bottom:16px;color:#60a5fa}
.btn-row{display:flex;gap:12px}.btn-row .submit-btn{flex:1}.cancel-btn{flex:1;padding:14px;background:rgba(148,163,184,.1);border:1px solid rgba(148,163,184,.3);border-radius:10px;color:#94a3b8;font-family:'Sarabun',sans-serif;font-size:15px;cursor:pointer}.cancel-btn:hover{background:rgba(148,163,184,.2)}
.target-sum{text-align:center;padding:12px;background:rgba(59,130,246,.1);border-radius:8px;margin-bottom:16px;color:#60a5fa;font-family:'Kanit',sans-serif}
.branch-info{display:flex;align-items:center;flex:1}
`;
