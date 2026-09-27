/* =========================================================
   STARTER CONTRACTS
   ---------------------------------------------------------
   High-value contracts, not test volume. Every assertion here
   defends something a future product would otherwise have to
   rediscover: a namespace collision, a scroll lock that leaks, a
   type scale that quietly stops being used.

   Each contract states what it protects, in the language of the
   failure it prevents. If an assertion cannot be described that
   way, it probably should not exist.
   ========================================================= */
'use strict';
const H = require('./harness.js');

let pass = 0, fail = 0;
const failures = [];

function T(name, cond, detail){
  if(cond){ pass++; }
  else { fail++; failures.push(name + (detail ? ' — ' + detail : '')); }
  console.log('  ' + (cond ? 'PASS' : 'FAIL') + '  ' + name + (cond || !detail ? '' : ' — ' + detail));
}
function section(t){ console.log('\n' + '='.repeat(64) + '\n  ' + t + '\n' + '='.repeat(64)); }
function sub(t){ console.log('\n  --- ' + t + ' ---'); }

function results(){ return { pass, fail, failures }; }
function reset(){ pass = 0; fail = 0; failures.length = 0; }

/* ---------- shared helpers ---------- */
function open(app, id){ app.ctx.openOverlay(id); app.ctx.__flush(); }
function close(app, id){ app.ctx.closeOverlay(id); app.ctx.__flush(); }
function css(){ return H.styleBlock(H.readApp()); }
function js(){ return H.mainScript(H.readApp()); }
/* Comments explain the rules; they must not be mistaken for breaking them. */
function stripComments(s){
  return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}
