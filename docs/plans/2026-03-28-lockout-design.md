# Lockout — Browser Extension Design

## Purpose

Block futures trading requests on Breakout, Topstep, and Robinhood with a commitment lock that can't be undone early.

## Core Architecture

Manifest V3 browser extension with four components:

- **Background service worker** — intercepts network requests via `chrome.webRequest`/`declarativeNetRequest`, checks against futures-trading patterns, blocks when lockout is active
- **Content script** — injects fullscreen overlay when a futures request is blocked
- **Popup** — set commitment lock period, view countdown
- **Storage** — `chrome.storage.local` for lock end timestamp and config

## Request Blocking Flow

1. Background worker listens to requests on `*.breakout.trade/*`, `*.topstep.com/*`, `*.robinhood.com/*`
2. Checks URL/method against futures-trading patterns
3. If match + lockout active → block request + message content script
4. Content script renders fullscreen overlay

## Commitment Lock

- User picks an end date → stored as UTC timestamp
- No disable, no pause, no settings changes while active
- Uninstalling resets lock (accepted trade-off)

## Overlay

- Fullscreen fixed-position div, high z-index
- "Lockout Active — Futures trading blocked until [date]"
- Semi-transparent dark background
- No dismiss button — appears when futures action triggers a block
- Non-futures navigation still works

## Popup

- Unlocked: date picker + "Lock" button
- Locked: countdown timer, no controls

## Platform Detection

Initial patterns TBD via live inspection. Extension ships with discovery mode that logs all requests on target domains. Patterns will target order submission endpoints and filter by futures-specific markers in URL paths or request bodies.

## File Structure

```
lockout/
├── manifest.json
├── background/
│   └── service-worker.js
├── content/
│   ├── overlay.js
│   └── overlay.css
├── popup/
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
├── config/
│   └── platforms.js
└── icons/
```
