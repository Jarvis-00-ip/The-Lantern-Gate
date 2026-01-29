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
        this.deployedZone = 'DEPOT_RALLE'; // Home base for return
        this.assignedBlock = null; // e.g., 'BLOCK_A'
        this.position = { x: 0, y: 0, rotation: 0 };
    }
}

export class FleetManager {
    constructor() {
        this.vehicles = [];
        this.initMockFleet();
    }

    initMockFleet() {
        // Create some initial vehicles
        // 25 Ralle (Terminal Tractors)
        for (let i = 1; i <= 25; i++) {
            this.vehicles.push(new Vehicle(`R-${100 + i}`, VehicleType.RALLA));
        }
        // 25 Reach Stackers
        for (let i = 1; i <= 25; i++) {
            this.vehicles.push(new Vehicle(`RS-${200 + i}`, VehicleType.REACH_STACKER));
        }
    }

    getVehicles() {
        return this.vehicles;
    }

    getVehicle(id) {
        return this.vehicles.find(v => v.id === id);
    }

    /**
     * Deploys a vehicle to a specific zone if allowed.
     * @param {string} id - Vehicle ID
     * @param {string} targetZoneId - Target Zone ID (e.g. "QUAY")
     * @param {Object} geoManager - Instance of GeoManager
     */
    deployVehicle(id, targetZoneId, geoManager) {
        const v = this.getVehicle(id);
        if (!v) {
            console.error(`Vehicle ${id} not found.`);
            return false;
        }

        // 1. Find Zone by ID (geoManager.zones has objects with id and type)
        const zoneObj = geoManager.getZones().find(z => z.id === targetZoneId);

        if (!zoneObj) {
            console.error(`Zone ${targetZoneId} not found.`);
            return false;
        }

        // 2. Validate Vehicle Compatibility
        if (!this._isZoneAllowedForVehicle(v.type, zoneObj.type)) {
            console.error(`Vehicle ${v.type} cannot operate in ${zoneObj.type}`);
            return false;
        }

        // 3. Assign Position (Geospatial)
        const position = geoManager.getRandomPointInZone(targetZoneId);
        if (!position) {
            console.error(`Could not find valid position in ${targetZoneId}`);
            return false;
        }

        v.status = VehicleStatus.ACTIVE;
        v.currentZone = targetZoneId;
        v.deployedZone = targetZoneId; // Save as Home
        v.position = {
            lat: position.lat,
            lng: position.lng,
            rotation: Math.random() * 360
        };

        return true;
    }

    _isZoneAllowedForVehicle(vehicleType, zoneType) {
        const rules = {
            [VehicleType.RALLA]: ['QUAY', 'ROAD', 'GATE', 'CONCRETE_PAD', 'LOADING', 'DEPOT'],
            [VehicleType.REACH_STACKER]: ['YARD', 'CONCRETE_PAD', 'ROAD', 'LOADING', 'DEPOT', 'STANDARD', 'REEFER', 'IMO', 'DAMAGED'],
            [VehicleType.STRADDLE_CARRIER]: ['YARD', 'CONCRETE_PAD', 'ROAD', 'LOADING', 'DEPOT', 'STANDARD', 'REEFER', 'IMO', 'DAMAGED']
        };

        // If generic type provided in rules
        const allowed = rules[vehicleType] || [];
        return allowed.includes(zoneType);
    }

    calculateTravelTime(vehicleId, targetZoneId, geoManager) {
        const v = this.getVehicle(vehicleId);
        if (!v) return 0;

        let startPos = v.position;
        // If no position (Idle/Initial), assume Depot Ralle center
        if (!startPos || (startPos.lat === 0 && startPos.lng === 0)) {
            startPos = geoManager.getZoneCenter('DEPOT_RALLE');
        }
        if (!startPos) return 0;

        const targetCenter = geoManager.getZoneCenter(targetZoneId);
        if (!targetCenter) return 0;

        const distMeters = geoManager._distanceMeters(startPos, targetCenter);
        const speedMps = 8.33; // ~30 km/h

        return Math.ceil(distMeters / speedMps);
    }

    updateVehiclePosition(id, lat, lng, rotation = 0) {
        const v = this.getVehicle(id);
        if (v) {
            v.position = { lat, lng, rotation };
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

    findNearestVehicle(type, targetPos, geoManager) {
        // Updated: Allow 'Active' vehicles if they don't have a job (Manually deployed vehicles)
        const candidates = this.vehicles.filter(v =>
            v.type === type &&
            (v.status === VehicleStatus.IDLE || (v.status === VehicleStatus.ACTIVE && !v.currentJobId))
        );

        let nearest = null;
        let minTime = Infinity;

        candidates.forEach(v => {
            let startPos = v.position;
            // Handle idle vehicles at zero coords
            if (!startPos || (startPos.lat === 0 && startPos.lng === 0)) {
                // If we don't know where they are, assume Depot Ralle
                const depot = geoManager.getZoneCenter('DEPOT_RALLE');
                if (depot) startPos = depot;
                else return;
            }

            const dist = geoManager._distanceMeters(startPos, targetPos);
            if (dist < minTime) {
                minTime = dist;
                nearest = v;
            }
        });

        return nearest;
    }

    recallVehicle(id) {
        const v = this.getVehicle(id);
        if (v) {
            v.status = VehicleStatus.IDLE;
            v.currentZone = 'DEPOT_RALLE';
            v.assignedBlock = null;
            v.position = { x: 0, y: 0, rotation: 0 }; // Reset
            return true;
        }
        return false;
    }
}
