document.getElementById("clearCache").addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      const url = new URL(activeTab.url);
  
      if (url.hostname.includes("askep.net")) {
        chrome.browsingData.remove({
          origins: [url.origin] 
        }, {
          cache: true, 
          cookies: true 
        }, () => {
          console.log(`Cache and cookies for ${url.origin} cleared.`);
          chrome.tabs.reload(activeTab.id); 
        });
      } else {
        alert("Ця сторінка не є askep.net.");
      }
    });
  });
  