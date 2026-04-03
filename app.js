/* ==================== INDIABIZ ANALYTICS v5.0 — ENHANCED FRONTEND ==================== */
'use strict';

const API = '';
let token = null, currentUser = null, charts = {}, currentStateFilter = '';

// ── Chart.js Dark Theme Defaults ─────────────────────────────────────────────
if (window.Chart) {
  Chart.defaults.color = '#64748b';
  Chart.defaults.borderColor = 'rgba(255,255,255,0.05)';
  Chart.defaults.plugins.legend.labels.color = '#94a3b8';
  Chart.defaults.plugins.title.color = '#94a3b8';
  Chart.defaults.scale = Chart.defaults.scale || {};
}

// Patch Chart defaults after DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  if (window.Chart) {
    Chart.defaults.color = '#64748b';
    Chart.defaults.borderColor = 'rgba(255,255,255,0.05)';
    Chart.defaults.backgroundColor = 'rgba(59,130,246,0.1)';
    if (Chart.defaults.plugins) {
      if (Chart.defaults.plugins.legend) Chart.defaults.plugins.legend.labels.color = '#94a3b8';
      if (Chart.defaults.plugins.title)  Chart.defaults.plugins.title.color = '#e2e8f0';
      if (Chart.defaults.plugins.tooltip) {
        Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(10,14,27,0.95)';
        Chart.defaults.plugins.tooltip.titleColor = '#f1f5f9';
        Chart.defaults.plugins.tooltip.bodyColor = '#94a3b8';
        Chart.defaults.plugins.tooltip.borderColor = 'rgba(255,255,255,0.07)';
        Chart.defaults.plugins.tooltip.borderWidth = 1;
      }
    }
  }
});

// ==================== UTILITIES ====================
const api = async (url, opts = {}) => {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  try {
    const res = await fetch(API + url, { ...opts, headers: { ...headers, ...(opts.headers || {}) } });
    return res.json();
  } catch (e) {
    return { success: false, error: 'Network error — is the server running?' };
  }
};

const fmt = (n, dec = 2) => {
  if (n == null || n === '') return '—';
  const num = parseFloat(n);
  if (isNaN(num)) return '—';
  if (num >= 10000000) return '₹' + (num / 10000000).toFixed(1) + 'Cr';
  if (num >= 100000) return '₹' + (num / 100000).toFixed(1) + 'L';
  if (num >= 1000) return '₹' + (num / 1000).toFixed(1) + 'K';
  return '₹' + num.toFixed(dec);
};

const fmtNum = n => (n == null) ? '—' : Number(n).toLocaleString('en-IN');
const fmtPct = n => (n == null) ? '—' : n.toFixed(1) + '%';
const fmtSafe = n => (n == null || n === undefined || n === '') ? '—' : n;
const fmtMSE = n => {
  if (n == null) return '—';
  // MSE can be very large — format intelligently
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(2) + 'K';
  return n.toFixed(4);
};

function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast show ${type}`;
  setTimeout(() => t.className = 'toast', 3500);
}

function setLoading(id, msg = 'Loading...') {
  const el = document.getElementById(id);
  if (el) el.innerHTML = `<div class="loading"><div class="spinner"></div>${msg}</div>`;
}

function destroyChart(key) {
  if (charts[key]) { charts[key].destroy(); charts[key] = null; }
}

function togglePwd(id, btn) {
  const inp = document.getElementById(id);
  if (inp.type === 'password') { inp.type = 'text'; btn.textContent = '🙈'; }
  else { inp.type = 'password'; btn.textContent = '👁'; }
}

function toggleSidebar() {
  const sidebar = document.querySelector('#adminApp .sidebar');
  if (sidebar) sidebar.classList.toggle('collapsed');
}

// ==================== AUTH ====================
function showAuthTab(tab) {
  document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
  document.querySelectorAll('.auth-tab').forEach(b => b.classList.remove('active'));
  const form = document.getElementById(tab);
  if (form) form.classList.add('active');
  const tabBtn = document.getElementById('tab-' + tab);
  if (tabBtn) tabBtn.classList.add('active');
  if (tab === 'register') loadAuthStates();
}

async function adminLogin() {
  const u = document.getElementById('adminUsername').value.trim();
  const p = document.getElementById('adminPassword').value;
  const err = document.getElementById('adminLoginError');
  err.textContent = '';
  if (!u || !p) { err.textContent = 'Username and password are required'; return; }
  const btn = document.querySelector('#adminLogin .btn-login');
  btn.disabled = true; btn.querySelector('span').textContent = 'Signing in...';
  try {
    const r = await api('/api/auth/login/admin', { method: 'POST', body: JSON.stringify({ username: u, password: p }) });
    if (r.success) {
      token = r.token; currentUser = r.user;
      localStorage.setItem('ib_token', token);
      localStorage.setItem('ib_user', JSON.stringify(currentUser));
      enterAdminApp(r.user);
    } else {
      err.textContent = r.error || 'Invalid credentials. Please try again.';
    }
  } catch (e) {
    err.textContent = 'Connection error. Is the server running?';
  } finally {
    btn.disabled = false; btn.querySelector('span').textContent = 'Sign In as Admin';
  }
}

function enterAdminApp(user) {
  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('adminApp').style.display = 'flex';
  document.getElementById('adminUserLabel').textContent = user.username;
  const av = document.getElementById('adminAvatar');
  if (av) av.textContent = user.username.charAt(0).toUpperCase();
  initAdminApp();
}

function enterUserApp(user) {
  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('userApp').style.display = 'flex';
  document.getElementById('userLabel').textContent = user.username;
  const av = document.getElementById('userAvatar');
  if (av) av.textContent = user.username.charAt(0).toUpperCase();
  initUserApp();
}

async function userLogin() {
  const u = document.getElementById('userUsername').value.trim();
  const p = document.getElementById('userPassword').value;
  const err = document.getElementById('userLoginError');
  err.textContent = '';
  if (!u || !p) { err.textContent = 'Username and password are required'; return; }
  const btn = document.querySelector('#userLogin .btn-login');
  btn.disabled = true; btn.querySelector('span').textContent = 'Signing in...';
  try {
    const r = await api('/api/auth/login/user', { method: 'POST', body: JSON.stringify({ username: u, password: p }) });
    if (r.success) {
      token = r.token; currentUser = r.user;
      localStorage.setItem('ib_token', token);
      localStorage.setItem('ib_user', JSON.stringify(currentUser));
      enterUserApp(r.user);
    } else {
      err.textContent = r.error || 'Invalid credentials.';
    }
  } catch (e) {
    err.textContent = 'Connection error.';
  } finally {
    btn.disabled = false; btn.querySelector('span').textContent = 'Sign In';
  }
}

async function registerUser() {
  const data = {
    username: document.getElementById('regUsername').value.trim(),
    email: document.getElementById('regEmail').value.trim(),
    password: document.getElementById('regPassword').value,
    full_name: document.getElementById('regFullName').value.trim(),
    mobile_number: document.getElementById('regMobile').value.trim(),
    company_name: document.getElementById('regCompanyName').value.trim(),
    company_email: document.getElementById('regCompanyEmail').value.trim(),
    company_business_type: document.getElementById('regBusinessType').value.trim(),
    company_state: document.getElementById('regState').value,
    company_city: document.getElementById('regCity').value
  };

  const err = document.getElementById('registerError');
  const suc = document.getElementById('registerSuccess');
  err.textContent = ''; suc.textContent = '';

  // Validate
  for (const [k, v] of Object.entries(data)) {
    if (!v) { err.textContent = `Please fill in: ${k.replace(/_/g, ' ')}`; return; }
  }
  if (data.password.length < 8) { err.textContent = 'Password must be at least 8 characters'; return; }
  if (!/^\d{10}$/.test(data.mobile_number)) { err.textContent = 'Mobile must be exactly 10 digits'; return; }

  try {
    const r = await api('/api/auth/register/user', { method: 'POST', body: JSON.stringify(data) });
    if (r.success) {
      suc.textContent = '✅ Account created! You can now log in with your credentials.';
      setTimeout(() => showAuthTab('userLogin'), 2000);
    } else {
      err.textContent = r.error || 'Registration failed';
    }
  } catch (e) {
    err.textContent = 'Connection error';
  }
}

async function forgotPassword() {
  const email = document.getElementById('fpEmail').value.trim();
  if (!email) { return; }
  const r = await api('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
  const res = document.getElementById('fpResult');
  if (r.success) {
    res.textContent = `Token generated (dev mode): ${r.dev_reset_token}`;
    document.getElementById('fpResetSection').style.display = 'block';
  } else {
    res.textContent = r.error || 'Email not found';
  }
}

async function resetPassword() {
  const token_val = document.getElementById('fpToken').value.trim();
  const new_password = document.getElementById('fpNewPw').value;
  const confirm_password = document.getElementById('fpConfirmPw').value;
  if (new_password !== confirm_password) { showToast('Passwords do not match', 'error'); return; }
  const r = await api('/api/auth/reset-password', { method: 'POST', body: JSON.stringify({ token: token_val, new_password, confirm_password }) });
  showToast(r.success ? 'Password reset successfully!' : (r.error || 'Failed'), r.success ? 'success' : 'error');
  if (r.success) showAuthTab('userLogin');
}

function logout() {
  token = null; currentUser = null;
  localStorage.removeItem('ib_token');
  localStorage.removeItem('ib_user');
  location.reload();
}

async function loadAuthStates() {
  const r = await api('/api/states');
  if (!r.success) return;
  const sel = document.getElementById('regState');
  r.states.forEach(s => {
    const o = document.createElement('option');
    o.value = s; o.textContent = s;
    sel.appendChild(o);
  });
}

async function loadRegDistricts() {
  const state = document.getElementById('regState').value;
  const sel = document.getElementById('regCity');
  sel.innerHTML = '<option value="">Select City/District</option>';
  if (!state) return;
  const r = await api(`/api/districts/${encodeURIComponent(state)}`);
  if (r.success) r.districts.forEach(d => {
    const o = document.createElement('option'); o.value = d; o.textContent = d; sel.appendChild(o);
  });
}

// ==================== INIT ====================
function initAdminApp() {
  loadStatesFilter();
  showAdminPage('overview');
}

async function loadStatesFilter() {
  const r = await api('/api/states');
  if (!r.success) return;
  const selectors = ['stateFilterSelect', 'productStateFilter', 'analyticsStateFilter',
                     'forecastStateFilter', 'optStateFilter', 'plStateFilter'];
  selectors.forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    // Clear existing options except first
    while (sel.options.length > 1) sel.remove(1);
    r.states.forEach(s => {
      const o = document.createElement('option'); o.value = s; o.textContent = s; sel.appendChild(o);
    });
  });
}

function showAdminPage(page) {
  document.querySelectorAll('#adminApp .page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('#adminApp .nav-item').forEach(n => n.classList.remove('active'));
  const pageEl = document.getElementById(`page-${page}`);
  if (pageEl) pageEl.classList.add('active');
  const navEl = document.querySelector(`#adminApp .nav-item[data-page="${page}"]`);
  if (navEl) navEl.classList.add('active');

  if (page === 'overview') loadAdminDashboard(currentStateFilter);
  if (page === 'indiaMap') { loadIndiaMap(); loadIndiaMapSVG(); setTimeout(loadIndiaMapD3, 500); }
  if (page === 'products') loadAllProducts();
  if (page === 'productList') loadProductListPage();  // FIX: Product List page loader
  if (page === 'stateAnalytics') loadStateAnalytics();
  if (page === 'forecasting') loadForecastAccuracy();
  if (page === 'optimization') loadOptimizationPage();
  if (page === 'users') loadUsers();
  if (page === 'forecast2025') load2025Comparison();
}

