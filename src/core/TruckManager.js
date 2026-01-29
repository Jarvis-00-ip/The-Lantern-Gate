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
        this.targetContainerId = null; // For Imports, what are we fetching?
    }
}

export class TruckManager {
    constructor(geoManager, jobManager, yardManager) {
        this.geoManager = geoManager;
        this.jobManager = jobManager;
        this.yardManager = yardManager;
        this.trucks = [];

        // Export Queues (Containers waiting for Pickup)
        // In a real system, these would come from Booking api.
        this.exportQueues = {
            TRUCK: [], // List of Container IDs available for pickup by trucks
            TRAIN: [],
            VESSEL: []
        };

        // Settings
        this.gateProcessingTimeMs = 2000; // 2 seconds (was 5s)
        this.ocrProcessingTimeMs = 1000;   // 1 second (was 2s)
    }

    /**
     * Attempts to spawn a truck.
     * Logic:
     * - Randomly decide if DROP (Export) or PICK (Import).
     * - If PICK, check if there are containers in exportQueues.TRUCK.
     * - If Queue empty, force DROP.
     */
    spawnTruck() {
        // 0. Safety Check: Is Entry Clear?
        const entryPoint = { lat: 44.407500, lng: 8.907500 };
        const blocked = this.trucks.some(t => {
            const dist = this.geoManager._distanceMeters(t.position, entryPoint);
            return dist < 40; // Maintain 40m clear at entry
        });

        if (blocked) {
            console.log("[TruckManager] Entry blocked. Delaying spawn.");
            return null;
        }

        // 1. Decide Mission
        let missionType = 'DROP_EXPORT';
        let containerId = null;
        let targetContainerId = null;

        // 40% chance of PICK if there is cargo
        if (this.exportQueues.TRUCK.length > 0 && Math.random() < 0.4) {
            missionType = 'PICK_IMPORT';
            // Pop from queue
            targetContainerId = this.exportQueues.TRUCK.shift();
            console.log(`[TruckManager] Spawning Truck to PICK UP ${targetContainerId}`);
        } else {
            missionType = 'DROP_EXPORT';
            containerId = `CN${Math.floor(Math.random() * 100000)}`;
        }

        const id = `TRK-${Math.floor(Math.random() * 9000) + 1000}`;
        const plate = `AB${Math.floor(Math.random() * 900) + 100}CD`;

        const truck = new Truck(id, plate, containerId, missionType);
        if (missionType === 'PICK_IMPORT') {
            truck.targetContainerId = targetContainerId;
        }

        // Spawn Location: "Via della Superba"
        // LANE RANDOMIZATION: Add slight offset to lat/lng to simulate lanes
        // Base: 44.407500, 8.907500
        // Offset: +/- 0.000020 deg (~2m)
        const laneOffsetLat = (Math.random() * 0.000050) - 0.000025;
        const laneOffsetLng = (Math.random() * 0.000050) - 0.000025;

        truck.position = {
            lat: 44.407500 + laneOffsetLat,
            lng: 8.907500 + laneOffsetLng
        };

        this.trucks.push(truck);
        console.log(`[TruckManager] Truck ${id} (${plate}) spawned. Mission: ${missionType}.`);

        return truck;
    }

