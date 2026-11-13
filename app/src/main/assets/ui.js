/* ChartMitra screens and sheets. */
'use strict';
const UI = {
  cur: 'chart',
  page(p) {
    this.cur = p;
    $$('.page').forEach(e => e.classList.toggle('on', e.id === 'pg-' + p));
    $$('#nav button').forEach(b => b.classList.toggle('on', b.dataset.p === p));
    if (p === 'chart') setTimeout(() => { C.chart && C.chart.resize(); placeCountdown(); }, 30);
    if (p === 'watch') renderWatch();
    if (p === 'explore') renderExplore();
    if (p === 'news') renderNews();
    if (p === 'menu') renderMenu();
  },
  open(html, onOpen) {
    $('#shBody').innerHTML = html; paintIcons($('#shBody'));
    $('#shade').classList.remove('hide'); $('#sheet').classList.remove('hide');
    $('#shBody').scrollTop = 0; onOpen && onOpen($('#shBody'));
  },
  close() { $('#shade').classList.add('hide'); $('#sheet').classList.add('hide'); $('#shBody').innerHTML = ''; },
  isOpen() { return !$('#sheet').classList.contains('hide'); },

  /* ----- selected drawing bar ----- */
  showSel(o) {
    const b = $('#selBar'), canLine = LINE_ALERTABLE.includes(o.name), canPrice = PRICE_ALERTABLE.includes(o.name);
    const colors = ['#2962ff', '#131722', '#f23645', '#089981', '#ff9800', '#9c27b0', '#f5e04a'];
    b.innerHTML = colors.map(c => `<button class="ib" data-c="${c}" style="width:30px;height:30px"><span style="width:18px;height:18px;border-radius:50%;background:${c};display:block;border:1px solid var(--ln)"></span></button>`).join('') +
      `<button class="ib" data-w="1">1px</button><button class="ib" data-w="2">2px</button><button class="ib" data-dash>- -</button>` +
      `<span class="sp"></span>` +
      ((canLine || canPrice) ? `<button class="btn" data-alert style="flex:none">${icon('alarm')}Alert</button>` : '') +
      `<button class="ib" data-clone aria-label="Clone">${icon('templates')}</button><button class="ib" data-lock aria-label="Lock">${icon(o.lock ? 'lock' : 'unlock')}</button><button class="ib" data-del aria-label="Delete" style="color:var(--dn)">${icon('trash')}</button>`;
    b.classList.remove('hide');
    b.onclick = ev => {
      const t = ev.target.closest('button'); if (!t) return; const id = o.id;
      if (t.dataset.c) styleDrawing(id, { color: t.dataset.c });
      else if (t.dataset.w) styleDrawing(id, { size: +t.dataset.w });
      else if (t.hasAttribute('data-dash')) { const r = C.dr[id], cur = r && r.styles && r.styles.line && r.styles.line.style; styleDrawing(id, { style: cur === 'dashed' ? 'solid' : 'dashed' }); }
      else if (t.hasAttribute('data-del')) { snapshot(); removeDrawing(id); }
      else if (t.hasAttribute('data-clone')) cloneDrawing(id);
      else if (t.hasAttribute('data-lock')) { const r = C.dr[id]; if (r) { r.lock = !r.lock; C.chart.overrideOverlay({ id, lock: r.lock }); saveDrawings(); this.showSel(Object.assign({}, o, { lock: r.lock })); } }
      else if (t.hasAttribute('data-alert')) this.alertSheet({ fromDrawing: id });
    };
  },
  hideSel() { $('#selBar').classList.add('hide'); },

  /* ----- replay bar ----- */
  replayBar() {
    const R = C.replay, b = $('#replayBar'); if (!R) { b.classList.add('hide'); return; }
    const k = R.all[R.idx], st = tradeStats(R.trades), P = R.pos;
    const open = P ? (P.side === 'buy' ? k.close - P.entry : P.entry - k.close) : 0;
    b.innerHTML = `<div style="width:100%;display:flex;align-items:center;gap:6px;font-size:12px"><span class="tag hit">Replay</span><b>${fmtTime(k.timestamp, true)}</b><span class="sp"></span>
      <select id="rpSpeed" style="border:1px solid var(--ln);border-radius:8px;padding:4px;background:var(--bg)">${[0.25, 0.5, 1, 2, 3, 5, 10, 20, 50].map(s => `<option ${s === R.speed ? 'selected' : ''} value="${s}">${s}x</option>`).join('')}</select>
      <button class="ib" id="rpExit" aria-label="Exit replay">${icon('x')}</button></div>
      <button class="ib" id="rpDate" aria-label="Jump to date">${icon('replay')}</button><button class="ib" id="rpPrev" aria-label="Previous candle">${icon('prev')}</button>
      <button class="ib" id="rpPlay" style="background:var(--fg);color:var(--bg)" aria-label="Play">${icon(R.timer ? 'pause' : 'play')}</button><button class="ib" id="rpNext" aria-label="Next candle">${icon('next')}</button>
      <button class="btn buy" id="rpBuy">${P && P.side === 'sell' ? 'Close' : 'Buy'}</button><button class="btn sell" id="rpSell">${P && P.side === 'buy' ? 'Close' : 'Sell'}</button>
      <div style="width:100%;font-size:12px;color:var(--mu)">${P ? `Open ${P.side} @ ${fmt(P.entry)} · P&L <b class="${open >= 0 ? 'up' : 'dn'}">${fmt(open, decimals(P.entry))}</b> · ` : ''}Trades ${st.n} · Win ${st.win.toFixed(0)}% · PF ${isFinite(st.pf) ? st.pf.toFixed(2) : '∞'} · Net <b class="${st.netPct >= 0 ? 'up' : 'dn'}">${st.netPct.toFixed(2)}%</b> · Max DD ${st.dd.toFixed(2)}%</div>`;
    b.classList.remove('hide');
    $('#rpSpeed').onchange = e => { R.speed = +e.target.value; if (R.timer) replayPlay(); };
    $('#rpExit').onclick = () => stopReplay();
    $('#rpPrev').onclick = () => { replayPause(); replayStep(-1); };
    $('#rpNext').onclick = () => { replayPause(); replayStep(1); };
    $('#rpPlay').onclick = () => R.timer ? replayPause() : replayPlay();
    $('#rpBuy').onclick = () => paperOrder('buy');
    $('#rpSell').onclick = () => paperOrder('sell');
    $('#rpDate').onclick = () => this.replayStart();
  },
  replayStart() {
    const d = new Date(Date.now() - 864e5 * 3), v = new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 16);
    this.open(`<h2>Bar Replay</h2><div class="hint" style="margin-top:-6px">Pick a start. Future candles stay hidden; press Next for exactly one candle.</div>
      <div class="lbl">Start date and time</div><input type="datetime-local" class="inp" id="rpWhen" value="${v}">
      <div class="pad"><button class="btn pri full" id="rpGo">Start replay</button><button class="btn full" id="rpRecent" style="margin-top:8px">Start from 150 candles ago</button></div>`, () => {
      $('#rpGo').onclick = () => { const t = Date.parse($('#rpWhen').value); this.close(); startReplay(t); };
      $('#rpRecent').onclick = () => { this.close(); startReplay(null); };
    });
  },

  /* ----- symbol search ----- */
  symbolSheet(onPick) {
    const recent = Store.get('recent', []);
    this.open(`<h2>Symbol search</h2><div class="srch">${icon('search')}<input id="sq" placeholder="NIFTY, RELIANCE, BTC, GOLD…" autocomplete="off"></div>
      <div class="chips" id="sqCat"><span class="chip on" data-c="all">All</span><span class="chip" data-c="in">India</span><span class="chip" data-c="crypto">Crypto</span><span class="chip" data-c="gold">Commodities</span><span class="chip" data-c="us">US</span></div><div id="sqRes"></div>`, root => {
      const res = $('#sqRes'), inp = $('#sq'); let cat = 'all', tmr;
      const row = s => `<div class="row" data-k="${esc(symKey(s))}">${symIcon(s)}<div class="l"><b>${esc(s.n)}</b><small>${esc(s.d)}</small></div><small>${esc(s.x)}</small></div>`;
      let shown = [];
      const show = list => { shown = list; res.innerHTML = list.length ? list.map(row).join('') : '<div class="empty">No results</div>'; };
      const base = () => { const all = allSymbols(); const r = recent.filter(x => !all.find(a => symKey(a) === symKey(x))); return r.concat(all).filter(s => cat === 'all' || s.cat === cat || (cat === 'gold' && ['gold', 'silver', 'other'].includes(s.cat))); };
      show(base());
      $('#sqCat').onclick = e => { const c = e.target.closest('.chip'); if (!c) return; cat = c.dataset.c; $$('#sqCat .chip').forEach(x => x.classList.toggle('on', x === c)); inp.value ? inp.oninput() : show(base()); };
      inp.oninput = () => { clearTimeout(tmr); const q = inp.value; if (!q) return show(base()); res.innerHTML = '<div class="empty">Searching…</div>';
        tmr = setTimeout(async () => { const r = await searchSymbols(q); if (inp.value !== q) return; if (r.find(x => x.needLogin)) toast('Log in (Menu → Account) to search NSE on the website'); show(r.filter(x => !x.needLogin && (cat === 'all' || x.cat === cat || (cat === 'gold' && ['gold', 'silver', 'other'].includes(x.cat))))); }, 350); };
      res.onclick = e => { const r = e.target.closest('.row'); if (!r) return; const s = shown.find(x => symKey(x) === r.dataset.k); if (!s) return;
        const rc = [s].concat(recent.filter(x => symKey(x) !== symKey(s))).slice(0, 12); Store.set('recent', rc, true); this.close(); onPick(s); };
      setTimeout(() => inp.focus(), 200);
    });
  },

  /* ----- interval sheet ----- */
  intervalSheet() {
    const fav = favTfs(), crypto = C.sym.src === 'bn';
    const pill = k => { const t = tfObj(k), dis = t.cryptoOnly && !crypto; return `<div class="pill ${k === C.tf ? 'on' : ''} ${dis ? 'dis' : ''}" data-k="${k}">${k}${fav.includes(k) ? '<span class="star">★</span>' : ''}</div>`; };
    const grp = (n, ks) => `<div class="grp">${n}</div><div class="pills">${ks.map(pill).join('')}</div>`;
    this.open(`<h3>Date range</h3><div class="pills" id="drange">${['1D', '5D', '1M', '3M', '6M', 'YTD', '1Y', '5Y'].map(r => `<div class="pill" data-r="${r}">${r}</div>`).join('')}</div><div class="sline"></div>
      <h3>Interval</h3><div class="hint" style="margin-top:-6px">Tap to open · long-press to add or remove a favorite ★</div>
      ${grp('Favorites', fav)}${grp('Seconds' + (crypto ? '' : ' (crypto only)'), ['1s', '5s', '15s', '30s'])}${grp('Minutes', ['1m', '3m', '5m', '10m', '15m', '30m', '45m'])}${grp('Hours', ['1h', '2h', '4h'])}${grp('Days', ['1D', '1W', '1M'])}`, root => {
      let lp = null, longp = false;
      root.addEventListener('touchstart', e => { const p = e.target.closest('.pill[data-k]'); if (!p) return; longp = false; lp = setTimeout(() => { longp = true; toggleFav(p.dataset.k); }, 550); }, { passive: true });
      root.addEventListener('touchend', () => clearTimeout(lp));
      root.addEventListener('contextmenu', e => { const p = e.target.closest('.pill[data-k]'); if (p) { e.preventDefault(); longp = true; toggleFav(p.dataset.k); } });
      const toggleFav = k => { let f = favTfs(); f = f.includes(k) ? f.filter(x => x !== k) : f.concat(k).sort((a, b) => tfObj(a).ms - tfObj(b).ms); Store.set('favtf', f); this.intervalSheet(); updateWheels(); };
      root.onclick = e => {
        if (longp) { longp = false; return; }
        const p = e.target.closest('.pill[data-k]');
        if (p) { if (p.classList.contains('dis')) { toast('Seconds charts need tick data, free only for crypto'); return; } this.close(); C.tf = p.dataset.k; updateWheels(); loadData(); Store.set('last', { sym: C.sym, tf: C.tf }, true); return; }
        const r = e.target.closest('.pill[data-r]'); if (r) { this.close(); dateRange(r.dataset.r); }
      };
    });
  },

  /* ----- drawings sheet ----- */
  drawSheet(tab) {
    tab = tab || Store.get('drawTab', 'Favorites');
    const favs = Store.get('favtools', ['parallelStraightLine', 'rayLine', 'horizontalStraightLine', 'segment', 'horizontalRayLine', 'cmFib', 'cmFibExt', 'cmLong', 'cmShort', 'cmVP']);
    const tabs = ['Favorites', 'Tools', 'Trend tools', 'Gann and Fib', 'Forecasting and measurement', 'Shapes and text'];
    const tile = t => `<div class="tile f" data-t="${t.id}">${icon(t.i)}${esc(t.n)}${favs.includes(t.id) ? '<span class="star">★</span>' : ''}</div>`;
    const grid = list => `<div class="tiles t3">${list.map(tile).join('')}</div>`;
    let body = '';
    if (tab === 'Favorites') {
      const groups = [...new Set(TOOLS.filter(t => favs.includes(t.id)).map(t => t.g))];
      body = groups.length ? groups.map(g => `<div class="grp">${g}</div>${grid(TOOLS.filter(t => t.g === g && favs.includes(t.id)))}`).join('') : '<div class="empty">Long-press any tool to add it here</div>';
      body += `<div class="irow" style="margin-top:14px">${icon('pencil')}<div class="n">Show favorites on Chart</div><span class="sw ${settings().favbar ? 'on' : ''}" id="favSw"></span></div>`;
    } else if (tab === 'Tools') {
      const s = settings(), hide = Store.get('hideAll', false), lock = Store.get('lockAll', false);
      body = `<div class="tiles t3">
        <div class="tile f" data-a="measure">${icon('ruler')}Measure</div><div class="tile ${C.eraser ? 'on' : 'f'}" data-a="eraser">${icon('eraser')}Eraser</div><div class="tile ${s.keepDraw ? 'on' : ''}" data-a="keep">${icon('keep')}Keep drawing</div>
        <div class="tile ${hide ? 'on' : ''}" data-a="hide">${icon(hide ? 'eye' : 'eyeoff')}${hide ? 'Show drawings' : 'Hide drawings'}</div><div class="tile ${lock ? 'on' : ''}" data-a="lock">${icon(lock ? 'lock' : 'unlock')}${lock ? 'Unlock all drawings' : 'Lock all drawings'}</div><div class="tile ${s.magnet ? 'on' : ''}" data-a="magnet">${icon('magnet')}Weak magnet</div>
        <div class="tile" data-a="remove">${icon('trash')}Remove drawings</div><div class="tile" data-a="zin">${icon('zoomin')}Zoom In</div><div class="tile" data-a="zout">${icon('zoomout')}Zoom Out</div></div>`;
    } else body = grid(TOOLS.filter(t => t.g === tab));
    this.open(`<h2>Drawings</h2><div class="srch">${icon('search')}<input id="dq" placeholder="Search"></div><div class="tabs" id="dtabs">${tabs.map(t => `<span class="${t === tab ? 'on' : ''}">${t}</span>`).join('')}</div><div id="dbody">${body}</div>`, root => {
      Store.set('drawTab', tab, true);
      $('#dtabs').onclick = e => { const s = e.target.closest('span'); if (s) this.drawSheet(s.textContent); };
      $('#dq').oninput = e => { const q = e.target.value.toLowerCase(); $('#dbody').innerHTML = q ? grid(TOOLS.filter(t => t.n.toLowerCase().includes(q))) : body; paintIcons($('#dbody')); };
      let lp, longp = false;
      root.addEventListener('touchstart', e => { const t = e.target.closest('[data-t]'); if (!t) return; longp = false; lp = setTimeout(() => { longp = true; favToggle(t.dataset.t); }, 550); }, { passive: true });
      root.addEventListener('touchend', () => clearTimeout(lp));
      root.addEventListener('contextmenu', e => { const t = e.target.closest('[data-t]'); if (t) { e.preventDefault(); longp = true; favToggle(t.dataset.t); } });
      const favToggle = id => { let f = Store.get('favtools', favs); f = f.includes(id) ? f.filter(x => x !== id) : f.concat(id); Store.set('favtools', f); renderFavbar(); this.drawSheet(tab); toast(f.includes(id) ? 'Added to favorites' : 'Removed from favorites'); };
      root.onclick = e => {
        if (longp) { longp = false; return; }
        if (e.target.id === 'favSw') { setSetting('favbar', !settings().favbar); renderFavbar(); this.drawSheet(tab); return; }
        const t = e.target.closest('[data-t]'); if (t) { this.close(); startTool(t.dataset.t); return; }
        const a = e.target.closest('[data-a]'); if (!a) return; const s = settings();
        switch (a.dataset.a) {
          case 'measure': this.close(); startTool('cmDPRange'); return;
          case 'eraser': C.eraser = !C.eraser; hint(C.eraser ? 'Eraser on: tap a drawing to remove it' : ''); if (C.eraser) this.close(); else this.drawSheet(tab); return;
          case 'keep': setSetting('keepDraw', !s.keepDraw); break;
          case 'hide': { const h = !Store.get('hideAll', false); Store.set('hideAll', h); allDrawings({ visible: !h }); break; }
          case 'lock': { const l = !Store.get('lockAll', false); Store.set('lockAll', l); allDrawings({ lock: l }); break; }
          case 'magnet': setSetting('magnet', !s.magnet); allDrawings({ mode: !s.magnet ? 'weak_magnet' : 'normal' }); break;
          case 'remove': if (confirm('Remove all drawings on ' + C.sym.n + '?')) removeAllDrawings(); break;
          case 'zin': C.chart.zoomAtCoordinate(1.25); return;
          case 'zout': C.chart.zoomAtCoordinate(0.8); return;
        }
        this.drawSheet(tab);
      };
    });
  },

  /* ----- indicators ----- */
  indSheet(cat) {
    cat = cat || 'Active';
    const cats = ['Active', 'All', 'Trend', 'Momentum', 'Volatility', 'Volume'];
    const list = cat === 'Active' ? IND_LIST.filter(i => C.ind[i.id]) : cat === 'All' ? IND_LIST : IND_LIST.filter(i => i.cat === cat);
    const row = i => `<div class="irow" data-id="${i.id}"><div class="n">${esc(i.name)}<small>${i.cat}${i.main ? ' · on price' : ''}${C.ind[i.id] && indicatorParams(i.id) ? ' · ' + indicatorParams(i.id).join(', ') : ''}</small></div>${C.ind[i.id] ? `<button class="ib" data-set aria-label="Settings">${icon('gear')}</button>` : ''}<span class="sw ${C.ind[i.id] ? 'on' : ''}" data-sw></span></div>`;
    const tpl = Store.get('indTpl', []);
    this.open(`<h2>Indicators</h2><div class="srch">${icon('search')}<input id="iq" placeholder="Search indicators"></div><div class="tabs" id="itabs">${cats.map(c => `<span class="${c === cat ? 'on' : ''}">${c}</span>`).join('')}</div>
      <div id="ibody">${list.length ? list.map(row).join('') : '<div class="empty">No indicators on the chart</div>'}</div>
      <div class="grp">Templates</div><div class="pad" style="display:flex;gap:8px;flex-wrap:wrap">${tpl.map((t, i) => `<span class="chip" data-tpl="${i}">${esc(t.name)}</span>`).join('')}<span class="chip" id="tplSave">+ Save current</span></div>`, root => {
      $('#itabs').onclick = e => { const s = e.target.closest('span'); if (s) this.indSheet(s.textContent); };
      $('#iq').oninput = e => { const q = e.target.value.toLowerCase(); $('#ibody').innerHTML = IND_LIST.filter(i => i.name.toLowerCase().includes(q) || i.id.toLowerCase().includes(q)).map(row).join(''); paintIcons($('#ibody')); };
      root.onclick = e => {
        if (e.target.id === 'tplSave') { const n = prompt('Template name', 'My indicators'); if (!n) return; tpl.push({ name: n, cfg: Object.keys(C.ind).map(k => ({ n: k, p: C.ind[k].p })) }); Store.set('indTpl', tpl); this.indSheet(cat); return; }
        const tp = e.target.closest('[data-tpl]'); if (tp) { setIndicators(tpl[+tp.dataset.tpl].cfg); this.indSheet('Active'); return; }
        const r = e.target.closest('.irow'); if (!r) return; const id = r.dataset.id;
        if (e.target.closest('[data-set]')) { const cur = indicatorParams(id) || []; const v = prompt('Inputs (comma separated)', cur.join(', ')); if (v == null) return; const p = v.split(',').map(x => parseFloat(x)).filter(x => !isNaN(x)); if (p.length) setIndicatorParams(id, p); this.indSheet(cat); return; }
        C.ind[id] ? removeIndicator(id) : addIndicator(id); this.indSheet(cat);
      };
    });
  },

  /* ----- analysis hub ----- */
  hub() {
    const act = Alerts.list().filter(a => a.active).length;
    this.open(`<h2>Analysis hub</h2><div class="tiles t3">
      <div class="tile" data-h="layout">${icon('square')}Layout setup</div><div class="tile" data-h="layouts">${icon('layouts')}Manage layouts</div><div class="tile" data-h="settings">${icon('gear')}Chart settings</div>
      <div class="tile" data-h="new">${icon('newchart')}New</div><div class="tile" data-h="save">${icon('save')}Save</div><div class="tile" data-h="openl">${icon('folder')}Open</div></div>
      <div class="pad" style="margin-top:14px"><div class="tile" data-h="broker" style="border:1.5px solid transparent;background:linear-gradient(var(--sheet),var(--sheet)) padding-box,linear-gradient(90deg,#e91e63,#2962ff) border-box;min-height:70px">${icon('broker')}Trade with your broker</div></div>
      <div class="grp">Tools</div><div class="tiles t2">
      <div class="tile f" data-h="ind">${icon('indicators')}Indicators</div><div class="tile f" data-h="compare">${icon('compare')}Compare</div>
      <div class="tile f" data-h="alerts">${icon('alarm')}Alerts${act ? '<span class="dot"></span>' : ''}</div><div class="tile f" data-h="replay">${icon('replay')}Bar Replay</div></div>
      <div class="tiles t3" style="margin-top:9px"><div class="tile f" data-h="tpl">${icon('templates')}Indicator templates</div><div class="tile f" data-h="ctype">${icon('candle')}Chart type</div><div class="tile f" data-h="tree">${icon('layers')}Object Tree</div></div>
      <div class="grp">Info</div><div class="tiles t2">
      <div class="tile f" data-h="details">${icon('info')}Symbol details</div><div class="tile f ${C.sym.cat === 'in' && !/^\^/.test(C.sym.s) ? '' : 'dis'}" data-h="fin">${icon('fin')}Financials</div>
      <div class="tile f" data-h="pivots">${icon('forecast')}Pivot points</div><div class="tile f" data-h="tech">${icon('gauge')}Technicals</div>
      <div class="tile f" data-h="shot">${icon('share')}Share snapshot</div><div class="tile f" data-h="export">${icon('save')}Export data (CSV)</div></div>`, root => {
      root.onclick = e => { const t = e.target.closest('[data-h]'); if (!t || t.classList.contains('dis')) return; this.hubAct(t.dataset.h); };
    });
  },
  hubAct(h) {
    switch (h) {
      case 'ind': return this.indSheet();
      case 'tpl': return this.indSheet('Active');
      case 'alerts': return this.alertsSheet();
      case 'replay': this.close(); return this.replayStart();
      case 'settings': return this.chartSettings();
      case 'layout': return this.chartSettings();
      case 'ctype': return this.chartType();
      case 'tree': return this.objectTree();
      case 'details': return this.details();
      case 'tech': return this.tech();
      case 'pivots': return this.pivotsSheet();
      case 'compare': return this.symbolSheet(s => { setCompare(s); toast('Comparing with ' + s.n); });
      case 'save': { const n = prompt('Layout name', C.sym.n + ' ' + C.tf); if (!n) return; const L = Store.get('layouts', []); L.push({ id: uid(), name: n, sym: C.sym, tf: C.tf, ind: Object.keys(C.ind).map(k => ({ n: k, p: C.ind[k].p })), ct: settings().chartType, t: Date.now() }); Store.set('layouts', L); toast('Layout saved'); return; }
      case 'openl': case 'layouts': return this.layouts();
      case 'new': if (confirm('Start a clean chart (indicators off)?')) { setIndicators([{ n: 'VOL' }]); setCompare(null); this.close(); } return;
      case 'broker': return this.open(`<h2>Trade with your broker</h2><div class="hint" style="font-size:14px">Live orders need your broker's official free API (Angel One SmartAPI, Upstox, Zerodha Kite). This part comes in the next update. Until then use Paper trading in Bar Replay; no real order is ever placed.</div>`);
      case 'fin': return this.open(`<h2>Financials</h2><div class="hint" style="font-size:14px">Free company financials are limited. Open the full report for ${esc(C.sym.n)}:</div><div class="pad"><a class="btn pri full" href="https://www.screener.in/company/${encodeURIComponent(C.sym.s.replace(/\.(NS|BO)$/, ''))}/" target="_blank" style="text-decoration:none">Open on Screener.in</a></div>`);
      case 'shot': { try { const url = C.chart.getConvertPictureUrl(true, 'png', settings().theme === 'dark' ? '#0f1117' : '#ffffff'); const a = document.createElement('a'); a.href = url; a.download = `ChartMitra_${C.sym.n}_${C.tf}.png`; if (NATIVE) { const w = window.open(); w && w.document.write('<img src="' + url + '" style="width:100%">'); toast('Long-press the image to save'); } else a.click(); } catch (e) { toast('Snapshot failed'); } return; }
      case 'export': { const rows = ['time,open,high,low,close,volume'].concat(C.list.map(k => [new Date(k.timestamp).toISOString(), k.open, k.high, k.low, k.close, k.volume].join(','))).join('\n'); if (NATIVE) { Android.share(rows.slice(0, 200000)); } else { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([rows], { type: 'text/csv' })); a.download = `${C.sym.n}_${C.tf}.csv`; a.click(); } return; }
    }
  },
  chartSettings() {
    const s = settings(), sw = (k, n, sub) => `<div class="irow" data-k="${k}"><div class="n">${n}${sub ? `<small>${sub}</small>` : ''}</div><span class="sw ${s[k] ? 'on' : ''}"></span></div>`;
    const tzs = [['Asia/Kolkata', 'India (IST)'], ['UTC', 'UTC'], ['America/New_York', 'New York'], ['Europe/London', 'London'], ['Asia/Dubai', 'Dubai'], ['Asia/Singapore', 'Singapore']];
    this.open(`<h2>Chart settings</h2>
      <div class="irow"><div class="n">Theme</div><span class="chip ${s.theme === 'light' ? 'on' : ''}" data-theme="light">Light</span><span class="chip ${s.theme === 'dark' ? 'on' : ''}" data-theme="dark">Dark</span></div>
      <div class="irow"><div class="n">Time zone</div><select id="tzSel" style="border:1px solid var(--ln);border-radius:8px;padding:6px;background:var(--bg)">${tzs.map(t => `<option value="${t[0]}" ${s.tz === t[0] ? 'selected' : ''}>${t[1]}</option>`).join('')}</select></div>
      ${sw('log', 'Logarithmic scale')}${sw('pct', 'Percentage scale')}${sw('grid', 'Grid lines')}${sw('countdown', 'Countdown to bar close')}${sw('events', 'Economic events on chart', 'High-impact news flags on the time axis')}`, root => {
      root.onclick = e => {
        const th = e.target.closest('[data-theme]'); if (th) { setSetting('theme', th.dataset.theme); applyTheme(); return this.chartSettings(); }
        const r = e.target.closest('[data-k]'); if (!r) return; const k = r.dataset.k, v = !settings()[k];
        setSetting(k, v); if (k === 'log' && v) setSetting('pct', false); if (k === 'pct' && v) setSetting('log', false);
        applyTheme(); if (k === 'events') drawEvents(); placeCountdown(); this.chartSettings();
      };
      $('#tzSel').onchange = e => { setSetting('tz', e.target.value); applyTheme(); };
    });
  },
  chartType() {
    const types = [['candle_solid', 'Candles', 'candle'], ['candle_stroke', 'Hollow candles', 'candle'], ['heikin', 'Heikin Ashi', 'candle'], ['ohlc', 'Bars', 'ind'], ['line', 'Line', 'chart'], ['area', 'Area', 'chart']];
    const cur = settings().chartType;
    this.open(`<h2>Chart type</h2><div class="tiles t3">${types.map(t => `<div class="tile ${t[0] === cur ? 'on' : 'f'}" data-t="${t[0]}">${icon(t[2])}${t[1]}</div>`).join('')}</div>`, root => {
      root.onclick = e => { const t = e.target.closest('[data-t]'); if (!t) return; setSetting('chartType', t.dataset.t); applyTheme(); C.chart.applyNewData(viewData(C.list), C.sym.src === 'bn'); restoreDrawings(); drawAlertLines(); this.close(); };
    });
  },
  objectTree() {
    const dr = Object.values(C.dr), names = Object.keys(C.ind);
    this.open(`<h2>Object Tree</h2><div class="grp">Indicators</div>${names.map(n => `<div class="irow"><div class="n">${esc((IND_LIST.find(i => i.id === n) || {}).name || n)}</div><button class="ib" data-ri="${n}" style="color:var(--dn)">${icon('trash')}</button></div>`).join('') || '<div class="hint">None</div>'}
      <div class="grp">Drawings · ${esc(C.sym.n)}</div>${dr.map(r => `<div class="irow"><div class="n">${esc((toolById(r.name) || {}).n || r.name)}<small>${r.pts[0] ? fmtTime(r.pts[0].t, true) + ' · ' + fmt(r.pts[0].v) : ''}</small></div><button class="ib" data-vis="${r.id}">${icon(r.vis === false ? 'eyeoff' : 'eye')}</button><button class="ib" data-rd="${r.id}" style="color:var(--dn)">${icon('trash')}</button></div>`).join('') || '<div class="hint">No drawings</div>'}`, root => {
      root.onclick = e => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.ri) removeIndicator(b.dataset.ri);
        if (b.dataset.rd) { snapshot(); removeDrawing(b.dataset.rd); }
        if (b.dataset.vis) { const r = C.dr[b.dataset.vis]; r.vis = r.vis === false; C.chart.overrideOverlay({ id: r.id, visible: r.vis }); saveDrawings(); }
        this.objectTree();
      };
    });
  },
  layouts() {
    const L = Store.get('layouts', []);
    this.open(`<h2>Layouts</h2>${L.length ? L.map(l => `<div class="irow" data-id="${l.id}"><div class="n">${esc(l.name)}<small>${esc(l.sym.n)} · ${l.tf} · ${l.ind.length} indicators</small></div><button class="ib" data-del style="color:var(--dn)">${icon('trash')}</button></div>`).join('') : '<div class="empty">No saved layouts. Use Save in the Analysis hub.</div>'}`, root => {
      root.onclick = e => { const r = e.target.closest('.irow'); if (!r) return; const l = L.find(x => x.id === r.dataset.id);
        if (e.target.closest('[data-del]')) { Store.set('layouts', L.filter(x => x.id !== l.id)); return this.layouts(); }
        this.close(); setIndicators(l.ind); if (l.ct) { setSetting('chartType', l.ct); applyTheme(); } openSymbol(l.sym, l.tf); };
    });
  },
  details() {
    const q = quote(C.sym) || {}, m = C.meta || {}, last = C.list[C.list.length - 1] || {};
    const src = C.sym.src === 'bn' ? 'Binance (real-time WebSocket, tick by tick)' : 'Yahoo Finance (refreshed every 2–3 s; NSE/BSE can lag the exchange)';
    const row = (a, b) => `<div class="irow"><div class="n">${a}</div><b style="font-weight:500">${b}</b></div>`;
    this.open(`<h2>${esc(C.sym.n)}</h2><div class="hint" style="margin:-8px 18px 8px;font-size:14px">${esc(C.sym.d)}</div>
      ${row('Exchange', esc(C.sym.x))}${row('Currency', esc(C.sym.cur || m.currency || '—'))}${row('Last', fmt(last.close))}${row('Day high', fmt(q.h || m.regularMarketDayHigh))}${row('Day low', fmt(q.l || m.regularMarketDayLow))}
      ${row('Previous close', fmt(q.pc || m.chartPreviousClose))}${row('Volume', fmtVol(q.v || m.regularMarketVolume || 0))}${m.fiftyTwoWeekHigh ? row('52W high', fmt(m.fiftyTwoWeekHigh)) + row('52W low', fmt(m.fiftyTwoWeekLow)) : ''}
      ${row('Exchange time zone', esc(m.exchangeTimezoneName || (C.sym.src === 'bn' ? 'UTC (24/7)' : '—')))}<div class="hint" style="font-size:13px;margin-top:12px">Data source: ${src}</div>`);
  },
  tech() {
    const t = technicals(); if (!t) return this.open('<h2>Technicals</h2><div class="empty">Need at least 50 candles</div>');
    const c = t.score > 0.1 ? 'up' : t.score < -0.1 ? 'dn' : '';
    this.open(`<h2>Technicals · ${esc(C.sym.n)} ${C.tf}</h2><div class="gauge"><svg viewBox="0 0 200 110" width="220"><path d="M20 100a80 80 0 0 1 160 0" fill="none" stroke="var(--ln)" stroke-width="12"/><line x1="100" y1="100" x2="${100 + 70 * Math.cos(Math.PI * (1 - (t.score + 1) / 2))}" y2="${100 - 70 * Math.sin(Math.PI * (1 - (t.score + 1) / 2))}" stroke="var(--fg)" stroke-width="3" stroke-linecap="round"/><circle cx="100" cy="100" r="5" fill="var(--fg)"/></svg><b class="${c}">${t.label}</b><small class="hint">Sell ${t.sell} · Neutral ${t.neu} · Buy ${t.buy}</small></div>
      ${t.out.map(x => `<div class="irow"><div class="n">${x.n}</div><span>${fmt(x.v, 2)}</span><span class="tag ${x.s > 0 ? 'on' : x.s < 0 ? 'hit' : ''}" style="min-width:56px;text-align:center">${x.s > 0 ? 'Buy' : x.s < 0 ? 'Sell' : 'Neutral'}</span></div>`).join('')}`);
  },
  pivotsSheet() {
    const p = pivots(); if (!p) return this.open('<h2>Pivot points</h2><div class="empty">Not enough data</div>');
    const on = Store.get('pivOn', false);
    this.open(`<h2>Pivot points (Classic)</h2><div class="hint" style="margin:-8px 18px 6px">From the previous session's high, low and close</div>
      ${['R3', 'R2', 'R1', 'P', 'S1', 'S2', 'S3'].map(k => `<div class="irow"><div class="n ${k[0] === 'R' ? 'dn' : k[0] === 'S' ? 'up' : ''}">${k === 'P' ? 'Pivot' : k}</div><b style="font-weight:500">${fmt(p[k])}</b></div>`).join('')}
      <div class="irow"><div class="n">Show on chart</div><span class="sw ${on ? 'on' : ''}" id="pvSw"></span></div>`, () => {
      $('#pvSw').onclick = () => { Store.set('pivOn', !on, true); showPivots(!on); this.pivotsSheet(); };
    });
  },

  /* ----- alerts ----- */
  alertSheet(opt) {
    opt = opt || {};
    const last = C.list[C.list.length - 1]; if (!last) return;
    let line = null, price = last.close, title = 'Create alert';
    if (opt.fromDrawing) {
      const r = C.dr[opt.fromDrawing];
      if (r && LINE_ALERTABLE.includes(r.name) && r.pts.length >= 2) { line = r; title = 'Alert on trendline'; }
      else if (r) { price = r.pts[0].v; title = 'Alert on line'; }
    }
    const sel = { cond: line ? 'cross' : 'cross', until: 'week', rep: 'once' };
    const lineNow = line ? line.pts[0].v + (line.pts[1].v - line.pts[0].v) * (Date.now() - line.pts[0].t) / ((line.pts[1].t - line.pts[0].t) || 1) : 0;
    this.open(`<h2>${title}</h2><div class="hint" style="margin:-8px 18px 4px;font-size:14px">${esc(C.sym.n)} · now ${fmt(last.close)}</div>
      <div class="lbl">Condition</div><div class="chips" id="aCond" style="padding:0 16px">${line ? '<span class="chip on" data-v="cross">Crossing trendline</span>' : '<span class="chip" data-v="above">Greater than</span><span class="chip" data-v="below">Less than</span><span class="chip on" data-v="cross">Crossing</span>'}</div>
      ${line ? `<div class="hint" style="font-size:14px">Trendline is at about ${fmt(lineNow)} now and moves with time.</div>` : `<div class="lbl">Price</div><input class="inp" id="aPrice" inputmode="decimal" value="${(+price).toFixed(decimals(price))}">`}
      <div class="lbl">Expiration</div><div class="chips" id="aUntil" style="padding:0 16px"><span class="chip" data-v="1h">1 hour</span><span class="chip" data-v="today">Today</span><span class="chip on" data-v="week">1 week</span><span class="chip" data-v="month">1 month</span><span class="chip" data-v="0">Open-ended</span></div>
      <div class="lbl">Trigger</div><div class="chips" id="aRep" style="padding:0 16px"><span class="chip on" data-v="once">Only once</span><span class="chip" data-v="every">Every time</span></div>
      <div class="lbl">Message (optional)</div><input class="inp" id="aNote" placeholder="Buy zone">
      <div class="err hide" id="aErr"></div>
      <div class="pad"><button class="btn pri full" id="aSave">Create</button></div>
      <div class="hint">${NATIVE ? 'Rings with your alarm tone even when the app is closed.' : 'Saved to your cloud. The ChartMitra phone app rings it, even when closed.'}</div>`, root => {
      const pick = (id, k) => { $(id).onclick = e => { const c = e.target.closest('.chip'); if (!c) return; sel[k] = c.dataset.v; $$(id + ' .chip').forEach(x => x.classList.toggle('on', x === c)); }; };
      pick('#aCond', 'cond'); pick('#aUntil', 'until'); pick('#aRep', 'rep');
      $('#aSave').onclick = () => {
        const now = Date.now(), endDay = new Date(); endDay.setHours(23, 59, 59, 999);
        const until = { '1h': now + 36e5, today: endDay.getTime(), week: now + 7 * 864e5, month: now + 30 * 864e5, '0': 0 }[sel.until];
        const a = { id: uid(), sym: C.sym.s, src: C.sym.src, name: C.sym.n, cond: sel.cond, until, repeat: sel.rep === 'every', note: $('#aNote').value.trim(), active: true, created: now, ref: last.close, armed: true };
        if (line) Object.assign(a, { type: 'line', t1: line.pts[0].t, p1: line.pts[0].v, t2: line.pts[1].t, p2: line.pts[1].v, cond: 'cross', drawId: line.id });
        else { const p = parseFloat(String($('#aPrice').value).replace(/,/g, '')); if (!(p > 0)) { $('#aErr').textContent = 'Enter a valid price'; $('#aErr').classList.remove('hide'); return; } a.type = 'price'; a.price = p;
          if (sel.cond === 'above' && last.close >= p) { $('#aErr').textContent = 'Price is already above ' + fmt(p) + '. Choose Crossing or a higher price.'; $('#aErr').classList.remove('hide'); return; }
          if (sel.cond === 'below' && last.close <= p) { $('#aErr').textContent = 'Price is already below ' + fmt(p) + '. Choose Crossing or a lower price.'; $('#aErr').classList.remove('hide'); return; } }
        Alerts.add(a); this.close(); drawAlertLines(); toast('Alert created');
      };
    });
  },
  alertsSheet() {
    const L = Alerts.list().slice().sort((a, b) => (b.active - a.active) || (b.created - a.created)), now = Date.now();
    const desc = a => a.type === 'line' ? 'Crossing trendline' : (a.cond === 'above' ? 'Greater than ' : a.cond === 'below' ? 'Less than ' : 'Crossing ') + fmt(a.price);
    const stat = a => !a.active ? (a.lastHit ? `<span class="tag hit">Triggered ${fmtTime(a.lastHit, true)}</span>` : '<span class="tag">Stopped</span>') : a.until && a.until < now ? '<span class="tag">Expired</span>' : '<span class="tag on">Active</span>';
    this.open(`<h2>Alerts</h2><div class="pad" style="display:flex;gap:8px"><button class="btn pri" id="alNew">${icon('plus')}New alert</button>${NATIVE ? `<button class="btn" id="alTest">${icon('bell')}Test sound</button>` : ''}</div>
      <div style="margin-top:10px">${L.length ? L.map(a => `<div class="irow" data-id="${a.id}"><div class="n"><b style="font-weight:600">${esc(a.name)}</b> ${stat(a)}<small>${desc(a)}${a.repeat ? ' · every time' : ''}${a.until ? ' · until ' + fmtTime(a.until, true) : ''}${a.note ? ' · ' + esc(a.note) : ''}</small></div><span class="sw ${a.active ? 'on' : ''}" data-tg></span><button class="ib" data-del style="color:var(--dn)">${icon('trash')}</button></div>`).join('') : '<div class="empty">No alerts yet</div>'}</div>`, root => {
      $('#alNew').onclick = () => this.alertSheet();
      const t = $('#alTest'); if (t) t.onclick = () => { Android.testRing(); toast('Ringing… tap Stop alarm in the notification or open the app', 3000); setTimeout(() => Android.stopRing(), 6000); };
      root.onclick = e => { const r = e.target.closest('.irow'); if (!r) return; const id = r.dataset.id;
        if (e.target.closest('[data-del]')) { Alerts.remove(id); drawAlertLines(); return this.alertsSheet(); }
        if (e.target.closest('[data-tg]')) { const a = Alerts.list().find(x => x.id === id); Alerts.update(id, { active: !a.active, armed: true, ref: quote({ src: a.src, s: a.sym }) ? quote({ src: a.src, s: a.sym }).p : a.ref, until: !a.active && a.until && a.until < Date.now() ? Date.now() + 7 * 864e5 : a.until }); drawAlertLines(); return this.alertsSheet(); }
        const a = Alerts.list().find(x => x.id === id), s = allSymbols().find(x => x.s === a.sym && x.src === a.src) || { s: a.sym, src: a.src, n: a.name, d: a.name, x: '', cat: a.src === 'bn' ? 'crypto' : 'other' };
        this.close(); this.page('chart'); openSymbol(s);
      };
    });
  },

  /* ----- account ----- */
  account() {
    const a = Auth.info();
    if (a.ready) return this.open(`<h2>Account and sync</h2><div class="irow"><div class="n">Logged in<small>${esc(a.email || '')}</small></div><span class="tag on">Sync on</span></div>
      <div class="irow"><div class="n">Last sync<small>${Sync.last ? fmtTime(Sync.last, true) : '—'}${Sync.err ? ' · ' + esc(Sync.err.slice(0, 80)) : ''}</small></div><button class="btn" id="syNow" style="flex:none">Sync now</button></div>
      <div class="pad"><button class="btn red full" id="syOut">Log out</button></div><div class="hint">Watchlists, drawings, indicators, layouts, alerts, journal and settings are saved to your own Supabase project and show up on the phone and the website.</div>`, () => {
      $('#syNow').onclick = async () => { await Store.flush(); await Sync.pull(); await Alerts.refresh(); restoreDrawings(); renderWatch(); toast(Sync.err ? 'Sync error: ' + Sync.err.slice(0, 60) : 'Synced'); this.account(); };
      $('#syOut').onclick = () => { Auth.logout(); this.account(); };
    });
    this.open(`<h2>Account and sync</h2><div class="hint" style="margin:-8px 18px 4px;font-size:14px">Log in once to keep the phone app and the website in sync. Uses your own free Supabase project.</div>
      <div class="lbl">Supabase project URL</div><input class="inp" id="syUrl" value="${esc(a.url || '')}" placeholder="https://xxxx.supabase.co">
      <div class="lbl">Supabase anon public key</div><input class="inp" id="syKey" value="${esc(a.key || '')}" placeholder="eyJ…">
      <div class="lbl">Email</div><input class="inp" id="syEm" type="email" value="${esc(a.email || '')}">
      <div class="lbl">Password</div><input class="inp" id="syPw" type="password">
      <div class="err hide" id="syErr"></div><div class="pad"><button class="btn pri full" id="syGo">Log in</button></div>`, () => {
      $('#syGo').onclick = async () => {
        const e = $('#syErr'); e.classList.add('hide'); $('#syGo').textContent = 'Logging in…';
        try { await Auth.login($('#syUrl').value, $('#syKey').value, $('#syEm').value, $('#syPw').value); await Sync.pull(); await Alerts.refresh(); Store.queue('wls'); restoreDrawings(); renderWatch(); toast('Logged in · sync on'); this.account(); if (C.sym) loadData(); }
        catch (x) { e.textContent = String(x.message || x).slice(0, 200); e.classList.remove('hide'); $('#syGo').textContent = 'Log in'; }
      };
    });
  }
};
UI.favActive = () => $$('#favbar [data-t]').forEach(b => b.classList.toggle('on', b.dataset.t === C.tool));

