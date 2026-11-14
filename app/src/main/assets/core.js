/* ChartMitra core: helpers, icons, network, storage + cloud sync, market data. Works in the APK (WebView) and on the website. */
'use strict';
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const NATIVE = !!window.Android;
const IST = 'Asia/Kolkata';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function decimals(v) { v = Math.abs(v); return v >= 1000 ? 2 : v >= 10 ? 2 : v >= 1 ? 4 : v >= 0.01 ? 5 : 8; }
function fmt(v, d) {
  if (v == null || isNaN(v)) return '—';
  d = d == null ? decimals(v) : d;
  return Number(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}
function fmtVol(v) { if (!v) return '0'; const a = Math.abs(v); return a >= 1e9 ? (v / 1e9).toFixed(2) + 'B' : a >= 1e6 ? (v / 1e6).toFixed(2) + 'M' : a >= 1e3 ? (v / 1e3).toFixed(1) + 'K' : v.toFixed(0); }
function fmtTime(ts, withDate) {
  const o = { timeZone: settings().tz || IST, hour: '2-digit', minute: '2-digit', hour12: false };
  if (withDate) { o.day = '2-digit'; o.month = 'short'; }
  return new Date(ts).toLocaleString('en-GB', o);
}
function toast(t, ms) { const e = $('#toast'); e.textContent = t; e.classList.remove('hide'); clearTimeout(toast._t); toast._t = setTimeout(() => e.classList.add('hide'), ms || 2200); }

/* ---------- icons (original line icons, 24px grid) ---------- */
const IC = {
  down: 'M6 9l6 6 6-6', up: 'M6 15l6-6 6 6', plus: 'M12 5v14M5 12h14', x: 'M6 6l12 12M18 6L6 18', back: 'M15 6l-6 6 6 6', search: 'M11 4a7 7 0 1 0 0 14a7 7 0 1 0 0-14M16 16l5 5',
  pencil: 'M4 20h4L19 9l-4-4L4 16v4M13.5 6.5l4 4M3 22c3 0 4-1 6-1', ind: 'M3 17l5-6 4 3 6-8 3 3M3 21h18', dots: 'M5 12h.01M12 12h.01M19 12h.01',
  undo: 'M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3', redo: 'M15 14l5-5-5-5M20 9H10a6 6 0 0 0 0 12h3',
  list: 'M6 3h12v18H6zM9 8h6M9 12h6M9 16h4', chart: 'M4 4h16v16H4zM7 15l3-4 3 2 4-5', compass: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M15.5 8.5l-2 5-5 2 2-5z',
  news: 'M4 5h13v14H6a2 2 0 0 1-2-2zM17 9h3v8a2 2 0 0 1-2 2M7 9h7M7 13h7M7 16h4', menu: 'M4 7h16M4 12h16M4 17h16', refresh: 'M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0', alarm: 'M12 7v5l3 2M12 4a8 8 0 1 0 0 16a8 8 0 1 0 0-16M4 4L2 6M20 4l2 2',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6', lock: 'M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3', unlock: 'M6 11h12v9H6zM8 11V8a4 4 0 0 1 7.5-2',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6', eyeoff: 'M3 3l18 18M10.6 6.1A10 10 0 0 1 12 6c6 0 10 6 10 6a17 17 0 0 1-3 3.6M6.5 7.5C3.8 9.2 2 12 2 12s4 7 10 7c1.7 0 3.2-.5 4.5-1.2M9.9 9.9a3 3 0 0 0 4.2 4.2',
  magnet: 'M6 4v8a6 6 0 0 0 12 0V4h-4v8a2 2 0 0 1-4 0V4zM6 8h4M14 8h4', ruler: 'M3 17L17 3l4 4L7 21zM7 13l2 2M10 10l2 2M13 7l2 2', eraser: 'M8 20h12M5 15l8-9 6 6-7 8H8z',
  keep: 'M4 20h4L18 10l-4-4L4 16zM15 17h6v5h-6zM16.5 17v-1.5a1.5 1.5 0 0 1 3 0V17', zoomin: 'M11 4a7 7 0 1 0 0 14a7 7 0 1 0 0-14M16 16l5 5M8 11h6M11 8v6', zoomout: 'M11 4a7 7 0 1 0 0 14a7 7 0 1 0 0-14M16 16l5 5M8 11h6',
  square: 'M5 5h14v14H5z', layouts: 'M4 4h16v16H4zM12 4v16M4 12h8', gear: 'M12 2l8 5v10l-8 5-8-5V7zM12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6',
  newchart: 'M4 4h13v13H4zM7 13l3-3 2 2 3-4M18 16v6M15 19h6', save: 'M7 18a5 5 0 0 1-.5-10A6 6 0 0 1 18 9a4.5 4.5 0 0 1-.5 9M12 12v8M9 15l3-3 3 3', folder: 'M3 6h6l2 2h10v11H3z',
  broker: 'M3 15l5-5 4 4 8-8M3 19l5-5 4 4 8-8', indicators: 'M4 20V14h3v6M10 20v-8h3v8M16 20V10h3v10M4 11l6-5 4 3 6-5', compare: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M12 8v8M8 12h8',
  replay: 'M12 6L5 12l7 6zM20 6l-7 6 7 6z', templates: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z', candle: 'M8 3v4M8 17v4M6 7h4v10H6zM16 5v3M16 15v4M14 8h4v7h-4z',
  layers: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5', info: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M12 11v6M12 7.5v.5', fin: 'M4 20V12h4v8M10 20V8h4v12M16 20V4h4v16',
  forecast: 'M3 17l5-5 4 3 6-7M14 8h4v4M18 3v2M18 19v2', gauge: 'M5 18a8 8 0 1 1 14 0M12 14l4-5M12 14a1 1 0 1 0 0 .1',
  play: 'M7 4l13 8-13 8z', pause: 'M7 4h3v16H7zM14 4h3v16h-3z', next: 'M6 5l9 7-9 7zM17 5v14', prev: 'M18 5l-9 7 9 7zM7 5v14', stop: 'M6 6h12v12H6z',
  sun: 'M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  cloud: 'M7 18a5 5 0 0 1-.5-10A6 6 0 0 1 18 9a4.5 4.5 0 0 1-.5 9z', user: 'M12 4a4 4 0 1 0 0 8a4 4 0 1 0 0-8M4 21a8 8 0 0 1 16 0', share: 'M12 3v13M7 8l5-5 5 5M5 14v6h14v-6',
  battery: 'M3 8h15v8H3zM21 11v2M6 11v2', wallet: 'M4 7h15v12H4zM4 7l11-3v3M16 13h.01', calc: 'M6 3h12v18H6zM9 7h6M9 11h.01M12 11h.01M15 11h.01M9 15h.01M12 15h.01M15 15h.01',
  journal: 'M6 3h12v18H6zM9 7h6M9 11h6M9 15h3', star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z', type: 'M5 6V4h14v2M12 4v16M9 20h6',
  /* drawing tools */
  t_trend: 'M5 19L19 5|c5,19|c19,5', t_ray: 'M5 19L21 3|c5,19|c12,12', t_ext: 'M2 22L22 2|c8,16|c16,8', t_info: 'M5 18L19 6|c5,18|c19,6|M11 8h6',
  t_angle: 'M5 19L19 7M5 19h14M13 19a8 8 0 0 0-1.5-5|c5,19', t_hl: 'M2 12h20|c12,12', t_hr: 'M7 12h15|c5,12', t_vl: 'M12 2v20|c12,12', t_cross: 'M2 12h20M12 2v20|c12,12',
  t_pc: 'M3 15L15 3M9 21L21 9|c5,13|c13,5|c15,15', t_regr: 'M3 16L21 8M3 12L21 4M3 20L21 12', t_fork: 'M4 20l7-7M11 13l9-4M11 13l7 7M11 13L20 14|c4,20|c11,13',
  t_fib: 'M5 5h15M5 10h15M5 15h15M5 20h15|c20,10|c4,20', t_fibx: 'M4 9L17 4M4 14h17M4 18h17M4 22h17|c4,9|c17,4', t_fibtz: 'M3 3v18M6 3v18M10 3v18M16 3v18M22 3v18',
  t_fibfan: 'M4 20L20 4M4 20L20 10M4 20L20 15M4 20h16', t_fibch: 'M3 16L16 3M6 21L21 6M9 23L23 9', t_gannbox: 'M4 4h16v16H4zM4 4l16 16M20 4L4 20M12 4v16M4 12h16', t_gannfan: 'M4 20L20 4M4 20L20 12M4 20L12 4M4 20h16M4 20V4',
  t_rect: 'M4 6h16v12H4z|c4,6|c20,18', t_circle: 'M12 4a8 8 0 1 0 0 16a8 8 0 1 0 0-16|c12,12', t_tri: 'M4 19L12 4l8 15z', t_arrow: 'M5 19L19 5M11 5h8v8', t_text: 'M5 6V4h14v2M12 4v16M9 20h6',
  t_note: 'M5 4h14v12l-4 4H5zM15 20v-4h4', t_plabel: 'M3 8h12l5 4-5 4H3z', t_long: 'M9 5h12M9 19h12|c6,5|c6,19|M13 9v6h3', t_short: 'M9 5h12M9 19h12|c6,5|c6,19|M16 9h-3v2.5h3V15h-3',
  t_prange: 'M12 3v18M8 7l4-4 4 4M8 17l4 4 4-4M4 3h16M4 21h16', t_drange: 'M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4M3 4v16M21 4v16', t_dprange: 'M5 5h14v14H5zM12 8v8M8 12h8',
  t_brush: 'M4 20c3 0 5-2 5-5l9-9-2-2-9 9c-3 0-3 4-3 7', t_hilite: 'M4 20h8M9 15l9-9-3-3-9 9-1 4z', t_poly: 'M3 17l5-9 6 6 7-10|c3,17|c8,8|c14,14|c21,4', t_vp: 'M4 4h11v3H4zM4 9h16v3H4zM4 14h13v3H4zM4 19h7v2H4z'
};
function icon(n, cls) {
  const d = IC[n] || IC.square;
  let paths = '', circles = '';
  d.split('|').forEach(p => {
    if (p[0] === 'c') { const [x, y] = p.slice(1).split(',').map(Number); circles += `<circle cx="${x}" cy="${y}" r="2.2" fill="var(--sheet,#fff)"/>`; }
    else paths += `<path d="${p}"/>`;
  });
  return `<svg class="ic ${cls || ''}" viewBox="0 0 24 24" aria-hidden="true">${paths}${circles}</svg>`;
}
function paintIcons(root) { $$('[data-i]', root).forEach(e => { e.outerHTML = icon(e.dataset.i); }); }

/* ---------- network: native in the APK, cloud proxy on the website ---------- */
const pend = {}; let reqN = 0;
window.__res = (id, ok, body) => { const p = pend[id]; if (!p) return; delete pend[id]; clearTimeout(p.t); ok ? p.res(body) : p.rej(new Error(body || 'Network error')); };
function nativeCall(fn, ...args) {
  return new Promise((res, rej) => {
    const id = 'r' + (++reqN);
    pend[id] = { res, rej, t: setTimeout(() => { delete pend[id]; rej(new Error('Timeout')); }, 25000) };
    Android[fn](id, ...args);
  });
}
const CORS_OK = ['api.binance.com', 'data-api.binance.vision', 'fapi.binance.com'];
async function http(url) {
  if (NATIVE) return nativeCall('fetch', url);
  const host = new URL(url).hostname;
  if (CORS_OK.includes(host)) { const r = await fetch(url); if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); }
  const a = Auth.info();
  if (!a.ready) throw new Error('LOGIN_NEEDED');
  const tok = await Auth.token();
  const r = await fetch(a.url + '/functions/v1/cm-proxy?u=' + encodeURIComponent(url), { headers: { apikey: a.key, Authorization: 'Bearer ' + tok } });
  if (!r.ok) throw new Error('Proxy ' + r.status);
  return r.text();
}
const getJSON = u => http(u).then(t => JSON.parse(t));

