let overlayElement = null;
let toastTimeout = null;

function formatDate(timestamp) {
  return new Date(timestamp).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

// --- Fullscreen overlay (shown on blocked futures attempt) ---

function showOverlay(lockUntil) {
  if (overlayElement) return;

  overlayElement = document.createElement("div");
  overlayElement.id = "lockout-overlay";
  overlayElement.innerHTML = `
    <div class="lockout-content">
      <div class="lockout-icon">&#x1f512;</div>
      <h1>Lockout Active</h1>
      <p>Futures trading is blocked until</p>
      <p class="lockout-date">${formatDate(lockUntil)}</p>
      <div class="lockout-countdown" id="lockout-countdown"></div>
      <button id="lockout-dismiss" class="lockout-dismiss">I understand</button>
    </div>
  `;

  document.body.appendChild(overlayElement);
  document.getElementById("lockout-dismiss").addEventListener("click", removeOverlay);
  startCountdown(lockUntil);
}

function removeOverlay() {
  if (overlayElement) {
    overlayElement.remove();
    overlayElement = null;
  }
}

function startCountdown(lockUntil) {
  function update() {
    const remaining = lockUntil - Date.now();
    if (remaining <= 0) {
      removeOverlay();
      return;
    }

    const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
    const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

    const el = document.getElementById("lockout-countdown");
    if (el) {
      el.textContent = `${days}d ${hours}h ${minutes}m ${seconds}s remaining`;
    }

    requestAnimationFrame(update);
  }
  update();
}

// --- Rejection toast ---

function showRejectedToast() {
  let toast = document.getElementById("lockout-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "lockout-toast";
    toast.innerHTML = `<span class="lockout-toast-icon">&#x26d4;</span> ORDER REJECTED — Lockout active`;
    document.body.appendChild(toast);
  }

  toast.classList.add("lockout-toast-visible");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove("lockout-toast-visible");
  }, 3000);
}

// --- Inject interceptor into page context ---

function injectInterceptor() {
  const script = document.createElement("script");
  // Inline the interceptor so it runs synchronously BEFORE any page scripts
  script.textContent = `(function () {
  let locked = false;
  let lockUntil = null;

  window.addEventListener("message", (e) => {
    if (e.source !== window) return;
    if (e.data?.type === "LOCKOUT_STATE") {
      locked = e.data.locked;
      lockUntil = e.data.lockUntil;
    }
  });

  function notifyBlocked(url, method) {
    window.postMessage({
      type: "LOCKOUT_REQUEST_BLOCKED",
      url,
      method,
      lockUntil
    }, "*");
  }

  const originalFetch = window.fetch;
  window.fetch = function (input, init) {
    const url = typeof input === "string" ? input : input?.url || "";
    const method = init?.method || "GET";
    if (locked && ["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase())) {
      console.log("[Lockout] REJECTED fetch:", method, url);
      notifyBlocked(url, method);
      return Promise.reject(new TypeError("Lockout: futures trading blocked"));
    }
    return originalFetch.apply(this, arguments);
  };

  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url) {
    this._lockoutMethod = method;
    this._lockoutUrl = url;
    return originalOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function (body) {
    if (locked && ["POST", "PUT", "PATCH", "DELETE"].includes((this._lockoutMethod || "").toUpperCase())) {
      console.log("[Lockout] REJECTED XHR:", this._lockoutMethod, this._lockoutUrl);
      notifyBlocked(this._lockoutUrl, this._lockoutMethod);
      setTimeout(() => {
        this.dispatchEvent(new Event("error"));
        if (this.onerror) this.onerror(new Event("error"));
      }, 0);
      return;
    }
    return originalSend.apply(this, arguments);
  };
})();`;
  (document.documentElement || document.head).prepend(script);
  script.remove();
}

// Send lock state to the page-level interceptor
function sendLockState(locked, lockUntil) {
  window.postMessage({
    type: "LOCKOUT_STATE",
    locked,
    lockUntil
  }, "*");
}

// Listen for blocked request notifications from interceptor
window.addEventListener("message", (e) => {
  if (e.source !== window) return;
  if (e.data?.type === "LOCKOUT_REQUEST_BLOCKED") {
    showRejectedToast();
    showOverlay(e.data.lockUntil);
  }
});

// Listen for messages from background
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "LOCKOUT_BLOCKED") {
    showOverlay(message.lockUntil);
    showRejectedToast();
  }
  if (message.type === "LOCKOUT_STATE_UPDATE") {
    sendLockState(message.locked, message.lockUntil);
  }
});

// Initialize: inject interceptor and sync lock state
injectInterceptor();

chrome.runtime.sendMessage({ type: "GET_LOCK_STATUS" }, (response) => {
  if (response) {
    sendLockState(response.locked, response.lockUntil);
  }
});
