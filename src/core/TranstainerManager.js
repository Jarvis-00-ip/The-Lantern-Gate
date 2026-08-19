import { VehicleType, VehicleStatus } from './FleetManager.js';

/**
 * The Lantern Gate - Transtainer (RTG) Manager
 *
 * Yard-side container handling by gantry crane, decoupled from the vessel and
 * quay-crane side of the terminal (deliberately deferred — see HANDOVER
 * discussions). This module owns the choreography between two independently
 * moving vehicles per job (a reach stacker and a terminal tractor), which is
 * why it is a separate manager rather than bolted onto JobManager: JobManager
 * assumes one vehicle per job start to finish, and forcing this in would have
 * meant threading a second vehicle through every one of its phases.
 *
 * EXPORT (container leaving a yard block, ready for a future quay pickup):
 *   reach stacker picks from the block -> hands off to a ralla ->
 *   ralla drives to the transtainer dock -> transtainer receives it.
 *
 * IMPORT (container arriving from the transtainer, e.g. from a vessel via a
 * quay crane not yet modelled):
 *   transtainer loads a ralla -> ralla drives to a target block ->
 *   reach stacker takes it from the ralla -> stacks it.
 *
 * Each unit is tied to an existing LOADING_*_CRANES zone — real polygons
 * already in GeoManager, not new geometry — which both vehicle types are
 * already allowed to enter.
 */

export const TranstainerJobType = { EXPORT: 'EXPORT', IMPORT: 'IMPORT' };

export const TranstainerPhase = {
    PENDING: 'PENDING',
    // Export
    RS_TO_SOURCE: 'RS_TO_SOURCE',
    RS_PICKING: 'RS_PICKING',
    AWAIT_RALLA: 'AWAIT_RALLA',
    RALLA_TO_SOURCE: 'RALLA_TO_SOURCE',
    TRANSFER_TO_RALLA: 'TRANSFER_TO_RALLA',
    RALLA_TO_DOCK: 'RALLA_TO_DOCK',
    DOCKING: 'DOCKING',
    // Import
    LOADING_FROM_TRANSTAINER: 'LOADING_FROM_TRANSTAINER',
    RALLA_TO_TARGET: 'RALLA_TO_TARGET',
    RS_TO_TARGET: 'RS_TO_TARGET',
    TRANSFER_TO_RS: 'TRANSFER_TO_RS',
    RS_STACKING: 'RS_STACKING',
    COMPLETED: 'COMPLETED'
};

/**
 * The four RTGs. Only two crane-rail corridors exist in the traced geometry
 * (LOADING_BC_CRANES, LOADING_AC_CRANES — real polygons, not invented), so
 * two units share each corridor, at distinct fixed points along it (see
 * `slot`/`slotCount`, resolved to real positions in the constructor via
 * GeoManager.getParkingSlot). _nearestUnit() round-robins between the two
 * units on whichever corridor is nearest, so both actually get used.
 */
export const TRANSTAINER_UNITS = [
    { id: 'RTG-BC-1', dockZone: 'LOADING_BC_CRANES', craneZone: 'BLOCK_BC_CRANES', slot: 0, slotCount: 2 },
    { id: 'RTG-BC-2', dockZone: 'LOADING_BC_CRANES', craneZone: 'BLOCK_BC_CRANES', slot: 1, slotCount: 2 },
    { id: 'RTG-AC-1', dockZone: 'LOADING_AC_CRANES', craneZone: 'BLOCK_AC_CRANES', slot: 0, slotCount: 2 },
    { id: 'RTG-AC-2', dockZone: 'LOADING_AC_CRANES', craneZone: 'BLOCK_AC_CRANES', slot: 1, slotCount: 2 }
];

export const YARD_BLOCKS = ['BLOCK_A', 'BLOCK_B', 'BLOCK_C', 'BLOCK_D'];

let jobCounter = 0;

export class TranstainerJob {
    constructor(type, containerId) {
        this.id = `RTG-JOB-${Date.now()}-${jobCounter++}`;
        this.type = type;
        this.containerId = containerId;
        this.sourceBlock = null;   // EXPORT: where the container comes from
        this.sourceBay = null;     // EXPORT: exact stack position to remove from
        this.sourceRow = null;
        this.targetBlock = null;   // IMPORT: where it gets stacked
        this.unitId = null;
        this.phase = TranstainerPhase.PENDING;
        this.reachStackerId = null;
        this.rallaId = null;
    }
}

