export const JobType = {
    DISCHARGE: 'DISCHARGE', // Ship -> Yard
    LOAD: 'LOAD',           // Yard -> Ship
    MOVE: 'MOVE',           // Yard -> Yard / Gate -> Yard
    SHUFFLE: 'SHUFFLE'      // Digging move
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

    // Simplistic Dispatcher (Phase 1)
    // In Phase 2 this will become smarter (proximity, vehicle capabilities)
    assignJob(jobId, vehicleId) {
        const job = this.jobs.find(j => j.id === jobId);
        const vehicle = this.fleetManager.getVehicle(vehicleId);

        if (job && vehicle && job.status === JobStatus.PENDING && vehicle.status === 'Idle') {
            job.status = JobStatus.ASSIGNED;
            job.assignedVehicleId = vehicleId;

            // Update Vehicle Status (Phase 1: Direct link)
            vehicle.status = 'Job Assigned'; // Custom status
            vehicle.currentJobId = jobId;

            console.log(`[JobManager] Assigned ${jobId} to ${vehicleId}`);
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