// ==================== ADMIN DASHBOARD ====================
async function loadAdminDashboard(state = '') {
  const url = `/api/admin/dashboard${state ? `?state=${encodeURIComponent(state)}` : ''}`;
  const r = await api(url);

  // Helper to safely set text on any element (clears skeleton child divs)
  const setEl = (id, val) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = '';
    el.textContent = val;
  };

  if (!r.success) {
    showToast('Failed to load dashboard data', 'error');
    ['kpiCompanies','kpiUsersCard','kpiProductsCard','kpiRevenue','kpiForecastRev',
     'kpiAccuracy','kpiMAE','kpiMSE','kpiRMSE','kpiMSEcard'].forEach(id => setEl(id, '—'));
    const body = document.getElementById('stateTableBody');
    if (body) body.innerHTML = '<tr><td colspan="7" class="bs-empty-cell">Unable to load data. Please check server connection.</td></tr>';
    return;
  }

  const k = r.kpis;

  // Hero card
  setEl('kpiCompanies', fmtNum(k.total_companies));

  // Users — two possible IDs
  setEl('kpiUsers',     fmtNum(k.total_users));
  setEl('kpiUsersVal',  fmtNum(k.total_users));
  setEl('kpiUsersCard', fmtNum(k.total_users));

  // Products
  setEl('kpiProducts',     fmtNum(k.total_products));
  setEl('kpiProductsInline', fmtNum(k.total_products));
  setEl('kpiProductsCard', fmtNum(k.total_products));

  // Revenue
  setEl('kpiRevenue', fmt(k.total_revenue));
  setEl('kpiForecastRev', fmt(k.total_forecasted_sales));
  setEl('kpiForecastInline', fmt(k.total_forecasted_sales));

  // Accuracy
  if (k.forecast_accuracy_pct != null) {
    setEl('kpiAccuracy', fmtPct(k.forecast_accuracy_pct));
    setEl('kpiMape', k.mape != null ? `MAPE: ${k.mape.toFixed(1)}%` : 'Forecast Accuracy');
  } else {
    setEl('kpiAccuracy', '—');
    setEl('kpiMape', 'No data yet');
  }

  // Metrics
  setEl('kpiMAE',  k.mae  != null ? k.mae.toFixed(2)  : '—');
  setEl('kpiMSE',  k.mse  != null ? fmtMSE(k.mse)     : '—');
  setEl('kpiRMSE', k.rmse != null ? k.rmse.toFixed(2) : '—');
  setEl('kpiMSEcard', k.mse != null ? fmtMSE(k.mse)   : '—');

  // MAE / RMSE badges
  const maeBadge = document.getElementById('kpiMAEbadge');
  if (maeBadge) maeBadge.textContent = k.mae != null ? k.mae.toFixed(1) : '—';
  const rmseBadge = document.getElementById('kpiRMSEbadge');
  if (rmseBadge) rmseBadge.textContent = k.rmse != null ? k.rmse.toFixed(1) : '—';

  // Draw gauge chart for accuracy
  drawBsGauge(k.forecast_accuracy_pct);

  // Top / bottom products
  const tp = k.top_performing_product;
  const topCard = document.getElementById('topProductCard');
  if (topCard) topCard.innerHTML = tp
    ? `<h4 style="font-weight:700;font-size:.88rem;margin-bottom:4px">${tp.name}</h4>
       <p style="color:var(--text2);font-size:.78rem">📍 ${tp.state || '—'} · ${tp.company_name || '—'}</p>
       <p style="font-weight:700;color:#6366f1;margin-top:6px;font-size:.92rem">${fmt(tp.revenue)}</p>`
    : '<p style="color:var(--text3);font-size:.8rem">No product data yet.</p>';

  const bp = k.lowest_performing_product;
  const botCard = document.getElementById('botProductCard');
  if (botCard) botCard.innerHTML = bp
    ? `<h4 style="font-weight:700;font-size:.88rem;margin-bottom:4px">${bp.name}</h4>
       <p style="color:var(--text2);font-size:.78rem">📍 ${bp.state || '—'} · ${bp.company_name || '—'}</p>
       <p style="font-weight:700;color:#f59e0b;margin-top:6px;font-size:.92rem">${fmt(bp.revenue)}</p>`
    : '<p style="color:var(--text3);font-size:.8rem">No product data yet.</p>';

  // Always update hidden legacy metrics panel
  updateMetricsPanel(k);

  // State table
  const body = document.getElementById('stateTableBody');
  const count = r.state_analysis ? r.state_analysis.length : 0;
  const stateCountEl = document.getElementById('stateCount');
  if (stateCountEl) stateCountEl.textContent = `${count} state${count !== 1 ? 's' : ''}`;

  if (!body) return;
  if (!count) {
    body.innerHTML = '<tr><td colspan="7" class="bs-empty-cell">No data yet. Users must register and add products to see state analytics.</td></tr>';
    // Still draw the bar chart with empty state
    drawBsBarChart([], []);
    return;
  }

  body.innerHTML = r.state_analysis.map(s => {
    const acc = s.forecast_accuracy != null ? fmtPct(s.forecast_accuracy) : 'No Data';
    const dotClass = s.forecast_accuracy == null ? '' :
      s.forecast_accuracy >= 80 ? 'good' : s.forecast_accuracy >= 60 ? 'ok' : 'poor';
    return `<tr>
      <td><strong>${s.state || '—'}</strong></td>
      <td>${s.company_count}</td>
      <td>${s.product_count}</td>
      <td>${fmt(s.total_revenue)}</td>
      <td>${fmt(s.forecasted_revenue)}</td>
      <td>${dotClass ? `<span class="status-dot ${dotClass}"></span>` : ''}${acc}</td>
      <td><button class="state-drill-btn" onclick="openStateDrillThrough('${s.state}')">🔍 Drill</button></td>
    </tr>`;
  }).join('');

  // Bar chart — top 6 states by revenue
  const top6 = r.state_analysis.slice(0, 6);
  const labels = top6.map(s => s.state.length > 8 ? s.state.split(' ')[0] : s.state);
  const actuals = top6.map(s => s.total_revenue);
  const forecasts = top6.map(s => s.forecasted_revenue);
  drawBsBarChart(labels, actuals, forecasts);
}

// ── Boltshift Bar Chart ──────────────────────────────────────────────────────
function drawBsBarChart(labels, actuals, forecasts = []) {
  destroyChart('bsBar');
  const ctx = document.getElementById('bsBarChart')?.getContext('2d');
  if (!ctx) return;
  charts['bsBar'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Actual Revenue',
          data: actuals,
          backgroundColor: (ctx) => {
            const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, 260);
            g.addColorStop(0, 'rgba(99,102,241,0.85)');
            g.addColorStop(1, 'rgba(139,92,246,0.55)');
            return g;
          },
          borderRadius: 8,
          borderSkipped: false,
          barPercentage: 0.55,
        },
        {
          label: 'Forecasted',
          data: forecasts,
          backgroundColor: 'rgba(203,213,225,0.18)',
          borderRadius: 8,
          borderSkipped: false,
          barPercentage: 0.55,
          borderColor: 'rgba(203,213,225,0.3)',
          borderWidth: 1,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: true, position: 'top', labels: { color: '#94a3b8', font: { size: 12 }, padding: 16, usePointStyle: true, pointStyleWidth: 8 } },
        tooltip: {
          backgroundColor: '#1a2540',
          titleColor: '#f1f5f9',
          bodyColor: '#94a3b8',
          borderColor: 'rgba(255,255,255,0.08)',
          borderWidth: 1,
          callbacks: { label: c => c.dataset.label + ': ' + fmt(c.raw) }
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#64748b', font: { size: 11 } } },
        y: {
          grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
          ticks: { color: '#64748b', font: { size: 11 }, callback: v => v >= 100000 ? '₹'+(v/100000).toFixed(0)+'L' : v >= 1000 ? '₹'+(v/1000).toFixed(0)+'K' : '₹'+v }
        }
      }
    }
  });
}

// ── Boltshift Gauge (half-donut) ─────────────────────────────────────────────
function drawBsGauge(pct) {
  destroyChart('bsGauge');
  const ctx = document.getElementById('bsGaugeChart')?.getContext('2d');
  if (!ctx) return;
  const val = pct != null ? Math.min(Math.max(pct, 0), 100) : 0;
  const remaining = 100 - val;
  // Color based on accuracy
  const color = val >= 80 ? '#f59e0b' : val >= 60 ? '#6366f1' : '#ef4444';
  charts['bsGauge'] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      datasets: [{
        data: [val, remaining],
        backgroundColor: [color, 'rgba(255,255,255,0.06)'],
        borderWidth: 0,
        circumference: 180,
        rotation: -90,
      }]
    },
    options: {
      responsive: false,
      cutout: '72%',
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      animation: { duration: 900, easing: 'easeInOutQuart' }
    }
  });
}

// ── State table search filter ─────────────────────────────────────────────────
function filterStateTable(query) {
  const q = query.toLowerCase();
  document.querySelectorAll('#stateTableBody tr').forEach(tr => {
    const text = tr.textContent.toLowerCase();
    tr.style.display = text.includes(q) ? '' : 'none';
  });
}

/**
 * updateMetricsPanel — populates the Forecast Accuracy Metrics deep-dive panel.
 * Renders progress bars and interpretation text for MAPE, MAE, MSE, RMSE, accuracy.
 */
function updateMetricsPanel(k) {
  const panel = document.getElementById('accuracyMetricsPanel');
  if (!panel) return;

  const acc   = k.forecast_accuracy_pct;
  const mape  = k.mape;
  const mae   = k.mae;
  const mse   = k.mse;
  const rmse  = k.rmse;
  const n     = k.sample_size || 0;

  // Badge
  const badge = document.getElementById('metricsSampleBadge');
  if (badge) badge.textContent = n > 0 ? `${n} paired records` : 'No data yet';

  // Accuracy
  const accEl = document.getElementById('mdcAccuracy');
  const accBar = document.getElementById('mdcAccBar');
  if (accEl) accEl.textContent = acc != null ? acc.toFixed(2) + '%' : '—';
  if (accBar) accBar.style.width = (acc != null ? Math.min(acc, 100) : 0) + '%';

  // MAPE — bar shows "how much accuracy is left" (inverse of error)
  const mapeEl = document.getElementById('mdcMAPE');
  const mapeBar = document.getElementById('mdcMapeBar');
  if (mapeEl) mapeEl.textContent = mape != null ? mape.toFixed(2) + '%' : '—';
  if (mapeBar) mapeBar.style.width = (mape != null ? Math.min(mape, 100) : 0) + '%';

  // MAE
  const maeEl = document.getElementById('mdcMAE');
  const maeBar = document.getElementById('mdcMaeBar');
  if (maeEl) maeEl.textContent = mae != null ? mae.toFixed(2) : '—';
  // Relative bar: assuming max reference ~500 for visual
  if (maeBar) maeBar.style.width = mae != null ? Math.min((mae / 200) * 100, 100) + '%' : '0%';

  // MSE
  const mseEl = document.getElementById('mdcMSE');
  const mseBar = document.getElementById('mdcMseBar');
  if (mseEl) mseEl.textContent = mse != null ? fmtMSE(mse) : '—';
  if (mseBar) mseBar.style.width = mse != null ? Math.min((Math.sqrt(mse) / 300) * 100, 100) + '%' : '0%';

  // RMSE
  const rmseEl = document.getElementById('mdcRMSE');
  const rmseBar = document.getElementById('mdcRmseBar');
  if (rmseEl) rmseEl.textContent = rmse != null ? rmse.toFixed(2) : '—';
  if (rmseBar) rmseBar.style.width = rmse != null ? Math.min((rmse / 300) * 100, 100) + '%' : '0%';

  // Sample size bar (reference = 100 records = 100%)
  const sampEl = document.getElementById('mdcSamples');
  const sampBar = document.getElementById('mdcSamplesBar');
  if (sampEl) sampEl.textContent = n > 0 ? fmtNum(n) : '—';
  if (sampBar) sampBar.style.width = n > 0 ? Math.min((n / 100) * 100, 100) + '%' : '0%';

  // Interpretation
  const interp = document.getElementById('metricsInterpretation');
  const interpText = document.getElementById('interpText');
  if (interp && interpText && n > 0 && acc != null) {
    let rating, color, advice;
    if (acc >= 90) { rating = 'Excellent'; color = '#10b981'; advice = 'The forecasting model is performing very well. Continue recording sales consistently to maintain accuracy.'; }
    else if (acc >= 75) { rating = 'Good'; color = '#3b82f6'; advice = 'Forecast accuracy is good. Consider applying error correction to further reduce MAPE.'; }
    else if (acc >= 60) { rating = 'Fair'; color = '#f59e0b'; advice = 'Moderate accuracy. Increase data consistency — ensure sales are recorded at least weekly. Run "Correct Error" to recalibrate.'; }
    else { rating = 'Needs Improvement'; color = '#ef4444'; advice = 'Low forecast accuracy. Apply optimization and error correction immediately. Ensure all products have at least 3 months of historical sales data.'; }
    interpText.innerHTML = `<strong style="color:${color}">${rating} (${acc.toFixed(1)}%)</strong> — ${advice} 
      <br><small style="color:var(--text3);margin-top:4px;display:block">Based on ${n} forecast-vs-actual paired records. MAPE=${mape!=null?mape.toFixed(2)+'%':'—'} | MAE=${mae!=null?mae.toFixed(2):'—'} | RMSE=${rmse!=null?rmse.toFixed(2):'—'} | MSE=${mse!=null?fmtMSE(mse):'—'}</small>`;
    interp.style.display = 'block';
  } else if (interp) {
    interp.style.display = n === 0 ? 'none' : 'block';
    if (interpText && n === 0) interpText.textContent = 'No forecast vs actual data available yet. Record sales to generate accuracy metrics.';
  }
}

function applyStateFilter() {
  const state = document.getElementById('stateFilterSelect').value;
  currentStateFilter = state;
  loadAdminDashboard(state);
}

function refreshDashboard() {
  loadAdminDashboard(currentStateFilter);
  showToast('Dashboard refreshed', 'success');
}

// ==================== FORECAST ACCURACY ====================
async function loadForecastAccuracy() {
  const state = document.getElementById('forecastStateFilter')?.value || '';
  const url = `/api/admin/forecast-accuracy${state ? `?state=${encodeURIComponent(state)}` : ''}`;
  const r = await api(url);
  if (!r.success) return;
  const m = r.forecast_metrics;

  document.getElementById('fAccuracy').textContent = m.accuracy_pct != null ? fmtPct(m.accuracy_pct) : '—';
  document.getElementById('fMAPE').textContent = m.mape != null ? m.mape.toFixed(2) + '%' : '—';
  document.getElementById('fMAE').textContent = m.mae != null ? m.mae.toFixed(2) : '—';
  document.getElementById('fMSE').textContent = m.mse != null ? fmtMSE(m.mse) : '—';
  document.getElementById('fRMSE').textContent = m.rmse != null ? m.rmse.toFixed(2) : '—';
  document.getElementById('fSamples').textContent = fmtNum(m.sample_size);

  await buildAccuracyChart();
}

async function buildAccuracyChart() {
  const r = await api('/api/admin/analytics/heatmap');
  if (!r.success || !r.heatmap.length) {
    const ctx = document.getElementById('accuracyChart');
    if (ctx) ctx.parentElement.innerHTML = `<div class="chart-header"><h3 class="card-title">Revenue Distribution by State</h3></div><div class="chart-empty" style="padding:60px;text-align:center;color:var(--text3)">No revenue data yet. Add products and record sales.</div>`;
    return;
  }
  destroyChart('accuracyChart');
  const ctx = document.getElementById('accuracyChart')?.getContext('2d');
  if (!ctx) return;
  const sorted = [...r.heatmap].sort((a, b) => b.total_revenue - a.total_revenue).slice(0, 15);
  const labels = sorted.map(h => h.state || 'Unknown');
  const revs = sorted.map(h => h.total_revenue);
  const maxRev = Math.max(...revs, 1);

  charts['accuracyChart'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Revenue (₹)',
        data: revs,
        backgroundColor: revs.map(v => {
          const ratio = v / maxRev;
          if (ratio > 0.7) return '#1d4ed8';
          if (ratio > 0.4) return '#3b82f6';
          if (ratio > 0.1) return '#93c5fd';
          return '#dbeafe';
        }),
        borderRadius: 6,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` Revenue: ${fmt(ctx.raw)}` } } },
      scales: {
        y: { ticks: { callback: v => fmt(v) }, grid: { color: 'rgba(255,255,255,0.04)' } },
        x: { ticks: { maxRotation: 45 }, grid: { display: false } }
      }
    }
  });
}

