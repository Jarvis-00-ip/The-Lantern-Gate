import { YARD_BLOCKS } from './TranstainerManager.js';

/**
 * The Lantern Gate - Vessel Operations Manager
 *
 * Physical arrival/departure of ships, plus the link between a vessel's
 * manifest (VesselManager, so far pure data) and the yard-side machinery
 * already built (TranstainerManager: reach stacker + Ralla choreography).
 *
 * The quay crane itself (the machine that actually lifts a container between
 * ship and quay) is deliberately NOT modelled as a moving vehicle — that was
 * explicitly deferred. Its work is abstracted as a fixed-duration "crane
 * cycle" timer, the same pattern TranstainerManager already uses for
 * RS_PICKING/DOCKING: no dedicated animation, just a wait before the state
 * advances. One cycle at a time per vessel (one crane working each ship),
 * which keeps the whole thing a simple sequential state machine.
 *
 * DISCHARGE (ship -> yard): crane lifts a container off the ship (timer),
 * then a TranstainerManager IMPORT job carries it the rest of the way
 * (Ralla from the dock -> target block -> reach stacker stacks it).
 *
 * LOAD (yard -> ship): a TranstainerManager EXPORT job carries a container
 * from a yard block to the dock (reach stacker -> Ralla), then once that job
 * completes the crane lifts it aboard (timer).
 *
 * Movement is plain point-to-point interpolation over open water — ships do
 * not use the road/pathfinding network trucks and yard vehicles do, so this
 * manager owns its own position updates directly (GeoManager.bearing keeps
 * the icon pointed the right way) rather than leaving movement to the
 * renderer the way vehicle-on-zone movement does.
 */

export const VesselOpStatus = {
    INBOUND: 'INBOUND',
    APPROACHING: 'APPROACHING',
    BERTHED: 'BERTHED',
    DEPARTING: 'DEPARTING',
    DEPARTED: 'DEPARTED'
};

const SHIP_NAMES = ['MSC Aurora', 'CMA Bellissima', 'Maersk Cortez', 'Cosco Divina', 'Evergreen Faro'];

export class VesselOpsManager {
    constructor(geoManager, vesselManager, transtainerManager) {
        this.geoManager = geoManager;
        this.vesselManager = vesselManager;
        this.transtainerManager = transtainerManager;

        const berthCount = 4;
        this.berths = Array.from({ length: berthCount }, (_, i) => ({
            id: `BERTH-${i + 1}`,
            position: geoManager.getParkingSlot('QUAY', i, berthCount),
            vesselId: null
        }));

        // A shared point off the quay every ship sails through on the way
        // in/out — same idea as trucks sharing a drawn route before peeling
        // off to an individual slot.
        this.seaAnchor = this._computeSeaAnchor();

        this.speedMps = 4;          // ~7.8 knots, a plausible harbour speed
        this.craneCycleMs = 4000;   // one abstracted quay-crane lift
        this.minBerthMs = 6000;     // stay docked a moment even with an empty manifest

        this._state = new Map(); // vesselId -> runtime state (berth, indices, timers)
    }

    /** A point beyond the quay, opposite the yard — a stand-in for open water. */
    _computeSeaAnchor() {
        const quayCentre = this.geoManager.getZoneCenter('QUAY');
        const yardCentre = this.geoManager.getZoneCenter('DEPOT_RALLE') || this.geoManager.getZoneCenter('BLOCK_A');
        if (!quayCentre) return null;
        if (!yardCentre) return quayCentre;
        return this._extendPoint(yardCentre, quayCentre, 350);
    }

    /** Continues past `through` in the direction from `from`, by `meters`. */
    _extendPoint(from, through, meters) {
        const segMeters = this.geoManager._distanceMeters(from, through) || 1;
        const dLat = through.lat - from.lat;
        const dLng = through.lng - from.lng;
        return {
            lat: through.lat + (dLat / segMeters) * meters,
            lng: through.lng + (dLng / segMeters) * meters
        };
    }

    _freshState() {
        return {
            berthId: null, berthedAt: null,
            dischargeIndex: 0, loadIndex: 0,
            pendingImportJob: null, pendingExportJob: null,
            craneBusyUntil: null, craneJobType: null
        };
    }

    _stateFor(vessel) {
        if (!this._state.has(vessel.id)) this._state.set(vessel.id, this._freshState());
        return this._state.get(vessel.id);
    }

    // --- Public entry point ---------------------------------------------

