// Real-browser test of the web app with the real chart library. Fails the build on any page error.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 400, height: 860 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  const now = Date.now(), step = 15 * 60000, kl = []; let px = 4000;
  for (let i = 0; i < 800; i++) { const o = px; px += Math.sin(i / 9) * 4 + (Math.random() - 0.5) * 3; const t = Math.floor((now - (800 - i) * step) / step) * step; kl.push([t, o.toFixed(2), (Math.max(o, px) + 2).toFixed(2), (Math.min(o, px) - 2).toFixed(2), px.toFixed(2), '120']); }
  await p.route('**/*', r => {
    const u = r.request().url();
    if (u.startsWith('file:')) return r.continue();
    if (u.includes('/klines')) return r.fulfill({ body: JSON.stringify(kl), contentType: 'application/json' });
    if (u.includes('ticker/24hr')) return r.fulfill({ body: JSON.stringify([{ symbol: 'PAXGUSDT', lastPrice: px.toFixed(2), prevClosePrice: '3990', priceChange: '10', priceChangePercent: '0.2', highPrice: '4100', lowPrice: '3900', volume: '10', quoteVolume: '30000000' }]), contentType: 'application/json' });
    return r.fulfill({ status: 500, body: 'offline' });
  });
  await p.goto('file://' + process.cwd() + '/site/index.html');
  await p.waitForTimeout(2500);
  const res = await p.evaluate(async () => {
    const out = {};
    const err = (k, e) => { out[k] = 'ERR ' + (e && e.message || e); };
    try { out.dataLen = C.chart.getDataList().length; out.listLen = C.list.length; } catch (e) { err('data', e); }
    // live updates must reach the chart
    try { const l = C.list[C.list.length - 1]; const ms = tfObj(C.tf).ms; pushBase({ timestamp: l.timestamp + ms, open: l.close, high: l.close + 3, low: l.close - 1, close: l.close + 2, volume: 5 }); drawNow(); await new Promise(r => setTimeout(r, 300)); const dl = C.chart.getDataList(); out.liveOk = dl[dl.length - 1].timestamp === C.list[C.list.length - 1].timestamp && dl.length === C.list.length; } catch (e) { err('live', e); }
    // every indicator
    out.ind = {}; for (const i of IND_LIST) { try { addIndicator(i.id); out.ind[i.id] = !!C.ind[i.id]; } catch (e) { out.ind[i.id] = 'ERR ' + e.message; } }
    await new Promise(r => setTimeout(r, 300));
    try { indicatorIcon({ indicatorName: 'RSI', paneId: C.ind.RSI.pane, iconId: 'cm_vis' }); indicatorIcon({ indicatorName: 'RSI', paneId: C.ind.RSI.pane, iconId: 'cm_vis' }); indicatorIcon({ indicatorName: 'CCI', paneId: C.ind.CCI.pane, iconId: 'cm_del' }); out.iconsOk = !C.ind.CCI; } catch (e) { err('icons', e); }
    for (const i of IND_LIST) { if (!['VOL', 'RSI', 'STOCHRSI'].includes(i.id)) try { removeIndicator(i.id); } catch (e) { } }
    // y-axis scale + auto
    try { const ax = yAxisOf('candle_pane'); const r = ax.getRange(); setYRange(ax, r.from - r.range * 0.3, r.to + r.range * 0.3); out.manual = !ax.getAutoCalcTickFlag(); resetAuto(); out.auto = ax.getAutoCalcTickFlag(); } catch (e) { err('yaxis', e); }
    try { C.chart.zoomAtCoordinate(1.3, { x: 150, y: 0 }); const id = C.ind.RSI.pane; C.chart.setPaneOptions({ id, height: 160 }); out.paneH = C.chart.getSize(id).height; } catch (e) { err('zoom', e); }
    // every drawing tool with real points
    out.tools = {}; const n = C.list.length;
    for (const t of TOOLS) {
      try {
        const pts = [0, 1, 2].map(k => ({ timestamp: C.list[n - 40 + k * 12].timestamp, dataIndex: n - 40 + k * 12, value: C.list[n - 40 + k * 12].close + (k - 1) * 8 }));
        const id = C.chart.createOverlay({ name: t.id, groupId: 'draw', points: pts, extendData: { text: 'Test' } });
        out.tools[t.id] = !!id;
      } catch (e) { out.tools[t.id] = 'ERR ' + e.message; }
    }
    await new Promise(r => setTimeout(r, 400));
    try { C.chart.removeOverlay({ groupId: 'draw' }); } catch (e) { err('rmov', e); }
    try { await startReplay(null); replayStep(1); replayStep(1); replayStep(-1); stopReplay(true); out.replay = true; } catch (e) { err('replay', e); }
    try { UI.hub(); UI.hubAct('tech'); UI.hubAct('pivots'); UI.indSettings('RSI'); UI.close(); out.ui = true; } catch (e) { err('ui', e); }
    try { selfHeal(); out.heal = true; } catch (e) { err('heal', e); }
    return out;
  });
  await p.evaluate(() => { const ax = yAxisOf('candle_pane'); }).catch(() => {});
  await p.screenshot({ path: 'smoke.png' });
  console.log(JSON.stringify(res, null, 1));
  const bad = [];
  if (!(res.dataLen > 100)) bad.push('chart has no data');
  if (res.liveOk !== true) bad.push('live update did not reach chart');
  Object.entries(res.ind || {}).forEach(([k, v]) => { if (v !== true) bad.push('indicator ' + k + ': ' + v); });
  Object.entries(res.tools || {}).forEach(([k, v]) => { if (v !== true) bad.push('tool ' + k + ': ' + v); });
  ['manual', 'auto', 'replay', 'ui', 'heal', 'iconsOk'].forEach(k => { if (res[k] !== true) bad.push(k + ': ' + res[k]); });
  Object.entries(res).forEach(([k, v]) => { if (typeof v === 'string' && v.startsWith('ERR')) bad.push(k + ' ' + v); });
  errs.filter(e => !/offline|Failed to load resource|ERR_|Proxy|LOGIN/i.test(e)).forEach(e => bad.push(e));
  await b.close();
  if (bad.length) { console.log('FAILED:\n' + bad.join('\n')); process.exit(1); }
  console.log('SMOKE OK');
})();