function dateRange(r) {
  const map = { '1D': ['5m', 1], '5D': ['15m', 5], '1M': ['1h', 30], '3M': ['4h', 91], '6M': ['1D', 182], 'YTD': ['1D', 0], '1Y': ['1D', 365], '5Y': ['1W', 1826] };
  const [tf, days] = map[r]; C.tf = tf; updateWheels();
  loadData().then(() => {
    const from = r === 'YTD' ? new Date(new Date().getFullYear(), 0, 1).getTime() : Date.now() - days * 864e5;
    const n = C.list.filter(k => k.timestamp >= from).length; const w = $('#chart').clientWidth - 80;
    if (n > 0) C.chart.setBarSpace(Math.max(1, Math.min(30, w / n)));
    C.chart.scrollToRealTime && C.chart.scrollToRealTime();
  });
}

/* ---------- favorites bar ---------- */
function renderFavbar() {
  const on = settings().favbar || window.innerWidth >= 900, b = $('#favbar');
  b.classList.toggle('hide', !on); if (!on) return;
  const favs = Store.get('favtools', ['parallelStraightLine', 'rayLine', 'horizontalStraightLine', 'segment', 'horizontalRayLine', 'cmFib', 'cmFibExt', 'cmLong', 'cmShort', 'cmVP']);
  b.innerHTML = `<button class="ib" data-cur aria-label="Cursor">${icon('t_cross')}</button>` + favs.map(id => { const t = toolById(id); return t ? `<button class="ib" data-t="${id}" title="${esc(t.n)}" aria-label="${esc(t.n)}">${icon(t.i)}</button>` : ''; }).join('') +
    `<button class="ib" data-more title="All tools" aria-label="All tools">${icon('dots')}</button><button class="ib ${settings().magnet ? 'on' : ''}" data-mag title="Weak magnet" aria-label="Weak magnet">${icon('magnet')}</button><button class="ib" data-del title="Remove drawings" aria-label="Remove drawings">${icon('trash')}</button>`;
  b.onclick = e => { const t = e.target.closest('button'); if (!t) return;
    if (t.dataset.t) { startTool(t.dataset.t); UI.favActive(); }
    else if (t.hasAttribute('data-cur')) { C.eraser = false; hint(''); }
    else if (t.hasAttribute('data-more')) UI.drawSheet();
    else if (t.hasAttribute('data-mag')) { setSetting('magnet', !settings().magnet); allDrawings({ mode: settings().magnet ? 'weak_magnet' : 'normal' }); renderFavbar(); }
    else if (t.hasAttribute('data-del')) { if (confirm('Remove all drawings?')) removeAllDrawings(); } };
  setTimeout(() => C.chart && C.chart.resize(), 30);
}

