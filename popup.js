// ── size steps ────────────────────────────────────────────────────────────────
const SIZE_STEPS  = [80, 90, 100, 110, 120];
const SIZE_LABELS = ['80%','90%','100%','110%','120%'];
const SIZE_DEFAULT_IDX = 2;

let currentSizeIdx = SIZE_DEFAULT_IDX;

// ── apply theme & size immediately (no flash) ─────────────────────────────────
chrome.storage.sync.get({ theme: 'auto', uiSize: SIZE_DEFAULT_IDX }, ({ theme, uiSize }) => {
  applyTheme(theme);
  currentSizeIdx = uiSize;
  applySize(uiSize, false); // false = don't update stepper UI yet (DOM not ready)
});

function applyTheme(theme) {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = theme === 'dark' || (theme === 'auto' && prefersDark);
  document.body.classList.toggle('dark', isDark);
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === theme);
  });
}

function applySize(idx, updateUI = true) {
  const pct  = SIZE_STEPS[idx] ?? 100;
  const w    = Math.round(320 * pct / 100);
  const pad  = Math.round(16  * pct / 100);
  document.body.style.fontSize = pct + '%';
  document.body.style.width    = w + 'px';
  document.body.style.padding  = pad + 'px';
  if (updateUI) {
    document.getElementById('sizeVal').textContent = SIZE_LABELS[idx];
    document.getElementById('sizeDown').disabled = idx === 0;
    document.getElementById('sizeUp').disabled   = idx === SIZE_STEPS.length - 1;
  }
}

// ── helpers ───────────────────────────────────────────────────────────────────
function setBadge(id, state) {
  const el = document.getElementById('badge-' + id);
  const labels = { found: 'Знайдено', empty: 'Чисто', checking: '...', clearing: '⏳' };
  el.textContent = labels[state] ?? state;
  el.className   = 'badge badge-' + state;
}

function setStatus(msg, cls = '') {
  const el = document.getElementById('status');
  el.textContent = msg;
  el.className   = cls;
}

function updateItemClearable() {
  document.querySelectorAll('.item[data-key]').forEach(item => {
    const badge = document.getElementById('badge-' + item.dataset.key);
    item.classList.toggle('clearable', badge && badge.classList.contains('badge-found'));
  });
}

// ── scan ──────────────────────────────────────────────────────────────────────
async function scanPage(tabId) {
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const ls = localStorage.length > 0;
      const ss = sessionStorage.length > 0;
      return new Promise(resolve => {
        Promise.resolve(indexedDB.databases ? indexedDB.databases() : []).then(dbs => {
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then(regs => {
              resolve({ localStorage: ls, sessionStorage: ss,
                        indexedDB: Array.isArray(dbs) ? dbs.length > 0 : false,
                        serviceWorker: regs.length > 0 });
            });
          } else {
            resolve({ localStorage: ls, sessionStorage: ss,
                      indexedDB: Array.isArray(dbs) ? dbs.length > 0 : false,
                      serviceWorker: false });
          }
        });
      });
    }
  });
  return result;
}

// ── clear helpers ─────────────────────────────────────────────────────────────
async function clearOneItem(key) {
  const origin = new URL(activeTab.url).origin;
  const browsingMap = { cache: { cache: true }, cookies: { cookies: true } };
  const scriptMap = {
    localStorage:   () => { localStorage.clear(); },
    sessionStorage: () => { sessionStorage.clear(); },
    indexedDB:      () => {
      if (indexedDB.databases)
        indexedDB.databases().then(dbs => dbs.forEach(db => indexedDB.deleteDatabase(db.name)));
    },
    serviceWorker:  () => {
      if ('serviceWorker' in navigator)
        navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister()));
    },
  };

  if (browsingMap[key]) {
    await new Promise(resolve =>
      chrome.browsingData.remove({ origins: [origin] }, browsingMap[key], resolve)
    );
  } else if (scriptMap[key]) {
    await chrome.scripting.executeScript({ target: { tabId: activeTab.id }, func: scriptMap[key] });
  }
}

async function clearAllData() {
  const origin = new URL(activeTab.url).origin;
  await new Promise(resolve =>
    chrome.browsingData.remove(
      { origins: [origin] },
      { cache: true, cookies: true, localStorage: true, indexedDB: true, serviceWorkers: true },
      resolve
    )
  );
  await chrome.scripting.executeScript({
    target: { tabId: activeTab.id },
    func: () => {
      localStorage.clear();
      sessionStorage.clear();
      if (indexedDB.databases)
        indexedDB.databases().then(dbs => dbs.forEach(db => indexedDB.deleteDatabase(db.name)));
      if ('serviceWorker' in navigator)
        navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister()));
    }
  });
}

// ── hideClean ─────────────────────────────────────────────────────────────────
function applyHideClean() {
  chrome.storage.sync.get({ hideClean: true }, ({ hideClean }) => {
    document.querySelectorAll('.item[data-key]').forEach(item => {
      const badge = item.querySelector('.badge');
      const isEmpty = badge && badge.classList.contains('badge-empty');
      item.style.display = (isEmpty && hideClean) ? 'none' : 'flex';
    });
  });
}

