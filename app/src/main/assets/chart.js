/* ChartMitra chart engine on KLineChart v9: data, live feed, drawings, alerts lines, replay, analysis. */
'use strict';
const C = {
  chart: null, sym: null, tf: '15m', list: [], meta: {}, seq: 0, ws: null, poll: null, live: false,
  ind: {},            // indicator name -> paneId
  dr: {},             // drawing id -> record
  undo: [], tool: null, eraser: false, sel: null, replay: null, cmp: null
};
const UP = () => settings().upColor, DN = () => settings().downColor;

const FONT = 'Roboto, -apple-system, "Segoe UI", Arial, sans-serif';
function themeStyles() {
  const dark = settings().theme === 'dark', g = dark ? '#1e222d' : '#f3f4f7', tx = dark ? '#b2b5be' : '#131722', ln = dark ? '#2a2e39' : '#e0e3eb';
  const s = settings();
  return {
    grid: { show: s.grid, horizontal: { color: g, size: 1, style: 'solid' }, vertical: { color: g, size: 1, style: 'solid' } },
    candle: {
      type: s.chartType === 'heikin' ? 'candle_solid' : s.chartType === 'line' ? 'area' : s.chartType,
      bar: { upColor: UP(), downColor: DN(), noChangeColor: '#787b86', upBorderColor: UP(), downBorderColor: DN(), noChangeBorderColor: '#787b86', upWickColor: UP(), downWickColor: DN(), noChangeWickColor: '#787b86' },
      area: { lineSize: 1.5, lineColor: '#2962ff', value: 'close', backgroundColor: s.chartType === 'line' ? [{ offset: 0, color: 'rgba(41,98,255,0)' }, { offset: 1, color: 'rgba(41,98,255,0)' }] : [{ offset: 0, color: 'rgba(41,98,255,0.01)' }, { offset: 1, color: 'rgba(41,98,255,0.18)' }] },
      priceMark: { high: { color: tx, textSize: 10, textFamily: FONT }, low: { color: tx, textSize: 10, textFamily: FONT }, last: { upColor: UP(), downColor: DN(), noChangeColor: '#787b86', line: { show: true, style: 'dashed', dashedValue: [1, 3], size: 1 }, text: { size: 11, family: FONT, paddingLeft: 5, paddingRight: 5, paddingTop: 3, paddingBottom: 3, borderRadius: 2 } } },
      tooltip: { showRule: 'always', showType: 'standard', offsetTop: 50, offsetLeft: 8, text: { size: 11, color: tx, family: FONT, marginLeft: 0, marginRight: 8 },
        custom: d => { const k = d.current; if (!k) return []; const c = k.close >= k.open ? UP() : DN(), dd = decimals(k.close);
          return [['O', k.open], ['H', k.high], ['L', k.low], ['C', k.close]].map(([t, v]) => ({ title: t + ' ', value: { text: fmt(v, dd), color: c } })).concat([{ title: 'Vol ', value: { text: fmtVol(k.volume || 0), color: tx } }]); } }
    },
    indicator: { lastValueMark: { show: false }, tooltip: { showRule: 'always', showType: 'standard', offsetTop: 12, text: { size: 11, color: tx, family: FONT },
      icons: [['cm_vis', '◉'], ['cm_set', '⚙'], ['cm_del', '✕']].map(([id, icon]) => ({ id, icon, position: 'middle', fontFamily: 'sans-serif', size: 14, color: dark ? '#b2b5be' : '#787b86', activeColor: '#2962ff', backgroundColor: 'transparent', activeBackgroundColor: 'rgba(41,98,255,0.12)', marginLeft: 6, marginTop: 0, marginRight: 0, marginBottom: 0, paddingLeft: 4, paddingTop: 2, paddingRight: 4, paddingBottom: 2 })) } },
    xAxis: { axisLine: { color: ln }, tickLine: { show: false }, tickText: { color: tx, size: 11, family: FONT } },
    yAxis: { type: s.log ? 'log' : s.pct ? 'percentage' : 'normal', axisLine: { color: ln }, tickLine: { show: false }, tickText: { color: tx, size: 11, family: FONT } },
    separator: { color: ln, size: 1 },
    crosshair: { horizontal: { line: { color: '#9598a1', style: 'dashed', dashedValue: [4, 3], size: 1 }, text: { backgroundColor: '#131722', borderColor: '#131722', size: 11, family: FONT } }, vertical: { line: { color: '#9598a1', style: 'dashed', dashedValue: [4, 3], size: 1 }, text: { backgroundColor: '#131722', borderColor: '#131722', size: 11, family: FONT } } },
    overlay: {
      point: { color: '#2962ff', borderColor: 'rgba(41,98,255,0.3)', borderSize: 1, radius: 4, activeColor: '#2962ff', activeBorderColor: 'rgba(41,98,255,0.3)', activeBorderSize: 3, activeRadius: 4 },
      line: { color: '#2962ff', size: 1 }, polygon: { color: 'rgba(41,98,255,0.12)', borderColor: '#2962ff', borderSize: 1 }, rect: { color: 'rgba(41,98,255,0.12)', borderColor: '#2962ff', borderSize: 1 },
      text: { color: '#2962ff', size: 12, family: FONT }, rectText: { color: '#fff', backgroundColor: '#2962ff', size: 11, family: FONT, borderRadius: 3 }
    }
  };
}