/* ---------- watchlist ---------- */
let wlIdx = 0;
function renderWatch() {
  const W = watchlists(), w = W[wlIdx] || W[0];
  $('#wlName').innerHTML = esc(w.name) + ' ' + icon('down');
  const row = s => { const q = quote(s); const up = q && q.ch >= 0; return `<div class="row" data-k="${esc(symKey(s))}">${symIcon(s)}<div class="l"><b>${esc(s.n)}</b><small>${esc(s.x)}${q && q.st === 'closed' ? ' · Closed' : q && q.st === 'delay' ? ' · Delayed' : ''}</small></div><div class="r"><b>${q ? fmt(q.p) : '—'}</b><small class="${q ? (up ? 'up' : 'dn') : ''}">${q ? `${up ? '+' : '−'}${fmt(Math.abs(q.ch), decimals(q.p))} ${up ? '+' : '−'}${Math.abs(q.chp || 0).toFixed(2)}%` : ''}</small></div></div>`; };
  $('#wl').innerHTML = w.groups.map((g, gi) => `<div class="grp" data-g="${gi}">${esc(g.name)}</div>${g.items.map(row).join('')}`).join('') + (Quotes.needLogin && !NATIVE ? '<div class="empty">NSE, BSE and futures prices on the website come through your cloud login: Menu → Account.</div>' : '') + '<div class="hint" style="text-align:center;margin:16px">Long-press a symbol to move or remove it</div>';
}
function wlMenu(k) {
  const W = watchlists(), w = W[wlIdx] || W[0]; let gi = -1, ii = -1;
  w.groups.forEach((g, a) => g.items.forEach((s, b) => { if (symKey(s) === k) { gi = a; ii = b; } }));
  if (gi < 0) return; const s = w.groups[gi].items[ii];
  UI.open(`<h2>${esc(s.n)}</h2><div class="mrow" data-a="up">${icon('up')}Move up</div><div class="mrow" data-a="dn">${icon('down')}Move down</div><div class="mrow" data-a="alert">${icon('alarm')}Add alert</div><div class="mrow" data-a="del" style="color:var(--dn)">${icon('trash')}Remove from watchlist</div>`, root => {
    root.onclick = e => { const r = e.target.closest('[data-a]'); if (!r) return; const items = w.groups[gi].items;
      if (r.dataset.a === 'up' && ii > 0) [items[ii - 1], items[ii]] = [items[ii], items[ii - 1]];
      if (r.dataset.a === 'dn' && ii < items.length - 1) [items[ii + 1], items[ii]] = [items[ii], items[ii + 1]];
      if (r.dataset.a === 'del') items.splice(ii, 1);
      if (r.dataset.a === 'alert') { UI.close(); UI.page('chart'); openSymbol(s).then(() => UI.alertSheet()); return; }
      Store.set('wls', W); UI.close(); renderWatch(); updateWheels(); };
  });
}
function wlSwitcher() {
  const W = watchlists();
  UI.open(`<h2>Watchlists</h2>${W.map((w, i) => `<div class="mrow" data-i="${i}">${icon('list')}${esc(w.name)}${i === wlIdx ? '<small>Current</small>' : ''}</div>`).join('')}<div class="mrow" data-new>${icon('plus')}New watchlist</div><div class="mrow" data-ren>${icon('pencil')}Rename current</div>${W.length > 1 ? `<div class="mrow" data-del style="color:var(--dn)">${icon('trash')}Delete current</div>` : ''}`, root => {
    root.onclick = e => {
      const r = e.target.closest('.mrow'); if (!r) return;
      if (r.dataset.i != null && r.hasAttribute('data-i')) { wlIdx = +r.dataset.i; }
      else if (r.hasAttribute('data-new')) { const n = prompt('Watchlist name', 'My list'); if (!n) return; W.push({ id: uid(), name: n, groups: [{ name: 'Symbols', items: [] }] }); wlIdx = W.length - 1; Store.set('wls', W); }
      else if (r.hasAttribute('data-ren')) { const n = prompt('New name', W[wlIdx].name); if (!n) return; W[wlIdx].name = n; Store.set('wls', W); }
      else if (r.hasAttribute('data-del')) { if (!confirm('Delete this watchlist?')) return; W.splice(wlIdx, 1); wlIdx = 0; Store.set('wls', W); }
      Store.set('wlIdx', wlIdx, true); UI.close(); renderWatch();
    };
  });
}
function addToWatch(s) {
  const W = watchlists(), w = W[wlIdx] || W[0];
  if (w.groups.some(g => g.items.some(i => symKey(i) === symKey(s)))) { toast('Already in the watchlist'); return; }
  const name = s.cat === 'crypto' ? 'Crypto' : ['gold', 'silver'].includes(s.cat) ? 'Gold and commodities' : s.cat === 'in' && /^\^|NIFTY/.test(s.s) ? 'Indices' : 'Stocks';
  let g = w.groups.find(x => x.name === name) || w.groups[w.groups.length - 1];
  if (!g) { g = { name, items: [] }; w.groups.push(g); }
  g.items.push(s); Store.set('wls', W); renderWatch(); updateWheels(); refreshQuotes([s]); toast('Added ' + s.n);
}

