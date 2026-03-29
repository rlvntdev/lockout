// Injected into the PAGE context (not content script) to intercept fetch/XHR.
// Communicates with content script via window.postMessage.

(function () {
  let locked = false;
  let lockUntil = null;

  // Receive lock state from content script
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

  // Patch fetch
  const originalFetch = window.fetch;
  window.fetch = function (input, init) {
    const url = typeof input === "string" ? input : input?.url || "";
    const method = init?.method || "GET";

    if (locked && isOrderRequest(url, method, init?.body)) {
      console.log("[Lockout] REJECTED fetch:", method, url);
      notifyBlocked(url, method);
      return Promise.reject(new TypeError("Lockout: futures trading blocked"));
    }

    return originalFetch.apply(this, arguments);
  };

  // Patch XMLHttpRequest
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url) {
    this._lockoutMethod = method;
    this._lockoutUrl = url;
    return originalOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function (body) {
    if (locked && isOrderRequest(this._lockoutUrl, this._lockoutMethod, body)) {
      console.log("[Lockout] REJECTED XHR:", this._lockoutMethod, this._lockoutUrl);
      notifyBlocked(this._lockoutUrl, this._lockoutMethod);

      // Fire error event so the app sees a failure
      setTimeout(() => {
        this.dispatchEvent(new Event("error"));
        if (this.onerror) this.onerror(new Event("error"));
      }, 0);
      return;
    }

    return originalSend.apply(this, arguments);
  };

  // Detect order submission requests
  // Currently blocks ALL POST/PUT/PATCH/DELETE on tracked domains while locked.
  // This is intentionally broad during discovery — will be narrowed to futures-only
  // once we identify the specific endpoints.
  function isOrderRequest(url, method) {
    if (!method) return false;
    const m = method.toUpperCase();
    // Only block mutating requests (order submissions, modifications, etc.)
    return ["POST", "PUT", "PATCH", "DELETE"].includes(m);
  }
})();
