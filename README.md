# Googly Heist

Rob First Googly National Bank with a crew of four googlies: you plus friends online, or computer robbers when you play solo.
Each heist lasts 30 minutes, and the getaway van leaves at 30:00.

- **Play solo**: open the page (or the Mac app) and press PLAY SOLO. It runs entirely in the page, with no server, and auto-saves every 30 s.
- **Online**: `cd web && npm install && node server.js`, or deploy with `render.yaml` (Render Blueprint).
- **Mac app**: `mac/build.sh` builds `Googly Heist.app`, which bundles the game so solo works offline. Online play uses https://googly-heist.onrender.com.

Tests: `node web/test/sim.mjs DIFF PLAN SECS` (a whole heist with 4 CPUs), `node web/test/save.mjs`, `node web/test/lobby.mjs` (needs the server on :8131),
`node web/test/snap.mjs "solo=1&..." out.png` (headless screenshot).