/* ---------- explore ---------- */
let exTab = 'cal', calImp = 'High';
async function renderExplore() {
  const b = $('#exBody');
  if (exTab === 'cal') {
    b.innerHTML = `<div class="chips" id="calF" style="padding-top:2px">${['High', 'Medium', 'All'].map(x => `<span class="chip ${x === calImp ? 'on' : ''}">${x}</span>`).join('')}</div><div id="calL"><div class="empty">Loading…</div></div>`;
    $('#calF').onclick = e => { const c = e.target.closest('.chip'); if (c) { calImp = c.textContent; renderExplore(); } };
    try {
      const list = (await loadCalendar()).filter(e => calImp === 'All' || e.imp === calImp || (calImp === 'Medium' && e.imp === 'High'));
      let day = '', h = ''; const now = Date.now();
      list.forEach(e => { const d = new Date(e.t).toLocaleDateString('en-GB', { timeZone: settings().tz, weekday: 'long', day: 'numeric', month: 'short' });
        if (d !== day) { h += `<div class="grp">${d}</div>`; day = d; }
        h += `<div class="row" style="cursor:default;${e.t < now ? 'opacity:.6' : ''}"><div style="width:48px;font-size:13px">${fmtTime(e.t)}</div><div class="l"><b style="font-size:14px;font-weight:500"><span class="imp ${e.imp}"></span>${esc(e.c)} · ${esc(e.title)}</b><small>${e.a ? 'Actual ' + esc(e.a) + ' · ' : ''}${e.f ? 'Forecast ' + esc(e.f) + ' · ' : ''}${e.p ? 'Previous ' + esc(e.p) : ''}</small></div></div>`; });
      $('#calL').innerHTML = h || '<div class="empty">No events</div>';
      $('#calL').insertAdjacentHTML('beforeend', '<div class="hint" style="margin:14px 18px">Source: Forex Factory weekly calendar. Times in your chart time zone.</div>');
    } catch (e) { $('#calL').innerHTML = `<div class="empty">${e.message === 'LOGIN_NEEDED' ? 'Log in (Menu → Account) to load the calendar on the website.' : 'Could not load the calendar.'}</div>`; }
  } else if (exTab === 'crypto') {
    b.innerHTML = '<div class="empty">Loading…</div>';
    try {
      const all = (await bnGet('/api/v3/ticker/24hr')).filter(t => t.symbol.endsWith('USDT') && +t.quoteVolume > 2e7);
      const g = all.slice().sort((a, b) => b.priceChangePercent - a.priceChangePercent), row = t => `<div class="row" data-bn="${t.symbol}"><span class="sicon" style="background:#f7931a">₿</span><div class="l"><b>${t.symbol}</b><small>Vol ${fmtVol(+t.quoteVolume)} USDT</small></div><div class="r"><b>${fmt(+t.lastPrice)}</b><small class="${+t.priceChangePercent >= 0 ? 'up' : 'dn'}">${(+t.priceChangePercent).toFixed(2)}%</small></div></div>`;
      b.innerHTML = `<div class="grp">Top gainers 24h</div>${g.slice(0, 10).map(row).join('')}<div class="grp">Top losers 24h</div>${g.slice(-10).reverse().map(row).join('')}`;
    } catch (e) { b.innerHTML = '<div class="empty">Could not load</div>'; }
  } else {
    const syms = allSymbols().filter(s => quote(s)).sort((a, b) => quote(b).chp - quote(a).chp);
    b.innerHTML = syms.length ? syms.map(s => { const q = quote(s); return `<div class="row" data-k="${esc(symKey(s))}">${symIcon(s)}<div class="l"><b>${esc(s.n)}</b><small>${esc(s.x)}</small></div><div class="r"><b>${fmt(q.p)}</b><small class="${q.chp >= 0 ? 'up' : 'dn'}">${q.chp.toFixed(2)}%</small></div></div>`; }).join('') : '<div class="empty">Prices loading…</div>';
  }
}

