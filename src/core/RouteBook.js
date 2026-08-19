import { StorageKeys } from './StorageManager.js';
import { DEFAULT_TRUCK_ROUTES } from './DefaultTruckRoutes.js';

/**
 * The Lantern Gate - Route Book
 *
 * Hand-drawn truck routes, one per leg of the itinerary.
 *
 * Automatic routing works off imported OSM data, which does not always match
 * how a terminal is actually driven: internal lanes may be missing, one-way
 * rules unmapped, gates connected to the wrong side. Rather than keep tuning
 * the cost model against data we cannot fix, an operator who knows the site can
 * draw the real path for any single leg. Legs without a drawing keep using A*,
 * so this is an override, never a replacement.
 */
export class RouteBook {
    /**
     * @param {Object} storage - StorageManager instance (may be unavailable).
     * @param {Object} geoManager - Used to orient a drawing and measure it.
     */
    constructor(storage, geoManager) {
        this.storage = storage;
        this.geoManager = geoManager;
        this.overrides = {}; // locally drawn, "FROM>TO" -> [{lat,lng}, ...]
    }

    /**
     * Effective routes: committed defaults with any local drawing layered on
     * top. Reading goes through here so callers never have to know which is
     * which.
     */
    get routes() {
        return { ...DEFAULT_TRUCK_ROUTES, ...this.overrides };
    }

    /** Where a leg's route comes from: 'locale', 'default', or null. */
    sourceOf(from, to) {
        const key = RouteBook.key(from, to);
        if (this.overrides[key]) return 'locale';
        if (DEFAULT_TRUCK_ROUTES[key]) return 'default';
        return null;
    }

    static key(from, to) {
        return `${from}>${to}`;
    }

    /** Restores saved drawings. Safe to call when storage is unavailable. */
    async load() {
        const saved = await this.storage.load(StorageKeys.TRUCK_ROUTES, null);
        if (saved && typeof saved === 'object') {
            this.overrides = saved;
            const n = Object.keys(this.overrides).length;
            if (n > 0) console.log(`[RouteBook] Restored ${n} locally drawn leg(s).`);
        }
        console.log(`[RouteBook] ${Object.keys(this.routes).length} leg(s) hand-routed (${Object.keys(DEFAULT_TRUCK_ROUTES).length} built in).`);
        return this.routes;
    }

    /** Only local drawings are persisted; defaults live in source. */
    async persist() {
        return this.storage.save(StorageKeys.TRUCK_ROUTES, this.overrides);
    }

    /**
     * The drawing for a leg, or null to fall back to automatic routing.
     * @returns {Array<{lat:number,lng:number}>|null}
     */
    get(from, to) {
        const pts = this.routes[RouteBook.key(from, to)];
        return Array.isArray(pts) && pts.length >= 2 ? pts : null;
    }

    has(from, to) {
        return this.get(from, to) !== null;
    }

    /**
     * Stores a drawing for a leg.
     *
     * The line is oriented to run from `from` towards `to` regardless of which
     * end the operator started drawing at — getting that backwards is easy and
     * would send trucks down the leg in reverse.
     *
     * @returns {Array} The stored (possibly reversed) points.
     */
    set(from, to, points) {
        if (!Array.isArray(points) || points.length < 2) {
            throw new Error('Un percorso richiede almeno 2 punti');
        }

        let clean = points.map(p => ({ lat: p.lat, lng: p.lng }));

        const start = this.geoManager.getZoneCenter(from);
        const end = this.geoManager.getZoneCenter(to);
        if (start && end) {
            const headAtStart = this.geoManager._distanceMeters(clean[0], start);
            const headAtEnd = this.geoManager._distanceMeters(clean[0], end);
            if (headAtEnd < headAtStart) {
                clean.reverse();
                console.log(`[RouteBook] Drawing for ${from}→${to} was reversed to match the direction of travel.`);
            }
        }

        this.overrides[RouteBook.key(from, to)] = clean;
        return clean;
    }

    /** Drops a local drawing, falling back to the built-in default if there is one. */
    remove(from, to) {
        delete this.overrides[RouteBook.key(from, to)];
    }

    /** Drops every local drawing. Built-in defaults remain in force. */
    clear() {
        this.overrides = {};
    }

    /** Legs with a route at all (defaults plus local drawings). */
    count() {
        return Object.keys(this.routes).length;
    }

    /** Legs the operator has drawn locally, overriding whatever shipped. */
    overrideCount() {
        return Object.keys(this.overrides).length;
    }

    /** Length of a stored drawing in metres, for the editor's readout. */
    lengthMeters(from, to) {
        const pts = this.get(from, to);
        if (!pts) return 0;

        let total = 0;
        for (let i = 0; i < pts.length - 1; i++) {
            total += this.geoManager._distanceMeters(pts[i], pts[i + 1]);
        }
        return total;
    }
}
