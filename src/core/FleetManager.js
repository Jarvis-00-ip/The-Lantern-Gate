export const VehicleStatus = {
    IDLE: 'Idle',
    ACTIVE: 'Active',
    MAINTENANCE: 'Maintenance'
};

export const VehicleType = {
    RALLA: 'Ralla', // Terminal Tractor
    REACH_STACKER: 'Reach Stacker',
    STRADDLE_CARRIER: 'Straddle Carrier'
};

export class Vehicle {
    constructor(id, type) {
        this.id = id;
        this.type = type;
        this.status = VehicleStatus.IDLE;
        this.currentZone = 'DEPOT_RALLE'; // Default location
        this.assignedBlock = null; // e.g., 'BLOCK_A'
    }
}

export class FleetManager {
    constructor() {
        this.vehicles = [];
        this.initMockFleet();
    }

    initMockFleet() {
        // Create some initial vehicles
        for (let i = 1; i <= 5; i++) {
            this.vehicles.push(new Vehicle(`R-${100 + i}`, VehicleType.RALLA));
        }
        for (let i = 1; i <= 2; i++) {
            this.vehicles.push(new Vehicle(`RS-${20 + i}`, VehicleType.REACH_STACKER));
        }
    }

    getVehicles() {
        return this.vehicles;
    }

    getVehicle(id) {
        return this.vehicles.find(v => v.id === id);
    }

    deployVehicle(id, targetZone) {
        const v = this.getVehicle(id);
        if (v) {
            v.status = VehicleStatus.ACTIVE;
            v.currentZone = targetZone;
            return true;
        }
        return false;
    }

    assignToBlock(id, blockId) {
        const v = this.getVehicle(id);
        if (v) {
            v.assignedBlock = blockId;
            return true;
        }
        return false;
    }

    recallVehicle(id) {
        const v = this.getVehicle(id);
        if (v) {
            v.status = VehicleStatus.IDLE;
            v.currentZone = 'DEPOT_RALLE';
            v.assignedBlock = null;
            return true;
        }
        return false;
    }
}
