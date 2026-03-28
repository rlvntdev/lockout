const unlockedView = document.getElementById("unlocked-view");
const lockedView = document.getElementById("locked-view");
const lockDateInput = document.getElementById("lock-date");
const lockBtn = document.getElementById("lock-btn");
const lockDateDisplay = document.getElementById("lock-date-display");
const countdownEl = document.getElementById("countdown");

// Set minimum date to now
const now = new Date();
now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
lockDateInput.min = now.toISOString().slice(0, 16);

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

function showLocked(lockUntil) {
  unlockedView.style.display = "none";
  lockedView.style.display = "block";
  lockDateDisplay.textContent = formatDate(lockUntil);
  startCountdown(lockUntil);
}

function showUnlocked() {
  unlockedView.style.display = "block";
  lockedView.style.display = "none";
}

function startCountdown(lockUntil) {
  function update() {
    const remaining = lockUntil - Date.now();
    if (remaining <= 0) {
      showUnlocked();
      return;
    }

    const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
    const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

    countdownEl.textContent = `${days}d ${hours}h ${minutes}m ${seconds}s`;
    setTimeout(update, 1000);
  }
  update();
}

// Check current lock status on popup open
chrome.runtime.sendMessage({ type: "GET_LOCK_STATUS" }, (response) => {
  if (response?.locked) {
    showLocked(response.lockUntil);
  } else {
    showUnlocked();
  }
});

// Commit to lockout
lockBtn.addEventListener("click", () => {
  const dateValue = lockDateInput.value;
  if (!dateValue) return;

  const untilTimestamp = new Date(dateValue).getTime();
  if (untilTimestamp <= Date.now()) return;

  chrome.runtime.sendMessage(
    { type: "SET_LOCK", untilTimestamp },
    (response) => {
      if (response?.success) {
        showLocked(untilTimestamp);
      }
    }
  );
});
