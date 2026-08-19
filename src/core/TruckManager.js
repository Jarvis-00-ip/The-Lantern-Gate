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

/**
 * The itinerary broken into legs, in travel order. This is what the route
 * editor offers for hand-drawing: automatic routing works off OSM data, which
 * does not always reflect how the terminal is actually driven, so an operator
 * can override any single leg without touching the others.
 */
export const TRUCK_LEGS = [
    { from: TruckRoute.SPAWN,       to: TruckRoute.CUSTOMS_IN,  label: 'Autostrada → Dogana ingresso' },
    { from: TruckRoute.CUSTOMS_IN,  to: TruckRoute.OCR,         label: 'Dogana ingresso → Varco OCR' },
    { from: TruckRoute.OCR,         to: TruckRoute.LANES_IN,    label: 'Varco OCR → Corsie ingresso' },
    { from: TruckRoute.OCR,         to: GATE_OUT_OF_GAUGE,      label: 'Varco OCR → Varco fuori sagoma', oversize: true },
    { from: TruckRoute.LANES_IN,    to: TruckRoute.YARD,        label: 'Corsie ingresso → Piazzale' },
    { from: GATE_OUT_OF_GAUGE,      to: TruckRoute.YARD,        label: 'Varco fuori sagoma → Piazzale', oversize: true },
    { from: TruckRoute.YARD,        to: TruckRoute.LANES_OUT,   label: 'Piazzale → Corsie uscita' },
    { from: TruckRoute.LANES_OUT,   to: TruckRoute.CUSTOMS_OUT, label: 'Corsie uscita → Dogana uscita' },
    { from: TruckRoute.CUSTOMS_OUT, to: TruckRoute.DESPAWN,     label: 'Dogana uscita → Autostrada' }
];

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
        this.isOversize = false; // Out-of-gauge load: uses the OOG gate, not the normal lanes
        this.previousZone = TruckRoute.SPAWN; // Where it is coming from; identifies the current leg
        this.parkingZone = null;  // Zone whose slot it holds
        this.parkingSlot = null;  // Slot index, so trucks do not stack up when stopped
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
        // Out-of-gauge loads need the dedicated gate and take longer to clear.
        this.oversizeGateProcessingTimeMs = 6000;
        this.oversizeSpawnChance = 0.12;

        // Which truck holds which parking slot, per zone: zoneId -> Map(truckId -> slot).
        // Without this every truck drives to the same centre point and they
        // stack on top of each other when stopped.
        this.parkingSlots = new Map();
        this.slotsPerZone = 8;
    }

    /**
     * Claims a stable parking slot for a truck in a zone, releasing whatever it
     * held elsewhere. Slots are handed out lowest-free-first, so a departing
     * truck's spot is reused rather than leaving a gap.
     * @returns {number} slot index
     */
    claimParkingSlot(truck, zoneId) {
        this.releaseParkingSlot(truck);

        if (!this.parkingSlots.has(zoneId)) this.parkingSlots.set(zoneId, new Map());
        const held = this.parkingSlots.get(zoneId);

        const taken = new Set(held.values());
        let slot = 0;
        while (taken.has(slot) && slot < this.slotsPerZone) slot++;

        held.set(truck.id, slot);
        truck.parkingSlot = slot;
        truck.parkingZone = zoneId;
        return slot;
    }

    releaseParkingSlot(truck) {
        if (!truck.parkingZone) return;
        const held = this.parkingSlots.get(truck.parkingZone);
        if (held) held.delete(truck.id);
        truck.parkingZone = null;
        truck.parkingSlot = null;
    }

    /**
     * Where a truck should physically stop in its target zone. Falls back to
     * the zone centre for anything without a claimed slot.
     * @returns {{lat:number,lng:number}|null}
     */
    parkingPointFor(truck, zoneId) {
        if (truck.parkingZone === zoneId && truck.parkingSlot !== null && truck.parkingSlot !== undefined) {
            return this.geoManager.getParkingSlot(zoneId, truck.parkingSlot, this.slotsPerZone);
        }
        return this.geoManager.getZoneCenter(zoneId);
    }

    spawnTruck(requestedType = null, options = {}) {
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
        truck.isOversize = options.oversize !== undefined
            ? options.oversize
            : Math.random() < this.oversizeSpawnChance;
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

        this.claimParkingSlot(truck, truck.targetZone);

        this.trucks.push(truck);
        console.log(`[TruckManager] Truck ${id} (${plate}) spawned at Genova Ovest. Mission: ${missionType}${truck.isOversize ? ' [FUORI SAGOMA]' : ''}.`);
        return truck;
    }

    /**
     * Entry gate for a truck. Oversize loads use the dedicated out-of-gauge
     * gate; everything else uses the normal lanes. This is the only place that
     * decides, so GATE_OOG can never leak into the standard itinerary.
     * @param {Truck} truck
     * @returns {string} Zone id
     */
    entryGateFor(truck) {
        return truck.isOversize ? GATE_OUT_OF_GAUGE : TruckRoute.LANES_IN;
    }

    /**
     * Moves a truck's destination on, remembering where it came from. Every
     * target change goes through here so `previousZone` -> `targetZone` always
     * names the leg being driven — which is how a hand-drawn route is matched.
     */
    /**
     * Whether a truck counts as having reached a zone: inside its polygon, or
     * within `radius` of the centre for zones it may stop just short of.
     * The polygon test matters for long zones — and for hand-drawn routes,
     * whose author ends the line where trucks actually stop rather than at the
     * geometric centroid.
     */
    _hasArrived(truck, zoneId, radius = 20) {
        if (this.geoManager.isInsideZone(truck.position, zoneId)) return true;
        const centre = this.geoManager.getZoneCenter(zoneId);
        return !!centre && this.geoManager._distanceMeters(truck.position, centre) < radius;
    }

    _setTarget(truck, zone) {
        if (truck.targetZone && truck.targetZone !== zone) {
            truck.previousZone = truck.targetZone;
        }
        truck.targetZone = zone;
        this.claimParkingSlot(truck, zone);
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
                if (this._hasArrived(t, TruckRoute.CUSTOMS_IN)) {
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
                if (this._hasArrived(t, TruckRoute.OCR)) {
                    this.handleOCRArrival(t);
                }
            }

            // ... (Gate/Yard logic remains similar, just ensure status flow)

            // 2. GATE_QUEUE -> the truck's own entry gate (normal lanes, or OOG)
            if (t.status === TruckStatus.GATE_QUEUE) {
                if (this._hasArrived(t, this.entryGateFor(t))) this.handleGateArrival(t);
            }

            // 3. TO_YARD
            if (t.status === TruckStatus.TO_YARD && t.targetZone) {
                if (this._hasArrived(t, t.targetZone, 25)) this.handleYardArrival(t);
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
                        this._setTarget(t, TruckRoute.LANES_OUT);
                    }
                }
            }

            // 5. EXITING -> EXIT LANES
            if (t.status === TruckStatus.EXITING) {
                if (this._hasArrived(t, TruckRoute.LANES_OUT)) {
                    this.handleGateExit(t);
                }
            }

            // 6. EXIT LANES -> CUSTOMS OUT (GATE_OUT), the last stop before the highway
            if (t.status === TruckStatus.CUSTOMS_OUT) {
                if (this._hasArrived(t, TruckRoute.CUSTOMS_OUT)) {
                    this.handleCustomsArrival(t, 'OUT');
                }
            }

            // 7. DEPARTING -> DESPAWN
            if (t.status === TruckStatus.DEPARTING) {
                if (this._hasArrived(t, TruckRoute.DESPAWN)) {
                    {
                        t.status = TruckStatus.DEPARTED;
                        this.releaseParkingSlot(t);
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
                this._setTarget(truck, TruckRoute.OCR);
                console.log(`[Customs IN] Cleared. Proceed to OCR.`);
            }, 2000);
        } else {
            // OUT
            console.log(`[Customs OUT] Final Check ${truck.plate} at ${TruckRoute.CUSTOMS_OUT}...`);
            setTimeout(() => {
                truck.isProcessingCustoms = false;
                truck.status = TruckStatus.DEPARTING;
                this._setTarget(truck, TruckRoute.DESPAWN);
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
            this._setTarget(truck, this.entryGateFor(truck));
            console.log(`[OCR] Scan Complete for ${truck.plate}. Proceeding to ${truck.isOversize ? 'OUT-OF-GAUGE gate' : 'entry lanes'}.`);
        }, this.ocrProcessingTimeMs);
    }

    handleGateArrival(truck) {
        if (truck.status === TruckStatus.GATE_CHECK) return;
        truck.status = TruckStatus.GATE_CHECK;
        console.log(`[Gate] Checking paperwork for ${truck.plate}${truck.isOversize ? ' at the out-of-gauge gate' : ''}...`);

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

            this._setTarget(truck, targetZone);
            const containerId = truck.missionType === 'DROP_EXPORT' ? truck.containerId : truck.targetContainerId;

            const job = this.jobManager.createJob(jobType, containerId, targetZone, 'YARD');
            truck.assignedJobId = job.id;
            this.jobManager.assignJobToNearestVehicle(job.id);

            truck.status = TruckStatus.TO_YARD;
            console.log(`[Gate] Access Granted. Proceed to ${truck.targetZone}.`);
        }, truck.isOversize ? this.oversizeGateProcessingTimeMs : this.gateProcessingTimeMs);
    }

    handleGateExit(truck) {
        if (truck.isExitingGate) return;
        truck.isExitingGate = true;

        console.log(`[Gate OUT] Checking ${truck.plate} out...`);

        setTimeout(() => {
            truck.isExitingGate = false;
            truck.status = TruckStatus.CUSTOMS_OUT; // Next stop: customs at GATE_OUT
            this._setTarget(truck, TruckRoute.CUSTOMS_OUT);
            console.log(`[Gate OUT] Cleared. Proceed to customs (${TruckRoute.CUSTOMS_OUT}).`);
        }, 3000);
    }

    getTrucks() {
        return this.trucks;
    }
}