// ==================== STATE DRILL-THROUGH ====================
// NOTE: this function is called from inline onclick handlers in dynamically rendered HTML.
// It must remain in global scope (not wrapped in any block or module).
async function openStateDrillThrough(state) {
  const modal = document.getElementById('stateKPIModal');
  document.getElementById('stateModalTitle').textContent = `📍 ${state} — KPI Drill-through`;
  // Show loading state immediately so user sees feedback
  document.getElementById('stateModalBody').innerHTML =
    `<div class="loading-row" style="padding:40px;justify-content:center"><div class="spinner-sm"></div>&nbsp;Loading ${state} KPIs…</div>`;
  modal.style.display = 'flex';

  const r = await api(`/api/admin/state/${encodeURIComponent(state)}/kpis`);
  if (!r.success) {
    document.getElementById('stateModalBody').innerHTML =
      `<p style="color:var(--danger);padding:20px">Failed to load KPIs for ${state}. Please retry.</p>`;
    showToast('Failed to load state KPIs', 'error');
    return;
  }

  const m  = r.forecast_metrics;
  const tp = r.top_product;
  const wp = r.worst_product;  // new: worst-performing product

  // Helper: render a top/worst product spotlight card
  const renderSpotlight = (prod, label, borderColor) => {
    if (!prod) return `<div class="product-spotlight-card" style="border-top-color:${borderColor}"><div class="ps-label">${label}</div><div style="color:var(--text-muted);font-style:italic;font-size:.82rem">No data</div></div>`;
    const growth = prod.growth_pct != null
      ? `<span class="${prod.growth_pct >= 0 ? 'growth-positive' : 'growth-negative'}">${prod.growth_pct >= 0 ? '▲' : '▼'} ${Math.abs(prod.growth_pct)}%</span>`
      : '—';
    const badgeCls = prod.forecast_accuracy == null ? '' : prod.forecast_accuracy >= 80 ? 'good' : prod.forecast_accuracy >= 60 ? 'ok' : 'poor';
    const acc = prod.forecast_accuracy != null ? fmtPct(prod.forecast_accuracy) : '—';
    return `<div class="product-spotlight-card" style="border-top-color:${borderColor}">
      <div class="ps-label">${label}</div>
      <div class="ps-name">${prod.product_name}</div>
      <div class="pkpi-row"><span class="pkpi-label">Revenue</span><span class="pkpi-value">${fmt(prod.revenue)}</span></div>
      <div class="pkpi-row"><span class="pkpi-label">Units Sold</span><span class="pkpi-value">${fmtNum(prod.qty_sold)}</span></div>
      <div class="pkpi-row"><span class="pkpi-label">District</span><span class="pkpi-value">${prod.district || '—'}</span></div>
      <div class="pkpi-row"><span class="pkpi-label">MoM Growth</span><span class="pkpi-value">${growth}</span></div>
      ${badgeCls ? `<span class="accuracy-badge ${badgeCls}" style="margin-top:8px;display:inline-block">Acc: ${acc}</span>` : ''}
    </div>`;
  };

  document.getElementById('stateModalBody').innerHTML = `
    <div class="kpi-mini-grid">
      <div class="kpi-mini-card"><div class="kpi-mini-value">${fmt(r.total_revenue)}</div><div class="kpi-mini-label">Total Revenue</div></div>
      <div class="kpi-mini-card"><div class="kpi-mini-value">${fmtNum(r.sale_count)}</div><div class="kpi-mini-label">Sales Count</div></div>
      <div class="kpi-mini-card"><div class="kpi-mini-value">${m.accuracy_pct != null ? fmtPct(m.accuracy_pct) : '—'}</div><div class="kpi-mini-label">Forecast Accuracy</div></div>
      <div class="kpi-mini-card"><div class="kpi-mini-value">${m.mape != null ? m.mape.toFixed(1) + '%' : '—'}</div><div class="kpi-mini-label">MAPE</div></div>
      <div class="kpi-mini-card"><div class="kpi-mini-value">${m.sample_size || 0}</div><div class="kpi-mini-label">Sample Size</div></div>
      <div class="kpi-mini-card"><div class="kpi-mini-value">${tp ? tp.product_name : '—'}</div><div class="kpi-mini-label">Top Product</div></div>
    </div>

    <!-- Product Spotlight: Top & Worst side-by-side -->
    <h4 style="margin:18px 0 10px;font-size:.9rem;font-weight:700;color:var(--text)">🏆 Product Spotlight — ${state}</h4>
    <div style="display:flex;gap:14px;flex-wrap:wrap;margin-bottom:18px">
      ${renderSpotlight(tp, '🥇 Top Performer', '#10b981')}
      ${renderSpotlight(wp, '⚠️ Needs Attention', '#f59e0b')}
    </div>

    <h4 style="margin:16px 0 12px;font-size:.9rem;font-weight:700;color:var(--text)">Product KPIs in ${state}</h4>
    ${r.products.length === 0
      ? `<div class="empty-state" style="padding:40px"><p>No products in this state yet.</p></div>`
      : `<div class="product-card-grid">${r.products.map(p => {
          const growth = p.growth_pct != null
            ? `<span class="${p.growth_pct >= 0 ? 'growth-positive' : 'growth-negative'}">${p.growth_pct >= 0 ? '▲' : '▼'} ${Math.abs(p.growth_pct)}%</span>`
            : '—';
          const acc = p.forecast_accuracy != null ? fmtPct(p.forecast_accuracy) : '—';
          const badgeCls = p.forecast_accuracy == null ? '' : p.forecast_accuracy >= 80 ? 'good' : p.forecast_accuracy >= 60 ? 'ok' : 'poor';
          return `<div class="product-kpi-card">
            <h5>${p.product_name}</h5>
            <div class="pkpi-row"><span class="pkpi-label">District</span><span class="pkpi-value">${p.district || '—'}</span></div>
            <div class="pkpi-row"><span class="pkpi-label">Revenue</span><span class="pkpi-value">${fmt(p.product_revenue)}</span></div>
            <div class="pkpi-row"><span class="pkpi-label">Growth</span><span class="pkpi-value">${growth}</span></div>
            <div class="pkpi-row"><span class="pkpi-label">Forecast</span><span class="pkpi-value">${fmt(p.latest_forecast)}</span></div>
            <div class="pkpi-row"><span class="pkpi-label">Actual</span><span class="pkpi-value">${fmt(p.latest_actual)}</span></div>
            ${badgeCls ? `<span class="accuracy-badge ${badgeCls}">Accuracy: ${acc}</span>` : ''}
          </div>`;
        }).join('')}</div>`
    }`;
}

function closeStateModal(e) { if (e.target === document.getElementById('stateKPIModal')) closeStateModalForce(); }
function closeStateModalForce() { document.getElementById('stateKPIModal').style.display = 'none'; }

// ==================== INDIA MAP ====================
// India State SVG Paths (polygon-based, realistic shapes)
const INDIA_STATE_PATHS = {
  "Jammu & Kashmir": "M310,60 L360,50 L420,70 L430,90 L410,110 L380,120 L350,110 L320,95 Z",
  "Ladakh": "M420,55 L490,45 L540,70 L550,100 L520,115 L480,110 L435,95 L420,75 Z",
  "Himachal Pradesh": "M355,115 L400,110 L420,125 L415,150 L390,160 L365,155 L350,140 Z",
  "Punjab": "M305,120 L345,115 L355,135 L350,165 L330,170 L308,160 L300,140 Z",
  "Uttarakhand": "M415,115 L455,108 L475,125 L480,155 L460,165 L435,160 L415,145 Z",
  "Haryana": "M330,165 L360,158 L375,175 L375,205 L355,215 L330,210 L318,195 Z",
  "Delhi": "M358,200 L375,195 L380,215 L365,225 L352,218 Z",
  "Rajasthan": "M230,190 L315,175 L335,210 L330,290 L305,340 L270,355 L230,345 L210,300 L215,240 Z",
  "Uttar Pradesh": "M375,195 L480,165 L540,190 L555,230 L540,275 L500,290 L450,285 L400,270 L370,245 L360,215 Z",
  "Bihar": "M540,220 L590,215 L615,235 L615,275 L590,290 L555,285 L535,260 Z",
  "Sikkim": "M620,215 L640,210 L648,225 L638,240 L622,238 Z",
  "Arunachal Pradesh": "M645,185 L730,175 L770,195 L780,225 L755,240 L720,238 L688,228 L650,218 Z",
  "Nagaland": "M760,230 L795,225 L805,250 L798,272 L775,275 L758,258 Z",
  "Manipur": "M762,270 L795,265 L800,295 L788,318 L768,320 L755,300 Z",
  "Mizoram": "M748,318 L775,310 L778,340 L768,360 L748,358 L740,340 Z",
  "Tripura": "M720,330 L745,325 L748,352 L738,368 L718,365 L714,348 Z",
  "Meghalaya": "M615,275 L665,270 L688,285 L688,305 L665,315 L630,312 L610,298 Z",
  "Assam": "M618,240 L690,228 L728,235 L755,250 L758,270 L730,278 L690,275 L648,268 L620,255 Z",
  "West Bengal": "M590,280 L630,275 L648,298 L645,355 L625,390 L605,395 L590,370 L582,325 L585,295 Z",
  "Jharkhand": "M545,280 L590,272 L610,295 L610,340 L590,360 L560,360 L538,335 L535,305 Z",
  "Odisha": "M540,355 L595,345 L620,365 L625,415 L610,455 L580,465 L548,450 L530,415 L530,380 Z",
  "Chhattisgarh": "M448,295 L538,280 L552,310 L555,375 L535,405 L505,410 L475,390 L455,355 L445,320 Z",
  "Madhya Pradesh": "M308,265 L450,248 L490,270 L495,315 L480,355 L445,365 L390,365 L340,345 L305,315 Z",
  "Gujarat": "M195,280 L265,260 L310,270 L320,310 L305,355 L275,380 L240,395 L200,375 L185,330 Z",
  "Maharashtra": "M280,375 L360,345 L450,355 L475,390 L475,440 L450,475 L405,490 L360,490 L310,465 L278,435 Z",
  "Goa": "M265,490 L288,485 L295,508 L282,520 L265,512 Z",
  "Karnataka": "M290,490 L380,468 L420,490 L435,535 L420,575 L390,600 L355,608 L318,590 L292,555 L278,520 Z",
  "Telangana": "M435,390 L510,380 L535,405 L540,445 L520,475 L485,480 L455,465 L432,440 Z",
  "Andhra Pradesh": "M430,475 L520,458 L570,475 L580,520 L565,560 L535,580 L495,585 L458,562 L430,530 Z",
  "Tamil Nadu": "M375,605 L430,598 L500,570 L528,600 L520,645 L495,685 L455,710 L415,715 L382,690 L365,650 Z",
  "Kerala": "M308,590 L355,598 L372,640 L365,685 L345,720 L318,728 L295,705 L290,665 L300,625 Z",
  "Chandigarh": "M345,173 L355,170 L358,180 L350,185 L342,180 Z",
  "Puducherry": "M497,668 L510,665 L513,678 L500,682 Z",
};

// State label positions (cx, cy)
const STATE_LABEL_POS = {
  "Jammu & Kashmir": [370, 88], "Ladakh": [485, 78], "Himachal Pradesh": [385, 138],
  "Punjab": [328, 145], "Uttarakhand": [447, 138], "Haryana": [350, 190],
  "Delhi": [366, 210], "Rajasthan": [265, 270], "Uttar Pradesh": [455, 230],
  "Bihar": [575, 252], "Sikkim": [633, 225], "Arunachal Pradesh": [712, 208],
  "Nagaland": [780, 250], "Manipur": [777, 293], "Mizoram": [758, 338],
  "Tripura": [730, 348], "Meghalaya": [648, 293], "Assam": [688, 254],
  "West Bengal": [612, 338], "Jharkhand": [572, 318], "Odisha": [575, 405],
  "Chhattisgarh": [498, 345], "Madhya Pradesh": [398, 308], "Gujarat": [248, 328],
  "Maharashtra": [375, 430], "Goa": [278, 502], "Karnataka": [355, 545],
  "Telangana": [485, 432], "Andhra Pradesh": [500, 525], "Tamil Nadu": [440, 650],
  "Kerala": [330, 658], "Chandigarh": [350, 177], "Puducherry": [504, 673],
};

let mapHeatmapData = {};


async function loadIndiaMap() {
  const r = await api('/api/admin/analytics/heatmap');
  if (!r.success) return;
  const maxRev = Math.max(...r.heatmap.map(h => h.total_revenue || 0), 1);
  mapHeatmapData = {};
  r.heatmap.forEach(h => { mapHeatmapData[h.state] = { ...h, max: maxRev }; });
  // Store for tooltip reference
  colorMapStates(maxRev);
}

function getStateColor(revenue, max) {
  if (!revenue || max === 0) return '#dbeafe';
  const ratio = revenue / max;
  if (ratio > 0.7) return '#1d4ed8';
  if (ratio > 0.4) return '#2563eb';
  if (ratio > 0.2) return '#3b82f6';
  if (ratio > 0.05) return '#93c5fd';
  return '#bfdbfe';
}

function colorMapStates(maxRev) {
  // With the new segmented map, we keep distinct colors but adjust opacity based on revenue
  // This preserves the "not heatmap" requirement while still showing relative performance
  document.querySelectorAll('.state-path').forEach(el => {
    const state = el.getAttribute('data-state');
    const d = mapHeatmapData[state];
    const baseColor = el.getAttribute('data-base-color') || '#60a5fa';
    if (d && d.total_revenue > 0) {
      // Keep base color but indicate data availability with full opacity
      el.style.opacity = '1';
    } else {
      el.style.opacity = '0.45';
    }
  });
}

