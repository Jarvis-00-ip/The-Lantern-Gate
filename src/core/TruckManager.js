export const TruckStatus = {
    INBOUND: 'Inbound',
    OCR_PROCESS: 'OCR Scan',
    GATE_QUEUE: 'Gate Queue',
    GATE_CHECK: 'Gate Check',
    TO_YARD: 'To Yard',
    SERVICING: 'Servicing', // Loading/Unloading
    EXITING: 'Exiting',
    DEPARTED: 'Departed'
};

export class Truck {
    constructor(id, plate, containerId, missionType) {
        this.id = id;
        this.plate = plate;
        this.containerId = containerId; // null if picking up
        this.missionType = missionType; // 'DROP_EXPORT' or 'PICK_IMPORT'
        this.status = TruckStatus.INBOUND;
        this.position = { lat: 0, lng: 0 };
        this.targetZone = 'OCR_GATE'; // First stop
        this.assignedJobId = null;
    }
}

export class TruckManager {
    constructor(geoManager, jobManager, yardManager) {
        this.geoManager = geoManager;
        this.jobManager = jobManager;
        this.yardManager = yardManager;
        this.trucks = [];

        // Settings
        this.gateProcessingTimeMs = 10000; // 10 seconds
        this.ocrProcessingTimeMs = 2000;   // 2 seconds fast scan
    }

    spawnTruck(missionType = 'DROP_EXPORT') {
        const id = `TRK-${Math.floor(Math.random() * 9000) + 1000}`;
        const plate = `AB${Math.floor(Math.random() * 900) + 100}CD`;
        const containerId = missionType === 'DROP_EXPORT' ? `CN${Math.floor(Math.random() * 100000)}` : null;

        const truck = new Truck(id, plate, containerId, missionType);

        // Spawn Location: Just "West" of OCR Gate for MVP
        // In real nav, use a road entry point.
        const ocrCenter = this.geoManager.getZoneCenter('OCR_GATE');
        truck.position = { lat: ocrCenter.lat + 0.002, lng: ocrCenter.lng }; // Spawn slightly north/west

        this.trucks.push(truck);
        console.log(`[TruckManager] Truck ${id} (${plate}) spawned. Heading to OCR.`);

        return truck;
    }

    update(dt) {
        // Main Loop: Process state transitions
        this.trucks.forEach(t => {
            if (t.status === TruckStatus.DEPARTED) return;

            // 1. INBOUND -> OCR
            if (t.status === TruckStatus.INBOUND) {
                // Determine movement to OCR... (Simulated by UI layer usually, logic here handles state)
                // If "arrived" at OCR:
                const dist = this.geoManager._distanceMeters(t.position, this.geoManager.getZoneCenter('OCR_GATE'));
                if (dist < 10) {
                    this.handleOCRArrival(t);
                }
            }
        });
    }

    handleOCRArrival(truck) {
        truck.status = TruckStatus.OCR_PROCESS;
        console.log(`[OCR] Scanning ${truck.plate}... Container: ${truck.containerId || 'None'}`);

        setTimeout(() => {
            truck.status = TruckStatus.GATE_QUEUE;
            truck.targetZone = 'GATE_IN';
            console.log(`[OCR] Scan Complete. Proceed to Main Gate.`);

            // Trigger "Pre-Notification" to TOS?
            // "Truck AB123 has arrived for Export Drop".
            // TOS calculates position.
        }, this.ocrProcessingTimeMs);
    }

    handleGateArrival(truck) {
        truck.status = TruckStatus.GATE_CHECK;
        console.log(`[Gate] Checking paperwork for ${truck.plate} (10s wait)...`);

        setTimeout(() => {
            // Assign Mission
            // If Export: Where to put it?
            if (truck.missionType === 'DROP_EXPORT') {
                // Logic: Find Stack for Export
                // For MVP: Send to WAITING_CAMION or specific Stack
                truck.targetZone = 'WAITING_CAMION'; // Generic buffer
            }

            truck.status = TruckStatus.TO_YARD;
            console.log(`[Gate] Access Granted. Proceed to ${truck.targetZone}.`);

            // Create Job for Fleet (Reach Stacker needs to come here)
            // But actually, for Drop, the TRUCK goes to the stack, and RS lifts it off.
            // So logic needs coordination.
        }, this.gateProcessingTimeMs);
    }

    getTrucks() {
        return this.trucks;
    }
}