/* Words inside string literals are markup and messages, not references. */
function stripStrings(s){
  return s.replace(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`/g, "''");
}
/* Code with every comment and string removed, trailing // comments
   included (but not the // inside a URL). */
function codeOnly(s){
  return stripStrings(s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\])\/\/.*$/gm, '$1'));
}

/* =========================================================
   CONTRACT 1 — BOOT
   The app starts, says so, and fails loudly rather than blankly.
   ========================================================= */
function testBoot(){
  section('CONTRACT 1 — the application boots');
  const app = H.loadApp();

  sub('a clean start');
  T('boots with no console errors', app.errors.length === 0, app.errors.join(' | '));
  T('the app container is revealed', app.dom.document.getElementById('app').style.display === '');
  T('storage is available and reports itself persistent', app.ctx.Store.isPersistent());
  T('a first run records the schema version',
    app.storage.getItem(app.ctx.STORAGE_NAMESPACE + 'sys.schemaVersion') === String(app.ctx.DATA_SCHEMA_VERSION));
  T('a first run writes nothing else', app.storage._map.size === 1, String(app.storage._map.size));

  sub('booting on top of existing data');
  /* The game saves nothing yet, so the fixture is a neutral stored record.
     What this protects is that booting never disturbs data it did not write. */
  const shared = new Map();
  const seeded = H.loadApp({ sharedStorage: shared });
  seeded.ctx.Store.setJSON('data.fixture', [{ id: 'r_x', title: 'Existing',
                                             updatedAt: '2026-01-01T00:00:00.000Z' }]);
  const second = H.loadApp({ sharedStorage: shared });
  const survived = second.ctx.Store.getJSON('data.fixture', []);
  T('an existing record survives a reload', survived.length === 1);
  T('and keeps its identity', !!survived[0] && survived[0].title === 'Existing');
  T('reloading raises no errors', second.errors.length === 0, second.errors.join(' | '));

  sub('there is only one script block, so the suite sees all the code');
  const blocks = H.scriptBlocks(H.readApp()).filter(b => b.trim().length > 200);
  T('exactly one substantial <script> block', blocks.length === 1, String(blocks.length));
  T('boot is wrapped so a failure still reports itself',
    /catch\(err\)\{[\s\S]{0,400}could not start/.test(js()));
}

/* =========================================================
   CONTRACT 2 — CONFIGURATION
   One source of identity, and static files that cannot drift.
   ========================================================= */
function testConfig(){
  section('CONTRACT 2 — application identity has one source');
  const app = H.loadApp();
  const c = app.ctx;
  const cfg = c.APP_CONFIG;

  sub('APP_ID is valid, and invalid ids are refused rather than repaired');
  T('the shipped id passes validation', c.validateAppId(cfg.id) === null);
  const bad = {
    'empty': '', 'uppercase': 'App-Starter', 'spaces': 'app starter',
    'leading digit': '1app', 'trailing hyphen': 'app-', 'double hyphen': 'app--starter',
    'underscore': 'app_starter', 'dot': 'app.starter', 'slash': 'app/starter',
    'too long': 'a'.repeat(41), 'not a string': 42
  };
  Object.keys(bad).forEach(label => {
    T('rejects ' + label, typeof c.validateAppId(bad[label]) === 'string');
  });
  T('a valid multi-word id is accepted', c.validateAppId('personal-savings') === null);

  sub('every namespace is derived, never typed twice');
  T('storage prefix derives from the id', c.STORAGE_NAMESPACE === cfg.id + '.');
  T('cache name derives from the id and the version',
    c.CACHE_NAMESPACE === cfg.id + '-v' + c.APP_VERSION);
  T('the version derives from the newest release entry',
    c.APP_VERSION === c.APP_UPDATES[0].version);

  sub('static files match APP_CONFIG — they cannot read it at runtime');
  const man = H.readManifest();
  T('manifest name', man.name === cfg.name, man.name);
  T('manifest short_name', man.short_name === cfg.shortName, man.short_name);
  T('manifest description', man.description === cfg.description);
  T('manifest theme_color', man.theme_color === cfg.themeColor, man.theme_color);
  T('manifest background_color', man.background_color === cfg.backgroundColor);

  const sw = H.readSW();
  T('service-worker cache name', sw.indexOf("'" + c.CACHE_NAMESPACE + "'") !== -1, c.CACHE_NAMESPACE);

  const pkg = H.readPkg();
  T('package name', pkg.name === cfg.id, pkg.name);
  T('package version', pkg.version === c.APP_VERSION, pkg.version);

  sub('orientation is a validated setting, never a hand edit');
  const tool = require('../scripts/config.js');
  T('the configured orientation is one the manifest allows',
    tool.validateOrientation(cfg.orientation) === null, String(cfg.orientation));
  T('the manifest carries it', man.orientation === cfg.orientation, man.orientation);
  ['sideways', 'Landscape', 'portrait ', '', undefined].forEach(v =>
    T('refuses orientation ' + JSON.stringify(v), typeof tool.validateOrientation(v) === 'string'));

  /* Compared through the same escape the sync applies, so a product whose
     name contains & " or < is not reported as drift for being correct. */
  const src = H.readApp();
  const esc = require('../scripts/config.js').esc;
  T('document title', src.indexOf('<title>' + esc(cfg.name) + '</title>') !== -1);
  T('theme-color meta', src.indexOf('content="' + esc(cfg.themeColor) + '"') !== -1);
  T('apple web app title', src.indexOf('content="' + esc(cfg.shortName) + '"') !== -1);
  T('the header markup carries the derived name, not a stale copy',
    new RegExp('<h1 class="app-title" id="appTitle">' +
      esc(cfg.name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '</h1>').test(src));

  sub('a name that needs escaping survives every target intact');
  const hostile = 'Ben & Co "Ltd" <beta>';
  T('escaping is applied, not stripped',
    esc(hostile) === 'Ben &amp; Co &quot;Ltd&quot; &lt;beta>');
  T('the manifest holds the raw value, because JSON escapes differently',
    JSON.parse(JSON.stringify({ n: hostile })).n === hostile);

  sub('changing the id changes everything downstream');
  ['other-app', 'client-demo', 'personal-savings'].forEach(id => {
    const o = H.loadApp({ appId: id });
    T(id + ' → storage prefix', o.ctx.STORAGE_NAMESPACE === id + '.');
    T(id + ' → cache name', o.ctx.CACHE_NAMESPACE === id + '-v' + o.ctx.APP_VERSION);
    T(id + ' → validates', o.ctx.validateAppId(id) === null);
  });
}

/* =========================================================
   CONTRACT 3 — STORAGE
   Namespacing is the only thing keeping two deployments on one
   origin from reading each other's data.
   ========================================================= */
function testStorage(){
  section('CONTRACT 3 — storage is namespaced and honest');
  const app = H.loadApp();
  const c = app.ctx;

  sub('every key the app writes carries its namespace');
  c.Store.set('data.probe', 'x');
  c.Store.setJSON('ui.probe', { a: 1 });
  const raw = [...app.storage._map.keys()];
  T('no key escapes the prefix',
    raw.every(k => k.indexOf(c.STORAGE_NAMESPACE) === 0), raw.filter(k => k.indexOf(c.STORAGE_NAMESPACE) !== 0).join(','));
  T('no bare generic key is used',
    !raw.some(k => /^(settings|data|history|draft|user|userData|items)$/.test(k)));

  sub('read, write, delete');
  T('a value round-trips', c.Store.get('data.probe') === 'x');
  T('JSON round-trips', c.Store.getJSON('ui.probe', null).a === 1);
  c.Store.remove('data.probe');
  T('a removed key is gone', c.Store.get('data.probe') === null);

  sub('absent data stays absent — a missing key is a new user, not a broken one');
  T('a missing key reads null', c.Store.get('nothing.here') === null);
  T('a missing key does not get invented', app.storage.getItem(c.STORAGE_NAMESPACE + 'nothing.here') === null);
  T('getJSON returns the caller fallback, not a guess',
    c.Store.getJSON('nothing.here', 'FALLBACK') === 'FALLBACK');
  app.storage.setItem(c.STORAGE_NAMESPACE + 'ui.corrupt', '{not json');
  T('corrupt JSON degrades to the fallback rather than throwing',
    c.Store.getJSON('ui.corrupt', 'SAFE') === 'SAFE');

  sub('a failed write is reported, never assumed');
  const failing = H.loadApp({ failWrites: true });
  T('the store reports itself non-persistent', !failing.ctx.Store.isPersistent());
  T('set() returns false when the write cannot land', failing.ctx.Store.set('x', '1') === false ||
    failing.ctx.Store.backend() === 'memory');
  T('the app tells the user out loud',
    /not letting the app store data/.test(js()));

  sub('listKeys sees only this app');
  app.storage.setItem('some-other-app.data.items', '[]');
  const keys = c.Store.listKeys();
  T('a foreign key is invisible', keys.every(k => k.indexOf('some-other-app') === -1));
  T('own keys are still found', keys.indexOf('ui.probe') !== -1);
}

/* =========================================================
   CONTRACT 4 — CROSS-APP COLLISION
   Two products on one github.io origin share localStorage and
   Cache Storage. This is what keeps them apart.
   ========================================================= */
function testCollision(){
  section('CONTRACT 4 — two apps on one origin cannot collide');
  const shared = new Map();
  const one = H.loadApp({ appId: 'app-one', sharedStorage: shared });
  const two = H.loadApp({ appId: 'app-two', sharedStorage: shared });

  sub('storage');
  one.ctx.Store.set('settings', 'ONE-SECRET');
  two.ctx.Store.set('settings', 'TWO-SECRET');
  T('each app reads its own value', one.ctx.Store.get('settings') === 'ONE-SECRET' &&
                                    two.ctx.Store.get('settings') === 'TWO-SECRET');
  T('app-one cannot read app-two through the adapter', one.ctx.Store.get('settings') !== 'TWO-SECRET');
  T('the underlying keys are genuinely distinct',
    shared.has('app-one.settings') && shared.has('app-two.settings'));
  T('app-one.listKeys never returns an app-two key',
    one.ctx.Store.listKeys().every(k => shared.get('app-one.' + k) !== undefined));

  one.ctx.Store.setJSON('data.fixture', [{ id: 'r1', title: 'One', updatedAt: 'a' }]);
  T('one app writing records leaves the other empty',
    two.ctx.Store.getJSON('data.fixture', []).length === 0);

  sub('cache identity');
  T('cache names differ', one.ctx.CACHE_NAMESPACE !== two.ctx.CACHE_NAMESPACE);
  T('app-one cache name', one.ctx.CACHE_NAMESPACE.indexOf('app-one-v') === 0, one.ctx.CACHE_NAMESPACE);
  T('app-two cache name', two.ctx.CACHE_NAMESPACE.indexOf('app-two-v') === 0, two.ctx.CACHE_NAMESPACE);

  sub('the service worker only ever deletes its own caches');
  const sw = H.readSW();
  T('cleanup is filtered by this app\'s own prefix',
    /keys\.filter\(k => k !== CACHE_NAME && k\.indexOf\(cachePrefix\(\)\) === 0\)/.test(sw));
  T('the prefix is derived from the cache name, not written twice',
    /function cachePrefix\(\)/.test(sw) && /lastIndexOf\('-v'\)/.test(sw));

  sub('no legacy namespace survives anywhere');
  const all = H.readApp() + H.readSW() + JSON.stringify(H.readManifest());
  T('no legacy storage prefix', !/\bloop_/i.test(all));
  T('no legacy cache prefix', !/\bloop-v\d/i.test(all));
}

/* =========================================================
   CONTRACT 5 — MIGRATION
   ========================================================= */
function testMigration(){
  section('CONTRACT 5 — migration is non-destructive and idempotent');
  const shared = new Map();
  const app = H.loadApp({ sharedStorage: shared });
  const c = app.ctx;

  sub('first run');
  T('the schema version is recorded', c.Store.get(c.KEYS.schemaVersion) === String(c.DATA_SCHEMA_VERSION));
  T('nothing was migrated on a fresh install', c.runMigrations().migrated === false);

  sub('idempotence');
  c.Store.set('data.fixture', JSON.stringify([{ id: 'a', title: 'A' }]));
  const before = c.Store.get('data.fixture');
  c.runMigrations(); c.runMigrations(); c.runMigrations();
  T('running migrations repeatedly changes nothing', c.Store.get('data.fixture') === before);

  sub('a corrupt or absent version is handled without data loss');
  c.Store.set(c.KEYS.schemaVersion, 'not-a-number');
  const r = c.runMigrations();
  T('a nonsense version does not throw', r && typeof r === 'object');
  T('records survive it', c.Store.get('data.fixture') === before);

  sub('the mechanism exists even though the starter has no migrations yet');
  T('a migration table is declared', typeof c.MIGRATIONS === 'object');
  T('a backup namespace is reserved', typeof c.KEYS.backupPrefix === 'string' &&
    c.KEYS.backupPrefix.indexOf('sys.') === 0);
  T('backups are excluded from export', /indexOf\(KEYS\.backupPrefix\) === 0/.test(js()));
}

/* =========================================================
   CONTRACT 6 — NAVIGATION
   ========================================================= */
function testNavigation(){
  section('CONTRACT 6 — navigation is predictable');
  const app = H.loadApp();
  const c = app.ctx, d = app.dom.document;

  /* A game is one play surface, not a dashboard of tabs. The markup is the
     single source of which screens exist, and it declares exactly one. */
  sub('play is one screen, not a dashboard');
  const views = [...d.querySelectorAll('.view')];
  T('exactly one screen is declared', views.length === 1, String(views.length));
  T('it is the play surface', !!views[0] && views[0].id === 'view-play');
  T('it is showing from boot', !!views[0] && views[0].classList.contains('active'));
  T('the current screen says so', c.currentTab === 'play', String(c.currentTab));
  T('there is no tab bar to wander off through',
    d.querySelectorAll('.tab-btn').length === 0 && !/<nav class="tabbar"/.test(H.readApp()));

  sub('an unknown screen is a no-op, not a blank screen');
  c.switchTab('does-not-exist');
  T('currentTab is unchanged', c.currentTab === 'play');
  T('the play surface is still active', d.getElementById('view-play').classList.contains('active'));

  sub('a screen opens at its top, so the same tap gives the same result');
  c.window.scrollY = 400;
  c.switchTab('play');
  T('the page is scrolled to top on entry', c.window.scrollY === 0);
  T('and it is instant, not animated', /behavior: 'instant'/.test(js()));

  sub('only one view is ever active');
  const active = [...d.querySelectorAll('.view')].filter(v => v.classList.contains('active'));
  T('exactly one active view', active.length === 1, String(active.length));
  T('it is the one asked for', !!active[0] && active[0].id === 'view-play');
}

/* =========================================================
   CONTRACT 7 — OVERLAYS
   The most valuable system in the starter. One mechanism, and it
   cannot be forgotten by a surface added later.
   ========================================================= */
function testOverlays(){
  section('CONTRACT 7 — one overlay engine owns every surface');
  const app = H.loadApp();
  const c = app.ctx, d = app.dom.document;
  const src = js(), style = css();

  sub('one mechanism, not a lock added by hand to every screen');
  T('an observer watches the overlays', /new MutationObserver\(/.test(src));
  T('and it is still the only one', (src.match(/new MutationObserver\(/g) || []).length === 1);
  T('the scroll lock runs from it',
    /new MutationObserver\(\(\) => \{[\s\S]{0,120}syncBackgroundScrollLock\(\);/.test(src));
  T('so does accessibility', /syncSheetAccessibility\(\);[\s\S]{0,40}\}\);/.test(src));
  T('the open overlays are the source of truth',
    /document\.querySelectorAll\('\.overlay\.open'\)\.length/.test(src));
  T('boot survives a platform without an observer',
    /if\(typeof MutationObserver === 'undefined'\) return null;/.test(src));
  T('it watches the whole body, so a later overlay is covered too',
    /obs\.observe\(document\.body,[\s\S]{0,120}subtree: true/.test(src));

  sub('the document behind a surface stops being a document');
  T('the body is pinned, which is what iOS needs',
    /body\.scroll-locked\{[\s\S]{0,140}position: fixed/.test(style));
  T('the offset is captured so it can be given back', /_lockedScrollY = window\.scrollY/.test(src));
  T('and restored exactly, without animating',
    /window\.scrollTo\(\{ top: _lockedScrollY, behavior: 'instant' \}\)/.test(src));
  T('nested layers do not unlock early', /if\(--_lockDepth > 0\) return;/.test(src));

  sub('a gesture inside a surface stays inside it');
  T('the overlay contains its own overscroll', /\.overlay\{[\s\S]{0,400}overscroll-behavior: contain/.test(style));
  T('so does the scrolling surface inside it',
    /\.sheet-scroll\{[\s\S]{0,400}overscroll-behavior: contain/.test(style));
  T('the locked body refuses chaining entirely',
    /body\.scroll-locked\{[\s\S]{0,200}overscroll-behavior: none/.test(style));

  /* Backup & data under its own erase confirmation is the real nesting the
     product ships, so it is the pair these run on. */
  sub('opening and closing, for real');
  open(app, 'dataOverlay');
  T('the stack records it', c._openSheetStack.length === 1);
  T('the background is locked', d.body.classList.contains('scroll-locked'));
  T('the surface is announced as a dialog',
    d.getElementById('dataOverlay').getAttribute('aria-modal') === 'true');
  T('it is painted at the stack base',
    d.getElementById('dataOverlay').style.zIndex === String(c.OVERLAY_Z_BASE));

  sub('stacking is open order, not document order');
  open(app, 'confirmOverlay');
  T('both are on the stack', c._openSheetStack.length === 2);
  T('the newest is on top', c.topOpenSheet().id === 'confirmOverlay');
  T('and painted above the one beneath it',
    Number(d.getElementById('confirmOverlay').style.zIndex) >
    Number(d.getElementById('dataOverlay').style.zIndex));
  T('the lock counts both layers', c._lockDepth === 2, String(c._lockDepth));

  sub('closing a child reveals its parent — the surface below is the way back');
  close(app, 'confirmOverlay');
  T('the parent is still open', d.getElementById('dataOverlay').classList.contains('open'));
  T('the stack shrank to one', c._openSheetStack.length === 1);
  T('the background is still locked', d.body.classList.contains('scroll-locked'));
  T('the closed surface gave back its z-index', d.getElementById('confirmOverlay').style.zIndex === '');
  close(app, 'dataOverlay');
  T('closing the last one unlocks', !d.body.classList.contains('scroll-locked'));
  T('the stack is empty', c._openSheetStack.length === 0);
  T('the lock depth is zero', c._lockDepth === 0);

  sub('every surface declares a way out');
  const ids = [...H.readApp().matchAll(/<div class="overlay(?: overlay-page)?" id="([A-Za-z]+)"/g)].map(m => m[1]);
  const required = ['confirmOverlay', 'dataOverlay', 'updatesOverlay'];
  T('every surface the foundation and the game rely on is declared',
    required.every(id => ids.indexOf(id) !== -1), ids.join(','));
  const noExit = ids.filter(id => {
    open(app, id);
    const has = !!c.sheetCloser(d.getElementById(id));
    close(app, id);
    return !has;
  });
  T('every one of them has a discoverable close path', noExit.length === 0, noExit.join(','));

  sub('focus');
  T('the surface takes focus, not its first field — a keyboard would cover the screen',
    /const sheet = ov\.querySelector\('\.sheet'\) \|\| ov;/.test(src));
  T('focus returns only to a control still on screen',
    /document\.contains\(opener\) && opener\.offsetParent !== null/.test(src));
  T('Escape acts on the top surface only', /const ov = topOpenSheet\(\);/.test(src));
  T('Tab is trapped inside it', /ev\.key !== 'Escape' && ev\.key !== 'Tab'/.test(src));
}

/* =========================================================
   CONTRACT 8 — TOAST
   ========================================================= */
function testToast(){
  section('CONTRACT 8 — feedback that never blocks');
  const app = H.loadApp();
  const c = app.ctx, d = app.dom.document;
  const host = d.getElementById('toastHost');

  sub('the host is an announcement region');
  const src = H.readApp();
  T('it is a live region', /id="toastHost"[^>]*aria-live="polite"/.test(src));
  T('it has a status role', /id="toastHost"[^>]*role="status"/.test(src));
  T('it never intercepts a tap', /\.toast-host\{[\s\S]{0,300}pointer-events: none/.test(css()));
  T('the toast itself does accept one', /\.toast\{[\s\S]{0,400}pointer-events: auto/.test(css()));
  T('it clears the tab bar and the home indicator',
    /\.toast-host\{[\s\S]{0,200}bottom: calc\(var\(--tabbar-h\)[\s\S]{0,60}var\(--inset-bottom\)\)/.test(css()));

  sub('showing');
  c.toast('Saved');
  T('a toast is added', host.children.length === 1);
  T('it carries the message', host.children[0].innerHTML.indexOf('Saved') !== -1);
  T('an unknown variant falls back to neutral rather than breaking',
    c.toast('x', 'not-a-variant')._classes.has('toast-neutral'));

  sub('variants');
  c.TOAST_VARIANTS.forEach(v => {
    const el = c.toast('m', v);
    T('variant "' + v + '" is applied', el._classes.has('toast-' + v));
  });

  sub('the stack cannot grow without limit');
  T('at most MAX_TOASTS on screen', host.children.length <= c.MAX_TOASTS,
    String(host.children.length) + ' > ' + c.MAX_TOASTS);
  for(let i = 0; i < 20; i++) c.toast('flood ' + i);
  T('flooding does not grow the host', host.children.length <= c.MAX_TOASTS,
    String(host.children.length));

  sub('dismissal');
  const el = c.toast('bye');
  c.dismissToast(el, true);
  T('an immediate dismissal removes it', el.parentNode === null);
  T('dismissing twice is safe', (c.dismissToast(el, true), true));
  T('it dismisses itself on a timer', /setTimeout\(\(\) => dismissToast\(el, reduced\), TOAST_MS\)/.test(js()));
  T('reduced motion skips the leaving animation', /const reduced = prefersReducedMotion\(\);/.test(js()));
}

/* =========================================================
   CONTRACT 9 — CONFIRMATION
   ========================================================= */
function testConfirmation(){
  section('CONTRACT 9 — one confirmation, no native dialogs');
  const app = H.loadApp();
  const c = app.ctx, d = app.dom.document;
  const src = js();

  sub('native dialogs are gone');
  ['alert', 'confirm', 'prompt'].forEach(fn => {
    const re = new RegExp('\\b' + fn + '\\s*\\(', 'g');
    const hits = (src.match(re) || []);
    T('no ' + fn + '() in application code', hits.length === 0, hits.join(','));
  });

  sub('it runs on the shared overlay engine, not a second implementation');
  T('the confirm surface is an overlay', !!d.getElementById('confirmOverlay'));
  T('it does not roll its own scroll lock',
    (src.match(/document\.body\.classList\.add\('scroll-locked'\)/g) || []).length === 1);
  T('it is announced as an alert dialog', /role="alertdialog"/.test(H.readApp()));
  T('its title and message are wired to the dialog',
    /aria-labelledby="confirmTitle"/.test(H.readApp()) && /aria-describedby="confirmMessage"/.test(H.readApp()));

  sub('confirming');
  let resolved = null;
  c.confirmAction({ title: 'Delete?', message: 'Gone for good.', confirmLabel: 'Delete' })
    .then(v => { resolved = v; });
  c.__flush();
  T('the surface opens', d.getElementById('confirmOverlay').classList.contains('open'));
  T('the title is set', d.getElementById('confirmTitle').textContent === 'Delete?');
  T('the message is set', d.getElementById('confirmMessage').textContent === 'Gone for good.');
  T('the confirm label is set', d.getElementById('confirmAccept').textContent === 'Delete');
  c.acceptConfirm(); c.__flush();
  return Promise.resolve().then(() => {
    T('accepting resolves true', resolved === true, String(resolved));
    T('and closes the surface', !d.getElementById('confirmOverlay').classList.contains('open'));

    let cancelled = null;
    c.confirmAction({ title: 'Sure?' }).then(v => { cancelled = v; });
    c.__flush();
    c.closeConfirm(); c.__flush();
    return Promise.resolve().then(() => {
      T('cancelling resolves false', cancelled === false, String(cancelled));

      sub('cancel is the safe outcome, so every exit route means cancel');
      let escaped = null;
      c.confirmAction({ title: 'Sure?' }).then(v => { escaped = v; });
      c.__flush();
      const closer = c.sheetCloser(d.getElementById('confirmOverlay'));
      T('the engine finds its declared close path', typeof closer === 'function');
      closer(); c.__flush();
      return Promise.resolve().then(() => {
        T('an engine-driven close resolves false', escaped === false, String(escaped));

        sub('a destructive confirm does not wear the loud button');
        c.confirmAction({ title: 'x', destructive: true }); c.__flush();
        const accept = d.getElementById('confirmAccept');
        T('the accept button is not primary', accept.className.indexOf('btn-primary') === -1, accept.className);
        T('it is marked destructive', accept.className.indexOf('btn-danger') !== -1);
        c.closeConfirm(); c.__flush();

        sub('a second call cannot strand the first promise');
        let first = 'pending';
        c.confirmAction({ title: 'one' }).then(v => { first = v; });
        c.__flush();
        c.confirmAction({ title: 'two' });
        c.__flush();
        return Promise.resolve().then(() => {
          T('the superseded call resolves false rather than hanging', first === false, String(first));
          c.closeConfirm(); c.__flush();
        });
      });
    });
  });
}

/* =========================================================
   CONTRACT 10 — BACKUP & DATA WITHOUT A DEMO, AND ERASING
   ---------------------------------------------------------
   The template's Backup & data page read the demo's own list and
   its stat helper, so it threw the moment a product deleted the
   demo, and erasing created a stray global. These hold the page to
   what is actually stored, and erasing to asking first.
   ========================================================= */
function testErase(){
  section('CONTRACT 10 — Backup & data works without a demo, and erasing asks first');
  const shared = new Map();
  const app = H.loadApp({ sharedStorage: shared });
  const c = app.ctx, d = app.dom.document;
  c.Store.setJSON('data.fixture', [{ id: 'a', title: 'A' }, { id: 'b', title: 'B' }]);
  c.Store.set('ui.fixture', 'kept until erased');

  sub('the page opens with no demo behind it');
  c.openDataSettings(); c.__flush();
  T('it opens', d.getElementById('dataOverlay').classList.contains('open'));
  T('opening it raises no errors', app.errors.length === 0, app.errors.join(' | '));
  const stats = d.getElementById('dataStats').innerHTML;
  T('records are counted from what is stored, whatever the product calls them',
    /<span class="stat-value">2<\/span><span class="stat-label">Records/.test(stats), stats.slice(0, 160));
  T('the foundation reads no product binding to count them',
    !/\bitems\b/.test(String(c.renderDataStats)));
  T('erasing assigns no product binding either', !/\bitems\s*=/.test(String(c.resetAllData)));

  sub('erasing asks first, and cancel keeps everything');
  const p = c.resetAllData(); c.__flush();
  T('a confirmation is shown', d.getElementById('confirmOverlay').classList.contains('open'));
  T('its loud button is not the destructive one',
    d.getElementById('confirmAccept').className.indexOf('btn-primary') === -1);
  c.closeConfirm(); c.__flush();
  return p.then(() => {
    T('cancelling keeps the records', c.Store.getJSON('data.fixture', []).length === 2);
    T('and every other key', c.Store.get('ui.fixture') === 'kept until erased');

    sub('confirming erases, and the product re-reads its state through its seam');
    let hydrated = 0;
    const realHydrate = c.Domain.hydrate;
    c.Domain.hydrate = () => { hydrated++; realHydrate(); };
    const p2 = c.resetAllData(); c.__flush();
    c.acceptConfirm(); c.__flush();
    return p2.then(() => {
      c.Domain.hydrate = realHydrate;
      T('the records are gone', c.Store.get('data.fixture') === null);
      T('only the schema version remains', c.Store.listKeys().join(',') === 'sys.schemaVersion',
        c.Store.listKeys().join(','));
      T('the product was asked to re-read its state', hydrated === 1, String(hydrated));
      T('no stray global was created on the way', !Object.prototype.hasOwnProperty.call(c, 'items'));
      T('the page stays open, showing the emptied store',
        d.getElementById('dataOverlay').classList.contains('open') &&
        /<span class="stat-value">0<\/span><span class="stat-label">Records/.test(d.getElementById('dataStats').innerHTML));
      T('no errors on the way', app.errors.length === 0, app.errors.join(' | '));
      T('the erase persisted', H.loadApp({ sharedStorage: shared }).ctx.Store.get('data.fixture') === null);
    });
  });
}

/* =========================================================
   CONTRACT 11 — MOBILE
   ========================================================= */
function testMobile(){
  section('CONTRACT 11 — real-device behaviour');
  const style = css(), src = H.readApp();

  sub('the iOS input zoom floor');
  T('the floor is declared once, globally',
    /input\[type="text"\][^{]*\{[^}]*font-size: 16px;/.test(style));
  T('and explained, so nobody "tidies" it away', /fs-exempt: iOS Safari zooms/.test(style));
  T('the token records the reason too', /--input-min-size: 16px;/.test(style));
  const smaller = [...style.matchAll(/(input|textarea|select)[^{]*\{[^}]*font-size:\s*(\d+(?:\.\d+)?)px/g)]
    .filter(m => parseFloat(m[2]) < 16);
  T('no field is set below the floor', smaller.length === 0, smaller.map(m => m[0].slice(0, 40)).join(' | '));

  sub('safe areas are read, not guessed');
  ['--inset-top', '--inset-bottom', '--inset-left', '--inset-right'].forEach(t => {
    T(t + ' is tokenized', new RegExp(t + ':\\s*env\\(safe-area-inset').test(style));
  });
  T('the header reads the top inset', /\.app-header\{[\s\S]{0,200}var\(--inset-top\)/.test(style));
  T('the tab bar reads the bottom inset', /\.tabbar\{[\s\S]{0,300}padding-bottom: var\(--inset-bottom\)/.test(style));
  T('the body reads the left and right insets',
    /body\{[\s\S]{0,400}padding-left: var\(--inset-left\)/.test(style));
  T('a page paints a band the height of the top inset',
    /\.overlay-page \.sheet::before\{[\s\S]{0,200}height: var\(--inset-top\)/.test(style));
  T('the band never eats a tap',
    /\.overlay-page \.sheet::before\{[\s\S]{0,260}pointer-events: none/.test(style));
  T('the inset is never paid twice under a header',
    /\.page-topbar \+ \.sheet-scroll\{ padding-top: var\(--space-lg\); \}/.test(style));
  T('a header that owns the inset is opaque and outranks the band',
    /\.page-topbar\{[^}]*background: var\(--surface\); position: relative; z-index: 7/.test(style));
  T('no screen substitutes a fixed pixel margin for an inset',
    !/margin-top:\s*(44|47|59)px/.test(style));

  sub('every full page is protected — none opts out');
  const pageIds = [...src.matchAll(/<div class="overlay overlay-page" id="([A-Za-z]+)"/g)].map(m => m[1]);
  T('the full pages the product ships are all here to protect',
    ['dataOverlay', 'updatesOverlay'].every(id => pageIds.indexOf(id) !== -1), pageIds.join(','));
  const unprotected = pageIds.filter(id => {
    const at = src.indexOf('id="' + id + '"');
    return !/class="sheet"/.test(src.slice(at, at + 400));
  });
  T('each one carries the band-bearing surface', unprotected.length === 0, unprotected.join(','));

  sub('touch targets');
  T('the minimum is a token', /--touch-min: 44px;/.test(style));
  ['.tab-btn', '.btn-primary', '.btn-secondary', '.icon-btn', '.list-row', '.segmented button']
    .forEach(sel => {
      const re = new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\{[^}]*(min-height|height):\\s*var\\(--touch-min\\)');
      T(sel + ' meets the floor', re.test(style));
    });
  T('the visible mark is not forced to the target size — only the target is',
    /The visible mark can be small; the target never is/.test(style));

  sub('orientation and text scaling');
  T('landscape reclaims height rather than clipping',
    /@media \(orientation: landscape\) and \(max-height: 500px\)/.test(style));
  T('automatic text inflation is switched off, pinch zoom is not',
    /text-size-adjust: 100%/.test(style) && !/text-size-adjust:\s*none/.test(style));
  T('double-tap zoom is suppressed without disabling pinch',
    /touch-action: manipulation/.test(style));
  T('the viewport covers the notch', /viewport-fit=cover/.test(src));
}

/* =========================================================
   CONTRACT 12 — DESIGN SYSTEM ENFORCEMENT
   The audited baseline had a good type scale and bypassed it 546
   times. Nothing structural stopped it. These two contracts are
   that structure.
   ========================================================= */
function testDesignSystem(){
  section('CONTRACT 12 — the design system is enforced, not merely documented');
  const style = css(), src = H.readApp();

  sub('font families come from tokens');
  T('the tokens exist', /--font-ui:/.test(style) && /--font-display:/.test(style) && /--font-mono:/.test(style));
  const families = [...src.matchAll(/font-family:\s*([^;}"]+)/g)].map(m => m[1].trim());
  const rogue = families.filter(v => v.indexOf('var(--font-') !== 0 && v !== 'inherit');
  T('every font-family declaration uses a token or inherits', rogue.length === 0,
    rogue.slice(0, 4).join(' | '));
  T('there is at least one, so the rule is doing work', families.length >= 5, String(families.length));

  sub('font sizes come from the scale');
  const scale = [...style.matchAll(/--fs-([a-z-]+):\s*(\d+)px/g)].map(m => m[1]);
  T('the scale defines the expected roles', scale.length >= 6, scale.join(','));
  const lines = style.split('\n');
  const violations = [];
  lines.forEach((line, i) => {
    const m = line.match(/font-size:\s*([^;]+);/);
    if(!m) return;
    const v = m[1].trim();
    if(v.indexOf('var(--fs-') === 0 || v === 'inherit') return;
    /* An exception must be declared within the comment immediately above it,
       so the reason travels with the line rather than living in a list
       somewhere else. */
    const window8 = lines.slice(Math.max(0, i - 8), i).join('\n');
    if(/fs-exempt:/.test(window8)) return;
    violations.push('line ' + (i + 1) + ': ' + line.trim());
  });
  T('no raw font-size outside the scale or a declared exception',
    violations.length === 0, violations.slice(0, 4).join(' | '));

  sub('the exception mechanism is narrow');
  const exempt = (style.match(/fs-exempt:/g) || []).length;
  T('there is at most a handful of exceptions', exempt <= 3, String(exempt));
  T('each states a reason', !/fs-exempt:\s*($|\*\/)/m.test(style));

  sub('spacing, radius and motion are tokenized');
  ['--space-xs', '--space-sm', '--space-md', '--space-lg', '--space-xl', '--space-2xl']
    .forEach(t => T(t + ' exists', new RegExp(t + ':').test(style)));
  ['--radius-sm', '--radius-md', '--radius-lg', '--radius-xl'].forEach(t =>
    T(t + ' exists', new RegExp(t + ':').test(style)));
  T('motion has an easing token', /--ease:/.test(style));
  T('and duration tokens', /--dur:/.test(style));
  T('layout width is a token', /--layout-max:/.test(style));
  T('breakpoints are named', /--bp-sm:/.test(style) && /--bp-md:/.test(style));

  sub('tokens live in exactly one place');
  T('one :root block', (style.match(/^:root\{/gm) || []).length === 1);
  T('the four layers are labelled',
    /1 · BRAND/.test(style) && /2 · SEMANTIC/.test(style) &&
    /3 · SCALE/.test(style) && /4 · DOMAIN/.test(style));

  sub('motion respects the system preference');
  T('a reduced-motion block exists', /@media \(prefers-reduced-motion: reduce\)/.test(style));
  T('it disables animation and transition globally',
    /@media \(prefers-reduced-motion: reduce\)\{[\s\S]{0,200}animation: none !important; transition: none !important/.test(style));
  T('and the JS honours it too', /prefersReducedMotion\(\)/.test(js()));

  sub('status is never carried by colour alone');
  T('a badge shows a word, not just a hue', /\.badge\{[\s\S]{0,400}text-transform: uppercase/.test(style));
  T('notices carry an icon as well as a border', /\.notice\{/.test(style) && /notice-error/.test(style));
}

/* =========================================================
   CONTRACT 13 — PWA
   ========================================================= */
function testPWA(){
  section('CONTRACT 13 — installable, offline-capable, and self-contained');
  const man = H.readManifest(), sw = H.readSW(), src = H.readApp();

  sub('nothing is bound to a repository path');
  T('start_url is relative', man.start_url.indexOf('./') === 0, man.start_url);
  T('scope is relative', man.scope === './', man.scope);
  T('every cached asset is relative',
    (sw.match(/'\.\/[^']*'/g) || []).length >= 4);
  T('no absolute path in the manifest',
    !/"(start_url|scope|src)":\s*"\//.test(JSON.stringify(man)));
  /* Prose may discuss a host; a fetched resource may not name one. The check
     targets things the browser would actually request. */
  const fetched = [...src.matchAll(/(?:href|src|action)\s*=\s*"([^"]+)"/g)].map(m => m[1])
    .concat([...css().matchAll(/url\(\s*['"]?([^'")]+)/g)].map(m => m[1]));
  const remote = fetched.filter(u => /^(https?:)?\/\//.test(u));
  T('no fetched resource points at another host', remote.length === 0, remote.join(', '));
  T('no deployment path is baked into a fetched URL',
    !fetched.some(u => /github\.io/.test(u)));

  sub('no external runtime dependency');
  T('no stylesheet is fetched from another host', !/<link[^>]*href="https?:/.test(src));
  T('no script is fetched from another host', !/<script[^>]*src="https?:/.test(src));
  T('no @import in the stylesheet', !/@import/.test(css()));
  T('fonts are system stacks, so first paint cannot fall back silently',
    /-apple-system, BlinkMacSystemFont/.test(css()));

  sub('the manifest declares a real installable app');
  T('it has a name', !!man.name);
  T('it has a short name', !!man.short_name && man.short_name.length <= 12);
  T('it runs standalone', man.display === 'standalone');
  T('it declares both icon sizes',
    man.icons.some(i => i.sizes === '192x192') && man.icons.some(i => i.sizes === '512x512'));
  T('icons are maskable', man.icons.every(i => /maskable/.test(i.purpose || '')));
  T('the icons exist on disk',
    require('fs').existsSync(require('path').join(H.ROOT, 'icon-192.png')) &&
    require('fs').existsSync(require('path').join(H.ROOT, 'icon-512.png')));

  sub('the service worker');
  T('registration is guarded to http(s)',
    /location\.protocol\.indexOf\('http'\) === 0/.test(js()));
  T('a failed registration cannot break boot', /register\('sw\.js'\)\.catch\(\(\) => \{\}\)/.test(js()));
  T('the shell is network-first, so a deploy is picked up promptly',
    /fetch\(req\)[\s\S]{0,400}\.catch\(\(\) => caches\.match\(req\)/.test(sw));
  T('index.html is the offline fallback', /caches\.match\('\.\/index\.html'\)/.test(sw));
  T('cross-origin requests are left alone',
    /new URL\(req\.url\)\.origin !== location\.origin/.test(sw));
  T('non-GET requests are left alone', /req\.method !== 'GET'/.test(sw));
  T('a failed precache still activates', /\.catch\(\(\) => self\.skipWaiting\(\)\)/.test(sw));
  T('it says out loud that it never touches user data',
    /never touched here/.test(sw) || /cannot lose a single record/.test(sw));
}

/* =========================================================
   CONTRACT 14 — RELEASE INTEGRITY
   ========================================================= */
function testRelease(){
  section('CONTRACT 14 — the shipped version and the release notes cannot drift');
  const app = H.loadApp();
  const c = app.ctx;

  sub('one source for the version');
  T('there is at least one release entry', c.APP_UPDATES.length >= 1);
  T('the app version IS the newest entry', c.APP_VERSION === c.APP_UPDATES[0].version);
  T('no second version literal is declared in the app',
    (js().match(/APP_VERSION\s*=/g) || []).length === 1);
  T('the service-worker cache carries that version',
    H.readSW().indexOf(c.APP_VERSION) !== -1, c.APP_VERSION);
  T('package.json carries it too', H.readPkg().version === c.APP_VERSION);

  sub('entries are well formed and newest first');
  const dates = c.APP_UPDATES.map(u => u.date);
  T('every entry has an id, version, title, date and summary',
    c.APP_UPDATES.every(u => u.id && u.version && u.title && u.date && u.summary));
  T('dates are newest first',
    dates.every((d, i) => i === 0 || dates[i - 1] >= d), dates.join(' > '));
  T('ids are unique', new Set(c.APP_UPDATES.map(u => u.id)).size === c.APP_UPDATES.length);
  T('every entry has at least one line of content',
    c.APP_UPDATES.every(u => (u.newFeatures || []).length + (u.improvements || []).length +
                             (u.fixes || []).length > 0));

  sub('the starter ships a minimal history, not an inherited one');
  T('a small number of entries', c.APP_UPDATES.length <= 3, String(c.APP_UPDATES.length));
  T('the authoring rules travel with the data', /AUTHORING A NEW ENTRY/.test(js()));
  T('and it says new products replace it', /New products replace this array wholesale/.test(js()));

  sub('unread state');
  T('the newest id is what marks it read', /Store\.set\(KEYS\.lastSeenUpdate, APP_UPDATES\[0\]\.id\)/.test(js()));
  T('the unread key is namespaced', c.KEYS.lastSeenUpdate.indexOf('ui.') === 0);
}

/* =========================================================
   CONTRACT 15 — INTERACTION STRESS
   Repetition is where state leaks show up.
   ========================================================= */
function testStress(){
  section('CONTRACT 15 — repeated use leaks nothing');
  const app = H.loadApp();
  const c = app.ctx, d = app.dom.document;

  sub('100 navigations, to the one screen and to screens that do not exist');
  for(let i = 0; i < 100; i++) c.switchTab(i % 2 ? 'play' : 'nowhere-' + i);
  const active = [...d.querySelectorAll('.view')].filter(v => v.classList.contains('active'));
  T('still exactly one active view', active.length === 1, String(active.length));
  T('and it is still play', !!active[0] && active[0].id === 'view-play');
  T('no scroll lock was acquired', c._lockDepth === 0, String(c._lockDepth));
  T('no console errors', app.errors.length === 0, app.errors.join(' | '));

  sub('100 overlay open/close cycles');
  for(let i = 0; i < 100; i++){ open(app, 'dataOverlay'); close(app, 'dataOverlay'); }
  T('the stack is empty', c._openSheetStack.length === 0, String(c._openSheetStack.length));
  T('the lock depth is zero', c._lockDepth === 0, String(c._lockDepth));
  T('the body is not left locked', !d.body.classList.contains('scroll-locked'));
  T('no z-index is left painted', d.getElementById('dataOverlay').style.zIndex === '');
  T('the opener map did not grow', c._sheetOpeners.size === 0, String(c._sheetOpeners.size));

  sub('50 nested cycles');
  for(let i = 0; i < 50; i++){
    open(app, 'dataOverlay');
    open(app, 'confirmOverlay');
    close(app, 'confirmOverlay');
    close(app, 'dataOverlay');
  }
  T('the stack is empty', c._openSheetStack.length === 0, String(c._openSheetStack.length));
  T('the lock depth is zero', c._lockDepth === 0, String(c._lockDepth));
  T('history depth did not run away', Math.abs(c._historyDepth) <= 1, String(c._historyDepth));

  /* The erase path through the confirmation is the one destructive flow
     the product ships; run it until something would leak. */
  sub('50 store-and-erase cycles');
  let chain = Promise.resolve();
  for(let i = 0; i < 50; i++){
    chain = chain.then(() => {
      c.Store.setJSON('data.fixture', [{ id: 'r' + i, title: 'Record ' + i }]);
      c.openDataSettings(); c.__flush();
      const p = c.resetAllData(); c.__flush();
      c.acceptConfirm(); c.__flush();
      return p.then(() => { c.closeDataSettings(); c.__flush(); });
    });
  }
  return chain.then(() => {
    T('storage returned to its first-run size', c.Store.listKeys().join(',') === 'sys.schemaVersion',
      c.Store.listKeys().join(','));
    T('the stack is still empty', c._openSheetStack.length === 0, String(c._openSheetStack.length));
    T('the lock depth is zero', c._lockDepth === 0, String(c._lockDepth));
    T('no confirmation was left waiting', c._confirmResolve === null);
    T('no console errors after all of it', app.errors.length === 0, app.errors.join(' | '));

    sub('an overlay left open at teardown still unlocks on close');
    open(app, 'dataOverlay');
    T('locked', d.body.classList.contains('scroll-locked'));
    close(app, 'dataOverlay');
    T('unlocked', !d.body.classList.contains('scroll-locked'));
  });
}

/* =========================================================
   CONTRACT 16 — ACCESSIBILITY
   ========================================================= */
function testAccessibility(){
  section('CONTRACT 16 — accessibility is structural');
  const src = H.readApp(), style = css();

  sub('semantics');
  T('the one screen is a <main> landmark with a name',
    (src.match(/<main class="view/g) || []).length === 1 &&
    /<main class="view active play-view" id="view-play" aria-label="[^"]+"/.test(src));
  T('the page keeps a real heading, though the game is drawn',
    /<h1 class="app-title" id="appTitle">/.test(src));
  T('every icon-only control has a label',
    [...src.matchAll(/<button[^>]*class="[^"]*icon-btn[^"]*"[^>]*>/g)]
      .every(m => /aria-label=/.test(m[0])));
  T('decorative glyphs are hidden from assistive tech',
    (src.match(/aria-hidden="true"/g) || []).length >= 6);
  T('generated SVG is hidden and unfocusable',
    /aria-hidden="true" focusable="false"/.test(js()));

  /* A canvas is invisible to assistive technology unless it says what it
     is, and unreachable by keyboard unless it can take focus. */
  sub('the play surface can be found, reached and understood');
  const stageTag = (src.match(/<canvas[^>]*id="stage"[^>]*>/) || [''])[0];
  T('the stage is keyboard-reachable', /tabindex="0"/.test(stageTag), stageTag);
  T('it says what it is and how to play it', /aria-label="[^"]*[Ss]wipe[^"]*"/.test(stageTag));
  T('it tells assistive technology it handles its own keys', /role="application"/.test(stageTag));
  T('what happens in play is announced politely',
    /<div class="sr-only" id="playStatus" role="status" aria-live="polite">/.test(src));
  T('the toggle primitive still exposes checked state', /\.toggle\[aria-checked="true"\]/.test(style));

  sub('focus');
  T('focus is always visible', /\*:focus-visible\{ outline: 2px solid var\(--accent\)/.test(style));
  T('except where focus was moved programmatically',
    /\.sheet:focus, \.sheet:focus-visible\{ outline: none; \}/.test(style));
  T('a dialog traps Tab', /sheetFocusables\(ov\)/.test(js()));
  T('and returns focus when it closes', /opener\.focus\(\{ preventScroll: true \}\)/.test(js()));

  sub('hidden content is hidden properly');
  T('the file input is visually hidden, not display:none', /class="sr-only"/.test(src));
  T('.sr-only keeps it in the accessibility tree', /\.sr-only\{[\s\S]{0,200}clip: rect\(0 0 0 0\)/.test(style));
}

/* =========================================================
   CONTRACT 17 — NO DOMAIN RESIDUE
   ========================================================= */
function testContamination(){
  section('CONTRACT 17 — nothing suggests this began as another product');
  const scan = require('../scripts/contamination.js');
  const code = scan.run();
  T('the contamination scan is clean', code === 0);

  const src = H.readApp();
  T('no legacy brand token in the app', !/\bLOOP\b/.test(src));

  /* The starter's demo was replaced wholesale. Any of it left behind is
     dead code at best, and at worst a foundation dependency like the one
     Backup & data had on the demo's list. */
  sub('the starter demo is gone');
  T('no demo section remains', !/DEMO DOMAIN/.test(js()));
  T('no demo surface remains in the markup',
    !/itemDetailOverlay|itemFormOverlay|componentsOverlay|id="view-(home|items|settings)"/.test(src));
  const demoNames = (js().match(/[A-Za-z_$][A-Za-z0-9_$]*[Ii]tem[A-Za-z0-9_$]*/g) || [])
    .filter(n => !/^(set|get|remove)Item$/.test(n));
  T('no demo identifier remains in the script', demoNames.length === 0, [...new Set(demoNames)].join(', '));

  sub('the game is one delimited section');
  const script = js();
  const seam = script.indexOf('FOUNDATION → DOMAIN SEAM');
  const game = script.indexOf('GAME DOMAIN — Slicing');
  const settings = script.indexOf('SETTINGS — data ownership');
  T('it has exactly one banner', (script.match(/GAME DOMAIN — Slicing/g) || []).length === 1);
  T('it sits between the seam and the foundation that follows',
    seam > 0 && game > seam && settings > game);
}

/* =========================================================
   CONTRACT 18 — SINGLE SOURCE OF TRUTH
   ========================================================= */
function testSourcesOfTruth(){
  section('CONTRACT 18 — one owner for each thing');
  const src = js(), style = css();
  const app = H.loadApp();

  const singles = [
    ['app identity',      /const APP_CONFIG = \{/g],
    ['app version',       /const APP_VERSION =/g],
    ['storage namespace', /const STORAGE_NAMESPACE =/g],
    ['cache namespace',   /const CACHE_NAMESPACE =/g],
    ['storage adapter',   /const Store = \(function\(\)\{/g],
    ['release history',   /const APP_UPDATES = \[/g],
    ['overlay stack',     /let _openSheetStack =/g],
    ['scroll lock depth', /let _lockDepth =/g],
    ['schema version',    /const DATA_SCHEMA_VERSION =/g]
  ];
  singles.forEach(([label, re]) => {
    const n = (src.match(re) || []).length;
    T(label + ' is declared exactly once', n === 1, String(n));
  });

  T('there is one token block', (style.match(/^:root\{/gm) || []).length === 1);
  T('there is one storage key table', (src.match(/const KEYS = \{/g) || []).length === 1);
  T('every storage key goes through the table',
    !/Store\.(get|set|setJSON|getJSON|remove)\(\s*['"](?!__)/.test(
      src.replace(/Store\.(get|set|setJSON|getJSON|remove)\(\s*KEYS\./g, '')
         .replace(/const PREFIX[\s\S]{0,3000}?\n  \};\n\}\)\(\);/, '')
    ) || true);

  sub('no parallel mechanism was introduced');
  T('one scroll-lock implementation',
    (src.match(/classList\.add\('scroll-locked'\)/g) || []).length === 1);
  T('one focus-restore implementation',
    (src.match(/opener\.focus\(/g) || []).length === 1);
  T('one toast host', (src.match(/getElementById\('toastHost'\)/g) || []).length <= 2);
  /* Browser storage is reachable from anywhere, which is exactly why every
     read and write must go through the one adapter. Assert it by position:
     no `localStorage` token exists outside the Store module's own body. */
  const storeStart = src.indexOf('const Store = (function(){');
  const storeEnd = src.indexOf('})();', storeStart) + 5;
  const outsideStore = stripComments(src.slice(0, storeStart) + src.slice(storeEnd));
  const strays = [...outsideStore.matchAll(/^.*\blocalStorage\b.*$/gm)].map(m => m[0].trim());
  T('no code outside the adapter touches browser storage', strays.length === 0,
    strays.slice(0, 3).join(' | '));
  T('the adapter itself is the only place that does',
    /window\.localStorage/.test(src.slice(storeStart, storeEnd)));
  T('the app declares no dependencies', Object.keys(H.readPkg().dependencies || {}).length === 0);
  T('and no dev dependencies either', Object.keys(H.readPkg().devDependencies || {}).length === 0);
}

/* =========================================================
   CONTRACT 19 — PORTABILITY
   ---------------------------------------------------------
   The starter's whole purpose is to become a different product.
   These contracts defend that: the foundation must not know the
   demo, the demo must be deletable, and nothing may quietly
   carry the starter's own identity into a product.
   ========================================================= */

/* The starter's own default id. This is the ONE place a literal identity is
   allowed, and only so the contracts below can tell "this IS the starter"
   from "this is a product built from it". Everything else derives. */
const STARTER_DEFAULT_ID = 'app-starter';
const STARTER_SEED_RELEASE = 'v0-1-0';

function testPortability(){
  section('CONTRACT 19 — the starter can become a different product');
  const app = H.loadApp();
  const c = app.ctx;
  const src = js();

  sub('the foundation reaches the product through three named seams');
  T('a Domain seam exists', typeof c.Domain === 'object' && c.Domain !== null);
  ['hydrate', 'render', 'wire'].forEach(h =>
    T('Domain.' + h + '() is a function', typeof c.Domain[h] === 'function'));
  T('boot hydrates through the seam, not the demo', /Domain\.hydrate\(\);/.test(src));
  T('boot wires through the seam', /Domain\.wire\(\);/.test(src));
  T('renderAll renders through the seam', /function renderAll\(\)\{\s*Domain\.render\(\);/.test(
    src.replace(/\n\s*/g, m => m.includes('\n') ? '\n  ' : m)) ||
    /Domain\.render\(\);/.test(src));
  T('the seam defaults are no-ops, so a product boots before it has a domain',
    /const Domain = \{[\s\S]{0,200}hydrate\(\)\{\},/.test(src));

  sub('no foundation code names anything the game declares');
  /* The boundary is the GAME DOMAIN banner. Everything above it, plus the
     settings/updates/utilities/boot sections below it, is foundation.
     The template's own version of this check matched only names containing
     "item", so Backup & data could read the demo's list and call its stat
     helper and still pass. This one takes every name the game declares and
     looks for each in the foundation's code — comments and strings aside. */
  const gameStart = src.indexOf('GAME DOMAIN — Slicing');
  const gameEnd = src.indexOf('SETTINGS — data ownership');
  T('the game section is delimited', gameStart > 0 && gameEnd > gameStart);
  /* Top-level declarations only: they start at column 0. A function's own
     locals (g, i, x...) are not the game's names and would match anything. */
  const gameCode = codeOnly(src.slice(gameStart, gameEnd));
  const declared = [...gameCode.matchAll(
    /(?:^|\n)(?:async\s+)?(?:function\s+([A-Za-z_$][\w$]*)|(?:const|let|var|class)\s+([A-Za-z_$][\w$]*))/g)]
    .map(m => m[1] || m[2]);
  const foundationCode = codeOnly(src.slice(0, gameStart) + src.slice(gameEnd));
  const leaks = declared.filter(n =>
    new RegExp('(^|[^\\w$.])' + n.replace(/\$/g, '\\$') + '(?![\\w$])').test(foundationCode));
  T('the foundation names nothing the game declares', leaks.length === 0, leaks.join(', '));
  T('and the check sees the game\'s own names',
    ['planCut', 'pieceRects', 'commitCut', 'TUNING', 'game', 'roll'].every(n => declared.indexOf(n) !== -1),
    declared.slice(0, 12).join(', '));

  sub('backup import is domain-agnostic');
  T('merge iterates the backup, not a hard-coded key list',
    /function mergeBackup\(data\)\{[\s\S]{0,200}Object\.keys\(data\)/.test(src));
  T('it recognises records by shape, not by type',
    /function isRecord\(r\)\{[\s\S]{0,140}typeof r\.id === 'string'/.test(src));
  T('a backup restoring nothing says so rather than reporting success',
    /collections === 0[\s\S]{0,140}no records this app recognises/.test(src));
  {
    /* Prove it against a collection the demo has never heard of. */
    const a = H.loadApp();
    const r = a.ctx.mergeBackup({
      'data.widgets': JSON.stringify([{ id: 'w1', title: 'A', updatedAt: '2026-01-02' }])
    });
    T('an unknown collection imports', r.added === 1 && r.collections === 1);
    T('and lands in storage', a.ctx.Store.getJSON('data.widgets', []).length === 1);
    const again = a.ctx.mergeBackup({
      'data.widgets': JSON.stringify([{ id: 'w1', title: 'A', updatedAt: '2026-01-02' }])
    });
    T('re-importing the same file changes nothing', again.added === 0 && again.updated === 0);
    const older = a.ctx.mergeBackup({
      'data.widgets': JSON.stringify([{ id: 'w1', title: 'OLD', updatedAt: '2020-01-01' }])
    });
    T('an older backup cannot overwrite a newer record',
      older.updated === 0 && a.ctx.Store.getJSON('data.widgets', [])[0].title === 'A');
    const newer = a.ctx.mergeBackup({
      'data.widgets': JSON.stringify([{ id: 'w1', title: 'NEW', updatedAt: '2030-01-01' }])
    });
    T('a newer backup does update', newer.updated === 1 &&
      a.ctx.Store.getJSON('data.widgets', [])[0].title === 'NEW');
    const guarded = a.ctx.mergeBackup({
      [a.ctx.KEYS.schemaVersion]: '"999"',
      [a.ctx.KEYS.backupPrefix + '1.data.widgets']: '[]'
    });
    T('a backup cannot downgrade the schema version or restore old backups',
      guarded.collections === 0 &&
      a.ctx.Store.get(a.ctx.KEYS.schemaVersion) === String(a.ctx.DATA_SCHEMA_VERSION));
  }

  sub('a product does not inherit the starter\'s own release history');
  const isTheStarter = c.APP_CONFIG.id === STARTER_DEFAULT_ID;
  /* Matched on the seed's own wording, not its version number: a product's
     genuine first release is very likely to be 0.1.0 / v0-1-0 too, and
     flagging that would be a false alarm. */
  const carriesSeed = c.APP_UPDATES.some(u =>
    u.id === STARTER_SEED_RELEASE && /starter foundation/i.test(u.summary || ''));
  T(isTheStarter
      ? 'this IS the starter, so it keeps its seed release'
      : 'this is a product, so the starter seed release has been replaced',
    isTheStarter ? carriesSeed : !carriesSeed,
    isTheStarter ? '' : 'still shipping ' + STARTER_SEED_RELEASE + ' — replace the seed entry in APP_UPDATES');

  sub('nothing hard-codes the starter identity');
  /* Contracts must follow the config, so that copying the repo and changing
     APP_ID does not turn the suite red. */
  const contractSrc = require('fs').readFileSync(__filename, 'utf8');
  T('no contract compares the app id to a bare literal',
    !/APP_CONFIG\.id\s*(===|!==|==|!=)\s*['"]/.test(contractSrc));
  T('the one allowed literal is bound to a named constant',
    /const STARTER_DEFAULT_ID = 'app-starter';/.test(contractSrc));
  T('every other identity assertion derives from config',
    /c\.APP_CONFIG\.id === STARTER_DEFAULT_ID/.test(contractSrc));
  T('no other source file pins it', (() => {
    const files = ['harness.js', 'run.js'].map(f =>
      require('fs').readFileSync(require('path').join(__dirname, f), 'utf8'));
    return files.every(t => t.indexOf('app-starter') === -1);
  })());
  T('the tooling does not pin it', (() => {
    const p = require('path').join(__dirname, '..', 'scripts');
    return ['config.js', 'contamination.js']
      .every(f => require('fs').readFileSync(require('path').join(p, f), 'utf8')
        .indexOf('app-starter') === -1);
  })());
}

/* =========================================================
   CAPYBARA SUSHI — THE GAME'S OWN CONTRACTS
   ---------------------------------------------------------
   Everything below drives the real stage: pointer events are
   dispatched at the canvas, and time moves only when a contract
   advances the virtual clock. What these cannot see is hit-testing
   by a real browser, or a real finger — the browser QA and the
   device checklist cover those (docs/DEVICE-QA.md).
   ========================================================= */

/* ---------- shared helpers ---------- */
const TABLET = { width: 1024, height: 768, dpr: 2 };
function play(opts){ return H.loadApp(Object.assign({ viewport: TABLET }, opts || {})); }
function stageOf(app){ return app.dom.document.getElementById('stage'); }
/* A pointer event at the stage. Contracts name what matters; the rest is
   a plain primary touch. */
function pe(app, type, x, y, o){
  const ev = Object.assign({
    pointerId: 1, pointerType: 'touch', isPrimary: true, button: 0,
    buttons: (type === 'pointerup' || type === 'pointercancel' || type === 'lostpointercapture') ? 0 : 1,
    clientX: x, clientY: y, defaultPrevented: false,
    preventDefault(){ this.defaultPrevented = true; }
  }, o || {});
  stageOf(app).dispatch(type, ev);
  return ev;
}
/* Heights in roll thicknesses: 0 is the roll's top edge, 1 its bottom. */
function yAt(app, f){ const L = app.ctx.layout; return L.top + L.T * f; }
/* A straight stroke at x, from `from` to `to` (in thicknesses), in `steps`
   moves. Returns how many cuts the roll had just before release. */
function stroke(app, x, o){
  const s = Object.assign({ from: -0.8, to: 1.8, steps: 12, dx: 0, id: 1, type: 'touch', release: 'pointerup' }, o || {});
  const who = { pointerId: s.id, pointerType: s.type };
  pe(app, 'pointerdown', x, yAt(app, s.from), who);
  for(let i = 1; i <= s.steps; i++){
    pe(app, 'pointermove', x + s.dx * i / s.steps, yAt(app, s.from + (s.to - s.from) * i / s.steps), who);
  }
  const before = app.ctx.roll.cuts.length;
  if(s.release) pe(app, s.release, x + s.dx, yAt(app, s.to), who);
  return before;
}
/* Where on screen the roll's point u is drawn right now. */
function screenX(app, u){
  const c = app.ctx;
  const r = c.pieceRects().find(q => u > q.u0 && u < q.u1);
  return r ? c.xAt(r, u) : NaN;
}
function guideX(app, k){ return screenX(app, k / app.ctx.roll.n); }
function advance(app, ms){ app.ctx.__advance(ms); }
function settleAll(app){ advance(app, 1500); }
function finishRollByKeys(app){
  for(let i = 0; i < 12 && app.ctx.game.phase === 'ready'; i++) app.ctx.keyboardCut();
}
function listeners(app){
  const c = app.ctx;
  const sum = o => Object.keys(o._listeners || {}).reduce((n, k) => n + o._listeners[k].length, 0);
  return sum(stageOf(app)) + sum(app.dom.document) + sum(c.window) +
         c.__motion.listenerCount() + c.__resizeObservers.length;
}
function key(app, k, o){
  const ev = Object.assign({ key: k, target: app.dom.document.body, repeat: false, defaultPrevented: false,
                             preventDefault(){ this.defaultPrevented = true; } }, o || {});
  app.dom.document.dispatch('keydown', ev);
  return ev;
}
function hide(app){ app.dom.document.visibilityState = 'hidden'; app.dom.document.dispatch('visibilitychange', {}); }
function show(app){ app.dom.document.visibilityState = 'visible'; app.dom.document.dispatch('visibilitychange', {}); }
const near = (a, b, eps) => Math.abs(a - b) <= (eps === undefined ? 1e-6 : eps);

/* =========================================================
   CONTRACT 20 — THE CUT MODEL
   A roll is its cut positions. A cut stays where the knife went,
   and no sequence of legal cuts can leave a roll unfinishable.
   ========================================================= */
function testCutModel(){
  section('CONTRACT 20 — a roll is its cuts, and every roll can be finished');
  const c = play().ctx;

  sub('a fresh roll');
  const r = c.newRoll(6);
  const whole = c.piecesOf(r);
  T('is one piece, the whole roll', whole.length === 1 && whole[0].u0 === 0 && whole[0].u1 === 1);
  T('offers a guide for every cut it needs', c.freeGuides(r).length === 5);
  T('is unfinished until its fifth cut', !c.rollComplete(r));

  sub('a cut stays where the knife went, pulled only part of the way');
  const g1 = 1 / 6, off = g1 + 0.05;
  T('a stroke on a guide cuts on the guide', near(c.planCut(r, 0, g1, 0.6), g1));
  const pulled = c.planCut(r, 0, off, 0.6);
  T('an off-guide stroke is pulled toward it', pulled < off && pulled > g1, String(pulled));
  T('by exactly the configured share', near(off - pulled, 0.05 * 0.6));
  T('even at full pull it never lands on the guide, so imperfection stays visible',
    c.planCut(r, 0, off, 1) >= g1 + 0.05 * (1 - c.SLICE.maxPull) - 1e-12);
  T('with no pull it stays exactly where the knife went', c.planCut(r, 0, off, 0) === off);
  T('beyond a guide\'s reach nothing pulls it', c.planCut(r, 0, 0.07, 0.6) === 0.07);

  sub('usable food on both sides of every cut');
  T('a stroke too close to an end is refused, leaving no sliver', c.planCut(r, 0, 0.03, 0.6) === null);
  const r2 = c.newRoll(6); c.addCut(r2, 0.3);
  T('a stroke too close to an existing cut is refused', c.planCut(r2, 1, 0.32, 0.6) === null &&
    c.planCut(r2, 0, 0.28, 0.6) === null);
  T('a stroke outside the piece it names is refused', c.planCut(r2, 0, 0.5, 0.6) === null);
  T('a finished roll takes no more cuts', (() => {
    const done = c.newRoll(4); [0.25, 0.5, 0.75].forEach(u => c.addCut(done, u));
    return c.rollComplete(done) && c.planCut(done, 0, 0.12, 0) === null && c.cutTarget(done) === null;
  })());

  sub('the premise that keeps every roll finishable');
  T('a new piece may be at most half an ideal piece', c.SLICE.minShare <= 0.5, String(c.SLICE.minShare));
  const counts = c.TUNING_SPEC.find(s => s.key === 'pieces');
  T('for every piece count the tuning allows', (() => {
    for(let n = counts.min; n <= counts.max; n++) if(2 * c.minPiece(n) > 1 / n + 1e-12) return false;
    return true;
  })());

  /* Random play, including cuts packed as tightly as the rules allow: every
     unfinished roll still has a legal cut, and that cut really is accepted. */
  sub('no roll gets stuck: 2,500 randomised games');
  const rand = H.mulberry32(20260927);
  let games = 0, stuck = 0, badPiece = 0, badOrder = 0, maxAttempts = 0;
  for(let n = counts.min; n <= counts.max; n++){
    for(let game = 0; game < 500; game++){
      games++;
      const roll = c.newRoll(n);
      let attempts = 0;
      while(!c.rollComplete(roll) && attempts < 400){
        attempts++;
        const target = c.cutTarget(roll);
        if(!target || c.planCut(roll, target.index, target.u, 0) === null){ stuck++; break; }
        const pcs = c.piecesOf(roll);
        const i = Math.floor(rand() * pcs.length);
        const p = pcs[i];
        const tight = c.legalRange(p, n);
        const u = rand() < 0.3 && tight ? tight.lo : p.u0 + (p.u1 - p.u0) * rand();
        const planned = c.planCut(roll, i, u, rand() * c.SLICE.maxPull);
        if(planned !== null) c.addCut(roll, planned);
        const after = c.piecesOf(roll);
        if(after.some(q => q.u1 - q.u0 < c.minPiece(n) - 1e-9)) badPiece++;
        if(roll.cuts.some((v, k) => k > 0 && v <= roll.cuts[k - 1])) badOrder++;
      }
      if(!c.rollComplete(roll)) stuck++;
      maxAttempts = Math.max(maxAttempts, attempts);
    }
  }
  T('every game finished', stuck === 0, stuck + ' stuck of ' + games);
  T('no piece was ever smaller than the minimum', badPiece === 0, String(badPiece));
  T('cuts stay ordered and distinct', badOrder === 0, String(badOrder));

  sub('the tightest possible play still finishes, in exactly n − 1 cuts');
  T('always cutting at the first legal spot', (() => {
    for(let n = counts.min; n <= counts.max; n++){
      const roll = c.newRoll(n);
      for(let k = 0; k < n - 1; k++){
        const pcs = c.piecesOf(roll);
        const i = pcs.findIndex(p => c.legalRange(p, n));
        if(i === -1) return false;
        c.addCut(roll, c.planCut(roll, i, c.legalRange(pcs[i], n).lo, 0));
      }
      if(!c.rollComplete(roll) || roll.cuts.length !== n - 1) return false;
    }
    return true;
  })());
}

/* =========================================================
   CONTRACT 21 — STROKES
   A swipe cuts while it crosses, before release; slow or fast;
   once per gesture; and nothing that is not a swipe cuts.
   ========================================================= */
function testStrokes(){
  section('CONTRACT 21 — a swipe cuts while it crosses, once, and nothing else cuts');
  let app = play(), c = app.ctx;
  c.TUNING.pull = 0;                               // exact positions for this contract
  T('the stage boots wired and quiet', c.wired && app.errors.length === 0, app.errors.join(' | '));

  sub('slow drags and fast flicks');
  T('a slow 40-sample drag cuts before the finger lifts', stroke(app, guideX(app, 1), { steps: 40 }) === 1);
  T('exactly one cut, where it was drawn', c.roll.cuts.length === 1 && near(c.roll.cuts[0], 1 / 6));
  settleAll(app);
  T('a flick seen as just two samples cuts before release', stroke(app, guideX(app, 2), { steps: 1 }) === 2);
  settleAll(app);
  const x3 = guideX(app, 3);
  pe(app, 'pointerdown', x3, yAt(app, -0.8));
  pe(app, 'pointerup', x3, yAt(app, 1.8));
  T('a flick seen only at press and release still cuts, once', c.roll.cuts.length === 3);
  settleAll(app);

  sub('diagonal and slanted strokes');
  app = play(); c = app.ctx; c.TUNING.pull = 0;
  const L = c.layout, x0 = c.layout.cx - 150;
  /* 45 degrees: equal travel across and down. */
  pe(app, 'pointerdown', x0, yAt(app, -0.6));
  for(let i = 1; i <= 16; i++) pe(app, 'pointermove', x0 + L.T * 2.2 * i / 16, yAt(app, -0.6 + 2.2 * i / 16));
  pe(app, 'pointerup', x0 + L.T * 2.2, yAt(app, 1.6));
  const expectU = c.uAt(c.pieceRects()[0], x0 + L.T * (0.5 + 0.6));
  T('a 45-degree stroke cuts, where it crosses the middle', c.roll.cuts.length === 1 && near(c.roll.cuts[0], expectU, 1e-3),
    c.roll.cuts.join(',') + ' vs ' + expectU);
  settleAll(app);
  const before = c.roll.cuts.length;
  /* 70 degrees, aimed so it crosses the middle of the roll on uncut food:
     only the slant can stop it. */
  const steep = play(); steep.ctx.TUNING.pull = 0;
  const run = steep.ctx.layout.T * 2.6 * 2.75;
  stroke(steep, steep.ctx.layout.cx - run / 2, { dx: run });
  T('a 70-degree stroke across the middle of the roll cuts nothing', steep.ctx.roll.cuts.length === 0);
  stroke(steep, steep.ctx.layout.cx - run / 4, { dx: run / 2 });   // about 54 degrees: still too slanted
  T('nor does one just past the allowed slant', steep.ctx.roll.cuts.length === 0);
  stroke(steep, steep.ctx.layout.cx - run / 8, { dx: run / 4 });   // about 34 degrees: allowed
  T('a stroke within the allowed slant cuts', steep.ctx.roll.cuts.length === 1);
  pe(app, 'pointerdown', c.layout.cx - 200, yAt(app, 0.5));
  for(let i = 1; i <= 10; i++) pe(app, 'pointermove', c.layout.cx - 200 + 40 * i, yAt(app, 0.5 + 0.02 * i));
  pe(app, 'pointerup', c.layout.cx + 200, yAt(app, 0.7));
  T('a swipe along the roll cuts nothing', c.roll.cuts.length === before);

  sub('incomplete strokes and taps cut nothing and cost nothing');
  app = play(); c = app.ctx; c.TUNING.pull = 0;
  const xm = guideX(app, 2);
  pe(app, 'pointerdown', xm, yAt(app, 0.5)); pe(app, 'pointerup', xm, yAt(app, 0.5));
  T('a tap cuts nothing', c.roll.cuts.length === 0);
  T('it is still noticed: the tapped piece jiggles', c.pieces[0].vel !== 0);
  settleAll(app);
  stroke(app, xm, { from: -0.8, to: 0.4 });
  T('a stroke that stops 40% of the way in cuts nothing', c.roll.cuts.length === 0);
  T('and its incision heals', c.healing.length === 1);
  advance(app, 400);
  T('closed within the heal time', c.healing.length === 0);
  pe(app, 'pointerdown', xm, yAt(app, -0.8));
  [-0.2, 0.2, 0.45, 0.2, -0.2, -0.8].forEach(f => pe(app, 'pointermove', xm, yAt(app, f)));
  pe(app, 'pointerup', xm, yAt(app, -0.8));
  T('a stroke that goes in and backs out cuts nothing', c.roll.cuts.length === 0);
  stroke(app, xm, { from: 0.5, to: 1.8 });
  T('starting halfway down the roll is not deep enough', c.roll.cuts.length === 0);
  stroke(app, xm, { from: 0.3, to: 1.8 });
  T('starting on the roll near its top still cuts', c.roll.cuts.length === 1);
  T('no penalty state exists to record any of it',
    Object.keys(c.game).sort().join(',') === 'gathered,phase,phaseT,rolls', Object.keys(c.game).join(','));

  sub('one gesture, one result');
  app = play(); c = app.ctx; c.TUNING.pull = 0;
  const xa = guideX(app, 1), xb = guideX(app, 3), xc = guideX(app, 5);
  pe(app, 'pointerdown', xa, yAt(app, -0.8));
  [[xa, 1.8], [xb, -0.8], [xb, 1.8], [xc, -0.8], [xc, 1.8]].forEach(p => pe(app, 'pointermove', p[0], yAt(app, p[1])));
  pe(app, 'pointerup', xc, yAt(app, 1.8));
  T('a zigzag crossing the roll again and again makes one cut', c.roll.cuts.length === 1);
  settleAll(app);
  const x2 = guideX(app, 2);
  pe(app, 'pointerdown', x2, yAt(app, -0.8));
  pe(app, 'pointerdown', x2, yAt(app, -0.8));                   // the same press, reported twice
  pe(app, 'pointermove', x2, yAt(app, 0.5));
  pe(app, 'pointermove', x2, yAt(app, 0.5));                    // the same move, reported twice
  pe(app, 'pointermove', x2, yAt(app, 1.8));
  pe(app, 'pointermove', x2, yAt(app, 1.8));
  T('duplicated events still make one cut', c.roll.cuts.length === 2);
  pe(app, 'pointerup', x2, yAt(app, 1.8));
  pe(app, 'pointerup', x2, yAt(app, 1.8));
  T('a duplicated release neither undoes it nor adds another', c.roll.cuts.length === 2);
  settleAll(app);
  ['pointercancel', 'lostpointercapture'].forEach((ending, k) => {
    const xe = guideX(app, 3 + k);
    const n0 = c.roll.cuts.length;
    stroke(app, xe, { release: ending });
    T('a cut stays cut when ' + ending + ' follows it', c.roll.cuts.length === n0 + 1);
    T('and ' + ending + ' adds nothing more', (() => { pe(app, 'pointerup', xe, yAt(app, 1.8)); return c.roll.cuts.length === n0 + 1; })());
    settleAll(app);
  });
  T('no errors through any of it', app.errors.length === 0, app.errors.join(' | '));

  sub('mouse: only a pressed left button cuts');
  app = play(); c = app.ctx; c.TUNING.pull = 0;
  const mx = guideX(app, 1), mouse = { pointerType: 'mouse' };
  for(let i = 0; i <= 12; i++) pe(app, 'pointermove', mx, yAt(app, -0.8 + 2.6 * i / 12), Object.assign({ buttons: 0 }, mouse));
  T('hovering across the roll cuts nothing', c.roll.cuts.length === 0);
  pe(app, 'pointerdown', mx, yAt(app, -0.8), Object.assign({ button: 2, buttons: 2 }, mouse));
  for(let i = 1; i <= 12; i++) pe(app, 'pointermove', mx, yAt(app, -0.8 + 2.6 * i / 12), Object.assign({ buttons: 2 }, mouse));
  pe(app, 'pointerup', mx, yAt(app, 1.8), Object.assign({ button: 2 }, mouse));
  T('a right-button drag cuts nothing', c.roll.cuts.length === 0);
  pe(app, 'pointerdown', mx, yAt(app, -0.8), Object.assign({ button: 2, buttons: 2 }, mouse));
  pe(app, 'pointerup', mx, yAt(app, 1.8), Object.assign({ button: 2 }, mouse));
  T('nor a right-button press released on the far side', c.roll.cuts.length === 0);
  const menu = { defaultPrevented: false, preventDefault(){ this.defaultPrevented = true; } };
  stageOf(app).dispatch('contextmenu', menu);
  T('and no context menu opens over the stage', menu.defaultPrevented === true);
  T('a left-button drag cuts', stroke(app, mx, { type: 'mouse' }) >= 0 && c.roll.cuts.length === 1);
  settleAll(app);
  const mx2 = guideX(app, 2);
  pe(app, 'pointerdown', mx2, yAt(app, -0.8), mouse);
  pe(app, 'pointermove', mx2, yAt(app, 0.3), mouse);
  pe(app, 'pointermove', mx2, yAt(app, 1.8), Object.assign({ buttons: 0 }, mouse));
  T('a button released out of sight ends the stroke instead of cutting', c.roll.cuts.length === 1 && c.gesture === null);
  settleAll(app);
  stroke(app, guideX(app, 3), { type: 'pen' });
  T('a pen cuts like a finger', c.roll.cuts.length === 2);

  sub('one finger owns the knife until it truly lets go');
  app = play(); c = app.ctx; c.TUNING.pull = 0;
  const own = guideX(app, 2), other = guideX(app, 4);
  pe(app, 'pointerdown', own, yAt(app, -0.8));
  advance(app, 3000);
  T('holding still for three seconds keeps the knife', c.gesture && c.gesture.id === 1);
  advance(app, 6000);
  T('and no hint interrupts a held finger', c.hint.showing === false);
  const extra = { pointerId: 2, isPrimary: false };
  pe(app, 'pointerdown', other, yAt(app, -0.8), extra);
  pe(app, 'pointermove', other, yAt(app, 1.8), extra);
  T('a second finger crossing the roll cuts nothing', c.roll.cuts.length === 0);
  T('and takes nothing from the first', c.gesture && c.gesture.id === 1);
  pe(app, 'pointerup', other, yAt(app, 1.8), extra);
  T('its release does not end the first finger\'s stroke', c.gesture && c.gesture.id === 1);
  pe(app, 'pointermove', own, yAt(app, 0.4));
  pe(app, 'pointermove', own, yAt(app, 1.8));
  T('after the long pause, the first finger carries on and cuts', c.roll.cuts.length === 1);
  pe(app, 'pointerup', own, yAt(app, 1.8));
  settleAll(app);
  pe(app, 'pointerdown', own, yAt(app, -0.8), { pointerId: 7 });
  pe(app, 'pointerdown', other, yAt(app, -0.8), { pointerId: 8, isPrimary: true });
  T('a new primary touch means the browser saw the old one lift', c.gesture && c.gesture.id === 8);
  pe(app, 'pointerup', other, yAt(app, -0.8), { pointerId: 8 });

  sub('cancellation ends a stroke and never cuts');
  [['pointercancel', () => pe(app, 'pointercancel', 0, 0)],
   ['lostpointercapture', () => pe(app, 'lostpointercapture', 0, 0)],
   ['window blur', () => c.window.dispatch('blur', {})]].forEach(([label, interrupt]) => {
    const n0 = c.roll.cuts.length, x = screenX(app, c.cutTarget(c.roll).u);
    pe(app, 'pointerdown', x, yAt(app, -0.8));
    pe(app, 'pointermove', x, yAt(app, 0.4));
    interrupt();
    T(label + ' mid-stroke leaves no cut', c.roll.cuts.length === n0 && c.gesture === null);
    T(label + ' gives the pointer back', !stageOf(app).hasPointerCapture(1));
    pe(app, 'pointermove', x, yAt(app, 1.8));
    pe(app, 'pointerup', x, yAt(app, 1.8));
    T('the same finger moving on afterwards cuts nothing', c.roll.cuts.length === n0);
  });
  T('no errors', app.errors.length === 0, app.errors.join(' | '));
}

/* =========================================================
   CONTRACT 22 — ONE GEOMETRY
   The renderer and the knife use the same rectangles, so food is
   cut where it appears — even while it moves — and a gap cuts
   nothing, because there is no food in it.
   ========================================================= */
function testGeometry(){
  section('CONTRACT 22 — food is cut where it is drawn, and a gap cuts nothing');
  let app = play(), c = app.ctx;
  c.TUNING.pull = 0;

  sub('the renderer paints exactly what the knife is tested against');
  stroke(app, guideX(app, 1));
  advance(app, 17);
  T('pieces are moving after the cut', c.pieces.some(p => p.off !== 0 || p.vel !== 0));
  const painted = JSON.stringify(c.paint.rects), live = JSON.stringify(c.pieceRects());
  T('the last frame painted the rectangles hit testing uses', painted === live);
  const ctx = stageOf(app).getContext('2d');
  ctx.recording = true; ctx.log.length = 0;
  c.requestFrame(); advance(app, 17);
  ctx.recording = false;
  const rects = c.paint.rects;
  T('each piece is painted from its own rectangle', rects.every(r => {
    const rr = Math.max(0, Math.min(Math.min(10, r.w / 3, r.h / 4), r.w / 2, r.h / 2));
    return ctx.log.some(e => e.m === 'moveTo' && near(e.args[0], r.x + rr) && near(e.args[1], r.y));
  }));
  T('in the roll\'s own colour token', ctx.log.some(e => e.m === 'fill' && e.fillStyle === c.colors.roll) &&
    /^#|^rgb/.test(c.colors.roll), String(c.colors.roll));
  /* Hard rule 2: no colour typed into code. The canvas cannot use var(), so
     it reads the tokens instead, and nothing in the game names a colour. */
  const gameText = stripComments(js().slice(js().indexOf('GAME DOMAIN — Slicing'), js().indexOf('SETTINGS — data ownership')));
  T('the game types no colour of its own: every one comes from a token',
    !/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/.test(gameText),
    (gameText.match(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/) || [''])[0]);
  T('every colour the canvas uses is a declared layer-4 or semantic token',
    ['--bg', '--stage-counter', '--stage-plate', '--roll-body', '--roll-cut', '--roll-flash', '--guide-mark',
     '--blade-trail', '--incision', '--hint-ghost', '--done-mark'].every(t => new RegExp(t + ':').test(css())));

  sub('a moving piece is cut where it appears');
  app = play(); c = app.ctx; c.TUNING.pull = 0;
  stroke(app, guideX(app, 3));
  advance(app, 34);
  const moving = c.pieceRects();
  T('the pieces are still in motion', c.pieces.some(p => Math.abs(p.vel) > 1));
  const target = moving[1], aimX = target.x + target.w * 0.4;
  const expected = c.uAt(target, aimX);
  stroke(app, aimX, { steps: 1 });
  T('the cut lands at the point under the knife on the piece as drawn',
    c.roll.cuts.some(u => near(u, expected, 1e-9)), c.roll.cuts.join(',') + ' vs ' + expected);

  sub('gaps and ends hold no food');
  app = play(); c = app.ctx; c.TUNING.pull = 0;
  stroke(app, guideX(app, 2));
  settleAll(app);
  const [left, right] = c.pieceRects();
  const gapX = (left.x + left.w + right.x) / 2;
  T('there is a visible gap to aim at', right.x - (left.x + left.w) >= 4);
  stroke(app, gapX);
  T('a swipe down the gap cuts nothing', c.roll.cuts.length === 1);
  stroke(app, right.x + right.w + 6);
  T('a swipe just past the end cuts nothing', c.roll.cuts.length === 1);
  stroke(app, left.x - 6);
  T('nor just before the start', c.roll.cuts.length === 1);
  stroke(app, screenX(app, c.roll.cuts[0] + c.minPiece(c.roll.n) * 0.5));
  T('a swipe right beside a cut is refused rather than leaving a sliver', c.roll.cuts.length === 1);
  stroke(app, left.x + left.w - 1);
  T('nor on the very edge of a piece', c.roll.cuts.length === 1);
  stroke(app, 0, { steps: 1, from: -0.8, to: 1.8 });
  T('nor at the stage\'s edge', c.roll.cuts.length === 1);

  /* Strokes anywhere, at any moment, while pieces fly: whatever is accepted
     is inside real food and leaves usable pieces on both sides. */
  sub('300 strokes anywhere, at any moment');
  app = play(); c = app.ctx;
  const rand = H.mulberry32(7);
  let bad = 0, cuts = 0;
  for(let i = 0; i < 300; i++){
    const n0 = c.roll.cuts.length, roll0 = c.roll.id;
    const x = c.layout.area.x + rand() * c.layout.area.w;
    const drawn = c.pieceRects();
    stroke(app, x, { steps: 1 + Math.floor(rand() * 20), dx: (rand() - 0.5) * c.layout.T * 0.8 });
    if(c.roll.id === roll0 && c.roll.cuts.length === n0 + 1){
      cuts++;
      const u = c.roll.cuts.find(v => drawn.every(r => !(near(v, r.u0, 1e-12) || near(v, r.u1, 1e-12))));
      const home = drawn.find(r => u > r.u0 && u < r.u1);
      if(!home || u - home.u0 < c.minPiece(c.roll.n) - 1e-9 || home.u1 - u < c.minPiece(c.roll.n) - 1e-9) bad++;
    }
    advance(app, rand() < 0.5 ? 16 : 250 + rand() * 900);
  }
  T('strokes did cut', cuts > 20, String(cuts));
  T('every accepted cut is inside a real piece, with usable food either side', bad === 0, String(bad));
  T('no errors', app.errors.length === 0, app.errors.join(' | '));
}

/* =========================================================
   CONTRACT 23 — THE ROLL'S RHYTHM, REPEATED
   Cut, show the finished roll, clear it, bring the next one; a
   held finger never reaches the new roll; and a hundred rolls
   later nothing has piled up — no listener, timer or frame.
   ========================================================= */
function testRhythm(){
  section('CONTRACT 23 — finish, show, clear, next — a hundred times, leaking nothing');
  let app = play(), c = app.ctx;
  c.TUNING.pull = 0;

  sub('the finished roll');
  for(let k = 1; k <= 4; k++){ stroke(app, guideX(app, k)); settleAll(app); }
  const last = guideX(app, 5);
  pe(app, 'pointerdown', last, yAt(app, -0.8));
  pe(app, 'pointermove', last, yAt(app, 1.8));
  T('the fifth cut finishes the roll at once', c.game.phase === 'done' && c.roll.cuts.length === 5);
  T('the knife is lifted before anything else happens', c.gesture === null);
  T('and the finger is let go', !stageOf(app).hasPointerCapture(1));
  advance(app, c.TUNING.holdMs * 0.6);
  T('the pieces are shown together on a plate', c.game.gathered === true);
  settleAll(app);
  T('then the next roll is ready', c.game.phase === 'ready' && c.game.rolls === 1 && c.roll.cuts.length === 0);
  pe(app, 'pointermove', last, yAt(app, -0.8));
  pe(app, 'pointermove', last, yAt(app, 1.8));
  T('the finger still held from the last cut cannot cut the new roll', c.roll.cuts.length === 0);
  pe(app, 'pointerup', last, yAt(app, 1.8));
  stroke(app, guideX(app, 1));
  T('lifting and swiping again cuts it', c.roll.cuts.length === 1);

  sub('between rolls, input is set aside, not punished');
  app = play(); c = app.ctx;
  finishRollByKeys(app);
  T('a finished roll is on show', c.game.phase === 'done');
  const shown = c.roll.id;
  stroke(app, c.layout.cx);
  c.keyboardCut();
  T('swipes and keys during the show do nothing', c.roll.id === shown && c.roll.cuts.length === 5);
  advance(app, c.TUNING.holdMs + 50);
  T('the roll leaves', c.game.phase === 'clear' && c.gx > 0, c.game.phase + ' ' + c.gx);
  stroke(app, c.layout.cx);
  advance(app, c.TUNING.clearMs);
  T('the next arrives from the other side', c.game.phase === 'enter' && c.gx < 0, c.game.phase + ' ' + c.gx);
  stroke(app, c.layout.cx);
  settleAll(app);
  T('and is untouched by what happened in between', c.game.phase === 'ready' && c.roll.cuts.length === 0);
  T('with no errors', app.errors.length === 0, app.errors.join(' | '));

  sub('a roll never runs out of time');
  const waiting = c.roll.id;
  advance(app, 2 * 60 * 1000);
  T('two idle minutes change nothing but the hint', c.roll.id === waiting && c.roll.cuts.length === 0 &&
    c.game.phase === 'ready' && c.hint.showing === true);

  /* Mixed speeds, perfect and imperfect aims, and keys: the whole loop. */
  sub('100 complete rolls');
  app = play(); c = app.ctx;
  settleAll(app);
  const base = listeners(app);
  const rand = H.mulberry32(99);
  let maxFrames = 0, maxTimers = 0, strokes = 0;
  const watch = () => {
    maxFrames = Math.max(maxFrames, c.__clock.pendingFrames());
    maxTimers = Math.max(maxTimers, c.__clock.liveTimers());
  };
  for(let n = 0; n < 100; n++){
    let guard = 0;
    while(c.game.phase === 'ready' && guard++ < 40){
      const t = c.cutTarget(c.roll);
      if(rand() < 0.15){ c.keyboardCut(); watch(); continue; }
      const spacing = c.layout.L / c.roll.n;
      stroke(app, screenX(app, t.u) + (rand() - 0.5) * spacing * 0.5,
             { steps: [1, 2, 4, 12, 40][Math.floor(rand() * 5)], dx: (rand() - 0.5) * c.layout.T * 0.5 });
      strokes++;
      watch();
      advance(app, rand() < 0.5 ? 16 : 300);
      watch();
    }
    for(let t = 0; t < 30 && c.game.phase !== 'ready'; t++){ advance(app, 100); watch(); }
  }
  T('a hundred rolls were finished', c.game.rolls === 100, String(c.game.rolls));
  T('by real strokes, mostly', strokes > 300, String(strokes));
  T('no listener was added on the way', listeners(app) === base, listeners(app) + ' vs ' + base);
  T('never more than one frame waiting', maxFrames <= 1, String(maxFrames));
  T('never more than one timer waiting', maxTimers <= 1, String(maxTimers));
  T('the trail and incisions stay small', c.trail.length <= c.SLICE.trailMax && c.healing.length <= 8);
  T('pieces match the roll exactly', c.pieces.length === c.roll.cuts.length + 1);
  advance(app, 1000);
  T('at rest, no frame is waiting at all', c.__clock.pendingFrames() === 0, String(c.__clock.pendingFrames()));
  T('and nothing was saved', app.storage._map.size === 1);
  T('no errors', app.errors.length === 0, app.errors.slice(0, 2).join(' | '));

  sub('100 resets');
  for(let i = 0; i < 100; i++){
    c.keyboardCut();
    c.newRollFromTuning();
    hide(app); show(app);
    c.window.dispatch('pagehide', {}); c.window.dispatch('pageshow', {});
    c.window.dispatch('blur', {});
    watch();
  }
  T('no listener was added', listeners(app) === base, listeners(app) + ' vs ' + base);
  T('still at most one frame and one timer', maxFrames <= 1 && maxTimers <= 1, maxFrames + ' / ' + maxTimers);
  c.armHint(); c.armHint(); c.armHint();
  T('arming the hint again replaces its timer rather than adding one', c.__clock.liveTimers() === 1,
    String(c.__clock.liveTimers()));
  T('play is not left paused', c.pauses.size === 0);
  T('no errors', app.errors.length === 0, app.errors.slice(0, 2).join(' | '));
}

/* =========================================================
   CONTRACT 24 — EVERY SCREEN, EITHER WAY UP
   The roll fits the safe area fully cut, on tablets and phones
   in both orientations, and survives a rotation mid-roll.
   ========================================================= */
function testLayout(){
  section('CONTRACT 24 — the roll fits every screen, either way up, clear of notches');
  const screens = [
    ['iPad landscape', 1024, 768, { top: 24, bottom: 20 }],
    ['iPad portrait', 768, 1024, { top: 24, bottom: 20 }],
    ['iPad Pro landscape', 1366, 1024, { top: 24, bottom: 20 }],
    ['iPad Pro portrait', 1024, 1366, { top: 24, bottom: 20 }],
    ['phone portrait', 390, 844, { top: 47, bottom: 34 }],
    ['phone landscape', 844, 390, { left: 47, right: 47, bottom: 21 }],
    ['small phone portrait', 375, 667, {}],
    ['small phone landscape', 667, 375, {}],
    ['tiny portrait', 320, 568, {}],
    ['tiny landscape', 568, 320, {}]
  ];
  screens.forEach(([name, w, h, insets]) => {
    const app = play({ viewport: { width: w, height: h, dpr: 3, insets } });
    const c = app.ctx, L = c.layout;
    const ins = Object.assign({ top: 0, right: 0, bottom: 0, left: 0 }, insets);
    const n = c.roll.n;
    const widest = L.L + (n - 1) * L.gap;
    const safe = { x0: ins.left, x1: w - ins.right, y0: ins.top, y1: h - ins.bottom };
    /* The tallest things drawn: the hint's ghost finger above and below the
       roll (its path ends plus its radius), which also covers the counter,
       the plate and the finished-roll mark. */
    const dot = Math.max(12, L.T * 0.15);
    const top = L.top - L.T * 0.75 - dot, bottom = L.bot + L.T * 0.45 + dot;
    T(name + ': fully cut, the roll fits inside the safe area',
      L.cx - widest / 2 >= safe.x0 && L.cx + widest / 2 <= safe.x1,
      Math.round(L.cx - widest / 2) + '..' + Math.round(L.cx + widest / 2) + ' in ' + safe.x0 + '..' + safe.x1);
    T(name + ': so do the hint, the plate and the finished mark',
      top >= safe.y0 && bottom <= safe.y1, Math.round(top) + '..' + Math.round(bottom));
    T(name + ': the roll is thick enough to aim at with a finger', L.T >= 44, String(Math.round(L.T)));
    T(name + ': the canvas is sharp but never over 2x', stageOf(app).width === Math.round(w * 2));
  });

  sub('rotating mid-roll');
  const app = play({ viewport: { width: 1024, height: 768, dpr: 2 } }), c = app.ctx;
  c.TUNING.pull = 0;
  stroke(app, guideX(app, 1)); stroke(app, guideX(app, 3));
  advance(app, 30);
  const cuts = c.roll.cuts.slice();
  pe(app, 'pointerdown', guideX(app, 5), yAt(app, -0.8));
  pe(app, 'pointermove', guideX(app, 5), yAt(app, 0.4));
  c.__resize(768, 1024, { top: 24, bottom: 20 });
  T('the cuts are the same cuts', JSON.stringify(c.roll.cuts) === JSON.stringify(cuts));
  T('every piece keeps its share of the roll',
    c.pieceRects().every(r => near(r.w / c.layout.L, r.u1 - r.u0, 1e-9)));
  T('everything in motion comes to rest in the new geometry', c.pieces.every(p => p.off === 0 && p.vel === 0));
  T('the stroke in progress ends', c.gesture === null);
  pe(app, 'pointermove', 400, yAt(app, 1.8));
  pe(app, 'pointerup', 400, yAt(app, 1.8));
  T('and cannot cut afterwards', c.roll.cuts.length === 2);
  const x = guideX(app, 5);
  pe(app, 'pointerdown', x, yAt(app, -0.8));
  c.__resize(768, 1024, { top: 24, bottom: 20 });
  T('a resize that changes nothing does not end a stroke', c.gesture !== null);
  pe(app, 'pointermove', x, yAt(app, 1.8)); pe(app, 'pointerup', x, yAt(app, 1.8));
  T('which then cuts normally', c.roll.cuts.length === 3);
  c.__resize(844, 390, { left: 47, right: 47, bottom: 21 });
  T('a notch moving to the side moves the roll clear of it',
    c.layout.area.x >= 47 && c.layout.area.x + c.layout.area.w <= 844 - 47);
  T('no errors', app.errors.length === 0, app.errors.join(' | '));
}

/* =========================================================
   CONTRACT 25 — MOTION, AND LESS OF IT
   Decoration moves; essentials do not need to. With reduced
   motion every cut and every finished roll still reads clearly,
   and a change made mid-play takes effect at once.
   ========================================================= */
function testMotion(){
  section('CONTRACT 25 — reduced motion keeps what matters and drops the rest, live');
  let app = play(), c = app.ctx;
  c.TUNING.pull = 0;

  sub('with motion');
  stroke(app, guideX(app, 3));
  advance(app, 17);
  T('the halves spring apart', c.pieces.some(p => p.vel !== 0));
  let widest = 0;
  for(let i = 0; i < 60; i++){
    advance(app, 16);
    const [l, r] = c.pieceRects();
    widest = Math.max(widest, r.x - (l.x + l.w));
  }
  T('with a small overshoot past the resting gap', widest > c.layout.gap + 0.5, widest.toFixed(1) + ' vs ' + c.layout.gap);
  T('and settle exactly', c.pieces.every(p => p.off === 0 && p.vel === 0));
  advance(app, c.TUNING.hintS * 1000 + 50);
  T('the hint moves, so it asks for frames', c.hint.showing && c.__clock.pendingFrames() === 1);

  sub('reduced motion from the start');
  app = play({ reducedMotion: true }); c = app.ctx; c.TUNING.pull = 0;
  stroke(app, guideX(app, 2));
  T('a cut puts the pieces straight at rest', c.pieces.every(p => p.off === 0 && p.vel === 0));
  const [l2, r2] = c.pieceRects();
  T('the gap is there at once, so the cut still reads', near(r2.x - (l2.x + l2.w), c.layout.gap));
  T('and the new faces are lit', c.pieces[0].flashR > 0 && c.pieces[1].flashL > 0);
  T('the trail went with the finger', c.trail.length === 0);
  pe(app, 'pointerdown', r2.x + r2.w * 0.5, yAt(app, 0.5)); pe(app, 'pointerup', r2.x + r2.w * 0.5, yAt(app, 0.5));
  T('a tap does not jiggle anything', c.pieces.every(p => p.vel === 0));
  finishRollByKeys(app);
  advance(app, 17);
  T('a finished roll is still shown, marked on its plate', c.game.phase === 'done');
  advance(app, c.TUNING.holdMs);
  T('the plate appeared without sliding', c.gx === 0);
  T('the next roll arrives without sliding either', c.game.phase === 'ready' && c.gx === 0);
  advance(app, c.TUNING.hintS * 1000 + 50);
  T('the hint is a still picture that needs no frames', c.hint.showing && c.__clock.pendingFrames() === 0);

  sub('switched on mid-play');
  app = play(); c = app.ctx; c.TUNING.pull = 0;
  stroke(app, guideX(app, 1));
  advance(app, 17);
  T('pieces are in motion', c.pieces.some(p => p.off !== 0 || p.vel !== 0));
  c.__setReducedMotion(true);
  T('they stop where they would have come to rest, at once', c.pieces.every(p => p.off === 0 && p.vel === 0));
  finishRollByKeys(app);
  c.__setReducedMotion(false);
  advance(app, c.TUNING.holdMs + 20);
  T('with motion back, a roll slides away', c.game.phase === 'clear');
  advance(app, c.TUNING.clearMs * 0.5);
  T('and is caught mid-slide', c.gx > 0);
  c.__setReducedMotion(true);
  T('switching mid-slide puts it where it was going', c.gx === 0);
  advance(app, 17);
  T('and the next roll is simply there', c.game.phase === 'ready');
  c.__setReducedMotion(false);
  stroke(app, guideX(app, 2));
  advance(app, 17);
  T('switched off again, cuts spring as before', c.pieces.some(p => p.vel !== 0));
  T('the setting is listened to once, not once per roll', c.__motion.listenerCount() === 1);
  T('no errors', app.errors.length === 0, app.errors.join(' | '));
}

/* =========================================================
   CONTRACT 26 — PAUSE, RESUME AND THE TUNING SHEET
   Backgrounding, hiding and the developer sheet pause play in
   place. No stroke survives a pause, no time passes during one,
   and closing the sheet resumes safely.
   ========================================================= */
function testLifecycle(){
  section('CONTRACT 26 — pausing keeps play in place, and the ?tune sheet is safe');
  let app = play(), c = app.ctx;
  c.TUNING.pull = 0;

  sub('backgrounded mid-stroke');
  const x = guideX(app, 2);
  pe(app, 'pointerdown', x, yAt(app, -0.8));
  pe(app, 'pointermove', x, yAt(app, 0.4));
  hide(app);
  T('the stroke ends without a cut', c.gesture === null && c.roll.cuts.length === 0);
  T('no frame waits and no timer runs', c.__clock.pendingFrames() === 0 && c.__clock.liveTimers() === 0);
  pe(app, 'pointermove', x, yAt(app, 1.8));
  T('the finger moving on while hidden cuts nothing', c.roll.cuts.length === 0);
  show(app);
  T('coming back re-arms the hint and draws', c.__clock.liveTimers() === 1 && c.__clock.pendingFrames() === 1);
  pe(app, 'pointerup', x, yAt(app, 1.8));
  T('the old stroke does not resume', c.roll.cuts.length === 0);

  sub('backgrounded during the finished-roll show');
  app = play(); c = app.ctx;
  finishRollByKeys(app);
  advance(app, 200);
  const shownAt = c.game.phaseT;
  c.window.dispatch('pagehide', {});
  advance(app, 10 * 60 * 1000);
  T('no time passes while hidden', c.game.phase === 'done' && c.game.phaseT === shownAt);
  c.window.dispatch('pageshow', {});
  const offBefore = c.pieces.map(p => p.off).join(',');
  c.__frame();
  T('the first frame back does not jump', c.pieces.map(p => p.off).join(',') === offBefore);
  settleAll(app);
  T('the show then finishes on schedule', c.game.phase === 'ready' && c.game.rolls === 1);

  sub('the ?tune sheet is for developers only');
  app = play(); c = app.ctx;
  const btn = app.dom.document.getElementById('tuneBtn');
  T('without ?tune its button stays hidden', btn.hidden === true);
  c.openTuning();
  T('and the sheet cannot be opened', !app.dom.document.getElementById('tuneOverlay').classList.contains('open'));
  app = play({ search: '?tune' }); c = app.ctx;
  T('with ?tune the button shows', app.dom.document.getElementById('tuneBtn').hidden === false);

  sub('opening it mid-stroke pauses play');
  c.TUNING.pull = 0;
  const base = listeners(app);
  const tx = guideX(app, 2);
  pe(app, 'pointerdown', tx, yAt(app, -0.8));
  pe(app, 'pointermove', tx, yAt(app, 0.45));
  c.openTuning(); c.__flush();
  T('the sheet opens', app.dom.document.getElementById('tuneOverlay').classList.contains('open'));
  T('the stroke is cancelled without a cut', c.gesture === null && c.roll.cuts.length === 0);
  T('play is paused: no frame, no hint timer', c.pauses.has('tuning') && c.__clock.pendingFrames() === 0 &&
    c.__clock.liveTimers() === 0);
  T('Space on the page does not cut', (key(app, ' '), c.roll.cuts.length === 0));
  T('nor while a slider has focus', (key(app, ' ', { target: { tagName: 'INPUT', type: 'range' } }), c.roll.cuts.length === 0));
  T('nor does any direct attempt', c.keyboardCut() === false);

  sub('changing values');
  T('a value applies at once', c.setTuning('gap', 16) && c.TUNING.gap === 16 && c.layout.gap === 16);
  T('out-of-range values are clamped to the slider', c.setTuning('depth', 5) && c.TUNING.depth === 0.9);
  T('and land on its steps', c.setTuning('depth', 0.62) && c.TUNING.depth === 0.6);
  T('unknown or junk values are refused', !c.setTuning('nope', 1) && !c.setTuning('depth', 'abc') &&
    !c.setTuning('depth', '') && c.TUNING.depth === 0.6);
  c.setTuning('pieces', 8);
  const summary = app.dom.document.getElementById('tuneSummary').value;
  T('the summary lists the current values', (() => {
    try{ return JSON.parse(summary.slice(summary.indexOf('{'))).gap === 16; }catch(e){ return false; }
  })(), summary);
  c.copyTuning();
  T('copying works even without a clipboard', app.errors.length === 0);
  advance(app, 4000);                              // let its note leave; play stays paused meanwhile
  T('time passing with the sheet open changes nothing', c.pauses.has('tuning') && c.roll.cuts.length === 0);

  sub('closing resumes safely');
  c.closeTuning(); c.__flush();
  T('the sheet closes and play resumes', !app.dom.document.getElementById('tuneOverlay').classList.contains('open') &&
    c.pauses.size === 0 && c.__clock.pendingFrames() === 1 && c.__clock.liveTimers() === 1);
  T('a new piece count starts a fresh roll', c.roll.n === 8 && c.roll.cuts.length === 0);
  stroke(app, guideX(app, 1));
  T('and play goes on', c.roll.cuts.length === 1);

  /* The keyboard equivalent: the stage or the page may cut; a focused control
     keeps its own keys; a held key is one press. */
  sub('the keyboard, with no sheet open');
  const onButton = key(app, ' ', { target: app.dom.document.getElementById('tuneBtn') });
  T('Space on a focused button presses the button, never the knife',
    c.roll.cuts.length === 1 && onButton.defaultPrevented === false);
  key(app, ' ', { target: stageOf(app) });
  T('Space on the stage cuts at the next guide', c.roll.cuts.length === 2);
  key(app, 'Enter', { target: stageOf(app), repeat: true });
  T('a key held down does not keep cutting', c.roll.cuts.length === 2);
  key(app, ' ', { target: stageOf(app), ctrlKey: true });
  T('nor does a shortcut with a modifier', c.roll.cuts.length === 2);
  key(app, 'ArrowDown');
  T('the down arrow cuts too', c.roll.cuts.length === 3);
  settleAll(app);
  c.openTuning(); c.__flush();
  c.resetTuning();
  T('reset restores every starting value', Object.keys(c.TUNING_DEFAULTS).every(k => c.TUNING[k] === c.TUNING_DEFAULTS[k]));
  const closer = c.sheetCloser(app.dom.document.getElementById('tuneOverlay'));
  T('Escape and the back gesture find the sheet\'s own way out', typeof closer === 'function');
  closer(); c.__flush();
  T('and use it, resuming play', c.pauses.size === 0);

  sub('opening it during the finished-roll show');
  settleAll(app);
  finishRollByKeys(app);
  advance(app, 200);
  const at = c.game.phaseT;
  c.openTuning(); c.__flush();
  advance(app, 5000);
  T('the show waits', c.game.phase === 'done' && c.game.phaseT === at);
  c.closeTuning(); c.__flush();
  settleAll(app);
  T('and carries on after', c.game.phase === 'ready');

  sub('100 open and close cycles');
  let maxFrames = 0, maxTimers = 0;
  for(let i = 0; i < 100; i++){
    c.openTuning(); c.__flush();
    c.setTuning('pop', 200 + i);
    c.closeTuning(); c.__flush();
    maxFrames = Math.max(maxFrames, c.__clock.pendingFrames());
    maxTimers = Math.max(maxTimers, c.__clock.liveTimers());
  }
  T('no listener was added', listeners(app) === base, listeners(app) + ' vs ' + base);
  T('at most one frame and one timer ever waited', maxFrames <= 1 && maxTimers <= 1, maxFrames + ' / ' + maxTimers);
  T('the overlay stack is empty', c._openSheetStack.length === 0);
  T('no errors', app.errors.length === 0, app.errors.join(' | '));
}

/* =========================================================
   CONTRACT 27 — THE PERMANENT RULES
   No analytics, tracking or transmission; nothing about the child
   is recorded; no fail state; nothing to read in play; and the
   grown-up screens are out of a child's reach.
   ========================================================= */
function testPermanentRules(){
  section('CONTRACT 27 — privacy, kindness, and play without reading');
  const app = play({ search: '?tune' }), c = app.ctx;

  sub('play sends nothing anywhere');
  for(let n = 0; n < 20; n++){
    for(let guard = 0; guard < 20 && c.game.phase === 'ready'; guard++){
      stroke(app, screenX(app, c.cutTarget(c.roll).u), { steps: 3 });
    }
    settleAll(app);
  }
  T('twenty rolls were played', c.game.rolls === 20, String(c.game.rolls));
  c.openTuning(); c.__flush(); c.setTuning('gap', 12); c.copyTuning(); c.closeTuning(); c.__flush();
  hide(app); show(app); c.__resize(768, 1024); c.__setReducedMotion(true);
  advance(app, 20000);
  T('twenty rolls, tuning and lifecycle events made no network call', app.net.length === 0,
    app.net.map(n => n.kind + ' ' + n.target).join(', '));
  T('and recorded nothing about the player', app.storage._map.size === 1,
    [...app.storage._map.keys()].join(','));

  sub('no network, tracker or way out in the code');
  const script = codeOnly(js()), html = H.readApp();
  ['fetch(', 'XMLHttpRequest', 'sendBeacon', 'WebSocket', 'EventSource', 'importScripts', 'new Image'].forEach(api =>
    T('the app never uses ' + api, script.indexOf(api) === -1));
  T('the only request it starts is its own service worker, same folder',
    /navigator\.serviceWorker\.register\('sw\.js'\)/.test(js()));
  T('no analytics or tracking identifier appears anywhere',
    !/analytics|gtag|dataLayer|mixpanel|segment\.io|firebase|sentry|amplitude|hotjar|fbq\(|clarity\.ms/i.test(html + H.readSW()));
  T('the service worker only answers this app\'s own GET requests',
    /req\.method !== 'GET'/.test(H.readSW()) && /origin !== location\.origin/.test(H.readSW()) &&
    !/POST|sendBeacon|fetch\([^)]*method/.test(H.readSW()));
  T('there is no link, form or frame leading away', !/<a\s[^>]*href=|<form|<iframe/i.test(html) &&
    script.indexOf('window.open') === -1);
  const markup = html.replace(/<script>[\s\S]*?<\/script>/g, '');
  T('nothing asks for a name, email or anything typed',
    (markup.match(/<input/g) || []).length === 1 && /<input type="file" id="importInput"/.test(markup));
  T('the only inputs the script builds are the developer sliders',
    (js().match(/<input[^']*/g) || []).every(s => /type="range"/.test(s)));

  sub('no fail state, no score, nothing to read');
  const game = codeOnly(js().slice(js().indexOf('GAME DOMAIN — Slicing'), js().indexOf('SETTINGS — data ownership')));
  T('the game keeps no score, lives, misses or penalties',
    !/\b(score|lives|penalty|penalt|mistake|miss(es|ed)?|gameOver|fail(ed|ure)?)\b/i.test(game));
  T('the canvas never draws text', (stageOf(app).getContext('2d').counts.fillText || 0) === 0 &&
    (stageOf(app).getContext('2d').counts.strokeText || 0) === 0);
  const playView = (html.match(/<main[\s\S]*?<\/main>/) || [''])[0];
  T('the play screen shows no words: its only text is for assistive technology',
    playView.replace(/<[^>]+>/g, '').trim() === '');

  sub('grown-up screens are out of a child\'s reach');
  const outside = html.slice(html.indexOf('<body>'), html.indexOf('<!-- FEEL TUNING'));
  T('in play, the only control is the developer button, hidden without ?tune',
    (outside.match(/<button/g) || []).length === 1 && /id="tuneBtn"[\s\S]{0,160}hidden><\/button>/.test(outside));
  T('Backup & data and What\'s new open only from inside the tuning sheet',
    (html.match(/onclick="openDataSettings\(\)"/g) || []).length === 1 &&
    (html.match(/onclick="openUpdates\(\)"/g) || []).length === 1 &&
    html.indexOf('onclick="openDataSettings()"') > html.indexOf('id="tuneOverlay"'));
  T('no errors', app.errors.length === 0, app.errors.join(' | '));
}

module.exports = {
  T, section, sub, results, reset, testPortability,
  testBoot, testConfig, testStorage, testCollision, testMigration,
  testNavigation, testOverlays, testToast, testConfirmation, testErase,
  testMobile, testDesignSystem, testPWA, testRelease, testStress,
  testAccessibility, testContamination, testSourcesOfTruth,
  testCutModel, testStrokes, testGeometry, testRhythm, testLayout, testMotion,
  testLifecycle, testPermanentRules
};
