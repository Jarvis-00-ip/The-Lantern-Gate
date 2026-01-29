export class VesselCall {
    constructor(id, name, eta, etd) {
        this.id = id;
        this.name = name;
        this.eta = eta; // Date object
        this.etd = etd; // Date object (Deadline)
        this.status = 'INBOUND'; // INBOUND, BERTHED, COMPLETED, DEPARTED
        this.manifest = {
            discharge: [], // List of Container IDs to unload
            load: []       // List of Container IDs to load
        };
        this.penaltyPerHour = 1000; // Mock currency
    }

    addManifestItem(type, containerId) {
        if (type === 'DISCHARGE') {
            this.manifest.discharge.push(containerId);
        } else if (type === 'LOAD') {
            this.manifest.load.push(containerId);
        }
    }
}

export class VesselManager {
    constructor() {
        this.vessels = [];
        this.activeVessel = null; // Currently worked vessel
    }

    scheduleVessel(name, etaSeconds, durationSeconds) {
        const now = new Date();
        const eta = new Date(now.getTime() + etaSeconds * 1000);
        const etd = new Date(eta.getTime() + durationSeconds * 1000);

        const id = `VSL-${Date.now()}`;
        const vessel = new VesselCall(id, name, eta, etd);

        this.vessels.push(vessel);
        console.log(`[VesselManager] Scheduled ${name} (ETA: ${eta.toLocaleTimeString()}, ETD: ${etd.toLocaleTimeString()})`);

        return vessel;
    }

    berthVessel(vesselId) {
        const v = this.vessels.find(x => x.id === vesselId);
        if (v && v.status === 'INBOUND') {
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