export class TranstainerManager {
    constructor(geoManager, fleetManager, yardManager) {
        this.geoManager = geoManager;
        this.fleetManager = fleetManager;
        this.yardManager = yardManager;

        this.units = TRANSTAINER_UNITS.map(u => ({
            ...u,
            exportedCount: 0,
            importedCount: 0,
            // Fixed map position for this specific crane, spread along its
            // corridor's long axis — this is what makes two units sharing a
            // dockZone render at two different spots instead of stacking.
            position: geoManager.getParkingSlot(u.dockZone, u.slot, u.slotCount)
        }));
        this.jobs = [];
        this._roundRobin = {}; // dockZone -> next unit index, for _nearestUnit

        // Timings, in one place and overridable, same pattern as
        // TruckManager's *ProcessingTimeMs — tests shrink these to run fast.
        this.pickTimeMs = 5000;
        this.transferTimeMs = 3000;
        this.dockTimeMs = 5000;
        this.stackTimeMs = 3000;
    }

    // --- Public entry points -------------------------------------------------

    /**
     * Starts an export job: a container leaves a yard block for a transtainer.
     * @param {string|null} blockId - Source block, or pick one with stock.
     * @returns {TranstainerJob|null} null if there is nothing to export.
     */
    requestExport(blockId = null) {
        const candidate = blockId
            ? this._pickExportContainer(blockId)
            : this._findAnyExportCandidate();

        if (!candidate) {
            console.log('[Transtainer] No container available to export.');
            return null;
        }

        const job = new TranstainerJob(TranstainerJobType.EXPORT, candidate.container.id);
        job.sourceBlock = candidate.blockId;
        job.sourceBay = candidate.container.bay;
        job.sourceRow = candidate.container.row;
        job.unitId = this._nearestUnit(candidate.blockId).id;
        this.jobs.push(job);
        console.log(`[Transtainer] Export job ${job.id}: ${job.containerId} from ${job.sourceBlock} via ${job.unitId}.`);
        return job;
    }

    /**
     * Starts an import job: the transtainer hands a container to the yard.
     * @param {string|null} containerId - Defaults to a mock id.
     * @param {string|null} targetBlock - Defaults to a random yard block.
     * @returns {TranstainerJob}
     */
    requestImport(containerId = null, targetBlock = null) {
        const job = new TranstainerJob(TranstainerJobType.IMPORT,
            containerId || `RTG-IMP-${Math.floor(Math.random() * 9000)}`);
        job.targetBlock = targetBlock || YARD_BLOCKS[Math.floor(Math.random() * YARD_BLOCKS.length)];
        job.unitId = this._nearestUnit(job.targetBlock).id;
        this.jobs.push(job);
        console.log(`[Transtainer] Import job ${job.id}: ${job.containerId} to ${job.targetBlock} via ${job.unitId}.`);
        return job;
    }

    getActiveJobs() {
        return this.jobs.filter(j => j.phase !== TranstainerPhase.COMPLETED);
    }

    // --- Main loop -------------------------------------------------------------

    update(dt) {
        this.jobs.forEach(job => {
            if (job.phase === TranstainerPhase.COMPLETED) return;
            if (job.type === TranstainerJobType.EXPORT) this._updateExport(job);
            else this._updateImport(job);
        });

        // Completed jobs are cheap to keep (just a record), but there is no
        // reason to let the array grow forever in a long session.
        if (this.jobs.length > 200) {
            this.jobs = this.jobs.filter(j => j.phase !== TranstainerPhase.COMPLETED).concat(
                this.jobs.filter(j => j.phase === TranstainerPhase.COMPLETED).slice(-50));
        }
    }

    // --- Export choreography -----------------------------------------------

