/**
 * The Lantern Gate - Storage Manager
 *
 * Local persistence layer for editable simulation data (road network, and
 * later zones/yard/fleet). Without this, anything drawn on the map is lost on
 * reload and has to be copy-pasted back into source by hand.
 *
 * The API is intentionally async even though localStorage is synchronous:
 * a remote backend (Firestore, REST) can be dropped in later behind the same
 * interface without touching a single caller.
 */

/** Bump when a stored payload shape changes incompatibly. */
export const SCHEMA_VERSION = 1;

/** Well-known slots, so callers never hand-write key strings. */
export const StorageKeys = {
    ROADS: 'roads'
};

export class StorageManager {
    /**
     * @param {string} namespace - Key prefix, keeps us from clashing with
     *                             anything else served from the same origin
     *                             (relevant on GitHub Pages, where every repo
     *                             of an account shares github.io).
     */
    constructor(namespace = 'lanterngate') {
        this.namespace = namespace;
        this.available = this._probe();

        if (!this.available) {
            console.warn('[Storage] localStorage unavailable (private mode or blocked). Changes will not persist.');
        }
    }

    /**
     * Feature-detects localStorage. Merely reading window.localStorage throws
     * in some privacy modes, and Safari private browsing accepts writes but
     * throws on commit, so we round-trip a probe value.
     */
    _probe() {
        try {
            const probe = `${this.namespace}:__probe__`;
            window.localStorage.setItem(probe, '1');
            window.localStorage.removeItem(probe);
            return true;
        } catch (e) {
            return false;
        }
    }

    _fullKey(key) {
        return `${this.namespace}:${key}`;
    }

    /**
     * Persists a value. Wrapped in an envelope carrying the schema version and
     * a timestamp so future versions can migrate or discard confidently.
     * @returns {Promise<boolean>} false if the write could not be completed.
     */
    async save(key, value) {
        if (!this.available) return false;

        const envelope = {
            version: SCHEMA_VERSION,
            savedAt: new Date().toISOString(),
            data: value
        };

        try {
            window.localStorage.setItem(this._fullKey(key), JSON.stringify(envelope));
            return true;
        } catch (e) {
            // QuotaExceededError is the realistic failure here: the imported OSM
            // network can run to hundreds of KB and browsers cap origins ~5MB.
            const isQuota = e instanceof DOMException &&
                (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED');

            if (isQuota) {
                console.error(`[Storage] Quota exceeded saving "${key}". The road network is too large to keep locally — export it to JSON instead.`);
            } else {
                console.error(`[Storage] Failed to save "${key}":`, e);
            }
            return false;
        }
    }

    /**
     * Reads a value back. Returns the fallback when the slot is empty, the
     * payload is corrupt, or it was written by an incompatible schema — a bad
     * stored value must never take the app down on startup.
     * @returns {Promise<*>} The stored data, or `fallback`.
     */
    async load(key, fallback = null) {
        if (!this.available) return fallback;

        const raw = window.localStorage.getItem(this._fullKey(key));
        if (raw === null) return fallback;

        try {
            const envelope = JSON.parse(raw);

            if (envelope.version !== SCHEMA_VERSION) {
                console.warn(`[Storage] Discarding "${key}": saved with schema v${envelope.version}, this build expects v${SCHEMA_VERSION}.`);
                return fallback;
            }

            return envelope.data;
        } catch (e) {
            console.warn(`[Storage] Corrupt payload for "${key}", falling back to defaults.`, e);
            return fallback;
        }
    }

    /**
     * Reports when a slot was last written, for UI status text.
     * @returns {Promise<string|null>} ISO timestamp, or null if absent.
     */
    async savedAt(key) {
        if (!this.available) return null;

        const raw = window.localStorage.getItem(this._fullKey(key));
        if (raw === null) return null;

        try {
            return JSON.parse(raw).savedAt || null;
        } catch (e) {
            return null;
        }
    }

    async has(key) {
        if (!this.available) return false;
        return window.localStorage.getItem(this._fullKey(key)) !== null;
    }

    async remove(key) {
        if (!this.available) return false;
        window.localStorage.removeItem(this._fullKey(key));
        return true;
    }

    /** Drops every key in this namespace, leaving other origins' data alone. */
    async clear() {
        if (!this.available) return false;

        const prefix = `${this.namespace}:`;
        const doomed = [];

        for (let i = 0; i < window.localStorage.length; i++) {
            const key = window.localStorage.key(i);
            if (key && key.startsWith(prefix)) doomed.push(key);
        }

        doomed.forEach(key => window.localStorage.removeItem(key));
        return true;
    }

    /**
     * Approximate bytes used by this namespace. Useful for warning before the
     * quota wall is hit.
     * @returns {Promise<number>}
     */
    async usageBytes() {
        if (!this.available) return 0;

        const prefix = `${this.namespace}:`;
        let total = 0;

        for (let i = 0; i < window.localStorage.length; i++) {
            const key = window.localStorage.key(i);
            if (key && key.startsWith(prefix)) {
                total += key.length + (window.localStorage.getItem(key) || '').length;
            }
        }

        return total;
    }
}
