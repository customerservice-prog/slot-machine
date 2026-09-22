# Pineda Power — Free Play

A self-contained browser slot-style game built with HTML5 Canvas and vanilla JavaScript. It is free-play entertainment only: credits have no cash value and there are no deposits, purchases, withdrawals, or real-money wagering.

## Features

- 5×3 reels with 20 paylines
- Wilds, money coins, scatters, and premium symbols
- Hold & Win respin feature with visible locked-coin grid
- Bonus wheel with cash-style credit awards, jackpots, and feature wedges
- Free spins with retriggers
- Three-house village progression and completion reward
- Auto play, turbo mode, sound, statistics, and persistent local progress
- Responsive desktop, tablet, portrait-phone, and landscape-phone controls
- Built-in developer feature testing and selectable math profiles

## Run locally

```bash
npm start
```

Open `http://localhost:3000`.

## Verify

```bash
npm test
```

The smoke test checks the game script syntax, required controls/features, protection against changing bets during an active round, the canvas-resize regression, Railway configuration, the production server, and its health endpoint.

## Railway

Railway uses `node server.js` and checks `/health`. No runtime package download is required.