// ── scan flow ─────────────────────────────────────────────────────────────────
let activeTab  = null;
let scanResult = null;

async function doScan() {
  const results = document.getElementById('results');
  const actions = document.getElementById('actions');
  setStatus('');
  ['cache','cookies','localStorage','sessionStorage','indexedDB','serviceWorker']
    .forEach(k => setBadge(k, 'checking'));
  results.style.display = 'block';
  actions.style.display = 'none';

  try {
    const [{ result: cacheResult }] = await chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      func: () => caches.keys().then(keys => keys.length > 0)
    });
    setBadge('cache', cacheResult ? 'found' : 'empty');

    const [{ result: cookieResult }] = await chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      func: () => document.cookie.length > 0
    });
    setBadge('cookies', cookieResult ? 'found' : 'empty');

    const pageData = await scanPage(activeTab.id);
    setBadge('localStorage',  pageData.localStorage  ? 'found' : 'empty');
    setBadge('sessionStorage', pageData.sessionStorage ? 'found' : 'empty');
    setBadge('indexedDB',      pageData.indexedDB      ? 'found' : 'empty');
    setBadge('serviceWorker',  pageData.serviceWorker  ? 'found' : 'empty');

    scanResult = { cache: cacheResult, cookies: cookieResult, ...pageData };

    const hasAny = Object.values(scanResult).some(Boolean);
    if (hasAny) {
      actions.style.display = 'flex';
      setStatus('Знайдено дані для очищення.');
    } else {
      setStatus('✅ Все чисто — нічого очищати!', 'success');
    }
    updateItemClearable();
    applyHideClean();
  } catch (e) {
    setStatus('Помилка сканування: ' + e.message, 'error');
  }
  document.getElementById('scanningMsg').style.display = 'none';
}

// ── full clear ────────────────────────────────────────────────────────────────
async function runClearAll() {
  const clearBtn = document.getElementById('clearBtn');
  clearBtn.disabled    = true;
  clearBtn.textContent = '⏳ Очищення...';
  setStatus('');
  try {
    await clearAllData();
    chrome.storage.sync.get({ closeDelay: true }, ({ closeDelay }) => {
      if (closeDelay) {
        setStatus('✅ Очищено! Перезавантаження...', 'success');
        setTimeout(() => { chrome.tabs.reload(activeTab.id); window.close(); }, 1800);
      } else {
        chrome.tabs.reload(activeTab.id);
        window.close();
      }
    });
  } catch (e) {
    setStatus('Помилка: ' + e.message, 'error');
    clearBtn.disabled    = false;
    clearBtn.textContent = '🧹 Очистити все';
  }
}

// ── single clear ──────────────────────────────────────────────────────────────
async function runClearOne(key) {
  const item = document.querySelector(`.item[data-key="${key}"]`);
  item.classList.add('clearing');
  setBadge(key, 'clearing');
  setStatus('');
  try {
    await clearOneItem(key);
    setBadge(key, 'empty');
    item.classList.remove('clearable', 'clearing');
    if (scanResult) scanResult[key] = false;
    chrome.storage.sync.get({ closeDelay: true }, ({ closeDelay }) => {
      if (closeDelay) {
        setStatus('✅ Очищено! Перезавантаження...', 'success');
        setTimeout(() => { chrome.tabs.reload(activeTab.id); window.close(); }, 1800);
      } else {
        chrome.tabs.reload(activeTab.id);
        window.close();
      }
    });
  } catch (e) {
    setBadge(key, 'found');
    item.classList.remove('clearing');
    item.classList.add('clearable');
    setStatus('Помилка: ' + e.message, 'error');
  }
}

// ── confirm helpers ───────────────────────────────────────────────────────────
let pendingSingleKey = null;

function doClear() {
  chrome.storage.sync.get({ confirmBeforeClear: true }, ({ confirmBeforeClear }) => {
    if (confirmBeforeClear) {
      pendingSingleKey = null;
      document.getElementById('confirmTitle').textContent = 'Підтвердіть очищення';
      document.getElementById('confirmText').innerHTML    = 'Буде очищено всі знайдені дані.<br>Сторінка перезавантажиться автоматично.';
      document.getElementById('confirmOverlay').classList.add('show');
    } else {
      runClearAll();
    }
  });
}

function doClearOne(key) {
  chrome.storage.sync.get({ confirmBeforeClear: true }, ({ confirmBeforeClear }) => {
    if (confirmBeforeClear) {
      pendingSingleKey = key;
      const nameEl = document.querySelector(`.item[data-key="${key}"] .item-name`);
      document.getElementById('confirmTitle').textContent = 'Очистити ' + (nameEl?.textContent ?? key) + '?';
      document.getElementById('confirmText').textContent  = 'Дані будуть видалені. Сторінка перезавантажиться автоматично.';
      document.getElementById('confirmOverlay').classList.add('show');
    } else {
      runClearOne(key);
    }
  });
}