/* ---------- login (your own free Supabase project) ---------- */
const Auth = {
  info() {
    if (NATIVE) { try { return JSON.parse(Android.syncInfo()); } catch (e) { return {}; } }
    const a = lsGet('cm:auth') || {};
    return { url: a.url || '', key: a.key || '', email: a.email || '', ready: !!(a.url && a.key && a.refresh) };
  },
  async login(url, key, email, pass) {
    url = url.trim().replace(/\/+$/, '');
    if (NATIVE) return nativeCall('syncLogin', url, key.trim(), email.trim(), pass);
    const r = await fetch(url + '/auth/v1/token?grant_type=password', { method: 'POST', headers: { apikey: key.trim(), 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.trim(), password: pass }) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error_description || j.msg || 'Login failed');
    lsSet('cm:auth', { url, key: key.trim(), email: j.user && j.user.email, access: j.access_token, refresh: j.refresh_token, exp: Date.now() / 1000 + (j.expires_in || 3600) });
  },
  logout() { if (NATIVE) Android.syncLogout(); else localStorage.removeItem('cm:auth'); },
  _p: null,
  async token() {
    if (NATIVE) return Android.syncToken();
    const a = lsGet('cm:auth');
    if (!a || !a.refresh) return '';
    if (a.exp - Date.now() / 1000 > 120) return a.access;
    if (this._p) return this._p;
    this._p = (async () => {
      const r = await fetch(a.url + '/auth/v1/token?grant_type=refresh_token', { method: 'POST', headers: { apikey: a.key, 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: a.refresh }) });
      const j = await r.json();
      if (!r.ok) { if (r.status === 400 || r.status === 401) localStorage.removeItem('cm:auth'); throw new Error('Session expired, log in again'); }
      Object.assign(a, { access: j.access_token, refresh: j.refresh_token, exp: Date.now() / 1000 + (j.expires_in || 3600) });
      lsSet('cm:auth', a);
      return a.access;
    })().finally(() => { this._p = null; });
    return this._p;
  }
};

