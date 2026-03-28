let overlayElement = null;

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
    </div>
  `;

  document.body.appendChild(overlayElement);
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

// Listen for block messages from background
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "LOCKOUT_BLOCKED") {
    showOverlay(message.lockUntil);
  }
});
