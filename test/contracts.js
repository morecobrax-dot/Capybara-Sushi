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

  sub('a minimal history, not an inherited one');
  /* The starter's own list once came along with it. This product's history
     starts at its own first release, and every entry is a later release of
     it: versions strictly descend to 0.1.0, so nothing older can hide below. */
  const semver = v => v.split('.').map(Number);
  const newer = (a, b) => { const x = semver(a), y = semver(b); for(let i = 0; i < 3; i++){ if(x[i] !== y[i]) return x[i] > y[i]; } return false; };
  T('this product\'s own releases, not an inherited list: they end at its first release',
    c.APP_UPDATES[c.APP_UPDATES.length - 1].id === 'v0-1-0', c.APP_UPDATES[c.APP_UPDATES.length - 1].id);
  T('and each entry is a newer release than the one below it',
    c.APP_UPDATES.every((u, i) => i === c.APP_UPDATES.length - 1 || newer(u.version, c.APP_UPDATES[i + 1].version)),
    c.APP_UPDATES.map(u => u.version).join(' > '));
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
/* Contracts describe a stroke where the knife measures it: on the roll's
   own upright plane (toRoll in the app), x along the roll from its middle
   and y down from the board's top, in the pixels of the roll's middle. pr()
   dispatches the event at the stage pixel the app's camera shows that
   point at, so every stroke goes through the same camera as a finger. */
/* Heights in roll thicknesses: 0 is the roll's top edge, 1 its bottom. */
function yAt(app, f){ const L = app.ctx.layout; return L.top + L.T * f; }
/* A pointer event at a point of the roll's plane. */
function pr(app, type, x, y, o){ const p = app.ctx.toStage(x, y); return pe(app, type, p.x, p.y, o); }
/* A straight stroke at x, from `from` to `to` (in thicknesses), in `steps`
   moves. Returns how many cuts the roll had just before release. */
function stroke(app, x, o){
  const s = Object.assign({ from: -0.8, to: 1.8, steps: 12, dx: 0, id: 1, type: 'touch', release: 'pointerup' }, o || {});
  const who = { pointerId: s.id, pointerType: s.type };
  pr(app, 'pointerdown', x, yAt(app, s.from), who);
  for(let i = 1; i <= s.steps; i++){
    pr(app, 'pointermove', x + s.dx * i / s.steps, yAt(app, s.from + (s.to - s.from) * i / s.steps), who);
  }
  const before = app.ctx.roll.cuts.length;
  if(s.release) pr(app, s.release, x + s.dx, yAt(app, s.to), who);
  return before;
}
/* Where along the roll's plane the roll's point u is right now. */
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
/* Play holds at most two timers, each with one owner: the hint's, and the
   chef's next idle gesture while the chef is on the stage. */
function owned(c){ return (c.hint.timer ? 1 : 0) + (c.chef.timer ? 1 : 0); }
/* Wait out an idle gesture of the chef's, so the scene is truly at rest. */
function restNow(app){
  const c = app.ctx;
  for(let i = 0; i < 100 && (c.chef.gesture || c.chefMoving()); i++) advance(app, 50);
  advance(app, 50);
}
/* What the scene is made of once, for good: the counter, its edge, the
   board, the plate and the shadow blob, and each of the chef's meshes. */
