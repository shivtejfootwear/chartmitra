/* ChartMitra indicators: standard formulas (Wilder RSI/ATR, etc.). Built-in KLineChart ones are listed with builtin:1. */
'use strict';
const TA = {
  sma(a, n) { const o = []; let s = 0, c = 0; for (let i = 0; i < a.length; i++) { const v = a[i]; if (v == null) { o.push(null); s = 0; c = 0; continue; } s += v; c++; if (c > n) { s -= a[i - n]; c = n; } o.push(c === n ? s / n : null); } return o; },
  ema(a, n) { const o = [], k = 2 / (n + 1); let e = null, s = 0, c = 0; for (let i = 0; i < a.length; i++) { const v = a[i]; if (v == null) { o.push(null); continue; } if (e == null) { s += v; c++; if (c === n) e = s / n; o.push(e); } else { e = v * k + e * (1 - k); o.push(e); } } return o; },
  rma(a, n) { const o = []; let r = null, s = 0, c = 0; for (let i = 0; i < a.length; i++) { const v = a[i]; if (v == null) { o.push(null); continue; } if (r == null) { s += v; c++; if (c === n) r = s / n; o.push(r); } else { r = (r * (n - 1) + v) / n; o.push(r); } } return o; },
  wma(a, n) { const o = [], d = n * (n + 1) / 2; for (let i = 0; i < a.length; i++) { if (i < n - 1) { o.push(null); continue; } let s = 0, ok = true; for (let j = 0; j < n; j++) { const v = a[i - j]; if (v == null) { ok = false; break; } s += v * (n - j); } o.push(ok ? s / d : null); } return o; },
  stdev(a, n) { const m = TA.sma(a, n); return a.map((v, i) => { if (m[i] == null) return null; let s = 0; for (let j = 0; j < n; j++) s += (a[i - j] - m[i]) ** 2; return Math.sqrt(s / n); }); },
  hh(a, n) { return a.map((v, i) => i < n - 1 ? null : Math.max(...a.slice(i - n + 1, i + 1))); },
  ll(a, n) { return a.map((v, i) => i < n - 1 ? null : Math.min(...a.slice(i - n + 1, i + 1))); },
  tr(d) { return d.map((k, i) => i === 0 ? k.high - k.low : Math.max(k.high - k.low, Math.abs(k.high - d[i - 1].close), Math.abs(k.low - d[i - 1].close))); },
  rsi(c, n) { const g = [null], l = [null]; for (let i = 1; i < c.length; i++) { const ch = c[i] - c[i - 1]; g.push(Math.max(ch, 0)); l.push(Math.max(-ch, 0)); } const ag = TA.rma(g, n), al = TA.rma(l, n); return c.map((v, i) => ag[i] == null || al[i] == null ? null : al[i] === 0 ? 100 : 100 - 100 / (1 + ag[i] / al[i])); },
  stoch(src, hi, lo, n) { const h = TA.hh(hi, n), l = TA.ll(lo, n); return src.map((v, i) => v == null || h[i] == null ? null : h[i] === l[i] ? 50 : (v - l[i]) / (h[i] - l[i]) * 100); }
};
const SRC = { close: k => k.close, open: k => k.open, high: k => k.high, low: k => k.low, hl2: k => (k.high + k.low) / 2, hlc3: k => (k.high + k.low + k.close) / 3, ohlc4: k => (k.open + k.high + k.low + k.close) / 4 };
const col = (c, w) => ({ style: 'solid', smooth: false, size: w || 1, dashedValue: [2, 2], color: c });

/* draw helper: dashed level lines + soft band like TradingView */
function levelsDraw(lv, band, color) {
  return ({ ctx, bounding, yAxis }) => {
    try {
      const W = bounding.width;
      if (band) { const y1 = yAxis.convertToPixel(band[1]), y2 = yAxis.convertToPixel(band[0]); ctx.fillStyle = color || 'rgba(126,87,194,0.08)'; ctx.fillRect(0, Math.min(y1, y2), W, Math.abs(y2 - y1)); }
      ctx.save(); ctx.setLineDash([4, 4]); ctx.strokeStyle = 'rgba(120,123,134,0.65)'; ctx.lineWidth = 1;
      lv.forEach(v => { const y = Math.round(yAxis.convertToPixel(v)) + 0.5; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); });
      ctx.restore();
    } catch (e) { }
    return false;
  };
}
function lineSeg(ctx, pts, color, w, dash) { if (pts.length < 2) return; ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = w || 1; if (dash) ctx.setLineDash(dash); ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke(); ctx.restore(); }

