document.addEventListener('DOMContentLoaded', () => {
  const hideCleanEl          = document.getElementById('hideClean');
  const confirmBeforeClearEl = document.getElementById('confirmBeforeClear');
  const closeDelayEl         = document.getElementById('closeDelay');
  const saved                = document.getElementById('saved');

  chrome.storage.sync.get(
    { hideClean: true, confirmBeforeClear: true, closeDelay: true },
    (data) => {
      hideCleanEl.checked          = data.hideClean;
      confirmBeforeClearEl.checked = data.confirmBeforeClear;
      closeDelayEl.checked         = data.closeDelay;
    }
  );

  function save() {
    chrome.storage.sync.set({
      hideClean:          hideCleanEl.checked,
      confirmBeforeClear: confirmBeforeClearEl.checked,
      closeDelay:         closeDelayEl.checked,
    }, () => {
      saved.classList.add('show');
      setTimeout(() => saved.classList.remove('show'), 1500);
    });
  }

  hideCleanEl.addEventListener('change',          save);
  confirmBeforeClearEl.addEventListener('change', save);
  closeDelayEl.addEventListener('change',         save);
});
