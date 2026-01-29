export const JobType = {
    DISCHARGE: 'DISCHARGE', // Ship -> Yard
    LOAD: 'LOAD',           // Yard -> Ship
    MOVE: 'MOVE',           // Yard -> Yard / Gate -> Yard
    SHUFFLE: 'SHUFFLE',      // Digging move
    TRUCK_EXPORT: 'TRUCK_EXPORT', // Truck -> Yard
    TRUCK_IMPORT: 'TRUCK_IMPORT'  // Yard -> Truck
};

export const JobStatus = {
    PENDING: 'PENDING',
    ASSIGNED: 'ASSIGNED',
    IN_PROGRESS: 'IN_PROGRESS',
    COMPLETED: 'COMPLETED'
};

export class Job {
    constructor(id, type, containerId, sourceZone, targetZone) {
        this.id = id;
        this.type = type;
        this.containerId = containerId;
        this.sourceZone = sourceZone; // e.g., 'QUAY', 'BLOCK_A'
        this.targetZone = targetZone; // e.g., 'BLOCK_A', 'QUAY'
        this.status = JobStatus.PENDING;
        this.assignedVehicleId = null;
        this.createdAt = new Date();
    }
}

export class JobManager {
    constructor(fleetManager, yardManager, geoManager) {
        this.fleetManager = fleetManager;
        this.yardManager = yardManager;
        this.geoManager = geoManager;
        this.jobs = [];
    }