    update(dt) {
        // Main Loop: Process state transitions
        this.trucks.forEach(t => {
            if (t.status === TruckStatus.DEPARTED) return;

            // --- COLLISION AVOIDANCE (Basic Queueing) ---
            // Check if any *other* truck is ahead and close
            let tooClose = false;
            // Simple check: Find any truck within 15m
            for (const other of this.trucks) {
                if (other.id !== t.id && other.status !== TruckStatus.DEPARTED) {
                    const dist = this.geoManager._distanceMeters(t.position, other.position);
                    if (dist < 12) {
                        // Rough logic: Determine who is "ahead".
                        // For Inbound: Closer to GATE_IN is ahead.
                        // For Exit: Closer to GATE_OUT is ahead.
                        // Simplest: If they are this close, just PAUSE. 
                        // But we need to avoid deadlock. The one "behind" should pause.
                        // We assume Inbound flow is North->South (lat decreases). 
                        // Or we check distance to Target Zone.

                        let myDistToTarget = Infinity;
                        let otherDistToTarget = Infinity;

                        // Shared Target?
                        if (t.targetZone) {
                            const zoneCenter = this.geoManager.getZoneCenter(t.targetZone);
                            if (zoneCenter) {
                                myDistToTarget = this.geoManager._distanceMeters(t.position, zoneCenter);
                                otherDistToTarget = this.geoManager._distanceMeters(other.position, zoneCenter);
                            }
                        }

                        // If I am further from target than him, I pause.
                        if (myDistToTarget > otherDistToTarget) {
                            tooClose = true;
                            break;
                        }
                    }
                }
            }

            t.isPaused = tooClose; // Flag for Render/Movement logic (needs to be respected by App.js)
            if (tooClose) {
                // If paused, we don't process arrival triggers generally, 
                // BUT we usually don't move the position here anyway (App.js pathfinder does).
                // However, State Transitions (Arrivals) logic below depends on position.
                // If App.js sees 'isPaused', it shouldn't move. 
                // So position stays same, so loop logic below is safe (won't trigger arrival instantly).
                return;
            }

            // 1. INBOUND -> OCR
            if (t.status === TruckStatus.INBOUND) {
                const dist = this.geoManager._distanceMeters(t.position, this.geoManager.getZoneCenter('OCR_GATE'));
                if (dist < 25) { // Widened to ensure trigger
                    this.handleOCRArrival(t);
                }
            }

            // 2. GATE_QUEUE -> GATE_IN
            if (t.status === TruckStatus.GATE_QUEUE) {
                const dist = this.geoManager._distanceMeters(t.position, this.geoManager.getZoneCenter('GATE_IN'));
                if (dist < 25) { // Widened
                    this.handleGateArrival(t);
                }
            }

            // 3. TO_YARD -> Destination (WAITING_CAMION or specific Stack)
            if (t.status === TruckStatus.TO_YARD && t.targetZone) {
                const target = this.geoManager.getZoneCenter(t.targetZone);
                if (target) {
                    const dist = this.geoManager._distanceMeters(t.position, target);
                    if (dist < 25) { // Widened
                        this.handleYardArrival(t);
                    }
                }
            }

            // 4. SERVICING -> WAIT FOR JOB COMPLETION
            if (t.status === TruckStatus.SERVICING) {
                if (t.assignedJobId) {
                    const job = this.jobManager.jobs.find(j => j.id === t.assignedJobId);

                    // IF JOB COMPLETED
                    if (job && job.status === 'COMPLETED') {
                        console.log(`[Yard] Service Finished for ${t.plate}. Proceeding to EXIT.`);

                        // LOGIC UPDATE: Handle Payload Changes
                        if (t.missionType === 'DROP_EXPORT') {
                            // Container Dropped
                            // Add to IMPORT QUEUE (Simulating it becomes an import for someone else later? 
                            // Or simpler: We just add *some* logic to fill queues.
                            // Let's say: 50% chance this container stays for a Ship, 
                            // 50% chance it is for a Truck Import (e.g. transshipment or return).
                            // For Demo: Add to Truck Queue to sustain loop.
                            if (t.containerId) {
                                this.exportQueues.TRUCK.push(t.containerId);
                                console.log(`[Logic] Container ${t.containerId} added to TRUCK IMPORT QUEUE.`);
                            }
                            t.containerId = null;
                        } else if (t.missionType === 'PICK_IMPORT') {
                            // Container Picked Up
                            t.containerId = t.targetContainerId;
                            t.targetContainerId = null;
                        }

                        t.status = TruckStatus.EXITING;
                        t.targetZone = 'GATE_OUT';
                    }
                }
            }

            // 5. EXITING -> GATE_OUT
            if (t.status === TruckStatus.EXITING) {
                const dist = this.geoManager._distanceMeters(t.position, this.geoManager.getZoneCenter('GATE_OUT'));
                if (dist < 25) { // Widened
                    this.handleGateExit(t);
                }
            }
        });
    }