const CUSTOM = [
  { name: 'RSI', shortName: 'RSI', calcParams: [14], minValue: 0, maxValue: 100, precision: 2, figures: [{ key: 'rsi', title: 'RSI: ', type: 'line' }, { key: 'ma', title: 'MA: ', type: 'line' }],
    styles: { lines: [col('#7e57c2'), col('#f5c242')] }, draw: levelsDraw([30, 50, 70], [30, 70], 'rgba(126,87,194,0.08)'),
    calc(d, ind) { const r = TA.rsi(d.map(k => k.close), ind.calcParams[0]); const m = TA.sma(r, 14); return r.map((v, i) => ({ rsi: v ?? undefined, ma: m[i] ?? undefined })); } },
  { name: 'STOCHRSI', shortName: 'Stoch RSI', calcParams: [3, 3, 14, 14], minValue: 0, maxValue: 100, precision: 2, figures: [{ key: 'k', title: 'K: ', type: 'line' }, { key: 'd', title: 'D: ', type: 'line' }],
    styles: { lines: [col('#2962ff'), col('#ff6d00')] }, draw: levelsDraw([20, 50, 80], [20, 80], 'rgba(33,150,243,0.08)'),
    calc(d, ind) { const [ks, ds, rl, sl] = ind.calcParams; const r = TA.rsi(d.map(k => k.close), rl); const st = TA.stoch(r, r, r, sl); const K = TA.sma(st, ks), D = TA.sma(K, ds); return K.map((v, i) => ({ k: v ?? undefined, d: D[i] ?? undefined })); } },
  { name: 'STOCH', shortName: 'Stoch', calcParams: [14, 1, 3], minValue: 0, maxValue: 100, precision: 2, figures: [{ key: 'k', title: '%K: ', type: 'line' }, { key: 'd', title: '%D: ', type: 'line' }],
    styles: { lines: [col('#2962ff'), col('#ff6d00')] }, draw: levelsDraw([20, 50, 80], [20, 80], 'rgba(33,150,243,0.08)'),
    calc(d, ind) { const [n, sk, sd] = ind.calcParams; const raw = TA.stoch(d.map(k => k.close), d.map(k => k.high), d.map(k => k.low), n); const K = TA.sma(raw, sk), D = TA.sma(K, sd); return K.map((v, i) => ({ k: v ?? undefined, d: D[i] ?? undefined })); } },
  { name: 'ATR', shortName: 'ATR', calcParams: [14], precision: 4, figures: [{ key: 'atr', title: 'ATR: ', type: 'line' }], styles: { lines: [col('#f23645')] },
    calc(d, ind) { return TA.rma(TA.tr(d), ind.calcParams[0]).map(v => ({ atr: v ?? undefined })); } },
  { name: 'VWAP', shortName: 'VWAP', calcParams: [], series: 'price', precision: 2, figures: [{ key: 'vwap', title: 'VWAP: ', type: 'line' }], styles: { lines: [col('#2962ff', 1.4)] },
    calc(d) { let day = null, pv = 0, v = 0; return d.map(k => { const dd = Math.floor((k.timestamp + 19800000) / 864e5); if (dd !== day) { day = dd; pv = 0; v = 0; } const tp = (k.high + k.low + k.close) / 3; pv += tp * (k.volume || 0); v += k.volume || 0; return { vwap: v ? pv / v : tp }; }); } },
  { name: 'SUPERTREND', shortName: 'Supertrend', calcParams: [10, 3], series: 'price', precision: 2, figures: [{ key: 'st', title: 'ST: ', type: 'line' }],
    calc(d, ind) {
      const [n, m] = ind.calcParams, atr = TA.rma(TA.tr(d), n); let fu = 0, fl = 0, dir = 1, out = [];
      d.forEach((k, i) => {
        if (atr[i] == null) { out.push({}); return; }
        const hl = (k.high + k.low) / 2, bu = hl + m * atr[i], bl = hl - m * atr[i], pc = i ? d[i - 1].close : k.close;
        fu = i && out[i - 1].st !== undefined ? (bu < fu || pc > fu ? bu : fu) : bu;
        fl = i && out[i - 1].st !== undefined ? (bl > fl || pc < fl ? bl : fl) : bl;
        if (dir === 1 && k.close < fl) dir = -1; else if (dir === -1 && k.close > fu) dir = 1;
        out.push({ st: dir === 1 ? fl : fu, dir });
      });
      return out;
    },
    draw({ ctx, kLineDataList, indicator, visibleRange, xAxis, yAxis }) {
      try {
        const r = indicator.result; let seg = [], cur = null;
        for (let i = visibleRange.from; i < visibleRange.to; i++) {
          const v = r[i]; if (!v || v.st === undefined) continue;
          const p = [xAxis.convertToPixel(i), yAxis.convertToPixel(v.st)];
          if (cur !== null && v.dir !== cur) { lineSeg(ctx, seg, cur === 1 ? '#089981' : '#f23645', 1.4); seg = []; }
          cur = v.dir; seg.push(p);
        }
        lineSeg(ctx, seg, cur === 1 ? '#089981' : '#f23645', 1.4);
      } catch (e) { }
      return true;
    } },
  { name: 'WMA', shortName: 'WMA', calcParams: [20], series: 'price', precision: 2, figures: [{ key: 'v', title: 'WMA: ', type: 'line' }], styles: { lines: [col('#e91e63')] }, calc(d, ind) { return TA.wma(d.map(k => k.close), ind.calcParams[0]).map(v => ({ v: v ?? undefined })); } },
  { name: 'HMA', shortName: 'HMA', calcParams: [21], series: 'price', precision: 2, figures: [{ key: 'v', title: 'HMA: ', type: 'line' }], styles: { lines: [col('#00897b')] },
    calc(d, ind) { const n = ind.calcParams[0], c = d.map(k => k.close), a = TA.wma(c, Math.floor(n / 2)), b = TA.wma(c, n); const diff = a.map((v, i) => v == null || b[i] == null ? null : 2 * v - b[i]); return TA.wma(diff, Math.round(Math.sqrt(n))).map(v => ({ v: v ?? undefined })); } },
  { name: 'DEMA', shortName: 'DEMA', calcParams: [21], series: 'price', precision: 2, figures: [{ key: 'v', title: 'DEMA: ', type: 'line' }], styles: { lines: [col('#43a047')] },
    calc(d, ind) { const n = ind.calcParams[0], e1 = TA.ema(d.map(k => k.close), n), e2 = TA.ema(e1, n); return e1.map((v, i) => ({ v: v == null || e2[i] == null ? undefined : 2 * v - e2[i] })); } },
  { name: 'TEMA', shortName: 'TEMA', calcParams: [21], series: 'price', precision: 2, figures: [{ key: 'v', title: 'TEMA: ', type: 'line' }], styles: { lines: [col('#8e24aa')] },
    calc(d, ind) { const n = ind.calcParams[0], e1 = TA.ema(d.map(k => k.close), n), e2 = TA.ema(e1, n), e3 = TA.ema(e2, n); return e1.map((v, i) => ({ v: v == null || e3[i] == null ? undefined : 3 * v - 3 * e2[i] + e3[i] })); } },
  { name: 'VWMA', shortName: 'VWMA', calcParams: [20], series: 'price', precision: 2, figures: [{ key: 'v', title: 'VWMA: ', type: 'line' }], styles: { lines: [col('#5c6bc0')] },
    calc(d, ind) { const n = ind.calcParams[0], pv = TA.sma(d.map(k => k.close * (k.volume || 0)), n), v = TA.sma(d.map(k => k.volume || 0), n); return pv.map((x, i) => ({ v: x == null || !v[i] ? undefined : x / v[i] })); } },
  { name: 'EMAX', shortName: 'EMA', calcParams: [9, 21, 50, 200], series: 'price', precision: 2,
    figures: [{ key: 'e1', title: 'EMA9: ', type: 'line' }, { key: 'e2', title: 'EMA21: ', type: 'line' }, { key: 'e3', title: 'EMA50: ', type: 'line' }, { key: 'e4', title: 'EMA200: ', type: 'line' }],
    styles: { lines: [col('#f5c242'), col('#ff6d00'), col('#2962ff'), col('#e91e63')] },
    regenerateFigures: p => p.map((n, i) => ({ key: 'e' + (i + 1), title: 'EMA' + n + ': ', type: 'line' })),
    calc(d, ind) { const c = d.map(k => k.close), arr = ind.calcParams.map(n => TA.ema(c, n)); return c.map((x, i) => { const o = {}; arr.forEach((a, j) => o['e' + (j + 1)] = a[i] ?? undefined); return o; }); } },
  { name: 'SMAX', shortName: 'SMA', calcParams: [20, 50, 200], series: 'price', precision: 2,
    figures: [{ key: 's1', title: 'SMA20: ', type: 'line' }, { key: 's2', title: 'SMA50: ', type: 'line' }, { key: 's3', title: 'SMA200: ', type: 'line' }],
    styles: { lines: [col('#2962ff'), col('#ff6d00'), col('#e91e63'), col('#43a047')] },
    regenerateFigures: p => p.map((n, i) => ({ key: 's' + (i + 1), title: 'SMA' + n + ': ', type: 'line' })),
    calc(d, ind) { const c = d.map(k => k.close), arr = ind.calcParams.map(n => TA.sma(c, n)); return c.map((x, i) => { const o = {}; arr.forEach((a, j) => o['s' + (j + 1)] = a[i] ?? undefined); return o; }); } },
  { name: 'DONCHIAN', shortName: 'DC', calcParams: [20], series: 'price', precision: 2, figures: [{ key: 'u', title: 'Upper: ', type: 'line' }, { key: 'm', title: 'Basis: ', type: 'line' }, { key: 'l', title: 'Lower: ', type: 'line' }],
    styles: { lines: [col('#2962ff'), col('#ff6d00'), col('#2962ff')] },
    calc(d, ind) { const n = ind.calcParams[0], h = TA.hh(d.map(k => k.high), n), l = TA.ll(d.map(k => k.low), n); return h.map((v, i) => v == null ? {} : { u: v, l: l[i], m: (v + l[i]) / 2 }); } },
  { name: 'KELTNER', shortName: 'KC', calcParams: [20, 2], series: 'price', precision: 2, figures: [{ key: 'u', title: 'Upper: ', type: 'line' }, { key: 'm', title: 'Basis: ', type: 'line' }, { key: 'l', title: 'Lower: ', type: 'line' }],
    styles: { lines: [col('#2962ff'), col('#2962ff'), col('#2962ff')] },
    calc(d, ind) { const [n, m] = ind.calcParams, e = TA.ema(d.map(k => k.close), n), a = TA.ema(TA.tr(d), n); return e.map((v, i) => v == null || a[i] == null ? {} : { u: v + m * a[i], m: v, l: v - m * a[i] }); } },
  { name: 'ICHIMOKU', shortName: 'Ichimoku', calcParams: [9, 26, 52, 26], series: 'price', precision: 2,
    figures: [{ key: 'tk', title: 'Conv: ', type: 'line' }, { key: 'kj', title: 'Base: ', type: 'line' }, { key: 'sa', title: 'SpanA: ', type: 'line' }, { key: 'sb', title: 'SpanB: ', type: 'line' }, { key: 'ch', title: 'Lag: ', type: 'line' }],
    styles: { lines: [col('#2962ff'), col('#b71c1c'), col('#43a047'), col('#f23645'), col('#43a047')] },
    calc(d, ind) {
      const [a, b, c, s] = ind.calcParams, H = d.map(k => k.high), L = d.map(k => k.low);
      const mid = n => { const h = TA.hh(H, n), l = TA.ll(L, n); return h.map((v, i) => v == null ? null : (v + l[i]) / 2); };
      const tk = mid(a), kj = mid(b), sbR = mid(c);
      return d.map((k, i) => { const j = i - s + 1, o = { tk: tk[i] ?? undefined, kj: kj[i] ?? undefined };
        if (j >= 0 && tk[j] != null && kj[j] != null) o.sa = (tk[j] + kj[j]) / 2; if (j >= 0 && sbR[j] != null) o.sb = sbR[j];
        if (i + s - 1 < d.length) o.ch = d[i + s - 1].close; return o; });
    } },
  { name: 'MFI', shortName: 'MFI', calcParams: [14], minValue: 0, maxValue: 100, precision: 2, figures: [{ key: 'v', title: 'MFI: ', type: 'line' }], styles: { lines: [col('#7e57c2')] }, draw: levelsDraw([20, 80], [20, 80], 'rgba(126,87,194,0.08)'),
    calc(d, ind) { const n = ind.calcParams[0], tp = d.map(k => (k.high + k.low + k.close) / 3); return d.map((k, i) => { if (i < n) return {}; let p = 0, m = 0; for (let j = i - n + 1; j <= i; j++) { const f = tp[j] * (d[j].volume || 0); if (tp[j] > tp[j - 1]) p += f; else if (tp[j] < tp[j - 1]) m += f; } return { v: m === 0 ? 100 : 100 - 100 / (1 + p / m) }; }); } },
  { name: 'CMF', shortName: 'CMF', calcParams: [20], precision: 3, figures: [{ key: 'v', title: 'CMF: ', type: 'line' }], styles: { lines: [col('#43a047')] }, draw: levelsDraw([0]),
    calc(d, ind) { const n = ind.calcParams[0], mfv = d.map(k => k.high === k.low ? 0 : ((k.close - k.low) - (k.high - k.close)) / (k.high - k.low) * (k.volume || 0)); const a = TA.sma(mfv, n), v = TA.sma(d.map(k => k.volume || 0), n); return a.map((x, i) => ({ v: x == null || !v[i] ? undefined : x / v[i] })); } },
  { name: 'STDDEV', shortName: 'StdDev', calcParams: [20], precision: 4, figures: [{ key: 'v', title: 'StdDev: ', type: 'line' }], styles: { lines: [col('#2962ff')] }, calc(d, ind) { return TA.stdev(d.map(k => k.close), ind.calcParams[0]).map(v => ({ v: v ?? undefined })); } },
  { name: 'HV', shortName: 'HV', calcParams: [20], precision: 2, figures: [{ key: 'v', title: 'HV%: ', type: 'line' }], styles: { lines: [col('#2962ff')] },
    calc(d, ind) { const r = d.map((k, i) => i ? Math.log(k.close / d[i - 1].close) : null); const sd = TA.stdev(r.map(x => x ?? 0), ind.calcParams[0]); return sd.map((v, i) => ({ v: v == null || i < 1 ? undefined : v * Math.sqrt(252) * 100 })); } },
  { name: 'AROON', shortName: 'Aroon', calcParams: [14], minValue: 0, maxValue: 100, precision: 2, figures: [{ key: 'u', title: 'Up: ', type: 'line' }, { key: 'l', title: 'Down: ', type: 'line' }], styles: { lines: [col('#ff6d00'), col('#2962ff')] },
    calc(d, ind) { const n = ind.calcParams[0]; return d.map((k, i) => { if (i < n) return {}; let hi = i, lo = i; for (let j = i - n; j <= i; j++) { if (d[j].high >= d[hi].high) hi = j; if (d[j].low <= d[lo].low) lo = j; } return { u: 100 * (n - (i - hi)) / n, l: 100 * (n - (i - lo)) / n }; }); } },
  { name: 'CHOP', shortName: 'CHOP', calcParams: [14], minValue: 0, maxValue: 100, precision: 2, figures: [{ key: 'v', title: 'CHOP: ', type: 'line' }], styles: { lines: [col('#2962ff')] }, draw: levelsDraw([38.2, 61.8], [38.2, 61.8], 'rgba(33,150,243,0.08)'),
    calc(d, ind) { const n = ind.calcParams[0], tr = TA.tr(d), H = TA.hh(d.map(k => k.high), n), L = TA.ll(d.map(k => k.low), n); return d.map((k, i) => { if (i < n) return {}; let s = 0; for (let j = i - n + 1; j <= i; j++) s += tr[j]; const r = H[i] - L[i]; return { v: r > 0 ? 100 * Math.log10(s / r) / Math.log10(n) : undefined }; }); } },
  { name: 'UO', shortName: 'UO', calcParams: [7, 14, 28], minValue: 0, maxValue: 100, precision: 2, figures: [{ key: 'v', title: 'UO: ', type: 'line' }], styles: { lines: [col('#f23645')] }, draw: levelsDraw([30, 70]),
    calc(d, ind) { const [a, b, c] = ind.calcParams; const bp = d.map((k, i) => k.close - Math.min(k.low, i ? d[i - 1].close : k.low)), tr = TA.tr(d); const av = n => { const x = TA.sma(bp, n), y = TA.sma(tr, n); return x.map((v, i) => v == null || !y[i] ? null : v / y[i]); }; const A = av(a), B = av(b), C = av(c); return d.map((k, i) => ({ v: C[i] == null ? undefined : 100 * (4 * A[i] + 2 * B[i] + C[i]) / 7 })); } },
  { name: 'FISHER', shortName: 'Fisher', calcParams: [9], precision: 3, figures: [{ key: 'f', title: 'Fisher: ', type: 'line' }, { key: 't', title: 'Trigger: ', type: 'line' }], styles: { lines: [col('#2962ff'), col('#ff6d00')] }, draw: levelsDraw([-1.5, 0, 1.5]),
    calc(d, ind) { const n = ind.calcParams[0], hl = d.map(k => (k.high + k.low) / 2), H = TA.hh(hl, n), L = TA.ll(hl, n); let v = 0, f = 0; const out = []; d.forEach((k, i) => { if (H[i] == null) { out.push({}); return; } const r = H[i] - L[i] || 1e-9; v = 0.66 * ((hl[i] - L[i]) / r - 0.5) + 0.67 * v; v = Math.max(-0.999, Math.min(0.999, v)); const pf = f; f = 0.5 * Math.log((1 + v) / (1 - v)) + 0.5 * f; out.push({ f, t: pf }); }); return out; } }
];

