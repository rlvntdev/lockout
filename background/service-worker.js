import { PLATFORMS, getPlatform, isFuturesRequest } from "../config/platforms.js";

// Discovery mode — logs all requests on target domains to the console
const DISCOVERY_MODE = true;

const TRACKED_URLS = Object.values(PLATFORMS)
  .flatMap(p => p.domains)
  .map(d => `*://*.${d}/*`);

// Check if lockout is currently active
async function isLocked() {
  const { lockUntil } = await chrome.storage.local.get("lockUntil");
  if (!lockUntil) return false;
  if (Date.now() >= lockUntil) {
    await chrome.storage.local.remove("lockUntil");
    return false;
  }
  return true;
}

// Get lock end timestamp
async function getLockUntil() {
  const { lockUntil } = await chrome.storage.local.get("lockUntil");
  return lockUntil || null;
}

// Set commitment lock
async function setLock(untilTimestamp) {
  const locked = await isLocked();
  if (locked) return { success: false, reason: "Already locked" };

  await chrome.storage.local.set({ lockUntil: untilTimestamp });
  return { success: true };
}

// Observe requests for discovery mode logging and futures detection
// MV3 webRequest is observe-only (no blocking), so we log here
// and notify the content script to show the overlay when we detect futures requests.
// Actual request cancellation uses declarativeNetRequest rules (added once patterns are known).
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    const { url, method, requestBody } = details;

    if (DISCOVERY_MODE) {
      console.log("[Lockout Discovery]", {
        url,
        method,
        type: details.type,
        body: requestBody,
        timestamp: new Date().toISOString()
      });
    }

    // Check for futures requests and notify content script
    (async () => {
      const locked = await isLocked();
      if (!locked) return;

      const bodyStr = requestBody?.raw
        ? new TextDecoder().decode(requestBody.raw[0]?.bytes)
        : JSON.stringify(requestBody?.formData || "");

      if (isFuturesRequest(url, method, bodyStr)) {
        console.log("[Lockout] Detected futures request:", url);

        const lockUntil = await getLockUntil();
        chrome.tabs.sendMessage(details.tabId, {
          type: "LOCKOUT_BLOCKED",
          lockUntil
        }).catch(() => {});
      }
    })();
  },
  { urls: TRACKED_URLS },
  ["requestBody"]
);

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_LOCK_STATUS") {
    (async () => {
      const locked = await isLocked();
      const lockUntil = await getLockUntil();
      sendResponse({ locked, lockUntil });
    })();
    return true;
  }

  if (message.type === "SET_LOCK") {
    (async () => {
      const result = await setLock(message.untilTimestamp);
      if (result.success) {
        // Push lock state to all tracked tabs
        broadcastLockState(true, message.untilTimestamp);
      }
      sendResponse(result);
    })();
    return true;
  }
});

// Broadcast lock state to all content scripts on tracked domains
async function broadcastLockState(locked, lockUntil) {
  const tabs = await chrome.tabs.query({});
  const trackedDomains = Object.values(PLATFORMS).flatMap(p => p.domains);
  for (const tab of tabs) {
    if (tab.url && trackedDomains.some(d => tab.url.includes(d))) {
      chrome.tabs.sendMessage(tab.id, {
        type: "LOCKOUT_STATE_UPDATE",
        locked,
        lockUntil
      }).catch(() => {});
    }
  }
}