    /**
     * Schedules a vessel with a mock manifest and lets it start sailing in
     * once a berth is free. Returns the VesselCall.
     */
    requestArrival(name = null) {
        const vesselName = name || SHIP_NAMES[Math.floor(Math.random() * SHIP_NAMES.length)];
        const vessel = this.vesselManager.scheduleVessel(vesselName, 1, 600);

        const dischargeCount = 2 + Math.floor(Math.random() * 3); // 2-4
        const loadCount = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < dischargeCount; i++) vessel.addManifestItem('DISCHARGE', `${vessel.id}-D${i}`);
        for (let i = 0; i < loadCount; i++) vessel.addManifestItem('LOAD', `${vessel.id}-L${i}`);

        console.log(`[VesselOps] ${vesselName} scheduled: ${dischargeCount} discharge, ${loadCount} load.`);
        return vessel;
    }

    // --- Main loop ---------------------------------------------------------

    update(dt) {
        this.vesselManager.vessels.forEach(vessel => this._updateVessel(vessel, dt));

        if (this.vesselManager.vessels.length > 50) {
            const active = this.vesselManager.vessels.filter(v => v.status !== 'DEPARTED');
            const departed = this.vesselManager.vessels.filter(v => v.status === 'DEPARTED').slice(-10);
            this.vesselManager.vessels = active.concat(departed);
        }
    }

    _updateVessel(vessel, dt) {
        if (vessel.status === 'DEPARTED') return;
        const state = this._stateFor(vessel);

        if (vessel.status === 'INBOUND') {
            if (new Date() < vessel.eta) return;
            const berth = this.berths.find(b => !b.vesselId);
            if (!berth) return; // wait for one to free up

            berth.vesselId = vessel.id;
            state.berthId = berth.id;
            vessel.position = { lat: this.seaAnchor.lat, lng: this.seaAnchor.lng, rotation: 0 };
            vessel.status = 'APPROACHING';
            return;
        }

        if (vessel.status === 'APPROACHING') {
            const berth = this.berths.find(b => b.id === state.berthId);
            if (this._moveToward(vessel, berth.position, dt)) {
                this.vesselManager.berthVessel(vessel.id);
                state.berthedAt = performance.now();
            }
            return;
        }

        if (vessel.status === 'BERTHED') {
            this._work(vessel, state, dt);
            return;
        }

        if (vessel.status === 'DEPARTING') {
            if (this._moveToward(vessel, this.seaAnchor, dt)) {
                vessel.status = 'DEPARTED';
                const berth = this.berths.find(b => b.id === state.berthId);
                if (berth) berth.vesselId = null;
                this._state.delete(vessel.id);
            }
        }
    }

    /** Straight-line step towards `target`; returns true once arrived. */
    _moveToward(vessel, target, dt) {
        const dist = this.geoManager._distanceMeters(vessel.position, target);
        const step = this.speedMps * dt;

        if (dist <= step || dist < 5) {
            vessel.position = { lat: target.lat, lng: target.lng, rotation: vessel.position.rotation };
            return true;
        }

        const t = step / dist;
        vessel.position = {
            lat: vessel.position.lat + (target.lat - vessel.position.lat) * t,
            lng: vessel.position.lng + (target.lng - vessel.position.lng) * t,
            rotation: this.geoManager.bearing(vessel.position, target)
        };
        return false;
    }

    /** Processes the manifest one crane cycle at a time, discharge then load. */
    _work(vessel, state, dt) {
        const now = performance.now();

        if (state.craneBusyUntil) {
            if (now < state.craneBusyUntil) return;
            this._finishCraneCycle(state);
        }

        if (state.dischargeIndex < vessel.manifest.discharge.length) {
            if (!state.pendingImportJob) {
                const containerId = vessel.manifest.discharge[state.dischargeIndex];
                const targetBlock = YARD_BLOCKS[state.dischargeIndex % YARD_BLOCKS.length];
                state.pendingImportJob = this.transtainerManager.requestImport(containerId, targetBlock);
                state.craneBusyUntil = now + this.craneCycleMs;
                state.craneJobType = 'DISCHARGE';
            }
            return;
        }

        if (state.loadIndex < vessel.manifest.load.length) {
            if (!state.pendingExportJob) {
                state.pendingExportJob = this.transtainerManager.requestExport(null);
                if (!state.pendingExportJob) { state.loadIndex++; } // nothing in the yard right now — skip this slot
                return;
            }
            if (state.pendingExportJob.phase === 'COMPLETED') {
                state.craneBusyUntil = now + this.craneCycleMs;
                state.craneJobType = 'LOAD';
            }
            return;
        }

        if (now - state.berthedAt > this.minBerthMs) {
            vessel.status = 'DEPARTING';
        }
    }

    _finishCraneCycle(state) {
        if (state.craneJobType === 'DISCHARGE') {
            state.dischargeIndex++;
            state.pendingImportJob = null;
        } else if (state.craneJobType === 'LOAD') {
            state.loadIndex++;
            state.pendingExportJob = null;
        }
        state.craneBusyUntil = null;
        state.craneJobType = null;
    }
}
