// ── helpers ──────────────────────────────────────────────────────────────────
function setBadge(id, found) {
  const el = document.getElementById('badge-' + id);
  el.textContent   = found ? 'Знайдено' : 'Чисто';
  el.className     = 'badge ' + (found ? 'badge-found' : 'badge-empty');
}

function setStatus(msg, cls = '') {
  const el = document.getElementById('status');
  el.textContent = msg;
  el.className   = cls;
}

// ── scan via executeScript ────────────────────────────────────────────────────
async function scanPage(tabId) {
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      // localStorage
      const ls = localStorage.length > 0;

      // sessionStorage
      const ss = sessionStorage.length > 0;

      // IndexedDB — collect db names
      return new Promise(resolve => {
        const req = indexedDB.databases ? indexedDB.databases() : Promise.resolve([]);
        Promise.resolve(req).then(dbs => {
          // serviceWorker
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then(regs => {
              resolve({
                localStorage:    ls,
                sessionStorage:  ss,
                indexedDB:       Array.isArray(dbs) ? dbs.length > 0 : false,
                serviceWorker:   regs.length > 0
              });
            });
          } else {
            resolve({
              localStorage:    ls,
              sessionStorage:  ss,
              indexedDB:       Array.isArray(dbs) ? dbs.length > 0 : false,
              serviceWorker:   false
            });
          }
        });
      });
    }
  });
  return result;
}

// ── clear via executeScript ───────────────────────────────────────────────────
async function clearPageData(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      localStorage.clear();
      sessionStorage.clear();

      // clear IndexedDB
      if (indexedDB.databases) {
        indexedDB.databases().then(dbs => {
          dbs.forEach(db => indexedDB.deleteDatabase(db.name));
        });
      }

      // unregister service workers
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(regs => {
          regs.forEach(r => r.unregister());
        });
      }
    }
  });
}

// ── apply hideClean setting ──────────────────────────────────────────────────
function applyHideClean() {
  chrome.storage.sync.get({ hideClean: true }, ({ hideClean }) => {
    document.querySelectorAll('.item').forEach(item => {
      const badge = item.querySelector('.badge');
      if (badge && badge.classList.contains('badge-empty')) {
        item.style.display = hideClean ? 'none' : 'flex';
      } else {
        item.style.display = 'flex';
      }
    });
  });
}

// ── main flow ─────────────────────────────────────────────────────────────────
let activeTab  = null;
let scanResult = null;

async function doScan() {
  const scanBtn = document.getElementById('scanBtn');
  const results = document.getElementById('results');
  const actions = document.getElementById('actions');

  setStatus('');

  // reset badges
  ['cache','cookies','localStorage','sessionStorage','indexedDB','serviceWorker']
    .forEach(k => {
      const el = document.getElementById('badge-' + k);
      el.textContent = '...';
      el.className   = 'badge badge-checking';
    });

  results.style.display = 'block';
  actions.style.display = 'none';

  try {
    const origin = new URL(activeTab.url).origin;

    // --- browsingData checks (cache & cookies) via storage estimate trick ---
    // We can't read sizes directly, so we assume "found" = possibly exists
    // and let browsingData.remove handle it; flag them as "можливо" unless
    // we can confirm via scripting.
    // For cache: use Cache API from executeScript
    const [{ result: cacheResult }] = await chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      func: () => {
        return caches.keys().then(keys => keys.length > 0);
      }
    });
    setBadge('cache', cacheResult);

    // cookies — check via scripting (document.cookie)
    const [{ result: cookieResult }] = await chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      func: () => document.cookie.length > 0
    });
    setBadge('cookies', cookieResult);

    // localStorage, sessionStorage, IndexedDB, SW
    const pageData = await scanPage(activeTab.id);
    setBadge('localStorage',   pageData.localStorage);
    setBadge('sessionStorage',  pageData.sessionStorage);
    setBadge('indexedDB',       pageData.indexedDB);
    setBadge('serviceWorker',   pageData.serviceWorker);

    scanResult = { cacheResult, cookieResult, ...pageData };

    const hasAnything = Object.values(scanResult).some(Boolean);
    if (hasAnything) {
      actions.style.display = 'flex';
      setStatus('Знайдено дані для очищення.');
    } else {
      setStatus('✅ Все чисто — нічого очищати!', 'success');
    }

    // apply hideClean setting
    applyHideClean();
  } catch (e) {
    setStatus('Помилка сканування: ' + e.message, 'error');
  }

  document.getElementById('scanningMsg').style.display = 'none';
}

async function runClear() {
  const clearBtn = document.getElementById('clearBtn');
  clearBtn.disabled    = true;
  clearBtn.textContent = '⏳ Очищення...';
  setStatus('');

  try {
    const origin = new URL(activeTab.url).origin;

    await new Promise(resolve => {
      chrome.browsingData.remove(
        { origins: [origin] },
        { cache: true, cookies: true, localStorage: true, indexedDB: true, serviceWorkers: true },
        resolve
      );
    });

    await clearPageData(activeTab.id);

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
    clearBtn.textContent = '🧹 Очистити знайдене';
  }
}

function doClear() {
  chrome.storage.sync.get({ confirmBeforeClear: true }, ({ confirmBeforeClear }) => {
    if (confirmBeforeClear) {
      document.getElementById('confirmOverlay').classList.add('show');
    } else {
      runClear();
    }
  });
}

// ── init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
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

  document.getElementById('clearBtn').addEventListener('click', doClear);
  document.getElementById('rescanBtn').addEventListener('click', doScan);
  document.getElementById('openBtn').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://askep.net' });
  });
  document.getElementById('confirmYes').addEventListener('click', () => {
    document.getElementById('confirmOverlay').classList.remove('show');
    runClear();
  });
  document.getElementById('confirmNo').addEventListener('click', () => {
    document.getElementById('confirmOverlay').classList.remove('show');
  });
});