function loadIndiaMapSVG() {
  const svg = document.getElementById('indiaSVG');
  if (!svg) return;
  svg.innerHTML = '';
  const tooltip = document.getElementById('mapTooltip');

  // State fill colors palette (distinct colors per state, not heatmap)
  const STATE_COLORS = [
    '#4ade80','#60a5fa','#f97316','#a78bfa','#fb7185','#34d399','#facc15',
    '#38bdf8','#c084fc','#f472b6','#2dd4bf','#fb923c','#818cf8','#4ade80',
    '#86efac','#93c5fd','#fda4af','#6ee7b7','#fcd34d','#5eead4','#a5b4fc',
    '#fdba74','#d8b4fe','#f9a8d4','#99f6e4','#fde68a','#c7d2fe','#bbf7d0',
    '#bae6fd','#fecdd3','#e9d5ff','#fed7aa','#d1fae5'
  ];
  const stateKeys = Object.keys(INDIA_STATE_PATHS);

  stateKeys.forEach((state, idx) => {
    const pathData = INDIA_STATE_PATHS[state];
    const baseColor = STATE_COLORS[idx % STATE_COLORS.length];
    const labelPos = STATE_LABEL_POS[state];
    
    // Create path element
    const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pathEl.setAttribute('d', pathData);
    pathEl.setAttribute('class', 'state-path');
    pathEl.setAttribute('data-state', state);
    pathEl.setAttribute('data-base-color', baseColor);
    pathEl.setAttribute('fill', baseColor);
    pathEl.setAttribute('stroke', '#fff');
    pathEl.setAttribute('stroke-width', '1.5');
    pathEl.style.cursor = 'pointer';
    pathEl.style.transition = 'opacity 0.2s, filter 0.2s';

    // Label
    if (labelPos) {
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', labelPos[0]);
      text.setAttribute('y', labelPos[1]);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'middle');
      const abbr = state.length > 10 ? state.split(' ').map(w=>w[0]).join('') : state.split(' ')[0];
      const fontSize = state.length > 15 ? 6 : state === 'Delhi' || state === 'Goa' || state === 'Sikkim' ? 5 : 7;
      text.setAttribute('font-size', fontSize);
      text.setAttribute('fill', '#1e293b');
      text.setAttribute('pointer-events', 'none');
      text.setAttribute('font-weight', '700');
      text.setAttribute('font-family', 'Plus Jakarta Sans, sans-serif');
      text.textContent = abbr;
      svg.appendChild(text);
    }

    pathEl.addEventListener('mouseenter', (e) => {
      const d = mapHeatmapData[state];
      pathEl.style.filter = 'brightness(0.85) drop-shadow(0 2px 6px rgba(0,0,0,0.3))';
      // FIX: If product overlay is active, show product-specific tooltip
      if (_pl.mapOverlayData && _pl.mapOverlayProductName) {
        const prodRev = _pl.mapOverlayData[state] || 0;
        tooltip.innerHTML = `<strong>${state}</strong><br>📦 ${_pl.mapOverlayProductName}: ${prodRev > 0 ? fmt(prodRev) : 'No sales'}`;
      } else {
        tooltip.innerHTML = `<strong>${state}</strong><br>Revenue: ${fmt(d?.total_revenue || 0)}<br>Products: ${d?.product_count || 0}<br>Companies: ${d?.company_count || 0}`;
      }
      tooltip.style.display = 'block';
    });
    pathEl.addEventListener('mousemove', (e) => {
      tooltip.style.left = (e.clientX + 14) + 'px';
      tooltip.style.top = (e.clientY - 36) + 'px';
    });
    pathEl.addEventListener('mouseleave', () => {
      pathEl.style.filter = '';
      tooltip.style.display = 'none';
    });
    pathEl.addEventListener('click', () => {
      document.querySelectorAll('.state-path').forEach(r => {
        r.setAttribute('stroke-width', '1.5');
        r.setAttribute('stroke', '#fff');
      });
      pathEl.setAttribute('stroke', '#1e40af');
      pathEl.setAttribute('stroke-width', '3');
      tooltip.style.display = 'none';
      // FIX: If product overlay is active, show product-specific revenue for state
      if (_pl.mapOverlayData && _pl.mapOverlayProductName) {
        _showProductStateDetail(state);
      } else {
        showMapStateDetail(state);
      }
    });

    svg.appendChild(pathEl);
  });
}

async function showMapStateDetail(state) {
  // FIX: Show loading state immediately, add error toast on failure
  const detail = document.getElementById('mapStateDetail');
  if (!detail) return;
  detail.innerHTML = '<div class="loading" style="padding:20px;display:flex;align-items:center;gap:8px"><div class="spinner-sm"></div> Loading KPIs…</div>';

  const r = await api(`/api/admin/state/${encodeURIComponent(state)}/kpis`);
  if (!r || !r.success) {
    detail.innerHTML = '<p class="placeholder-text" style="color:var(--danger)">⚠️ Failed to load KPIs</p>';
    showToast(`Failed to load KPIs for ${state}`, 'error');
    return;
  }
  const m = r.forecast_metrics || {};

  // FIX: Build enhanced panel with companies count, top/worst product, revenue
  const topProd   = r.top_product;
  const worstProd = r.worst_product;

  // Product revenue for current map overlay (if active)
  let productRevLine = '';
  if (_pl.mapOverlayData && _pl.mapOverlayProductName) {
    const prodRev = _pl.mapOverlayData[state] || 0;
    productRevLine = `<div class="state-detail-stat" style="background:rgba(59,130,246,.08);border-radius:6px;padding:6px 8px;margin:4px 0">
      <span class="state-detail-label">📦 ${_pl.mapOverlayProductName}</span>
      <span class="state-detail-value" style="color:var(--accent)">${fmt(prodRev)}</span>
    </div>`;
  }

  detail.innerHTML = `
    <h4 style="margin-bottom:12px;font-weight:700;font-size:.95rem;border-bottom:1px solid var(--border);padding-bottom:10px">📍 ${state}</h4>
    <div class="state-detail-stat"><span class="state-detail-label">Total Revenue</span><span class="state-detail-value">${fmt(r.total_revenue)}</span></div>
    <div class="state-detail-stat"><span class="state-detail-label">Total Sales</span><span class="state-detail-value">${fmtNum(r.sale_count)}</span></div>
    <div class="state-detail-stat"><span class="state-detail-label">Companies</span><span class="state-detail-value">${fmtNum(r.companies_count || 0)}</span></div>
    <div class="state-detail-stat"><span class="state-detail-label">Products</span><span class="state-detail-value">${r.products ? r.products.length : 0}</span></div>
    <div class="state-detail-stat"><span class="state-detail-label">Forecast Acc.</span><span class="state-detail-value">${m.accuracy_pct != null ? fmtPct(m.accuracy_pct) : '—'}</span></div>
    <div class="state-detail-stat"><span class="state-detail-label">MAPE</span><span class="state-detail-value">${m.mape != null ? m.mape.toFixed(1) + '%' : '—'}</span></div>
    ${productRevLine}
    ${topProd ? `<div class="state-detail-stat" style="margin-top:8px"><span class="state-detail-label">🏆 Top Product</span><span class="state-detail-value" style="max-width:130px;text-align:right;font-size:.76rem;color:var(--success)">${topProd.product_name}</span></div>
    <div class="state-detail-stat"><span class="state-detail-label" style="padding-left:12px">Revenue</span><span class="state-detail-value">${fmt(topProd.revenue)}</span></div>` : ''}
    ${worstProd ? `<div class="state-detail-stat"><span class="state-detail-label">⚠️ Needs Attention</span><span class="state-detail-value" style="max-width:130px;text-align:right;font-size:.76rem;color:#f59e0b">${worstProd.product_name}</span></div>` : ''}
    <button class="btn-primary" style="width:100%;margin-top:14px;justify-content:center" onclick="openStateDrillThrough('${state}')">🔍 Full Drill-through</button>`;
}

// ==================== PRODUCTS ====================
async function loadAllProducts() {
  const state = document.getElementById('productStateFilter')?.value || '';
  const url = `/api/admin/products${state ? `?state=${encodeURIComponent(state)}` : ''}`;
  const r = await api(url);
  const container = document.getElementById('productHierarchy');
  const noMsg = document.getElementById('noProductsMsg');

  if (!r.success || !r.products || r.products.length === 0) {
    container.innerHTML = '';
    noMsg.style.display = 'block';
    return;
  }
  noMsg.style.display = 'none';

  const hierarchy = r.hierarchy || {};
  let html = '';
  for (const [st, districts] of Object.entries(hierarchy)) {
    let districtHtml = '';
    for (const [dist, prods] of Object.entries(districts)) {
      const prodCards = prods.map(p => {
        const acc = p.forecast_accuracy != null ? p.forecast_accuracy : null;
        const badgeCls = acc == null ? '' : acc >= 80 ? 'good' : acc >= 60 ? 'ok' : 'poor';
        return `<div class="product-card">
          <h4>${p.product_name || p.name}</h4>
          <div class="product-meta">📂 ${p.category || 'General'}</div>
          <div class="product-meta">📦 Stock: ${fmtNum(p.stock)} | 🏢 ${p.comp_name || '—'}</div>
          <div class="product-meta">💰 Sold: ${fmtNum(p.total_sold || 0)} units | Rev: ${fmt(p.total_revenue || 0)}</div>
          <div class="product-price">${fmt(p.price)}</div>
          ${badgeCls ? `<span class="accuracy-badge ${badgeCls}">Acc: ${acc.toFixed(1)}%</span>` : ''}
        </div>`;
      }).join('');
      districtHtml += `<div class="hierarchy-district">
        <div class="hierarchy-district-header">📌 ${dist} <span style="font-weight:400;color:var(--text3)">(${prods.length} product${prods.length !== 1 ? 's' : ''})</span></div>
        <div class="hierarchy-products">${prodCards}</div>
      </div>`;
    }
    const totalProds = Object.values(districts).flat().length;
    html += `<div class="hierarchy-state">
      <div class="hierarchy-state-header" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none'">
        <h3>📍 ${st}</h3>
        <span>${totalProds} product${totalProds !== 1 ? 's' : ''}</span>
      </div>
      <div>${districtHtml}</div>
    </div>`;
  }
  container.innerHTML = html;
}

function filterProductsByState() { loadAllProducts(); }

// ==================== STATE ANALYTICS ====================
async function loadStateAnalytics() {
  const state = document.getElementById('analyticsStateFilter')?.value || '';
  const url = `/api/admin/analytics/state-sales-trend${state ? `?state=${encodeURIComponent(state)}` : ''}`;
  const r = await api(url);
  if (!r.success) return;
  buildBarChart(r);
  buildLineChart(r);
  loadHeatmap();
}

function buildBarChart(r) {
  destroyChart('barChart');
  const ctx = document.getElementById('barChart')?.getContext('2d');
  if (!ctx) return;
  const states = Object.keys(r.state_monthly);
  if (!states.length) {
    document.getElementById('barChartEmpty').style.display = 'flex';
    ctx.canvas.style.display = 'none';
    return;
  }
  document.getElementById('barChartEmpty').style.display = 'none';
  ctx.canvas.style.display = '';

  const months = r.months;
  const topState = states[0];
  const data = r.state_monthly[topState] || {};
  const actuals = months.map(m => data[m]?.actual || 0);
  const forecasts = months.map(m => data[m]?.forecast || 0);

  charts['barChart'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: months,
      datasets: [
        { label: 'Actual Revenue', data: actuals, backgroundColor: 'rgba(59,130,246,0.75)', borderRadius: 5, borderSkipped: false },
        { label: 'Forecast Revenue', data: forecasts, backgroundColor: 'rgba(16,185,129,0.65)', borderRadius: 5, borderSkipped: false }
      ]
    },
    options: {
      responsive: true,
      plugins: { title: { display: true, text: `${topState} — Actual vs Forecast`, font: { size: 13, weight: '600' } }, legend: { position: 'bottom' } },
      scales: {
        y: { ticks: { callback: v => fmt(v) }, grid: { color: 'rgba(255,255,255,0.04)' } },
        x: { grid: { display: false } }
      }
    }
  });
}

function buildLineChart(r) {
  destroyChart('lineChart');
  const ctx = document.getElementById('lineChart')?.getContext('2d');
  if (!ctx) return;
  const states = Object.keys(r.state_monthly).slice(0, 5);
  if (!states.length) {
    document.getElementById('lineChartEmpty').style.display = 'flex';
    ctx.canvas.style.display = 'none';
    return;
  }
  document.getElementById('lineChartEmpty').style.display = 'none';
  ctx.canvas.style.display = '';

  const months = r.months;
  const colors = ['#2563eb', '#16a34a', '#dc2626', '#d97706', '#9333ea'];

  const datasets = states.map((state, i) => {
    const data = r.state_monthly[state] || {};
    return {
      label: state,
      data: months.map(m => {
        const d = data[m];
        if (!d) return null;
        if (!d.actual || !d.forecast) return null;
        return Math.max(0, 100 - Math.abs(d.actual - d.forecast) / Math.max(d.actual, d.forecast) * 100);
      }),
      borderColor: colors[i], backgroundColor: colors[i] + '20',
      fill: false, tension: 0.4, pointRadius: 4, pointHoverRadius: 6
    };
  });

  charts['lineChart'] = new Chart(ctx, {
    type: 'line',
    data: { labels: months, datasets },
    options: {
      responsive: true,
      plugins: { title: { display: true, text: 'Forecast Accuracy Trend (%)', font: { size: 13, weight: '600' } }, legend: { position: 'bottom' } },
      scales: {
        y: { min: 0, max: 100, ticks: { callback: v => v + '%' }, grid: { color: 'rgba(255,255,255,0.04)' } },
        x: { grid: { display: false } }
      }
    }
  });
}

async function loadHeatmap() {
  const r = await api('/api/admin/analytics/heatmap');
  if (!r.success) return;
  const container = document.getElementById('heatmapContainer');
  if (!r.heatmap.length) {
    container.innerHTML = '<p class="placeholder-text" style="text-align:center;padding:40px">No revenue data yet. Users must add products and record sales.</p>';
    return;
  }
  const maxRev = Math.max(...r.heatmap.map(h => h.total_revenue || 0), 1);
  container.innerHTML = r.heatmap.map(h => {
    const ratio = h.total_revenue / maxRev;
    let bg, textC;
    if (ratio > 0.7) { bg = '#1d4ed8'; textC = '#fff'; }
    else if (ratio > 0.4) { bg = '#1e3a8a'; textC = '#93c5fd'; }
    else if (ratio > 0.2) { bg = '#172554'; textC = '#60a5fa'; }
    else if (ratio > 0.05) { bg = '#0f1629'; textC = '#3b82f6'; }
    else { bg = '#0b0f1a'; textC = '#2563eb'; }
    return `<div class="heatmap-cell" style="background:${bg};color:${textC}" onclick="openStateDrillThrough('${h.state}')">
      <div class="heatmap-name">${h.state || '?'}</div>
      <div class="heatmap-value">${fmt(h.total_revenue)}</div>
    </div>`;
  }).join('');
}