/* list for the Indicators sheet (only working ones) */
const IND_LIST = [
  { id: 'VOL', name: 'Volume', cat: 'Volume', builtin: 1 },
  { id: 'SMAX', name: 'Moving Average (SMA)', cat: 'Trend', main: 1 }, { id: 'EMAX', name: 'Exponential Moving Average (EMA)', cat: 'Trend', main: 1 },
  { id: 'WMA', name: 'Weighted Moving Average', cat: 'Trend', main: 1 }, { id: 'HMA', name: 'Hull Moving Average', cat: 'Trend', main: 1 }, { id: 'DEMA', name: 'Double EMA', cat: 'Trend', main: 1 },
  { id: 'TEMA', name: 'Triple EMA', cat: 'Trend', main: 1 }, { id: 'VWMA', name: 'Volume Weighted MA', cat: 'Trend', main: 1 }, { id: 'VWAP', name: 'VWAP', cat: 'Trend', main: 1 },
  { id: 'SUPERTREND', name: 'Supertrend', cat: 'Trend', main: 1 }, { id: 'ICHIMOKU', name: 'Ichimoku Cloud', cat: 'Trend', main: 1 }, { id: 'SAR', name: 'Parabolic SAR', cat: 'Trend', main: 1, builtin: 1 },
  { id: 'MACD', name: 'MACD', cat: 'Trend', builtin: 1 }, { id: 'DMI', name: 'ADX / DMI', cat: 'Trend', builtin: 1 }, { id: 'AROON', name: 'Aroon', cat: 'Trend' },
  { id: 'RSI', name: 'Relative Strength Index (RSI)', cat: 'Momentum' }, { id: 'STOCHRSI', name: 'Stochastic RSI', cat: 'Momentum' }, { id: 'STOCH', name: 'Stochastic', cat: 'Momentum' },
  { id: 'CCI', name: 'Commodity Channel Index', cat: 'Momentum', builtin: 1 }, { id: 'ROC', name: 'Rate of Change', cat: 'Momentum', builtin: 1 }, { id: 'MTM', name: 'Momentum', cat: 'Momentum', builtin: 1 },
  { id: 'WR', name: 'Williams %R', cat: 'Momentum', builtin: 1 }, { id: 'AO', name: 'Awesome Oscillator', cat: 'Momentum', builtin: 1 }, { id: 'TRIX', name: 'TRIX', cat: 'Momentum', builtin: 1 },
  { id: 'UO', name: 'Ultimate Oscillator', cat: 'Momentum' }, { id: 'FISHER', name: 'Fisher Transform', cat: 'Momentum' }, { id: 'KDJ', name: 'KDJ', cat: 'Momentum', builtin: 1 },
  { id: 'BOLL', name: 'Bollinger Bands', cat: 'Volatility', main: 1, builtin: 1 }, { id: 'KELTNER', name: 'Keltner Channels', cat: 'Volatility', main: 1 }, { id: 'DONCHIAN', name: 'Donchian Channels', cat: 'Volatility', main: 1 },
  { id: 'ATR', name: 'Average True Range', cat: 'Volatility' }, { id: 'STDDEV', name: 'Standard Deviation', cat: 'Volatility' }, { id: 'HV', name: 'Historical Volatility', cat: 'Volatility' }, { id: 'CHOP', name: 'Choppiness Index', cat: 'Volatility' },
  { id: 'OBV', name: 'On Balance Volume', cat: 'Volume', builtin: 1 }, { id: 'MFI', name: 'Money Flow Index', cat: 'Volume' }, { id: 'CMF', name: 'Chaikin Money Flow', cat: 'Volume' }, { id: 'PVT', name: 'Price Volume Trend', cat: 'Volume', builtin: 1 }
];
function registerIndicators() { CUSTOM.forEach(t => { try { klinecharts.registerIndicator(t); } catch (e) { console.log('ind', t.name, e); } }); }
