/* =========================================================
   TEST HARNESS
   ---------------------------------------------------------
   Loads the application into an isolated Node context with a DOM
   stub, so every system can be exercised without a browser, a
   bundler, or a single dependency.

   HOW IT WORKS
   index.html is read as TEXT. The largest <script> block is
   extracted and evaluated in a Node `vm` against an in-memory
   store. Nothing is written to disk and no real browser storage
   is touched.

   WHY THE LARGEST SCRIPT BLOCK
   The app is one file with one main script. That is what makes a
   zero-build app fully testable — but it also means code placed in
   a SECOND script block, or in a linked .js file, is invisible to
   every contract here and the suite will still pass. A contract
   asserts there is only one substantial block; keep it that way.

   TIME IS VIRTUAL
   setTimeout, requestAnimationFrame and performance.now run on a
   clock that moves only when a test calls ctx.__advance(ms). A
   frame requested during a frame runs on the NEXT frame, and a
   cancelled frame never runs — the semantics a browser gives. An
   earlier version ran animation frames synchronously, which makes
   any self-scheduling animation recurse at boot.

   CANVAS, POINTERS AND THE SCREEN
   <canvas> elements get a 2D context that records calls instead of
   drawing. Pointer capture is tracked per element. The viewport,
   safe-area insets, device pixel ratio and reduced-motion setting
   are options to loadApp(), and ctx.__resize() /
   ctx.__setReducedMotion() change them while the app runs.

   NOTHING FAILS QUIETLY
   An exception thrown inside an event listener, a timer or a frame
   is recorded in `errors`, so "no console errors" means none were
   swallowed along the way.

   ISOLATION GUARANTEE
   The harness never reads or writes real user data, and it has no
   network: every network API is a recording stand-in.
   ========================================================= */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const APP_PATH = path.join(ROOT, 'index.html');
const SW_PATH = path.join(ROOT, 'sw.js');
const MANIFEST_PATH = path.join(ROOT, 'manifest.webmanifest');
const PKG_PATH = path.join(ROOT, 'package.json');

