export const TruckStatus = {
    INBOUND: 'Inbound',
    OCR_PROCESS: 'OCR Scan',
    GATE_QUEUE: 'Gate Queue',
    GATE_CHECK: 'Gate Check',
    TO_YARD: 'To Yard',
    SERVICING: 'Servicing', // Loading/Unloading
    EXITING: 'Exiting',    // To Gate Out
    DEPARTING: 'Departing', // To Highway Despawn
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
        this.isPaused = false;
    }
}

export class TruckManager {
    constructor(geoManager, jobManager, yardManager) {
        this.geoManager = geoManager;
        this.jobManager = jobManager;
        this.yardManager = yardManager;
        this.trucks = [];

        // Export Queues (Containers waiting for Pickup)
        this.exportQueues = {
            TRUCK: [], // List of Container IDs available for pickup by trucks
            TRAIN: [],
            VESSEL: []
        };

        // Settings
        this.gateProcessingTimeMs = 2000;
        this.ocrProcessingTimeMs = 1000;
    }

    spawnTruck() {
        // 0. Safety Check: Is Entry Clear?
        // Use SPAWN_POINT_1
        const spawnZone = this.geoManager.getZoneCenter('SPAWN_POINT_1');
        if (!spawnZone) {
            console.error("SPAWN_POINT_1 not found!");
            return null;
        }

        const entryPoint = spawnZone;
        const blocked = this.trucks.some(t => {
            if (t.status === TruckStatus.DEPARTED) return false;
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

        // Spawn Location: SPAWN_POINT_1 with slight offset
        const laneOffsetLat = (Math.random() * 0.000050) - 0.000025;
        const laneOffsetLng = (Math.random() * 0.000050) - 0.000025;

        truck.position = {
            lat: spawnZone.lat + laneOffsetLat,
            lng: spawnZone.lng + laneOffsetLng
        };

        this.trucks.push(truck);
        console.log(`[TruckManager] Truck ${id} (${plate}) spawned at Genova Ovest. Mission: ${missionType}.`);

        return truck;
    }

    update(dt) {
        // Main Loop: Process state transitions
        this.trucks.forEach(t => {
            if (t.status === TruckStatus.DEPARTED) return;

            // --- COLLISION AVOIDANCE (Basic Queueing) ---
            let tooClose = false;

            // Optimization: Only check blockage if we are moving? 
            // Yes, checking 'ahead'.

            for (const other of this.trucks) {
                if (other.id !== t.id && other.status !== TruckStatus.DEPARTED) {
                    const dist = this.geoManager._distanceMeters(t.position, other.position);

                    // Interaction Distance
                    if (dist < 15) {
                        // Deadlock Prevention: 
                        // If I am DEPARTING (Highway) and he is also DEPARTING, 
                        // whoever is further along should move.
                        // Or simple rule: If I am behind, I wait.

                        // How to know who is behind? Distance to Target.
                        let myDist = Infinity;
                        let otherDist = Infinity;

                        if (t.targetZone && t.targetZone === other.targetZone) {
                            const target = this.geoManager.getZoneCenter(t.targetZone);
                            if (target) {
                                myDist = this.geoManager._distanceMeters(t.position, target);
                                otherDist = this.geoManager._distanceMeters(other.position, target);
                            }
                        }

                        // If I am further, I am behind.
                        if (myDist > otherDist) {
                            tooClose = true;
                            // Special Case: At 'GATE_OUT', if other is 'DEPARTED' or processed? (Filtered above)
                            break;
                        }
                    }
                }
            }

            t.isPaused = tooClose;
            if (tooClose) return;

            // 1. INBOUND -> OCR
            if (t.status === TruckStatus.INBOUND) {
                const center = this.geoManager.getZoneCenter('OCR_GATE');
                if (center) {
                    const dist = this.geoManager._distanceMeters(t.position, center);
                    if (dist < 20) this.handleOCRArrival(t);
                }
            }

            // 2. GATE_QUEUE -> GATE_IN
            if (t.status === TruckStatus.GATE_QUEUE) {
                const center = this.geoManager.getZoneCenter('GATE_IN');
                if (center) {
                    const dist = this.geoManager._distanceMeters(t.position, center);
                    if (dist < 20) this.handleGateArrival(t);
                }
            }

            // 3. TO_YARD -> Destination
            if (t.status === TruckStatus.TO_YARD && t.targetZone) {
                const target = this.geoManager.getZoneCenter(t.targetZone);
                if (target) {
                    const dist = this.geoManager._distanceMeters(t.position, target);
                    if (dist < 25) this.handleYardArrival(t);
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
                            if (t.containerId) {
                                this.exportQueues.TRUCK.push(t.containerId);
                                console.log(`[Logic] Container ${t.containerId} added to TRUCK IMPORT QUEUE.`);
                            }
                            t.containerId = null; // Visually remove
                        } else if (t.missionType === 'PICK_IMPORT') {
                            // Container Picked Up
                            t.containerId = t.targetContainerId; // Visually add
                            t.targetContainerId = null;
                        }

                        t.status = TruckStatus.EXITING;
                        t.targetZone = 'GATE_OUT';
                    }
                }
            }

            // 5. EXITING -> GATE_OUT
            if (t.status === TruckStatus.EXITING) {
                const center = this.geoManager.getZoneCenter('GATE_OUT');
                if (center) {
                    const dist = this.geoManager._distanceMeters(t.position, center);
                    if (dist < 20) this.handleGateExit(t);
                }
            }

            // 6. DEPARTING -> DESPAWN
            if (t.status === TruckStatus.DEPARTING) {
                const center = this.geoManager.getZoneCenter('DESPAWN_POINT_1');
                if (center) {
                    const dist = this.geoManager._distanceMeters(t.position, center);
                    if (dist < 20) {
                        t.status = TruckStatus.DEPARTED;
                        console.log(`[LifeCycle] Truck ${t.plate} despawned at Genova Ovest.`);
                    }
                }
            }
        });
    }