// ==================== OPTIMIZATION ====================
async function applyOptimization() {
  const state = document.getElementById('optStateFilter').value;
  const btn = document.getElementById('btnApplyOpt');
  const res = document.getElementById('optResultMsg');
  btn.disabled = true;
  btn.innerHTML = `<div class="spinner-sm" style="border-color:rgba(255,255,255,.3);border-top-color:white"></div> Applying...`;
  res.style.display = 'none';

  try {
    const body = {};
    if (state) body.state = state;
    const r = await api('/api/admin/optimization/apply', { method: 'POST', body: JSON.stringify(body) });
    if (r.success) {
      res.className = 'opt-result success';
      res.innerHTML = `✅ ${r.message} | Revenue Delta: ${fmt(r.revenue_delta)}`;
      res.style.display = 'flex';
      updateOptMetrics({ productsOpt: r.products_optimized, revDelta: r.revenue_delta, metrics: r.forecast_metrics });
      loadOptimizationPage();
      loadAdminDashboard(currentStateFilter);
      showToast(r.message, 'success');
    } else {
      res.className = 'opt-result error';
      res.innerHTML = '❌ ' + (r.error || 'Optimization failed');
      res.style.display = 'flex';
    }
  } catch (e) {
    res.className = 'opt-result error';
    res.innerHTML = '❌ Connection error';
    res.style.display = 'flex';
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Apply Optimization`;
  }
}

async function correctError() {
  const btn = document.getElementById('btnCorrectErr');
  const res = document.getElementById('optResultMsg');
  btn.disabled = true;
  btn.innerHTML = `<div class="spinner-sm" style="border-color:rgba(255,255,255,.3);border-top-color:white"></div> Correcting...`;
  res.style.display = 'none';

  try {
    const r = await api('/api/admin/optimization/correct-error', { method: 'POST', body: JSON.stringify({}) });
    if (r.success) {
      res.className = 'opt-result success';
      res.innerHTML = `🔧 ${r.message} | Avg Error Reduction: ${r.avg_error_reduction_pct}%`;
      res.style.display = 'flex';
      updateOptMetrics({ errReduction: r.avg_error_reduction_pct, metrics: r.forecast_metrics });
      loadOptimizationPage();
      loadAdminDashboard(currentStateFilter);
      showToast('Error correction applied!', 'success');
    } else {
      res.className = 'opt-result error';
      res.innerHTML = '❌ ' + (r.error || 'Correction failed');
      res.style.display = 'flex';
    }
  } catch (e) {
    res.className = 'opt-result error';
    res.innerHTML = '❌ Connection error';
    res.style.display = 'flex';
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg> Correct Error`;
  }
}

function updateOptMetrics({ productsOpt, revDelta, errReduction, metrics } = {}) {
  if (productsOpt != null) document.getElementById('optProductsOpt').textContent = productsOpt;
  if (revDelta != null) document.getElementById('optRevDelta').textContent = fmt(revDelta);
  if (errReduction != null) document.getElementById('optErrReduction').textContent = errReduction.toFixed(1) + '%';
  if (metrics?.accuracy_pct != null) document.getElementById('optAccuracy').textContent = fmtPct(metrics.accuracy_pct);
}

async function loadOptimizationPage() {
  // Load optimization log entries
  const r = await api('/api/admin/optimization/log');
  const tbody = document.getElementById('optTableBody');
  if (!r.success || !r.logs || !r.logs.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-cell">No optimization log entries yet. Click "Apply Optimization" or "Correct Error" to start.</td></tr>';
    return;
  }
  tbody.innerHTML = r.logs.map(o => {
    const errReduction = o.error_reduction_pct != null ? o.error_reduction_pct.toFixed(1) + '%' : '—';
    const errColor = o.error_reduction_pct > 0 ? 'color:var(--green-600);font-weight:600' : '';
    const ts = o.timestamp ? o.timestamp.substring(0,16).replace('T',' ') : '—';
    return `<tr>
      <td><strong>${o.product_name || '—'}</strong></td>
      <td>${o.state || '—'}</td>
      <td>${fmt(o.previous_value)}</td>
      <td><strong style="color:var(--green-600)">${fmt(o.optimized_value)}</strong></td>
      <td style="${errColor}">${errReduction}</td>
      <td><span style="font-size:.8rem;color:var(--text2)">${o.method || '—'}</span></td>
      <td style="font-size:.75rem;color:var(--text3)">${ts}</td>
    </tr>`;
  }).join('');
}

// ==================== USERS ====================
async function loadUsers() {
  const r = await api('/api/admin/users');
  if (!r.success) return;
  const tbody = document.getElementById('usersTableBody');
  if (!r.users.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-cell">No users found. Click "+ Add User" to create users.</td></tr>';
    return;
  }
  tbody.innerHTML = r.users.map(u => `<tr>
    <td><strong>${u.username}</strong></td>
    <td>${u.full_name}</td>
    <td>${u.company_name || '—'}</td>
    <td>${u.state || '—'}</td>
    <td>${u.city || '—'}</td>
    <td>${u.email}</td>
    <td style="display:flex;gap:6px;flex-wrap:wrap">
      <button class="btn-primary btn-sm" onclick="viewUserDetail(${u.id})">View</button>
      <button class="btn-danger btn-sm" onclick="deleteUser(${u.id}, '${u.username}')">Delete</button>
    </td>
  </tr>`).join('');
}

async function viewUserDetail(uid) {
  const r = await api(`/api/admin/users/${uid}`);
  if (!r.success) return;
  const u = r.user; const m = r.forecast_metrics;
  document.getElementById('modalTitle').textContent = `User: ${u.username}`;
  document.getElementById('modalBody').innerHTML = `
    <div class="kpi-mini-grid">
      <div class="kpi-mini-card"><div class="kpi-mini-value">${r.inventory.length}</div><div class="kpi-mini-label">Products</div></div>
      <div class="kpi-mini-card"><div class="kpi-mini-value">${fmt(r.total_revenue)}</div><div class="kpi-mini-label">Revenue</div></div>
      <div class="kpi-mini-card"><div class="kpi-mini-value">${m.accuracy_pct != null ? fmtPct(m.accuracy_pct) : '—'}</div><div class="kpi-mini-label">Accuracy</div></div>
      <div class="kpi-mini-card"><div class="kpi-mini-value">${u.company_name || '—'}</div><div class="kpi-mini-label">Company</div></div>
    </div>
    <h4 style="margin:16px 0 12px;font-size:.875rem;font-weight:700">Inventory</h4>
    <div class="table-wrap"><table><thead><tr><th>Product</th><th>Price</th><th>Stock</th><th>Revenue</th></tr></thead>
    <tbody>${r.inventory.length
      ? r.inventory.map(p => `<tr><td>${p.product_name || p.name}</td><td>${fmt(p.price)}</td><td>${fmtNum(p.stock)}</td><td>${fmt(p.total_revenue || 0)}</td></tr>`).join('')
      : '<tr><td colspan="4" class="empty-cell">No products yet</td></tr>'
    }</tbody></table></div>`;
  document.getElementById('modalOverlay').style.display = 'flex';
}

async function deleteUser(uid, username) {
  if (!confirm(`Delete user "${username}"? This action cannot be undone.`)) return;
  const r = await api(`/api/admin/users/${uid}`, { method: 'DELETE' });
  showToast(r.success ? 'User deleted' : (r.error || 'Failed'), r.success ? 'success' : 'error');
  if (r.success) loadUsers();
}

function showAddUserModal() {
  document.getElementById('modalTitle').textContent = 'Add New User';
  document.getElementById('modalBody').innerHTML = `
    <div class="form-row">
      <div><label class="form-label">Username*</label><input class="form-input" id="mu_username" placeholder="username"/></div>
      <div><label class="form-label">Full Name*</label><input class="form-input" id="mu_fullname" placeholder="Full Name"/></div>
    </div>
    <div class="form-row">
      <div><label class="form-label">Email*</label><input class="form-input" id="mu_email" type="email" placeholder="email@company.com"/></div>
      <div><label class="form-label">Password*</label><input class="form-input" id="mu_password" type="password" placeholder="Min 8 chars"/></div>
    </div>
    <div class="form-row">
      <div><label class="form-label">Mobile*</label><input class="form-input" id="mu_mobile" placeholder="10-digit mobile"/></div>
      <div><label class="form-label">Company Name*</label><input class="form-input" id="mu_company" placeholder="Company Name"/></div>
    </div>
    <div class="form-row">
      <div><label class="form-label">Company Email*</label><input class="form-input" id="mu_cemail" type="email" placeholder="company@email.com"/></div>
      <div><label class="form-label">Business Type*</label><input class="form-input" id="mu_btype" placeholder="e.g. Retail, Tech"/></div>
    </div>
    <div class="form-row">
      <div><label class="form-label">State*</label><select class="form-input" id="mu_state" onchange="loadModalDistricts('mu_state','mu_city')"><option value="">Select State</option></select></div>
      <div><label class="form-label">City/District*</label><select class="form-input" id="mu_city"><option value="">Select City</option></select></div>
    </div>
    <button class="btn-primary" onclick="submitAddUser()" style="margin-top:8px;width:100%;justify-content:center">Create User</button>
    <div id="mu_err" class="error-msg"></div>`;
  loadModalStates('mu_state');
  document.getElementById('modalOverlay').style.display = 'flex';
}

async function loadModalStates(selId) {
  const r = await api('/api/states');
  if (!r.success) return;
  const sel = document.getElementById(selId);
  if (!sel) return;
  r.states.forEach(s => { const o = document.createElement('option'); o.value = s; o.textContent = s; sel.appendChild(o); });
}

async function loadModalDistricts(stateId, cityId) {
  const state = document.getElementById(stateId)?.value;
  const sel = document.getElementById(cityId);
  if (!sel) return;
  sel.innerHTML = '<option value="">Select City</option>';
  if (!state) return;
  const r = await api(`/api/districts/${encodeURIComponent(state)}`);
  if (r.success) r.districts.forEach(d => { const o = document.createElement('option'); o.value = d; o.textContent = d; sel.appendChild(o); });
}

async function submitAddUser() {
  const data = {
    username: document.getElementById('mu_username').value.trim(),
    email: document.getElementById('mu_email').value.trim(),
    password: document.getElementById('mu_password').value,
    full_name: document.getElementById('mu_fullname').value.trim(),
    mobile_number: document.getElementById('mu_mobile').value.trim(),
    company_name: document.getElementById('mu_company').value.trim(),
    company_email: document.getElementById('mu_cemail').value.trim(),
    company_business_type: document.getElementById('mu_btype').value.trim(),
    company_state: document.getElementById('mu_state').value,
    company_city: document.getElementById('mu_city').value,
  };
  const errEl = document.getElementById('mu_err');
  for (const [k, v] of Object.entries(data)) {
    if (!v) { errEl.textContent = `Please fill: ${k.replace(/_/g, ' ')}`; return; }
  }
  const r = await api('/api/admin/users', { method: 'POST', body: JSON.stringify(data) });
  if (r.success) {
    closeModalForce();
    showToast('User created successfully!', 'success');
    loadUsers();
  } else {
    errEl.textContent = r.error || 'Failed to create user';
  }
}

function closeModal(e) { if (e.target === document.getElementById('modalOverlay')) closeModalForce(); }
function closeModalForce() { document.getElementById('modalOverlay').style.display = 'none'; }

