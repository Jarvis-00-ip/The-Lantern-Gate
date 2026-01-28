import { Yard, Container, ContainerType } from '../core/yardManager.js';
import { GeoManager } from '../core/GeoManager.js';
import { ControlPanel } from './controlPanel.js';
import { FloatingInspector } from './FloatingInspector.js';
import { FleetManager } from '../core/FleetManager.js';
import { DepotUI } from './DepotUI.js';

console.log("Initializing The Lantern Gate UI (Geospatial Mode)...");

// --- 1. System Initialization ---
const yard = new Yard();
const geoManager = new GeoManager();
const inspector = new FloatingInspector('yard-container');

// New Vehicle Systems
const fleetManager = new FleetManager();
const depotUI = new DepotUI('yard-container', fleetManager, geoManager);

// --- 2. Map Setup (Leaflet) ---
const map = L.map('map-view', {
    center: [44.4065, 8.9080], // PSA SECH Center
    zoom: 17,
    zoomControl: false,
    preferCanvas: true
});

// Satellite Layer (Esri World Imagery)
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri',
    maxZoom: 19
}).addTo(map);

// Labels Overlay
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19
}).addTo(map);

// Container Overlay Group
const containerLayer = L.layerGroup().addTo(map);

// --- 3. Interaction & Rendering Logic ---

// --- VISUAL EDITOR (Geoman) ---
// Configure Geoman (Hidden by default)
map.pm.setGlobalOptions({
    limitMarkersToCount: 4, // optimized for rectangles/quads
    snapDistance: 15,
});

// Toggle controls based on mode
const updateEditorMode = (enabled) => {
    map.pm.addControls({
        position: 'topleft',
        drawCircle: false,
        drawCircleMarker: false,
        drawLine: false,
        drawMarker: false,
        drawPolygon: true,
        drawRectangle: true,
        editMode: true,
        dragMode: true,
        cutPolygon: false,
        removalMode: true
    });

    if (!enabled) {
        map.pm.removeControls();
        map.pm.disableGlobalEditMode();
    }
};

// Start hidden
map.pm.removeControls();

// Log Coordinates on Change
map.on('pm:create', (e) => {
    console.log("Zone Created:", e.layer);
    logZoneCoordinates(e.layer);

    e.layer.on('pm:edit', () => logZoneCoordinates(e.layer));
    e.layer.on('pm:dragend', () => logZoneCoordinates(e.layer));
    e.layer.on('pm:rotateend', () => logZoneCoordinates(e.layer));
});

const logZoneCoordinates = (layer) => {
    // Get LatLngs
    const latlngs = layer.getLatLngs()[0];

    // Format for GeoManager
    const coords = latlngs.map(p => ({ lat: parseFloat(p.lat.toFixed(6)), lng: parseFloat(p.lng.toFixed(6)) }));

    const jsonOutput = JSON.stringify(coords, null, 2);
    console.log("COORD JSON:", jsonOutput);

    layer.bindPopup(`<textarea style="width:250px; height:100px;">${jsonOutput}</textarea>`).openPopup();
};

// Mode Toggle Logic
const modeSwitch = document.getElementById('mode-switch');
const modeLabel = document.getElementById('mode-label');

if (modeSwitch) {
    modeSwitch.addEventListener('change', (e) => {
        const isMapping = e.target.checked;
        modeLabel.textContent = isMapping ? "MAPPING MODE" : "TEST MODE";
        modeLabel.style.color = isMapping ? "#ff7800" : "var(--text-secondary)";

        updateEditorMode(isMapping);
        console.log("Editor Mode:", isMapping);

        // Re-render to clear/restore layers if needed
        renderApp();
    });
}


// Main Render Function: Draws zones on the map
const renderApp = () => {
    if (!modeSwitch || !modeSwitch.checked) {
        containerLayer.clearLayers();

        const zones = geoManager.getZones();

        zones.forEach(zone => {
            let latLngs = [];
            if (zone.vertices) latLngs = zone.vertices.map(p => [p.lat, p.lng]);
            else {
                const polygon = geoManager.getZonePolygon(zone.id);
                if (polygon) latLngs = polygon.map(p => [p.lat, p.lng]);
            }
            if (latLngs.length === 0) return;

            // Style
            let color = '#3388ff';
            let opacity = 0.5;
            let dashArray = null;

            switch (zone.type) {
                case 'REEFER':
                    color = '#00CED1'; // Dark Turquoise
                    opacity = 0.6;
                    break;
                case 'IMO':
                    color = '#FF4500'; // Orange Red
                    opacity = 0.6;
                    break;
                case 'DAMAGED':
                    color = '#8B4513'; // Saddle Brown
                    opacity = 0.7;
                    break;
                case 'CRANE_AREA':
                    color = '#4169E1'; // Royal Blue
                    opacity = 0.4;
                    break;
                case 'STANDARD':
                    color = '#1f6feb'; // GitHub Blue
                    opacity = 0.5;
                    break;
                case 'LOADING':
                    color = '#FFD700'; // Gold
                    opacity = 0.3;
                    dashArray = '5, 5'; // Dashed line for transition areas
                    break;
                case 'GATE':
                    color = '#32CD32'; // Lime Green
                    opacity = 0.4;
                    break;
                case 'RAIL':
                    color = '#696969'; // Dim Gray
                    opacity = 0.5;
                    break;
                case 'QUAY':
                    color = '#708090'; // Slate Gray
                    opacity = 0.2;
                    break;
                case 'BUILDING':
                    color = '#2F4F4F'; // Dark Slate Gray
                    opacity = 0.8;
                    break;
                case 'DEPOT':
                    color = '#8A2BE2'; // Blue Violet
                    opacity = 0.4;
                    break;
            }

            L.polygon(latLngs, {
                color: "#111",
                weight: 1,
                fillColor: color,
                fillOpacity: opacity,
                dashArray: dashArray
            })
                .addTo(containerLayer)
                .bindTooltip(zone.id, { permanent: true, direction: "center" })
                .on('click', function (e) {
                    // 'this' refers to the Leaflet Layer (Polygon) here because we are in a classic function (or we use e.target)
                    handleZoneClick(zone, this);
                });
        });
    }
};

