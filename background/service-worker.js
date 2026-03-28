import { PLATFORMS, getPlatform, isFuturesRequest } from "../config/platforms.js";

// Discovery mode — set to true to log all requests on target domains
const DISCOVERY_MODE = true;

const TRACKED_DOMAINS = Object.values(PLATFORMS).flatMap(p => p.domains);

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

// Listen for requests on tracked domains
chrome.webRequest.onBeforeRequest.addListener(
  async (details) => {
    const { url, method, requestBody } = details;

    // Discovery mode: log everything for pattern identification
    if (DISCOVERY_MODE) {
      console.log("[Lockout Discovery]", {
        url,
        method,
        type: details.type,
        body: requestBody,
        timestamp: new Date().toISOString()
      });
    }

    // Check if lockout is active
    const locked = await isLocked();
    if (!locked) return;

    // Check if this is a futures trading request
    const bodyStr = requestBody?.raw
      ? new TextDecoder().decode(requestBody.raw[0]?.bytes)
      : JSON.stringify(requestBody?.formData || "");

    if (isFuturesRequest(url, method, bodyStr)) {
      console.log("[Lockout] Blocked futures request:", url);

      // Notify content script to show overlay
      const lockUntil = await getLockUntil();
      chrome.tabs.sendMessage(details.tabId, {
        type: "LOCKOUT_BLOCKED",
        lockUntil
      }).catch(() => {
        // Content script may not be ready yet
      });

      return { cancel: true };
    }
  },
  {
    urls: TRACKED_DOMAINS.map(d => `*://*.${d}/*`)
  },
  ["blocking", "requestBody"]
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
      sendResponse(result);
    })();
    return true;
  }
});
