// Shared keno-board styles (same look as the extension popup `.ball`
// styles and the real game board). Kept in a `<style>` block instead of
// Tailwind utilities so the 10-column grid renders even on a stale build.
export const BOARD_CSS = `
.keno-board-panel { border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.1); background: #141a26; padding: 12px; }
.keno-board { display: grid; grid-template-columns: repeat(10, minmax(0, 1fr)); gap: 6px; }
.keno-tile { position: relative; aspect-ratio: 1 / 1; display: flex; align-items: center; justify-content: center; border-radius: 6px; background: #242c3d; color: #f1f5f9; font-size: 14px; font-weight: 800; font-family: inherit; border: 1px solid rgba(255, 255, 255, 0.06); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06); cursor: pointer; padding: 0; margin: 0; min-width: 0; }
button.keno-tile { cursor: pointer; }
div.keno-tile { cursor: default; }
.keno-tile:hover { background: #2c3547; }
.keno-tile.picked { background: #22c55e; color: #ffffff; box-shadow: 0 0 10px rgba(34, 197, 94, 0.45); }
.keno-tile.drawn { background: #b45309; color: #ffffff; box-shadow: 0 0 10px rgba(245, 158, 11, 0.45); cursor: default; }
.keno-tile.hit { background: #22c55e; color: #ffffff; box-shadow: 0 0 0 2px #ffffff, 0 0 12px rgba(34, 197, 94, 0.6); cursor: default; }
.keno-dot { position: absolute; top: 4px; right: 4px; height: 6px; width: 6px; border-radius: 9999px; }
.keno-dot.hot { background: #ef4444; }
.keno-dot.suggested { background: #38bdf8; }
`;
