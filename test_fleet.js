
import { FleetManager, VehicleType, VehicleStatus } from './src/core/FleetManager.js';
import { LayoutManager, ZoneType } from './src/core/LayoutManager.js';

console.log("=== Testing Fleet Manager Deployment Logic ===");

const fleet = new FleetManager();
const layout = new LayoutManager();

const rallaId = 'R-101';
const stackerId = 'RS-21';

// Test 1: Deploy Ralla to Quay (Allowed)
console.log(`\nTest 1: Deploying ${rallaId} to QUAY...`);
const success1 = fleet.deployVehicleToZone(rallaId, ZoneType.QUAY, layout);
const v1 = fleet.getVehicle(rallaId);
if (success1 && v1.status === VehicleStatus.ACTIVE && v1.position.x !== 0) {
    console.log("PASS: Ralla deployed to Quay successfully.");
    console.log(`Position: X=${v1.position.x.toFixed(2)}, Y=${v1.position.y.toFixed(2)}`);
} else {
    console.error("FAIL: Ralla deployment failed.");
}

// Test 2: Deploy Reach Stacker to Water (Forbidden)
console.log(`\nTest 2: Deploying ${stackerId} to WATER...`);
const success2 = fleet.deployVehicleToZone(stackerId, ZoneType.WATER, layout);
if (!success2) {
    console.log("PASS: Reach Stacker correctly blocked from Water.");
} else {
    console.error("FAIL: Reach Stacker allowed in Water!");
}

// Test 3: Deploy Reach Stacker to Yard (Allowed)
console.log(`\nTest 3: Deploying ${stackerId} to YARD...`);
const success3 = fleet.deployVehicleToZone(stackerId, ZoneType.YARD, layout);
const v3 = fleet.getVehicle(stackerId);
if (success3 && v3.status === VehicleStatus.ACTIVE) {
    console.log("PASS: Reach Stacker deployed to Yard.");
    console.log(`Position: X=${v3.position.x.toFixed(2)}, Y=${v3.position.y.toFixed(2)}`);
} else {
    console.error("FAIL: Reach Stacker deployment to Yard failed.");
}

// Test 4: Recall Vehicle
console.log(`\nTest 4: Recalling ${rallaId}...`);
fleet.recallVehicle(rallaId);
const v4 = fleet.getVehicle(rallaId);
if (v4.status === VehicleStatus.IDLE && v4.position.x === 0) {
    console.log("PASS: Vehicle recalled and position reset.");
} else {
    console.error("FAIL: Recall logic failed.");
}
