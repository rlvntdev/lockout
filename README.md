# Lockout

Browser extension that blocks futures trading on Breakout, Topstep, and Robinhood with a commitment-based lock that can't be undone early.

## Install

1. Clone the repo
2. Open `chrome://extensions` in Chrome
3. Enable **Developer mode** (top right toggle)
4. Click **Load unpacked** and select the `lockout/` directory
5. The Lockout extension icon appears in your toolbar

## Usage

1. Click the Lockout icon in the toolbar
2. Choose a lock duration:
   - **Minutes** — enter a number of minutes
   - **Date** — pick a specific date and time
3. Click **Commit to Lockout**
4. Futures trading requests are now blocked until the lock expires
5. If you attempt a futures trade, a fullscreen overlay blocks the page with a countdown

The lock **cannot be undone**. Once committed, you wait it out.

## Discovery Mode

The extension currently runs in discovery mode, logging all network requests on supported platforms to the service worker console. This is used to identify futures-specific request patterns.

To view logs:
1. Go to `chrome://extensions`
2. Find Lockout and click **Inspect views: service worker**
3. Navigate the trading platform — all requests are logged as `[Lockout Discovery]`

## Supported Platforms

- Breakout (`breakoutprop.com`)
- Topstep (`topstep.com`)
- Robinhood (`robinhood.com`)
