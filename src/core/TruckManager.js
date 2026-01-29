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

        // Spawn Location: "Via della Superba" entry point (approximate)
        // This coordinates should align with the start of the manual road network in app.js
        truck.position = { lat: 44.407500, lng: 8.907500 };

        this.trucks.push(truck);
        console.log(`[TruckManager] Truck ${id} (${plate}) spawned at ENTRY. Heading to OCR.`);

        return truck;
    }

    update(dt) {
        // Main Loop: Process state transitions
        this.trucks.forEach(t => {
            if (t.status === TruckStatus.DEPARTED) return;

            // 1. INBOUND -> OCR
            if (t.status === TruckStatus.INBOUND) {
                const dist = this.geoManager._distanceMeters(t.position, this.geoManager.getZoneCenter('OCR_GATE'));
                if (dist < 10) {
                    this.handleOCRArrival(t);
                }
            }

            // 2. GATE_QUEUE -> GATE_IN
            if (t.status === TruckStatus.GATE_QUEUE) {
                const dist = this.geoManager._distanceMeters(t.position, this.geoManager.getZoneCenter('GATE_IN'));
                if (dist < 10) {
                    this.handleGateArrival(t);
                }
            }

            // 3. TO_YARD -> Destination (WAITING_CAMION or specific Stack)
            if (t.status === TruckStatus.TO_YARD && t.targetZone) {
                const target = this.geoManager.getZoneCenter(t.targetZone);
                if (target) {
                    const dist = this.geoManager._distanceMeters(t.position, target);
                    if (dist < 10) {
                        this.handleYardArrival(t);
                    }
                }
            }

            // 4. SERVICING -> WAIT FOR JOB COMPLETION
            if (t.status === TruckStatus.SERVICING) {
                if (t.assignedJobId) {
                    const job = this.jobManager.jobs.find(j => j.id === t.assignedJobId);
                    if (job && job.status === 'COMPLETED') {
                        console.log(`[Yard] Service Finished for ${t.plate}. Proceeding to EXIT.`);

                        // FLIP LOGIC: If dropping export, now empty. If picking import, now has container.
                        if (t.missionType === 'DROP_EXPORT') t.containerId = null;

                        t.status = TruckStatus.EXITING;
                        t.targetZone = 'GATE_OUT';
                    }
                }
            }

            // 5. EXITING -> GATE_OUT
            if (t.status === TruckStatus.EXITING) {
                const dist = this.geoManager._distanceMeters(t.position, this.geoManager.getZoneCenter('GATE_OUT'));
                if (dist < 10) {
                    this.handleGateExit(t);
                }
            }
        });
    }

    handleYardArrival(truck) {
        if (truck.status === TruckStatus.SERVICING) return;

        truck.status = TruckStatus.SERVICING;
        console.log(`[Yard] Truck ${truck.plate} arrived at ${truck.targetZone}. Waiting for Service...`);

        // Trigger Job Creation?
        // Actually Job was created at Gate, or we create it here?
        // Best practice: Job Created at Gate, but Fleet Assignment might happen now or earlier.
        // Let's create/assign here to ensure proximity check works based on truck position?
        // Or re-trigger.

        // We created it at Gate. Check handleGateArrival.
        // If we didn't assign yet, do it now. Or force re-assign.
    }

    handleOCRArrival(truck) {
        if (truck.status === TruckStatus.OCR_PROCESS) return;
        truck.status = TruckStatus.OCR_PROCESS;
        console.log(`[OCR] Scanning ${truck.plate}... Container: ${truck.containerId || 'None'}`);

        setTimeout(() => {
            truck.status = TruckStatus.GATE_QUEUE;
            truck.targetZone = 'GATE_IN';
            console.log(`[OCR] Scan Complete. Proceed to Main Gate.`);
        }, this.ocrProcessingTimeMs);
    }

    handleGateArrival(truck) {
        if (truck.status === TruckStatus.GATE_CHECK) return;
        truck.status = TruckStatus.GATE_CHECK;
        console.log(`[Gate] Checking paperwork for ${truck.plate} (5s wait)...`);

        setTimeout(() => {
            // Assign Mission & Create Job
            let jobType = 'TRUCK_EXPORT'; // Default
            let targetZone = 'WAITING_CAMION';

            if (truck.missionType === 'DROP_EXPORT') {
                targetZone = 'WAITING_CAMION';
                jobType = 'TRUCK_EXPORT';
            }
            // else if import...

            truck.targetZone = targetZone;

            // Create Job
            const job = this.jobManager.createJob(jobType, truck.containerId, targetZone, 'YARD');
            truck.assignedJobId = job.id;

            // Try to assign immediately
            this.jobManager.assignJobToNearestVehicle(job.id);

            truck.status = TruckStatus.TO_YARD;
            console.log(`[Gate] Access Granted. Proceed to ${truck.targetZone}. Job ${job.id} created.`);

        }, 5000); // 5s wait
    }

    handleGateExit(truck) {
        if (truck.isExitingGate) return; // Debounce
        truck.isExitingGate = true;

        console.log(`[Gate OUT] Checking ${truck.plate} out (3s wait)...`);

        setTimeout(() => {
            truck.status = TruckStatus.DEPARTED;
            truck.targetZone = null;
            console.log(`[Gate OUT] Truck ${truck.plate} DEPARTED towards Genova Ovest.`);

            // Remove from list or keep as history? 
            // For MVP keep but mark departed.
        }, 3000);
    }

    getTrucks() {
        return this.trucks;
    }
}
