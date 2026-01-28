import { Yard, Container, ContainerType } from '../core/yardManager.js';
import { YardRenderer } from './renderer.js';
import { ControlPanel } from './controlPanel.js';

console.log("Initializing The Lantern Gate UI...");

// Initialize System
const yard = new Yard();
const renderer = new YardRenderer(yard, 'yard-view');

// Render Function
const renderApp = () => {
    renderer.render(5, 4);
};

// Selection Update Function
const updateInfo = (bay, row) => {
    renderer.updateSelectionPanel(bay, row);
};

// Initialize Control Panel
const controls = new ControlPanel(yard, renderer, renderApp, updateInfo);

// Connect Click Event: Grid -> Control Panel
renderer.setOnStackClick((bay, row) => {
    controls.setTarget(bay, row);
});

// Mock Data Load (Simulate a busy yard)
function initMockData() {
    console.log("Loading initial container data...");

    // Bay 1, Row 1: Full stack of mixed types
    yard.addContainer(new Container("MSCU9823", ContainerType.STANDARD), 1, 1);
    yard.addContainer(new Container("MSCU1122", ContainerType.IMO), 1, 1); // Dangerous in the middle!
    yard.addContainer(new Container("MSCU4455", ContainerType.STANDARD), 1, 1);

    // Bay 2, Row 1: Reefers
    yard.addContainer(new Container("MAEU2233", ContainerType.REEFER), 2, 1);
    yard.addContainer(new Container("MAEU9988", ContainerType.REEFER), 2, 1);

    // Scattered
    yard.addContainer(new Container("COSU1234", ContainerType.STANDARD), 3, 2);
    yard.addContainer(new Container("HAPU5566", ContainerType.STANDARD), 5, 4);

    // Bay 4, Row 2: High stack
    yard.addContainer(new Container("CMAU1111", ContainerType.STANDARD), 4, 2);
    yard.addContainer(new Container("CMAU2222", ContainerType.STANDARD), 4, 2);
    yard.addContainer(new Container("CMAU3333", ContainerType.STANDARD), 4, 2);
    yard.addContainer(new Container("CMAU4444", ContainerType.STANDARD), 4, 2);
}

// Initial Render
initMockData();
renderApp(); // Initial render

console.log("UI Ready.");