// Global reference for highlighting
let selectedLayer = null;

// Handler for Zone Clicks
const handleZoneClick = (zone, layer) => {
    console.log(`Clicked Zone ${zone.id} (${zone.type})`);

    // 1. Highlight Logic
    if (selectedLayer) {
        selectedLayer.setStyle({ color: '#111', weight: 1, fillOpacity: 0.5 }); // Reset old
    }

    selectedLayer = layer;

    // Highlight Style (Yellow Border, higher opacity)
    layer.setStyle({
        color: '#FFD700', // Gold border
        weight: 3,
        fillOpacity: 0.7
    });

    layer.bringToFront(); // Ensure highlight is visible

    // 2. Logic Branch
    if (zone.type === 'DEPOT') {
        inspector.hide();
        depotUI.show();
        console.log("Opening Depot UI");
    } else {
        depotUI.hide();

        // Standard Zone Logic
        const containers = yard.getContainersInZone(zone.id);
        inspector.showZone(zone.id, containers);
        controls.setZone(zone.id);
    }
};

// Handler for Clicks
const handleContainerClick = (bay, row, stack) => {
    console.log(`Clicked Bay ${bay}, Row ${row}`);
    // Show Floating UI
    inspector.show(bay, row, stack);
    // Update Control Panel inputs
    controls.setTarget(bay, row);
};

// --- 4. Integration with Control Panel ---

// Mock Renderer to satisfy ControlPanel constructor
// (The Control Panel expects a renderer to call 'selectStack' etc.)
const mockRenderer = {
    selectStack: (bay, row) => {
        // In the future, we can add selection highlights to the map here
        console.log(`Map Selection: ${bay}-${row}`);
        renderApp(); // Re-render to show updates if needed
    },
    setOnStackClick: (callback) => {
        // Not used, we handle clicks directly in Leaflet layer
    },
    updateSelectionPanel: () => { } // Deprecated, handled by inspector/controls
};

// Callback for Control Panel when it needs to refresh UI
const updateInfo = (bay, row) => {
    // Determine current zone from controls
    const zoneId = controls.currentZoneId;
    if (!zoneId) return;

    // Refresh Inspector with full zone data (since we are showing zone-level view mostly)
    // Or if we implemented single stack view, we would fetch that.
    // For now, let's refresh the whole zone inspector
    const containers = yard.getContainersInZone(zoneId);
    inspector.showZone(zoneId, containers);

    // Future: Highlight the specific stack on the map?
};

// Init Control Panel
const controls = new ControlPanel(yard, mockRenderer, renderApp, updateInfo);
// Populate Dropdown
controls.populateZones(geoManager.getZones());


// --- 5. Mock Data & Startup ---
function initMockData() {
    console.log("Loading mock data for ALL zones...");

    const zones = geoManager.getZones();

    zones.forEach(zone => {
        // Filter: Only add containers to valid storage areas
        const storageTypes = ['STANDARD', 'REEFER', 'IMO', 'DAMAGED', 'DEPOT'];
        if (!storageTypes.includes(zone.type)) return;

        // Determine hypothetical rows/bays based on capacity
        // For visual test, we just pick random spots
        const capacity = geoManager.getZoneCapacity(zone.id);
        const maxB = Math.min(10, capacity.bays); // Cap for performance demo
        const maxR = Math.min(5, capacity.rows);

        // Populate randomly
        const fillRate = 0.3; // 30% full

        for (let b = 1; b <= maxB; b++) {
            for (let r = 1; r <= maxR; r++) {
                if (Math.random() < fillRate) {
                    let type = ContainerType.STANDARD;
                    if (zone.type === 'REEFER') type = ContainerType.REEFER;
                    else if (zone.type === 'IMO') type = ContainerType.IMO;

                    yard.addContainer(new Container(`CNT-${zone.id.substring(0, 3)}-${b}${r}`, type), zone.id, b, r);

                    // Stack some
                    if (Math.random() > 0.7) {
                        yard.addContainer(new Container(`TOP-${zone.id.substring(0, 3)}-${b}${r}`, type), zone.id, b, r);
                    }
                }
            }
        }
    });
}

// Start
initMockData();
renderApp();
console.log("UI Ready - Leaflet Map Active.");