// ==================== USER APP ====================
function showUserPage(page) {
  document.querySelectorAll('#userApp .page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('#userApp .nav-item').forEach(n => n.classList.remove('active'));
  const pageEl = document.getElementById(`page-${page}`);
  if (pageEl) pageEl.classList.add('active');
  const navEl = document.querySelector(`#userApp .nav-item[data-page="${page}"]`);
  if (navEl) navEl.classList.add('active');
  if (page === 'userDashboard') loadUserDashboard();
  if (page === 'myProducts') loadUserProducts();
  if (page === 'recordSale') loadSaleProductOptions();
}

function initUserApp() { showUserPage('userDashboard'); }

async function loadUserDashboard() {
  const r = await api('/api/user/dashboard');
  if (!r.success) {
    showToast('Failed to load dashboard', 'error');
    return;
  }

  // Update title with company name
  if (r.company_name) {
    document.getElementById('userDashboardTitle').textContent = r.company_name;
  }

  document.getElementById('uKpiProducts').textContent = fmtNum(r.stats.total_products);
  document.getElementById('uKpiRevenue').textContent = fmt(r.stats.total_revenue);
  document.getElementById('uKpiStock').textContent = fmtNum(r.stats.total_stock);

  const acc = r.forecast_metrics?.accuracy_pct;
  document.getElementById('uKpiAccuracy').textContent = acc != null ? fmtPct(acc) : '—';

  const recents = document.getElementById('userRecentProducts');
  if (!r.recent_products.length) {
    recents.innerHTML = `<div class="empty-state" style="padding:32px">
      <div class="empty-icon">📦</div>
      <h3>No Products Yet</h3>
      <p>Add your first product to start tracking sales and forecasts.</p>
      <button class="btn-primary" style="margin-top:12px" onclick="showUserPage('myProducts')">Add Products</button>
    </div>`;
    return;
  }

  recents.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:12px">` +
    r.recent_products.map(p => `<div class="product-card">
      <h4>${p.product_name || p.name}</h4>
      <div class="product-meta">📂 ${p.category || 'General'}</div>
      <div class="product-meta">📦 Stock: ${fmtNum(p.stock)}</div>
      <div class="product-price">${fmt(p.price)}</div>
    </div>`).join('') + `</div>`;
}

async function loadUserProducts() {
  const r = await api('/api/user/products');
  const tbody = document.getElementById('userProductsBody');
  const noMsg = document.getElementById('noUserProductsMsg');
  const tableCard = tbody.closest('.card');

  if (!r.success || !r.products.length) {
    if (tbody) tbody.innerHTML = '';
    if (noMsg) noMsg.style.display = 'block';
    if (tableCard) tableCard.style.display = r.success && !r.products.length ? 'none' : 'block';
    return;
  }

  if (noMsg) noMsg.style.display = 'none';
  if (tableCard) tableCard.style.display = 'block';

  tbody.innerHTML = r.products.map(p => `<tr>
    <td><strong>${p.product_name || p.name}</strong></td>
    <td>${p.category || '—'}</td>
    <td>${fmt(p.price)}</td>
    <td>${fmtNum(p.stock)}</td>
    <td>${p.state || '—'}</td>
    <td>${p.district || '—'}</td>
    <td>${fmt(p.total_revenue || 0)}</td>
    <td><button class="btn-danger btn-sm" onclick="deleteProduct(${p.id})">Delete</button></td>
  </tr>`).join('');
}

async function deleteProduct(pid) {
  if (!confirm('Delete this product? This cannot be undone.')) return;
  const r = await api(`/api/user/products/${pid}`, { method: 'DELETE' });
  showToast(r.success ? 'Product deleted' : (r.error || 'Failed'), r.success ? 'success' : 'error');
  if (r.success) loadUserProducts();
}

function showAddProductModal() {
  document.getElementById('modalTitle').textContent = 'Add New Product';
  document.getElementById('modalBody').innerHTML = `
    <div class="form-row">
      <div><label class="form-label">Product Name*</label><input class="form-input" id="ap_name" placeholder="Product Name"/></div>
      <div><label class="form-label">Category</label><input class="form-input" id="ap_category" placeholder="e.g. Electronics"/></div>
    </div>
    <div class="form-row">
      <div><label class="form-label">Price (₹)*</label><input class="form-input" type="number" id="ap_price" placeholder="0.00" step="0.01" min="0"/></div>
      <div><label class="form-label">Stock*</label><input class="form-input" type="number" id="ap_stock" placeholder="0" min="0"/></div>
    </div>
    <div class="form-row">
      <div><label class="form-label">State (optional)</label><select class="form-input" id="ap_state" onchange="loadModalDistricts('ap_state','ap_district')"><option value="">Auto (from company)</option></select></div>
      <div><label class="form-label">District (optional)</label><select class="form-input" id="ap_district"><option value="">Auto (from company)</option></select></div>
    </div>
    <div class="form-row">
      <div><label class="form-label">Brand</label><input class="form-input" id="ap_brand" placeholder="Brand Name"/></div>
      <div><label class="form-label">SKU</label><input class="form-input" id="ap_sku" placeholder="SKU Code"/></div>
    </div>
    <div><label class="form-label">Description</label><input class="form-input" id="ap_desc" placeholder="Product description"/></div>
    <button class="btn-primary" onclick="submitAddProduct()" style="margin-top:12px;width:100%;justify-content:center">Add Product</button>
    <div id="ap_err" class="error-msg"></div>`;
  loadModalStates('ap_state');
  document.getElementById('modalOverlay').style.display = 'flex';
}

async function submitAddProduct() {
  const name = document.getElementById('ap_name').value.trim();
  const price = parseFloat(document.getElementById('ap_price').value);
  const stock = parseInt(document.getElementById('ap_stock').value);
  const errEl = document.getElementById('ap_err');

  if (!name) { errEl.textContent = 'Product name is required'; return; }
  if (!price || isNaN(price) || price < 0) { errEl.textContent = 'Valid price is required'; return; }
  if (isNaN(stock) || stock < 0) { errEl.textContent = 'Valid stock quantity is required'; return; }

  const data = {
    product_name: name, price, stock,
    category: document.getElementById('ap_category').value.trim() || 'General',
    state: document.getElementById('ap_state').value || undefined,
    district: document.getElementById('ap_district').value || undefined,
    brand: document.getElementById('ap_brand').value.trim() || undefined,
    sku: document.getElementById('ap_sku').value.trim() || undefined,
    description: document.getElementById('ap_desc').value.trim() || undefined,
  };

  const r = await api('/api/user/products', { method: 'POST', body: JSON.stringify(data) });
  if (r.success) {
    closeModalForce();
    showToast('Product added successfully!', 'success');
    loadUserProducts();
    loadUserDashboard();
  } else {
    errEl.textContent = r.error || 'Failed to add product';
  }
}

async function loadSaleProductOptions() {
  const r = await api('/api/user/products');
  const sel = document.getElementById('saleProduct');
  sel.innerHTML = '<option value="">Select Product</option>';

  if (r.success && r.products.length) {
    r.products.forEach(p => {
      const o = document.createElement('option');
      o.value = p.id;
      o.textContent = `${p.product_name || p.name} — ₹${p.price} (Stock: ${p.stock})`;
      o.dataset.price = p.price;
      sel.appendChild(o);
    });
    sel.onchange = () => {
      const opt = sel.options[sel.selectedIndex];
      if (opt.dataset.price) document.getElementById('salePrice').value = opt.dataset.price;
    };
  } else {
    sel.innerHTML = '<option value="">No products yet — Add products first</option>';
  }
}

async function recordSale() {
  const pid = document.getElementById('saleProduct').value;
  const qty = parseInt(document.getElementById('saleQty').value);
  const price = parseFloat(document.getElementById('salePrice').value);
  const customer = document.getElementById('saleCustomer').value.trim();
  const res = document.getElementById('saleResult');
  const accDiv = document.getElementById('saleAccuracyUpdate');
  res.textContent = ''; accDiv.style.display = 'none';
  res.style.display = 'none';

  if (!pid) { res.innerHTML = '⚠️ Please select a product'; res.style.display = 'block'; return; }
  if (!qty || qty < 1) { res.innerHTML = '⚠️ Quantity must be at least 1'; res.style.display = 'block'; return; }
  if (!price || price <= 0) { res.innerHTML = '⚠️ Valid price is required'; res.style.display = 'block'; return; }

  const r = await api('/api/user/sales', {
    method: 'POST',
    body: JSON.stringify({ product_id: pid, quantity: qty, unit_price: price, customer_name: customer || 'Walk-in' })
  });

  res.style.display = 'block';
  if (r.success) {
    res.innerHTML = `✅ Sale recorded! Invoice ID: ${r.sale_id} | Revenue: ${fmt(qty * price)}`;
    res.style.background = 'var(--green-50)';
    res.style.color = 'var(--green-700)';
    res.style.border = '1px solid #bbf7d0';

    if (r.forecast_metrics) {
      const m = r.forecast_metrics;
      accDiv.style.display = 'block';
      document.getElementById('inlineMetrics').innerHTML = `
        <div class="inline-metric"><div class="inline-metric-value">${m.accuracy_pct != null ? fmtPct(m.accuracy_pct) : '—'}</div><div class="inline-metric-label">Accuracy</div></div>
        <div class="inline-metric"><div class="inline-metric-value">${m.mape != null ? m.mape.toFixed(1) + '%' : '—'}</div><div class="inline-metric-label">MAPE</div></div>
        <div class="inline-metric"><div class="inline-metric-value">${m.mae != null ? m.mae.toFixed(1) : '—'}</div><div class="inline-metric-label">MAE</div></div>
        <div class="inline-metric"><div class="inline-metric-value">${fmtNum(m.sample_size)}</div><div class="inline-metric-label">Samples</div></div>`;
    }

    document.getElementById('saleQty').value = '';
    document.getElementById('saleCustomer').value = '';
    showToast('Sale recorded!', 'success');
    loadUserDashboard();
  } else {
    res.innerHTML = '❌ ' + (r.error || 'Failed to record sale');
    res.style.background = '#fef2f2';
    res.style.color = 'var(--danger)';
    res.style.border = '1px solid #fecaca';
  }
}

async function generateForecast() {
  const r = await api('/api/forecast', { method: 'POST', body: JSON.stringify({ days: 30 }) });
  const div = document.getElementById('forecastResult');
  div.style.display = 'block';

  if (r.success && r.forecast) {
    const f = r.forecast;
    if (f.message) {
      div.innerHTML = `<div class="card"><div class="empty-state" style="padding:32px">
        <div class="empty-icon">📊</div>
        <h3>No Sales Data Yet</h3>
        <p>${f.message}</p>
      </div></div>`;
      return;
    }
    div.innerHTML = `<div class="card">
      <div class="card-header"><h3 class="card-title">📈 30-Day Forecast</h3><span class="card-badge blue">${f.algorithm || 'moving_average'}</span></div>
      <div class="kpi-mini-grid" style="margin-top:12px">
        <div class="kpi-mini-card"><div class="kpi-mini-value">${fmtNum(f.forecasted_quantity)}</div><div class="kpi-mini-label">Forecasted Units</div></div>
        <div class="kpi-mini-card"><div class="kpi-mini-value">${fmt(f.forecasted_revenue)}</div><div class="kpi-mini-label">Forecasted Revenue</div></div>
        <div class="kpi-mini-card"><div class="kpi-mini-value">${f.confidence ? Math.round(f.confidence * 100) + '%' : '—'}</div><div class="kpi-mini-label">Confidence</div></div>
        <div class="kpi-mini-card"><div class="kpi-mini-value">${f.forecast_accuracy_pct != null ? fmtPct(f.forecast_accuracy_pct) : '—'}</div><div class="kpi-mini-label">Accuracy</div></div>
        <div class="kpi-mini-card"><div class="kpi-mini-value">${f.mape != null ? f.mape.toFixed(1) + '%' : '—'}</div><div class="kpi-mini-label">MAPE</div></div>
      </div>
    </div>`;
  } else {
    div.innerHTML = `<div class="card"><p style="color:var(--danger);text-align:center;padding:24px">${r.error || 'Failed to generate forecast'}</p></div>`;
  }
}

// ==================== INIT ON LOAD ====================
// ── Page initialisation ──────────────────────────────────────────────────
// FIX: Always show auth screen first to prevent flash of authenticated content.
// Token is validated before auto-login; a small setTimeout ensures DOM is ready.
window.addEventListener('DOMContentLoaded', () => {
  // Step 1: explicitly hide both apps and show auth immediately
  const authEl  = document.getElementById('authScreen');
  const adminEl = document.getElementById('adminApp');
  const userEl  = document.getElementById('userApp');
  if (authEl)  authEl.style.display  = 'flex';
  if (adminEl) adminEl.style.display = 'none';
  if (userEl)  userEl.style.display  = 'none';

  // Step 2: attempt auto-login after a tick (ensures DOM is fully ready)
  setTimeout(() => {
    const savedToken = localStorage.getItem('ib_token');
    const savedUser  = localStorage.getItem('ib_user');
    if (savedToken && savedUser) {
      try {
        token       = savedToken;
        currentUser = JSON.parse(savedUser);
        if (currentUser.role === 'admin') {
          enterAdminApp(currentUser);
        } else if (currentUser.role === 'user') {
          enterUserApp(currentUser);
        } else {
          // Unknown role — clear and stay on auth
          localStorage.clear();
        }
      } catch (e) {
        // Corrupt storage — clear and stay on auth
        localStorage.clear();
      }
    }
    // Always load states for registration form dropdowns
    loadAuthStates();
  }, 50);

  // FIX 3: Overview period buttons — wire up click handlers
  // .bs-period-btn = "This Month" header button
  // .bs-period-sm  = "Last 6 Months" chart header button
  document.querySelectorAll('.bs-period-btn').forEach(btn => {
    btn.style.cursor = 'pointer';
    btn.addEventListener('click', () => {
      const label = btn.querySelector('span')?.textContent?.trim() || 'Selected period';
      showToast(`Showing ${label} data`, 'info');
      // Reload dashboard — current API always returns all data;
      // the toast gives visual feedback that the button is responsive.
      if (typeof loadAdminDashboard === 'function') {
        loadAdminDashboard(typeof currentStateFilter !== 'undefined' ? currentStateFilter : '');
      }
    });
  });
});

// ==================== 2025 FORECAST COMPARISON ====================
async function load2025Comparison() {
  const page = document.getElementById('page-forecast2025');
  if (!page) return;
  
  const data = await api('/api/admin/analytics/2025-comparison');
  if (!data.success) { showToast('Failed to load 2025 data', 'error'); return; }
  
  const { comparison, summary } = data;
  
  // Update KPIs
  document.getElementById('f25TotalActual').textContent = fmt(summary.total_actual_revenue);
  document.getElementById('f25TotalForecast').textContent = fmt(summary.total_forecasted_revenue);
  document.getElementById('f25Variance').textContent = (summary.total_variance >= 0 ? '+' : '') + fmt(summary.total_variance);
  document.getElementById('f25AboveMonths').textContent = summary.months_above_forecast + ' / 12';
  
  const varCard = document.getElementById('f25VarianceCard');
  if (varCard) {
    varCard.className = 'kpi-card ' + (summary.total_variance >= 0 ? 'good-card' : 'warn-card');
  }
  
  // Render table
  const tbody = document.getElementById('forecast2025TableBody');
  if (tbody) {
    tbody.innerHTML = comparison.map(r => {
      const perf = r.performance === 'above' 
        ? '<span class="badge-good">▲ Above</span>' 
        : '<span class="badge-warn">▼ Below</span>';
      const varColor = r.variance >= 0 ? 'color:#059669;font-weight:600' : 'color:#dc2626;font-weight:600';
      const growthStr = r.growth_pct !== 0 
        ? `<span style="${r.growth_pct >= 0 ? 'color:#059669' : 'color:#dc2626'}">${r.growth_pct > 0 ? '+' : ''}${r.growth_pct?.toFixed(1)}%</span>` 
        : '—';
      return `<tr>
        <td><strong>${r.month_label}</strong></td>
        <td>₹${Number(r.actual_revenue).toLocaleString('en-IN')}</td>
        <td>₹${Number(r.forecasted_revenue).toLocaleString('en-IN')}</td>
        <td style="${varColor}">${r.variance >= 0 ? '+' : ''}₹${Math.abs(r.variance).toLocaleString('en-IN')}</td>
        <td style="${varColor}">${r.variance_pct >= 0 ? '+' : ''}${r.variance_pct?.toFixed(1)}%</td>
        <td>${growthStr}</td>
        <td>${perf}</td>
      </tr>`;
    }).join('');
  }
  
  // Line chart
  const labels = comparison.map(r => r.month_label.substring(0, 3));
  const actuals = comparison.map(r => r.actual_revenue);
  const forecasts = comparison.map(r => r.forecasted_revenue);
  
  destroyChart('c2025Line');
  const ctx1 = document.getElementById('chart2025Line')?.getContext('2d');
  if (ctx1) {
    charts['c2025Line'] = new Chart(ctx1, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: 'Actual Revenue', data: actuals, borderColor: '#4f46e5', backgroundColor: 'rgba(79,70,229,0.12)', fill: true, tension: 0.4, pointRadius: 5, pointBackgroundColor: '#4f46e5' },
          { label: 'Forecasted Revenue', data: forecasts, borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.12)', fill: true, tension: 0.4, borderDash: [5,5], pointRadius: 5, pointBackgroundColor: '#10b981' }
        ]
      },
      options: { responsive: true, plugins: { legend: { position: 'top' }, tooltip: { callbacks: { label: ctx => '₹' + ctx.raw.toLocaleString('en-IN') } } }, scales: { y: { ticks: { callback: v => v >= 100000 ? '₹' + (v/100000).toFixed(1) + 'L' : '₹' + v.toLocaleString('en-IN') } } } }
    });
  }
  
  // Bar chart
  destroyChart('c2025Bar');
  const ctx2 = document.getElementById('chart2025Bar')?.getContext('2d');
  if (ctx2) {
    charts['c2025Bar'] = new Chart(ctx2, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Actual Revenue', data: actuals, backgroundColor: comparison.map(r => r.performance === 'above' ? 'rgba(16,185,129,0.8)' : 'rgba(239,68,68,0.8)'), borderRadius: 6 },
          { label: 'Forecasted Revenue', data: forecasts, backgroundColor: 'rgba(79,70,229,0.5)', borderRadius: 6 }
        ]
      },
      options: { responsive: true, plugins: { legend: { position: 'top' }, tooltip: { callbacks: { label: ctx => ctx.dataset.label + ': ₹' + ctx.raw.toLocaleString('en-IN') } } }, scales: { y: { ticks: { callback: v => v >= 100000 ? '₹' + (v/100000).toFixed(1) + 'L' : '₹' + v } } } }
    });
  }
}

