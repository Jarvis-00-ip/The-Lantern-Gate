/**
 * Top-down vehicle icons.
 *
 * The map is seen from above, so these are plan-view silhouettes rather than
 * side views: an articulated truck reads as cab + trailer, a terminal tractor
 * as a short cab with a fifth wheel, a reach stacker by its boom. Loaded and
 * empty are distinguishable at a glance — a container sits on the deck when
 * carrying, an open deck shows when not.
 *
 * Each icon wraps its artwork in `.veh-rot`, which the renderer rotates to the
 * direction of travel without rebuilding the icon every frame.
 */

const CONTAINER_FILL = { standard: '#1f6feb', reefer: '#00CED1', imo: '#FF4500' };

/** Container box drawn on a deck, or the empty deck outline. */
function deck(x, y, w, h, loaded, cargoColour) {
    return loaded
        ? `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1"
               fill="${cargoColour}" stroke="#0d1117" stroke-width="0.8"/>
           <line x1="${x + w / 3}" y1="${y}" x2="${x + w / 3}" y2="${y + h}" stroke="#0d1117" stroke-width="0.4" opacity="0.5"/>
           <line x1="${x + 2 * w / 3}" y1="${y}" x2="${x + 2 * w / 3}" y2="${y + h}" stroke="#0d1117" stroke-width="0.4" opacity="0.5"/>`
        : `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1"
               fill="none" stroke="#8b949e" stroke-width="0.8" stroke-dasharray="2,1.5"/>`;
}

function wrap(svg, size, heading = 0) {
    return `<div class="veh-rot" style="width:${size}px;height:${size}px;
                 transform:rotate(${heading}deg);transform-origin:50% 50%;
                 transition:transform .25s linear;">${svg}</div>`;
}

/**
 * Road truck: tractor unit plus semi-trailer, nose pointing up (0deg = north).
 * @param {Object} o
 * @param {boolean} o.loaded
 * @param {boolean} o.oversize - Out-of-gauge: wider load overhanging the deck.
 * @param {number} o.heading - Degrees clockwise from north.
 */
export function truckIcon({ loaded = false, oversize = false, heading = 0, cargo = 'standard' } = {}) {
    const colour = oversize ? '#e3b341' : '#4caf50';
    const cargoColour = CONTAINER_FILL[cargo] || CONTAINER_FILL.standard;

    const svg = `
    <svg viewBox="0 0 20 30" width="20" height="30" style="overflow:visible;">
      <!-- trailer -->
      <rect x="5" y="9" width="10" height="19" rx="1.5" fill="#30363d" stroke="#0d1117" stroke-width="0.8"/>
      ${oversize && loaded
            ? `<rect x="2.5" y="12" width="15" height="13" rx="1" fill="${cargoColour}" stroke="#e3b341" stroke-width="1"/>`
            : deck(6.5, 11, 7, 15, loaded, cargoColour)}
      <!-- cab -->
      <rect x="5.5" y="1" width="9" height="7.5" rx="1.5" fill="${colour}" stroke="#0d1117" stroke-width="0.9"/>
      <rect x="6.8" y="1.8" width="6.4" height="2.6" rx="0.6" fill="#0d1117" opacity="0.65"/>
      <!-- wheels -->
      <rect x="3.6" y="3.4" width="1.6" height="3.4" rx="0.7" fill="#0d1117"/>
      <rect x="14.8" y="3.4" width="1.6" height="3.4" rx="0.7" fill="#0d1117"/>
      <rect x="3.6" y="20" width="1.6" height="5" rx="0.7" fill="#0d1117"/>
      <rect x="14.8" y="20" width="1.6" height="5" rx="0.7" fill="#0d1117"/>
    </svg>`;

    return wrap(svg, 30, heading);
}

/** Terminal tractor (ralla): short cab towing a low chassis. */
export function rallaIcon({ loaded = false, heading = 0, cargo = 'standard' } = {}) {
    const cargoColour = CONTAINER_FILL[cargo] || CONTAINER_FILL.standard;

    const svg = `
    <svg viewBox="0 0 18 24" width="18" height="24" style="overflow:visible;">
      <rect x="4.5" y="8" width="9" height="14" rx="1.2" fill="#30363d" stroke="#0d1117" stroke-width="0.8"/>
      ${deck(5.8, 9.5, 6.4, 11, loaded, cargoColour)}
      <rect x="4.8" y="1.5" width="8.4" height="6.5" rx="1.4" fill="#e3b341" stroke="#0d1117" stroke-width="0.9"/>
      <rect x="6" y="2.3" width="6" height="2.3" rx="0.5" fill="#0d1117" opacity="0.65"/>
      <circle cx="9" cy="8.6" r="1.1" fill="#0d1117" opacity="0.8"/>
      <rect x="3" y="3.6" width="1.5" height="3" rx="0.6" fill="#0d1117"/>
      <rect x="13.5" y="3.6" width="1.5" height="3" rx="0.6" fill="#0d1117"/>
      <rect x="3" y="16" width="1.5" height="4" rx="0.6" fill="#0d1117"/>
      <rect x="13.5" y="16" width="1.5" height="4" rx="0.6" fill="#0d1117"/>
    </svg>`;

    return wrap(svg, 24, heading);
}

/** Reach stacker: counterweighted body with a boom reaching forward. */
export function reachStackerIcon({ loaded = false, heading = 0, cargo = 'standard' } = {}) {
    const cargoColour = CONTAINER_FILL[cargo] || CONTAINER_FILL.standard;

    const svg = `
    <svg viewBox="0 0 20 26" width="20" height="26" style="overflow:visible;">
      <rect x="5" y="9" width="10" height="14" rx="1.5" fill="#f78166" stroke="#0d1117" stroke-width="0.9"/>
      <rect x="6.4" y="17" width="7.2" height="4" rx="0.8" fill="#0d1117" opacity="0.55"/>
      <!-- boom -->
      <rect x="8.4" y="2.5" width="3.2" height="8" rx="0.8" fill="#c9713f" stroke="#0d1117" stroke-width="0.7"/>
      <!-- spreader + load -->
      ${loaded
            ? `<rect x="4" y="0.5" width="12" height="5.5" rx="1" fill="${cargoColour}" stroke="#0d1117" stroke-width="0.9"/>`
            : `<rect x="6" y="1.2" width="8" height="2" rx="0.6" fill="none" stroke="#8b949e" stroke-width="0.9"/>`}
      <rect x="3.4" y="10.5" width="1.7" height="3.6" rx="0.7" fill="#0d1117"/>
      <rect x="14.9" y="10.5" width="1.7" height="3.6" rx="0.7" fill="#0d1117"/>
      <rect x="3.8" y="18.5" width="1.4" height="3" rx="0.6" fill="#0d1117"/>
      <rect x="14.8" y="18.5" width="1.4" height="3" rx="0.6" fill="#0d1117"/>
    </svg>`;

    return wrap(svg, 26, heading);
}

/** Picks the right silhouette for a fleet vehicle type. */
export function fleetIcon(type, opts = {}) {
    if (type === 'Reach Stacker' || type === 'Straddle Carrier') return reachStackerIcon(opts);
    return rallaIcon(opts);
}

/**
 * Bearing in degrees clockwise from north, for orienting an icon.
 */
export function bearing(from, to) {
    const toRad = d => d * Math.PI / 180;
    const y = Math.sin(toRad(to.lng - from.lng)) * Math.cos(toRad(to.lat));
    const x = Math.cos(toRad(from.lat)) * Math.sin(toRad(to.lat)) -
        Math.sin(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.cos(toRad(to.lng - from.lng));
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}