/* ---------- storage: every value saved on the device and in your cloud ---------- */
function lsGet(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
const Store = {
  get(k, def) { const o = lsGet('cm:' + k); return o && o.v !== undefined ? o.v : def; },
  ts(k) { const o = lsGet('cm:' + k); return o ? o.ts || 0 : 0; },
  set(k, v, silent) {
    lsSet('cm:' + k, { v, ts: Date.now() });
    if (!silent) this.queue(k);
  },
  _q: {}, _t: null,
  queue(k) { this._q[k] = 1; clearTimeout(this._t); this._t = setTimeout(() => this.flush(), 1500); },
  async flush() {
    const keys = Object.keys(this._q); this._q = {};
    if (!keys.length || !Auth.info().ready) return;
    try {
      const a = Auth.info(), tok = await Auth.token();
      if (!tok) return;
      const rows = keys.map(k => ({ k, v: this.get(k, null), updated_at: new Date(this.ts(k) || Date.now()).toISOString() }));
      const r = await fetch(a.url + '/rest/v1/cm_state?on_conflict=user_id,k', { method: 'POST', headers: { apikey: a.key, Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(rows) });
      if (!r.ok) throw new Error(await r.text());
      Sync.last = Date.now(); Sync.err = '';
    } catch (e) { keys.forEach(k => this._q[k] = 1); Sync.err = e.message; }
  }
};
const Sync = {
  last: 0, err: '',
  async pull() {
    if (!Auth.info().ready) return false;
    try {
      const a = Auth.info(), tok = await Auth.token();
      if (!tok) return false;
      const r = await fetch(a.url + '/rest/v1/cm_state?select=k,v,updated_at', { headers: { apikey: a.key, Authorization: 'Bearer ' + tok } });
      if (!r.ok) throw new Error(await r.text());
      const rows = await r.json(); let changed = [];
      rows.forEach(row => {
        const rts = Date.parse(row.updated_at) || 0;
        if (row.k === 'alerts') { Alerts.mergeRemote(row.v, rts); return; }
        if (rts > Store.ts(row.k)) { lsSet('cm:' + row.k, { v: row.v, ts: rts }); changed.push(row.k); }
      });
      // push what the cloud doesn't have yet
      const have = new Set(rows.map(r => r.k));
      Object.keys(localStorage).filter(k => k.startsWith('cm:') && k !== 'cm:auth').forEach(k => {
        const kk = k.slice(3), row = rows.find(r => r.k === kk);
        if (kk === 'alerts') return;
        if (!have.has(kk) || (row && Store.ts(kk) > (Date.parse(row.updated_at) || 0))) Store.queue(kk);
      });
      if (!NATIVE && !have.has('alerts') && Alerts.list().length) Alerts.pushWeb();
      this.last = Date.now(); this.err = '';
      return changed;
    } catch (e) { this.err = e.message; return false; }
  }
};

/* ---------- settings ---------- */
const DEF_SET = { theme: 'light', tz: IST, chartType: 'candle_solid', log: false, pct: false, grid: true, countdown: true, events: true, favbar: false, magnet: false, keepDraw: false, upColor: '#089981', downColor: '#f23645' };
function settings() { return Object.assign({}, DEF_SET, Store.get('set', {})); }
function setSetting(k, v) { const s = Store.get('set', {}); s[k] = v; Store.set('set', s); }

/* ---------- symbols ---------- */
// Gold and silver: Binance XAUUSDT / XAGUSDT contracts track spot metal price, live 24/7, free, no key
const XAU_SYM = { s: 'XAUUSDT', n: 'XAUUSD', d: 'Gold Spot / U.S. Dollar', x: 'Binance', src: 'bf', cat: 'gold', cur: 'USD' };
const XAG_SYM = { s: 'XAGUSDT', n: 'XAGUSD', d: 'Silver Spot / U.S. Dollar', x: 'Binance', src: 'bf', cat: 'silver', cur: 'USD' };
const isBin = s => !!s && (s.src === 'bn' || s.src === 'bf');
const SYM_ICON = { in: ['#ff6d00', 'IN'], gold: ['#e8b84a', 'Au'], silver: ['#9598a1', 'Ag'], crypto: ['#f7931a', '₿'], us: ['#2962ff', 'US'], fx: ['#26a69a', 'FX'], other: ['#787b86', '•'] };
const DEFAULT_WL = [
  { name: 'Indices', items: [
    { s: '^NSEI', n: 'NIFTY', d: 'Nifty 50 Index', x: 'NSE', src: 'yf', cat: 'in', cur: 'INR' },
    { s: '^NSEBANK', n: 'BANKNIFTY', d: 'Nifty Bank Index', x: 'NSE', src: 'yf', cat: 'in', cur: 'INR' },
    { s: 'NIFTY_FIN_SERVICE.NS', n: 'FINNIFTY', d: 'Nifty Financial Services', x: 'NSE', src: 'yf', cat: 'in', cur: 'INR' },
    { s: '^BSESN', n: 'SENSEX', d: 'S&P BSE Sensex', x: 'BSE', src: 'yf', cat: 'in', cur: 'INR' },
    { s: '^GSPC', n: 'SPX', d: 'S&P 500 Index', x: 'US', src: 'yf', cat: 'us', cur: 'USD' },
    { s: '^IXIC', n: 'NASDAQ', d: 'Nasdaq Composite', x: 'US', src: 'yf', cat: 'us', cur: 'USD' }] },
  { name: 'Gold and commodities', items: [
    XAU_SYM, XAG_SYM,
    { s: 'GC=F', n: 'GOLD FUT', d: 'Gold Futures (COMEX)', x: 'COMEX', src: 'yf', cat: 'gold', cur: 'USD' },
    { s: 'SI=F', n: 'SILVER FUT', d: 'Silver Futures (COMEX)', x: 'COMEX', src: 'yf', cat: 'silver', cur: 'USD' },
    { s: 'GOLDBEES.NS', n: 'GOLDBEES', d: 'Nippon India Gold ETF', x: 'NSE', src: 'yf', cat: 'gold', cur: 'INR' },
    { s: 'CL=F', n: 'CRUDE FUT', d: 'Crude Oil Futures (NYMEX)', x: 'NYMEX', src: 'yf', cat: 'other', cur: 'USD' }] },
  { name: 'Stocks', items: [
    { s: 'RELIANCE.NS', n: 'RELIANCE', d: 'Reliance Industries', x: 'NSE', src: 'yf', cat: 'in', cur: 'INR' },
    { s: 'HDFCBANK.NS', n: 'HDFCBANK', d: 'HDFC Bank', x: 'NSE', src: 'yf', cat: 'in', cur: 'INR' },
    { s: 'TCS.NS', n: 'TCS', d: 'Tata Consultancy Services', x: 'NSE', src: 'yf', cat: 'in', cur: 'INR' },
    { s: 'SBIN.NS', n: 'SBIN', d: 'State Bank of India', x: 'NSE', src: 'yf', cat: 'in', cur: 'INR' }] },
  { name: 'Crypto', items: [
    { s: 'BTCUSDT', n: 'BTCUSDT', d: 'Bitcoin / TetherUS', x: 'Binance', src: 'bn', cat: 'crypto', cur: 'USDT' },
    { s: 'ETHUSDT', n: 'ETHUSDT', d: 'Ethereum / TetherUS', x: 'Binance', src: 'bn', cat: 'crypto', cur: 'USDT' },
    { s: 'SOLUSDT', n: 'SOLUSDT', d: 'Solana / TetherUS', x: 'Binance', src: 'bn', cat: 'crypto', cur: 'USDT' },
    { s: 'BNBUSDT', n: 'BNBUSDT', d: 'BNB / TetherUS', x: 'Binance', src: 'bn', cat: 'crypto', cur: 'USDT' },
    { s: 'XRPUSDT', n: 'XRPUSDT', d: 'XRP / TetherUS', x: 'Binance', src: 'bn', cat: 'crypto', cur: 'USDT' },
    { s: 'PAXGUSDT', n: 'PAXGUSDT', d: 'PAX Gold token / TetherUS', x: 'Binance', src: 'bn', cat: 'crypto', cur: 'USDT' }] }
];
const symKey = o => o.src + ':' + o.s;
function watchlists() { return Store.get('wls', null) || [{ id: 'main', name: 'Watchlist', groups: DEFAULT_WL }]; }
function allSymbols() { const m = new Map(); watchlists().forEach(w => w.groups.forEach(g => g.items.forEach(i => m.set(symKey(i), i)))); return [...m.values()]; }
function symIcon(o) { const c = SYM_ICON[o.cat] || SYM_ICON.other; return `<span class="sicon" style="background:${c[0]}">${c[1]}</span>`; }

async function searchSymbols(q) {
  q = q.trim(); if (q.length < 1) return [];
  const out = [], Q = q.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const bnTry = Q.endsWith('USDT') || Q.endsWith('USDC') || Q.endsWith('BTC') ? [Q] : [Q + 'USDT'];
  if (/^(XAU|XAUUSD|GOLD|XAUUSDT)$/.test(Q)) out.push(XAU_SYM);
  if (/^(XAG|XAGUSD|SILVER|XAGUSDT)$/.test(Q)) out.push(XAG_SYM);
  await Promise.all([
    (async () => {
      try {
        const j = await getJSON(`https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=15&newsCount=0&enableFuzzyQuery=false`);
        (j.quotes || []).forEach(x => {
          if (!x.symbol || x.quoteType === 'OPTION') return;
          const s = x.symbol, ex = x.exchDisp || x.exchange || '';
          const isIn = /\.(NS|BO)$/.test(s) || /^\^(NSE|BSE|CNX)/.test(s) || /NSE|BSE|Bombay/i.test(ex);
          const cat = isIn ? 'in' : /^(GC|MGC)=F/.test(s) ? 'gold' : /^SI=F/.test(s) ? 'silver' : x.quoteType === 'CRYPTOCURRENCY' ? 'crypto' : x.quoteType === 'CURRENCY' ? 'fx' : /NYQ|NMS|NGM|NAS|NYSE|Nasdaq/i.test(ex) ? 'us' : 'other';
          out.push({ s, n: s.replace(/\.(NS|BO)$/, '').replace(/^\^/, ''), d: x.shortname || x.longname || s, x: ex, src: 'yf', cat, cur: isIn ? 'INR' : '' });
        });
      } catch (e) { if (e.message === 'LOGIN_NEEDED') out.push({ needLogin: true }); }
    })(),
    ...bnTry.map(async s => { try { await getJSON(bnBase[0] + '/api/v3/ticker/price?symbol=' + s); out.unshift({ s, n: s, d: s.replace(/(USDT|USDC|BTC)$/, '') + ' / ' + (s.match(/(USDT|USDC|BTC)$/) || ['', 'USDT'])[1] + ' (live)', x: 'Binance', src: 'bn', cat: 'crypto', cur: 'USDT' }); } catch (e) { } })
  ]);
  return out;
}

/* ---------- intervals ---------- */
// base: interval asked from the source; agg: candles merged into one
const TFS = [
  { k: '1s', ms: 1e3, bn: ['1s', 1], cryptoOnly: 1 }, { k: '5s', ms: 5e3, bn: ['1s', 5], cryptoOnly: 1 }, { k: '15s', ms: 15e3, bn: ['1s', 15], cryptoOnly: 1 }, { k: '30s', ms: 3e4, bn: ['1s', 30], cryptoOnly: 1 },
  { k: '1m', ms: 6e4, bn: ['1m', 1], yf: ['1m', 1, '5d'] }, { k: '3m', ms: 18e4, bn: ['3m', 1], yf: ['1m', 3, '5d'] }, { k: '5m', ms: 3e5, bn: ['5m', 1], yf: ['5m', 1, '1mo'] },
  { k: '10m', ms: 6e5, bn: ['5m', 2], yf: ['5m', 2, '1mo'] }, { k: '15m', ms: 9e5, bn: ['15m', 1], yf: ['15m', 1, '1mo'] }, { k: '30m', ms: 18e5, bn: ['30m', 1], yf: ['30m', 1, '1mo'] },
  { k: '45m', ms: 27e5, bn: ['15m', 3], yf: ['15m', 3, '1mo'] }, { k: '1h', ms: 36e5, bn: ['1h', 1], yf: ['60m', 1, '6mo'] }, { k: '2h', ms: 72e5, bn: ['2h', 1], yf: ['60m', 2, '1y'] },
  { k: '4h', ms: 144e5, bn: ['4h', 1], yf: ['60m', 4, '1y'] }, { k: '1D', ms: 864e5, bn: ['1d', 1], yf: ['1d', 1, '5y'] }, { k: '1W', ms: 6048e5, bn: ['1w', 1], yf: ['1wk', 1, '10y'] },
  { k: '1M', ms: 2592e6, bn: ['1M', 1], yf: ['1mo', 1, 'max'] }
];
const tfObj = k => TFS.find(t => t.k === k) || TFS[8];
const BASE_MS = { '1s': 1e3, '1m': 6e4, '3m': 18e4, '5m': 3e5, '15m': 9e5, '30m': 18e5, '1h': 36e5, '2h': 72e5, '4h': 144e5, '60m': 36e5, '1d': 864e5, '1w': 6048e5, '1wk': 6048e5, '1M': 2592e6, '1mo': 2592e6 };
// bn = Binance spot (crypto), bf = Binance USDT futures (gold XAUUSDT, silver XAGUSDT)
const BIN = {
  bn: { rest: ['https://api.binance.com', 'https://data-api.binance.vision'], k: '/api/v3/klines', t24: '/api/v3/ticker/24hr', ws: ['wss://stream.binance.com:9443', 'wss://data-stream.binance.vision'] },
  bf: { rest: ['https://fapi.binance.com'], k: '/fapi/v1/klines', t24: '/fapi/v1/ticker/24hr', ws: ['wss://fstream.binance.com'] }
};
const bnBase = BIN.bn.rest;
const wsIdx = { bn: 0, bf: 0 };
// live socket hosts: main one first, public market-data mirror if it is blocked in a region
function bnSocket(path, m) {
  m = m || 'bn'; const hosts = BIN[m].ws;
  const ws = new WebSocket(hosts[wsIdx[m] % hosts.length] + path); let opened = false;
  ws.addEventListener('open', () => { opened = true; });
  ws.addEventListener('close', () => { if (!opened) wsIdx[m] = (wsIdx[m] + 1) % hosts.length; });
  return ws;
}

function sessionOffset(sym) { return sym.cat === 'in' ? (3 * 60 + 45) * 6e4 : 0; } // NSE opens 09:15 IST = 03:45 UTC
function bucketOf(ts, ms, off) { return Math.floor((ts - off) / ms) * ms + off; }
function aggregate(list, n, ms, off) {
  if (n <= 1) return list;
  const out = [];
  list.forEach(c => {
    const b = bucketOf(c.timestamp, ms, off), last = out[out.length - 1];
    if (last && last.timestamp === b) { last.high = Math.max(last.high, c.high); last.low = Math.min(last.low, c.low); last.close = c.close; last.volume += c.volume; }
    else out.push({ timestamp: b, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume });
  });
  return out;
}
async function bnGet(path, m) {
  let err;
  for (const b of BIN[m || 'bn'].rest) { try { return await getJSON(b + path); } catch (e) { err = e; } }
  throw err;
}
const bnRow = k => ({ timestamp: k[0], open: +k[1], high: +k[2], low: +k[3], close: +k[4], volume: +k[5] });
async function bnKlines(sym, iv, limit, endTime, m) {
  m = m || 'bn';
  return (await bnGet(`${BIN[m].k}?symbol=${sym}&interval=${iv}&limit=${Math.min(limit || 1000, m === 'bf' ? 1500 : 1000)}${endTime ? '&endTime=' + endTime : ''}`, m)).map(bnRow);
}
async function yfChart(sym, interval, range, extra) {
  const u = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=${interval}${range ? '&range=' + range : ''}&includePrePost=false${extra || ''}`;
  let j;
  try { j = await getJSON(u); } catch (e) { if (e.message === 'LOGIN_NEEDED') throw e; j = await getJSON(u.replace('query1', 'query2')); }
  const r = j.chart && j.chart.result && j.chart.result[0];
  if (!r) throw new Error((j.chart && j.chart.error && j.chart.error.description) || 'No data');
  const q = (r.indicators.quote || [])[0] || {}, ts = r.timestamp || [], list = [];
  for (let i = 0; i < ts.length; i++) {
    if (q.close[i] == null || q.open[i] == null) continue;
    list.push({ timestamp: ts[i] * 1000, open: q.open[i], high: q.high[i], low: q.low[i], close: q.close[i], volume: q.volume[i] || 0 });
  }
  // Yahoo's last daily bar can repeat today's bar; keep one per timestamp
  const dedup = []; list.forEach(c => { const l = dedup[dedup.length - 1]; if (l && l.timestamp === c.timestamp) dedup[dedup.length - 1] = c; else dedup.push(c); });
  return { list: dedup, meta: r.meta || {} };
}

/** History for a symbol + interval. */
async function loadHistory(sym, tfk, endTime) {
  const t = tfObj(tfk);
  if (isBin(sym)) {
    const [iv, n] = t.bn, m = sym.src;
    if (m === 'bf' && iv === '1s') throw new Error('Seconds charts are only for crypto');
    let list = await bnKlines(sym.s, iv, 1000, endTime, m);
    if (n > 1 && iv === '1s') { // more 1s pages for second charts
      for (let p = 0; p < Math.min(3, n) && list.length; p++) { const more = await bnKlines(sym.s, iv, 1000, list[0].timestamp - 1, m); list = more.concat(list); }
    }
    return { list: aggregate(list, n, t.ms, 0), meta: {}, base: list.slice(-n * 2) };
  }
  if (!t.yf) throw new Error('This interval works for crypto only');
  const [iv, n, range] = t.yf;
  const r = await yfChart(sym.s, iv, range);
  return { list: aggregate(r.list, n, t.ms, sessionOffset(sym)), meta: r.meta, base: r.list.slice(-n * 2) };
}

/* ---------- quotes (watchlist prices) ---------- */
const Quotes = { data: {}, ws: {}, wsSyms: {} };
function quote(sym) { return Quotes.data[symKey(sym)]; }
function marketState(sym, m) {
  if (isBin(sym)) return 'open';
  const q = m || {}, now = Date.now() / 1000, p = q.currentTradingPeriod && q.currentTradingPeriod.regular;
  if (!p) return 'closed';
  if (now < p.start || now > p.end) return 'closed';
  if (q.regularMarketTime && now - q.regularMarketTime > 300) return 'delay';
  return 'open';
}
async function refreshQuotes(list) {
  const bn = list.filter(s => s.src === 'bn'), bf = list.filter(s => s.src === 'bf'), yf = list.filter(s => s.src === 'yf');
  await Promise.all(bf.map(async s => {
    try { const t = await bnGet(BIN.bf.t24 + '?symbol=' + s.s, 'bf'); Quotes.data['bf:' + s.s] = { p: +t.lastPrice, pc: +t.lastPrice - +t.priceChange, ch: +t.priceChange, chp: +t.priceChangePercent, h: +t.highPrice, l: +t.lowPrice, v: +t.volume, st: 'open', t: Date.now() }; } catch (e) { }
  }));
  if (bf.length) liveTickers(bf, 'bf');
  if (bn.length) {
    try {
      const j = await bnGet('/api/v3/ticker/24hr?symbols=' + encodeURIComponent(JSON.stringify(bn.map(s => s.s))));
      j.forEach(t => { Quotes.data['bn:' + t.symbol] = { p: +t.lastPrice, pc: +t.prevClosePrice || (+t.lastPrice - +t.priceChange), ch: +t.priceChange, chp: +t.priceChangePercent, h: +t.highPrice, l: +t.lowPrice, v: +t.volume, st: 'open', t: Date.now() }; });
    } catch (e) { }
    liveTickers(bn, 'bn');
  }
  for (let i = 0; i < yf.length; i += 4) {
    await Promise.all(yf.slice(i, i + 4).map(async s => {
      try {
        const r = await yfChart(s.s, '1d', '1d');
        const m = r.meta, p = m.regularMarketPrice, pc = m.chartPreviousClose || m.previousClose;
        Quotes.data[symKey(s)] = { p, pc, ch: p - pc, chp: (p - pc) / pc * 100, h: m.regularMarketDayHigh, l: m.regularMarketDayLow, v: m.regularMarketVolume, st: marketState(s, m), t: (m.regularMarketTime || 0) * 1000, meta: m };
      } catch (e) { if (e.message === 'LOGIN_NEEDED') Quotes.needLogin = true; }
    }));
  }
  document.dispatchEvent(new Event('quotes'));
}
function liveTickers(list, m) {
  m = m || 'bn'; Quotes.ws = Quotes.ws || {}; Quotes.wsSyms = Quotes.wsSyms || {};
  const key = list.map(s => s.s).sort().join(','), cur = Quotes.ws[m];
  if (cur && Quotes.wsSyms[m] === key && cur.readyState <= 1) return;
  try { cur && cur.close(); } catch (e) { }
  Quotes.wsSyms[m] = key;
  const ws = bnSocket('/stream?streams=' + list.map(s => s.s.toLowerCase() + '@miniTicker').join('/'), m);
  ws.onmessage = ev => {
    const t = JSON.parse(ev.data).data; if (!t) return;
    const k = m + ':' + t.s, q = Quotes.data[k] || {}; const p = +t.c, o = +t.o;
    Object.assign(q, { p, h: +t.h, l: +t.l, v: +t.v, st: 'open', t: t.E });
    if (!q.pc) q.pc = o; q.ch = p - q.pc; q.chp = q.ch / q.pc * 100;
    Quotes.data[k] = q;
    clearTimeout(Quotes._ev); Quotes._ev = setTimeout(() => document.dispatchEvent(new Event('quotes')), 250);
  };
  ws.onclose = () => { setTimeout(() => { if (Quotes.ws[m] === ws) { Quotes.wsSyms[m] = ''; liveTickers(list, m); } }, 4000); };
  Quotes.ws[m] = ws;
}

/* ---------- alerts (the phone app rings them even when closed) ---------- */
const Alerts = {
  list() {
    if (NATIVE) { try { return JSON.parse(Android.getAlarms()); } catch (e) { return []; } }
    return Store.get('alerts', []);
  },
  save(list) {
    if (NATIVE) Android.saveAlarms(JSON.stringify(list)); // phone saves + sends to cloud
    else { Store.set('alerts', list, true); this.pushWeb(); }
    document.dispatchEvent(new Event('alerts'));
  },
  pushWeb() { Store.queue('alerts'); },
  mergeRemote(v, rts) {
    if (NATIVE) return; // the phone pulls alerts natively (Android.pullAlerts)
    if (rts > Store.ts('alerts')) { lsSet('cm:alerts', { v: v || [], ts: rts }); document.dispatchEvent(new Event('alerts')); }
  },
  async refresh() {
    if (NATIVE && Auth.info().ready) { try { await nativeCall('pullAlerts'); } catch (e) { } }
    document.dispatchEvent(new Event('alerts'));
  },
  add(a) { const l = this.list(); l.push(a); this.save(l); },
  update(id, patch) { const l = this.list(); const a = l.find(x => x.id === id); if (a) Object.assign(a, patch); this.save(l); },
  remove(id) { this.save(this.list().filter(x => x.id !== id)); }
};

/* ---------- news + economic calendar (free sources) ---------- */
const FEEDS = [
  { u: 'https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms', src: 'Economic Times', cat: 'india' },
  { u: 'https://www.moneycontrol.com/rss/marketreports.xml', src: 'Moneycontrol', cat: 'india' },
  { u: 'https://economictimes.indiatimes.com/markets/commodities/rssfeeds/1808152121.cms', src: 'ET Commodities', cat: 'gold' },
  { u: 'https://www.cnbc.com/id/100003114/device/rss/rss.html', src: 'CNBC', cat: 'global' },
  { u: 'https://www.cnbc.com/id/20910258/device/rss/rss.html', src: 'CNBC Economy', cat: 'global' },
  { u: 'https://www.coindesk.com/arc/outboundfeeds/rss/', src: 'CoinDesk', cat: 'crypto' },
  { u: 'https://cointelegraph.com/rss', src: 'Cointelegraph', cat: 'crypto' }
];
async function loadNews() {
  const items = [];
  await Promise.all(FEEDS.map(async f => {
    try {
      const xml = new DOMParser().parseFromString(await http(f.u), 'text/xml');
      $$('item', xml).slice(0, 25).forEach(it => {
        const g = t => { const e = it.getElementsByTagName(t)[0]; return e ? e.textContent.trim() : ''; };
        const title = g('title'), link = g('link'), d = Date.parse(g('pubDate')) || 0;
        if (title && link) items.push({ title, link, t: d, src: f.src, cat: f.cat || (/gold|silver|commodit/i.test(title) ? 'gold' : 'global') });
      });
    } catch (e) { if (e.message === 'LOGIN_NEEDED') items.needLogin = true; }
  }));
  items.forEach(i => { if (i.cat !== 'gold' && /\bgold\b|silver|bullion/i.test(i.title)) i.also = 'gold'; });
  items.sort((a, b) => b.t - a.t);
  return items;
}
const CAL = { list: null, t: 0 };
async function loadCalendar(force) {
  if (CAL.list && !force && Date.now() - CAL.t < 30 * 6e4) return CAL.list;
  const j = await getJSON('https://nfs.faireconomy.media/ff_calendar_thisweek.json');
  CAL.list = j.map(e => ({ title: e.title, c: e.country, t: Date.parse(e.date), imp: e.impact, f: e.forecast, p: e.previous, a: e.actual }));
  CAL.t = Date.now();
  return CAL.list;
}