/* ---------- news ---------- */
let newsTab = 'all', newsCache = null, newsT = 0;
async function renderNews(force) {
  const b = $('#newsBody');
  if (!newsCache || force || Date.now() - newsT > 5 * 6e4) {
    b.innerHTML = '<div class="empty">Loading news…</div>';
    newsCache = await loadNews(); newsT = Date.now();
  }
  const list = newsCache.filter(n => newsTab === 'all' || n.cat === newsTab || n.also === newsTab);
  b.innerHTML = list.length ? list.slice(0, 120).map(n => `<a class="news" href="${esc(n.link)}" target="_blank" rel="noopener"><b>${esc(n.title)}</b><small>${esc(n.src)} · ${n.t ? fmtTime(n.t, true) : ''}</small></a>`).join('') : `<div class="empty">${newsCache.needLogin ? 'Log in (Menu → Account) to load news on the website.' : 'No news right now'}</div>`;
}

/* ---------- menu ---------- */
function renderMenu() {
  const a = Auth.info(), act = Alerts.list().filter(x => x.active).length, j = Store.get('journal', []), st = tradeStats(j);
  $('#menuBody').innerHTML = `<div style="display:flex;align-items:center;gap:12px;padding:6px 18px 16px">${'<img src="icon.svg" width="44" height="44" style="border-radius:11px">'}<div><b style="font-size:18px">ChartMitra</b><div class="hint" style="margin:2px 0 0">${NATIVE ? 'Android app · v' + esc(Android.version()) : 'Website'}</div></div></div>
    <div class="mrow" data-m="account">${icon('user')}Account and sync<small>${a.ready ? esc(a.email || 'On') : 'Off'}</small></div>
    <div class="mrow" data-m="alerts">${icon('alarm')}Alerts<small>${act} active</small></div>
    <div class="mrow" data-m="replay">${icon('replay')}Bar Replay and paper trading</div>
    <div class="mrow" data-m="journal">${icon('journal')}Trading journal<small>${j.length} trades</small></div>
    <div class="mrow" data-m="calc">${icon('calc')}Position size and brokerage calculator</div>
    <div class="mrow" data-m="settings">${icon('gear')}Chart settings</div>
    ${NATIVE ? `<div class="mrow" data-m="battery">${icon('battery')}Keep alerts running in background<small>${Android.batteryFree() ? 'Allowed' : 'Tap to allow'}</small></div>` : ''}
    <div class="mrow" data-m="about">${icon('info')}Data sources and about</div>`;
  $('#menuBody').onclick = e => { const r = e.target.closest('[data-m]'); if (!r) return;
    const m = r.dataset.m;
    if (m === 'account') UI.account(); else if (m === 'alerts') UI.alertsSheet(); else if (m === 'settings') UI.chartSettings();
    else if (m === 'replay') { UI.page('chart'); UI.replayStart(); }
    else if (m === 'battery') Android.openBattery();
    else if (m === 'journal') UI.open(`<h2>Trading journal</h2><div class="stat"><div>Trades<b>${st.n}</b></div><div>Win rate<b>${st.win.toFixed(0)}%</b></div><div>Profit factor<b>${isFinite(st.pf) ? st.pf.toFixed(2) : '∞'}</b></div><div>Net<b class="${st.netPct >= 0 ? 'up' : 'dn'}">${st.netPct.toFixed(2)}%</b></div><div>Max DD<b>${st.dd.toFixed(2)}%</b></div><div>Mode<b>Replay</b></div></div>
      <div style="margin-top:12px">${j.slice().reverse().map(t => `<div class="irow"><div class="n">${esc(t.sym)} ${t.tf} · ${t.side === 'buy' ? 'Long' : 'Short'}<small>${fmtTime(t.t1, true)} → ${fmtTime(t.t2, true)} · ${esc(t.why)}</small></div><b class="${t.pnl >= 0 ? 'up' : 'dn'}" style="font-weight:500">${t.pct.toFixed(2)}%</b></div>`).join('') || '<div class="empty">Trades from Bar Replay show up here</div>'}</div>${j.length ? '<div class="pad"><button class="btn red full" id="jClr">Clear journal</button></div>' : ''}`, () => { const c = $('#jClr'); if (c) c.onclick = () => { if (confirm('Clear all journal trades?')) { Store.set('journal', []); UI.close(); renderMenu(); } }; });
    else if (m === 'calc') calcSheet();
    else if (m === 'about') UI.open(`<h2>Data sources</h2><div class="pad" style="line-height:1.7;color:var(--mu)"><b style="color:var(--fg)">Crypto</b>: Binance, real-time WebSocket (every trade).<br><b style="color:var(--fg)">XAUUSD</b>: live via PAXG/USDT on Binance (gold-backed token that tracks spot gold closely; can differ by a few dollars).<br><b style="color:var(--fg)">NSE / BSE / COMEX futures</b>: Yahoo Finance, refreshed every 2–3 s. These can lag the exchange; a live broker feed (free API) is the next update.<br><b style="color:var(--fg)">News</b>: Economic Times, Moneycontrol, CNBC, CoinDesk, Cointelegraph RSS.<br><b style="color:var(--fg)">Calendar</b>: Forex Factory.<br><br>Charts by KLineChart (open source). ChartMitra is for analysis only and never places real orders.</div>`);
  };
}
function calcSheet() {
  UI.open(`<h2>Position size</h2><div class="lbl">Capital (₹)</div><input class="inp" id="cCap" inputmode="decimal" value="100000"><div class="lbl">Risk per trade (%)</div><input class="inp" id="cRisk" inputmode="decimal" value="1">
    <div class="lbl">Entry</div><input class="inp" id="cEn" inputmode="decimal" value="${C.list.length ? C.list[C.list.length - 1].close.toFixed(2) : ''}"><div class="lbl">Stop loss</div><input class="inp" id="cSl" inputmode="decimal"><div class="lbl">Lot size (1 for cash shares)</div><input class="inp" id="cLot" inputmode="decimal" value="1">
    <div class="lbl">Brokerage per order (₹)</div><input class="inp" id="cBr" inputmode="decimal" value="20"><div class="card pad" id="cOut" style="margin:14px 16px;line-height:1.7"></div>
    <div class="hint">Charges use NSE intraday equity rates: STT 0.025% on sell, exchange 0.00297%, SEBI ₹10/crore, stamp 0.003% on buy, GST 18% on brokerage + exchange. Check your broker's sheet for exact values.</div>`, () => {
    const f = () => { const v = id => parseFloat($(id).value) || 0; const cap = v('#cCap'), risk = cap * v('#cRisk') / 100, en = v('#cEn'), sl = v('#cSl'), lot = Math.max(1, v('#cLot')), br = v('#cBr');
      const per = Math.abs(en - sl); if (!per || !en) { $('#cOut').innerHTML = 'Enter entry and stop loss'; return; }
      let qty = Math.floor(risk / per / lot) * lot; const val = qty * en;
      const stt = val * 0.00025, ex = val * 2 * 0.0000297, sebi = val * 2 * 1e-7 * 100, stamp = val * 0.00003, gst = (2 * br + ex) * 0.18, tot = 2 * br + stt + ex + sebi + stamp + gst;
      $('#cOut').innerHTML = `Quantity: <b>${qty}</b> (${qty / lot} lots)<br>Position value: <b>₹${fmt(val, 2)}</b><br>Risk: <b>₹${fmt(qty * per, 2)}</b><br>Charges (round trip): <b>₹${fmt(tot, 2)}</b><br>Break-even move: <b>${qty ? fmt(tot / qty, 2) : '—'}</b> per share`; };
    $$('#shBody input').forEach(i => i.oninput = f); f();
  });
}