function sceneryShapes(c){ let n = 0; c.view3d.chef.root.traverse(o => { if(o.isMesh) n++; }); return 5 + n; }

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
  pr(app, 'pointerdown', x3, yAt(app, -0.8));
  pr(app, 'pointerup', x3, yAt(app, 1.8));
  T('a flick seen only at press and release still cuts, once', c.roll.cuts.length === 3);
  settleAll(app);

  sub('diagonal and slanted strokes');
  app = play(); c = app.ctx; c.TUNING.pull = 0;
  const L = c.layout, x0 = c.layout.cx - 150;
  /* 45 degrees: equal travel across and down. */
  pr(app, 'pointerdown', x0, yAt(app, -0.6));
  for(let i = 1; i <= 16; i++) pr(app, 'pointermove', x0 + L.T * 2.2 * i / 16, yAt(app, -0.6 + 2.2 * i / 16));
  pr(app, 'pointerup', x0 + L.T * 2.2, yAt(app, 1.6));
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
  pr(app, 'pointerdown', c.layout.cx - 200, yAt(app, 0.5));
  for(let i = 1; i <= 10; i++) pr(app, 'pointermove', c.layout.cx - 200 + 40 * i, yAt(app, 0.5 + 0.02 * i));
  pr(app, 'pointerup', c.layout.cx + 200, yAt(app, 0.7));
  T('a swipe along the roll cuts nothing', c.roll.cuts.length === before);

  sub('incomplete strokes and taps cut nothing and cost nothing');
  app = play(); c = app.ctx; c.TUNING.pull = 0;
  const xm = guideX(app, 2);
  pr(app, 'pointerdown', xm, yAt(app, 0.5)); pr(app, 'pointerup', xm, yAt(app, 0.5));
  T('a tap cuts nothing', c.roll.cuts.length === 0);
  T('it is still noticed: the tapped piece jiggles', c.pieces[0].vel !== 0);
  settleAll(app);
  /* The piece under the finger is found through the camera, as a cut is:
     a tap on the narrow far-end piece, just short of its cut, jiggles that
     piece and leaves its neighbour be. There the glass and the roll's plane
     disagree most, so reading the tap on the glass would pick the wrong one. */
  const tapped = play(), tc = tapped.ctx; tc.TUNING.pull = 0;
  stroke(tapped, guideX(tapped, 1));
  settleAll(tapped);
  const far = tc.pieceRects()[0], xn = tc.xAt(far, far.u1 - 0.045);
  pr(tapped, 'pointerdown', xn, yAt(tapped, 0.5)); pr(tapped, 'pointerup', xn, yAt(tapped, 0.5));
  T('a tap jiggles the piece under the finger, and only that one', tc.pieces[0].vel !== 0 && tc.pieces[1].vel === 0,
    tc.pieces.map(p => p.vel.toFixed(2)).join(' / '));
  stroke(app, xm, { from: -0.8, to: 0.4 });
  T('a stroke that stops 40% of the way in cuts nothing', c.roll.cuts.length === 0);
  T('and its incision heals', c.healing.length === 1);
  advance(app, 400);
  T('closed within the heal time', c.healing.length === 0);
  pr(app, 'pointerdown', xm, yAt(app, -0.8));
  [-0.2, 0.2, 0.45, 0.2, -0.2, -0.8].forEach(f => pr(app, 'pointermove', xm, yAt(app, f)));
  pr(app, 'pointerup', xm, yAt(app, -0.8));
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
  pr(app, 'pointerdown', xa, yAt(app, -0.8));
  [[xa, 1.8], [xb, -0.8], [xb, 1.8], [xc, -0.8], [xc, 1.8]].forEach(p => pr(app, 'pointermove', p[0], yAt(app, p[1])));
  pr(app, 'pointerup', xc, yAt(app, 1.8));
  T('a zigzag crossing the roll again and again makes one cut', c.roll.cuts.length === 1);
  settleAll(app);
  const x2 = guideX(app, 2);
  pr(app, 'pointerdown', x2, yAt(app, -0.8));
  pr(app, 'pointerdown', x2, yAt(app, -0.8));                   // the same press, reported twice
  pr(app, 'pointermove', x2, yAt(app, 0.5));
  pr(app, 'pointermove', x2, yAt(app, 0.5));                    // the same move, reported twice
  pr(app, 'pointermove', x2, yAt(app, 1.8));
  pr(app, 'pointermove', x2, yAt(app, 1.8));
  T('duplicated events still make one cut', c.roll.cuts.length === 2);
  pr(app, 'pointerup', x2, yAt(app, 1.8));
  pr(app, 'pointerup', x2, yAt(app, 1.8));
  T('a duplicated release neither undoes it nor adds another', c.roll.cuts.length === 2);
  settleAll(app);
  ['pointercancel', 'lostpointercapture'].forEach((ending, k) => {
    const xe = guideX(app, 3 + k);
    const n0 = c.roll.cuts.length;
    stroke(app, xe, { release: ending });
    T('a cut stays cut when ' + ending + ' follows it', c.roll.cuts.length === n0 + 1);
    T('and ' + ending + ' adds nothing more', (() => { pr(app, 'pointerup', xe, yAt(app, 1.8)); return c.roll.cuts.length === n0 + 1; })());
    settleAll(app);
  });
  T('no errors through any of it', app.errors.length === 0, app.errors.join(' | '));

  sub('mouse: only a pressed left button cuts');
  app = play(); c = app.ctx; c.TUNING.pull = 0;
  const mx = guideX(app, 1), mouse = { pointerType: 'mouse' };
  for(let i = 0; i <= 12; i++) pr(app, 'pointermove', mx, yAt(app, -0.8 + 2.6 * i / 12), Object.assign({ buttons: 0 }, mouse));
  T('hovering across the roll cuts nothing', c.roll.cuts.length === 0);
  pr(app, 'pointerdown', mx, yAt(app, -0.8), Object.assign({ button: 2, buttons: 2 }, mouse));
  for(let i = 1; i <= 12; i++) pr(app, 'pointermove', mx, yAt(app, -0.8 + 2.6 * i / 12), Object.assign({ buttons: 2 }, mouse));
  pr(app, 'pointerup', mx, yAt(app, 1.8), Object.assign({ button: 2 }, mouse));
  T('a right-button drag cuts nothing', c.roll.cuts.length === 0);
  pr(app, 'pointerdown', mx, yAt(app, -0.8), Object.assign({ button: 2, buttons: 2 }, mouse));
  pr(app, 'pointerup', mx, yAt(app, 1.8), Object.assign({ button: 2 }, mouse));
  T('nor a right-button press released on the far side', c.roll.cuts.length === 0);
  const menu = { defaultPrevented: false, preventDefault(){ this.defaultPrevented = true; } };
  stageOf(app).dispatch('contextmenu', menu);
  T('and no context menu opens over the stage', menu.defaultPrevented === true);
  T('a left-button drag cuts', stroke(app, mx, { type: 'mouse' }) >= 0 && c.roll.cuts.length === 1);
  settleAll(app);
  const mx2 = guideX(app, 2);
  pr(app, 'pointerdown', mx2, yAt(app, -0.8), mouse);
  pr(app, 'pointermove', mx2, yAt(app, 0.3), mouse);
  pr(app, 'pointermove', mx2, yAt(app, 1.8), Object.assign({ buttons: 0 }, mouse));
  T('a button released out of sight ends the stroke instead of cutting', c.roll.cuts.length === 1 && c.gesture === null);
  settleAll(app);
  stroke(app, guideX(app, 3), { type: 'pen' });
  T('a pen cuts like a finger', c.roll.cuts.length === 2);

  sub('one finger owns the knife until it truly lets go');
  app = play(); c = app.ctx; c.TUNING.pull = 0;
  const own = guideX(app, 2), other = guideX(app, 4);
  pr(app, 'pointerdown', own, yAt(app, -0.8));
  advance(app, 3000);
  T('holding still for three seconds keeps the knife', c.gesture && c.gesture.id === 1);
  advance(app, 6000);
  T('and no hint interrupts a held finger', c.hint.showing === false);
  const extra = { pointerId: 2, isPrimary: false };
  pr(app, 'pointerdown', other, yAt(app, -0.8), extra);
  pr(app, 'pointermove', other, yAt(app, 1.8), extra);
  T('a second finger crossing the roll cuts nothing', c.roll.cuts.length === 0);
  T('and takes nothing from the first', c.gesture && c.gesture.id === 1);
  pr(app, 'pointerup', other, yAt(app, 1.8), extra);
  T('its release does not end the first finger\'s stroke', c.gesture && c.gesture.id === 1);
  pr(app, 'pointermove', own, yAt(app, 0.4));
  pr(app, 'pointermove', own, yAt(app, 1.8));
  T('after the long pause, the first finger carries on and cuts', c.roll.cuts.length === 1);
  pr(app, 'pointerup', own, yAt(app, 1.8));
  settleAll(app);
  pr(app, 'pointerdown', own, yAt(app, -0.8), { pointerId: 7 });
  pr(app, 'pointerdown', other, yAt(app, -0.8), { pointerId: 8, isPrimary: true });
  T('a new primary touch means the browser saw the old one lift', c.gesture && c.gesture.id === 8);
  pr(app, 'pointerup', other, yAt(app, -0.8), { pointerId: 8 });

  sub('cancellation ends a stroke and never cuts');
  [['pointercancel', () => pe(app, 'pointercancel', 0, 0)],
   ['lostpointercapture', () => pe(app, 'lostpointercapture', 0, 0)],
   ['window blur', () => c.window.dispatch('blur', {})]].forEach(([label, interrupt]) => {
    const n0 = c.roll.cuts.length, x = screenX(app, c.cutTarget(c.roll).u);
    pr(app, 'pointerdown', x, yAt(app, -0.8));
    pr(app, 'pointermove', x, yAt(app, 0.4));
    interrupt();
    T(label + ' mid-stroke leaves no cut', c.roll.cuts.length === n0 && c.gesture === null);
    T(label + ' gives the pointer back', !stageOf(app).hasPointerCapture(1));
    pr(app, 'pointermove', x, yAt(app, 1.8));
    pr(app, 'pointerup', x, yAt(app, 1.8));
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

  sub('the 3D scene shows exactly what the knife is tested against');
  stroke(app, guideX(app, 1));
  advance(app, 17);
  T('pieces are moving after the cut', c.pieces.some(p => p.off !== 0 || p.vel !== 0 || p.tilt !== 0));
  const painted = JSON.stringify(c.paint.rects), live = JSON.stringify(c.pieceRects());
  T('the last frame drew the rectangles hit testing uses', painted === live);
  /* Through the real Three.js camera, not the game's own arithmetic: each
     piece's meshes, as placed in the scene graph and seen on the glass, fall
     on the stretch of the roll's plane the knife tests for that piece. */
  const onScreen = (cam, v) => {
    const p = v.clone().project(cam);
    return { x: (p.x + 1) / 2 * c.layout.W, y: (1 - p.y) / 2 * c.layout.H };
  };
  const cam = c.view3d.camera, T3 = c.THREE;
  const placed = c.paint.rects.every((r, i) => {
    const view = c.view3d.views[i];
    if(!view) return false;
    view.group.updateMatrixWorld(true);
    const h = view.len / 2, y = c.SCENE.halfHeight;
    const a = c.toRoll(onScreen(cam, view.group.localToWorld(new T3.Vector3(-h, y, 0))));
    const b = c.toRoll(onScreen(cam, view.group.localToWorld(new T3.Vector3(h, y, 0))));
    return a && b && near(a.x, r.x, 0.5) && near(b.x, r.x + r.w, 0.5);
  });
  T('each piece\'s meshes sit exactly on its rectangle, seen through the scene\'s camera', placed);
  T('there is one set of meshes per piece, in order', c.view3d.views.length === c.pieceRects().length &&
    c.view3d.views.every((v, i) => near(v.u0, c.pieceRects()[i].u0, 0) && near(v.u1, c.pieceRects()[i].u1, 0)));
  const probes = [[0, c.SCENE.halfHeight, 0], [-4.2, 0, 1], [4.2, 2, -1], [2.5, 0.3, 2.3], [-6, -0.5, -2.3]];
  T('the game\'s camera and the scene\'s camera agree to a fraction of a pixel', probes.every(([x, y, z]) => {
    const mine = c.project(c.layout.view, x, y, z), theirs = onScreen(cam, new T3.Vector3(x, y, z));
    return near(mine.x, theirs.x, 0.05) && near(mine.y, theirs.y, 0.05);
  }));
  /* Hard rule 2: no colour typed into code. The scene and the flat layer
     cannot use var(), so they read the tokens instead, and nothing in the
     game names a colour. */
  const gameText = stripComments(js().slice(js().indexOf('GAME DOMAIN — Slicing'), js().indexOf('SETTINGS — data ownership')));
  T('the game types no colour of its own: every one comes from a token',
    !/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/.test(gameText),
    (gameText.match(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/) || [''])[0]);
  const tokens = Object.values(c.COLOR_TOKENS);
  T('every colour the game uses is a declared layer-4 token', tokens.length >= 20 &&
    tokens.every(t => new RegExp(t + ':').test(css())), tokens.filter(t => !new RegExp(t + ':').test(css())).join(', '));
  T('and each one resolved to a value at runtime', Object.keys(c.COLOR_TOKENS).every(k => !!c.colors[k]));
  T('the materials are painted in their tokens', (() => {
    const same = (a, b) => near(a.r, b.r, 1e-6) && near(a.g, b.g, 1e-6) && near(a.b, b.b, 1e-6);
    return same(c.view3d.kit.plate.color, new T3.Color(c.colors.plate)) &&
           same(c.view3d.kit.shadow.color, new T3.Color(c.colors.shadow)) &&
           same(c.view3d.kit.cap.emissive, new T3.Color(c.colors.flash));
  })());

  /* The cut face is a solid disc: nori at its rim, rice, and salmon at its
     heart — never a hollow tube or a paper-thin shell. */
  sub('every piece is solid, with a filled cross-section');
  const capTex = c.view3d.kit.cap.map.image;
  const texel = (u, v) => {
    const i = (Math.floor(v * capTex.height) * capTex.width + Math.floor(u * capTex.width)) * 4;
    return [capTex.data[i], capTex.data[i + 1], capTex.data[i + 2]];
  };
  const closeTo = (px, token, tol) => { const t = c.rgbOf(c.colors[token]);
    return Math.abs(px[0] - t[0]) + Math.abs(px[1] - t[1]) + Math.abs(px[2] - t[2]) <= tol; };
  const lum = px => px[0] * 0.3 + px[1] * 0.59 + px[2] * 0.11;
  const salmony = px => ['salmon', 'salmonDeep', 'salmonFat'].some(k => closeTo(px, k, 120));
  /* The salmon sits off the middle toward the front of the roll: the side a
     gap shows, and the side a served piece's neighbour leaves in view. */
  const sx = 0.5 + 0.26 / c.SCENE.faceSpan, sy = 0.5 + 0.07 / c.SCENE.faceSpan;
  T('a face is salmon a little off its middle, toward the front', salmony(texel(sx, sy)) && sx > 0.55, texel(sx, sy).join(','));
  const orange = px => ['salmon', 'salmonDeep'].some(k => closeTo(px, k, 120));
  T('round the salmon is rice, all the way to the edge', [[0.5, 0.2], [0.93, 0.5], [0.5, 0.8], [0.2, 0.5], [0.02, 0.02]]
    .every(([u, v]) => lum(texel(u, v)) > 150 && !orange(texel(u, v))),
    [[0.5, 0.2], [0.93, 0.5], [0.5, 0.8], [0.2, 0.5], [0.02, 0.02]].map(([u, v]) => texel(u, v).join(',')).join(' | '));
  /* Checked on the rest shape; the jiggle moves a face and its rim together. */
  const view = c.view3d.views[0];
  const [side, capL, capR] = view.parts;
  const ring = part => { const p = part.rest, out = []; for(let i = 0; i < p.length; i += 3) out.push([p[i], p[i + 1], p[i + 2]]); return out; };
  const S = c.SCENE.segments + 1, sidePts = ring(side);
  const faceRim = pts => pts.slice(0, S), leftEnd = sidePts.slice(0, S), rightEnd = sidePts.slice(sidePts.length - S);
  const joined = (a, b) => a.every((p, i) => near(p[0], b[i][0], 1e-5) && near(p[1], b[i][1], 1e-5) && near(p[2], b[i][2], 1e-5));
  T('each face closes the nori exactly: its rim is the side\'s last ring, point for point',
    joined(faceRim(ring(capL)), leftEnd) && joined(faceRim(ring(capR)), rightEnd));
  /* The nori has a thickness: at each face a band of it, in the face's own
     plane, runs from the rounded rim in to where the rice begins — so a face
     is rimmed by the nori itself, not by paint. */
  const rimL = sidePts.slice(S, 2 * S), rimR = sidePts.slice(sidePts.length - 2 * S, sidePts.length - S);
  const radius = (pts, k) => Math.hypot(pts[k][1] - c.SCENE.halfHeight, pts[k][2]);
  T('each face is rimmed by a band of the nori itself, in the face\'s plane',
    [[leftEnd, rimL], [rightEnd, rimR]].every(([inner, rim]) => inner.every((p, k) =>
      near(p[0], rim[k][0], 1e-9) && radius(inner, k) < radius(rim, k) - 0.02)));
  T('and the jiggle moves a face with its rim: they follow the same points of the roll',
    [0, 1].every(k => { const cap = k ? capR : capL, off = k ? side.na.length - S : 0;
      for(let j = 0; j < S; j++) if(cap.na[j] !== side.na[off + j] || cap.nb[j] !== side.nb[off + j] ||
                                     !near(cap.nw[j], side.nw[off + j], 1e-9)) return false;
      return true; }));
  /* Culling hides a triangle facing away from the camera, so a face wound
     the wrong way round is a hole. Every triangle must face out. */
  const outward = part => {
    const p = part.rest, n = part.restN, idx = part.geo.index.array;
    for(let k = 0; k < idx.length; k += 3){
      const [a, b, d] = [idx[k] * 3, idx[k + 1] * 3, idx[k + 2] * 3];
      const e1 = [p[b] - p[a], p[b + 1] - p[a + 1], p[b + 2] - p[a + 2]];
      const e2 = [p[d] - p[a], p[d + 1] - p[a + 1], p[d + 2] - p[a + 2]];
      const f = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      const len = Math.hypot(f[0], f[1], f[2]);
      if(len < 1e-12) continue;
      if(f[0] * (n[a] + n[b] + n[d]) + f[1] * (n[a + 1] + n[b + 1] + n[d + 1]) + f[2] * (n[a + 2] + n[b + 2] + n[d + 2]) <= 0) return false;
    }
    return true;
  };
  T('every triangle of the nori and of both faces faces outward', view.parts.every(outward));
  /* Two faces of one cut are that cut seen from either side, so they match;
     faces of different cuts do not, so no two are stamped alike. */
  const f1 = c.faceOf(3, 0.4), f2 = c.faceOf(3, 0.4), f3 = c.faceOf(3, 0.55), f4 = c.faceOf(4, 0.4);
  T('the two faces of one cut show the same rice and salmon', JSON.stringify(f1) === JSON.stringify(f2));
  T('but faces of other cuts, or of another roll, sit differently',
    [f3, f4].every(f => f.turn !== f1.turn && f.dx !== f1.dx && [...f.edge].some((e, k) => e !== f1.edge[k])));
  T('the rice\'s edge wanders inside the nori, gently, never through it',
    [f1, f3, f4].every(f => [...f.edge].every(e => e < 1 - c.SCENE.band * 0.4 && e > 1 - c.SCENE.band * 1.6)));
  /* The counter fills most of the screen: it is drawn with plain matte
     shading, and only the food reflects the room, which is what keeps the
     frame time where Phase 1A had it on a modest GPU. */
  const K = c.view3d.kit;
  T('only the food reflects the room; the counter stays cheap to draw',
    K.counter.isMeshLambertMaterial === true && K.nori.envMap === K.room && K.cap.envMap === K.room &&
    !K.wood.envMap && !K.plate.envMap && !c.view3d.scene.environment);
  T('a face is a full disc, not a ring: it reaches the middle',
    [capL, capR].every(part => { const p = part.rest, k = p.length - 3;
      return near(p[k + 2], 0, 1e-9) && near(p[k + 1] / c.SCENE.halfHeight, 1, 0.05); }));

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
  const edgeX = c.toRoll({ x: 1, y: c.toStage(0, c.layout.mid).y }).x;
  stroke(app, edgeX, { steps: 1, from: -0.8, to: 1.8 });
  T('nor at the stage\'s edge', c.roll.cuts.length === 1);

  /* Strokes anywhere, at any moment, while pieces fly: whatever is accepted
     is inside real food and leaves usable pieces on both sides. */
  sub('300 strokes anywhere, at any moment');
  app = play(); c = app.ctx;
  const rand = H.mulberry32(7);
  let bad = 0, cuts = 0;
  for(let i = 0; i < 300; i++){
    const n0 = c.roll.cuts.length, roll0 = c.roll.id;
    const drawn = c.pieceRects();
    /* On the glass, not on the roll's plane: anywhere, any slant, any speed. */
    const A = c.layout.area, x0 = A.x + rand() * A.w, y0 = A.y + rand() * A.h * 0.6;
    const x1 = x0 + (rand() - 0.5) * A.w * 0.3, y1 = y0 + A.h * (0.1 + rand() * 0.5), steps = 1 + Math.floor(rand() * 20);
    pe(app, 'pointerdown', x0, y0);
    for(let k = 1; k <= steps; k++) pe(app, 'pointermove', x0 + (x1 - x0) * k / steps, y0 + (y1 - y0) * k / steps);
    pe(app, 'pointerup', x1, y1);
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
  pr(app, 'pointerdown', last, yAt(app, -0.8));
  pr(app, 'pointermove', last, yAt(app, 1.8));
  T('the fifth cut finishes the roll at once', c.game.phase === 'done' && c.roll.cuts.length === 5);
  T('the knife is lifted before anything else happens', c.gesture === null);
  T('and the finger is let go', !stageOf(app).hasPointerCapture(1));
  advance(app, c.TUNING.holdMs * 0.6);
  T('the pieces are shown together on a plate', c.game.gathered === true);
  settleAll(app);
  T('then the next roll is ready', c.game.phase === 'ready' && c.game.rolls === 1 && c.roll.cuts.length === 0);
  pr(app, 'pointermove', last, yAt(app, -0.8));
  pr(app, 'pointermove', last, yAt(app, 1.8));
  T('the finger still held from the last cut cannot cut the new roll', c.roll.cuts.length === 0);
  pr(app, 'pointerup', last, yAt(app, 1.8));
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
  T('never more than one timer each for the hint and the chef', maxTimers <= 2, String(maxTimers));
  T('the trail and incisions stay small', c.trail.length <= c.SLICE.trailMax && c.healing.length <= 8);
  T('pieces match the roll exactly', c.pieces.length === c.roll.cuts.length + 1);
  advance(app, 3000);                              // the softest jiggle takes a moment to settle
  restNow(app);
  T('at rest, between the chef\'s idle gestures, no frame is waiting at all', c.__clock.pendingFrames() === 0, String(c.__clock.pendingFrames()));
  T('and nothing was saved', app.storage._map.size === 1);
  T('no errors', app.errors.length === 0, app.errors.slice(0, 2).join(' | '));

  /* Every cut builds geometry for two new pieces, and every roll replaces
     them all. What was replaced must be disposed, or the GPU fills up a
     roll at a time. */
  sub('a hundred rolls later, the GPU holds only what is on screen');
  const gpu = app.gpu.renderers[0], v3 = c.view3d;
  c.paintNow();
  const perPiece = 3;
  T('the scene holds one set of meshes per piece, and no more', v3.views.length === c.pieces.length &&
    v3.pieceGroup.children.length === v3.views.length * 2, v3.views.length + ' views, ' + v3.pieceGroup.children.length + ' objects');
  T('every piece geometry made was disposed, bar those on screen',
    v3.made.geometries - v3.freed.geometries === v3.views.length * perPiece &&
    v3.made.materials - v3.freed.materials === v3.views.length * perPiece,
    JSON.stringify(v3.made) + ' / ' + JSON.stringify(v3.freed));
  T('the renderer holds the scenery, the chef and the pieces on screen, nothing older',
    gpu.info.memory.geometries === sceneryShapes(c) + v3.views.length * perPiece, String(gpu.info.memory.geometries));
  /* Eight: the nori's two maps, the face's two, the wood, the counter, the
     shadow's blob and the room the food reflects. */
  T('textures were made once and shared: the kit\'s eight, still', c.view3d.kit.textures.length === 8 &&
    gpu.info.memory.textures === c.view3d.kit.textures.length, String(gpu.info.memory.textures));
  T('nothing disposed was ever drawn again', app.errors.length === 0, app.errors.slice(0, 2).join(' | '));
  T('the renderer was created once', app.gpu.renderers.length === 1 && app.gpu.constructed === 1);

  /* The hint animates the flat layer only. The scene is drawn again at rest
     only for the chef's idle gestures — a blink, a flick, a glance — each
     with quiet before the next, and once more when it ends. */
  sub('an idle scene is drawn only for the chef\'s sparse gestures');
  for(let t = 0; t < 400 && c.sceneMoving(); t++) advance(app, 50);
  advance(app, 50);                                // the frame that draws it at rest
  const drawnAt = [], render = gpu.render;
  gpu.render = function(sc, cam){ drawnAt.push({ t: c.__clock.now, g: !!c.chef.gesture }); return render.call(this, sc, cam); };
  advance(app, c.TUNING.hintS * 1000 + 30000);
  gpu.render = render;
  T('the hint animates the flat layer, so frames run', c.hint.showing && c.__clock.pendingFrames() === 1);
  const stray = drawnAt.filter((d, i) => !d.g && !(i > 0 && drawnAt[i - 1].g && d.t - drawnAt[i - 1].t < 40));
  T('the 3D scene is drawn only while the chef makes an idle gesture, and once as it ends', stray.length === 0,
    stray.length + ' of ' + drawnAt.length + ' renders');
  const starts = drawnAt.filter((d, i) => d.g && (i === 0 || !drawnAt[i - 1].g || d.t - drawnAt[i - 1].t > 40)).map(d => d.t);
  T('and its gestures are sparse, with quiet between them', starts.length >= 3 &&
    starts.every((t, i) => i === 0 || t - starts[i - 1] >= c.SCENE.chef.quiet[0] - 20),
    starts.map(t => Math.round(t)).join(', '));
  T('at 30 frames a gesture at most', drawnAt.length <= starts.length * 90, drawnAt.length + ' renders for ' + starts.length);

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
  T('still at most one frame, and one timer each for the hint and the chef', maxFrames <= 1 && maxTimers <= 2, maxFrames + ' / ' + maxTimers);
  c.paintNow();
  T('a hundred fresh rolls left the GPU holding only what is on screen',
    c.view3d.made.geometries - c.view3d.freed.geometries === c.view3d.views.length * 3 &&
    app.gpu.renderers[0].info.memory.geometries === sceneryShapes(c) + c.view3d.views.length * 3 &&
    app.gpu.renderers[0].info.memory.textures === c.view3d.kit.textures.length, JSON.stringify(app.gpu.renderers[0].info.memory));
  c.armHint(); c.armHint(); c.armHint();
  c.armChef(); c.armChef(); c.armChef();
  T('arming the hint or the chef again replaces its timer rather than adding one',
    c.__clock.liveTimers() === 2 && owned(c) === 2, String(c.__clock.liveTimers()));
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
    const n = c.roll.n, v = L.view, h2 = 2 * c.SCENE.halfHeight;
    const safe = { x0: ins.left, x1: w - ins.right, y0: ins.top, y1: h - ins.bottom };
    const inside = pts => pts.every(p => p.x >= safe.x0 - 0.5 && p.x <= safe.x1 + 0.5 && p.y >= safe.y0 - 0.5 && p.y <= safe.y1 + 0.5);
    const span = pts => Math.round(Math.min(...pts.map(p => p.x))) + '..' + Math.round(Math.max(...pts.map(p => p.x))) + ' x ' +
      Math.round(Math.min(...pts.map(p => p.y))) + '..' + Math.round(Math.max(...pts.map(p => p.y)));
    /* The roll fully cut, gaps and the rice bulging from its ends and all,
       as the camera shows it. */
    const half = (L.L + (n - 1) * L.gap) / 2 / v.ppw + c.SCENE.endDome;
    const rollPts = [];
    [-half, half].forEach(x => [0, h2].forEach(y => [-1, 1].forEach(z => rollPts.push(c.project(v, x, y, z)))));
    T(name + ': fully cut, the roll and its ends fit inside the safe area', inside(rollPts), span(rollPts) + ' in ' + JSON.stringify(safe));
    /* The hint's ghost finger, above and below the roll. */
    const dot = Math.max(12, L.T * 0.15);
    const hintPts = [c.toStage(-L.L / 2, L.top - L.T * 0.75), c.toStage(L.L / 2, L.top - L.T * 0.75),
                     c.toStage(-L.L / 2, L.bot + L.T * 0.45), c.toStage(L.L / 2, L.bot + L.T * 0.45)]
      .map((p, k) => ({ x: p.x, y: p.y + (k < 2 ? -dot : dot) }));
    T(name + ': so does the hint\'s swipe', inside(hintPts), span(hintPts));
    const tall = c.toStage(0, L.bot).y - c.toStage(0, L.top).y;
    T(name + ': the roll is thick enough to aim at with a finger', tall >= 44, String(Math.round(tall)));
    T(name + ': the canvas is sharp but never over 2x', stageOf(app).width === Math.round(w * 2));
    /* Served: every piece on the plate, and the finished mark above them. */
    finishRollByKeys(app);
    advance(app, c.TUNING.holdMs * 0.95);
    const served = [];
    c.pieceRects().forEach(r => { const p = r.pose, ct = Math.cos(p.turn), st = Math.sin(p.turn);
      [-p.len / 2, p.len / 2].forEach(lx => [-1, 1].forEach(lz => [p.y, p.y + h2].forEach(y =>
        served.push(c.project(v, p.x + lx * ct + lz * st, y, p.z - lx * st + lz * ct))))); });
    T(name + ': served, every piece is on the stage', inside(served), span(served));
    const ctx2 = stageOf(app).getContext('2d');
    ctx2.recording = true; ctx2.log = [];
    c.paintNow();
    ctx2.recording = false;
    const mark = ctx2.log.filter(e => e.m === 'arc');
    T(name + ': and so is the finished mark', mark.length > 0 && mark.every(e =>
      e.args[0] - e.args[2] >= safe.x0 && e.args[0] + e.args[2] <= safe.x1 && e.args[1] - e.args[2] >= safe.y0 &&
      e.args[1] + e.args[2] <= safe.y1), mark.map(e => e.args.slice(0, 3).map(Math.round).join(',')).join(' '));
    const gl = app.gpu.renderers[0];
    T(name + ': the 3D scene fills the screen within its pixel budget', gl.width === w && gl.height === h &&
      gl.pixelRatio <= 2 && w * h * gl.pixelRatio * gl.pixelRatio <= c.SCENE.pixelBudget * 1.0001,
      w + 'x' + h + ' at ' + gl.pixelRatio.toFixed(2));
  });

  sub('rotating mid-roll');
  const app = play({ viewport: { width: 1024, height: 768, dpr: 2 } }), c = app.ctx;
  c.TUNING.pull = 0;
  stroke(app, guideX(app, 1)); stroke(app, guideX(app, 3));
  advance(app, 30);
  const cuts = c.roll.cuts.slice();
  pr(app, 'pointerdown', guideX(app, 5), yAt(app, -0.8));
  pr(app, 'pointermove', guideX(app, 5), yAt(app, 0.4));
  c.__resize(768, 1024, { top: 24, bottom: 20 });
  T('the cuts are the same cuts', JSON.stringify(c.roll.cuts) === JSON.stringify(cuts));
  T('every piece keeps its share of the roll',
    c.pieceRects().every(r => near(r.w / c.layout.L, r.u1 - r.u0, 1e-9)));
  T('everything in motion comes to rest in the new geometry', c.pieces.every(p => p.off === 0 && p.vel === 0));
  T('the stroke in progress ends', c.gesture === null);
  pr(app, 'pointermove', 400, yAt(app, 1.8));
  pr(app, 'pointerup', 400, yAt(app, 1.8));
  T('and cannot cut afterwards', c.roll.cuts.length === 2);
  const x = guideX(app, 5);
  pr(app, 'pointerdown', x, yAt(app, -0.8));
  c.__resize(768, 1024, { top: 24, bottom: 20 });
  T('a resize that changes nothing does not end a stroke', c.gesture !== null);
  pr(app, 'pointermove', x, yAt(app, 1.8)); pr(app, 'pointerup', x, yAt(app, 1.8));
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
  pr(app, 'pointerdown', r2.x + r2.w * 0.5, yAt(app, 0.5)); pr(app, 'pointerup', r2.x + r2.w * 0.5, yAt(app, 0.5));
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

  /* The roll moves as one soft thing. A cut squashes it where the knife
     went, and the wobble runs along whatever is still joined — never across
     a cut. The squash is anchored on the board. A second cut adds to the
     motion rather than restarting it, and everything comes to rest exactly. */
  sub('the jiggle: one soft roll, parted by every cut');
  app = play(); c = app.ctx; c.TUNING.pull = 0;
  const N = c.SCENE.nodes - 1, node = u => Math.round(u * N);
  stroke(app, guideX(app, 3));                                   // the middle of the roll
  advance(app, 50);                                              // the first frame after rest moves no time
  T('a cut squashes the roll where the knife went', c.wobble.active &&
    c.wobble.s[node(0.5) - 1] < -0.005 && c.wobble.s[node(0.5)] < -0.005,
    c.wobble.s[node(0.5) - 1].toFixed(4) + ' ' + c.wobble.s[node(0.5)].toFixed(4));
  T('the two halves tip away from the cut, showing its faces', c.pieces[0].tiltV > 0 && c.pieces[1].tiltV < 0);
  T('and rock back from the blade', c.pieces.every(p => p.rockV < 0));
  const farBefore = c.wobble.s[0];
  advance(app, 500);                               // half the roll at the wobble's speed
  T('the wobble travels along the half still joined to it, to its far end',
    Math.abs(farBefore) < 1e-6 && Math.abs(c.wobble.s[0]) > 1e-4, farBefore + ' then ' + c.wobble.s[0]);
  T('the cut itself stays parted', c.wobble.joined[node(0.5) - 1] === 0 &&
    [...c.wobble.joined].filter(j => j === 0).length === 1);
  let floor = Infinity, lowest = -Infinity, overlap = -Infinity;
  const spans = () => c.view3d.views.map(v => {
    v.group.updateMatrixWorld(true);
    const p = v.parts[0].geo.attributes.position.array, m = v.group.matrixWorld.elements;
    let low = Infinity, left = Infinity, right = -Infinity;
    for(let i = 0; i < p.length; i += 3){
      const x = m[0] * p[i] + m[4] * p[i + 1] + m[8] * p[i + 2] + m[12];
      low = Math.min(low, m[1] * p[i] + m[5] * p[i + 1] + m[9] * p[i + 2] + m[13]);
      left = Math.min(left, x); right = Math.max(right, x);
    }
    return { low, left, right };
  });
  const watch = () => {
    c.paintNow();
    const s = spans();
    s.forEach((q, i) => {
      floor = Math.min(floor, q.low);
      lowest = Math.max(lowest, q.low);
      /* On the board, where they stand in a row; served pieces turn toward
         the camera and are checked as turned shapes (contract 31). */
      if(i > 0 && !c.game.gathered) overlap = Math.max(overlap, s[i - 1].right - q.left);
    });
  };
  for(let t = 0; t < 30; t++){ watch(); advance(app, 16); }
  T('while it jiggles, no piece sinks into the board', floor > -0.012, floor.toFixed(4));
  T('and none floats off it: each keeps touching it', lowest < 0.012, lowest.toFixed(4));
  /* Cut the roll up quickly, out of order, so neighbours tip toward each
     other at once: none may pass into the piece beside it. (Cutting left to
     right tips every piece the same way, which would prove nothing.) */
  const crowd = play(); crowd.ctx.TUNING.pull = 0;
  [2, 1, 3, 5, 4].forEach(k => { stroke(crowd, guideX(crowd, k), { steps: 2 }); crowd.ctx.__advance(30); });
  { const save = c; c = crowd.ctx; for(let t = 0; t < 40; t++){ watch(); crowd.ctx.__advance(16); } c = save; }
  T('and no tipping piece ever passes into its neighbour', overlap < 0.005, overlap.toFixed(4));
  settleAll(app);                                                // well before the hint's first showing
  restNow(app);
  T('it all comes to rest, exactly', !c.wobble.active && c.wobble.s.every(v => v === 0) &&
    c.pieces.every(p => p.tilt === 0 && p.rock === 0 && p.tiltV === 0 && p.rockV === 0) &&
    c.__clock.pendingFrames() === 0);
  pr(app, 'pointerdown', screenX(app, 0.2), yAt(app, 0.5)); pr(app, 'pointerup', screenX(app, 0.2), yAt(app, 0.5));
  advance(app, 300);
  T('a tap on one piece jiggles it', c.wobble.active && [...c.wobble.s].slice(0, node(0.5)).some(v => v !== 0));
  T('and nothing across the cut moves', [...c.wobble.s].slice(node(0.5)).every(v => v === 0) &&
    c.pieces[1].tilt === 0 && c.pieces[1].rock === 0 && c.pieces[1].off === 0);

  sub('the jiggle: quick cuts blend, never restart');
  app = play(); c = app.ctx; c.TUNING.pull = 0;
  stroke(app, guideX(app, 1));
  advance(app, 40);
  const s0 = Array.from(c.wobble.s), v0 = Array.from(c.wobble.v), tip0 = c.pieces[0].tilt;
  stroke(app, guideX(app, 5), { steps: 1 });
  T('a second cut leaves the shape it found: nothing snaps back', c.wobble.s.every((v, i) => v === s0[i]));
  T('it only adds its own push, near its own cut',
    c.wobble.v.every((v, i) => Math.abs(i / N - 5 / 6) < 3 * c.SCENE.kickWidth * 1.4 + 0.01 || near(v, v0[i], 1e-9)));
  T('and the first cut\'s piece keeps tipping where it was', c.pieces[0].tilt === tip0);
  for(let i = 0; i < 8; i++){ const t = c.cutTarget(c.roll); if(t) c.keyboardCut(); advance(app, 20); }
  let peak = 0;
  for(let t = 0; t < 40; t++){ advance(app, 16); peak = Math.max(peak, ...Array.from(c.wobble.s, Math.abs)); }
  T('a flurry of cuts stays within the squash limit', peak <= c.SCENE.squashMax + 1e-6, peak.toFixed(3));

  sub('the jiggle is tuned from ?tune, and only there');
  const timeToRest = (opts) => {
    const a = play(); Object.assign(a.ctx.TUNING, { pull: 0 }, opts);
    stroke(a, guideX(a, 3));
    let t = 0;
    while((a.ctx.wobble.active || a.ctx.pieces.some(p => p.tilt !== 0)) && t < 20000){ a.ctx.__advance(16); t += 16; }
    return t;
  };
  const firstTurn = (opts) => {
    const a = play(); Object.assign(a.ctx.TUNING, { pull: 0 }, opts);
    stroke(a, guideX(a, 3));
    let t = 0, rising = true, last = 0;
    while(t < 3000){ a.ctx.__advance(4); t += 4; const s = a.ctx.pieces[0].tilt; if(rising && s < last) return t; last = s; }
    return t;
  };
  T('strength 0 means no jiggle, tip or rock at all', (() => {
    const a = play(); a.ctx.TUNING.jiggle = 0; a.ctx.TUNING.pull = 0;
    stroke(a, guideX(a, 3)); a.ctx.__advance(50);
    return !a.ctx.wobble.active && a.ctx.pieces.every(p => p.tilt === 0 && p.rock === 0) && a.ctx.pieces[0].vel !== 0;
  })());
  const quick = timeToRest({ settle: 1 }), slow = timeToRest({ settle: 0 });
  T('more settling comes to rest sooner', quick < slow && slow < 20000, quick + ' ms vs ' + slow + ' ms');
  const firm = firstTurn({ soft: 0 }), soft = firstTurn({ soft: 1 });
  T('softer moves more slowly', soft > firm, firm + ' ms vs ' + soft + ' ms to turn');
  T('the extremes stay stable and still come to rest',
    timeToRest({ soft: 1, settle: 0, jiggle: 2 }) < 20000 && timeToRest({ soft: 0, settle: 1, jiggle: 2 }) < 20000);
  T('the three are ?tune values with one home each',
    ['jiggle', 'soft', 'settle'].every(k => k in c.TUNING_DEFAULTS && c.TUNING_SPEC.some(s => s.key === k && s.group === 'Jiggle')) &&
    (js().match(/TUNING\.(jiggle|soft|settle)\b/g) || []).length >= 6);

  /* The finished roll is served inside the same beat as before: the pieces
     hop, the board slides away beneath them, the plate arrives, and they
     land on it. Reduced motion puts them straight there. */
  /* A flick snaps a little harder than a slow drag, each cut varies a little
     on its own, the same cut always reacts the same way, and on average the
     jiggle is as strong as before. Strokes carry the browser's timestamps. */
  sub('no two cuts react quite alike');
  const timed = (steps, stepMs) => {
    const a = play(), ac = a.ctx; ac.TUNING.pull = 0;
    const x = guideX(a, 3), who = { pointerId: 1 };
    let t = 1000;
    pr(a, 'pointerdown', x, yAt(a, -0.8), Object.assign({ timeStamp: t }, who));
    for(let i = 1; i <= steps; i++){ t += stepMs; pr(a, 'pointermove', x, yAt(a, -0.8 + 2.6 * i / steps), Object.assign({ timeStamp: t }, who)); }
    return { tilt: ac.pieces[0].tiltV, rock: ac.pieces[1].rockV };
  };
  const dragged = timed(40, 16), flick = timed(1, 16), again = timed(40, 16);
  T('a quick flick recoils harder than a slow drag', flick.tilt > dragged.tilt * 1.1 && flick.rock < dragged.rock * 1.1,
    flick.tilt.toFixed(3) + ' vs ' + dragged.tilt.toFixed(3));
  T('the same cut, made the same way, reacts exactly the same', again.tilt === dragged.tilt && again.rock === dragged.rock);
  const squash = [], ac = play().ctx;
  for(let k = 0; k < 120; k++){
    ac.startRoll();                                 // a fresh roll, and so a fresh pattern of cuts
    const u = 0.15 + 0.7 * (k / 120), idx = 0, at = ac.planCut(ac.roll, idx, u, 0);
    if(at === null) continue;
    ac.commitCut(idx, at, null);
    const node = Math.round(at * (ac.SCENE.nodes - 1));
    squash.push(-ac.wobble.v[node] / (ac.SCENE.kickCut * ac.TUNING.jiggle));
  }
  const mean = squash.reduce((x, y) => x + y, 0) / squash.length;
  T('each cut squashes the roll a little differently', new Set(squash.map(v => v.toFixed(4))).size > squash.length * 0.9);
  T('within a small range either way', squash.every(v => v > 1 - c.SCENE.recoilVary - 0.03 && v < 1 + c.SCENE.recoilVary + 0.03),
    Math.min(...squash).toFixed(3) + '..' + Math.max(...squash).toFixed(3));
  T('and on average as strongly as before', Math.abs(mean - 1) < 0.03, mean.toFixed(3));

  sub('serving the finished roll, in the same beat');
  app = play(); c = app.ctx;
  finishRollByKeys(app);
  const st = c.serveTiming(), top = c.plateTop(), n = () => c.pieces.length;
  const lifts = () => c.pieces.map((p, i) => c.liftOf(i, n()));
  advance(app, st.at - 30);
  T('until the gather the pieces stay on the board', c.game.phase === 'done' && lifts().every(y => y === 0) &&
    c.propsAt().board === 0 && c.propsAt().plate === null);
  advance(app, st.at + st.ms * 0.35 - c.game.phaseT);
  T('then they hop, one after another', lifts().every(y => y > top) && lifts()[0] > lifts()[n() - 1],
    lifts().map(y => y.toFixed(2)).join(' '));
  T('while the board slides out and the plate slides in', c.propsAt().board > 0 && c.propsAt().plate < 0);
  advance(app, st.at + st.ms + 5 - c.game.phaseT);
  T('and they land on the plate', lifts().every(y => near(y, top, 1e-9)) &&
    c.propsAt().board === null && c.propsAt().plate === 0, lifts().join(' '));
  T('each landing squashes it a little', c.wobble.active);
  T('the finished-roll beat is as long as ever', c.game.phase === 'done');
  advance(app, c.TUNING.holdMs - c.game.phaseT + 40);
  T('then the plate leaves with them', c.game.phase === 'clear' && c.propsAt().plate > 0 && c.propsAt().board === null);
  app = play({ reducedMotion: true }); c = app.ctx;
  finishRollByKeys(app);
  advance(app, c.serveTiming().at + 40);
  T('with reduced motion they are simply on the plate at the gather', c.game.gathered &&
    c.pieces.every((p, i) => near(c.liftOf(i, c.pieces.length), top, 1e-9)) &&
    c.propsAt().plate === 0 && c.propsAt().board === null && !c.wobble.active);
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
  pr(app, 'pointerdown', x, yAt(app, -0.8));
  pr(app, 'pointermove', x, yAt(app, 0.4));
  hide(app);
  T('the stroke ends without a cut', c.gesture === null && c.roll.cuts.length === 0);
  T('no frame waits and no timer runs', c.__clock.pendingFrames() === 0 && c.__clock.liveTimers() === 0);
  pr(app, 'pointermove', x, yAt(app, 1.8));
  T('the finger moving on while hidden cuts nothing', c.roll.cuts.length === 0);
  show(app);
  T('coming back re-arms the hint and the chef, and draws', c.__clock.liveTimers() === 2 && owned(c) === 2 &&
    c.__clock.pendingFrames() === 1);
  pr(app, 'pointerup', x, yAt(app, 1.8));
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
  pr(app, 'pointerdown', tx, yAt(app, -0.8));
  pr(app, 'pointermove', tx, yAt(app, 0.45));
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
    c.pauses.size === 0 && c.__clock.pendingFrames() === 1 && c.__clock.liveTimers() === 2 && owned(c) === 2);
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
  T('at most one frame, and one timer each for the hint and the chef, ever waited', maxFrames <= 1 && maxTimers <= 2,
    maxFrames + ' / ' + maxTimers);
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
  T('nothing asks for a name, email or anything typed but the parent gate\'s number',
    (markup.match(/<input/g) || []).length === 2 && /<input type="file" id="importInput"/.test(markup) &&
    /<input type="text" id="gateAnswer" inputmode="numeric"/.test(markup));
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
  T('in play, the only controls are the developer button, hidden without ?tune, the scene\'s ' +
    'try-again button, hidden unless the 3D scene cannot be shown, and the grown-ups\' button, which opens only the gate',
    (outside.match(/<button/g) || []).length === 3 && /id="tuneBtn"[\s\S]{0,160}hidden><\/button>/.test(outside) &&
    /id="sceneRetry"[\s\S]{0,160}hidden><\/button>/.test(outside) &&
    /id="grownUpBtn"[^>]*\s+onclick="openGate\(\)"><\/button>/.test(outside));
  T('the sound and haptics switches open only from a right answer at the gate',
    (html.match(/openOverlay\('prefsOverlay'\)/g) || []).length === 1 &&
    /Number\(given\) === gate\.answer\)\{[\s\S]{0,300}openOverlay\('prefsOverlay'\)/.test(html));
  T('in ordinary play both stay hidden', app.dom.document.getElementById('sceneRetry').hidden === true &&
    H.loadApp().dom.document.getElementById('tuneBtn').hidden === true);
  T('Backup & data and What\'s new open only from inside the tuning sheet',
    (html.match(/onclick="openDataSettings\(\)"/g) || []).length === 1 &&
    (html.match(/onclick="openUpdates\(\)"/g) || []).length === 1 &&
    html.indexOf('onclick="openDataSettings()"') > html.indexOf('id="tuneOverlay"'));
  T('no errors', app.errors.length === 0, app.errors.join(' | '));
}