    _updateExport(job) {
        const unit = this.units.find(u => u.id === job.unitId);

        switch (job.phase) {
            case TranstainerPhase.PENDING: {
                const rs = this.fleetManager.findNearestVehicle(VehicleType.REACH_STACKER,
                    this.geoManager.getZoneCenter(job.sourceBlock), this.geoManager);
                if (!rs) return; // no machine free yet, retry next tick

                this._claim(rs, job.id);
                rs.currentZone = job.sourceBlock;
                job.reachStackerId = rs.id;
                job.phase = TranstainerPhase.RS_TO_SOURCE;
                break;
            }

            case TranstainerPhase.RS_TO_SOURCE: {
                const rs = this.fleetManager.getVehicle(job.reachStackerId);
                if (rs && this.geoManager.hasArrived(rs.position, job.sourceBlock)) {
                    rs.status = 'Operating (Pick)';
                    job.phase = TranstainerPhase.RS_PICKING;
                    setTimeout(() => {
                        rs.carriedContainer = job.containerId;
                        this.yardManager.removeContainer(job.sourceBlock, job.sourceBay, job.sourceRow);
                        job.phase = TranstainerPhase.AWAIT_RALLA;
                    }, this.pickTimeMs);
                }
                break;
            }

            case TranstainerPhase.RS_PICKING:
                break; // waiting on the setTimeout scheduled in RS_TO_SOURCE above

            case TranstainerPhase.AWAIT_RALLA: {
                // The RS is holding the container and waiting; nothing physically
                // moves here until a Ralla is free to come and meet it.
                const ralla = this.fleetManager.findNearestVehicle(VehicleType.RALLA,
                    this.geoManager.getZoneCenter(job.sourceBlock), this.geoManager);
                if (!ralla) return;

                this._claim(ralla, job.id);
                ralla.currentZone = job.sourceBlock;
                job.rallaId = ralla.id;
                job.phase = TranstainerPhase.RALLA_TO_SOURCE;
                break;
            }

            case TranstainerPhase.RALLA_TO_SOURCE: {
                const ralla = this.fleetManager.getVehicle(job.rallaId);
                if (ralla && this.geoManager.hasArrived(ralla.position, job.sourceBlock)) {
                    ralla.status = 'Operating (Transfer)';
                    job.phase = TranstainerPhase.TRANSFER_TO_RALLA;
                    setTimeout(() => {
                        const rs = this.fleetManager.getVehicle(job.reachStackerId);
                        if (rs) { rs.carriedContainer = null; this._release(rs); }
                        ralla.carriedContainer = job.containerId;
                        ralla.status = 'Transporting';
                        ralla.currentZone = unit.dockZone;
                        job.phase = TranstainerPhase.RALLA_TO_DOCK;
                    }, this.transferTimeMs);
                }
                break;
            }

            case TranstainerPhase.TRANSFER_TO_RALLA:
                break; // waiting on the setTimeout scheduled in RALLA_TO_SOURCE above

            case TranstainerPhase.RALLA_TO_DOCK: {
                const ralla = this.fleetManager.getVehicle(job.rallaId);
                if (ralla && this.geoManager.hasArrived(ralla.position, unit.dockZone)) {
                    ralla.status = 'Operating (Dock)';
                    job.phase = TranstainerPhase.DOCKING;
                    setTimeout(() => {
                        ralla.carriedContainer = null;
                        this._release(ralla);
                        unit.exportedCount++;
                        job.phase = TranstainerPhase.COMPLETED;
                        console.log(`[Transtainer] ${unit.id} received ${job.containerId}. Total exported: ${unit.exportedCount}.`);
                    }, this.dockTimeMs);
                }
                break;
            }

            case TranstainerPhase.DOCKING:
                break; // waiting on the setTimeout scheduled in RALLA_TO_DOCK above

            default:
                break;
        }
    }

        // --- Import choreography -----------------------------------------------

    _updateImport(job) {
        const unit = this.units.find(u => u.id === job.unitId);

        switch (job.phase) {
            case TranstainerPhase.PENDING: {
                const ralla = this.fleetManager.findNearestVehicle(VehicleType.RALLA,
                    this.geoManager.getZoneCenter(unit.dockZone), this.geoManager);
                if (!ralla) return;

                this._claim(ralla, job.id);
                ralla.currentZone = unit.dockZone;
                job.rallaId = ralla.id;
                job.phase = TranstainerPhase.RALLA_TO_DOCK;
                break;
            }

            case TranstainerPhase.RALLA_TO_DOCK: {
                const ralla = this.fleetManager.getVehicle(job.rallaId);
                if (ralla && this.geoManager.hasArrived(ralla.position, unit.dockZone)) {
                    ralla.status = 'Operating (Load)';
                    job.phase = TranstainerPhase.LOADING_FROM_TRANSTAINER;
                    setTimeout(() => {
                        ralla.carriedContainer = job.containerId;
                        ralla.status = 'Transporting';
                        ralla.currentZone = job.targetBlock;
                        unit.importedCount++;
                        job.phase = TranstainerPhase.RALLA_TO_TARGET;
                    }, this.dockTimeMs);
                }
                break;
            }

            case TranstainerPhase.RALLA_TO_TARGET: {
                const ralla = this.fleetManager.getVehicle(job.rallaId);
                if (ralla && this.geoManager.hasArrived(ralla.position, job.targetBlock)) {
                    if (!job.reachStackerId) {
                        const rs = this.fleetManager.findNearestVehicle(VehicleType.REACH_STACKER,
                            this.geoManager.getZoneCenter(job.targetBlock), this.geoManager);
                        if (!rs) return; // Ralla waits, parked, until one frees up
                        this._claim(rs, job.id);
                        rs.currentZone = job.targetBlock;
                        job.reachStackerId = rs.id;
                        job.phase = TranstainerPhase.RS_TO_TARGET;
                    }
                }
                break;
            }

            case TranstainerPhase.RS_TO_TARGET: {
                const rs = this.fleetManager.getVehicle(job.reachStackerId);
                const ralla = this.fleetManager.getVehicle(job.rallaId);
                if (rs && ralla && this.geoManager.hasArrived(rs.position, job.targetBlock)) {
                    rs.status = 'Operating (Transfer)';
                    job.phase = TranstainerPhase.TRANSFER_TO_RS;
                    setTimeout(() => {
                        ralla.carriedContainer = null;
                        this._release(ralla);
                        rs.carriedContainer = job.containerId;
                        rs.status = 'Operating (Stack)';
                        job.phase = TranstainerPhase.RS_STACKING;
                        setTimeout(() => {
                            this._stack(job.targetBlock, job.containerId);
                            rs.carriedContainer = null;
                            this._release(rs);
                            job.phase = TranstainerPhase.COMPLETED;
                            console.log(`[Transtainer] ${job.containerId} stacked in ${job.targetBlock}.`);
                        }, this.stackTimeMs);
                    }, this.transferTimeMs);
                }
                break;
            }

            case TranstainerPhase.LOADING_FROM_TRANSTAINER:
            case TranstainerPhase.TRANSFER_TO_RS:
            case TranstainerPhase.RS_STACKING:
                break; // waiting on a setTimeout scheduled above

            default:
                break;
        }
    }