// ==================== REPORT DOWNLOAD ====================
async function downloadReport(format = 'html') {
  showToast('Generating report...', '');
  const token = localStorage.getItem('ib_token');
  const url = `/api/admin/report/forecast-summary?format=${format}`;
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  // Add auth via fetch
  try {
    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!res.ok) { showToast('Report generation failed', 'error'); return; }
    const blob = await res.blob();
    const burl = URL.createObjectURL(blob);
    a.href = burl;
    a.download = 'IndiaBiz_Forecast_Report_2025.html';
    a.click();
    URL.revokeObjectURL(burl);
    showToast('Report downloaded! Open in browser and use Ctrl+P to save as PDF.', 'success');
  } catch(e) {
    showToast('Download failed: ' + e.message, 'error');
  }
}

// ==================== ENHANCED INDIA MAP with D3 + GEOJSON ====================
let indiaGeoData = null;
let mapRevData = {};

async function loadIndiaMapD3() {
  const container = document.getElementById('indiaSVG');
  if (!container) return;
  
  // Fetch revenue heatmap data
  const heatRes = await api('/api/admin/analytics/heatmap');
  if (heatRes.success) {
    mapRevData = {};
    let maxRev = 0;
    heatRes.heatmap.forEach(r => {
      mapRevData[r.state] = r.total_revenue;
      if (r.total_revenue > maxRev) maxRev = r.total_revenue;
    });
    
    // Update existing SVG map with color coding
    document.querySelectorAll('#indiaSVG [data-state]').forEach(el => {
      const state = el.getAttribute('data-state');
      const rev = mapRevData[state] || 0;
      const intensity = maxRev > 0 ? rev / maxRev : 0;
      if (intensity > 0.7) el.style.fill = '#1d4ed8';
      else if (intensity > 0.4) el.style.fill = '#3b82f6';
      else if (intensity > 0.1) el.style.fill = '#93c5fd';
      else el.style.fill = '#dbeafe';
    });
  }
}

// 2025 page triggers are handled inline in showAdminPage

// Additional badge styles
const style2025 = document.createElement('style');
style2025.textContent = `
  .badge-good { background: #d1fae5; color: #065f46; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; display:inline-block; }
  .badge-warn { background: #fee2e2; color: #991b1b; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; display:inline-block; }
  .good-card { border-left: 4px solid #10b981 !important; }
  .warn-card { border-left: 4px solid #ef4444 !important; }
  #page-forecast2025 .kpi-grid { margin-bottom: 24px; }
`;
document.head.appendChild(style2025);


// ==================== PRODUCT LIST PAGE ====================
// Feature 3: Full product catalog with search, filter, pagination,
// detail modal, and India Map integration.
// All patterns (api(), fmt(), showToast(), etc.) match existing code above.

// ── Module-level state ───────────────────────────────────────────────────
const _pl = {
  page: 1,
  totalPages: 1,
  total: 0,
  debounceTimer: null,
  // Map overlay state
  mapOverlayProductId:   null,
  mapOverlayProductName: null,
  mapOverlayData:        null, // {[stateName]: revenue}
  // Enhanced product map state
  mapOverlayHighState:   null, // state with highest product revenue
  mapOverlayLowState:    null, // state with lowest product revenue (>0)
  mapOverlayTotalRev:    null, // total product revenue across all states
  mapOverlayStateData:   null, // full state_revenue array from API
};

// HTML-escape helper (avoids XSS in dynamically built table rows)
function _esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Entry point called by showAdminPage('productList') ───────────────────
async function loadProductListPage() {
  // plStateFilter is already populated by loadStatesFilter() on init
  await _plFetch();
}