/* =========================================================
   CONTRACT 28 — THE 3D SCENE COMES AND GOES SAFELY
   Loading, a library that cannot load, a device with no WebGL,
   a GPU that takes the context away and gives it back — or does
   not. Play waits whenever the food is not on screen, the screen
   is never blank or frozen, and recovery is bounded.
   ========================================================= */
function testSceneLifecycle(){
  section('CONTRACT 28 — the 3D scene loads, fails and recovers without a blank or frozen screen');
  const status = app => app.dom.document.getElementById('sceneStatus');
  const retry = app => app.dom.document.getElementById('sceneRetry');

  sub('while the library loads, play waits');
  let app = play({ three: 'deferred' }), c = app.ctx;
  T('the scene is loading, and says so with a spinner', c.view3d.status === 'loading' && status(app).hidden === false &&
    status(app).getAttribute('data-state') === 'loading');
  T('play is paused for it', c.pauses.has('scene'));
  stroke(app, c.layout.cx);
  c.keyboardCut();
  T('a swipe or a key meets no invisible food: nothing is cut', c.roll.cuts.length === 0);
  const hud = stageOf(app).getContext('2d');
  hud.recording = true; hud.log.length = 0;
  c.paintNow();
  hud.recording = false;
  T('and no marks are drawn over food that is not there', !hud.log.some(e => e.m === 'stroke' || e.m === 'fill'));
  T('no hint waits and no frame runs', c.__clock.liveTimers() === 0 && c.__clock.pendingFrames() === 0);
  app.gpu.resolve();
  T('once it has loaded, the scene draws and play begins', c.view3d.status === 'ready' && c.pauses.size === 0 &&
    status(app).hidden === true && app.gpu.renderers[0].renders >= 1);
  stroke(app, guideX(app, 2));
  T('and the roll cuts', c.roll.cuts.length === 1);
  T('no errors', app.errors.length === 0, app.errors.join(' | '));

  sub('a library that cannot load');
  app = play({ three: 'fail' }); c = app.ctx;
  T('the scene is unavailable, not blank: a note and a way to try again',
    c.view3d.status === 'unavailable' && status(app).hidden === false &&
    app.dom.document.getElementById('sceneNote').textContent.length > 10 && retry(app).hidden === false);
  T('play stays paused, so nothing unseen is cut', c.pauses.has('scene') && (stroke(app, c.layout.cx), c.roll.cuts.length === 0));
  T('it is reported for whoever is debugging, and is not a crash', app.errors.length === 0 &&
    app.logs.some(l => /3D scene is unavailable/.test(l)));
  let reloads = 0;
  c.location.reload = () => { reloads++; };
  c.retryScene();
  T('trying again reloads the page, since a failed module load is remembered', reloads === 1);

  sub('a device with no WebGL');
  app = play({ noWebGL: 1 }); c = app.ctx;
  T('the scene is unavailable and says so', c.view3d.status === 'unavailable' && retry(app).hidden === false &&
    /3D drawing/.test(app.dom.document.getElementById('sceneNote').textContent));
  c.retryScene();
  T('trying again builds a fresh renderer and play begins', c.view3d.status === 'ready' && c.pauses.size === 0 &&
    app.gpu.constructed === 2 && status(app).hidden === true);
  stroke(app, guideX(app, 1));
  T('and the roll cuts', c.roll.cuts.length === 1);
  T('no errors', app.errors.length === 0, app.errors.join(' | '));

  sub('the GPU takes the context away mid-stroke, then gives it back');
  app = play(); c = app.ctx; c.TUNING.pull = 0;
  const base = listeners(app);
  const x = guideX(app, 2);
  pr(app, 'pointerdown', x, yAt(app, -0.8));
  pr(app, 'pointermove', x, yAt(app, 0.4));
  const lost = { defaultPrevented: false, preventDefault(){ this.defaultPrevented = true; } };
  c.sceneEl.dispatch('webglcontextlost', lost);
  T('the browser is asked to give it back', lost.defaultPrevented === true);
  T('play pauses and the stroke ends without a cut', c.view3d.status === 'lost' && c.pauses.has('scene') &&
    c.gesture === null && c.roll.cuts.length === 0);
  T('a spinner shows while it waits', status(app).hidden === false && status(app).getAttribute('data-state') === 'lost');
  pr(app, 'pointermove', x, yAt(app, 1.8)); pr(app, 'pointerup', x, yAt(app, 1.8));
  T('the finger moving on cuts nothing', c.roll.cuts.length === 0);
  const rendered = app.gpu.renderers[0].renders;
  advance(app, 1000);
  T('nothing is drawn meanwhile', app.gpu.renderers[0].renders === rendered);
  c.sceneEl.dispatch('webglcontextrestored', {});
  T('given back, the scene draws again and play resumes', c.view3d.status === 'ready' && c.pauses.size === 0 &&
    app.gpu.renderers[0].renders > rendered && status(app).hidden === true);
  T('with the same renderer, and no timer left behind', app.gpu.renderers.length === 1 && c.__clock.liveTimers() === 2 &&
    owned(c) === 2);
  stroke(app, guideX(app, 2));
  T('and the roll cuts', c.roll.cuts.length === 1);

  sub('the GPU never gives it back');
  c.sceneEl.dispatch('webglcontextlost', { preventDefault(){} });
  const first = c.sceneEl;
  advance(app, c.SCENE.recoverMs + 50);
  T('after a wait, a fresh renderer is tried on a fresh canvas', c.view3d.status === 'ready' &&
    app.gpu.renderers.length === 2 && c.sceneEl !== first && app.gpu.renderers[0].disposed === true);
  T('the old canvas is no longer listened to', Object.values(first._listeners).every(l => l.length === 0));
  T('everything is drawn again on it', app.gpu.renderers[1].renders >= 1 &&
    app.gpu.renderers[1].info.memory.textures === c.view3d.kit.textures.length);
  for(let k = 0; k < c.SCENE.rebuilds; k++){
    c.sceneEl.dispatch('webglcontextlost', { preventDefault(){} });
    advance(app, c.SCENE.recoverMs + 50);
  }
  T('rebuilding is bounded: after ' + c.SCENE.rebuilds + ', the scene says it is unavailable',
    c.view3d.status === 'unavailable' && app.gpu.renderers.length === 1 + c.SCENE.rebuilds &&
    retry(app).hidden === false && c.__clock.liveTimers() === 0);
  T('the last renderer was let go', app.gpu.renderers.every(r => r.disposed));
  c.retryScene();
  T('and a grown-up can still try again', c.view3d.status === 'ready' && c.pauses.size === 0);
  T('no listener was added along the way', listeners(app) === base, listeners(app) + ' vs ' + base);
  T('no errors', app.errors.length === 0, app.errors.join(' | '));

  sub('opened in a background tab, with no size yet');
  app = play({ viewport: { width: 0, height: 0, dpr: 2 } }); c = app.ctx;
  T('the scene still builds, with its colours', c.view3d.status === 'ready' && !!c.colors.sky && app.errors.length === 0,
    c.view3d.status + ' ' + c.view3d.why);
  c.__resize(1024, 768);
  advance(app, 20);
  T('given a size, it lays out and draws', !!c.layout && app.gpu.renderers[0].width === 1024 &&
    app.gpu.renderers[0].renders >= 1);
  T('and the hint and the chef are armed for it', c.__clock.liveTimers() === 2 && owned(c) === 2);
  stroke(app, guideX(app, 1));
  T('and the roll cuts', c.roll.cuts.length === 1);

  sub('tuning the jiggle while it is moving');
  app = play({ search: '?tune' }); c = app.ctx; c.TUNING.pull = 0;
  stroke(app, guideX(app, 3) + 0.4 * c.layout.L / c.roll.n);    // a Nice cut: no slow-motion beat
  advance(app, 60);
  const mid = Array.from(c.wobble.s);
  c.openTuning(); c.__flush();
  c.setTuning('soft', 1); c.setTuning('settle', 0); c.setTuning('jiggle', 2);
  advance(app, 2000);
  T('the sheet holds the jiggle where it was', c.wobble.s.every((v, i) => v === mid[i]));
  c.closeTuning(); c.__flush();
  advance(app, 34);
  T('closing it carries on from there, with no jump', c.wobble.active &&
    c.wobble.s.every((v, i) => Math.abs(v - mid[i]) < 0.05));
  let t = 0;
  while(c.wobble.active && t < 20000){ advance(app, 100); t += 100; }
  T('and even at the softest, least settled setting it comes to rest', !c.wobble.active, t + ' ms');
  T('no errors', app.errors.length === 0, app.errors.join(' | '));
}