    handleYardArrival(truck) {
        if (truck.status === TruckStatus.SERVICING) return;

        console.log(`[Yard] Truck ${truck.plate} arrived at ${truck.targetZone}. Waiting for Service...`);
        truck.status = TruckStatus.SERVICING;

        // Note: Job was created at Gate.
        // We ensure the system knows we are ready.
        // In a real system, we might update the job status to 'TRUCK_READY'.
    }

    handleOCRArrival(truck) {
        if (truck.status === TruckStatus.OCR_PROCESS) return;
        truck.status = TruckStatus.OCR_PROCESS;
        console.log(`[OCR] Scanning ${truck.plate}...`);

        setTimeout(() => {
            try {
                truck.status = TruckStatus.GATE_QUEUE;
                truck.targetZone = 'GATE_IN';
                console.log(`[OCR] Scan Complete for ${truck.plate}. Proceeding to Gate Queue.`);
            } catch (e) { console.error("OCR Timeout Error", e); }
        }, this.ocrProcessingTimeMs);
    }

    handleGateArrival(truck) {
        if (truck.status === TruckStatus.GATE_CHECK) return;
        truck.status = TruckStatus.GATE_CHECK;
        console.log(`[Gate] Checking paperwork for ${truck.plate} (${truck.missionType})...`);

        setTimeout(() => {
            try {
                // Assign Mission & Create Job
                let jobType = 'TRUCK_EXPORT'; // Default: Truck drops export
                let targetZone = 'WAITING_CAMION';

                if (truck.missionType === 'DROP_EXPORT') {
                    targetZone = 'WAITING_CAMION'; // Place to drop
                    jobType = 'TRUCK_EXPORT';
                } else {
                    // Picking up Import
                    targetZone = 'WAITING_CAMION'; // Place to pick up (simplification)
                    // ideally we guide truck to the specific stack? 
                    // For MVP, trucks go to Transfer Zone 'WAITING_CAMION' and Straddle brings container there.
                    jobType = 'TRUCK_IMPORT';
                }

                truck.targetZone = targetZone;

                // Create Job
                // For DROP: Source = Truck, Target = Yard
                // For PICK: Source = Yard, Target = Truck
                // BUT: JobManager creates job.

                // Note on Job Creation: 
                // If PICK, we need to know WHERE the container is?
                // The YardManager should support finding it. 
                // For now, we just say 'YARD' as source/target abstraction.

                const containerId = truck.missionType === 'DROP_EXPORT' ? truck.containerId : truck.targetContainerId;

                const job = this.jobManager.createJob(jobType, containerId, targetZone, 'YARD');
                truck.assignedJobId = job.id;

                // Try to assign immediately
                this.jobManager.assignJobToNearestVehicle(job.id);

                truck.status = TruckStatus.TO_YARD;
                console.log(`[Gate] Access Granted. Proceed to ${truck.targetZone}. Job ${job.id} created.`);
            } catch (err) {
                console.error("[TruckManager] Gate Processing Error:", err);
                // Fallback to release truck so it doesn't get stuck
                truck.status = TruckStatus.TO_YARD;
                truck.targetZone = 'WAITING_CAMION';
            }
        }, this.gateProcessingTimeMs);
    }

    handleGateExit(truck) {
        if (truck.isExitingGate) return; // Debounce
        truck.isExitingGate = true;

        console.log(`[Gate OUT] Checking ${truck.plate} out...`);

        setTimeout(() => {
            truck.status = TruckStatus.DEPARTED;
            truck.targetZone = null;
            console.log(`[Gate OUT] Truck ${truck.plate} DEPARTED.`);
        }, 3000);
    }

    getTrucks() {
        return this.trucks;
    }
}