function readApp(){ return fs.readFileSync(APP_PATH, 'utf8'); }
function readSW(){ return fs.readFileSync(SW_PATH, 'utf8'); }
function readManifest(){ return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')); }
function readPkg(){ return JSON.parse(fs.readFileSync(PKG_PATH, 'utf8')); }

/* Every <script> block, and the one the app actually lives in. */
function scriptBlocks(src){
  return [...src.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
}
function mainScript(src){
  const blocks = scriptBlocks(src);
  if(!blocks.length) throw new Error('no <script> block found in index.html');
  return blocks.reduce((a, b) => (b.length > a.length ? b : a));
}
function styleBlock(src){
  const a = src.indexOf('<style>'), b = src.indexOf('</style>');
  if(a === -1 || b === -1) throw new Error('no <style> block found in index.html');
  return src.slice(a + 7, b);
}
function bodyBlock(src){
  const a = src.indexOf('<body>'), b = src.lastIndexOf('</body>');
  if(a === -1 || b === -1) throw new Error('no <body> found in index.html');
  return src.slice(a + 6, b);
}

/* ---------- deterministic PRNG (same seed => same run) ---------- */
function mulberry32(seed){
  let a = seed >>> 0;
  return function(){
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* =========================================================
   IN-MEMORY localStorage
   ---------------------------------------------------------
   A real implementation, not a no-op: the storage-namespace
   contracts depend on being able to inspect exactly which keys
   were written, and on two app ids sharing one store the way two
   deployments share one origin.
   ========================================================= */
function makeLocalStorage(shared, failWrites){
  const map = shared || new Map();
  return {
    _map: map,
    get length(){ return map.size; },
    key(i){ return [...map.keys()][i] ?? null; },
    getItem(k){ return map.has(String(k)) ? map.get(String(k)) : null; },
    setItem(k, v){
      if(failWrites) throw new Error('QuotaExceededError');
      map.set(String(k), String(v));
    },
    removeItem(k){ map.delete(String(k)); },
    clear(){ map.clear(); }
  };
}

/* =========================================================
   VIRTUAL CLOCK
   ---------------------------------------------------------
   Timers and animation frames on one timeline that moves only when
   a test calls advance(ms). Frames follow a 60 Hz grid; a callback
   requested inside a frame waits for the next one, and a cancelled
   callback never runs, even when cancelled by an earlier callback
   of the same frame.
   ========================================================= */
function makeClock(report){
  const c = {
    now: 0, seq: 0, lastFrame: -Infinity, frameMs: 1000 / 60,
    timers: new Map(), frames: new Map(),
    stats: { count: 0, live: 0, frames: 0 }
  };
  const sync = () => { c.stats.live = c.timers.size; };
  const run = (label, fn, arg) => {
    try{ fn(arg); }catch(e){ report(label + ': ' + (e && e.stack || e)); }
  };

  c.setTimeout = (fn, ms) => {
    const id = ++c.seq;
    c.timers.set(id, { due: c.now + Math.max(0, Number(ms) || 0), fn, every: 0 });
    c.stats.count++; sync();
    return id;
  };
  c.setInterval = (fn, ms) => {
    const id = ++c.seq, every = Math.max(1, Number(ms) || 0);
    c.timers.set(id, { due: c.now + every, fn, every });
    c.stats.count++; sync();
    return id;
  };
  c.clearTimeout = id => { c.timers.delete(id); sync(); };
  c.clearInterval = c.clearTimeout;
  c.requestAnimationFrame = fn => { const id = ++c.seq; c.frames.set(id, fn); return id; };
  c.cancelAnimationFrame = id => { c.frames.delete(id); };
  c.pendingFrames = () => c.frames.size;
  c.liveTimers = () => c.timers.size;

  function runFrame(){
    c.lastFrame = c.now;
    c.stats.frames++;
    [...c.frames.keys()].forEach(id => {
      const fn = c.frames.get(id);
      if(!fn) return;                        // cancelled earlier in this frame
      c.frames.delete(id);
      run('animation frame', fn, c.now);
    });
  }
  function runTimer(id){
    const t = c.timers.get(id);
    if(!t) return;
    if(t.every) t.due += t.every; else c.timers.delete(id);
    sync();
    run('timer', t.fn);
  }

  c.advance = ms => {
    const end = c.now + Math.max(0, Number(ms) || 0);
    for(let guard = 0; ; guard++){
      if(guard > 200000) throw new Error('virtual clock: something reschedules itself without end');
      let due = Infinity, id = null;
      c.timers.forEach((t, k) => { if(t.due < due){ due = t.due; id = k; } });
      const frame = c.frames.size ? Math.max(c.now, c.lastFrame + c.frameMs) : Infinity;
      const next = Math.min(due, frame);
      if(next > end) break;
      c.now = next;
      if(frame <= due) runFrame(); else runTimer(id);
    }
    c.now = end;
  };
  /* Exactly one frame, if one is waiting. */
  c.frame = () => {
    if(!c.frames.size) return false;
    c.advance(Math.max(0, c.lastFrame + c.frameMs - c.now));
    return true;
  };
  return c;
}

/* =========================================================
   MEDIA QUERY
   ---------------------------------------------------------
   A MediaQueryList whose answer a test can change, firing `change`
   the way a browser does when the system setting flips.
   ========================================================= */
function makeMediaQuery(media, matches){
  const listeners = new Set();
  const mq = {
    media, matches: !!matches,
    addEventListener(type, fn){ if(type === 'change' && typeof fn === 'function') listeners.add(fn); },
    removeEventListener(type, fn){ listeners.delete(fn); },
    addListener(fn){ if(typeof fn === 'function') listeners.add(fn); },
    removeListener(fn){ listeners.delete(fn); },
    listenerCount(){ return listeners.size; },
    set(value, report){
      const next = !!value;
      if(next === mq.matches) return;
      mq.matches = next;
      [...listeners].forEach(fn => {
        try{ fn({ matches: next, media }); }catch(e){ if(report) report('media change: ' + (e && e.stack || e)); }
      });
    }
  };
  return mq;
}

/* =========================================================
   DESIGN TOKENS, AS A BROWSER WOULD COMPUTE THEM
   ---------------------------------------------------------
   getComputedStyle(root).getPropertyValue('--x') returns the value
   of the token with var() references already substituted. Parsed
   from the shipped :root block, so the canvas under test paints with
   the same colours a browser would hand it.
   ========================================================= */
function rootTokens(src){
  const style = styleBlock(src).split('\r\n').join('\n');
  const a = style.indexOf(':root{');
  const b = style.indexOf('\n}', a);
  if(a === -1 || b === -1) return {};
  const raw = {};
  style.slice(a, b).replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi, (_, k, v) => { raw[k] = v.trim(); return ''; });
  const resolve = (v, depth) => depth > 8 ? v :
    v.replace(/var\((--[a-z0-9-]+)\)/gi, (m, k) => raw[k] !== undefined ? resolve(raw[k], depth + 1) : m);
  const out = {};
  Object.keys(raw).forEach(k => { out[k] = resolve(raw[k], 0); });
  return out;
}

/* =========================================================
   2D CONTEXT
   ---------------------------------------------------------
   Counts every call. Set `recording = true` to keep the calls of the
   frames that follow in `log` (with their arguments), which is how a
   contract can see what was painted without a pixel.
   ========================================================= */
const CTX_METHODS = [
  'save', 'restore', 'scale', 'rotate', 'translate', 'transform', 'setTransform', 'resetTransform',
  'clearRect', 'fillRect', 'strokeRect', 'beginPath', 'closePath', 'moveTo', 'lineTo',
  'bezierCurveTo', 'quadraticCurveTo', 'arc', 'arcTo', 'ellipse', 'rect', 'roundRect',
  'fill', 'stroke', 'clip', 'fillText', 'strokeText', 'setLineDash', 'drawImage', 'putImageData'
];
function makeContext2d(canvas){
  const ctx = {
    canvas, calls: 0, counts: {}, recording: false, log: [],
    fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, globalAlpha: 1,
    lineCap: 'butt', lineJoin: 'miter', font: '10px sans-serif', textAlign: 'start',
    textBaseline: 'alphabetic', lineDashOffset: 0, shadowBlur: 0, shadowColor: 'transparent'
  };
  CTX_METHODS.forEach(m => {
    ctx[m] = function(...args){
      ctx.calls++;
      ctx.counts[m] = (ctx.counts[m] || 0) + 1;
      if(ctx.recording){
        ctx.log.push({ m, args, fillStyle: ctx.fillStyle, strokeStyle: ctx.strokeStyle,
                       alpha: ctx.globalAlpha });
      }
    };
  });
  ctx.measureText = () => ({ width: 0 });
  ctx.getLineDash = () => [];
  ctx.createLinearGradient = ctx.createRadialGradient = () => ({ addColorStop(){} });
  return ctx;
}

/* =========================================================
   DOM STUB
   ---------------------------------------------------------
   Enough of a document for the overlay engine, the renderers and
   the boot sequence to run for real. Elements declared in the
   shipped markup are pre-registered with their real ids and
   classes, so `querySelectorAll('.overlay.open')` reflects genuine
   state rather than a fixture someone hand-maintained.
   ========================================================= */
function buildDom(src){
  const byId = new Map();
  const all = [];

  function mkEl(tag, id){
    const classes = new Set();
    const attrs = new Map();
    let _text = '', _html = '';
    const el = {
      tagName: (tag || 'div').toUpperCase(),
      id: id || '',
      style: {},
      dataset: {},
      value: '',
      checked: false,
      disabled: false,
      files: [],
      children: [],
      parentNode: null,
      offsetParent: {},          // "visible" — focusables filter on this
      classList: {
        add(...c){ c.forEach(x => classes.add(x)); },
        remove(...c){ c.forEach(x => classes.delete(x)); },
        toggle(c, f){
          if(f === undefined){ classes.has(c) ? classes.delete(c) : classes.add(c); }
          else { f ? classes.add(c) : classes.delete(c); }
        },
        contains(c){ return classes.has(c); }
      },
      _classes: classes,
      setAttribute(k, v){ attrs.set(k, String(v)); },
      getAttribute(k){ return attrs.has(k) ? attrs.get(k) : null; },
      removeAttribute(k){ attrs.delete(k); },
      hasAttribute(k){ return attrs.has(k); },
      _attrs: attrs,
      appendChild(c){ this.children.push(c); c.parentNode = this; return c; },
      insertAdjacentHTML(){},
      insertAdjacentElement(){},
      remove(){
        if(this.parentNode){
          const i = this.parentNode.children.indexOf(this);
          if(i > -1) this.parentNode.children.splice(i, 1);
        }
        this.parentNode = null;
      },
      removeChild(c){ const i = this.children.indexOf(c); if(i > -1) this.children.splice(i, 1); },
      focus(){ dom.document.activeElement = this; },
      blur(){},
      select(){},
      click(){ const h = attrs.get('onclick'); if(h) try{ evalOnclick(h); }catch(e){} },
      addEventListener(type, fn){ (this._listeners[type] = this._listeners[type] || []).push(fn); },
      removeEventListener(type, fn){
        const l = this._listeners[type]; if(!l) return;
        const i = l.indexOf(fn); if(i > -1) l.splice(i, 1);
      },
      _listeners: {},
      dispatch(type, ev){ dispatchTo(this, type, ev); },
      /* Pointer capture, per element, the way the stage relies on it. */
      _captured: new Set(),
      setPointerCapture(id){ this._captured.add(id); },
      releasePointerCapture(id){ this._captured.delete(id); },
      hasPointerCapture(id){ return this._captured.has(id); },
      /* A canvas fills the viewport, which is the only layout the stage has. */
      width: 300,
      height: 150,
      getBoundingClientRect(){
        const w = this.tagName === 'CANVAS' ? dom.viewport.width : 0;
        const h = this.tagName === 'CANVAS' ? dom.viewport.height : 0;
        return { left: 0, top: 0, x: 0, y: 0, width: w, height: h, right: w, bottom: h };
      },
      getContext(type){
        if(this.tagName !== 'CANVAS' || type !== '2d') return null;
        return this._ctx || (this._ctx = makeContext2d(this));
      },
      querySelector(sel){ return query(sel, this)[0] || null; },
      querySelectorAll(sel){ return query(sel, this); },
      closest(){ return null; },
      scrollIntoView(){},
      get firstElementChild(){ return this.children[0] || null; },
      get childElementCount(){ return this.children.length; }
    };
    /* className is an accessor on a real element, not a plain string: code
       that assigns it must actually change the class list, or a later
       classList query silently disagrees with what was set. */
    Object.defineProperty(el, 'className', {
      enumerable: true, configurable: true,
      get(){ return [...classes].join(' '); },
      set(v){
        classes.clear();
        String(v == null ? '' : v).split(/\s+/).filter(Boolean).forEach(c => classes.add(c));
      }
    });
    /* textContent and innerHTML linked the way a real element links them.
       escapeHtml() works by assigning textContent to a detached div and
       reading innerHTML back; with plain string properties that returns ''
       and every escaped value in the app renders empty under test. */
    Object.defineProperty(el, 'textContent', {
      enumerable: true, configurable: true,
      get(){ return _text; },
      set(v){
        _text = v == null ? '' : String(v);
        _html = _text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      }
    });
    Object.defineProperty(el, 'innerHTML', {
      enumerable: true, configurable: true,
      get(){ return _html; },
      set(v){
        _html = v == null ? '' : String(v);
        _text = _html.replace(/<[^>]*>/g, '');
        /* Children rendered by innerHTML are not modelled; the tests that
           care about generated markup assert on the HTML string itself. */
        this.children = [];
      }
    });
    all.push(el);
    return el;
  }

  let evalOnclick = () => {};

  /* Supports the selector shapes the app actually uses: `.a`, `.a.b`,
     `#id .a`, `tag`, and comma lists. Anything else returns []. */
  function query(sel, scope){
    const parts = String(sel).split(',').map(s => s.trim()).filter(Boolean);
    const out = [];
    parts.forEach(p => {
      let pool = all;
      const spaced = p.split(/\s+/);
      if(spaced.length === 2 && spaced[0].startsWith('#')){
        const parent = byId.get(spaced[0].slice(1));
        pool = parent ? all.filter(e => e._scope === parent.id) : [];
        p = spaced[1];
      } else if(spaced.length > 1){
        p = spaced[spaced.length - 1];
      }
      if(scope && scope !== dom.document && scope.id){
        pool = pool.filter(e => e === scope || e._scope === scope.id);
      }
      pool.forEach(e => {
        if(matches(e, p) && out.indexOf(e) === -1) out.push(e);
      });
    });
    return out;
  }
  function matches(el, sel){
    if(sel.startsWith('#')) return el.id === sel.slice(1);
    if(sel.startsWith('.')){
      return sel.split('.').filter(Boolean).every(c => el._classes.has(c));
    }
    if(/^[a-z]+$/i.test(sel)) return el.tagName === sel.toUpperCase();
    if(sel.includes('[')) return false;
    return false;
  }

  /* A listener that throws in a browser reports to the console and the
     page carries on. Here it lands in the app's error list, so a contract
     that asserts "no errors" cannot pass over a swallowed exception. */
  function dispatchTo(target, type, ev){
    (target._listeners[type] || []).slice().forEach(f => {
      try{ f(ev || {}); }
      catch(e){ dom.reportError('listener ' + type + ': ' + (e && e.stack || e)); }
    });
  }

  const body = mkEl('body', 'body');
  const html = mkEl('html', 'documentElement');

  const dom = {
    mkEl,
    byId,
    all,
    dispatchTo,
    viewport: { width: 1024, height: 768 },
    reportError(){},
    setOnclickEvaluator(fn){ evalOnclick = fn; },
    document: {
      body,
      documentElement: html,
      activeElement: body,
      visibilityState: 'visible',
      getElementById(id){
        if(byId.has(id)) return byId.get(id);
        return null;
      },
      createElement(tag){ return mkEl(tag, ''); },
      querySelector(sel){ return query(sel)[0] || null; },
      querySelectorAll(sel){ return query(sel); },
      addEventListener(type, fn){ (this._listeners[type] = this._listeners[type] || []).push(fn); },
      removeEventListener(type, fn){
        const l = this._listeners[type]; if(!l) return;
        const i = l.indexOf(fn); if(i > -1) l.splice(i, 1);
      },
      _listeners: {},
      dispatch(type, ev){ dispatchTo(this, type, ev); },
      contains(){ return true; }
    }
  };

  /* Register every element the shipped markup declares with an id, carrying
     its real class list and its owning overlay/view for scoped queries. */
  const bodyHtml = bodyBlock(src);
  const tagRe = /<(div|main|nav|section|header|footer|form|label|button|input|textarea|select|span|p|ul|ol|li|a|h1|h2|h3|h4|canvas)\b([^>]*)>/g;
  let m;

  /* Two passes: ids first (so scoping can resolve), then scope assignment by
     nearest enclosing element that has an id. */
  const found = [];
  while((m = tagRe.exec(bodyHtml)) !== null){
    const tag = m[1], attrText = m[2] || '';
    const idM = attrText.match(/\bid="([^"]+)"/);
    const clsM = attrText.match(/\bclass="([^"]+)"/);
    const onM = attrText.match(/\bonclick="([^"]+)"/);
    const roleM = attrText.match(/\brole="([^"]+)"/);
    found.push({ tag, id: idM ? idM[1] : null, cls: clsM ? clsM[1] : '',
                 onclick: onM ? onM[1] : null, role: roleM ? roleM[1] : null, at: m.index });
  }
  /* Nearest preceding element with an id and a container class becomes scope. */
  const containers = found.filter(f => f.id && /overlay|view|list|segmented|tabbar|host|panel|grid/.test(f.cls + ' ' + f.id));
  found.forEach(f => {
    if(!f.id) return;
    const el = mkEl(f.tag, f.id);
    f.cls.split(/\s+/).filter(Boolean).forEach(c => el.classList.add(c));
    /* onclick matters: the overlay engine reads a surface's declared close
       path out of this attribute rather than inventing one. */
    if(f.onclick) el.setAttribute('onclick', f.onclick);
    if(f.role) el.setAttribute('role', f.role);
    const owner = containers.filter(c => c.at < f.at && c.id !== f.id).pop();
    el._scope = owner ? owner.id : null;
    byId.set(f.id, el);
  });
  /* Class-only elements the engine and tests query for (.tab-btn, .view,
     .list-row) are registered too, scoped to their nearest id container. */
  const classRe = /<(button|div|main|nav|span|a|li)\b[^>]*class="([^"]*)"[^>]*>/g;
  while((m = classRe.exec(bodyHtml)) !== null){
    const attrAll = m[0];
    if(/\bid="/.test(attrAll)) continue;
    const el = mkEl(m[1], '');
    m[2].split(/\s+/).filter(Boolean).forEach(c => el.classList.add(c));
    const dataTab = attrAll.match(/data-tab="([^"]+)"/);
    if(dataTab) el.dataset.tab = dataTab[1];
    const dataFilter = attrAll.match(/data-filter="([^"]+)"/);
    if(dataFilter) el.dataset.filter = dataFilter[1];
    const dataStatus = attrAll.match(/data-status="([^"]+)"/);
    if(dataStatus) el.dataset.status = dataStatus[1];
    const onclick = attrAll.match(/onclick="([^"]+)"/);
    if(onclick) el.setAttribute('onclick', onclick[1]);
    const owner = containers.filter(c => c.at < m.index).pop();
    el._scope = owner ? owner.id : null;
  }

  return dom;
}