    // --- Helpers -----------------------------------------------------------

    /** Marks a vehicle busy on a transtainer job, out of the idle pool. */
    _claim(vehicle, jobId) {
        vehicle.status = 'Job Assigned';
        vehicle.currentJobId = jobId;
    }

    /** Frees a vehicle back to the depot, mirroring JobManager.completeJob(). */
    _release(vehicle) {
        vehicle.currentJobId = null;
        vehicle.carriedContainer = null;
        if (vehicle.deployedZone) {
            vehicle.currentZone = vehicle.deployedZone;
            vehicle.status = 'Active';
        } else {
            vehicle.status = VehicleStatus.IDLE;
        }
    }

    /** Drops a container into a block's yard storage, spreading across bays/rows. */
    _stack(blockId, containerId) {
        const bay = Math.floor(Math.random() * 10) + 1;
        const row = Math.floor(Math.random() * 5) + 1;
        this.yardManager.addContainer({ id: containerId, type: 'Standard' }, blockId, bay, row);
    }

    /**
     * Picks a real container to export from a specific block, top of stack
     * first. A container stays physically in the yard until its job's pickup
     * timer fires, so two requestExport() calls made back-to-back must not
     * both grab the same one — excluding ids already claimed by a live job
     * closes that race.
     */
    _pickExportContainer(blockId) {
        const claimed = new Set(this.jobs
            .filter(j => j.type === TranstainerJobType.EXPORT && j.phase !== TranstainerPhase.COMPLETED)
            .map(j => j.containerId));

        const containers = this.yardManager.getContainersInZone(blockId).filter(c => !claimed.has(c.id));
        if (!containers.length) return null;

        const top = containers.filter(c => c.penalty === 0);
        const pool = top.length ? top : containers;
        const container = pool[Math.floor(Math.random() * pool.length)];

        return { blockId, container };
    }

    _findAnyExportCandidate() {
        for (const block of YARD_BLOCKS) {
            const found = this._pickExportContainer(block);
            if (found) return found;
        }
        return null;
    }

    /**
     * Picks a unit for a job near `zoneId`. Distance decides which corridor
     * (dockZone) is nearest; when more than one unit shares that corridor,
     * round-robins between them so both are actually put to work instead of
     * one twin always losing a tie-break on identical dockZone distance.
     */
    _nearestUnit(zoneId) {
        const pos = this.geoManager.getZoneCenter(zoneId);
        const dockZones = [...new Set(this.units.map(u => u.dockZone))];
        const nearestDock = dockZones.reduce((best, dz) => {
            const d = this.geoManager._distanceMeters(pos, this.geoManager.getZoneCenter(dz));
            return (!best || d < best.d) ? { dz, d } : best;
        }, null).dz;

        const candidates = this.units.filter(u => u.dockZone === nearestDock);
        const i = (this._roundRobin[nearestDock] || 0) % candidates.length;
        this._roundRobin[nearestDock] = i + 1;
        return candidates[i];
    }
}