/* ---------- custom drawing tools ---------- */
const FIB_LV = [[0, '#787b86'], [0.236, '#f23645'], [0.382, '#ff9800'], [0.5, '#4caf50'], [0.618, '#089981'], [0.786, '#00bcd4'], [1, '#787b86'], [1.618, '#2962ff'], [2.618, '#f23645']];
const st = (o, k, d) => (o.styles && o.styles[k]) || d;
const lineStyle = o => Object.assign({ style: 'solid', size: 1, color: '#2962ff', dashedValue: [4, 4] }, st(o, 'line', {}));
const txt = (x, y, text, color, align, baseline, bg) => ({ type: 'text', ignoreEvent: true, attrs: { x, y, text, align: align || 'left', baseline: baseline || 'bottom' }, styles: { color: bg ? '#fff' : color, size: 11, family: FONT, backgroundColor: bg || 'transparent', borderRadius: 3, paddingLeft: bg ? 5 : 0, paddingRight: bg ? 5 : 0, paddingTop: bg ? 3 : 0, paddingBottom: bg ? 3 : 0, borderSize: 0 } });
const pct = (a, b) => ((b - a) / a * 100);
function ptTs(p) { return p.timestamp != null ? p.timestamp : idxToTs(p.dataIndex); }
function registerTools() {
  const R = o => { try { klinecharts.registerOverlay(Object.assign({ needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true }, o)); } catch (e) { console.log(o.name, e); } };
  R({ name: 'cmFib', totalStep: 3, createPointFigures({ overlay, coordinates, bounding, precision }) {
    if (coordinates.length < 2) return [];
    const [a, b] = coordinates, p0 = overlay.points[0].value, p1 = overlay.points[1].value, x1 = Math.min(a.x, b.x), x2 = overlay.extendData && overlay.extendData.ext ? bounding.width : Math.max(a.x, b.x);
    const out = [{ type: 'line', attrs: { coordinates: [a, b] }, styles: { style: 'dashed', color: '#9598a1', size: 1, dashedValue: [3, 3] } }];
    FIB_LV.slice(0, 7).forEach(([r, c], i, arr) => {
      const y = b.y + (a.y - b.y) * r, v = p1 + (p0 - p1) * r;
      if (i < arr.length - 1) { const yn = b.y + (a.y - b.y) * arr[i + 1][0]; out.push({ type: 'polygon', ignoreEvent: true, attrs: { coordinates: [{ x: x1, y }, { x: x2, y }, { x: x2, y: yn }, { x: x1, y: yn }] }, styles: { style: 'fill', color: c + '14' } }); }
      out.push({ type: 'line', attrs: { coordinates: [{ x: x1, y }, { x: x2, y }] }, styles: { color: c, size: 1 } });
      out.push(txt(x1 + 2, y - 1, `${r} (${fmt(v, precision.price)})`, c));
    });
    return out;
  } });
  R({ name: 'cmFibExt', totalStep: 4, createPointFigures({ overlay, coordinates, bounding, precision }) {
    const f = [];
    if (coordinates.length >= 2) f.push({ type: 'line', attrs: { coordinates: coordinates.slice(0, 3) }, styles: { style: 'dashed', color: '#9598a1', dashedValue: [3, 3] } });
    if (coordinates.length < 3) return f;
    const [a, b, c] = coordinates, pts = overlay.points, d = pts[1].value - pts[0].value, dy = b.y - a.y;
    [[0, '#787b86'], [0.618, '#ff9800'], [1, '#089981'], [1.618, '#2962ff'], [2.618, '#f23645']].forEach(([r, col]) => {
      const y = c.y + dy * r; f.push({ type: 'line', attrs: { coordinates: [{ x: c.x, y }, { x: bounding.width, y }] }, styles: { color: col } });
      f.push(txt(c.x + 2, y - 1, `${r} (${fmt(pts[2].value + d * r, precision.price)})`, col));
    });
    return f;
  } });
  R({ name: 'cmFibTZ', totalStep: 3, createPointFigures({ coordinates, bounding }) {
    if (coordinates.length < 2) return [];
    const [a, b] = coordinates, w = b.x - a.x; const f = [];
    [0, 1, 2, 3, 5, 8, 13, 21, 34, 55].forEach((n, i) => { const x = a.x + w * n; f.push({ type: 'line', attrs: { coordinates: [{ x, y: 0 }, { x, y: bounding.height }] }, styles: { color: i % 2 ? '#2962ff' : '#9598a1' } }); f.push(txt(x + 2, bounding.height - 4, String(n), '#787b86')); });
    return f;
  } });
  R({ name: 'cmFibFan', totalStep: 3, createPointFigures({ coordinates, bounding }) {
    if (coordinates.length < 2) return [];
    const [a, b] = coordinates, f = [];
    [[0.236, '#f23645'], [0.382, '#ff9800'], [0.5, '#4caf50'], [0.618, '#089981'], [0.786, '#00bcd4'], [1, '#787b86']].forEach(([r, col]) => {
      const ty = b.y + (a.y - b.y) * r, k = (ty - a.y) / ((b.x - a.x) || 1), X = b.x > a.x ? bounding.width : 0;
      f.push({ type: 'line', attrs: { coordinates: [a, { x: X, y: a.y + k * (X - a.x) }] }, styles: { color: col } }); f.push(txt(b.x + 3, ty - 1, String(r), col));
    });
    return f;
  } });
  R({ name: 'cmGannBox', totalStep: 3, createPointFigures({ coordinates }) {
    if (coordinates.length < 2) return [];
    const [a, b] = coordinates, f = [{ type: 'polygon', attrs: { coordinates: [a, { x: b.x, y: a.y }, b, { x: a.x, y: b.y }] }, styles: { style: 'stroke_fill', color: 'rgba(41,98,255,0.05)', borderColor: '#2962ff', borderSize: 1 } }];
    [0.25, 0.382, 0.5, 0.618, 0.75].forEach(r => { const x = a.x + (b.x - a.x) * r, y = a.y + (b.y - a.y) * r; f.push({ type: 'line', ignoreEvent: true, attrs: { coordinates: [{ x, y: a.y }, { x, y: b.y }] }, styles: { color: 'rgba(41,98,255,0.4)' } }, { type: 'line', ignoreEvent: true, attrs: { coordinates: [{ x: a.x, y }, { x: b.x, y }] }, styles: { color: 'rgba(41,98,255,0.4)' } }); });
    f.push({ type: 'line', ignoreEvent: true, attrs: { coordinates: [a, b] }, styles: { color: '#9598a1', style: 'dashed', dashedValue: [3, 3] } }, { type: 'line', ignoreEvent: true, attrs: { coordinates: [{ x: a.x, y: b.y }, { x: b.x, y: a.y }] }, styles: { color: '#9598a1', style: 'dashed', dashedValue: [3, 3] } });
    return f;
  } });
  R({ name: 'cmGannFan', totalStep: 3, createPointFigures({ coordinates, bounding }) {
    if (coordinates.length < 2) return [];
    const [a, b] = coordinates, dx = b.x - a.x || 1, dy = b.y - a.y, X = dx > 0 ? bounding.width : 0, f = [];
    [[1, 8], [1, 4], [1, 3], [1, 2], [1, 1], [2, 1], [3, 1], [4, 1], [8, 1]].forEach(([p, t], i) => { const k = (dy * p / t) / dx; f.push({ type: 'line', attrs: { coordinates: [a, { x: X, y: a.y + k * (X - a.x) }] }, styles: { color: i === 4 ? '#2962ff' : 'rgba(41,98,255,0.45)' } }); });
    return f;
  } });
  R({ name: 'cmRect', totalStep: 3, createPointFigures({ overlay, coordinates }) {
    if (coordinates.length < 2) return [];
    const [a, b] = coordinates, ls = lineStyle(overlay);
    return [{ type: 'polygon', attrs: { coordinates: [a, { x: b.x, y: a.y }, b, { x: a.x, y: b.y }] }, styles: { style: 'stroke_fill', color: hexA(ls.color, 0.12), borderColor: ls.color, borderSize: ls.size } }];
  } });
  R({ name: 'cmCircle', totalStep: 3, createPointFigures({ overlay, coordinates }) {
    if (coordinates.length < 2) return [];
    const [a, b] = coordinates, ls = lineStyle(overlay);
    return [{ type: 'circle', attrs: { x: a.x, y: a.y, r: Math.hypot(b.x - a.x, b.y - a.y) }, styles: { style: 'stroke_fill', color: hexA(ls.color, 0.1), borderColor: ls.color, borderSize: ls.size } }];
  } });
  R({ name: 'cmTri', totalStep: 4, createPointFigures({ overlay, coordinates }) {
    const ls = lineStyle(overlay);
    if (coordinates.length < 3) return [{ type: 'line', attrs: { coordinates }, styles: ls }];
    return [{ type: 'polygon', attrs: { coordinates }, styles: { style: 'stroke_fill', color: hexA(ls.color, 0.12), borderColor: ls.color, borderSize: ls.size } }];
  } });
  R({ name: 'cmArrow', totalStep: 3, createPointFigures({ overlay, coordinates }) {
    if (coordinates.length < 2) return [];
    const [a, b] = coordinates, ang = Math.atan2(b.y - a.y, b.x - a.x), L = 10, ls = lineStyle(overlay);
    return [{ type: 'line', attrs: { coordinates: [a, b] }, styles: ls }, { type: 'line', attrs: { coordinates: [{ x: b.x - L * Math.cos(ang - 0.45), y: b.y - L * Math.sin(ang - 0.45) }, b, { x: b.x - L * Math.cos(ang + 0.45), y: b.y - L * Math.sin(ang + 0.45) }] }, styles: Object.assign({}, ls, { style: 'solid' }) }];
  } });
  R({ name: 'cmText', totalStep: 2, needDefaultXAxisFigure: false, needDefaultYAxisFigure: false, createPointFigures({ overlay, coordinates }) {
    const t = (overlay.extendData && overlay.extendData.text) || 'Text', c = lineStyle(overlay).color;
    return [{ type: 'text', attrs: { x: coordinates[0].x, y: coordinates[0].y, text: t, align: 'left', baseline: 'middle' }, styles: { color: c, size: 14, backgroundColor: 'transparent', borderSize: 0, paddingLeft: 0, paddingRight: 0, paddingTop: 0, paddingBottom: 0 } }];
  } });
  R({ name: 'cmNote', totalStep: 2, needDefaultXAxisFigure: false, needDefaultYAxisFigure: false, createPointFigures({ overlay, coordinates }) {
    const t = (overlay.extendData && overlay.extendData.text) || 'Note', c = lineStyle(overlay).color, p = coordinates[0];
    return [{ type: 'line', ignoreEvent: true, attrs: { coordinates: [p, { x: p.x, y: p.y - 18 }] }, styles: { color: c } }, { type: 'text', attrs: { x: p.x, y: p.y - 18, text: t, align: 'center', baseline: 'bottom' }, styles: { color: '#fff', size: 12, backgroundColor: c, borderRadius: 4, paddingLeft: 7, paddingRight: 7, paddingTop: 4, paddingBottom: 4, borderSize: 0 } }];
  } });
  const rangeFig = (mode) => ({ overlay, coordinates, precision }) => {
    if (coordinates.length < 2) return [];
    const [a, b] = coordinates, P = overlay.points, up = P[1].value >= P[0].value, c = mode === 'd' ? '#2962ff' : up ? '#2962ff' : '#f23645';
    const bars = Math.round((P[1].dataIndex - P[0].dataIndex)), dt = ptTs(P[1]) - ptTs(P[0]);
    const lines = [];
    if (mode !== 'd') lines.push(`${fmt(P[1].value - P[0].value, precision.price)} (${pct(P[0].value, P[1].value).toFixed(2)}%)`);
    if (mode !== 'p') lines.push(`${bars} bars, ${durStr(Math.abs(dt))}`);
    if (mode === 'dp' && C.list.length) { const i0 = Math.max(0, Math.min(P[0].dataIndex, P[1].dataIndex)), i1 = Math.min(C.list.length - 1, Math.max(P[0].dataIndex, P[1].dataIndex)); let v = 0; for (let i = i0; i <= i1; i++) v += C.list[i] ? C.list[i].volume : 0; lines.push('Vol ' + fmtVol(v)); }
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const f = [{ type: 'polygon', attrs: { coordinates: [a, { x: b.x, y: a.y }, b, { x: a.x, y: b.y }] }, styles: { style: 'fill', color: hexA(c, 0.14) } }];
    if (mode !== 'd') f.push({ type: 'line', ignoreEvent: true, attrs: { coordinates: [{ x: mx, y: a.y }, { x: mx, y: b.y }] }, styles: { color: c } });
    if (mode !== 'p') f.push({ type: 'line', ignoreEvent: true, attrs: { coordinates: [{ x: a.x, y: my }, { x: b.x, y: my }] }, styles: { color: c } });
    f.push(txt(mx, Math.max(a.y, b.y) + 22, lines.join('  ·  '), c, 'center', 'bottom', c));
    return f;
  };
  R({ name: 'cmPriceRange', totalStep: 3, createPointFigures: rangeFig('p') });
  R({ name: 'cmDateRange', totalStep: 3, createPointFigures: rangeFig('d') });
  R({ name: 'cmDPRange', totalStep: 3, createPointFigures: rangeFig('dp') });
  const posFig = long => ({ overlay, coordinates, bounding, precision }) => {
    if (coordinates.length < 2) return [];
    const P = overlay.points, e = coordinates[0], t = coordinates[1], entry = P[0].value, tgt = P[1].value;
    const stp = P[2] ? P[2].value : entry - (tgt - entry) / 2, sy = coordinates[2] ? coordinates[2].y : e.y - (t.y - e.y) / 2;
    const x2 = Math.max(t.x, e.x + 60), rr = Math.abs(tgt - entry) / (Math.abs(entry - stp) || 1e-9);
    const g = 'rgba(8,153,129,0.2)', r = 'rgba(242,54,69,0.2)';
    return [
      { type: 'polygon', attrs: { coordinates: [{ x: e.x, y: e.y }, { x: x2, y: e.y }, { x: x2, y: t.y }, { x: e.x, y: t.y }] }, styles: { style: 'fill', color: long ? g : r } },
      { type: 'polygon', attrs: { coordinates: [{ x: e.x, y: e.y }, { x: x2, y: e.y }, { x: x2, y: sy }, { x: e.x, y: sy }] }, styles: { style: 'fill', color: long ? r : g } },
      { type: 'line', ignoreEvent: true, attrs: { coordinates: [{ x: e.x, y: e.y }, { x: x2, y: e.y }] }, styles: { color: '#787b86' } },
      txt((e.x + x2) / 2, t.y - 3, `Target: ${fmt(tgt, precision.price)} (${pct(entry, tgt).toFixed(2)}%)`, '#fff', 'center', 'bottom', '#089981'),
      txt((e.x + x2) / 2, sy + 19, `Stop: ${fmt(stp, precision.price)} (${pct(entry, stp).toFixed(2)}%)`, '#fff', 'center', 'bottom', '#f23645'),
      txt((e.x + x2) / 2, e.y - 3, `${long ? 'Long' : 'Short'}  R:R ${rr.toFixed(2)}`, '#fff', 'center', 'bottom', '#787b86')
    ];
  };
  R({ name: 'cmLong', totalStep: 4, createPointFigures: posFig(true) });
  R({ name: 'cmShort', totalStep: 4, createPointFigures: posFig(false) });
  R({ name: 'cmInfoLine', totalStep: 3, createPointFigures({ overlay, coordinates, precision }) {
    if (coordinates.length < 2) return [];
    const P = overlay.points, [a, b] = coordinates, c = lineStyle(overlay).color;
    const ang = Math.atan2(a.y - b.y, b.x - a.x) * 180 / Math.PI;
    return [{ type: 'line', attrs: { coordinates: [a, b] }, styles: lineStyle(overlay)}, txt(b.x + 6, b.y, `${fmt(P[1].value - P[0].value, precision.price)} (${pct(P[0].value, P[1].value).toFixed(2)}%) · ${Math.round(P[1].dataIndex - P[0].dataIndex)} bars · ${ang.toFixed(1)}°`, c, 'left', 'middle', c)];
  } });
  R({ name: 'cmAngle', totalStep: 3, createPointFigures({ overlay, coordinates }) {
    if (coordinates.length < 2) return [];
    const [a, b] = coordinates, ang = Math.atan2(a.y - b.y, b.x - a.x) * 180 / Math.PI, c = lineStyle(overlay).color;
    return [{ type: 'line', attrs: { coordinates: [a, b] }, styles: lineStyle(overlay) }, { type: 'line', ignoreEvent: true, attrs: { coordinates: [a, { x: a.x + 60, y: a.y }] }, styles: { color: c, style: 'dashed', dashedValue: [3, 3] } }, txt(a.x + 64, a.y, ang.toFixed(1) + '°', c, 'left', 'middle')];
  } });
  R({ name: 'cmCross', totalStep: 2, createPointFigures({ overlay, coordinates, bounding }) {
    const p = coordinates[0], ls = lineStyle(overlay);
    return [{ type: 'line', attrs: { coordinates: [{ x: 0, y: p.y }, { x: bounding.width, y: p.y }] }, styles: ls }, { type: 'line', attrs: { coordinates: [{ x: p.x, y: 0 }, { x: p.x, y: bounding.height }] }, styles: ls }];
  } });
  R({ name: 'cmRegr', totalStep: 3, createPointFigures({ overlay, coordinates, xAxis, yAxis }) {
    if (coordinates.length < 2 || !C.list.length) return [];
    const P = overlay.points; let i0 = Math.round(Math.min(P[0].dataIndex, P[1].dataIndex)), i1 = Math.round(Math.max(P[0].dataIndex, P[1].dataIndex));
    i0 = Math.max(0, i0); i1 = Math.min(C.list.length - 1, i1); const n = i1 - i0 + 1; if (n < 3) return [];
    let sx = 0, sy = 0, sxy = 0, sxx = 0; for (let i = i0; i <= i1; i++) { const x = i - i0, y = C.list[i].close; sx += x; sy += y; sxy += x * y; sxx += x * x; }
    const m = (n * sxy - sx * sy) / (n * sxx - sx * sx), b = (sy - m * sx) / n; let sd = 0; for (let i = i0; i <= i1; i++) sd += (C.list[i].close - (b + m * (i - i0))) ** 2; sd = Math.sqrt(sd / n);
    const pt = (i, off) => ({ x: xAxis.convertToPixel(i), y: yAxis.convertToPixel(b + m * (i - i0) + off) });
    return [{ type: 'line', attrs: { coordinates: [pt(i0, 0), pt(i1, 0)] }, styles: { color: '#f23645', style: 'dashed', dashedValue: [4, 4] } },
      { type: 'line', attrs: { coordinates: [pt(i0, 2 * sd), pt(i1, 2 * sd)] }, styles: { color: '#2962ff' } }, { type: 'line', attrs: { coordinates: [pt(i0, -2 * sd), pt(i1, -2 * sd)] }, styles: { color: '#2962ff' } },
      { type: 'polygon', ignoreEvent: true, attrs: { coordinates: [pt(i0, 2 * sd), pt(i1, 2 * sd), pt(i1, -2 * sd), pt(i0, -2 * sd)] }, styles: { style: 'fill', color: 'rgba(41,98,255,0.06)' } }];
  } });
  R({ name: 'cmFork', totalStep: 4, createPointFigures({ coordinates, bounding }) {
    if (coordinates.length < 2) return [];
    if (coordinates.length < 3) return [{ type: 'line', attrs: { coordinates }, styles: { color: '#2962ff' } }];
    const [a, b, c] = coordinates, m = { x: (b.x + c.x) / 2, y: (b.y + c.y) / 2 }, dx = m.x - a.x || 1, k = (m.y - a.y) / dx, X = dx > 0 ? bounding.width : 0;
    const ext = p => ({ x: X, y: p.y + k * (X - p.x) });
    return [{ type: 'line', attrs: { coordinates: [a, ext(a)] }, styles: { color: '#f23645' } }, { type: 'line', attrs: { coordinates: [b, ext(b)] }, styles: { color: '#2962ff' } }, { type: 'line', attrs: { coordinates: [c, ext(c)] }, styles: { color: '#2962ff' } }, { type: 'line', ignoreEvent: true, attrs: { coordinates: [b, c] }, styles: { color: '#9598a1', style: 'dashed', dashedValue: [3, 3] } }];
  } });
  R({ name: 'cmVP', totalStep: 3, createPointFigures({ overlay, coordinates, yAxis }) {
    if (coordinates.length < 2 || !C.list.length) return [];
    const P = overlay.points, i0 = Math.max(0, Math.round(Math.min(P[0].dataIndex, P[1].dataIndex))), i1 = Math.min(C.list.length - 1, Math.round(Math.max(P[0].dataIndex, P[1].dataIndex)));
    if (i1 - i0 < 1) return [];
    let hi = -Infinity, lo = Infinity; for (let i = i0; i <= i1; i++) { hi = Math.max(hi, C.list[i].high); lo = Math.min(lo, C.list[i].low); }
    const N = 24, step = (hi - lo) / N || 1, up = new Array(N).fill(0), dn = new Array(N).fill(0);
    for (let i = i0; i <= i1; i++) { const k = C.list[i], bi = Math.min(N - 1, Math.floor(((k.high + k.low + k.close) / 3 - lo) / step)); (k.close >= k.open ? up : dn)[bi] += k.volume || 0; }
    const tot = up.map((v, i) => v + dn[i]), max = Math.max(...tot) || 1, poc = tot.indexOf(max);
    const x0 = Math.min(coordinates[0].x, coordinates[1].x), x1 = Math.max(coordinates[0].x, coordinates[1].x), W = (x1 - x0) * 0.7, f = [];
    f.push({ type: 'polygon', attrs: { coordinates: [{ x: x0, y: yAxis.convertToPixel(hi) }, { x: x1, y: yAxis.convertToPixel(hi) }, { x: x1, y: yAxis.convertToPixel(lo) }, { x: x0, y: yAxis.convertToPixel(lo) }] }, styles: { style: 'fill', color: 'rgba(41,98,255,0.04)' } });
    for (let i = 0; i < N; i++) {
      const yT = yAxis.convertToPixel(lo + step * (i + 1)) + 1, yB = yAxis.convertToPixel(lo + step * i) - 1, wu = W * up[i] / max, wd = W * dn[i] / max;
      f.push({ type: 'polygon', ignoreEvent: true, attrs: { coordinates: [{ x: x0, y: yT }, { x: x0 + wu, y: yT }, { x: x0 + wu, y: yB }, { x: x0, y: yB }] }, styles: { style: 'fill', color: 'rgba(8,153,129,0.35)' } });
      f.push({ type: 'polygon', ignoreEvent: true, attrs: { coordinates: [{ x: x0 + wu, y: yT }, { x: x0 + wu + wd, y: yT }, { x: x0 + wu + wd, y: yB }, { x: x0 + wu, y: yB }] }, styles: { style: 'fill', color: 'rgba(242,54,69,0.35)' } });
    }
    const py = yAxis.convertToPixel(lo + step * (poc + 0.5));
    f.push({ type: 'line', ignoreEvent: true, attrs: { coordinates: [{ x: x0, y: py }, { x: x1, y: py }] }, styles: { color: '#f23645' } }, txt(x1 + 2, py, 'POC', '#f23645', 'left', 'middle'));
    return f;
  } });
  R({ name: 'cmEvent', totalStep: 2, needDefaultPointFigure: false, needDefaultXAxisFigure: false, needDefaultYAxisFigure: false, createPointFigures({ overlay, coordinates, bounding }) {
    const e = overlay.extendData || {}, x = coordinates[0].x, y = bounding.height - 14, col = e.imp === 'High' ? '#f23645' : '#f59e0b';
    return [{ type: 'circle', attrs: { x, y, r: 10 }, styles: { style: 'stroke_fill', color: '#fff', borderColor: col, borderSize: 1.5 } }, { type: 'text', ignoreEvent: true, attrs: { x, y, text: (e.c || '').slice(0, 3), align: 'center', baseline: 'middle' }, styles: { color: col, size: 8, weight: 'bold', backgroundColor: 'transparent', borderSize: 0, paddingLeft: 0, paddingRight: 0, paddingTop: 0, paddingBottom: 0 } }];
  } });
  R({ name: 'cmTrade', totalStep: 2, needDefaultPointFigure: false, needDefaultXAxisFigure: false, needDefaultYAxisFigure: false, createPointFigures({ overlay, coordinates }) {
    const e = overlay.extendData || {}, p = coordinates[0], buy = e.side === 'buy', c = buy ? '#089981' : '#f23645', s = 6;
    return [{ type: 'polygon', attrs: { coordinates: buy ? [{ x: p.x, y: p.y + 4 }, { x: p.x - s, y: p.y + 4 + s * 1.6 }, { x: p.x + s, y: p.y + 4 + s * 1.6 }] : [{ x: p.x, y: p.y - 4 }, { x: p.x - s, y: p.y - 4 - s * 1.6 }, { x: p.x + s, y: p.y - 4 - s * 1.6 }] }, styles: { style: 'fill', color: c } },
      txt(p.x, buy ? p.y + 28 : p.y - 18, e.label || (buy ? 'Buy' : 'Sell'), c, 'center', 'bottom')];
  } });
  R({ name: 'cmAlertLine', totalStep: 2, needDefaultPointFigure: false, needDefaultXAxisFigure: false, createPointFigures({ coordinates, bounding }) {
    const y = coordinates[0].y; return [{ type: 'line', ignoreEvent: true, attrs: { coordinates: [{ x: 0, y }, { x: bounding.width, y }] }, styles: { color: '#f23645', style: 'dashed', dashedValue: [6, 4], size: 1 } }];
  }, createYAxisFigures({ overlay, coordinates, bounding, precision }) {
    return [{ type: 'text', attrs: { x: 0, y: coordinates[0].y, text: '⏰ ' + fmt(overlay.points[0].value, precision.price), align: 'left', baseline: 'middle' }, styles: { color: '#fff', backgroundColor: '#f23645', size: 10, borderRadius: 2, paddingLeft: 3, paddingRight: 3, paddingTop: 2, paddingBottom: 2, borderSize: 0 } }];
  } });
}
function hexA(hex, a) { const h = (hex || '#2962ff').replace('#', ''); if (h.length !== 6) return `rgba(41,98,255,${a})`; return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${a})`; }
function durStr(ms) { const m = Math.round(ms / 6e4); if (m < 60) return m + 'm'; const h = Math.floor(m / 60); if (h < 48) return h + 'h ' + (m % 60) + 'm'; return Math.floor(h / 24) + 'd ' + (h % 24) + 'h'; }

/* tool list (only tools that work) */
const TOOLS = [
  { id: 'segment', n: 'Trendline', g: 'Trend tools', i: 't_trend' }, { id: 'rayLine', n: 'Ray', g: 'Trend tools', i: 't_ray' }, { id: 'cmInfoLine', n: 'Info line', g: 'Trend tools', i: 't_info' },
  { id: 'straightLine', n: 'Extended line', g: 'Trend tools', i: 't_ext' }, { id: 'cmAngle', n: 'Trend angle', g: 'Trend tools', i: 't_angle' }, { id: 'horizontalStraightLine', n: 'Horizontal line', g: 'Trend tools', i: 't_hl' },
  { id: 'horizontalRayLine', n: 'Horizontal ray', g: 'Trend tools', i: 't_hr' }, { id: 'verticalStraightLine', n: 'Vertical line', g: 'Trend tools', i: 't_vl' }, { id: 'cmCross', n: 'Cross line', g: 'Trend tools', i: 't_cross' },
  { id: 'parallelStraightLine', n: 'Parallel channel', g: 'Trend tools', i: 't_pc' }, { id: 'cmRegr', n: 'Regression trend', g: 'Trend tools', i: 't_regr' }, { id: 'cmFork', n: 'Pitchfork', g: 'Trend tools', i: 't_fork' },
  { id: 'cmFib', n: 'Fib retracement', g: 'Gann and Fib', i: 't_fib' }, { id: 'cmFibExt', n: 'Trend-based fib extension', g: 'Gann and Fib', i: 't_fibx' }, { id: 'cmFibTZ', n: 'Fib time zone', g: 'Gann and Fib', i: 't_fibtz' },
  { id: 'cmFibFan', n: 'Fib speed fan', g: 'Gann and Fib', i: 't_fibfan' }, { id: 'cmGannBox', n: 'Gann box', g: 'Gann and Fib', i: 't_gannbox' }, { id: 'cmGannFan', n: 'Gann fan', g: 'Gann and Fib', i: 't_gannfan' },
  { id: 'cmLong', n: 'Long position', g: 'Forecasting and measurement', i: 't_long' }, { id: 'cmShort', n: 'Short position', g: 'Forecasting and measurement', i: 't_short' },
  { id: 'cmPriceRange', n: 'Price range', g: 'Forecasting and measurement', i: 't_prange' }, { id: 'cmDateRange', n: 'Date range', g: 'Forecasting and measurement', i: 't_drange' }, { id: 'cmDPRange', n: 'Date and price range', g: 'Forecasting and measurement', i: 't_dprange' },
  { id: 'cmVP', n: 'Fixed range volume profile', g: 'Forecasting and measurement', i: 't_vp' },
  { id: 'cmRect', n: 'Rectangle', g: 'Shapes and text', i: 't_rect' }, { id: 'cmCircle', n: 'Circle', g: 'Shapes and text', i: 't_circle' }, { id: 'cmTri', n: 'Triangle', g: 'Shapes and text', i: 't_tri' },
  { id: 'cmArrow', n: 'Arrow', g: 'Shapes and text', i: 't_arrow' }, { id: 'cmText', n: 'Text', g: 'Shapes and text', i: 't_text', text: 1 }, { id: 'cmNote', n: 'Note', g: 'Shapes and text', i: 't_note', text: 1 },
  { id: 'priceLine', n: 'Price label', g: 'Shapes and text', i: 't_plabel' }
];
const toolById = id => TOOLS.find(t => t.id === id);
const LINE_ALERTABLE = ['segment', 'rayLine', 'straightLine', 'cmInfoLine', 'cmAngle'];
const PRICE_ALERTABLE = ['horizontalStraightLine', 'horizontalRayLine', 'priceLine'];

/* ---------- chart init ---------- */
function initChart() {
  registerIndicators(); registerTools();
  C.chart = klinecharts.init('chart', { styles: themeStyles(), timezone: settings().tz || IST, locale: 'en-US' });
  C.chart.setOffsetRightDistance(60);
  C.chart.setBarSpace(7);
  C.chart.setLoadDataCallback && C.chart.setLoadDataCallback(onLoadMore);
  if (!C.chart.setLoadDataCallback && C.chart.loadMore) C.chart.loadMore(ts => onLoadMore({ type: 'forward', data: { timestamp: ts }, callback: (l, m) => C.chart.applyMoreData(l, m) }));
  window.addEventListener('resize', () => { C.chart.resize(); sizePanes(); placeCountdown(); });
  C.chart.subscribeAction('onVisibleRangeChange', () => placeCountdown());
  C.chart.subscribeAction('onScroll', () => placeCountdown());
  C.chart.subscribeAction('onZoom', () => placeCountdown());
  setInterval(tickCountdown, 1000);
  C.chart.subscribeAction('onTooltipIconClick', d => { try { indicatorIcon(d); } catch (e) { } });
  setupGestures();
  setInterval(selfHeal, 5000);
  const cfg = Store.get('ind', null) || [{ n: 'STOCHRSI' }, { n: 'RSI' }];
  cfg.forEach(c => addIndicator(c.n, c.p, true, c.h));
}
async function onLoadMore(params) {
  const cb = params.callback || ((l, m) => C.chart.applyMoreData(l, m));
  if (C.replay || !C.sym || C.sym.src !== 'bn' || !C.list.length || C.moreBusy) return;
  const my = C.seq;
  C.moreBusy = true;
  try {
    const t = tfObj(C.tf), [iv, n] = t.bn;
    if (iv === '1s') return cb([], false);
    let more = aggregate(await bnKlines(C.sym.s, iv, 1000, C.list[0].timestamp - 1), n, t.ms, 0);
    if (my !== C.seq || C.replay) return; // symbol or interval changed meanwhile: drop it
    more = more.filter(k => k.timestamp < C.list[0].timestamp);
    C.list = more.concat(C.list); shiftDrawIdx(more.length);
    cb(more, more.length > 0);
  } catch (e) { if (my === C.seq) cb([], false); }
  finally { C.moreBusy = false; }
}
function shiftDrawIdx() { setTimeout(() => restoreDrawings(), 50); }

function applyTheme() {
  document.body.classList.toggle('dark', settings().theme === 'dark');
  C.chart && C.chart.setStyles(themeStyles());
  if (C.chart && C.chart.setTimezone) C.chart.setTimezone(settings().tz || IST);
}

/* ---------- data + live ---------- */
function heikin(list) { const o = []; list.forEach((k, i) => { const c = (k.open + k.high + k.low + k.close) / 4, op = i ? (o[i - 1].open + o[i - 1].close) / 2 : (k.open + k.close) / 2; o.push({ timestamp: k.timestamp, open: op, close: c, high: Math.max(k.high, op, c), low: Math.min(k.low, op, c), volume: k.volume }); }); return o; }
// always a copy: the chart must own its array, or new candles get pushed without the chart knowing (chart freezes)
const viewData = l => settings().chartType === 'heikin' ? heikin(l) : l.slice();

async function openSymbol(sym, tf) {
  if (C.replay) stopReplay(true);
  C.sym = sym; if (tf) C.tf = tf;
  Store.set('last', { sym, tf: C.tf }, true);
  const t = tfObj(C.tf);
  if (t.cryptoOnly && sym.src !== 'bn') C.tf = '1m';
  updateLegend(); updateWheels();
  await loadData();
}
async function loadData() {
  const my = ++C.seq; stopLive(); showMsg('Loading…'); C.moreBusy = false; drawPend = null; clearTimeout(drawT); drawT = null;
  try {
    const { list, meta, base } = await loadHistory(C.sym, C.tf);
    if (my !== C.seq) return;
    if (!list.length) throw new Error('No data for this interval');
    C.list = list; C.meta = meta || {};
    const lb = list[list.length - 1].timestamp, t = tfObj(C.tf);
    C._agg = { b: lb, parts: {} };
    (base || []).filter(k => bucketOf(k.timestamp, t.ms, sessionOffset(C.sym)) === lb).forEach(k => C._agg.parts[k.timestamp] = Object.assign({}, k));
    const d = decimals(list[list.length - 1].close);
    C.chart.setPriceVolumePrecision(d, C.sym.src === 'bn' ? 2 : 0);
    C.chart.applyNewData(viewData(list), C.sym.src === 'bn');
    hideMsg(); sizePanes();
    restoreDrawings(); drawAlertLines(); drawEvents(); refreshCompare();
    startLive(my);
    updateLegend();
  } catch (e) {
    if (my !== C.seq) return;
    if (e.message === 'LOGIN_NEEDED') showMsg('On the website, NSE / gold futures data comes through your cloud login.<br><button class="btn pri" onclick="UI.page(\'menu\');UI.account()">Log in</button>');
    else showMsg('Could not load data: ' + esc(e.message) + '<br><button class="btn" onclick="loadData()">Retry</button>');
  }
}
function stopLive() { C.live = false; try { C.ws && C.ws.close(); } catch (e) { } C.ws = null; clearInterval(C.poll); C.poll = null; }

/** Merge a fresh base candle into the chart (handles merged intervals like 10m, 45m, 4h). */
function aggN() { const t = tfObj(C.tf); return C.sym.src === 'bn' ? t.bn[1] : t.yf[1]; }
function combine(parts, b) { return { timestamp: b, open: parts[0].open, high: Math.max(...parts.map(p => p.high)), low: Math.min(...parts.map(p => p.low)), close: parts[parts.length - 1].close, volume: parts.reduce((s, p) => s + (p.volume || 0), 0) }; }
let drawPend = null, drawT = null;
function drawNow() {
  clearTimeout(drawT); drawT = null; const c = drawPend; drawPend = null; if (!c || C.replay) return;
  if (settings().chartType === 'heikin') { const h = heikin(C.list.slice(-2)); C.chart.updateData(h[h.length - 1]); }
  else C.chart.updateData(c);
}
/** At most ~4 redraws a second: smooth on phones, price still exact. */
function setLast(c) {
  const last = C.list[C.list.length - 1];
  if (last && c.timestamp < last.timestamp) return;
  if (last && c.timestamp === last.timestamp) C.list[C.list.length - 1] = c; else C.list.push(c);
  if (drawPend && drawPend.timestamp !== c.timestamp) drawNow(); // close the old candle first
  drawPend = c;
  if (!drawT) drawT = setTimeout(drawNow, 250);
  C.lastTick = Date.now();
  scheduleLegend();
}
function pushBase(k) {
  if (aggN() <= 1) return setLast(Object.assign({}, k));
  const t = tfObj(C.tf), b = bucketOf(k.timestamp, t.ms, sessionOffset(C.sym));
  if (!C._agg || C._agg.b !== b) { if (C._agg && b < C._agg.b) return; C._agg = { b, parts: {} }; }
  C._agg.parts[k.timestamp] = Object.assign({}, k);
  setLast(combine(Object.values(C._agg.parts).sort((x, y) => x.timestamp - y.timestamp), b));
}
/** Newest traded price between candle updates. */
function pushPrice(p) {
  const l = C.list[C.list.length - 1]; if (!l || !p) return;
  if (aggN() > 1 && C._agg) {
    const parts = Object.values(C._agg.parts).sort((x, y) => x.timestamp - y.timestamp), lp = parts[parts.length - 1];
    if (lp) { lp.close = p; lp.high = Math.max(lp.high, p); lp.low = Math.min(lp.low, p); return setLast(combine(parts, C._agg.b)); }
  }
  setLast(Object.assign({}, l, { close: p, high: Math.max(l.high, p), low: Math.min(l.low, p) }));
}
function startLive(my) {
  C.live = true; C.lastTick = Date.now();
  const t = tfObj(C.tf);
  if (C.sym.src === 'bn') {
    const s = C.sym.s.toLowerCase(), iv = t.bn[0];
    const ws = bnSocket(`/stream?streams=${s}@kline_${iv}/${s}@aggTrade`);
    ws.onmessage = ev => {
      if (my !== C.seq || C.replay) return;
      const m = JSON.parse(ev.data), d = m.data; if (!d) return;
      if (d.e === 'kline') { const k = d.k; pushBase({ timestamp: k.t, open: +k.o, high: +k.h, low: +k.l, close: +k.c, volume: +k.v }); }
      else if (d.e === 'aggTrade') { // tick-by-tick price between kline updates
        const last = C.list[C.list.length - 1], p = +d.p; if (!last) return;
        if (bucketOf(d.T, t.ms, 0) !== last.timestamp) return; // a new candle opens with the kline event
        if (C._tq) { C._tq = p; return; }
        C._tq = p; requestAnimationFrame(() => { const q = C._tq; C._tq = null; if (!C.replay && my === C.seq) pushPrice(q); });
      }
    };
    ws.onclose = () => { if (my === C.seq && C.live && !C.replay) setTimeout(() => { if (my !== C.seq || !C.live) return;
      if (Date.now() - (C.lastTick || 0) > t.ms * 3) { loadData(); return; } // long gap (phone slept): reload everything
      bnKlines(C.sym.s, iv, 5).then(l => l.forEach(pushBase)).catch(() => { }); startLive(my); }, 2000); };
    C.ws = ws;
  } else {
    const [iv] = t.yf, rng = ['1m', '2m', '5m', '15m', '30m'].includes(iv) ? '1d' : iv === '60m' ? '5d' : iv === '1d' ? '5d' : iv === '1wk' ? '1mo' : '1y';
    const tick = async () => {
      if (my !== C.seq || C.replay) return;
      try {
        const r = await yfChart(C.sym.s, iv, rng);
        if (my !== C.seq) return;
        C.meta = r.meta;
        const lastTs = C.list.length ? C.list[C.list.length - 1].timestamp : 0;
        r.list.filter(k => k.timestamp >= lastTs - tfObj(C.tf).ms).forEach(pushBase);
        // newest traded price (Yahoo updates meta before the candle)
        const p = r.meta.regularMarketPrice, l = C.list[C.list.length - 1];
        if (p && l && marketState(C.sym, r.meta) === 'open' && p !== l.close) pushPrice(p);
        updateLegend();
      } catch (e) { }
    };
    C.poll = setInterval(tick, NATIVE ? 2000 : 3000);
  }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && C.sym && !C.replay && (!C.live || Date.now() - (C.lastTick || 0) > 15000)) loadData(); });

/* ---------- legend, wheels, countdown ---------- */
let legT = null;
function scheduleLegend() { if (legT) return; legT = setTimeout(() => { legT = null; updateLegend(); }, 200); }
function updateLegend() {
  if (!C.sym) return;
  $('#lgIcon').outerHTML = symIcon(C.sym).replace('class="sicon"', 'class="sicon" id="lgIcon"');
  $('#lgName').textContent = C.sym.d || C.sym.n;
  const last = C.list[C.list.length - 1], q = quote(C.sym) || {};
  let st = C.sym.src === 'bn' ? 'open' : marketState(C.sym, C.meta);
  if (C.replay) st = 'closed';
  const ms = $('#lgState'); ms.className = 'mstate ' + (st === 'open' ? '' : st); ms.title = C.replay ? 'Replay' : st === 'open' ? 'Market open · live' : st === 'delay' ? 'Data may be delayed' : 'Market closed';
  if (!last) { $('#lgPx').textContent = ''; return; }
  const pc = q.pc || C.meta.chartPreviousClose || C.meta.previousClose || (C.list.length > 1 ? C.list[0].open : last.open);
  const ch = last.close - pc, cls = ch >= 0 ? 'up' : 'dn', d = decimals(last.close);
  $('#lgPx').innerHTML = `<span class="${cls}">${fmt(last.close, d)}  ${ch >= 0 ? '+' : '−'}${fmt(Math.abs(ch), d)} (${ch >= 0 ? '+' : '−'}${Math.abs(ch / pc * 100).toFixed(2)}%)</span>${C.replay ? ' <span class="tag hit">Replay</span>' : ''}`;
  placeCountdown();
}
function updateWheels() {
  const syms = allSymbols(), i = syms.findIndex(s => symKey(s) === symKey(C.sym));
  $('#symCur').textContent = C.sym.n;
  $('#symPrev').textContent = i > 0 ? syms[i - 1].n : '';
  $('#symNext').textContent = i >= 0 && i < syms.length - 1 ? syms[i + 1].n : '';
  const fav = favTfs(), j = fav.indexOf(C.tf);
  $('#tfCur').textContent = C.tf;
  $('#tfPrev').textContent = j > 0 ? fav[j - 1] : '';
  $('#tfNext').textContent = j >= 0 && j < fav.length - 1 ? fav[j + 1] : '';
}
function favTfs() { return Store.get('favtf', ['5m', '15m', '30m', '1h', '4h', '1D']); }
function placeCountdown() {
  const el = $('#countdown'), last = C.list[C.list.length - 1];
  if (!C.chart || !last || !settings().countdown || C.replay || tfObj(C.tf).ms > 864e5 || settings().chartType === 'line') { el.classList.add('hide'); return; }
  try {
    const p = C.chart.convertToPixel({ timestamp: last.timestamp, value: last.close }, { paneId: 'candle_pane', absolute: true });
    const yb = C.chart.getSize('candle_pane', 'yAxis');
    const cb = C.chart.getSize('candle_pane');
    if (!p || p.y == null || !yb || p.y < 0 || p.y > cb.height) { el.classList.add('hide'); return; }
    el.style.top = (p.y - 10) + 'px'; el.style.left = yb.left + 'px'; el.style.width = yb.width + 'px';
    el.classList.toggle('upc', last.close >= last.open);
    el.classList.remove('hide');
    tickCountdown();
  } catch (e) { el.classList.add('hide'); }
}
function tickCountdown() {
  const el = $('#countdown'), last = C.list[C.list.length - 1];
  if (!last || el.classList.contains('hide')) return;
  const t = tfObj(C.tf), end = last.timestamp + t.ms, left = Math.max(0, end - Date.now()), s = Math.floor(left / 1000);
  const hh = Math.floor(s / 3600), mm = Math.floor(s % 3600 / 60), ss = s % 60;
  const closed = C.sym.src !== 'bn' && marketState(C.sym, C.meta) !== 'open';
  el.innerHTML = `${fmt(last.close, decimals(last.close))}<small>${closed ? 'Closed' : (hh ? hh + ':' : '') + String(mm).padStart(2, '0') + ':' + String(ss).padStart(2, '0')}</small>`;
}
function showMsg(h) { const m = $('#cMsg'); m.innerHTML = h; m.classList.remove('hide'); }
function hideMsg() { $('#cMsg').classList.add('hide'); }

/* ---------- indicators ---------- */
function addIndicator(name, params, silent, hide) {
  const meta = IND_LIST.find(i => i.id === name); if (!meta || C.ind[name]) return;
  const v = params ? { name, calcParams: params } : name;
  let pane;
  try {
    pane = meta.main ? C.chart.createIndicator(v, true, { id: 'candle_pane' }) : C.chart.createIndicator(v, false, { height: name === 'VOL' ? 70 : 100, dragEnabled: true });
  } catch (e) { toast('Could not add ' + meta.name); return; }
  C.ind[name] = { pane: meta.main ? 'candle_pane' : pane, p: params, hide: !!hide };
  if (hide) { try { C.chart.overrideIndicator({ name, visible: false }, C.ind[name].pane); } catch (e) { } }
  sizePanes();
  if (!silent) saveIndicators();
}
/** Indicator panes at a readable height (TradingView-like), the chart keeps the rest. */
function sizePanes() {
  const subs = Object.keys(C.ind).filter(n => C.ind[n].pane !== 'candle_pane');
  if (!subs.length || !C.chart) return;
  const H = $('#chart').clientHeight || 600;
  const each = Math.max(70, Math.min(130, Math.floor(H * 0.42 / subs.length)));
  const saved = Store.get('paneH', {});
  subs.forEach(n => { const id = C.ind[n].pane; try { C.chart.setPaneOptions({ id, height: saved[n] || (n === 'VOL' ? Math.max(56, Math.round(each * 0.7)) : each), minHeight: 40, dragEnabled: true }); } catch (e) { } });
}
function removeIndicator(name) { const i = C.ind[name]; if (!i) return; try { C.chart.removeIndicator(i.pane, name); } catch (e) { } delete C.ind[name]; saveIndicators(); }
function setIndicatorParams(name, params) { const i = C.ind[name]; if (!i) return; try { C.chart.overrideIndicator({ name, calcParams: params }, i.pane); } catch (e) { } i.p = params; saveIndicators(); }
function indicatorParams(name) { const i = C.ind[name]; if (i && i.p) return i.p; try { const x = C.chart.getIndicatorByPaneId(i ? i.pane : undefined, name); return x && x.calcParams; } catch (e) { return null; } }
function saveIndicators() { Store.set('ind', Object.keys(C.ind).map(n => ({ n, p: C.ind[n].p, h: C.ind[n].hide || undefined }))); }
function setIndicators(cfg) { Object.keys(C.ind).forEach(n => { try { C.chart.removeIndicator(C.ind[n].pane, n); } catch (e) { } }); C.ind = {}; (cfg || []).forEach(c => addIndicator(c.n, c.p, true, c.h)); saveIndicators(); }

/* ---------- drawings ---------- */
function drawKey() { return 'drw:' + symKey(C.sym); }
function idxToTs(i) { const l = C.list; if (!l.length) return 0; const ms = tfObj(C.tf).ms; if (i <= 0) return l[0].timestamp + i * ms; if (i < l.length) return l[Math.floor(i)].timestamp; return l[l.length - 1].timestamp + (i - l.length + 1) * ms; }
function tsToIdx(ts) {
  const l = C.list; if (!l.length) return 0; const ms = tfObj(C.tf).ms;
  if (ts >= l[l.length - 1].timestamp) return l.length - 1 + Math.round((ts - l[l.length - 1].timestamp) / ms);
  if (ts <= l[0].timestamp) return Math.round((ts - l[0].timestamp) / ms);
  let lo = 0, hi = l.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (l[m].timestamp <= ts) lo = m; else hi = m - 1; } return lo;
}
function recFromOverlay(o, old) {
  return Object.assign({}, old || {}, { id: o.id, name: o.name, pts: (o.points || []).map(p => ({ t: p.timestamp != null ? p.timestamp : idxToTs(p.dataIndex), v: p.value })), ext: o.extendData, lock: o.lock, vis: o.visible !== false });
}
function snapshot() { C.undo.push(JSON.stringify(C.dr)); if (C.undo.length > 50) C.undo.shift(); $('#undoBtn').classList.remove('dis'); }
function saveDrawings() { Store.set(drawKey(), Object.values(C.dr)); }
function ovCallbacks() {
  return {
    onDrawEnd: e => { const o = e.overlay; C.dr[o.id] = recFromOverlay(o); saveDrawings(); hint(''); const tid = C.tool; C.tool = null; UI.favActive && UI.favActive(); if (settings().keepDraw && tid) setTimeout(() => startTool(tid), 50); return false; },
    onPressedMoveStart: () => { snapshot(); return false; },
    onPressedMoveEnd: e => { const o = e.overlay; C.dr[o.id] = recFromOverlay(o, C.dr[o.id]); saveDrawings(); return false; },
    onClick: e => { if (C.eraser) { snapshot(); removeDrawing(e.overlay.id); return true; } return false; },
    onSelected: e => { C.sel = e.overlay.id; UI.showSel(e.overlay); return false; },
    onDeselected: () => { C.sel = null; UI.hideSel(); return false; },
    onRemoved: e => { if (C.dr[e.overlay.id]) { delete C.dr[e.overlay.id]; saveDrawings(); } return false; }
  };
}
function startTool(id) {
  const t = toolById(id); if (!t) return;
  C.eraser = false;
  let ext;
  if (t.text) { const v = prompt(t.n, ''); if (!v) return; ext = { text: v }; }
  snapshot();
  C.tool = id;
  const id2 = C.chart.createOverlay(Object.assign({ name: id, groupId: 'draw', extendData: ext, mode: settings().magnet ? 'weak_magnet' : 'normal', lock: Store.get('lockAll', false) }, ovCallbacks()));
  if (!id2) { C.undo.pop(); toast('This tool could not start'); return; }
  hint('Tap points on the chart to draw ' + t.n);
}
function hint(t) { const h = $('#toolHint'); h.textContent = t; h.classList.toggle('hide', !t); }
function removeDrawing(id) { try { C.chart.removeOverlay(id); } catch (e) { } delete C.dr[id]; saveDrawings(); UI.hideSel(); }
function restoreDrawings() {
  if (!C.chart || !C.sym) return;
  try { C.chart.removeOverlay({ groupId: 'draw' }); } catch (e) { }
  C.dr = {};
  (Store.get(drawKey(), []) || []).forEach(r => {
    const id = C.chart.createOverlay(Object.assign({
      id: r.id, name: r.name, groupId: 'draw', extendData: r.ext, lock: r.lock || Store.get('lockAll', false), visible: r.vis !== false && !Store.get('hideAll', false),
      mode: settings().magnet ? 'weak_magnet' : 'normal', styles: r.styles,
      points: r.pts.map(p => ({ timestamp: p.t, dataIndex: tsToIdx(p.t), value: p.v }))
    }, ovCallbacks()));
    if (id) C.dr[id] = r;
  });
}
function undoDraw() {
  if (!C.undo.length) { toast('Nothing to undo'); return; }
  const prev = JSON.parse(C.undo.pop());
  Store.set(drawKey(), Object.values(prev)); restoreDrawings();
  if (!C.undo.length) $('#undoBtn').classList.add('dis');
}
function styleDrawing(id, patch) {
  const r = C.dr[id]; if (!r) return; snapshot();
  r.styles = r.styles || {}; r.styles.line = Object.assign({ color: '#2962ff', size: 1, style: 'solid', dashedValue: [4, 4] }, r.styles.line || {}, patch);
  r.styles.polygon = { borderColor: r.styles.line.color, color: hexA(r.styles.line.color, 0.12), borderSize: r.styles.line.size };
  r.styles.rect = r.styles.polygon;
  try { C.chart.overrideOverlay({ id, styles: r.styles }); } catch (e) { }
  saveDrawings();
}
function allDrawings(patch) { try { C.chart.overrideOverlay(Object.assign({ groupId: 'draw' }, patch)); } catch (e) { Object.keys(C.dr).forEach(id => { try { C.chart.overrideOverlay(Object.assign({ id }, patch)); } catch (x) { } }); } }
function removeAllDrawings() { snapshot(); try { C.chart.removeOverlay({ groupId: 'draw' }); } catch (e) { } C.dr = {}; saveDrawings(); }
function cloneDrawing(id) {
  const r = C.dr[id]; if (!r) return; snapshot();
  const ms = tfObj(C.tf).ms * 5, n = JSON.parse(JSON.stringify(r)); n.id = 'd' + uid(); n.pts.forEach(p => p.t += ms);
  const list = Store.get(drawKey(), []); list.push(n); Store.set(drawKey(), list); restoreDrawings();
}

/* ---------- alert lines + events on the chart ---------- */
function drawAlertLines() {
  if (!C.chart || !C.sym) return;
  try { C.chart.removeOverlay({ groupId: 'alert' }); } catch (e) { }
  const last = C.list[C.list.length - 1]; if (!last) return;
  Alerts.list().filter(a => a.active && a.type !== 'line' && a.src === C.sym.src && a.sym === C.sym.s).forEach(a => {
    C.chart.createOverlay({ name: 'cmAlertLine', groupId: 'alert', lock: true, points: [{ timestamp: last.timestamp, dataIndex: C.list.length - 1, value: a.price }] });
  });
}
async function drawEvents() {
  try { C.chart.removeOverlay({ groupId: 'evt' }); } catch (e) { }
  if (!settings().events || !C.list.length || tfObj(C.tf).ms > 36e5 * 4) return;
  try {
    const cal = await loadCalendar();
    const first = C.list[0].timestamp, end = C.list[C.list.length - 1].timestamp + tfObj(C.tf).ms * 40;
    const want = C.sym.cat === 'in' ? ['USD', 'INR', 'CNY'] : ['USD', 'EUR', 'CNY', 'GBP'];
    cal.filter(e => (e.imp === 'High') && want.includes(e.c) && e.t >= first && e.t <= end).forEach(e => {
      C.chart.createOverlay({ name: 'cmEvent', groupId: 'evt', lock: true, extendData: e, points: [{ timestamp: e.t, dataIndex: tsToIdx(e.t), value: C.list[C.list.length - 1].close }],
        onClick: () => { toast(`${e.c} · ${e.title} · ${fmtTime(e.t, true)}${e.a ? ' · Actual ' + e.a : ''}${e.f ? ' · Fcst ' + e.f : ''}${e.p ? ' · Prev ' + e.p : ''}`, 5000); return true; } });
    });
  } catch (e) { }
}

/* ---------- compare ---------- */
klinecharts.registerIndicator && klinecharts.registerIndicator({
  name: 'CMP', shortName: 'Compare', series: 'price', calcParams: [], figures: [{ key: 'c', title: '', type: 'line' }], styles: { lines: [{ style: 'solid', smooth: false, size: 1.4, dashedValue: [2, 2], color: '#ff6d00' }] },
  calc(d) { const m = C.cmp; if (!m || !m.map || !d.length) return d.map(() => ({})); let base = null, mb = null; return d.map(k => { const v = m.map.get(k.timestamp); if (v == null) return {}; if (base == null) { base = k.close; mb = v; } return { c: v * base / mb }; }); }
});
async function setCompare(sym) {
  if (!sym) { if (C.cmp) { try { C.chart.removeIndicator('candle_pane', 'CMP'); } catch (e) { } } C.cmp = null; return; }
  C.cmp = { sym, map: null }; await refreshCompare();
}
async function refreshCompare() {
  if (!C.cmp) return;
  try {
    const { list } = await loadHistory(C.cmp.sym, C.tf); C.cmp.map = new Map(list.map(k => [k.timestamp, k.close]));
    try { C.chart.removeIndicator('candle_pane', 'CMP'); } catch (e) { }
    C.chart.createIndicator({ name: 'CMP', shortName: 'vs ' + C.cmp.sym.n }, true, { id: 'candle_pane' });
  } catch (e) { toast('Compare: ' + e.message); }
}

/* ---------- bar replay + paper trading ---------- */
async function startReplay(fromTs) {
  stopLive();
  const t = tfObj(C.tf); let all = C.list.slice();
  if (C.sym.src === 'bn' && fromTs && fromTs < all[0].timestamp) {
    try { all = aggregate(await bnKlines(C.sym.s, t.bn[0], 1000, fromTs + 700 * BASE_MS[t.bn[0]] * t.bn[1]), t.bn[1], t.ms, 0); } catch (e) { toast('Could not load that date'); }
  }
  let idx = fromTs ? all.findIndex(k => k.timestamp >= fromTs) : Math.max(30, all.length - 150);
  if (idx < 0) idx = all.length - 1; idx = Math.max(10, idx);
  C.replay = { all, idx, speed: 1, timer: null, pos: null, trades: [], cash: 0 };
  C.list = all.slice(0, idx + 1);
  C.chart.applyNewData(viewData(C.list), false);
  restoreDrawings(); UI.replayBar(); updateLegend();
}
function replayStep(dir) {
  const R = C.replay; if (!R) return;
  if (dir > 0) { if (R.idx >= R.all.length - 1) { replayPause(); toast('End of data'); return; } R.idx++; const k = R.all[R.idx]; C.list.push(k); settings().chartType === 'heikin' ? C.chart.updateData(heikin(C.list.slice(-2))[1]) : C.chart.updateData(k); checkPaperStops(); }
  else { if (R.idx <= 10) return; R.idx--; C.list = R.all.slice(0, R.idx + 1); C.chart.applyNewData(viewData(C.list), false); restoreDrawings(); }
  updateLegend(); UI.replayBar();
}
function replayPlay() { const R = C.replay; if (!R) return; replayPause(); R.timer = setInterval(() => replayStep(1), 1000 / R.speed); UI.replayBar(); }
function replayPause() { const R = C.replay; if (R && R.timer) { clearInterval(R.timer); R.timer = null; } UI.replayBar && C.replay && UI.replayBar(); }
function stopReplay(silent) {
  if (!C.replay) return; replayPause(); const tr = C.replay.trades;
  if (tr.length) { const j = Store.get('journal', []); tr.forEach(x => j.push(Object.assign({ mode: 'replay', sym: C.sym.n, tf: C.tf }, x))); Store.set('journal', j.slice(-500)); }
  C.replay = null; $('#replayBar').classList.add('hide');
  try { C.chart.removeOverlay({ groupId: 'trade' }); } catch (e) { }
  if (!silent) loadData();
}
function paperOrder(side) {
  const R = C.replay; if (!R) return; const k = R.all[R.idx], p = k.close;
  if (R.pos && R.pos.side !== side) { paperClose(); return; }
  if (R.pos) { toast('Position already open'); return; }
  const sl = parseFloat(prompt('Stop loss price (empty = none)', '')) || null, tp = parseFloat(prompt('Target price (empty = none)', '')) || null;
  R.pos = { side, entry: p, t: k.timestamp, sl, tp, qty: 1 };
  C.chart.createOverlay({ name: 'cmTrade', groupId: 'trade', lock: true, extendData: { side, label: side === 'buy' ? 'Buy' : 'Sell' }, points: [{ timestamp: k.timestamp, dataIndex: R.idx, value: side === 'buy' ? k.low : k.high }] });
  UI.replayBar();
}
function paperClose(price, why) {
  const R = C.replay; if (!R || !R.pos) return; const k = R.all[R.idx], p = price || k.close, P = R.pos;
  const pnl = (P.side === 'buy' ? p - P.entry : P.entry - p) * P.qty;
  R.trades.push({ side: P.side, entry: P.entry, exit: p, t1: P.t, t2: k.timestamp, pnl, pct: pnl / P.entry * 100, why: why || 'Manual' });
  C.chart.createOverlay({ name: 'cmTrade', groupId: 'trade', lock: true, extendData: { side: P.side === 'buy' ? 'sell' : 'buy', label: (pnl >= 0 ? '+' : '') + fmt(pnl, decimals(p)) }, points: [{ timestamp: k.timestamp, dataIndex: R.idx, value: P.side === 'buy' ? k.high : k.low }] });
  R.pos = null; UI.replayBar();
}
function checkPaperStops() {
  const R = C.replay; if (!R || !R.pos) return; const k = R.all[R.idx], P = R.pos;
  if (P.side === 'buy') { if (P.sl && k.low <= P.sl) paperClose(P.sl, 'Stop loss'); else if (P.tp && k.high >= P.tp) paperClose(P.tp, 'Target'); }
  else { if (P.sl && k.high >= P.sl) paperClose(P.sl, 'Stop loss'); else if (P.tp && k.low <= P.tp) paperClose(P.tp, 'Target'); }
}
function tradeStats(tr) {
  const w = tr.filter(t => t.pnl > 0), l = tr.filter(t => t.pnl <= 0), gp = w.reduce((s, t) => s + t.pnl, 0), gl = -l.reduce((s, t) => s + t.pnl, 0);
  let eq = 0, peak = 0, dd = 0; tr.forEach(t => { eq += t.pct; peak = Math.max(peak, eq); dd = Math.min(dd, eq - peak); });
  return { n: tr.length, win: tr.length ? w.length / tr.length * 100 : 0, pf: gl ? gp / gl : gp ? Infinity : 0, net: gp - gl, netPct: tr.reduce((s, t) => s + t.pct, 0), dd };
}

/* ---------- analysis: technicals + pivots ---------- */
function technicals() {
  const d = C.list; if (d.length < 50) return null;
  const c = d.map(k => k.close), last = c[c.length - 1], L = a => a[a.length - 1], out = [];
  const sig = (n, v, s) => out.push({ n, v, s });
  const r = L(TA.rsi(c, 14)); sig('RSI (14)', r, r < 30 ? 1 : r > 70 ? -1 : 0);
  const st = TA.stoch(c, d.map(k => k.high), d.map(k => k.low), 14), K = L(TA.sma(st, 3)); sig('Stochastic %K (14,3)', K, K < 20 ? 1 : K > 80 ? -1 : 0);
  const e12 = TA.ema(c, 12), e26 = TA.ema(c, 26), macd = e12.map((v, i) => v == null || e26[i] == null ? null : v - e26[i]), sg = TA.ema(macd, 9), mh = L(macd) - L(sg); sig('MACD (12,26)', L(macd), mh > 0 ? 1 : -1);
  const cci = (() => { const tp = d.map(k => (k.high + k.low + k.close) / 3), m = TA.sma(tp, 20); const i = tp.length - 1; let md = 0; for (let j = 0; j < 20; j++) md += Math.abs(tp[i - j] - m[i]); md /= 20; return (tp[i] - m[i]) / (0.015 * md); })(); sig('CCI (20)', cci, cci < -100 ? 1 : cci > 100 ? -1 : 0);
  [10, 20, 30, 50, 100, 200].forEach(n => { if (c.length > n) { const s = L(TA.sma(c, n)), e = L(TA.ema(c, n)); sig('SMA (' + n + ')', s, last > s ? 1 : -1); sig('EMA (' + n + ')', e, last > e ? 1 : -1); } });
  const score = out.reduce((s, x) => s + x.s, 0) / out.length;
  const label = score > 0.5 ? 'Strong buy' : score > 0.1 ? 'Buy' : score < -0.5 ? 'Strong sell' : score < -0.1 ? 'Sell' : 'Neutral';
  return { out, score, label, buy: out.filter(x => x.s > 0).length, sell: out.filter(x => x.s < 0).length, neu: out.filter(x => !x.s).length };
}
function pivots() {
  const d = C.list; if (!d.length) return null;
  const day = k => Math.floor((k.timestamp + 19800000) / 864e5), today = day(d[d.length - 1]);
  let prev = d.filter(k => day(k) === today - 1); let back = 1;
  while (!prev.length && back < 6) { back++; prev = d.filter(k => day(k) === today - back); }
  if (tfObj(C.tf).ms >= 864e5) prev = [d[d.length - 2]];
  if (!prev.length || !prev[0]) return null;
  const H = Math.max(...prev.map(k => k.high)), Lo = Math.min(...prev.map(k => k.low)), Cl = prev[prev.length - 1].close, P = (H + Lo + Cl) / 3;
  return { P, R1: 2 * P - Lo, S1: 2 * P - H, R2: P + (H - Lo), S2: P - (H - Lo), R3: H + 2 * (P - Lo), S3: Lo - 2 * (H - P) };
}
function showPivots(on) {
  try { C.chart.removeOverlay({ groupId: 'piv' }); } catch (e) { }
  if (!on) return; const p = pivots(); if (!p) return; const last = C.list[C.list.length - 1];
  Object.entries(p).forEach(([k, v]) => C.chart.createOverlay({ name: 'horizontalStraightLine', groupId: 'piv', lock: true, points: [{ timestamp: last.timestamp, dataIndex: C.list.length - 1, value: v }], styles: { line: { color: k === 'P' ? '#f59e0b' : k[0] === 'R' ? '#f23645' : '#089981', style: 'dashed', dashedValue: [6, 4], size: 1 } } }));
}


/* ---------- self-heal: chart always matches the live data ---------- */
function selfHeal() {
  if (!C.chart || !C.sym || C.replay || !C.list.length || document.hidden) return;
  try {
    const dl = C.chart.getDataList(), a = dl[dl.length - 1], b = C.list[C.list.length - 1];
    if (!a || a.timestamp !== b.timestamp || (settings().chartType !== 'heikin' && a.close !== b.close && !drawT)) {
      C.chart.applyNewData(viewData(C.list), C.sym.src === 'bn'); restoreDrawings(); drawAlertLines();
    }
    // crypto runs 24/7: if the newest candle is far behind the clock, reload
    if (C.sym.src === 'bn' && Date.now() - b.timestamp > tfObj(C.tf).ms * 3 + 60000) loadData();
  } catch (e) { }
}

/* ---------- indicator legend icons: hide / settings / remove (right on the chart) ---------- */
function indicatorIcon(d) {
  const name = d.indicatorName, pane = d.paneId;
  if (name === 'CMP') { if (d.iconId === 'cm_del') setCompare(null); return; }
  const meta = IND_LIST.find(i => i.id === name), rec = C.ind[name];
  if (d.iconId === 'cm_del') { removeIndicator(name); toast((meta ? meta.name : name) + ' removed'); }
  else if (d.iconId === 'cm_vis') { if (!rec) return; rec.hide = !rec.hide; C.chart.overrideIndicator({ name, visible: !rec.hide }, pane); saveIndicators(); }
  else if (d.iconId === 'cm_set') UI.indSettings(name);
}

/* ---------- touch gestures like TradingView ----------
   drag the price scale up/down = squeeze/stretch candles · double-tap it = auto
   drag the time scale = zoom · drag a pane's top edge = resize · after manual scale, drag chart up/down = move */
function chartPanes() { return ['candle_pane'].concat([...new Set(Object.values(C.ind).map(i => i.pane).filter(p => p && p !== 'candle_pane'))]); }
function yAxisOf(id) { try { const p = C.chart.getDrawPaneById(id); return p && p.getAxisComponent(); } catch (e) { return null; } }
function setYRange(ax, from, to) {
  ax.setRange({ from, to, range: to - from, realFrom: ax.convertToRealValue(from), realTo: ax.convertToRealValue(to), realRange: ax.convertToRealValue(to) - ax.convertToRealValue(from) });
  C.chart.adjustPaneViewport(false, true, true, true);
  updateAutoChip(); placeCountdown();
}
function resetAuto() {
  chartPanes().forEach(id => { const ax = yAxisOf(id); if (ax && !ax.getAutoCalcTickFlag()) ax.setAutoCalcTickFlag(true); });
  try { C.chart.adjustPaneViewport(false, true, true, true); } catch (e) { }
  updateAutoChip(); placeCountdown();
}
function updateAutoChip() {
  let chip = $('#autoChip');
  if (!chip) { chip = document.createElement('button'); chip.id = 'autoChip'; chip.className = 'autochip hide'; chip.textContent = 'Auto'; chip.onclick = resetAuto; $('#cwrap').appendChild(chip); }
  const manual = chartPanes().some(id => { const ax = yAxisOf(id); return ax && !ax.getAutoCalcTickFlag(); });
  chip.classList.toggle('hide', !manual);
}
function setupGestures() {
  const el = $('#chart'); let g = null, lastAxisTap = 0;
  const pt = t => { const r = el.getBoundingClientRect(); return { x: t.clientX - r.left, y: t.clientY - r.top }; };
  const paneAt = y => { for (const id of chartPanes()) { const b = C.chart.getSize(id); if (b && y >= b.top && y < b.top + b.height) return { id, b }; } return null; };
  el.addEventListener('touchstart', e => {
    g = null; if (e.touches.length !== 1 || !C.chart) return;
    const p = pt(e.touches[0]), pane = paneAt(p.y), xb = C.chart.getSize('x_axis_pane');
    if (xb && p.y >= xb.top) { g = { m: 'x', x: p.x, x0: p.x }; }
    else if (pane) {
      const yb = C.chart.getSize(pane.id, 'yAxis');
      if (pane.id !== 'candle_pane' && Math.abs(p.y - pane.b.top) < 11) g = { m: 'h', id: pane.id, h0: pane.b.height, y0: p.y };
      else if (yb && p.x >= yb.left) { const ax = yAxisOf(pane.id); if (ax) { const r = ax.getRange(); g = { m: 'y', ax, r: Object.assign({}, r), y0: p.y, t0: Date.now(), moved: false, h: pane.b.height }; } }
      else { const ax = yAxisOf(pane.id); if (ax && !ax.getAutoCalcTickFlag() && !C.tool) { g = { m: 'pan', ax, y: p.y, h: pane.b.height, pass: true }; } }
    }
    if (g && !g.pass) { e.stopPropagation(); }
  }, { capture: true, passive: true });
  el.addEventListener('touchmove', e => {
    if (!g || e.touches.length !== 1) return;
    const p = pt(e.touches[0]);
    if (g.m === 'y') {
      const dy = p.y - g.y0; if (Math.abs(dy) > 4) g.moved = true;
      const k = Math.exp(dy / 160), mid = (g.r.from + g.r.to) / 2, half = g.r.range * k / 2;
      setYRange(g.ax, mid - half, mid + half);
    } else if (g.m === 'x') {
      const dx = p.x - g.x; g.x = p.x; if (dx) C.chart.zoomAtCoordinate(Math.exp(dx / 120), { x: g.x0, y: 0 });
    } else if (g.m === 'h') {
      C.chart.setPaneOptions({ id: g.id, height: Math.max(40, Math.min(420, Math.round(g.h0 - (p.y - g.y0)))) }); placeCountdown();
    } else if (g.m === 'pan') {
      const dy = p.y - g.y; g.y = p.y; const r = g.ax.getRange(); const d = r.range * dy / g.h; setYRange(g.ax, r.from + d, r.to + d); return;
    }
    if (e.cancelable) e.preventDefault(); e.stopPropagation();
  }, { capture: true, passive: false });
  el.addEventListener('touchend', e => {
    if (g && g.m === 'y' && !g.moved) { const now = Date.now(); if (now - lastAxisTap < 350) { resetAuto(); lastAxisTap = 0; } else lastAxisTap = now; }
    if (g && g.m === 'h') { const h = Store.get('paneH', {}); Object.keys(C.ind).forEach(n => { const b = C.chart.getSize(C.ind[n].pane); if (b && C.ind[n].pane !== 'candle_pane') h[n] = b.height; }); Store.set('paneH', h); }
    if (g && !g.pass) e.stopPropagation();
    g = null;
  }, { capture: true });
  el.addEventListener('dblclick', e => { const r = el.getBoundingClientRect(), x = e.clientX - r.left, yb = C.chart.getSize('candle_pane', 'yAxis'); if (yb && x >= yb.left) resetAuto(); });
}
