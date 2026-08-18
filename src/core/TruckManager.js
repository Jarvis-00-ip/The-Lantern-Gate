/**
 * The truck itinerary, in order. Kept in one place because the previous
 * layout scattered zone IDs across handlers, which is how the route ended up
 * doubling back: the gate it used sits ~235m WEST of the OCR portal, so trucks
 * drove past the out-of-gauge gate twice on every run.
 *
 * Ground truth: customs is performed at the real GATE_IN / GATE_OUT polygons.
 * Longitude must increase on the way in and decrease on the way out — any
 * violation of that means the route is doubling back again.
 */
export const TruckRoute = {
    SPAWN: 'SPAWN_POINT_1',      // Casello Genova Ovest
    CUSTOMS_IN: 'GATE_IN',       // Dogana / varco ingresso  (lng 8.90500)
    OCR: 'OCR_GATE',             // Varco OCR                (lng 8.90786)
    LANES_IN: 'TRUCK_LANES_IN',  // 3 corsie ingresso        (lng 8.91085)
    YARD: 'WAITING_CAMION',      // Scarico / carico         (lng 8.91020)
    LANES_OUT: 'TRUCK_LANES_OUT',// 2 corsie uscita          (lng 8.91091)
    CUSTOMS_OUT: 'GATE_OUT',     // Dogana / varco uscita    (lng 8.90498)
    DESPAWN: 'DESPAWN_POINT_1'   // Uscita Genova Ovest
};

/**
 * Out-of-gauge gate. Deliberately NOT in TruckRoute: only oversized loads use
 * it, and it must never appear in the standard itinerary.
 */
export const GATE_OUT_OF_GAUGE = 'GATE_OOG';

