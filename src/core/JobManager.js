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
    constructor(fleetManager, yardManager) {
        this.fleetManager = fleetManager;
        this.yardManager = yardManager;
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

        // Determine required vehicle type
        let requiredType = 'Reach Stacker';
        // Logic could be more complex (e.g. Straddles for some zones)

        // Find Target Position for finding nearest
        const targetZone = job.sourceZone; // Vehicle must go to Source to pick up (or interact)
        const targetPos = this.yardManager.geoManager.getZoneCenter(targetZone);

        if (!targetPos) return false;

        const vehicle = this.fleetManager.findNearestVehicle(requiredType, targetPos, this.yardManager.geoManager);

        if (vehicle) {
            job.status = JobStatus.ASSIGNED;
            job.assignedVehicleId = vehicle.id;

            vehicle.status = 'Job Assigned';
            vehicle.currentJobId = jobId;
            vehicle.currentZone = targetZone; // Send vehicle to zone (teleport/move logic in app.js handles this)

            // Note: In app.js renderVehicles, if status is 'Job Assigned', it should move to 'currentZone'.

            console.log(`[JobManager] Assigned ${jobId} to ${vehicle.id} (Nearest)`);
            return true;
        }
        return false;
    }

    completeJob(jobId) {
        const job = this.jobs.find(j => j.id === jobId);
        if (job) {
            job.status = JobStatus.COMPLETED;

            // Release Vehicle
            if (job.assignedVehicleId) {
                const vehicle = this.fleetManager.getVehicle(job.assignedVehicleId);
                if (vehicle) {
                    vehicle.status = 'Idle';
                    vehicle.currentJobId = null;
                    vehicle.carriedContainer = null; // Clear payload
                }
            }
            console.log(`[JobManager] Job ${jobId} COMPLETED.`);
        }
    }
}
