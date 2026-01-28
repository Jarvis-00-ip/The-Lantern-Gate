import { Yard, Container, ContainerType } from './src/core/yardManager.js';

console.log("Testing Yard Manager...");

const yard = new Yard();
const bay = 1;
const row = 1;

// Add containers
const c1 = new Container("CONT001", ContainerType.STANDARD);
const c2 = new Container("CONT002", ContainerType.REEFER);
const c3 = new Container("CONT003", ContainerType.IMO);

console.log(`Adding ${c1.id}: ${yard.addContainer(c1, bay, row)}`); // Should be true (Tier 0)
console.log(`Adding ${c2.id}: ${yard.addContainer(c2, bay, row)}`); // Should be true (Tier 1)
console.log(`Adding ${c3.id}: ${yard.addContainer(c3, bay, row)}`); // Should be true (Tier 2)

// Verify digging penalty
// Target c1 (Tier 0). Containers above: c2 (Tier 1), c3 (Tier 2). Penalty should be 2.
const penalty0 = yard.calculateDiggingPenalty(bay, row, 0);
console.log(`Digging penalty for Tier 0 (expected 2): ${penalty0}`);

if (penalty0 !== 2) {
    console.error("❌ Test Failed: Penalty for Tier 0 should be 2");
} else {
    console.log("✅ Test Passed: Penalty logic seems correct.");
}

// Target c2 (Tier 1). Containers above: c3 (Tier 2). Penalty should be 1.
const penalty1 = yard.calculateDiggingPenalty(bay, row, 1);
console.log(`Digging penalty for Tier 1 (expected 1): ${penalty1}`);
if (penalty1 !== 1) {
    console.error("❌ Test Failed: Penalty for Tier 1 should be 1");
} else {
    console.log("✅ Test Passed: Penalty logic seems correct.");
}