export const TruckStatus = {
    INBOUND: 'Inbound',
    CUSTOMS_IN: 'Customs In',
    OCR_PROCESS: 'OCR Scan',
    GATE_QUEUE: 'Gate Queue',
    GATE_CHECK: 'Gate Check',
    TO_YARD: 'To Yard',
    SERVICING: 'Servicing', // Loading/Unloading
    EXITING: 'Exiting',    // To Gate Out
    CUSTOMS_OUT: 'Customs Out',
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
        this.targetZone = TruckRoute.CUSTOMS_IN; // Overwritten by spawnTruck()
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

    spawnTruck(requestedType = null) {
        // 0. Safety Check
        const spawnZone = this.geoManager.getZoneCenter(TruckRoute.SPAWN);
        if (!spawnZone) return null;

        const entryPoint = spawnZone;
        const blocked = this.trucks.some(t => {
            if (t.status === 'Departed') return false;
            const dist = this.geoManager._distanceMeters(t.position, entryPoint);
            return dist < 30; // Reduced to 30m to allow faster spawns
        });

        if (blocked) {
            console.log("[TruckManager] Entry blocked.");
            return null;
        }

        // 1. Decide Mission
        let missionType = 'DROP_EXPORT';
        let containerId = null;
        let targetContainerId = null;

        // Determine Type
        let isImport = false;
        if (requestedType) {
            isImport = (requestedType === 'IMPORT');
        } else {
            // Random chance if not specified
            isImport = (Math.random() < 0.4);
        }

        if (isImport) {
            missionType = 'PICK_IMPORT';
            // Try to find a real container to pick
            if (this.exportQueues.TRUCK.length > 0) {
                targetContainerId = this.exportQueues.TRUCK.shift();
            } else {
                // Mock one for simulation visualization
                targetContainerId = `MOCK-IMP-${Math.floor(Math.random() * 9000)}`;
            }
        } else {
            missionType = 'DROP_EXPORT';
            containerId = `CN${Math.floor(Math.random() * 100000)}`;
        }

        const id = `TRK-${Math.floor(Math.random() * 9000) + 1000}`;
        const plate = `GEN-${Math.floor(Math.random() * 900) + 100}`;

        const truck = new Truck(id, plate, containerId, missionType);
        truck.targetZone = TruckRoute.CUSTOMS_IN; // First stop: customs at the real gate
        if (missionType === 'PICK_IMPORT') {
            truck.targetContainerId = targetContainerId;
        }

        // Spawn Location with Jitter
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

            // 1. INBOUND -> CUSTOMS IN (GATE_IN)
            if (t.status === TruckStatus.INBOUND) {
                const center = this.geoManager.getZoneCenter(TruckRoute.CUSTOMS_IN);
                if (center && this.geoManager._distanceMeters(t.position, center) < 20) {
                    this.handleCustomsArrival(t, 'IN');
                }
            }

            // 1b. CUSTOMS_IN -> OCR
            if (t.status === TruckStatus.CUSTOMS_IN) {
                // Wait for processing to switch to OCR target (handled in handleCustomsArrival timeout)
            }

            // 2. TO OCR (Transition state, status might still be CUSTOMS_IN but target is OCR)
            // Actually, let's use a specific status or just check target.
            // Simplified: If target is OCR_GATE, check arrival.
            if (t.targetZone === TruckRoute.OCR && t.status !== TruckStatus.OCR_PROCESS) {
                const center = this.geoManager.getZoneCenter(TruckRoute.OCR);
                if (center && this.geoManager._distanceMeters(t.position, center) < 20) {
                    this.handleOCRArrival(t);
                }
            }

            // ... (Gate/Yard logic remains similar, just ensure status flow)

            // 2. GATE_QUEUE -> ENTRY LANES (east of the OCR, next to the yard)
            if (t.status === TruckStatus.GATE_QUEUE) {
                const center = this.geoManager.getZoneCenter(TruckRoute.LANES_IN);
                if (center) {
                    const dist = this.geoManager._distanceMeters(t.position, center);
                    if (dist < 20) this.handleGateArrival(t);
                }
            }

            // 3. TO_YARD
            if (t.status === TruckStatus.TO_YARD && t.targetZone) {
                const target = this.geoManager.getZoneCenter(t.targetZone);
                if (target) {
                    const dist = this.geoManager._distanceMeters(t.position, target);
                    if (dist < 25) this.handleYardArrival(t);
                }
            }

            // 4. SERVICING
            if (t.status === TruckStatus.SERVICING) {
                if (t.assignedJobId) {
                    const job = this.jobManager.jobs.find(j => j.id === t.assignedJobId);
                    if (job && job.status === 'COMPLETED') {
                        console.log(`[Yard] Service Finished for ${t.plate}. Proceeding to EXIT.`);

                        if (t.missionType === 'DROP_EXPORT') {
                            if (t.containerId) this.exportQueues.TRUCK.push(t.containerId);
                            t.containerId = null;
                        } else if (t.missionType === 'PICK_IMPORT') {
                            t.containerId = t.targetContainerId;
                            t.targetContainerId = null;
                        }

                        t.status = TruckStatus.EXITING;
                        t.targetZone = TruckRoute.LANES_OUT;
                    }
                }
            }

            // 5. EXITING -> EXIT LANES
            if (t.status === TruckStatus.EXITING) {
                const center = this.geoManager.getZoneCenter(TruckRoute.LANES_OUT);
                if (center && this.geoManager._distanceMeters(t.position, center) < 20) {
                    this.handleGateExit(t);
                }
            }

            // 6. EXIT LANES -> CUSTOMS OUT (GATE_OUT), the last stop before the highway
            if (t.status === TruckStatus.CUSTOMS_OUT) {
                const center = this.geoManager.getZoneCenter(TruckRoute.CUSTOMS_OUT);
                if (center && this.geoManager._distanceMeters(t.position, center) < 20) {
                    this.handleCustomsArrival(t, 'OUT');
                }
            }

            // 7. DEPARTING -> DESPAWN
            if (t.status === TruckStatus.DEPARTING) {
                const center = this.geoManager.getZoneCenter(TruckRoute.DESPAWN);
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

    handleCustomsArrival(truck, type) {
        if (truck.isProcessingCustoms) return;
        truck.isProcessingCustoms = true;

        if (type === 'IN') {
            truck.status = TruckStatus.CUSTOMS_IN;
            console.log(`[Customs IN] Inspecting ${truck.plate} at ${TruckRoute.CUSTOMS_IN}...`);
            setTimeout(() => {
                truck.isProcessingCustoms = false;
                truck.status = TruckStatus.INBOUND; // Reset to allow movement logic to pick up next target?
                // Actually, let's just set target.
                truck.targetZone = TruckRoute.OCR;
                console.log(`[Customs IN] Cleared. Proceed to OCR.`);
            }, 2000);
        } else {
            // OUT
            console.log(`[Customs OUT] Final Check ${truck.plate} at ${TruckRoute.CUSTOMS_OUT}...`);
            setTimeout(() => {
                truck.isProcessingCustoms = false;
                truck.status = TruckStatus.DEPARTING;
                truck.targetZone = TruckRoute.DESPAWN;
                console.log(`[Customs OUT] Cleared. Proceed to Highway.`);
            }, 2000);
        }
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
            truck.targetZone = TruckRoute.LANES_IN;
            console.log(`[OCR] Scan Complete for ${truck.plate}. Proceeding to entry lanes.`);
        }, this.ocrProcessingTimeMs);
    }

    handleGateArrival(truck) {
        if (truck.status === TruckStatus.GATE_CHECK) return;
        truck.status = TruckStatus.GATE_CHECK;
        console.log(`[Gate] Checking paperwork for ${truck.plate}...`);

        setTimeout(() => {
            let jobType = 'TRUCK_EXPORT';
            let targetZone = 'WAITING_CAMION';

            if (truck.missionType === 'DROP_EXPORT') {
                targetZone = 'WAITING_CAMION';
                jobType = 'TRUCK_EXPORT';
            } else {
                targetZone = 'WAITING_CAMION'; // Or specific stack if we had logic
                jobType = 'TRUCK_IMPORT';
            }

            truck.targetZone = targetZone;
            const containerId = truck.missionType === 'DROP_EXPORT' ? truck.containerId : truck.targetContainerId;

            const job = this.jobManager.createJob(jobType, containerId, targetZone, 'YARD');
            truck.assignedJobId = job.id;
            this.jobManager.assignJobToNearestVehicle(job.id);

            truck.status = TruckStatus.TO_YARD;
            console.log(`[Gate] Access Granted.Proceed to ${truck.targetZone}.`);
        }, this.gateProcessingTimeMs);
    }

    handleGateExit(truck) {
        if (truck.isExitingGate) return;
        truck.isExitingGate = true;

        console.log(`[Gate OUT] Checking ${truck.plate} out...`);

        setTimeout(() => {
            truck.isExitingGate = false;
            truck.status = TruckStatus.CUSTOMS_OUT; // Next stop: customs at GATE_OUT
            truck.targetZone = TruckRoute.CUSTOMS_OUT;
            console.log(`[Gate OUT] Cleared. Proceed to customs (${TruckRoute.CUSTOMS_OUT}).`);
        }, 3000);
    }

    getTrucks() {
        return this.trucks;
    }
}