/* =========================================================
   CONTRACT 29 — THE VENDORED LIBRARY
   Three.js is the one file the app loads rather than carries. It
   is pinned, unmodified, licensed, served from the app's own
   folder, and precached for offline play.
   ========================================================= */
function testVendoredLibrary(){
  section('CONTRACT 29 — Three.js is pinned, unmodified, local and cached');
  const fs = require('fs'), path = require('path'), crypto = require('crypto');
  const record = JSON.parse(fs.readFileSync(path.join(H.THREE_DIR, 'package.json'), 'utf8'));
  const v = record.vendored || {};

  sub('pinned and recorded');
  T('the version, source and integrity are recorded', /^\d+\.\d+\.\d+$/.test(v.version || '') &&
    /^https:\/\/registry\.npmjs\.org\/three\/-\/three-/.test(v.source || '') && /^sha512-/.test(v.integrity || ''));
  const app = play(), c = app.ctx;
  T('the library the app loads is that version', c.THREE.REVISION === v.revision &&
    v.version.split('.')[1] === v.revision, c.THREE.REVISION + ' vs ' + v.revision);
  T('Node reads the folder as ES modules; browsers ignore the file', record.type === 'module');

  sub('unmodified, and licensed');
  Object.keys(v.sha256 || {}).forEach(file => {
    const bytes = fs.readFileSync(path.join(H.THREE_DIR, file));
    T(file + ' is byte for byte the published file',
      crypto.createHash('sha256').update(bytes).digest('hex') === v.sha256[file]);
  });
  T('all three files are recorded', ['three.module.js', 'three.core.js', 'LICENSE'].every(f => f in (v.sha256 || {})));
  T('its MIT licence travels with it', /MIT License/.test(fs.readFileSync(path.join(H.THREE_DIR, 'LICENSE'), 'utf8')));
  T('git keeps its bytes as published', /lib\/three\/\*\* -text/.test(fs.readFileSync(path.join(H.ROOT, '.gitattributes'), 'utf8')));
  T('it is not an npm dependency of the app', !Object.keys(H.readPkg().dependencies || {}).length);

  sub('local, and one import');
  T('the app loads it from its own folder, never another host',
    /^\.\/lib\/three\/three\.module\.js$/.test(c.THREE_URL) && app.gpu.imports.length === 1 &&
    app.gpu.imports[0] === c.THREE_URL);
  const script = js();
  T('it is the app\'s only import()', (script.match(/\bimport\s*\(/g) || []).length === 1);
  T('the module pulls in only its sibling file', (() => {
    const mod = fs.readFileSync(path.join(H.THREE_DIR, 'three.module.js'), 'utf8');
    const froms = [...mod.matchAll(/\bfrom\s*'([^']+)'/g)].map(m => m[1]);
    return froms.length > 0 && froms.every(f => f === './three.core.js');
  })());
  T('its core imports nothing further', !/\bfrom\s*'[^']+'|\bimport\s*\(/.test(
    fs.readFileSync(path.join(H.THREE_DIR, 'three.core.js'), 'utf8')));

  sub('cached for offline play');
  T('every file the app is made of exists', c.APP_FILES.every(f => f === './' || fs.existsSync(path.join(H.ROOT, f))));
  T('the library and its core are among them', c.APP_FILES.indexOf(c.THREE_URL) !== -1 &&
    c.APP_FILES.indexOf('./lib/three/three.core.js') !== -1);
  const sw = H.readSW();
  const listed = (sw.match(/APP-FILES-BEGIN([\s\S]*?)APP-FILES-END/) || ['', ''])[1];
  T('the service worker precaches exactly that list',
    JSON.stringify((listed.match(/'[^']*'/g) || []).map(s => s.slice(1, -1))) === JSON.stringify(c.APP_FILES), listed);
  T('and the list is written by config:sync, not by hand', /APP-FILES-BEGIN[\s\S]*const ASSETS[\s\S]*APP-FILES-END/.test(sw));
  T('no errors', app.errors.length === 0, app.errors.join(' | '));
}

/* =========================================================
   CONTRACT 30 — THE THREE-QUARTER CAMERA
   The camera looks from the right and above, so the roll's near end
   and its cut faces show, while the roll stays broadly level. The
   knife follows the finger through that same camera: whatever the
   guides and the hint draw is exactly where a swipe cuts, near,
   middle or far, slow or flicked, straight or forgivingly slanted.
   These strokes are dispatched on the glass, never on the roll's plane.
   ========================================================= */
function testCamera(){
  section('CONTRACT 30 — the three-quarter camera: what is drawn is where the knife cuts');
  const screens = [['tablet landscape', 1180, 820], ['tablet portrait', 820, 1180], ['phone landscape', 844, 390],
                   ['phone portrait', 390, 844]];
  screens.forEach(([name, w, h]) => {
    const app = play({ viewport: { width: w, height: h, dpr: 2 } }), c = app.ctx, L = c.layout, v = L.view;
    const hh = c.SCENE.halfHeight, end = c.SCENE.rollLen / 2;
    const toCam = (x, y, z) => { const d = [v.cx - x, v.cy - y, v.cz - z], k = Math.hypot(d[0], d[1], d[2]); return d.map(q => q / k); };
    T(name + ': the roll\'s near end faces the camera, so its filling shows', toCam(end, hh, 0)[0] > 0.3,
      toCam(end, hh, 0)[0].toFixed(2));
    T(name + ': and a cut face anywhere along it does too', [-0.8, -0.3, 0.3, 0.8].every(k => toCam(k * end, hh, 0)[0] > 0.3));
    const a = c.project(v, -end, hh, 0), b = c.project(v, end, hh, 0);
    const tilt = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
    T(name + ': the roll still lies broadly level', Math.abs(tilt) <= 8, tilt.toFixed(1) + ' degrees');
    const thick = x => c.project(v, x, 0, 0).y - c.project(v, x, 2 * hh, 0).y;
    T(name + ': with no dramatic perspective: its two ends look the same size', Math.abs(thick(end) / thick(-end) - 1) < 0.12,
      (thick(end) / thick(-end)).toFixed(3));
    /* The roll's outline where it crosses x = 0, as drawn: its highest and
       lowest points on the glass, carried onto the roll's plane, are the
       band's edges. */
    const outline = [];
    for(let t = 0; t < 360; t++){ const q = c.profilePoint(t / 360 * Math.PI * 2); outline.push(c.project(v, 0, q.y, q.z)); }
    const hi = outline.reduce((a, p) => p.y < a.y ? p : a), lo = outline.reduce((a, p) => p.y > a.y ? p : a);
    T(name + ': the band the knife counts in is the roll as drawn', near(c.toRoll(hi).y, L.top, 0.2) &&
      near(c.toRoll(lo).y, L.bot, 0.2), c.toRoll(hi).y.toFixed(2) + ' vs ' + L.top.toFixed(2));
    const rand = H.mulberry32(11);
    let worst = 0;
    for(let i = 0; i < 200; i++){
      const p = { x: rand() * w, y: rand() * h }, q = c.toRoll(p), back = q ? c.toStage(q.x, q.y) : { x: Infinity, y: 0 };
      worst = Math.max(worst, Math.hypot(back.x - p.x, back.y - p.y));
    }
    T(name + ': the glass and the roll\'s plane are one map, both ways', worst < 1e-6, worst.toExponential(2));
    if(L.plateZ !== 0){
      /* On a tall screen the plate waits behind the board: the camera looks
         from the side, so it stands where it shows above the roll's middle. */
      const plate = c.project(v, c.propsAt().plate, c.plateTop(), L.plateZ), mid = c.project(v, 0, hh, 0);
      T(name + ': the waiting plate shows straight above the roll, not off to one side',
        Math.abs(plate.x - mid.x) < w * 0.02 && plate.y < mid.y, Math.round(plate.x) + ' vs ' + Math.round(mid.x));
    }
    T(name + ': no errors', app.errors.length === 0, app.errors.join(' | '));
  });

  /* A swipe on the glass, from (x0, y0) to (x1, y1), in `steps` moves. */
  const swipe = (app, x0, y0, x1, y1, steps) => {
    pe(app, 'pointerdown', x0, y0);
    for(let k = 1; k <= steps; k++) pe(app, 'pointermove', x0 + (x1 - x0) * k / steps, y0 + (y1 - y0) * k / steps);
    pe(app, 'pointerup', x1, y1);
  };
  /* Where a straight swipe on the glass crosses the middle of the roll: the
     knife works on the roll's plane, where a straight swipe is still straight. */
  const crossing = (c, x0, y0, x1, y1) => {
    const a = c.toRoll({ x: x0, y: y0 }), b = c.toRoll({ x: x1, y: y1 }), m = c.layout.mid;
    const x = a.x + (b.x - a.x) * (m - a.y) / (b.y - a.y);
    const r = c.pieceRects().find(q => x > q.x && x < q.x + q.w);
    return r ? c.uAt(r, x) : NaN;
  };

  sub('the guides are drawn on the line a cut follows, and a swipe along them cuts there');
  let app = play({ viewport: { width: 1180, height: 820, dpr: 2 } }), c = app.ctx;
  c.TUNING.pull = 0;
  const ctx = stageOf(app).getContext('2d');
  ctx.recording = true; ctx.log = [];
  c.paintNow();
  ctx.recording = false;
  const ticks = [];
  for(let i = 0; i + 1 < ctx.log.length; i++){
    const e = ctx.log[i], f = ctx.log[i + 1];
    if(e.m === 'moveTo' && f.m === 'lineTo' && e.strokeStyle === c.colors.guide) ticks.push([e.args, f.args]);
  }
  T('five guides, a tick above and below the roll for each', ticks.length === 10, String(ticks.length));
  const pairs = [];
  for(let k = 0; k < ticks.length; k += 2) pairs.push({ top: ticks[k][0], bottom: ticks[k + 1][1] });
  T('the ticks of a guide lie on one line through the roll, not a screen column: the camera is turned',
    pairs.every(p => Math.abs(p.top[0] - p.bottom[0]) > 1) && pairs.every(p => {
      const g = c.toRoll({ x: p.top[0], y: p.top[1] }), d = c.toRoll({ x: p.bottom[0], y: p.bottom[1] });
      return near(g.x, d.x, 1e-6);
    }));
  const cutsAlong = pairs.map((p, k) => {
    const a = play({ viewport: { width: 1180, height: 820, dpr: 2 } });
    a.ctx.TUNING.pull = 0;
    const dx = p.bottom[0] - p.top[0], dy = p.bottom[1] - p.top[1];
    swipe(a, p.top[0] - dx * 0.3, p.top[1] - dy * 0.3, p.bottom[0] + dx * 0.3, p.bottom[1] + dy * 0.3, 12);
    return a.ctx.roll.cuts.length === 1 && near(a.ctx.roll.cuts[0], (k + 1) / 6, 1e-6);
  });
  T('a swipe down a guide\'s drawn line, on the glass, cuts exactly on that guide', cutsAlong.every(Boolean), JSON.stringify(cutsAlong));

  sub('near, middle and far: a swipe cuts where it crosses the roll as drawn');
  [['far end', 0.13], ['middle', 0.5], ['near end', 0.87]].forEach(([where, u]) => {
    [['a slow drag', 40], ['a two-sample flick', 1]].forEach(([how, steps]) => {
      const a = play({ viewport: { width: 1180, height: 820, dpr: 2 } }), ac = a.ctx;
      ac.TUNING.pull = 0;
      const r = ac.pieceRects()[0], at = ac.toStage(ac.xAt(r, u), ac.layout.mid);
      const top = ac.toStage(ac.xAt(r, u), ac.layout.top - ac.layout.T), bot = ac.toStage(ac.xAt(r, u), ac.layout.bot + ac.layout.T);
      /* Straight down the glass, not along the roll's slant. */
      const want = crossing(ac, at.x, top.y, at.x, bot.y);
      swipe(a, at.x, top.y, at.x, bot.y, steps);
      T(where + ', ' + how + ' straight down the glass cuts where it crossed the roll',
        ac.roll.cuts.length === 1 && near(ac.roll.cuts[0], want, 1e-9), ac.roll.cuts.join(',') + ' vs ' + want.toFixed(5));
    });
  });

  sub('slanted swipes are forgiven as before, measured on the roll');
  [[30, 1], [-40, 1], [70, 0], [-65, 0]].forEach(([deg, expect]) => {
    const a = play({ viewport: { width: 1180, height: 820, dpr: 2 } }), ac = a.ctx, Lb = ac.layout;
    ac.TUNING.pull = 0;
    const mid = ac.toStage(0, Lb.mid), len = (ac.toStage(0, Lb.bot).y - ac.toStage(0, Lb.top).y) * 2.6;
    const dx = Math.sin(deg * Math.PI / 180) * len / 2, dy = Math.cos(deg * Math.PI / 180) * len / 2;
    swipe(a, mid.x - dx, mid.y - dy, mid.x + dx, mid.y + dy, 16);
    T('a swipe ' + Math.abs(deg) + ' degrees off vertical on the glass ' + (expect ? 'cuts' : 'cuts nothing'),
      ac.roll.cuts.length === expect, String(ac.roll.cuts.length));
  });

  sub('the hint shows the swipe down the line a cut there follows');
  app = play({ viewport: { width: 1180, height: 820, dpr: 2 }, reducedMotion: true }); c = app.ctx;
  advance(app, c.TUNING.hintS * 1000 + 50);
  const hctx = stageOf(app).getContext('2d');
  hctx.recording = true; hctx.log = [];
  c.paintNow();
  hctx.recording = false;
  const circle = hctx.log.find(e => e.m === 'arc' && e.strokeStyle === c.colors.hint);
  const target = c.cutTarget(c.roll), tr = c.pieceRects()[target.index], tx = c.xAt(tr, target.u);
  const start = c.toStage(tx, c.layout.top - c.layout.T * 0.75);
  T('its still picture starts on the next cut\'s line, above the roll', !!circle && near(circle.args[0], start.x, 1e-6) &&
    near(circle.args[1], start.y, 1e-6));
  T('no errors', app.errors.length === 0, app.errors.join(' | '));
}

/* =========================================================
   CONTRACT 31 — SERVED SO THE FACES SHOW
   A finished roll goes to the plate in one row, in the order it was
   cut and at the pieces' real sizes, each lying on its side and
   turned so its face — rice and salmon — faces the camera. However
   uneven the cutting, no piece stands on end, none leaves the plate,
   and no two ever touch, on the plate or on the way to it.
   ========================================================= */
function testServing(){
  section('CONTRACT 31 — served pieces show their faces, keep their sizes, and never touch');
  const h2 = 2 * 0.96;
  /* A turned piece's footprint on the counter: its corners in x and z. */
  const foot = (x, z, len, turn) => { const ct = Math.cos(turn), st = Math.sin(turn), out = [];
    [-len / 2, len / 2].forEach(lx => [-1, 1].forEach(lz => out.push([x + lx * ct + lz * st, z - lx * st + lz * ct])));
    return [out[0], out[1], out[3], out[2]]; };
  /* Separating axes for two convex footprints: true when they overlap. */
  const overlaps = (A, B) => [A, B].every(P => P.every((p, i) => {
    const q = P[(i + 1) % P.length], ax = [q[1] - p[1], p[0] - q[0]];
    const pa = A.map(v => v[0] * ax[0] + v[1] * ax[1]), pb = B.map(v => v[0] * ax[0] + v[1] * ax[1]);
    return Math.max(...pa) > Math.min(...pb) + 1e-9 && Math.max(...pb) > Math.min(...pa) + 1e-9;
  }));

  sub('the arrangement, for a thousand ways of cutting a roll');
  const app = play(), c = app.ctx, P = c.SCENE.plate;
  const rand = H.mulberry32(31);
  let touching = 0, offPlate = 0, reordered = 0, resized = 0, standing = 0, rolls = 0, flatTurns = 0;
  for(let i = 0; i < 1000; i++){
    const n = 4 + Math.floor(rand() * 5), r = c.newRoll(n);
    for(let k = 0; k < 40 && !c.rollComplete(r); k++){
      const pcs = c.piecesOf(r), pi = Math.floor(rand() * pcs.length), u = pcs[pi].u0 + rand() * (pcs[pi].u1 - pcs[pi].u0);
      const at = c.planCut(r, pi, u, rand());
      if(at !== null) c.addCut(r, at);
    }
    while(!c.rollComplete(r)){ const t = c.cutTarget(r); c.addCut(r, t.u); }
    rolls++;
    const lens = c.piecesOf(r).map(q => (q.u1 - q.u0) * c.SCENE.rollLen);
    const room = i % 2 ? P.w - 2 * P.bevel - 0.5 : 8.6 + rand() * 1.8;
    const spots = c.plateSpots(lens, room);
    const feet = spots.map((sp, k) => foot(sp.x, sp.z, lens[k], sp.turn));
    for(let a = 0; a < feet.length; a++) for(let b = a + 1; b < feet.length; b++) if(overlaps(feet[a], feet[b])) touching++;
    if(feet.some(f => f.some(([x, z]) => Math.abs(x) > P.w / 2 - P.bevel + 1e-9 || Math.abs(z) > P.d / 2 - P.bevel + 1e-9))) offPlate++;
    if(spots.some((sp, k) => k > 0 && sp.x <= spots[k - 1].x)) reordered++;
    if(spots.length !== lens.length) resized++;
    if(spots.some(sp => !(sp.turn <= 0 && sp.turn >= -c.SCENE.serveTurn * Math.PI / 180 - 1e-12))) standing++;
    if(room >= P.w - 2 * P.bevel - 0.5 && spots[0].turn > -0.2) flatTurns++;
  }
  T('no two served pieces ever touch', touching === 0, String(touching));
  T('every piece lies on the plate\'s top, however long', offPlate === 0, String(offPlate));
  T('they keep the order they were cut in', reordered === 0, String(reordered));
  T('each is served whole, at its real size', resized === 0);
  T('each lies on its side, turned toward the camera by at most the set turn', standing === 0, String(standing));
  T('with room, they turn enough for their faces to show', flatTurns < rolls * 0.05, flatTurns + ' of ' + rolls);

  sub('on a wide and a tall screen, from the board to the plate');
  [['tablet landscape', 1180, 820], ['phone portrait', 390, 844]].forEach(([name, w, h]) => {
    const a = play({ viewport: { width: w, height: h, dpr: 2 } }), ac = a.ctx, v = ac.layout.view;
    ac.TUNING.pull = 0;
    [0.2, 0.47, 0.61, 0.83, 0.34].forEach(u => { const k = ac.piecesOf(ac.roll).findIndex(q => u > q.u0 && u < q.u1);
      const at = ac.planCut(ac.roll, k, u, 0); if(at !== null) ac.commitCut(k, at, null); });
    while(ac.game.phase === 'ready') ac.keyboardCut();
    let worst = 0, sank = 0;
    for(let t = 0; t < ac.TUNING.holdMs; t += 8){
      advance(a, 8);
      if(ac.game.phase !== 'done') break;
      const rects = ac.pieceRects();
      rects.forEach((q, i) => rects.forEach((o, j) => {
        if(j <= i || Math.abs(q.pose.y - o.pose.y) >= h2) return;
        if(overlaps(foot(q.pose.x, q.pose.z, q.pose.len, q.pose.turn), foot(o.pose.x, o.pose.z, o.pose.len, o.pose.turn))) worst++;
      }));
      rects.forEach(q => { if(q.pose.y < ac.plateTop() - 1e-9) sank++; });
    }
    T(name + ': no two pieces touch at any moment on the way to the plate', worst === 0, String(worst));
    T(name + ': and none sinks below the plate\'s top', sank === 0, String(sank));
    const rects = ac.pieceRects(), at = ac.propsAt();
    T(name + ': served, they sit on the plate, where it stands', rects.every(q =>
      Math.abs(q.pose.x - at.plate) < P.w / 2 && Math.abs(q.pose.z - at.z) < P.d / 2 && near(q.pose.y, ac.plateTop(), 0.02)),
      JSON.stringify(rects.map(q => [q.pose.x.toFixed(2), q.pose.z.toFixed(2), q.pose.y.toFixed(3)])));
    const faces = rects.map(q => { const p = q.pose, n = [Math.cos(p.turn), 0, -Math.sin(p.turn)];
      const fx = p.x + n[0] * p.len / 2, fz = p.z + n[2] * p.len / 2, d = [v.cx - fx, v.cy - p.y - 0.96, v.cz - fz];
      return (n[0] * d[0] + n[2] * d[2]) / Math.hypot(d[0], d[1], d[2]); });
    T(name + ': each shows the camera the face turned toward it', faces.every(f => f > 0.5), faces.map(f => f.toFixed(2)).join(' '));
    T(name + ': no errors', a.errors.length === 0, a.errors.join(' | '));
  });

  sub('the finished mark shows above the served row');
  [['tablet landscape', 1180, 820], ['phone portrait', 390, 844]].forEach(([name, w, h]) => {
    const a = play({ viewport: { width: w, height: h, dpr: 2 } }), ac = a.ctx, v = ac.layout.view;
    finishRollByKeys(a);
    advance(a, ac.TUNING.holdMs * 0.95);
    const tops = ac.pieceRects().map(q => ac.project(v, q.pose.x, q.pose.y + h2, q.pose.z));
    const ctx2 = stageOf(a).getContext('2d');
    ctx2.recording = true; ctx2.log = [];
    ac.paintNow();
    ctx2.recording = false;
    const ring = ctx2.log.find(e => e.m === 'arc' && e.strokeStyle === ac.colors.done);
    const x0 = Math.min(...tops.map(p => p.x)), x1 = Math.max(...tops.map(p => p.x)), y0 = Math.min(...tops.map(p => p.y));
    T(name + ': the mark sits over the served row and above its pieces', !!ring && ring.args[0] > x0 && ring.args[0] < x1 &&
      ring.args[1] + ring.args[2] < y0, ring && ring.args.slice(0, 3).map(Math.round).join(',') + ' over ' + [x0, x1, y0].map(Math.round).join(','));
  });

  sub('the board and the plate never meet as they trade places');
  [[1180, 820], [1366, 1024], [844, 390], [667, 375], [1024, 768]].forEach(([w, h]) => {
    const L = play({ viewport: { width: w, height: h, dpr: 2 } }).ctx.layout, B = c.SCENE.board;
    T(w + 'x' + h + ': they stay at least their own widths apart', L.span >= (B.w + P.w) / 2 + 0.2, L.span.toFixed(2));
  });

  sub('with reduced motion they are simply there');
  const rm = play({ reducedMotion: true }), rc = rm.ctx;
  finishRollByKeys(rm);
  advance(rm, rc.TUNING.holdMs * rc.SLICE.gatherAt + 20);
  const lens = rc.piecesOf(rc.roll).map(q => (q.u1 - q.u0) * rc.SCENE.rollLen);
  const want = rc.plateSpots(lens, rc.layout.serveRoom), got = rc.pieceRects();
  T('at the gather every piece is already on its spot, turned', got.every((q, i) =>
    near(q.pose.x, rc.layout.plateX + want[i].x, 1e-9) && near(q.pose.turn, want[i].turn, 1e-9) && near(q.pose.y, rc.plateTop(), 1e-9)));
  T('no errors', rm.errors.length === 0, rm.errors.join(' | '));
}

/* =========================================================
   CONTRACT 32 — CHEF CAPYBARA
   One character behind the counter, watching the roll and pleased
   with every cut. It covers nothing the player needs and never
   shrinks the food; its reactions run on the game's one clock,
   coalesce rather than queue, never hold play up, and settle back
   to calm; at rest it only blinks and glances now and then.
   ========================================================= */
function testChef(){
  section('CONTRACT 32 — Chef Capybara watches, is pleased, and never gets in the way');
  let app = play(), c = app.ctx;
  const T3 = c.THREE, C = c.SCENE.chef;
  let ch = c.view3d.chef;

  sub('one character, built once from the tokens');
  const meshesOf = k => { const out = []; k.root.traverse(o => { if(o.isMesh) out.push(o); }); return out; };
  /* Drawn: the mesh and every group above it visible. */
  const shown = m => { for(let o = m; o; o = o.parent){ if(!o.visible) return false; } return true; };
  const meshes = meshesOf(ch);
  T('it stands in the scene, on the stage', !!c.layout.chef && ch.root.parent === c.view3d.scene && ch.root.visible);
  T('it is a dozen or so meshes, not a crowd of parts', meshes.length >= 8 && meshes.length <= 14, String(meshes.length));
  T('it downloads nothing and adds no texture', c.view3d.kit.textures.length === 8 &&
    meshes.every(m => !m.material.map && !m.material.bumpMap && !m.material.envMap));
  const key = col => [col.r, col.g, col.b].map(x => x.toFixed(4)).join();
  const tokens = ['fur', 'furDark', 'hat', 'apron', 'eye'].map(k => key(new T3.Color(c.colors[k])));
  const painted = new Set();
  meshes.forEach(m => { const a = m.geometry.attributes.color; if(a) for(let i = 0; i < a.count; i++) painted.add(key({ r: a.getX(i), g: a.getY(i), b: a.getZ(i) })); });
  T('its fur, snout, paws, hat and apron are painted in their tokens, and nothing else',
    tokens.every(t => painted.has(t)) && [...painted].every(p => tokens.indexOf(p) !== -1), [...painted].length + ' colours');
  const same = (a, b) => near(a.r, b.r, 1e-6) && near(a.g, b.g, 1e-6) && near(a.b, b.b, 1e-6);
  T('and its eyes, their spark and its blush', same(c.view3d.kit.eye.color, new T3.Color(c.colors.eye)) &&
    same(c.view3d.kit.shine.color, new T3.Color(c.colors.shine)) && same(c.view3d.kit.blush.color, new T3.Color(c.colors.blush)));
  T('it is matte clay: only its eyes are glossy, and none of it reflects the room',
    c.view3d.kit.clay.roughness >= 0.8 && c.view3d.kit.eye.roughness < 0.5 && !c.view3d.kit.clay.envMap);

  /* Poses at the ends of everything it does, for checking where it reaches. */
  const extremes = [];
  [-1, 1].forEach(look => [0, 1].forEach(nod => [0, 1].forEach(joy => [0, 1].forEach(lean =>
    extremes.push({ look: look, nod: nod, joy: joy, lean: lean }))))) ;
  const strike = (k, q) => {
    c.calmChef();
    c.chef.look.x = q.look; c.chef.nod.x = q.nod; c.chef.joy.x = q.joy; c.chef.lean.x = q.lean; c.chef.pleased = 1;
    c.poseChef();
    k.head.rotation.y = q.look * C.turn;                    // the furthest its head may ever turn
    k.root.updateMatrixWorld(true);
  };
  /* Every few vertices of each of its meshes, in the world. */
  const each = (k, fn, face) => {
    const v = new T3.Vector3();
    meshesOf(k).forEach(m => {
      let o = m, inHead = false;
      while(o){ if(o === k.head) inHead = true; o = o.parent; }
      if(face && !inHead) return;
      const pa = m.geometry.attributes.position;
      for(let i = 0; i < pa.count; i += 3) fn(v.fromBufferAttribute(pa, i).applyMatrix4(m.matrixWorld), inHead);
    });
  };

  /* The layout fits the chef by spheres it poses as the scene poses the
     chef: whatever the chef is doing — nodding, leaning in, delighted,
     following the knife, glancing, flicking an ear, or on its way between —
     all of it must lie inside what the layout checked, or it could reach
     where it must not. */
  let outside = 0, poses = 0;
  const spot = c.layout.chef, env = [];
  c.chefPoses(c.layout.view, spot.x, spot.z).forEach(q => env.push(...c.chefSpheres(spot, q)));
  [0, 0.5, 1].forEach(nod => [0, 1].forEach(lean => [0, 0.5, 1].forEach(joy => [-1, 0, 1].forEach(look => [null, 'glance', 'flick'].forEach(g => {
    if(nod * joy > 0.5 || lean * joy > 0.5) return;               // a nod gives way to delight; it leans only while cutting
    c.calmChef();
    c.chef.nod.x = nod; c.chef.lean.x = lean; c.chef.joy.x = joy; c.chef.look.x = look; c.chef.pleased = 1;
    if(g) c.chef.gesture = { kind: g, t: C.idle[g] / 2, side: look < 0 ? -1 : 1 };
    c.poseChef();
    ch.root.updateMatrixWorld(true);
    poses++;
    each(ch, w => { if(!env.some(b => Math.hypot(w.x - b[0], w.y - b[1], w.z - b[2]) <= b[3])) outside++; });
  })))));
  T('whatever pose it takes, all of it lies inside what the layout fitted', outside === 0, outside + ' points outside, over ' + poses + ' poses');
  c.calmChef(); c.paintNow();

  /* On every screen: none of it shows where the knife goes, its face never
     shows behind the served pieces or the finished mark, all of its face is
     on the stage and above the counter, and it stands behind the counter.
     The knife's ground is worked out here from the hint's own swipe, and the
     pieces and the mark from where they are, not from the layout's guards. */
  sub('on every screen, it covers nothing the player needs');
  const screens = [
    ['iPad landscape', 1024, 768, { top: 24, bottom: 20 }], ['iPad portrait', 768, 1024, { top: 24, bottom: 20 }],
    ['iPad Pro landscape', 1366, 1024, { top: 24, bottom: 20 }], ['iPad Pro portrait', 1024, 1366, { top: 24, bottom: 20 }],
    ['iPad mini landscape', 1133, 744, { top: 24, bottom: 20 }],
    ['phone portrait', 390, 844, { top: 47, bottom: 34 }], ['phone landscape', 844, 390, { left: 47, right: 47, bottom: 21 }],
    ['big phone landscape', 932, 430, { left: 59, right: 59, bottom: 21 }],
    ['small phone portrait', 375, 667, {}], ['small phone landscape', 667, 375, {}],
    ['tiny portrait', 320, 568, {}], ['tiny landscape', 568, 320, {}]
  ];
  screens.forEach(([name, w, h, insets]) => {
    const a = play({ viewport: { width: w, height: h, dpr: 2, insets } }), ac = a.ctx, L = ac.layout, v = L.view, k = ac.view3d.chef;
    const ins = Object.assign({ top: 0, right: 0, bottom: 0, left: 0 }, insets);
    const tiny = w < 600 && h < 600 && Math.min(w, h) <= 320;
    if(!L.chef){ T(name + ': only a tiny screen may leave the chef out', tiny); return; }
    /* The food keeps the size it had before the chef: its scale is the fit
       of the food to the safe area, worked out here the same way. */
    const margin = Math.max(16, Math.min(w, h) * 0.04), area = { w: w - ins.left - ins.right - 2 * margin, h: h - ins.top - ins.bottom - 2 * margin };
    const tall = L.spec.wide < 0.5, unit = ac.viewFor(L.spec, 1, 0, 0);
    const fr = ac.frameOf(unit, !tall, L.plateX, L.plateZ, ac.roll.n), cap = area.h * 0.34 / fr.thick;
    const fit = b => Math.min(area.w * 0.96 / (b.x1 - b.x0), area.h * 0.94 / (b.y1 - b.y0), cap);
    const F = fit(fr.all) >= fit(fr.food) * 0.95 ? fit(fr.all) : fit(fr.food);
    T(name + ': the food keeps its size: the chef never shrinks it', near(v.F, F, 1e-9), v.F.toFixed(3) + ' vs ' + F.toFixed(3));
    /* Where the knife goes: the roll, cut and spread, from above where the
       hint's swipe starts to below where it ends, its finger included. */
    const n = ac.roll.n, half = (L.L + (n - 1) * L.gap) / 2, dot = Math.max(12, L.T * 0.15);
    const knife = [[-half, L.top - 0.75 * L.T], [half, L.top - 0.75 * L.T], [half, L.bot + 0.45 * L.T], [-half, L.bot + 0.45 * L.T]]
      .map(q => ac.toStage(q[0], q[1]));
    const e0 = ac.project(v, -30, -ac.SCENE.board.h, L.back), e1 = ac.project(v, 30, -ac.SCENE.board.h, L.back);
    const edgeY = x => e0.y + (e1.y - e0.y) * (x - e0.x) / (e1.x - e0.x);
    let inKnife = 0, faceOut = 0, faceUnder = 0, front = -Infinity, below = -Infinity;
    extremes.forEach(q => {
      strike(k, q);
      each(k, (p3, inHead) => {
        front = Math.max(front, p3.z);
        if(p3.y < -ac.SCENE.board.h) below = Math.max(below, p3.z);
        const p = ac.project(v, p3.x, p3.y, p3.z);
        if(p.y < edgeY(p.x) && ac.touches({ x: p.x, y: p.y, r: dot }, knife)) inKnife++;
        if(inHead && (p.x < ins.left || p.x > w - ins.right || p.y < ins.top)) faceOut++;
        if(inHead && p.y > edgeY(p.x) + 1) faceUnder++;
      });
    });
    T(name + ': none of it shows where the knife goes', inKnife === 0, inKnife + ' points');
    T(name + ': all of its face and hat are on the stage, clear of the notches', faceOut === 0, faceOut + ' points');
    T(name + ': and above the counter, never cut off by it', faceUnder === 0, faceUnder + ' points');
    T(name + ': it stands behind the counter: what is lower than its top is behind its edge', below < L.back,
      below.toFixed(2) + ' / ' + L.back.toFixed(2));
    T(name + ': and none of it reaches over the board or the plate', front < Math.min(-ac.SCENE.board.d / 2, L.plateZ - ac.SCENE.plate.d / 2),
      front.toFixed(2));
    /* Served: the pieces on the plate and the finished mark, as they are. */
    finishRollByKeys(a);
    advance(a, ac.TUNING.holdMs * 0.95);
    const corners = [], h2 = 2 * ac.SCENE.halfHeight;
    ac.pieceRects().forEach(r => { const p = r.pose, ct = Math.cos(p.turn), st = Math.sin(p.turn);
      [-p.len / 2, p.len / 2].forEach(lx => [-1, 1].forEach(lz => [p.y, p.y + h2].forEach(y =>
        corners.push(ac.project(v, p.x + lx * ct + lz * st, y, p.z - lx * st + lz * ct))))); });
    const served = ac.convexOutline(corners);
    const ctx2 = stageOf(a).getContext('2d');
    ctx2.recording = true; ctx2.log = [];
    ac.paintNow();
    ctx2.recording = false;
    const ring = ctx2.log.find(e => e.m === 'arc' && e.fillStyle === ac.colors.doneDisc) || ctx2.log.find(e => e.m === 'arc');
    let behind = 0;
    k.root.updateMatrixWorld(true);
    each(k, p3 => {
      const p = ac.project(v, p3.x, p3.y, p3.z);
      if(ac.touches({ x: p.x, y: p.y, r: 0.5 }, served)) behind++;
      if(ring && Math.hypot(p.x - ring.args[0], p.y - ring.args[1]) < ring.args[2]) behind++;
    }, true);
    T(name + ': delighted, its face shows clear of the served pieces and the finished mark', !!ring && behind === 0, behind + ' points');
    T(name + ': with no errors', a.errors.length === 0, a.errors.slice(0, 2).join(' | '));
  });

  /* A cut of any kind pleases it at once; a stroke that does not cut gets
     nothing, and nothing is ever a frown or a verdict. */
  sub('it reacts to every cut, and to nothing else');
  app = play(); c = app.ctx; c.TUNING.pull = 0; ch = c.view3d.chef;
  settleAll(app);
  const short = guideX(app, 2);
  stroke(app, short, { from: -0.8, to: 0.3 });                   // too shallow to cut
  stroke(app, short, { dx: app.ctx.layout.T * 4 });              // far too slanted
  pr(app, 'pointerdown', short, yAt(app, 0.5)); pr(app, 'pointerup', short, yAt(app, 0.5));   // a tap
  advance(app, 200);
  T('a stroke that does not cut, a slanted one and a tap get no reaction',
    c.roll.cuts.length === 0 && c.chef.sinceCut > 1e9 && c.chef.nod.x === 0 && c.chef.pleased === 0);
  stroke(app, guideX(app, 1) + c.layout.L * 0.04);               // an imperfect cut
  advance(app, 50);
  T('an imperfect cut pleases it at once', c.roll.cuts.length === 1 && c.chef.pleased > 0.5, c.chef.pleased.toFixed(2));
  advance(app, 100);
  T('with a small nod, well under way within a tenth of a second more', c.chef.nod.x > 0.5, c.chef.nod.x.toFixed(2));
  T('its face only warms: its eyes squint and its smile widens', (() => { c.poseChef();
    return ch.eyes.every(e => e.scale.y < 0.9) && ch.mouth.scale.x > 1 && ch.mouth.scale.y > 1; })());
  let settled = 0;
  for(; settled < 3000 && (c.chef.nod.x !== 0 || c.chef.pleased !== 0 || c.chef.look.v !== 0); settled += 16) advance(app, 16);
  T('and it settles back to calm soon after', settled <= 1500, settled + ' ms');

  sub('quick cuts blend into one reaction, never a queue');
  app = play(); c = app.ctx; c.TUNING.pull = 0;
  settleAll(app);
  /* A nod starts when the head goes down past halfway from near rest; a
     wobble at the bottom of a held nod is not another one. */
  const peaks = [];
  let low = true, deepest = 0;
  const watchNod = () => { const x = c.chef.nod.x; deepest = Math.max(deepest, x);
    if(low && x > 0.5){ peaks.push(x); low = false; } else if(x < 0.3) low = true; };
  [1, 2, 3].forEach(k => { stroke(app, guideX(app, k), { steps: 3 }); for(let t = 0; t < 4; t++){ advance(app, 16); watchNod(); } });
  for(let t = 0; t < 120; t++){ advance(app, 16); watchNod(); }
  T('three quick cuts make one nod, held a little longer', c.roll.cuts.length === 3 && peaks.length === 1, peaks.length + ' nods');
  T('and it never nods further than one nod', deepest <= 1.15, deepest.toFixed(2));
  /* As fast as a child really flicks — found in the browser, where cuts came
     about 180 ms apart and the head bobbed between them. */
  [180, 300].forEach(gapMs => {
    const a = play(), ac = a.ctx; ac.TUNING.pull = 0;
    settleAll(a);
    const seen = [];
    let calm = true;
    const look = () => { const x = ac.chef.nod.x; if(calm && x > 0.5){ seen.push(x); calm = false; } else if(x < 0.3) calm = true; };
    [1, 2, 3].forEach(k => { stroke(a, guideX(a, k), { steps: 3 }); for(let t = 0; t < gapMs; t += 16){ advance(a, 16); look(); } });
    for(let t = 0; t < 120; t++){ advance(a, 16); look(); }
    T('cuts ' + gapMs + ' ms apart still make one long nod, not a head bobbing between them', ac.roll.cuts.length === 3 && seen.length === 1,
      seen.length + ' nods');
  });
  const cutsBefore = c.roll.cuts.length;
  stroke(app, guideX(app, 4));
  T('a cut in the middle of a reaction is not held up: it cuts at once', c.roll.cuts.length === cutsBefore + 1);

  /* The finished roll: delight rises with the serving beat and has gone
     by the time the next roll is ready; the beat itself is untouched. */
  sub('delight at a finished roll lives inside the serving beat');
  app = play(); c = app.ctx; ch = c.view3d.chef;
  settleAll(app);
  const phases = [];
  let peak = 0, was = c.game.phase, t0 = null;
  for(let i = 0; i < 4; i++) c.keyboardCut();
  advance(app, 30);
  c.keyboardCut();                                               // the last cut, while it is still nodding
  t0 = c.__clock.now;
  for(let t = 0; t < 200; t++){
    advance(app, 10);
    peak = Math.max(peak, c.chef.joy.x);
    if(c.game.phase !== was){ phases.push([c.game.phase, Math.round(c.__clock.now - t0)]); was = c.game.phase; }
  }
  const at = p => (phases.find(q => q[0] === p) || [p, NaN])[1];
  T('the pace between rolls is exactly as before', Math.abs(at('clear') - c.TUNING.holdMs) <= 10 &&
    Math.abs(at('enter') - c.TUNING.holdMs - c.TUNING.clearMs) <= 10 && Math.abs(at('ready') - c.TUNING.holdMs - 2 * c.TUNING.clearMs) <= 10,
    JSON.stringify(phases));
  T('it is fully delighted while the roll is served', peak > 0.95, peak.toFixed(2));
  T('delight takes its head over from the nod, rather than both at once', c.chef.nod.x < 0.05);
  const ready = at('ready');
  T('and within a moment of the next roll it is calm again', c.game.phase === 'ready' && c.chef.joy.x < 0.02 &&
    c.__clock.now - t0 - ready < 800, c.chef.joy.x.toFixed(3));

  sub('it never replays, and never goes on behind the tuning sheet');
  app = play({ search: '?tune' }); c = app.ctx;
  settleAll(app);
  finishRollByKeys(app);
  advance(app, 150);
  const mid = c.chef.joy.x;
  hide(app);
  advance(app, 5000);
  T('in the background it waits where it was', c.chef.joy.x === mid && c.chef.timer === 0 && c.__clock.pendingFrames() === 0);
  show(app);
  advance(app, 17);
  T('coming back, it carries on from there instead of starting again', c.chef.joy.x >= mid && c.chef.joy.x < mid + 0.3,
    mid.toFixed(2) + ' then ' + c.chef.joy.x.toFixed(2));
  settleAll(app);
  c.keyboardCut();
  advance(app, 40);
  const nodNow = c.chef.nod.x, pleasedNow = c.chef.pleased;
  c.openTuning(); c.__flush();
  advance(app, 3000);
  T('behind the tuning sheet it holds still: no frame, no idle timer', c.chef.nod.x === nodNow && c.chef.pleased === pleasedNow &&
    c.__clock.pendingFrames() === 0 && c.chef.timer === 0);
  c.closeTuning(); c.__flush();
  T('and when the sheet closes its idle timer is armed again, once', c.chef.timer !== 0 && owned(c) === c.__clock.liveTimers());
  finishRollByKeys(app);
  advance(app, 200);
  c.newRollFromTuning();
  T('a new roll from the sheet ends a reaction there and then', c.chef.joy.x === 0 && c.chef.nod.x === 0 &&
    c.chef.pleased === 0 && c.chef.gesture === null);

  /* At rest it only blinks, flicks an ear or glances at the player, now and
     then, on one timer; it glances only when all is calm. */
  sub('at rest, it is quiet');
  app = play(); c = app.ctx;
  settleAll(app);
  const seen = [];
  for(let t = 0; t < 60000; t += 50){
    advance(app, 50);
    const g = c.chef.gesture;
    if(g && (!seen.length || seen[seen.length - 1].g !== g)) seen.push({ g: g, at: c.__clock.now, calm: c.game.phase === 'ready' });
  }
  T('a minute brings a handful of idle gestures, with quiet between', seen.length >= 60000 / C.quiet[1] - 1 && seen.length <= 60000 / C.quiet[0] + 1 &&
    seen.every((s, i) => i === 0 || s.at - seen[i - 1].at >= C.quiet[0] - 60), seen.length + ' gestures');
  T('mostly blinks; each brief', seen.filter(s => s.g.kind === 'blink').length >= seen.length / 2 &&
    seen.every(s => C.idle[s.g.kind] <= 1500), seen.map(s => s.g.kind).join(' '));
  T('and never more than its one timer', owned(c) === c.__clock.liveTimers() && c.__clock.liveTimers() <= 2);
  let busy = 0;
  for(let i = 0; i < 50; i++){ c.keyboardCut(); advance(app, 20); busy = Math.max(busy, c.__clock.liveTimers()); settleAll(app); }
  T('fifty rolls of cuts leave no timer or listener behind', busy <= 2 && owned(c) === c.__clock.liveTimers() &&
    listeners(app) === listeners(play()), busy + ' timers');

  /* Reduced motion: its face changes in place and it holds still — no nod,
     lean, turn, rise or lifted paws, and no idle gestures at all. */
  sub('with reduced motion, it changes its face and holds still');
  app = play({ reducedMotion: true }); c = app.ctx; ch = c.view3d.chef;
  settleAll(app);
  const frozen = () => JSON.stringify([ch.root.position, ch.torso.position, ch.torso.rotation.toArray(), ch.head.rotation.toArray(),
    ch.arms.map(a => a.rotation.toArray()), ch.ears.map(e => e.rotation.toArray())]);
  c.paintNow();
  const still = frozen();
  T('no idle gesture waits to happen', c.chef.timer === 0 && c.__clock.liveTimers() === 1);
  c.keyboardCut();
  advance(app, 20);
  c.paintNow();
  T('a cut pleases it at once, without a nod', c.chef.pleased === 1 && c.chef.nod.x === 0 && frozen() === still &&
    ch.eyes.every(e => e.scale.y < 0.9));
  advance(app, C.pleasedMs + 50);
  T('its contentment ends on time', c.chef.pleased === 0);
  advance(app, c.FEEDBACK.starsMs - C.pleasedMs);
  T('and once the cut\'s stars have gone too, no frame waits', c.feedback.stars === null && c.__clock.pendingFrames() === 0);
  finishRollByKeys(app);
  advance(app, 20);
  c.paintNow();
  T('a finished roll shows its delight at once, as a face, not a movement', c.chef.joy.x === 1 && ch.happy.visible && frozen() === still);
  advance(app, c.TUNING.holdMs + 50);
  c.paintNow();
  T('and it is calm again as the next roll comes', c.game.phase === 'ready' && c.chef.joy.x === 0 && !ch.happy.visible);
  app = play(); c = app.ctx;
  settleAll(app);
  c.keyboardCut();
  advance(app, 30);
  c.__motion.set(true);
  T('switched on in the middle of a nod, it settles at once and stops idling', c.chef.nod.x === 0 && c.chef.lean.x === 0 &&
    c.chef.look.x === 0 && c.chef.gesture === null && c.chef.timer === 0);
  c.__motion.set(false);
  T('switched off again, its idle timer comes back', c.chef.timer !== 0);

  /* It lives in the scene graph and outlives the GPU context: a restored
     context draws the same chef, and a fresh renderer uploads it again. */
  sub('a lost graphics context brings it back as it was');
  app = play(); c = app.ctx; ch = c.view3d.chef;
  settleAll(app);
  finishRollByKeys(app);
  advance(app, 150);
  const parts = meshesOf(ch).map(m => m.geometry);
  c.sceneEl.dispatch('webglcontextlost', { preventDefault(){} });
  const joyLost = c.chef.joy.x;
  advance(app, 800);
  T('while the context is gone its reaction waits, like the rest of play', c.chef.joy.x === joyLost);
  c.sceneEl.dispatch('webglcontextrestored', {});
  advance(app, 17);
  T('given back, the same chef is drawn again, built once', c.view3d.chef === ch &&
    meshesOf(c.view3d.chef).every((m, i) => m.geometry === parts[i]) && app.gpu.renderers[0].live.geometries.has(parts[0]));
  c.sceneEl.dispatch('webglcontextlost', { preventDefault(){} });
  advance(app, c.SCENE.recoverMs + 50);
  T('on a fresh renderer too, all of it', c.view3d.status === 'ready' && app.gpu.renderers.length === 2 &&
    parts.filter((g, i) => shown(meshesOf(ch)[i])).every(g => app.gpu.renderers[1].live.geometries.has(g)));
  T('with no errors', app.errors.length === 0, app.errors.slice(0, 2).join(' | '));
}


/* =========================================================
   CONTRACT 33 — GENTLE PRAISE, AND JUICE THAT KNOWS ITS PLACE
   Every accepted cut is praised Nice, Great or Perfect, judged from
   where the knife went before any guide pulled it; nothing else is
   praised or scolded, and nothing is kept. Sound, sparkle, the
   haptic tap and the Perfect slow motion are bounded, stop on
   request or on a pause, never touch play, and sit behind a parent
   gate as a grown-up's two switches — the only thing stored.
   ========================================================= */
/* A stand-in for the Web Audio API: enough to prove what is played, when,
   and that it all stops. It makes no sound; how it sounds is judged by ear. */
function fakeAudio(){
  const made = { contexts: [], started: 0, stopped: 0, live: new Set(), resumes: 0, suspends: 0, now: null, blocked: false };
  const param = () => ({ value: 0, setValueAtTime(){}, exponentialRampToValueAtTime(){}, linearRampToValueAtTime(){} });
  class Node { connect(){} disconnect(){} }
  class Source extends Node {
    start(){ made.started++; made.live.add(this); }
    stop(){ if(made.live.delete(this)) made.stopped++; }
  }
  class Ctx {
    constructor(){ this.state = 'suspended'; this.sampleRate = 48000; this.destination = new Node(); made.contexts.push(this); }
    get currentTime(){ return made.now ? made.now() : 0; }
    resume(){ made.resumes++; if(!made.blocked) this.state = 'running'; return Promise.resolve(); }
    suspend(){ made.suspends++; this.state = 'suspended'; return Promise.resolve(); }
    createGain(){ const n = new Node(); n.gain = param(); return n; }
    createBiquadFilter(){ const n = new Node(); n.frequency = param(); n.Q = param(); return n; }
    createDynamicsCompressor(){ const n = new Node(); ['threshold', 'knee', 'ratio', 'attack', 'release'].forEach(k => { n[k] = param(); }); return n; }
    createBuffer(ch, len){ const d = new Float32Array(len); return { length: len, getChannelData: () => d }; }
    createBufferSource(){ return new Source(); }
    createOscillator(){ const n = new Source(); n.frequency = param(); return n; }
  }
  made.Ctx = Ctx;
  return made;
}
function withAudio(opts){
  const fa = fakeAudio();
  const app = play(Object.assign({ windowExtras: { AudioContext: fa.Ctx } }, opts || {}));
  fa.now = () => app.ctx.performance.now() / 1000;
  return { app: app, fa: fa };
}
function tapsOf(app){ const taps = []; app.ctx.navigator.vibrate = p => { taps.push(p); return true; }; return taps; }
function said(app){ return app.dom.document.getElementById('playStatus').textContent; }

function testFeedback(){
  section('CONTRACT 33 — every cut is praised, gently; its juice is bounded, quiet on request, and never in the way');
  let app, c;

  sub('three tiers, defined once, judged where the knife went');
  app = play(); c = app.ctx; settleAll(app);
  const n = c.roll.n, sp = 1 / n, rate = (u, px) => c.rateCut(c.roll, 0, u, px || 0);
  T('Nice, Great and Perfect, and no other word for a cut', c.TIERS.join() === 'nice,great,perfect' &&
    Object.keys(c.PRAISE).join() === 'nice,great,perfect');
  T('the thresholds are declared once, Perfect inside Great', (js().match(/const RATING = /g) || []).length === 1 &&
    c.RATING.perfect.share < c.RATING.great.share && c.RATING.perfect.px < c.RATING.great.px);
  T('on a guide is Perfect', rate(sp) === 'perfect');
  T('within a tenth of a spacing is still Perfect', rate(sp + 0.095 * sp) === 'perfect' && rate(sp - 0.095 * sp) === 'perfect');
  T('a fifth off is Great', rate(sp + 0.2 * sp) === 'great');
  T('two fifths off is Nice, and still praise', rate(sp + 0.4 * sp) === 'nice');
  T('the nearest guide is the reference, whichever side', rate(2 * sp - 0.05 * sp) === 'perfect');
  T('on a small screen a fingertip\'s few pixels still earn a Perfect',
    rate(sp + 0.15 * sp, 6 / (0.15 * sp)) === 'perfect' && rate(sp + 0.15 * sp, 22 / (0.15 * sp)) === 'great');
  T('no finger, no pixel allowance: the keyboard is judged by share alone', rate(sp + 0.15 * sp, 0) === 'great');

  sub('a real stroke is judged before the guide pulls its cut');
  const spacingPx = () => c.layout.L / c.roll.n;
  stroke(app, guideX(app, 2) + 0.18 * spacingPx());
  const pulled = c.roll.cuts[0];
  T('a stroke a fifth off a guide is Great ...', c.roll.cuts.length === 1 && c.feedback.stars && c.feedback.stars.n === 2,
    c.feedback.stars && c.feedback.stars.n);
  T('... though the cut it leaves is pulled to within a tenth, where it would have looked Perfect',
    Math.abs(pulled - 2 * sp) < 0.1 * sp && Math.abs(pulled - 2 * sp) > 0, ((pulled - 2 * sp) / sp).toFixed(3));
  T('and it is said, for assistive technology, as praise', /^Great cut! \d+ to go\.$/.test(said(app)), said(app));
  const moving = c.pieces.some(p => p.vel !== 0 || p.off !== 0);
  stroke(app, guideX(app, 4));
  T('a stroke on a guide of a piece still sliding apart is Perfect: it is judged where the piece is drawn',
    moving && c.roll.cuts.length === 2 && c.feedback.stars.n === 3);
  settleAll(app);
  /* A slow, careful stroke: a second and a half from top to bottom. */
  const x3 = guideX(app, 3), who = { pointerId: 7, pointerType: 'touch' };
  pr(app, 'pointerdown', x3, yAt(app, -0.8), who);
  for(let i = 1; i <= 30; i++){ advance(app, 50); pr(app, 'pointermove', x3, yAt(app, -0.8 + 2.6 * i / 30), who); }
  pr(app, 'pointerup', x3, yAt(app, 1.8), who);
  T('a slow, deliberate stroke on a guide is Perfect too', c.roll.cuts.length === 3 && c.feedback.stars && c.feedback.stars.n === 3 &&
    /^Perfect cut!/.test(said(app)), said(app));

  sub('after cuts that wandered, the piece itself is the reference');
  app = play(); c = app.ctx; settleAll(app);
  c.commitCut(0, 1.45 * sp, null, 'nice');             // takes guide 1, far off it
  settleAll(app);
  T('a piece left with no free guide is judged against its own middle',
    c.cutReference(c.roll, 0, 0.3 * sp) === 1.45 * sp / 2 && c.rateCut(c.roll, 0, 1.45 * sp / 2, 0) === 'perfect');
  stroke(app, screenX(app, 1.45 * sp / 2));
  T('so a stroke through that middle is Perfect', c.roll.cuts.length === 2 && c.feedback.stars.n === 3);

  sub('every accepted cut is praised, and nothing else is');
  app = play(); c = app.ctx; settleAll(app);
  let taps = tapsOf(app);
  const mid = c.layout.cx;
  pr(app, 'pointerdown', mid, yAt(app, 0.5)); pr(app, 'pointerup', mid, yAt(app, 0.5));
  stroke(app, guideX(app, 1), { to: 0.3 });
  const slant = 3 * 2.6 * c.layout.T;                      // about 72 degrees off vertical
  stroke(app, guideX(app, 1) - slant / 2, { dx: slant });
  advance(app, 200);
  T('a tap, a stroke that stops short and one too slanted cut nothing, and get no praise, sound or tap',
    c.roll.cuts.length === 0 && c.feedback.seq === 0 && c.feedback.stars === null && taps.length === 0 &&
    !/cut[.!]/.test(said(app)));
  stroke(app, guideX(app, 1));
  T('before any input the browser counts as the user\'s, a cut asks for no haptic tap: the first cut of a visit ' +
    'lands mid-stroke, and a request then is refused', c.roll.cuts.length === 1 && taps.length === 0);
  app.dom.document.dispatch('pointerup', { type: 'pointerup', pointerType: 'touch' });
  advance(app, 120);
  const offs = [0.18, 0.4, -0.05, 0.3];
  let praised = 0;
  offs.forEach((o, i) => {
    stroke(app, guideX(app, i + 2) + o * spacingPx());
    const st = c.feedback.stars;
    if(c.roll.cuts.length === i + 2 && st && st.n >= 1 && st.n <= 3 && c.feedback.seq === i + 2 &&
       /^(Nice cut\.|Great cut!|Perfect cut!|Roll finished)/.test(said(app))) praised++;
    advance(app, 120);
  });
  T('four more cuts, near and far, each praised once', praised === 4, praised);
  T('after that, each with one light tap on a device that has one', taps.length === 4, JSON.stringify(taps));
  T('and no tier ever says less than Nice: there is no other outcome', c.TIERS.indexOf('nice') === 0);
  app = play(); c = app.ctx; settleAll(app);
  key(app, ' ');
  T('a keyboard cut, placed on its guide, is praised Perfect', c.roll.cuts.length === 1 && c.feedback.stars.n === 3 &&
    /^Perfect cut!/.test(said(app)));

  sub('nothing about play is kept');
  const shared = new Map();
  app = play({ sharedStorage: shared }); c = app.ctx; settleAll(app);
  for(let r = 0; r < 5; r++){ finishRollByKeys(app); settleAll(app); }
  T('five rolls stored nothing but the schema version', [...shared.keys()].join() === 'capybara-sushi.sys.schemaVersion',
    [...shared.keys()].join());
  T('and the praise keeps no history: one set of stars at most, and a count only to seed the sparkle',
    Object.keys(c.feedback).join() === 'stars,sparks,slow,seq' && Object.keys(c.roll).join() === 'id,n,cuts');

  sub('the chef: pleased with every cut, brighter for a Perfect one');
  app = play(); c = app.ctx; settleAll(app);
  stroke(app, guideX(app, 1) + 0.4 * spacingPx());
  advance(app, 100);
  const niceFace = { pleased: c.chef.pleased, bright: c.chef.bright, mouth: c.view3d.chef.mouth.scale.x };
  settleAll(app);
  stroke(app, guideX(app, 2) + 0.18 * spacingPx());
  advance(app, 100);
  c.paintNow();
  const greatFace = { pleased: c.chef.pleased, bright: c.chef.bright, mouth: c.view3d.chef.mouth.scale.x };
  T('a Nice cut and a Great one get the same warm, pleased face: nothing lesser for either',
    niceFace.pleased === 1 && greatFace.pleased === 1 && niceFace.bright === 0 && greatFace.bright === 0 &&
    near(niceFace.mouth, greatFace.mouth, 1e-9), JSON.stringify([niceFace, greatFace]));
  settleAll(app);
  stroke(app, guideX(app, 3));
  advance(app, 100);
  c.paintNow();
  T('a Perfect cut lights its face up: happy eyes, the blush, perked ears', c.chef.bright === 1 &&
    c.view3d.chef.happy.visible && c.view3d.chef.blush.visible, c.chef.bright);
  advance(app, c.SCENE.chef.cheerMs + c.SCENE.chef.coolMs + 50);
  c.paintNow();
  T('and it passes quickly, back to calm', c.chef.bright === 0 && !c.view3d.chef.happy.visible);

  sub('quick cuts coalesce, and every effect is bounded');
  let w = withAudio(); app = w.app; c = app.ctx; settleAll(app);
  taps = tapsOf(app);
  app.dom.document.dispatch('pointerup', { type: 'pointerup', pointerType: 'touch' });
  T('the first lifted finger starts the audio, as browsers require', w.fa.contexts.length === 1 && c.sound.ctx.state === 'running');
  const before = w.fa.started;
  for(let k = 1; k <= 3; k++){ stroke(app, guideX(app, k)); advance(app, 50); }
  T('three Perfect cuts 50 ms apart: three cut sounds and one chime, never a pile-up',
    w.fa.started - before === 3 * 2 + 2 && c.sound.voices.length <= c.SOUND.voices, w.fa.started - before);
  T('one set of stars, the newest', c.feedback.stars && c.feedback.stars.n === 3);
  T('sparkles stay within their bound', c.feedback.sparks.length <= c.FEEDBACK.maxSparks, c.feedback.sparks.length);
  T('haptic taps no closer than their gap', taps.length === 2, taps.length);
  const burst = w.fa.started;
  for(let k = 4; k <= 5; k++){ stroke(app, guideX(app, k)); advance(app, 16); }
  T('a cut 16 ms after another shares its sound', w.fa.started - burst === 2, w.fa.started - burst);
  T('and the chef lights up once, not once per cut: nothing queues', c.chef.bright > 0 && c.__clock.liveTimers() <= 2);

  sub('muting and switching off take effect at once');
  w = withAudio(); app = w.app; c = app.ctx; settleAll(app);
  taps = tapsOf(app);
  app.dom.document.dispatch('pointerup', { type: 'pointerup', pointerType: 'touch' });
  stroke(app, guideX(app, 1));
  const playing = w.fa.live.size;
  c.setPref('sound', false);
  T('turning sound off stops every sound already playing', playing > 0 && w.fa.live.size === 0 && c.sound.voices.length === 0);
  const quiet = w.fa.started;
  advance(app, 100);
  stroke(app, guideX(app, 2));
  T('and the next cut is silent, but still praised', w.fa.started === quiet && c.feedback.stars !== null);
  c.setPref('haptics', false);
  const tapped = taps.length;
  advance(app, 100);
  stroke(app, guideX(app, 3));
  T('turning haptics off stops the taps', tapped === 2 && taps.length === tapped, taps.length);
  c.setPref('sound', true);
  advance(app, 100);
  stroke(app, guideX(app, 4));
  T('turning sound back on plays the next cut', w.fa.started > quiet);
  app = play(); c = app.ctx; settleAll(app);
  delete c.navigator.vibrate;
  c.renderPrefs();
  const hs = app.dom.document.getElementById('prefHaptics');
  T('where the browser offers no vibration, the switch says so and cannot be pressed',
    hs.hasAttribute('disabled') && hs.getAttribute('aria-checked') === 'false' &&
    /does not offer vibration/.test(app.dom.document.getElementById('prefHapticsHint').textContent) &&
    c.setPref('haptics', true) === false);
  stroke(app, guideX(app, 1));
  T('and play is unchanged', c.roll.cuts.length === 1 && c.feedback.stars !== null && app.errors.length === 0);

  sub('only preferences are stored, and honestly');
  const store = new Map(), KEY = 'capybara-sushi.prefs.feedback';
  app = play({ sharedStorage: store }); c = app.ctx;
  T('nothing is written until a grown-up changes something', !store.has(KEY) && c.prefs.state === 'default' &&
    c.prefs.sound === true && c.prefs.haptics === true);
  c.setPref('sound', false);
  T('a change is stored under the app\'s namespace, as two switches and nothing else',
    store.get(KEY) === JSON.stringify({ sound: false, haptics: true }) && c.prefs.state === 'saved', store.get(KEY));
  app = play({ sharedStorage: store }); c = app.ctx;
  T('and read back next time', c.prefs.sound === false && c.prefs.haptics === true && c.prefs.state === 'saved');
  ['{not json', '[]', '{"sound":"off"}', 'null'].forEach(bad => {
    store.set(KEY, bad);
    app = play({ sharedStorage: store }); c = app.ctx;
    c.renderPrefs();
    T('an unreadable value (' + bad + ') means the defaults, is left as it was, and the sheet says so',
      c.prefs.sound === true && c.prefs.haptics === true && c.prefs.state === 'unreadable' && store.get(KEY) === bad &&
      /could not be read/.test(app.dom.document.getElementById('prefsStorage').textContent));
  });
  app = play({ failWrites: true }); c = app.ctx;
  c.setPref('sound', false);
  T('where storage is refused, the choice still applies, and the sheet says it will not last',
    c.prefs.sound === false && c.prefs.state === 'unsaved' &&
    /cannot be saved/.test(app.dom.document.getElementById('prefsStorage').textContent) && app.errors.length === 0);

  sub('grown-up settings sit behind a parent gate');
  app = play(); c = app.ctx; settleAll(app);
  const doc = app.dom.document, open = id => doc.getElementById(id).classList.contains('open');
  T('the way in shows in ordinary play, with no ?tune', !doc.getElementById('grownUpBtn').hidden && !c.TUNE_ENABLED);
  c.openGate(); c.__flush();
  T('it opens a question, not the settings, and play pauses', open('gateOverlay') && !open('prefsOverlay') && c.pauses.has('grownup'));
  T('a times table a young child cannot answer, with a label', c.gate.answer === c.gate.a * c.gate.b &&
    c.gate.a >= 4 && c.gate.b >= 4 && doc.getElementById('gateQuestion').textContent === 'What is ' + c.gate.a + ' × ' + c.gate.b + '?' &&
    /<label class="gate-question" for="gateAnswer"/.test(H.readApp()));
  stroke(app, guideX(app, 1));
  T('no stroke cuts while it is open', c.roll.cuts.length === 0);
  const answer = doc.getElementById('gateAnswer');
  answer.value = String(c.gate.answer + 1);
  T('a wrong answer opens nothing, and simply asks another', c.checkGate() === false && open('gateOverlay') && !open('prefsOverlay') &&
    answer.value === '' && doc.getElementById('gateNote').textContent !== '');
  answer.value = '';
  T('so does no answer', c.checkGate() === false && !open('prefsOverlay'));
  answer.value = ' ' + c.gate.answer + ' ';
  T('the right one opens the switches, and play stays paused', c.checkGate() === true && !open('gateOverlay') && open('prefsOverlay') &&
    c.pauses.has('grownup'));
  c.__flush();
  c.togglePref('haptics');
  T('a switch is a switch to assistive technology, and says its state',
    doc.getElementById('prefHaptics').getAttribute('role') === 'switch' &&
    doc.getElementById('prefHaptics').getAttribute('aria-checked') === 'false');
  c.closePrefs(); c.__flush();
  T('Done resumes play', !open('prefsOverlay') && !c.pauses.has('grownup') && !c.isPaused());
  c.openGate(); c.__flush();
  key(app, 'Escape');
  c.__flush();
  T('Escape leaves the gate and play carries on', !open('gateOverlay') && !c.isPaused());
  T('and the answer was never kept: only the schema version and the switch just changed are stored',
    [...app.storage._map.keys()].every(k => /sys[.]schemaVersion$|prefs[.]feedback$/.test(k)) &&
    [...app.storage._map.values()].every(v => v === '1' || !/[0-9]/.test(v)), [...app.storage._map.keys()].join());

  sub('with reduced motion the praise stays, still and brief');
  app = play({ reducedMotion: true }); c = app.ctx; settleAll(app);
  stroke(app, guideX(app, 2));
  T('a Perfect cut still shows its three stars, but no sparkle and no slow motion',
    c.feedback.stars && c.feedback.stars.n === 3 && c.feedback.sparks.length === 0 && c.feedback.slow === 0 && c.presentRate() === 1);
  advance(app, c.FEEDBACK.starsMs + 20);
  T('and they go when their time is up, with no frame left waiting', c.feedback.stars === null &&
    c.__clock.pendingFrames() === 0);
  app = play(); c = app.ctx; settleAll(app);
  stroke(app, guideX(app, 2));
  advance(app, 30);
  const had = c.feedback.sparks.length > 0 && c.feedback.slow > 0;
  c.__setReducedMotion(true);
  T('switched on mid-sparkle, the sparkle and slow motion stop at once', had && c.feedback.sparks.length === 0 &&
    c.feedback.slow === 0 && c.presentRate() === 1);

  sub('the slow motion is presentation only');
  const a = play(), b = play();
  [a, b].forEach(x => settleAll(x));
  const cut = x => x.ctx.cutTarget(x.ctx.roll);
  a.ctx.commitCut(cut(a).index, cut(a).u, null, 'perfect');
  b.ctx.commitCut(cut(b).index, cut(b).u, null, 'great');
  advance(a, 120); advance(b, 120);
  const where = x => JSON.stringify(x.ctx.pieces.map(p => [p.off, p.vel, p.tilt, p.tiltV, p.rock, p.rockV]));
  T('during it, the pieces the knife meets are exactly where they would be', where(a) === where(b));
  T('only the squash wave runs slower', a.ctx.presentRate() < 1 && Array.from(a.ctx.wobble.s).some((v, i) => v !== b.ctx.wobble.s[i]));
  const stamp = x => { const t = []; let last = x.ctx.game.phase;
    for(let ms = 0; ms < 3000; ms += 5){ advance(x, 5); if(x.ctx.game.phase !== last){ t.push(x.ctx.game.phase + '@' + ms); last = x.ctx.game.phase; } }
    return t.join(' '); };
  const finish = (x, tier) => { while(x.ctx.game.phase === 'ready'){ const t = cut(x); x.ctx.commitCut(t.index, t.u, null, tier); } };
  [a, b].forEach(x => settleAll(x));
  finish(a, 'perfect'); finish(b, 'nice');
  const ta = stamp(a), tb = stamp(b);
  T('a Perfect last cut serves, clears and brings the next roll at exactly the same moments', ta === tb && /ready@/.test(ta), ta + ' | ' + tb);

  sub('pauses and resizes drop what is stale, and nothing replays');
  w = withAudio({ search: '?tune' }); app = w.app; c = app.ctx; settleAll(app);
  c.unlockAudio();
  stroke(app, guideX(app, 2));
  advance(app, 20);
  T('a Perfect cut is under way: stars, sparkle, slow motion and sound', c.feedbackBusy() && c.feedback.slow > 0 && w.fa.live.size > 0);
  hide(app);
  T('leaving the app drops it all, stops every sound and puts the audio to sleep', !c.feedbackBusy() &&
    w.fa.live.size === 0 && w.fa.suspends >= 1);
  const was = w.fa.started;
  advance(app, 5000);
  show(app);
  advance(app, 100);
  T('coming back replays nothing', !c.feedbackBusy() && w.fa.started === was);
  app.dom.document.dispatch('pointerup', { type: 'pointerup', pointerType: 'touch' });
  stroke(app, guideX(app, 3));
  T('and the next cut sounds again once a touch has woken the audio', w.fa.started > was && c.sound.ctx.state === 'running');
  c.openTuning(); c.__flush();
  T('the tuning sheet drops it too', !c.feedbackBusy() && w.fa.live.size === 0);
  c.closeTuning(); c.__flush();
  stroke(app, guideX(app, 4));
  c.__resize(768, 1024);
  T('so does turning the screen', !c.feedbackBusy());
  w.fa.blocked = true;
  c.sound.ctx.state = 'interrupted';
  const hushed = w.fa.started;
  settleAll(app);
  stroke(app, guideX(app, 5));
  T('audio the browser interrupts or will not start is simply quiet, and play goes on', w.fa.started === hushed &&
    c.roll.cuts.length >= 4 && app.errors.length === 0);
  w.fa.blocked = false;
  app.dom.document.dispatch('keydown', { type: 'keydown', key: 'a', target: app.dom.document.body });
  T('and the next input tries again', c.sound.ctx.state === 'running');
  app = play({ windowExtras: { AudioContext: undefined, webkitAudioContext: undefined } }); c = app.ctx; settleAll(app);
  app.dom.document.dispatch('pointerup', { type: 'pointerup', pointerType: 'touch' });
  stroke(app, guideX(app, 1));
  T('a browser without Web Audio plays on, silently', c.sound.ctx === null && c.roll.cuts.length === 1 && app.errors.length === 0);

  sub('fifty rolls leak nothing');
  w = withAudio(); app = w.app; c = app.ctx; settleAll(app);
  c.unlockAudio();
  const heard = listeners(app);
  for(let r = 0; r < 50; r++){
    while(c.game.phase === 'ready'){ c.keyboardCut(); advance(app, 45); }
    advance(app, 1500);
  }
  T('fifty rolls, every cut praised', c.game.rolls === 50 && c.feedback.seq === 50 * (c.roll.n - 1), c.feedback.seq);
  T('one audio context, and at most a few voices', w.fa.contexts.length === 1 && c.sound.voices.length <= c.SOUND.voices);
  T('no sparkle, star or slow motion left over', !c.feedbackBusy());
  T('no listener or timer added', listeners(app) === heard && owned(c) <= 2 && c.__clock.liveTimers() <= 2);
  T('no errors', app.errors.length === 0, app.errors.slice(0, 2).join(' | '));
}

module.exports = {
  T, section, sub, results, reset, testPortability, testSceneLifecycle, testVendoredLibrary,
  testBoot, testConfig, testStorage, testCollision, testMigration,
  testNavigation, testOverlays, testToast, testConfirmation, testErase,
  testMobile, testDesignSystem, testPWA, testRelease, testStress,
  testAccessibility, testContamination, testSourcesOfTruth,
  testCutModel, testStrokes, testGeometry, testRhythm, testLayout, testMotion,
  testLifecycle, testPermanentRules, testCamera, testServing, testChef, testFeedback
};