    createJob(type, containerId, source, target) {
        const id = `JOB-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const job = new Job(id, type, containerId, source, target);
        this.jobs.push(job);
        console.log(`[JobManager] Created Job ${id}: ${type} ${containerId} from ${source} to ${target}`);
        return job;
    }

    getPendingJobs() {
        return this.jobs.filter(j => j.status === JobStatus.PENDING);
    }

    getActiveJobs() {
        return this.jobs.filter(j => j.status === JobStatus.IN_PROGRESS || j.status === JobStatus.ASSIGNED);
    }

    assignJobToNearestVehicle(jobId) {
        const job = this.jobs.find(j => j.id === jobId);
        if (!job || job.status !== JobStatus.PENDING) return false;

        // RESOLVE LOGIC: Convert abstract 'YARD' to specific Zone (Simulation)
        // In real life, TO S determines the slot. Here we pick one.
        if (job.targetZone === 'YARD') {
            // Pick a random block for simulation
            const blocks = ['BLOCK_A', 'BLOCK_B', 'BLOCK_C', 'BLOCK_D'];
            job.targetZone = blocks[Math.floor(Math.random() * blocks.length)];
        }
        if (job.sourceZone === 'YARD') {
            // For exports, we might need to know WHERE it is.
            // If we don't have tracking, assume it's in a block.
            const blocks = ['BLOCK_A', 'BLOCK_B', 'BLOCK_C', 'BLOCK_D'];
            job.sourceZone = blocks[Math.floor(Math.random() * blocks.length)];
        }

        // Determine required vehicle type
        let requiredType = 'Reach Stacker';
        // Logic could be more complex (e.g. Straddles for some zones)

        // Find Target Position for finding nearest
        // Vehicle must go to Source Start
        const initialTargetZone = job.sourceZone;
        const targetPos = this.geoManager.getZoneCenter(initialTargetZone);

        if (!targetPos) {
            console.warn(`[JobManager] Could not find center for ${initialTargetZone}`);
            return false;
        }

        const vehicle = this.fleetManager.findNearestVehicle(requiredType, targetPos, this.geoManager);

        if (vehicle) {
            job.status = JobStatus.ASSIGNED;
            job.assignedVehicleId = vehicle.id;

            vehicle.status = 'Job Assigned';
            vehicle.currentJobId = jobId;

            // CRITICAL: Vehicle must move to SOURCE first
            vehicle.currentZone = initialTargetZone;

            console.log(`[JobManager] Assigned ${jobId} to ${vehicle.id}. Moving to ${initialTargetZone}`);
            return true;
        }
        return false;
    }

    assignPendingJobs() {
        const pendingJobs = this.getPendingJobs();
        pendingJobs.forEach(job => {
            this.assignJobToNearestVehicle(job.id);
        });
    }

    update(dt) {
        // 1. Try to assign pending jobs
        this.assignPendingJobs();

        // Process Active Jobs
        const activeJobs = this.getActiveJobs();

        activeJobs.forEach(job => {
            const vehicle = this.fleetManager.getVehicle(job.assignedVehicleId);
            if (!vehicle) return;

            // State Machine for Job Execution
            if (job.status === JobStatus.ASSIGNED) {
                // PHASE 1: Moving to Source
                const dist = this._getDistanceToZone(vehicle.position, job.sourceZone);
                if (dist < 20) {
                    console.log(`[Job] Vehicle ${vehicle.id} arrived at Source ${job.sourceZone}. Starting operations...`);
                    job.status = 'PICKING_UP';
                    vehicle.status = 'Operating (Pick)';

                    setTimeout(() => {
                        this._performPickup(job, vehicle);
                    }, 5000); // 5s operation time
                }
            }
            else if (job.status === JobStatus.IN_PROGRESS) {
                // PHASE 2: Moving to Target
                const dist = this._getDistanceToZone(vehicle.position, job.targetZone);
                if (dist < 20) {
                    console.log(`[Job] Vehicle ${vehicle.id} arrived at Target ${job.targetZone}. Dropping off...`);
                    job.status = 'DROPPING_OFF';
                    vehicle.status = 'Operating (Drop)';

                    setTimeout(() => {
                        this._performDropoff(job, vehicle);
                    }, 5000); // 5s operation time
                }
            }
        });
    }

    _getDistanceToZone(pos, zoneId) {
        const center = this.geoManager.getZoneCenter(zoneId);
        if (!center || !pos) return Infinity;
        return this.geoManager._distanceMeters(pos, center);
    }

    _performPickup(job, vehicle) {
        console.log(`[Job] Performing PICKUP for ${job.id}`);
        // Action: Move Container from Source to Vehicle

        // CASE A: TRUCK EXPORT (Pick from Truck)
        if (job.type === 'TRUCK_EXPORT') {
            // Find the truck in this zone
            // We need access to TruckManager. Since we don't have it explicitly linked in constructor in old code,
            // we rely on global or we need to find the truck that has this container.
            // Better approach: TruckManager is global 'window.truckManager' or passed.
            // Let's assume we can finding the container ID in the trucks list.
            const truckManager = window.truckManager; // Dependency Injection would be better but this fits existing pattern
            if (truckManager) {
                const truck = truckManager.getTrucks().find(t => t.containerId === job.containerId);
                if (truck) {
                    truck.containerId = null; // Remove from truck
                    vehicle.carriedContainer = job.containerId; // Add to Vehicle
                    console.log(`[Job] Container ${job.containerId} transferred: TRUCK -> ${vehicle.id}`);
                }
            }
        }
        // CASE B: TRUCK IMPORT (Pick from Yard)
        else if (job.type === 'TRUCK_IMPORT') {
            // Pick from Stack
            // job.sourceZone is the block. Use yardManager to find container.
            // Ideally we need specific coordinates (Bay/Row). 
            // For simulation, we just "acquire" it.
            vehicle.carriedContainer = job.containerId;
            // Remove from yard logic (conceptual). 
            // In a real sim we would call yard.removeContainer(id)...
            console.log(`[Job] Container ${job.containerId} picked from YARD by ${vehicle.id}`);
        }

        // Transition
        job.status = JobStatus.IN_PROGRESS;
        vehicle.status = 'Transporting';
        vehicle.currentZone = job.targetZone; // Set destination for pathfinding
    }

    _performDropoff(job, vehicle) {
        console.log(`[Job] Performing DROPOFF for ${job.id}`);

        // CASE A: TRUCK EXPORT (Drop to Yard)
        if (job.type === 'TRUCK_EXPORT') {
            // Drop in Yard
            vehicle.carriedContainer = null;
            // Add to Yard Logic:
            // yard.addContainer(...)
            // We need to pick a random spot in the target block.
            // Simulating:
            this.yardManager.addContainer(
                { id: job.containerId, type: 'Standard' }, // Re-create obj
                job.targetZone,
                Math.floor(Math.random() * 10) + 1,
                Math.floor(Math.random() * 5) + 1
            );
            console.log(`[Job] Container ${job.containerId} stored in ${job.targetZone}`);
        }
        // CASE B: TRUCK IMPORT (Drop to Truck)
        else if (job.type === 'TRUCK_IMPORT') {
            vehicle.carriedContainer = null;
            const truckManager = window.truckManager;
            // Find waiting truck? 
            // Logic: The truck waiting for this container.
            if (truckManager) {
                const truck = truckManager.getTrucks().find(t => t.targetContainerId === job.containerId);
                if (truck) {
                    truck.containerId = job.containerId; // Loaded!
                    truck.targetContainerId = null;
                    console.log(`[Job] Container ${job.containerId} loaded onto TRUCK ${truck.id}`);
                }
            }
        }

        this.completeJob(job.id);
    }

    completeJob(jobId) {
        const job = this.jobs.find(j => j.id === jobId);
        if (job) {
            job.status = JobStatus.COMPLETED;

            // Release Vehicle
            if (job.assignedVehicleId) {
                const vehicle = this.fleetManager.getVehicle(job.assignedVehicleId);
                if (vehicle) {
                    vehicle.currentJobId = null;
                    vehicle.carriedContainer = null; // Clear payload

                    // Return to Base Logic
                    if (vehicle.deployedZone && vehicle.deployedZone !== vehicle.currentZone) {
                        console.log(`[JobManager] Sending ${vehicle.id} back to base: ${vehicle.deployedZone}`);
                        vehicle.status = 'Returning';
                        vehicle.currentZone = vehicle.deployedZone;
                        // App.js will detect change in currentZone and animate
                        // Once arrived, app.js or a timeout should set it to Idle? 
                        // Actually app.js just moves marker. We might need a listener or just let it be 'Returning' until next job.
                        // For simplicity, let's keep it 'Returning' until it arrives, handled by app.js animation end?
                        // No, app.js doesn't update status.
                        // Let's set a timeout to reset to Idle after travel?
                        // Or just leave it as 'Returning' (which is visible) and it's fine.
                        // Or better: 'Active' status is generic enough.
                        vehicle.status = 'Active';
                    } else {
                        vehicle.status = 'Idle';
                    }
                }
            }
            console.log(`[JobManager] Job ${jobId} COMPLETED.`);
        }
    }
}