/* ---------- wiring + startup ---------- */
function wheelSwipe(el, cb) { let y0 = null; el.addEventListener('touchstart', e => y0 = e.touches[0].clientY, { passive: true }); el.addEventListener('touchend', e => { if (y0 == null) return; const d = e.changedTouches[0].clientY - y0; y0 = null; if (Math.abs(d) > 24) { el._sw = true; cb(d < 0 ? 1 : -1); } }); el.addEventListener('wheel', e => { e.preventDefault(); cb(e.deltaY > 0 ? 1 : -1); }, { passive: false }); }
window.onBack = () => {
  if (UI.isOpen()) { UI.close(); return true; }
  if (C.tool) { try { C.chart.removeOverlay({ name: C.tool, groupId: 'draw' }); } catch (e) { } C.tool = null; hint(''); restoreDrawings(); return true; }
  if (C.eraser) { C.eraser = false; hint(''); return true; }
  if (C.replay) { stopReplay(); return true; }
  if (UI.cur !== 'chart') { UI.page('chart'); return true; }
  return false;
};
window.onAppResume = () => { Alerts.refresh().then(() => drawAlertLines()); Sync.pull().then(ch => { if (ch && ch.length) { if (ch.some(k => k.startsWith('drw:'))) restoreDrawings(); if (ch.includes('wls')) { renderWatch(); updateWheels(); } } }); };
window.openFromAlarm = s => { const sym = allSymbols().find(x => x.s === s); UI.page('chart'); if (sym) openSymbol(sym); UI.alertsSheet(); };
document.addEventListener('alerts', () => drawAlertLines());
document.addEventListener('quotes', () => { if (UI.cur === 'watch') renderWatch(); if (UI.cur === 'chart') updateLegend(); });

