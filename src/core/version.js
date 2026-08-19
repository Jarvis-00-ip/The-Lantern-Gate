/**
 * The Lantern Gate - Build identity
 *
 * Single source of truth for the version shown in the header. It exists so a
 * deploy can be told apart from a stale cached page at a glance: if the string
 * in the top-right has not changed, the browser is still serving the old build
 * (GitHub Pages plus browser caching can hide an update for a while).
 *
 * Bump VERSION and BUILD_DATE together in this file — nowhere else.
 */
export const VERSION = '0.8.0';
export const BUILD_DATE = '2026-08-19';

/** Short human-readable build stamp, e.g. "v0.2.0 · 18/08/2026". */
export function buildStamp() {
    const [y, m, d] = BUILD_DATE.split('-');
    return `v${VERSION} · ${d}/${m}/${y}`;
}

/**
 * Writes the stamp into the header. Called before the app boots so the version
 * is visible even if the simulation itself fails to start — which is exactly
 * when knowing the build matters most.
 */
export function renderBuildStamp(elementId = 'build-version') {
    const el = document.getElementById(elementId);
    if (el) el.textContent = buildStamp();
    return buildStamp();
}