/* =========================================================
   LOAD THE APP
   ---------------------------------------------------------
   `overrides.appId` rewrites APP_CONFIG.id before evaluation, which
   is how the cross-app collision contracts run two identities
   against one shared localStorage.

   Screen options, all optional:
     viewport: { width, height, dpr, insets: { top, right, bottom, left } }
     reducedMotion: true      the system asks for less motion at boot
     search: '?tune'          the page's query string
   ========================================================= */
const BRIDGE = [
  /* foundation */
  'APP_CONFIG', 'APP_UPDATES', 'APP_VERSION', 'APP_ID_PATTERN',
  'STORAGE_NAMESPACE', 'CACHE_NAMESPACE', 'KEYS',
  'Store', 'DATA_SCHEMA_VERSION', 'MIGRATIONS', 'migrationWarning', 'Domain', 'currentTab',
  'TOAST_MS', 'MAX_TOASTS', 'TOAST_VARIANTS',
  'OVERLAY_Z_BASE', '_openSheetStack', '_sheetOpeners', '_lockDepth', '_lockedScrollY',
  '_historyDepth', '_pendingSelfPops', '_confirmResolve',
  /* product: the slicing game */
  'TUNING_DEFAULTS', 'TUNING', 'TUNING_SPEC', 'SLICE', 'TUNE_ENABLED',
  'game', 'roll', 'pieces', 'gesture', 'layout', 'colors', 'hint', 'trail', 'healing', 'paint',
  'pauses', 'frameId', 'lastFrameAt', 'reducedMotion', 'gx', 'stageEl', 'ctx2d', 'wired'
];