(async function start() {
  paintIcons(document);
  document.body.classList.toggle('dark', settings().theme === 'dark');
  wlIdx = Store.get('wlIdx', 0);
  $('#nav').onclick = e => { const b = e.target.closest('button'); if (b) UI.page(b.dataset.p); };
  $('#shade').onclick = () => UI.close();
  $('#symBtn').onclick = () => { if ($('#symBtn')._sw) { $('#symBtn')._sw = false; return; } UI.symbolSheet(s => openSymbol(s)); };
  $('#tfBtn').onclick = () => { if ($('#tfBtn')._sw) { $('#tfBtn')._sw = false; return; } UI.intervalSheet(); };
  wheelSwipe($('#symBtn'), d => { const L = allSymbols(), i = L.findIndex(s => symKey(s) === symKey(C.sym)); const n = L[i + d]; if (n) openSymbol(n); });
  wheelSwipe($('#tfBtn'), d => { const F = favTfs(), i = F.indexOf(C.tf); const n = F[i + d]; if (n) { C.tf = n; updateWheels(); loadData(); } });
  $('#drawBtn').onclick = () => UI.drawSheet();
  $('#indBtn').onclick = () => UI.indSheet();
  $('#hubBtn').onclick = () => UI.hub();
  $('#undoBtn').onclick = () => undoDraw(); $('#undoBtn').classList.add('dis');
  $('#wlAdd').onclick = () => UI.symbolSheet(s => addToWatch(s));
  $('#wlName').onclick = () => wlSwitcher();
  $('#newsRef').onclick = () => renderNews(true);
  $('#newsTabs').onclick = e => { const c = e.target.closest('.chip'); if (!c) return; newsTab = c.dataset.t; $$('#newsTabs .chip').forEach(x => x.classList.toggle('on', x === c)); renderNews(); };
  $('#exTabs').onclick = e => { const c = e.target.closest('.chip'); if (!c) return; exTab = c.dataset.t; $$('#exTabs .chip').forEach(x => x.classList.toggle('on', x === c)); renderExplore(); };
  const openRow = e => { const r = e.target.closest('.row'); if (!r) return; if (r.dataset.bn) { openSymbol({ s: r.dataset.bn, n: r.dataset.bn, d: r.dataset.bn.replace(/USDT$/, '') + ' / TetherUS', x: 'Binance', src: 'bn', cat: 'crypto', cur: 'USDT' }); UI.page('chart'); return; } const s = allSymbols().find(x => symKey(x) === r.dataset.k); if (s) { UI.page('chart'); openSymbol(s); } };
  $('#wl').onclick = e => { if ($('#wl')._lp) { $('#wl')._lp = false; return; } openRow(e); };
  $('#exBody').onclick = openRow;
  let lpT; $('#wl').addEventListener('touchstart', e => { const r = e.target.closest('.row'); if (!r) return; lpT = setTimeout(() => { $('#wl')._lp = true; wlMenu(r.dataset.k); }, 550); }, { passive: true });
  $('#wl').addEventListener('touchend', () => clearTimeout(lpT)); $('#wl').addEventListener('touchmove', () => clearTimeout(lpT), { passive: true });
  $('#wl').addEventListener('contextmenu', e => { const r = e.target.closest('.row'); if (r) { e.preventDefault(); $('#wl')._lp = false; wlMenu(r.dataset.k); } });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') window.onBack(); if ((e.ctrlKey || e.metaKey) && e.key === 'z') undoDraw(); if (UI.cur === 'chart' && C.replay && e.key === 'ArrowRight') replayStep(1); if (UI.cur === 'chart' && C.replay && e.key === 'ArrowLeft') replayStep(-1); });

  if (typeof klinecharts === 'undefined') { showMsg('Chart library missing. Please reinstall the app.'); return; }
  initChart(); renderFavbar();
  window.addEventListener('resize', renderFavbar);
  await Sync.pull(); await Alerts.refresh();
  const last = Store.get('last', null), syms = allSymbols();
  const first = (last && last.sym) || syms.find(s => s.n === 'XAUUSD') || syms[0];
  C.tf = (last && last.tf) || '15m';
  await openSymbol(first, C.tf);
  refreshQuotes(allSymbols());
  setInterval(() => { if (!document.hidden) refreshQuotes(allSymbols().filter(s => s.src === 'yf')); }, 8000);
  setInterval(() => { if (!document.hidden) Sync.pull().then(ch => { if (ch && ch.some(k => k === drawKey())) restoreDrawings(); }); }, 60000);
})();