// ── settings panel ────────────────────────────────────────────────────────────
function showSettings() {
  document.getElementById('main').style.display        = 'none';
  document.getElementById('not-askep').style.display   = 'none';
  document.getElementById('settingsPanel').style.display = 'block';
  document.getElementById('settingsBtn').style.display = 'none';
  document.getElementById('backBtn').style.display     = 'flex';

  // populate settings
  chrome.storage.sync.get(
    { theme: 'auto', uiSize: SIZE_DEFAULT_IDX, hideClean: true, confirmBeforeClear: true, closeDelay: true },
    (data) => {
      applyTheme(data.theme);
      currentSizeIdx = data.uiSize;
      document.getElementById('sizeVal').textContent = SIZE_LABELS[currentSizeIdx];
      document.getElementById('sizeDown').disabled = currentSizeIdx === 0;
      document.getElementById('sizeUp').disabled   = currentSizeIdx === SIZE_STEPS.length - 1;
      document.getElementById('hideClean').checked          = data.hideClean;
      document.getElementById('confirmBeforeClear').checked = data.confirmBeforeClear;
      document.getElementById('closeDelay').checked         = data.closeDelay;
    }
  );
}

function hideSettings() {
  document.getElementById('settingsPanel').style.display = 'none';
  document.getElementById('settingsBtn').style.display   = 'inline-block';
  document.getElementById('backBtn').style.display       = 'none';
  // restore correct main view
  if (activeTab && new URL(activeTab.url).hostname.includes('askep.net')) {
    document.getElementById('main').style.display = 'block';
  } else {
    document.getElementById('not-askep').style.display = 'block';
  }
}

function saveSettings() {
  chrome.storage.sync.set({
    theme:              document.querySelector('.theme-btn.active')?.dataset.theme ?? 'auto',
    uiSize:             currentSizeIdx,
    hideClean:          document.getElementById('hideClean').checked,
    confirmBeforeClear: document.getElementById('confirmBeforeClear').checked,
    closeDelay:         document.getElementById('closeDelay').checked,
  }, () => {
    const s = document.getElementById('sSaved');
    s.classList.add('show');
    setTimeout(() => s.classList.remove('show'), 1500);
  });
}

// ── init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // update stepper UI now that DOM is ready
  document.getElementById('sizeVal').textContent = SIZE_LABELS[currentSizeIdx];
  document.getElementById('sizeDown').disabled = currentSizeIdx === 0;
  document.getElementById('sizeUp').disabled   = currentSizeIdx === SIZE_STEPS.length - 1;

  // set version from manifest
  const { version } = chrome.runtime.getManifest();
  document.querySelectorAll('.ext-version').forEach(el => el.textContent = 'v' + version);

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    chrome.storage.sync.get({ theme: 'auto' }, ({ theme }) => { if (theme === 'auto') applyTheme('auto'); });
  });

  chrome.tabs.query({ active: true, currentWindow: true }, async ([tab]) => {
    activeTab = tab;
    const url = new URL(tab.url);
    if (!url.hostname.includes('askep.net')) {
      document.getElementById('not-askep').style.display = 'block';
      return;
    }
    document.getElementById('main').style.display = 'block';
    doScan();
  });

  // navigation
  document.getElementById('settingsBtn').addEventListener('click', showSettings);
  document.getElementById('backBtn').addEventListener('click', hideSettings);

  // main actions
  document.getElementById('clearBtn').addEventListener('click', doClear);
  document.getElementById('rescanBtn').addEventListener('click', doScan);
  document.getElementById('openBtn').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://askep.net' });
  });

  // item click
  document.querySelectorAll('.item[data-key]').forEach(item => {
    item.addEventListener('click', () => {
      if (item.classList.contains('clearable')) doClearOne(item.dataset.key);
    });
  });

  // confirm
  document.getElementById('confirmYes').addEventListener('click', () => {
    document.getElementById('confirmOverlay').classList.remove('show');
    if (pendingSingleKey) { runClearOne(pendingSingleKey); pendingSingleKey = null; }
    else runClearAll();
  });
  document.getElementById('confirmNo').addEventListener('click', () => {
    document.getElementById('confirmOverlay').classList.remove('show');
    pendingSingleKey = null;
  });

  // settings controls
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.addEventListener('click', () => { applyTheme(btn.dataset.theme); saveSettings(); });
  });
  document.getElementById('sizeDown').addEventListener('click', () => {
    if (currentSizeIdx > 0) { currentSizeIdx--; applySize(currentSizeIdx); saveSettings(); }
  });
  document.getElementById('sizeUp').addEventListener('click', () => {
    if (currentSizeIdx < SIZE_STEPS.length - 1) { currentSizeIdx++; applySize(currentSizeIdx); saveSettings(); }
  });
  document.getElementById('hideClean').addEventListener('change',          saveSettings);
  document.getElementById('confirmBeforeClear').addEventListener('change', saveSettings);
  document.getElementById('closeDelay').addEventListener('change',         saveSettings);
});