    handleYardArrival(truck) {
        if (truck.status === TruckStatus.SERVICING) return;

        console.log(`[Yard] Truck ${truck.plate} arrived at ${truck.targetZone}. Waiting for Service...`);
        truck.status = TruckStatus.SERVICING;
    }

    handleOCRArrival(truck) {
        if (truck.status === TruckStatus.OCR_PROCESS) return;
        truck.status = TruckStatus.OCR_PROCESS;
        console.log(`[OCR] Scanning ${truck.plate}...`);

        setTimeout(() => {
            truck.status = TruckStatus.GATE_QUEUE;
            truck.targetZone = 'GATE_IN';
            console.log(`[OCR] Scan Complete for ${truck.plate}. Proceeding to Gate Queue.`);
        }, this.ocrProcessingTimeMs);
    }

    handleGateArrival(truck) {
        if (truck.status === TruckStatus.GATE_CHECK) return;
        truck.status = TruckStatus.GATE_CHECK;
        console.log(`[Gate] Checking paperwork for ${truck.plate} (${truck.missionType})...`);

        setTimeout(() => {
            let jobType = 'TRUCK_EXPORT';
            let targetZone = 'WAITING_CAMION';

            if (truck.missionType === 'DROP_EXPORT') {
                targetZone = 'WAITING_CAMION';
                jobType = 'TRUCK_EXPORT';
            } else {
                targetZone = 'WAITING_CAMION';
                jobType = 'TRUCK_IMPORT';
            }

            truck.targetZone = targetZone;
            const containerId = truck.missionType === 'DROP_EXPORT' ? truck.containerId : truck.targetContainerId;

            const job = this.jobManager.createJob(jobType, containerId, targetZone, 'YARD');
            truck.assignedJobId = job.id;
            this.jobManager.assignJobToNearestVehicle(job.id);

            truck.status = TruckStatus.TO_YARD;
            console.log(`[Gate] Access Granted. Proceed to ${truck.targetZone}. Job ${job.id} created.`);
        }, this.gateProcessingTimeMs);
    }

    handleGateExit(truck) {
        if (truck.isExitingGate) return; // Debounce
        truck.isExitingGate = true;

        console.log(`[Gate OUT] Checking ${truck.plate} out...`);

        setTimeout(() => {
            truck.isExitingGate = false; // Reset flag so it doesn't get stuck if logic loops
            truck.status = TruckStatus.DEPARTING; // New status
            truck.targetZone = 'DESPAWN_POINT_1'; // New target
            console.log(`[Gate OUT] Truck ${truck.plate} Cleared. Navigate to Highway.`);
        }, 3000);
    }

    getTrucks() {
        return this.trucks;
    }
}