// ── Core fetch + render ──────────────────────────────────────────────────
async function _plFetch() {
  const search   = (document.getElementById('plSearch')?.value   || '').trim();
  const state    =  document.getElementById('plStateFilter')?.value    || '';
  const category =  document.getElementById('plCategoryFilter')?.value || '';

  const params = new URLSearchParams({ page: _pl.page, per_page: 20 });
  if (search)   params.set('search', search);
  if (state)    params.set('state', state);
  if (category) params.set('category', category);

  // Show skeleton while loading
  const tbody = document.getElementById('plTableBody');
  if (tbody) tbody.innerHTML = `<tr><td colspan="9" class="empty-cell">
    <div class="loading-row"><div class="spinner-sm"></div>&nbsp;Loading products…</div>
  </td></tr>`;

  const r = await api(`/api/admin/products/list?${params}`);
  if (!r.success) {
    showToast('Failed to load product list', 'error');
    if (tbody) tbody.innerHTML = `<tr><td colspan="9" class="empty-cell">
      ⚠️ Failed to load. Check the server and retry.
    </td></tr>`;
    return;
  }

  // Populate category dropdown once (first successful load)
  const catEl = document.getElementById('plCategoryFilter');
  if (catEl && catEl.options.length <= 1 && r.categories?.length) {
    r.categories.forEach(cat => {
      const o = document.createElement('option');
      o.value = cat; o.textContent = cat;
      catEl.appendChild(o);
    });
  }

  // Update pagination
  _pl.totalPages = r.pagination.total_pages;
  _pl.total      = r.pagination.total;
  _pl.page       = r.pagination.page;

  const countLbl = document.getElementById('plCountLabel');
  if (countLbl) countLbl.textContent = `${fmtNum(r.pagination.total)} Products`;

  const pageLbl = document.getElementById('plPageLabel');
  if (pageLbl) pageLbl.textContent = `Page ${_pl.page} / ${_pl.totalPages}`;

  const prevBtn = document.getElementById('plPrevBtn');
  const nextBtn = document.getElementById('plNextBtn');
  if (prevBtn) prevBtn.disabled = _pl.page <= 1;
  if (nextBtn) nextBtn.disabled = _pl.page >= _pl.totalPages;

  if (!r.products.length) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="9" class="empty-cell">
      No products match your filters.
    </td></tr>`;
    return;
  }

  if (tbody) tbody.innerHTML = r.products.map(p => {
    const accBadge = p.forecast_accuracy != null
      ? `<span class="accuracy-badge ${p.forecast_accuracy >= 80 ? 'good' : p.forecast_accuracy >= 60 ? 'ok' : 'poor'}">${fmtPct(p.forecast_accuracy)}</span>`
      : '<span style="color:var(--text-muted)">—</span>';
    return `<tr class="pl-row" onclick="showProductDetail(${p.id})" style="cursor:pointer" title="Click for full details">
      <td><strong>${_esc(p.product_name)}</strong></td>
      <td>${_esc(p.company_name)}</td>
      <td>${_esc(p.state  || '—')}</td>
      <td>${_esc(p.district || '—')}</td>
      <td><span class="pl-cat-badge">${_esc(p.category || '—')}</span></td>
      <td>${fmtNum(p.price)}</td>
      <td>${fmtNum(p.stock)}</td>
      <td style="${p.total_revenue > 0 ? 'color:var(--success,#10b981);font-weight:600' : ''}">${fmt(p.total_revenue)}</td>
      <td>${accBadge}</td>
    </tr>`;
  }).join('');
}

// ── Filter handler (debounced) ───────────────────────────────────────────
function filterProductList() {
  _pl.page = 1; // reset to first page on any filter change
  clearTimeout(_pl.debounceTimer);
  _pl.debounceTimer = setTimeout(_plFetch, 300);
}

// ── Pagination ───────────────────────────────────────────────────────────
function plPrevPage() { if (_pl.page > 1)              { _pl.page--; _plFetch(); } }
function plNextPage() { if (_pl.page < _pl.totalPages) { _pl.page++; _plFetch(); } }

// ── Product Detail Modal ─────────────────────────────────────────────────
async function showProductDetail(productId) {
  const modal = document.getElementById('productDetailModal');
  const body  = document.getElementById('pdModalBody');
  if (!modal || !body) { showToast('Product detail modal not found', 'error'); return; }

  document.getElementById('pdModalTitle').textContent = 'Product Details';
  body.innerHTML = `<div class="loading-row" style="padding:48px;justify-content:center">
    <div class="spinner-sm"></div>&nbsp;Loading…
  </div>`;
  modal.style.display = 'flex';

  const r = await api(`/api/admin/products/${productId}/details`);
  if (!r.success) {
    body.innerHTML = `<p style="color:var(--danger);padding:20px">⚠️ Failed to load product details.</p>`;
    showToast('Failed to load product details', 'error');
    return;
  }

  const p    = r.product;
  const perf = r.performance;
  document.getElementById('pdModalTitle').textContent = `📦 ${p.product_name}`;

  const accCls   = perf.forecast_accuracy == null ? '' :
    perf.forecast_accuracy >= 80 ? 'good' : perf.forecast_accuracy >= 60 ? 'ok' : 'poor';
  const growthHtml = perf.growth_pct != null
    ? `<span class="${perf.growth_pct >= 0 ? 'growth-positive' : 'growth-negative'}">${perf.growth_pct >= 0 ? '▲' : '▼'} ${Math.abs(perf.growth_pct)}%</span>`
    : '—';

  const salesRows = r.last_sales.length
    ? r.last_sales.map(s => `<tr>
        <td>${s.sale_date}</td>
        <td>${fmtNum(s.quantity)}</td>
        <td>${fmt(s.unit_price)}</td>
        <td>${fmt(s.revenue)}</td>
        <td>${_esc(s.customer_name || 'Walk-in')}</td>
        <td>${_esc(s.district || '—')}</td>
      </tr>`).join('')
    : '<tr><td colspan="6" class="empty-cell">No sales recorded yet</td></tr>';

  body.innerHTML = `
    <!-- ① Basic Info -->
    <div class="pd-section">
      <h4 class="pd-section-title">📋 Product Information</h4>
      <div class="pd-info-grid">
        <div class="pd-info-item"><span class="pd-label">Product</span><span class="pd-val">${_esc(p.product_name)}</span></div>
        <div class="pd-info-item"><span class="pd-label">Category</span><span class="pd-val"><span class="pl-cat-badge">${_esc(p.category||'—')}</span></span></div>
        <div class="pd-info-item"><span class="pd-label">Price</span><span class="pd-val">${fmt(p.price)}</span></div>
        <div class="pd-info-item"><span class="pd-label">Stock</span><span class="pd-val">${fmtNum(p.stock)} units</span></div>
        ${p.brand ? `<div class="pd-info-item"><span class="pd-label">Brand</span><span class="pd-val">${_esc(p.brand)}</span></div>` : ''}
        ${p.sku   ? `<div class="pd-info-item"><span class="pd-label">SKU</span><span class="pd-val">${_esc(p.sku)}</span></div>` : ''}
        <div class="pd-info-item pd-full"><span class="pd-label">Description</span><span class="pd-val">${_esc(p.description||'—')}</span></div>
      </div>
      <h4 class="pd-section-title" style="margin-top:14px">🏢 Company</h4>
      <div class="pd-info-grid">
        <div class="pd-info-item"><span class="pd-label">Company</span><span class="pd-val">${_esc(p.company_name)}</span></div>
        <div class="pd-info-item"><span class="pd-label">Type</span><span class="pd-val">${_esc(p.comp_btype||'—')}</span></div>
        <div class="pd-info-item"><span class="pd-label">State</span><span class="pd-val">${_esc(p.comp_state||'—')}</span></div>
        <div class="pd-info-item"><span class="pd-label">District</span><span class="pd-val">${_esc(p.comp_city||'—')}</span></div>
      </div>
    </div>

    <!-- ② Performance -->
    <div class="pd-section">
      <h4 class="pd-section-title">📊 Performance Metrics</h4>
      <div class="kpi-mini-grid" style="grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px">
        <div class="kpi-mini-card"><div class="kpi-mini-value">${fmt(perf.total_rev)}</div><div class="kpi-mini-label">Total Revenue</div></div>
        <div class="kpi-mini-card"><div class="kpi-mini-value">${fmtNum(perf.units_sold)}</div><div class="kpi-mini-label">Units Sold</div></div>
        <div class="kpi-mini-card"><div class="kpi-mini-value">${fmtNum(perf.tx_count)}</div><div class="kpi-mini-label">Transactions</div></div>
        <div class="kpi-mini-card"><div class="kpi-mini-value">${fmt(perf.avg_monthly_rev)}</div><div class="kpi-mini-label">Avg Monthly Rev</div></div>
        <div class="kpi-mini-card"><div class="kpi-mini-value">${perf.best_month||'—'}</div><div class="kpi-mini-label">Best Month</div></div>
        <div class="kpi-mini-card"><div class="kpi-mini-value">${growthHtml}</div><div class="kpi-mini-label">MoM Growth</div></div>
        ${accCls ? `<div class="kpi-mini-card"><div class="kpi-mini-value"><span class="accuracy-badge ${accCls}">${fmtPct(perf.forecast_accuracy)}</span></div><div class="kpi-mini-label">Forecast Acc.</div></div>` : ''}
        ${perf.mape != null ? `<div class="kpi-mini-card"><div class="kpi-mini-value">${perf.mape}%</div><div class="kpi-mini-label">MAPE</div></div>` : ''}
      </div>
    </div>

    <!-- ③ Last 10 Sales -->
    <div class="pd-section">
      <h4 class="pd-section-title">🧾 Last 10 Sales Transactions</h4>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Date</th><th>Qty</th><th>Unit Price</th><th>Revenue</th><th>Customer</th><th>District</th></tr></thead>
          <tbody>${salesRows}</tbody>
        </table>
      </div>
    </div>

    <!-- ④ Map integration -->
    <div class="pd-section" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;border-bottom:none">
      <button class="btn-primary" onclick="viewProductOnMap(${productId}, '${_esc(p.product_name).replace(/'/g,"\\'")}')">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg>
        View on Map
      </button>
      <span style="font-size:.8rem;color:var(--text-muted)">Colours states by this product's revenue only</span>
    </div>
  `;
}

function closeProductDetailModal(e) {
  if (e.target === document.getElementById('productDetailModal')) closeProductDetailForce();
}
function closeProductDetailForce() {
  const m = document.getElementById('productDetailModal');
  if (m) m.style.display = 'none';
}

// ── Map integration ──────────────────────────────────────────────────────
async function viewProductOnMap(productId, productName) {
  closeProductDetailForce();
  showAdminPage('indiaMap');

  setTimeout(async () => {
    showToast(`Loading product map for "${productName}"…`, 'info');
    const r = await api(`/api/admin/products/${productId}/state-revenue`);
    if (!r || !r.success) {
      showToast('Failed to load product map data', 'error');
      return;
    }

    // Build revenue lookup and compute total/max/min
    const revMap = {};
    let maxRev = 0, minRev = Infinity;
    let highState = null, lowState = null;
    let totalProductRev = 0;

    r.state_revenue.forEach(s => {
      revMap[s.state] = s.revenue;
      totalProductRev += s.revenue;
      if (s.revenue > maxRev) { maxRev = s.revenue; highState = s.state; }
    });
    // Find lowest revenue state (must have >0 sales)
    r.state_revenue.forEach(s => {
      if (s.revenue > 0 && s.revenue < minRev) { minRev = s.revenue; lowState = s.state; }
    });

    _pl.mapOverlayProductId   = productId;
    _pl.mapOverlayProductName = productName;
    _pl.mapOverlayData        = revMap;
    _pl.mapOverlayHighState   = highState;
    _pl.mapOverlayLowState    = lowState;
    _pl.mapOverlayTotalRev    = totalProductRev;
    _pl.mapOverlayStateData   = r.state_revenue; // full list with qty_sold

    // Inject / update overlay banner
    let banner = document.getElementById('mapProductOverlayBanner');
    if (!banner) {
      const mapPage = document.getElementById('page-indiaMap');
      if (mapPage) {
        banner = document.createElement('div');
        banner.id = 'mapProductOverlayBanner';
        banner.style.cssText = 'background:var(--card-bg);border:1px solid var(--accent,#3b82f6);border-radius:8px;padding:10px 16px;margin-bottom:14px;display:flex;align-items:center;gap:14px;flex-wrap:wrap';
        banner.innerHTML = `
          <span style="font-size:.85rem;color:var(--accent,#3b82f6);font-weight:600">
            🗺️ Product Map: <em id="omapProdLabel"></em>
          </span>
          <button class="btn-secondary" onclick="resetMapOverlay()" style="font-size:.8rem;padding:4px 12px">
            Show Overall Revenue
          </button>`;
        mapPage.prepend(banner);
      }
    }
    if (banner) {
      banner.style.display = 'flex';
      const lbl = document.getElementById('omapProdLabel');
      if (lbl) lbl.textContent = productName;
    }

    // Update map sidebar with product overview
    _updateProductMapSidePanel(productName, totalProductRev, highState, lowState, revMap, r.state_revenue);

    _applyProductMapOverlay(revMap, maxRev, productName);
  }, 600);
}

// ── Product Map Side Panel — shows product KPIs when overlay is active ───
function _updateProductMapSidePanel(productName, totalRev, highState, lowState, revMap, stateData) {
  const detail = document.getElementById('mapStateDetail');
  if (!detail) return;

  // Compute total units sold
  const totalUnits = stateData ? stateData.reduce((s, r) => s + (r.qty_sold || 0), 0) : 0;

  detail.innerHTML = `
    <div style="border-bottom:1px solid var(--border);padding-bottom:10px;margin-bottom:10px">
      <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:4px">Selected Product</div>
      <div style="font-size:.92rem;font-weight:700;color:var(--text)">${productName}</div>
    </div>
    <div class="state-detail-stat"><span class="state-detail-label">Total Revenue</span><span class="state-detail-value" style="color:var(--accent)">${fmt(totalRev)}</span></div>
    <div class="state-detail-stat"><span class="state-detail-label">Total Units Sold</span><span class="state-detail-value">${fmtNum(totalUnits)}</span></div>
    <div class="state-detail-stat"><span class="state-detail-label">States with Sales</span><span class="state-detail-value">${stateData ? stateData.filter(s=>s.revenue>0).length : 0}</span></div>
    ${highState ? `<div class="state-detail-stat" style="margin-top:8px"><span class="state-detail-label">🟢 Highest Revenue</span><span class="state-detail-value" style="font-size:.76rem;color:var(--success);max-width:120px;text-align:right">${highState}</span></div>
    <div class="state-detail-stat"><span class="state-detail-label" style="padding-left:12px">Revenue</span><span class="state-detail-value">${fmt(revMap[highState])}</span></div>` : ''}
    ${lowState ? `<div class="state-detail-stat"><span class="state-detail-label">🔴 Lowest Revenue</span><span class="state-detail-value" style="font-size:.76rem;color:#f59e0b;max-width:120px;text-align:right">${lowState}</span></div>
    <div class="state-detail-stat"><span class="state-detail-label" style="padding-left:12px">Revenue</span><span class="state-detail-value">${fmt(revMap[lowState])}</span></div>` : ''}
    <div style="margin-top:12px;padding:8px;background:rgba(59,130,246,.06);border-radius:6px;font-size:.78rem;color:var(--text-muted)">
      💡 Click a state to see its revenue for this product
    </div>
    <button class="btn-secondary" onclick="resetMapOverlay()" style="width:100%;margin-top:10px;font-size:.8rem;justify-content:center">
      ↩ Show All Products
    </button>`;
}

function resetMapOverlay() {
  _pl.mapOverlayProductId   = null;
  _pl.mapOverlayProductName = null;
  _pl.mapOverlayData        = null;
  _pl.mapOverlayHighState   = null;
  _pl.mapOverlayLowState    = null;
  _pl.mapOverlayTotalRev    = null;
  _pl.mapOverlayStateData   = null;
  const banner = document.getElementById('mapProductOverlayBanner');
  if (banner) banner.style.display = 'none';
  // Restore original map colors
  loadIndiaMapD3();
  loadIndiaMapSVG();
  // Reset side panel
  const detail = document.getElementById('mapStateDetail');
  if (detail) detail.innerHTML = '<p class="placeholder-text"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="display:block;margin:0 auto 8px"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/></svg>Click a state on the map to view KPIs</p>';
  showToast('Showing overall revenue on map', 'info');
}

// ── Show state detail when product overlay is active ────────────────────
// Shows the selected state revenue for the active product, plus the overall
// product summary in the sidebar.
async function _showProductStateDetail(state) {
  const detail = document.getElementById('mapStateDetail');
  if (!detail) return;

  const productName = _pl.mapOverlayProductName;
  const revMap      = _pl.mapOverlayData || {};
  const stateRev    = revMap[state] || 0;
  const highState   = _pl.mapOverlayHighState;
  const lowState    = _pl.mapOverlayLowState;
  const totalRev    = _pl.mapOverlayTotalRev || 0;
  const stateData   = _pl.mapOverlayStateData || [];

  // Find units sold for this state from cached data
  const stateEntry = stateData.find(s => s.state === state);
  const unitsSold  = stateEntry ? stateEntry.qty_sold : 0;

  const totalUnits = stateData.reduce((s, r) => s + (r.qty_sold || 0), 0);

  detail.innerHTML = `
    <div style="border-bottom:1px solid var(--border);padding-bottom:10px;margin-bottom:10px">
      <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:4px">Product</div>
      <div style="font-size:.92rem;font-weight:700;color:var(--text)">${productName}</div>
    </div>

    <div style="background:rgba(59,130,246,.1);border:1px solid rgba(59,130,246,.25);border-radius:8px;padding:10px 12px;margin-bottom:10px">
      <div style="font-size:.75rem;color:var(--text-muted);margin-bottom:2px">📍 ${state}</div>
      <div style="font-size:1.1rem;font-weight:700;color:var(--accent)">${stateRev > 0 ? fmt(stateRev) : '—'}</div>
      ${unitsSold > 0 ? `<div style="font-size:.75rem;color:var(--text-muted);margin-top:2px">${fmtNum(unitsSold)} units sold</div>` : '<div style="font-size:.75rem;color:var(--text-muted)">No sales in this state</div>'}
    </div>

    <div class="state-detail-stat"><span class="state-detail-label">Total Revenue</span><span class="state-detail-value">${fmt(totalRev)}</span></div>
    <div class="state-detail-stat"><span class="state-detail-label">Total Units</span><span class="state-detail-value">${fmtNum(totalUnits)}</span></div>
    ${highState ? `<div class="state-detail-stat" style="margin-top:6px"><span class="state-detail-label">🟢 Highest</span><span class="state-detail-value" style="font-size:.75rem;color:var(--success);max-width:120px;text-align:right">${highState} ${fmt(revMap[highState])}</span></div>` : ''}
    ${lowState  ? `<div class="state-detail-stat"><span class="state-detail-label">🔴 Lowest</span><span class="state-detail-value" style="font-size:.75rem;color:#f59e0b;max-width:120px;text-align:right">${lowState} ${fmt(revMap[lowState])}</span></div>` : ''}
    <button class="btn-primary" style="width:100%;margin-top:12px;justify-content:center;font-size:.82rem" onclick="openStateDrillThrough('${state}')">🔍 Full State KPIs</button>
    <button class="btn-secondary" style="width:100%;margin-top:6px;font-size:.8rem;justify-content:center" onclick="resetMapOverlay()">↩ Show All Products</button>`;
}

function _applyProductMapOverlay(revMap, maxRev, productName) {
  // FIX: Color states based only on selected product revenue + product tooltip
  // Try the indiaSVG paths (created by loadIndiaMapSVG)
  const svgEl = document.getElementById('indiaSVG') ||
                document.querySelector('#indiaMapD3 svg') ||
                document.querySelector('#page-indiaMap svg');
  if (svgEl && maxRev > 0) {
    svgEl.querySelectorAll('path[data-state], [data-state]').forEach(path => {
      const sname = path.getAttribute('data-state');
      const rev   = revMap[sname] || 0;
      // Override fill with product-specific gradient color
      path.style.fill   = _productMapColor(rev / maxRev);
      path.style.opacity = rev > 0 ? '1' : '0.35';
      // Update tooltip via title attribute
      path.setAttribute('data-product-tooltip',
        `${sname}: ${rev > 0 ? fmt(rev) + ' from ' + productName : 'No sales for this product'}`);
    });
    showToast(`Map updated for "${productName}"`, 'success');
    return;
  }
  // Fallback: colour heatmap cells in the Heatmap section
  document.querySelectorAll('.heatmap-cell[data-state]').forEach(cell => {
    const sname = cell.getAttribute('data-state');
    const rev   = revMap[sname] || 0;
    cell.style.background = maxRev > 0 ? _productMapColor(rev / maxRev) : '';
    cell.title = `${sname}: ${rev > 0 ? fmt(rev) + ' from ' + productName : 'No sales'}`;
  });
  showToast(`Product heatmap applied for "${productName}"`, 'info');
}

// Blue gradient: 0 → dark bg, 1 → deep blue
function _productMapColor(intensity) {
  if (intensity <= 0) return 'var(--card-bg, #1e293b)';
  const r = Math.round(191 + (29  - 191) * intensity);
  const g = Math.round(219 + (78  - 219) * intensity);
  const b = Math.round(254 + (216 - 254) * intensity);
  return `rgb(${r},${g},${b})`;
}

// ── Inject CSS for new Product List components ───────────────────────────
(function _injectPlStyles() {
  const style = document.createElement('style');
  style.id = 'pl-styles';
  style.textContent = `
    /* Product List table rows */
    .pl-row:hover { background: rgba(59,130,246,.08) !important; }
    .pl-cat-badge {
      background: var(--accent, #3b82f6);
      color: #fff;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: .74rem;
      font-weight: 600;
      white-space: nowrap;
    }

    /* Product Detail modal sections */
    .pd-section {
      margin-bottom: 20px;
      padding-bottom: 18px;
      border-bottom: 1px solid var(--border, #334155);
    }
    .pd-section:last-child { border-bottom: none; }
    .pd-section-title {
      font-size: .88rem;
      font-weight: 700;
      color: var(--text);
      margin: 0 0 10px;
    }
    .pd-info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 8px;
    }
    .pd-info-item { display: flex; flex-direction: column; gap: 2px; }
    .pd-info-item.pd-full { grid-column: 1 / -1; }
    .pd-label {
      font-size: .72rem;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: .04em;
    }
    .pd-val { font-size: .88rem; color: var(--text); font-weight: 500; }

    /* State drill-through spotlight cards */
    .product-spotlight-card {
      flex: 1;
      min-width: 200px;
      background: var(--card-bg);
      border: 1px solid var(--border, #334155);
      border-top: 3px solid transparent;
      border-radius: 8px;
      padding: 14px 16px;
    }
    .ps-label {
      font-size: .72rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .06em;
      color: var(--text-muted);
      margin-bottom: 6px;
    }
    .ps-name {
      font-size: .95rem;
      font-weight: 700;
      color: var(--text);
      margin-bottom: 8px;
    }
  `;
  if (!document.getElementById('pl-styles')) {
    document.head.appendChild(style);
  }
})();
