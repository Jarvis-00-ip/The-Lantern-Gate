export class VesselCall {
    constructor(id, name, eta, etd) {
        this.id = id;
        this.name = name;
        this.eta = eta; // Date object
        this.etd = etd; // Date object (Deadline)
        // INBOUND (scheduled, not yet sailing) -> APPROACHING (sailing to its
        // berth) -> BERTHED (working the manifest) -> DEPARTING (sailing out)
        // -> DEPARTED. The physical states are driven by VesselOpsManager;
        // this class only holds the data.
        this.status = 'INBOUND';
        this.manifest = {
            discharge: [], // List of Container IDs to unload
            load: []       // List of Container IDs to load
        };
        this.penaltyPerHour = 1000; // Mock currency
        this.position = null; // {lat, lng, rotation} — set once it starts sailing in
    }

    addManifestItem(type, containerId) {
        if (type === 'DISCHARGE') {
            this.manifest.discharge.push(containerId);
        } else if (type === 'LOAD') {
            this.manifest.load.push(containerId);
        }
    }
}

let vesselCounter = 0;

export class VesselManager {
    constructor() {
        this.vessels = [];
        this.activeVessel = null; // Currently worked vessel
    }

    scheduleVessel(name, etaSeconds, durationSeconds) {
        const now = new Date();
        const eta = new Date(now.getTime() + etaSeconds * 1000);
        const etd = new Date(eta.getTime() + durationSeconds * 1000);

        // Date.now() alone collides when two vessels are scheduled inside the
        // same millisecond (a real risk: two quick clicks on the menu, or a
        // tight test loop) — every other id-generating manager in this
        // codebase (TranstainerManager's jobCounter) already learned this.
        const id = `VSL-${Date.now()}-${vesselCounter++}`;
        const vessel = new VesselCall(id, name, eta, etd);

        this.vessels.push(vessel);
        console.log(`[VesselManager] Scheduled ${name} (ETA: ${eta.toLocaleTimeString()}, ETD: ${etd.toLocaleTimeString()})`);

        return vessel;
    }

    berthVessel(vesselId) {
        const v = this.vessels.find(x => x.id === vesselId);
        // APPROACHING covers the normal path (VesselOpsManager moves it to its
        // berth first); INBOUND is kept for callers that berth directly
        // without a physical sailing-in phase.
        if (v && (v.status === 'INBOUND' || v.status === 'APPROACHING')) {
            v.status = 'BERTHED';
            this.activeVessel = v;
            console.log(`[VesselManager] ${v.name} is now Berthed.`);
            return true;
        }
        return false;
    }

    getPenalty(vesselId) {
        const v = this.vessels.find(x => x.id === vesselId);
        if (!v) return 0;

        const now = new Date();
        if (now > v.etd && v.status !== 'DEPARTED') {
            const hoursLate = (now - v.etd) / (1000 * 60 * 60);
            return Math.ceil(hoursLate * v.penaltyPerHour);
        }
        return 0;
    }
}