const NO_INSETS = { top: 0, right: 0, bottom: 0, left: 0 };

function loadApp(opts){
  const o = opts || {};
  const src = readApp();
  let code = mainScript(src);

  if(o.appId){
    const before = code;
    code = code.replace(/(\bid:\s*)'[^']*'/, "$1'" + o.appId + "'");
    if(code === before) throw new Error('could not override APP_CONFIG.id');
  }

  const dom = buildDom(src);
  const storage = makeLocalStorage(o.sharedStorage, o.failWrites);
  const errors = [];
  const logs = [];
  const report = msg => errors.push(String(msg));
  dom.reportError = report;
  const clock = makeClock(report);
  const timers = clock.stats;

  const vp = Object.assign({ width: 1024, height: 768, dpr: 2 }, o.viewport || {});
  const screen = { width: vp.width, height: vp.height, dpr: vp.dpr,
                   insets: Object.assign({}, NO_INSETS, vp.insets || {}) };
  dom.viewport = screen;
  const tokens = rootTokens(src);
  const motion = makeMediaQuery('(prefers-reduced-motion: reduce)', !!o.reducedMotion);
  const resizeObservers = [];

  /* Every network API records instead of reaching anything, so a
     contract can prove that play sends nothing anywhere. */
  const net = [];
  const netLog = kind => (...a) => { net.push({ kind, target: String(a[0]) }); };

  const sandbox = {
    console: {
      log: (...a) => logs.push(a.join(' ')),
      warn: (...a) => logs.push(a.join(' ')),
      error: (...a) => errors.push(a.map(String).join(' '))
    },
    document: dom.document,
    navigator: {
      serviceWorker: { register: () => Promise.resolve() },
      vibrate: () => true,
      sendBeacon: (...a) => { netLog('sendBeacon')(...a); return true; }
    },
    location: { protocol: 'https:', origin: 'https://example.github.io', href: '',
                search: o.search || '', reload(){} },
    history: { pushState(){}, replaceState(){}, back(){} },
    setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout,
    setInterval: clock.setInterval, clearInterval: clock.clearInterval,
    requestAnimationFrame: clock.requestAnimationFrame,
    cancelAnimationFrame: clock.cancelAnimationFrame,
    performance: { now: () => clock.now },
    getComputedStyle(el){
      const probe = el && el.id === 'safeProbe';
      const px = v => (probe ? v : 0) + 'px';
      return {
        getPropertyValue: name => tokens[name] !== undefined ? tokens[name] : '',
        paddingTop: px(screen.insets.top), paddingRight: px(screen.insets.right),
        paddingBottom: px(screen.insets.bottom), paddingLeft: px(screen.insets.left)
      };
    },
    ResizeObserver: class {
      constructor(cb){ this.cb = cb; this.targets = []; resizeObservers.push(this); }
      observe(el){ this.targets.push(el); }
      unobserve(el){ this.targets = this.targets.filter(t => t !== el); }
      disconnect(){ const i = resizeObservers.indexOf(this); if(i > -1) resizeObservers.splice(i, 1); }
    },
    fetch: (...a) => { netLog('fetch')(...a); return new Promise(() => {}); },
    XMLHttpRequest: class { open(m, u){ netLog('xhr')(u); } send(){} setRequestHeader(){} abort(){} },
    WebSocket: class { constructor(u){ netLog('websocket')(u); } send(){} close(){} },
    EventSource: class { constructor(u){ netLog('eventsource')(u); } close(){} },
    Image: class { set src(u){ netLog('image')(u); } get src(){ return ''; } },
    Blob: class { constructor(p){ this.parts = p; } },
    URL: Object.assign(function(u){ return { origin: 'https://example.github.io', href: u }; },
                       { createObjectURL: () => 'blob:x', revokeObjectURL(){} }),
    FileReader: class {
      readAsText(file){ this.result = file && file._text || ''; if(this.onload) this.onload(); }
    },
    Math, JSON, Date, Object, Array, String, Number, Boolean, RegExp, Error,
    parseInt, parseFloat, isNaN, isFinite, Promise, Set, Map, Symbol,
    __errors: errors, __logs: logs, __timers: timers
  };
  /* In a browser `window` IS the global object, so `window[name]` finds the
     app's own functions: the overlay engine looks a sheet's close function up
     that way. A plain object here would make that lookup always miss. */
  const win = {
    localStorage: storage,
    scrollY: 0, pageYOffset: 0,
    innerWidth: screen.width, innerHeight: screen.height, devicePixelRatio: screen.dpr,
    scrollTo(arg){ sandbox.window.scrollY = (arg && arg.top) || 0; },
    addEventListener(type, fn){ (sandbox.window._listeners[type] = sandbox.window._listeners[type] || []).push(fn); },
    removeEventListener(type, fn){
      const l = sandbox.window._listeners[type]; if(!l) return;
      const i = l.indexOf(fn); if(i > -1) l.splice(i, 1);
    },
    _listeners: {},
    dispatch(type, ev){ dom.dispatchTo(sandbox.window, type, ev); },
    matchMedia: q => q === motion.media ? motion :
      { matches: false, media: q, addEventListener(){}, removeEventListener(){}, addListener(){}, removeListener(){} },
    requestAnimationFrame: clock.requestAnimationFrame,
    cancelAnimationFrame: clock.cancelAnimationFrame,
    getComputedStyle: sandbox.getComputedStyle,
    MutationObserver: undefined
  };
  sandbox.window = new Proxy(win, {
    get: (t, k) => (k in t ? t[k] : sandbox[k]),
    has: (t, k) => (k in t || k in sandbox)
  });
  if(o.windowExtras) Object.assign(sandbox.window, o.windowExtras);
  sandbox.globalThis = sandbox;
  sandbox.localStorage = storage;

  /* Time, the screen and the system's motion setting are changed only by
     the test, through these. */
  sandbox.__clock = clock;
  sandbox.__advance = ms => clock.advance(ms);
  sandbox.__frame = () => clock.frame();
  sandbox.__net = net;
  sandbox.__motion = motion;
  sandbox.__screen = screen;
  sandbox.__resizeObservers = resizeObservers;
  sandbox.__setReducedMotion = on => motion.set(on, report);
  sandbox.__resize = (width, height, insets) => {
    screen.width = width; screen.height = height;
    if(insets) screen.insets = Object.assign({}, NO_INSETS, insets);
    sandbox.window.innerWidth = width; sandbox.window.innerHeight = height;
    resizeObservers.slice().forEach(ro => {
      try{ ro.cb(ro.targets.map(t => ({ target: t, contentRect: { width, height } }))); }
      catch(e){ report('resize observer: ' + (e && e.stack || e)); }
    });
    sandbox.window.dispatch('resize', {});
  };

  /* Minimal MutationObserver: registered like the real one, but fired on
     demand by a test through ctx.__flush(), so contracts drive the engine
     deterministically instead of racing a real observer. */
  const observers = [];
  sandbox.MutationObserver = class {
    constructor(cb){ this.cb = cb; observers.push(this); }
    observe(){}
    disconnect(){ const i = observers.indexOf(this); if(i > -1) observers.splice(i, 1); }
    takeRecords(){ return []; }
  };
  sandbox.window.MutationObserver = sandbox.MutationObserver;

  /* Top-level `let`/`const` in a VM context create LEXICAL bindings that are
     not attached to globalThis (unlike function declarations). A direct eval
     appended to the same scope can still see them, so each is bridged to a
     live accessor property — reads and writes hit the real binding. */
  const bootstrap = '\n;(function(){var __N=' + JSON.stringify(BRIDGE) + ';' +
    '__N.forEach(function(n){try{' +
    'eval(n);' +
    'Object.defineProperty(globalThis,n,{configurable:true,' +
    'get:function(){return eval(n);},' +
    'set:function(v){try{eval(n+"=v");}catch(e){}}});' +
    '}catch(e){}});})();';

  vm.createContext(sandbox);
  vm.runInContext(code + bootstrap, sandbox, { filename: 'app.js' });

  sandbox.__observers = observers;
  sandbox.__flush = () => observers.forEach(o => { try{ o.cb([]); }catch(e){} });
  sandbox.__storage = storage;

  /* Clicking a stub element runs its onclick in the app's own context. */
  dom.setOnclickEvaluator(expr => vm.runInContext(expr, sandbox));

  return { ctx: sandbox, dom, storage, errors, logs, timers, src, clock, net };
}

function settle(ms){ return new Promise(r => setTimeout(r, ms === undefined ? 30 : ms)); }

module.exports = {
  ROOT, APP_PATH, SW_PATH, MANIFEST_PATH, PKG_PATH,
  readApp, readSW, readManifest, readPkg,
  scriptBlocks, mainScript, styleBlock, bodyBlock, rootTokens,
  loadApp, settle, mulberry32, makeLocalStorage, makeClock, BRIDGE
};
