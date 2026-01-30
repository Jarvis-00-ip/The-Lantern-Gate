import { Yard, Container, ContainerType } from '../core/yardManager.js';
import { GeoManager } from '../core/GeoManager.js';
import { ControlPanel } from './controlPanel.js';
import { FloatingInspector } from './FloatingInspector.js';
import { FleetManager } from '../core/FleetManager.js';
import { DepotUI } from './DepotUI.js';
import { PathFinder } from '../core/PathFinder.js';
import { ROAD_NETWORK } from '../core/RoadNetworkData.js';
import { VesselManager } from '../core/VesselManager.js';
import { JobManager } from '../core/JobManager.js';
import { TruckManager } from '../core/TruckManager.js';
import { MainMenu } from './MainMenu.js';
import { TOSDashboard } from './TOSDashboard.js';

console.log("Initializing The Lantern Gate UI (Geospatial Mode)...");

if (typeof L === 'undefined') {
    alert("CRITICAL ERROR: Leaflet (L) is not defined. Check your internet connection or CDN links.");
}

try {


    // --- 1. System Initialization ---
    const yard = new Yard();
    const geoManager = new GeoManager();
    const inspector = new FloatingInspector('yard-container');
    const fleetManager = new FleetManager();
    const vesselManager = new VesselManager();
    const jobManager = new JobManager(fleetManager, yard, geoManager);
    const truckManager = new TruckManager(geoManager, jobManager, yard);

    // Expose Global API
    window.yard = yard;
    window.fleet = fleetManager;
    window.vesselManager = vesselManager;
    window.jobManager = jobManager;
    window.truckManager = truckManager;
    window.geo = geoManager;

    // ...

    // Truck Renderer moved to bottom to ensure dependencies (PathFinder) are initialized.

    // Update Animation Loop to include trucks
    // ...

    // New Vehicle Systems
    // Initialize PathFinder when ready (needs zones, so usually after geomanager loads, but for now we assume sync)
    // Actually zones are static in GeoManager for MVP, so fine.
    const pathFinder = new PathFinder(geoManager);

    // --- 2. Map Setup (Leaflet) ---
    const map = L.map('map-view', {
        center: [44.4065, 8.9080], // PSA SECH Center
        zoom: 17,
        zoomControl: false,
        preferCanvas: true
    });

    // Base Layers
    const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri',
        maxZoom: 19
    });

    const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map); // Default to OSM

    const baseMaps = {
        "Map (OSM)": osm,
        "Satellite (Esri)": satellite
    };

    L.control.layers(baseMaps).addTo(map);

    // DEBUG: Draw Road Graph
    const debugLayer = L.layerGroup(); // Optional: addTo(map) to see lines
    // To enable debug, uncomment next line or toggle in console
    debugLayer.addTo(map);

    if (pathFinder.nodes.length > 0) {
        console.log("Drawing Debug Graph...", pathFinder.graph);
        pathFinder.nodes.forEach(node => {
            // Visualize only nodes to save performance, or limited edges
            L.circleMarker([node.lat, node.lng], { radius: 1, color: 'cyan', fillOpacity: 0.5 }).addTo(debugLayer);

            // Only draw a few connections to verify mesh (too many lines kills Leaflet canvas)
            const neighbors = pathFinder.graph.get(node.id) || [];
            neighbors.forEach(n => {
                // Only draw if short distance to avoid clutter
                if (n.weight < 50) {
                    L.polyline([[node.lat, node.lng], [n.node.lat, n.node.lng]], { color: 'rgba(0,255,255,0.1)', weight: 1 }).addTo(debugLayer);
                }
            });
        });
    }

    // Labels Overlay
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19
    }).addTo(map);

    // Container Overlay Group
    const containerLayer = L.layerGroup().addTo(map);
    // Vehicle Overlay Group
    const vehicleLayer = L.layerGroup().addTo(map);

    // --- 3. Interaction & Rendering Logic ---

    // --- VISUAL EDITOR (Geoman) ---
    // Configure Geoman (Hidden by default)
    if (map.pm) {
        map.pm.setGlobalOptions({
            limitMarkersToCount: 4, // optimized for rectangles/quads
            snapDistance: 15,
        });
    }

    const logZoneCoordinates = (layer) => {
        // Get LatLngs
        let latlngs = layer.getLatLngs();

        // Safety: If it's a Line (array of points) or Polygon (array of rings)
        // Polygon: [[{lat,lng}, ...]] -> We want [0]
        // Line: [{lat,lng}, ...] -> We want strict array

        if (Array.isArray(latlngs) && latlngs.length > 0) {
            // Check if the first element is a LatLng object (Line) or Array (Polygon)
            if (Array.isArray(latlngs[0])) {
                latlngs = latlngs[0]; // Extract first ring of polygon
            }
        }

        if (!latlngs || !Array.isArray(latlngs) || latlngs.length === 0 || !latlngs[0].lat) {
            console.log("Selection is not a typical Polygon or Line.");
            return;
        }

        // Format for GeoManager
        const coords = latlngs.map(p => ({ lat: parseFloat(p.lat.toFixed(6)), lng: parseFloat(p.lng.toFixed(6)) }));
        const jsonOutput = JSON.stringify(coords, null, 2);
        console.log("COORD JSON:", jsonOutput);
        layer.bindPopup(`<textarea style="width:250px; height:100px;">${jsonOutput}</textarea>`).openPopup();
    };

    // Toggle controls based on mode
    const updateEditorMode = (enabled) => {
        if (!map.pm) return;

        map.pm.addControls({
            position: 'topleft',
            drawCircle: false,
            drawCircleMarker: false,
            drawLine: true, // ENABLED for Manual Roads
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
    if (map.pm) map.pm.removeControls();

    // Store Manual Roads (Load from Persistence)
    // Structure: { path: LatLngs[], properties: { oneWay: boolean } }
    const manualRoads = [...ROAD_NETWORK];
    const roadLayerGroup = L.layerGroup().addTo(map);

    // Helper: Add Arrow Decorator for One-Way
    const addArrow = (polyline, color) => {
        const latlngs = polyline.getLatLngs();
        if (latlngs.length < 2) return;

        // Get middle segment
        const midIndex = Math.floor(latlngs.length / 2);
        const p1 = latlngs[midIndex];
        const p2 = latlngs[midIndex + 1] || latlngs[midIndex - 1]; // Fallback

        if (!p1 || !p2) return;

        // Calculate bearing
        const dx = p2.lng - p1.lng;
        const dy = p2.lat - p1.lat;
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);

        // Create Arrow Icon
        const arrowIcon = L.divIcon({
            className: 'road-arrow',
            html: `<div style="transform: rotate(${90 - angle}deg); font-size: 20px; color: ${color}; font-weight: bold; text-shadow: 0 0 2px black;">⬇</div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        });

        return L.marker(p1, { icon: arrowIcon, interactive: false });
    };

    // Render Function for Roads
    const renderRoads = () => {
        roadLayerGroup.clearLayers();

        // Check Mode: Hide roads in Test Mode (unless user explicitly wants them, but assumed 'Realistic' view)
        // User Request: "Show only in test mode" -> interpreted as "Show only in MAPPING mode" (Editing)
        // because hiding them in Mapping Mode would break editing.
        const isMapping = document.getElementById('mode-switch')?.checked;
        if (!isMapping) return; // Hide visuals in Test/Simulation Mode

        manualRoads.forEach(road => {
            const props = road.properties || {};
            const isOneWay = props.oneWay || false;
            const type = props.type || 'unknown';

            // Default Style (Standard Roads)
            // Toned down colors: Tomato instead of OrangeRed
            let color = isOneWay ? '#FF6347' : '#FFD700';
            let weight = 4;
            let dashArray = '10, 5';
            let opacity = 0.6; // Slightly more transparent

            // Type-Specific Styling
            if (type.includes('rail') || type === 'train') {
                color = '#444444'; // Dark Grey for Rails
                weight = 3;
                dashArray = '2, 2'; // Tight dash for tracks
            } else if (type === 'footway' || type === 'pedestrian' || type === 'steps') {
                color = '#00FF7F'; // SpringGreen for walkways
                weight = 2;
                dashArray = '5, 5';
            } else if (type === 'service') {
                color = '#CCCCCC'; // Light Grey for service roads
                weight = 3;
                dashArray = '5, 10'; // Sparse dash
            }

            // Draw Line
            const polyline = L.polyline(road.path, {
                color: color,
                dashArray: dashArray,
                weight: weight,
                opacity: opacity
            }).addTo(roadLayerGroup);

            // Bind Data
            const typeLabel = type !== 'unknown' ? `Type: ${type}` : '';
            polyline.bindTooltip(`${typeLabel}${isOneWay ? ' (One-Way)' : ''}`);
            polyline.roadData = road;

            // Add Arrow if OneWay
            if (isOneWay && !type.includes('rail') && !type.includes('foot')) {
                const arrow = addArrow(polyline, color);
                if (arrow) arrow.addTo(roadLayerGroup);
            }

            // Click Interaction to Toggle
            if (map.pm && map.pm.globalEditModeEnabled()) {
                polyline.on('click', (e) => {
                    const confirmToggle = confirm(`Toggle One-Way?\nCurrent: ${isOneWay ? "YES" : "NO"}\nType: ${type}`);
                    if (confirmToggle) {
                        if (!road.properties) road.properties = {};
                        road.properties.oneWay = !road.properties.oneWay;
                        renderRoads(); // Re-render logic
                        // Update PathFinder
                        pathFinder.setManualMode(true);
                        pathFinder.updateGraphFromPolylines(manualRoads);
                    }
                });
            }
        });
    };

    renderRoads();

    // Initialize PathFinder with Persistent Roads
    if (manualRoads.length > 0) {
        pathFinder.setManualMode(true);
        pathFinder.updateGraphFromPolylines(manualRoads);
    }

    // Log Coordinates on Change
    if (map.pm) {
        map.on('pm:create', (e) => {
            console.log("Created:", e.shape, e.layer);

            if (e.shape === 'Line') {
                const latlngs = e.layer.getLatLngs();

                // New Road Object
                const newRoad = {
                    path: latlngs.map(p => ({ lat: p.lat, lng: p.lng })), // Clean LatLng
                    properties: { oneWay: false }
                };

                manualRoads.push(newRoad);
                console.log("Road Segment Added. Total:", manualRoads.length);

                // Remove the raw edited layer and let our renderer handle it (to unify logic)
                e.layer.remove();

                renderRoads();

                // Update PathFinder Live
                pathFinder.setManualMode(true);
                pathFinder.updateGraphFromPolylines(manualRoads);

            } else {
                logZoneCoordinates(e.layer);
            }

            e.layer.on('pm:edit', () => { if (e.shape !== 'Line') logZoneCoordinates(e.layer) });
        });

        // Re-bind clicks when mode changes
        map.on('pm:globaleditmodetoggled', (e) => {
            renderRoads(); // Refresh to attach/detach click listeners
        });
    }

    // Export Button Logic
    const createExportButton = () => {
        const btn = document.createElement('button');
        btn.innerHTML = '💾 Export Roads';
        btn.className = 'btn btn-primary';
        btn.style.position = 'absolute';
        btn.style.top = '10px';
        btn.style.right = '200px'; // Next to mode switch
        btn.style.zIndex = '1000';
        btn.style.display = 'none'; // Hidden by default
        btn.id = 'btn-export-roads';

        btn.onclick = () => {
            const json = JSON.stringify(manualRoads, null, 2);
            console.log(json);
            // Copy to clipboard or alert
            navigator.clipboard.writeText(json).then(() => {
                alert("Road Network JSON copied to clipboard!");
            });
        };
        document.body.appendChild(btn);
        return btn;
    };

    const exportBtn = createExportButton();

    // OSM Import Logic
    const createImportButton = () => {
        const btn = document.createElement('button');
        btn.innerHTML = '⬇️ Import OSM';
        btn.className = 'btn btn-secondary'; // Distinct style
        btn.style.position = 'absolute';
        btn.style.top = '10px';
        btn.style.right = '340px'; // Left of Export
        btn.style.zIndex = '1000';
        btn.style.display = 'none'; // Hidden by default
        btn.id = 'btn-import-osm';

        btn.onclick = async () => {
            if (map.getZoom() < 15) {
                alert("Area too large! Please zoom in to at least level 15 to avoid overloading the server.");
                return;
            }

            const confirmImport = confirm("⚠️ This will OVERWRITE your current manual roads with data from OpenStreetMap. Continue?");
            if (!confirmImport) return;

            btn.disabled = true;
            btn.innerHTML = '⏳ Loading...';

            try {
                // Get bounds (or use fixed port area for safety)
                const bounds = map.getBounds();
                const s = bounds.getSouth();
                const w = bounds.getWest();
                const n = bounds.getNorth();
                const e = bounds.getEast();

                // Overpass Query: customizable filter (highway=service is common in terminals)
                // Added timeout:180 to prevent 504 errors on large datasets
                const query = `
                    [out:json][timeout:180];
                    (
                      way["highway"](${s},${w},${n},${e});
                      way["railway"](${s},${w},${n},${e});
                    );
                    out geom;
                `;

                console.log("Fetching OSM Data with query:", query);

                const response = await fetch('https://overpass-api.de/api/interpreter', {
                    method: 'POST',
                    body: query
                });

                if (!response.ok) throw new Error(`OSM API Error: ${response.statusText}`);

                const data = await response.json();
                console.log("OSM Data Received:", data);

                if (!data.elements || data.elements.length === 0) {
                    alert("No roads found in this area on OSM.");
                    return;
                }

                // Clear current
                manualRoads.length = 0;

                // Process Elements
                let count = 0;
                data.elements.forEach(el => {
                    if (el.type === 'way' && el.geometry) {
                        // 1. Convert Geometry
                        let path = el.geometry.map(p => ({ lat: p.lat, lng: p.lon }));

                        // 2. Parse Properties
                        let isOneWay = false;
                        if (el.tags) {
                            if (el.tags.oneway === '-1') {
                                isOneWay = true;
                                path.reverse(); // Reverse geometry for correct flow
                            } else if (el.tags.oneway === 'yes' || el.tags.oneway === 'true' || el.tags.oneway === '1') {
                                isOneWay = true;
                            } else if (el.tags.junction === 'roundabout' || el.tags.junction === 'circular') {
                                isOneWay = true;
                            }
                        }

                        const type = el.tags.highway || el.tags.railway || 'unknown';

                        const excludedTypes = ['construction', 'proposed', 'razed', 'abandoned', 'disused', 'demolished'];
                        if (excludedTypes.includes(type)) {
                            return; // Skip this segment
                        }

                        manualRoads.push({
                            path: path,
                            properties: {
                                oneWay: isOneWay,
                                osmId: el.id,
                                type: type
                            }
                        });
                        count++;
                    }
                });

                console.log(`Imported ${manualRoads.length} segments from OSM.`);

                // Re-render
                renderRoads();

                // Update PathFinder
                pathFinder.setManualMode(true);
                pathFinder.updateGraphFromPolylines(manualRoads);

                alert(`Successfully imported ${count} road segments from OpenStreetMap!`);

            } catch (err) {
                console.error("OSM Import Failed:", err);
                alert(`Import Failed: ${err.message}`);
            } finally {
                btn.disabled = false;
                btn.innerHTML = '⬇️ Import OSM';
            }
        };

        document.body.appendChild(btn);
        return btn;
    };

    const importBtn = createImportButton();

    // Bulk Spawn Button
    const createBulkSpawnButton = () => {
        const btn = document.createElement('button');
        btn.innerHTML = '🚛 Spawn Trucks';
        btn.className = 'btn btn-success'; // Green
        btn.style.position = 'absolute';
        btn.style.top = '10px';
        btn.style.right = '480px'; // Left of Import
        btn.style.zIndex = '1000';
        btn.id = 'btn-bulk-spawn';

        btn.onclick = () => {
            const countStr = prompt("How many trucks to spawn?", "5");
            const count = parseInt(countStr);
            if (!isNaN(count) && count > 0) {
                let spawned = 0;
                const interval = setInterval(() => {
                    const t = truckManager.spawnTruck();
                    if (t) spawned++;
                    if (spawned >= count) clearInterval(interval);
                }, 1500); // 1.5s delay between spawns
            }
        };
        document.body.appendChild(btn);
        return btn;
    };
    const bulkSpawnBtn = createBulkSpawnButton();

    // Mode Toggle Logic
    const modeSwitch = document.getElementById('mode-switch');
    const modeLabel = document.getElementById('mode-label');

    if (modeSwitch) {
        modeSwitch.addEventListener('change', (e) => {
            const isMapping = e.target.checked;
            modeLabel.textContent = isMapping ? "MAPPING MODE" : "TEST MODE";
            modeLabel.style.color = isMapping ? "#ff7800" : "var(--text-secondary)";

            updateEditorMode(isMapping);
            renderRoads(); // Refresh visibility based on mode
            exportBtn.style.display = isMapping ? 'block' : 'none';
            importBtn.style.display = isMapping ? 'block' : 'none';
            console.log("Editor Mode:", isMapping);

            // Re-render to clear/restore layers if needed
            renderApp();
        });
    }

    // Debug Traces Store
    const debugTraceLayers = {};

    // Main Render Function: Draws zones on the map
    const renderApp = () => {
        // 1. Draw Zones
        containerLayer.clearLayers();
        const zones = geoManager.getZones();

        // Check Mode for Styling
        const isTestMode = modeSwitch && modeSwitch.checked;

        zones.forEach(zone => {
            let latLngs = [];
            if (zone.vertices) latLngs = zone.vertices.map(p => [p.lat, p.lng]);
            else {
                const polygon = geoManager.getZonePolygon(zone.id);
                if (polygon) latLngs = polygon.map(p => [p.lat, p.lng]);
            }
            if (latLngs.length === 0) return;

            let color = '#3388ff';
            let opacity = 0.5;
            let dashArray = null;
            let stroke = true;
            let weight = 1;

            if (isTestMode) {
                // --- TEST MODE (Bright, Explicit) ---
                switch (zone.type) {
                    case 'REEFER': color = '#00CED1'; opacity = 0.6; break;
                    case 'IMO': color = '#FF4500'; opacity = 0.6; break; // Red-Orange
                    case 'DAMAGED': color = '#8B4513'; opacity = 0.7; break;
                    case 'CRANE_AREA': color = '#4169E1'; opacity = 0.4; break;
                    case 'STANDARD': color = '#1f6feb'; opacity = 0.5; break;
                    case 'LOADING': color = '#FFD700'; opacity = 0.3; dashArray = '5, 5'; break;
                    case 'GATE': color = '#32CD32'; opacity = 0.4; break; // Lime Green
                    case 'RAIL': color = '#696969'; opacity = 0.5; break;
                    case 'QUAY': color = '#708090'; opacity = 0.2; break;
                    case 'BUILDING': color = '#2F4F4F'; opacity = 0.8; break;
                    case 'DEPOT': color = '#8A2BE2'; opacity = 0.4; break;
                }
                weight = 2; // Thicker lines
            } else {
                // --- NORMAL MODE (Sober, Professional) ---
                switch (zone.type) {
                    case 'STANDARD':
                    case 'REEFER':
                    case 'IMO':
                    case 'DAMAGED':
                        color = '#21262d'; opacity = 0.3; stroke = true; color = '#30363d'; break;
                    case 'CRANE_AREA': color = '#1c2128'; opacity = 0.1; stroke = false; break;
                    case 'LOADING': color = '#e3b341'; opacity = 0.1; dashArray = '5, 5'; break;
                    case 'GATE': color = '#3fb950'; opacity = 0.2; break;
                    case 'RAIL': color = '#161b22'; opacity = 0.3; break;
                    case 'QUAY': color = '#0d1117'; opacity = 0.1; break;
                    case 'BUILDING': color = '#0d1117'; opacity = 0.9; stroke = false; break;
                    case 'DEPOT': color = '#8A2BE2'; opacity = 0.15; break;
                }
            }

            L.polygon(latLngs, {
                color: isTestMode ? "#111" : color,
                weight: weight,
                fillColor: color,
                fillOpacity: opacity,
                dashArray: dashArray,
                stroke: stroke
            })
                .addTo(containerLayer)
                .bindTooltip(zone.id, { permanent: isTestMode, direction: "center", className: isTestMode ? '' : 'hidden-tooltip' })
                .on('click', function (e) { handleZoneClick(zone, this); });
        });

        // 2. Draw Vehicles
        renderVehicles();
    };

    // Vehicle Markers Cache: { vehicleId: Marker }
    const vehicleMarkers = {};

    const getVehicleIcon = (type, hasContainer) => {
        const color = type === 'Ralla' ? '#e3b341' : '#f78166';

        let containerHtml = '';
        if (hasContainer) {
            // Draw a small 20ft container on top
            containerHtml = `
                <div style="
                    position: absolute;
                    top: -6px; left: -4px;
                    width: 20px; height: 10px;
                    background: linear-gradient(45deg, #1f6feb, #58a6ff);
                    border: 1px solid #0d1117;
                    border-radius: 2px;
                    box-shadow: 1px 1px 2px rgba(0,0,0,0.5);
                    z-index: 10;
                "></div>
            `;
        }

        const iconHtml = `
            <div style="position: relative;">
                <div style="
                    background-color: ${color}; 
                    width: 12px; height: 12px; 
                    border-radius: 50%; 
                    border: 2px solid white; 
                    box-shadow: 0 0 4px rgba(0,0,0,0.5); 
                    transition: all 0.3s ease;
                "></div>
                ${containerHtml}
            </div>
        `;
        return L.divIcon({ className: 'vehicle-marker', html: iconHtml, iconSize: [16, 16], iconAnchor: [8, 8] });
    };

    const renderVehicles = () => {
        const vehicles = fleetManager.getVehicles();

        // Helper to execute movement (Pathfinding -> Animation)
        const executeMove = (marker, startLatLng, targetLatLng, vehicle) => {
            const startObj = { lat: startLatLng.lat, lng: startLatLng.lng };
            const speedMps = 8.33; // 30 km/h

            console.log(`[SENSOR] 🚀 Executing Move for ${vehicle.id} to ${vehicle.currentZone}`);

            // 1. Try Pathfinding
            const path = pathFinder.findPath(startObj, vehicle.currentZone);

            if (path && path.length > 0) {
                // SMOOTHING: Prepend Start, Append End
                const fullPath = [startObj, ...path, { lat: targetLatLng.lat, lng: targetLatLng.lng }];

                // Filter out duplicates.
                const cleanPath = fullPath.filter((p, i, arr) => {
                    if (i === 0) return true;
                    const prev = arr[i - 1];
                    const d = map.distance([prev.lat, prev.lng], [p.lat, p.lng]);
                    return d > 2;
                });

                console.log(`[SENSOR] 🟢 Using MANIFOLD PATH (${cleanPath.length} points)`);
                marker.isFollowingPath = true;
                animatePath(marker, cleanPath, speedMps);

                // --- Visual Debug: Per-Vehicle Trace ---
                if (debugTraceLayers[vehicle.id]) {
                    debugTraceLayers[vehicle.id].remove();
                }
                const traceGroup = L.layerGroup().addTo(map);
                debugTraceLayers[vehicle.id] = traceGroup;

                // 1. The Road Path (Cyan)
                L.polyline(cleanPath, { color: 'cyan', weight: 4, opacity: 0.7 }).addTo(traceGroup);

                // 2. The "Snap" Legs (Magenta Dashed)
                const snapStart = [startObj, cleanPath[0]];
                L.polyline(snapStart, { color: 'magenta', weight: 3, dashArray: '10, 10', opacity: 0.8 })
                    .addTo(traceGroup)
                    .bindTooltip(`Start: ${Math.round(map.distance(startObj, cleanPath[0]))}m`, { direction: 'center' });

                const lastIdx = cleanPath.length - 1;
                if (lastIdx > 0) {
                    const lastSegDist = map.distance(cleanPath[lastIdx - 1], cleanPath[lastIdx]);
                    if (lastSegDist > 20) {
                        L.polyline([cleanPath[lastIdx - 1], cleanPath[lastIdx]], { color: 'magenta', weight: 3, dashArray: '10, 10', opacity: 0.8 })
                            .addTo(traceGroup)
                            .bindTooltip(`End: ${Math.round(lastSegDist)}m`, { direction: 'center' });
                    }
                }

            } else {
                // 2. Fallback: Direct Line
                const dist = map.distance(startLatLng, targetLatLng);
                const duration = (dist / speedMps) * 1000;

                console.warn(`[SENSOR] 🔴 FALLBACK DIRECT - Dist: ${Math.round(dist)}m`);

                // Visual cue: Red Dashed Line
                L.polyline([startLatLng, targetLatLng], { color: 'red', dashArray: '5, 10' }).addTo(map).bindPopup(`Path not found! Dist: ${Math.round(dist)}m`).openPopup();

                marker.isFollowingPath = false;
                animateMarker(marker, startLatLng, targetLatLng, duration);
            }
        };

        vehicles.forEach(v => {
            // Check if vehicle is active and has position
            // Fix: Allow custom statuses like 'Job Assigned', 'Operating' etc.
            if (!v.position || !v.position.lat) {
                if (vehicleMarkers[v.id]) {
                    vehicleMarkers[v.id].remove();
                    delete vehicleMarkers[v.id];
                    // Clean debug trace
                    if (debugTraceLayers[v.id]) {
                        debugTraceLayers[v.id].remove();
                        delete debugTraceLayers[v.id];
                    }
                }
                return;
            }

            const newLatLng = [v.position.lat, v.position.lng];
            const targetLatLng = L.latLng(newLatLng);

            let marker = vehicleMarkers[v.id];

            if (marker) {
                // --- UPDATE EXISTING MARKER ---
                const oldLatLng = marker.getLatLng();
                const currentDest = marker.destinationLatLng;
                const destChanged = currentDest && (currentDest.lat !== targetLatLng.lat || currentDest.lng !== targetLatLng.lng);

                // Update Icon if Container State Changed
                const hasContainer = !!v.carriedContainer;
                if (marker.hasContainer !== hasContainer) {
                    const newIcon = getVehicleIcon(v.type, hasContainer);
                    marker.setIcon(newIcon);
                    marker.hasContainer = hasContainer;
                }

                if (marker.isFollowingPath && !destChanged) return;

                // MOVEMENT LOGIC: Converge to Target Zone
                // If we have a target zone, and we are not moving, check distance.
                if (v.currentZone && !marker.isFollowingPath) {
                    const targetZoneCenter = geoManager.getZoneCenter(v.currentZone);
                    if (targetZoneCenter) {
                        const currentPos = marker.getLatLng();
                        const dist = map.distance(currentPos, [targetZoneCenter.lat, targetZoneCenter.lng]);

                        // If we are far (>30m) from where we should be, MOVE.
                        if (dist > 30) {
                            console.log(`[Fleet] Vehicle ${v.id} is ${Math.round(dist)}m from ${v.currentZone}. Moving...`);
                            marker.destinationLatLng = L.latLng(targetZoneCenter.lat, targetZoneCenter.lng);
                            executeMove(marker, currentPos, marker.destinationLatLng, v);
                        } else {
                            // We are there.
                            // Ensure sync? 
                        }
                    }
                }

                // Handling Teleport/Drag updates from logic not handled by pathfinder
                if (destChanged) {
                    // console.log(`Vehicle ${v.id} redirected to ${v.currentZone}`);
                    // marker.destinationLatLng = targetLatLng;
                    // marker.isFollowingPath = false;
                    // executeMove(marker, oldLatLng, targetLatLng, v);
                    // marker.setPopupContent(`<b>${v.id}</b><br>${v.type}<br>${v.currentZone}<br>${hasContainer ? '📦 Loaded' : 'Empty'}`);
                }
                else if (map.distance(oldLatLng, targetLatLng) > 10 && !marker.isFollowingPath) {
                    // This handles manual position updates from simulation if any
                    // marker.setLatLng(targetLatLng);
                }

            } else {
                // --- CREATE NEW MARKER ---
                const hasContainer = !!v.carriedContainer;
                const icon = getVehicleIcon(v.type, hasContainer);

                const depotCenter = geoManager.getZoneCenter('DEPOT_RALLE');
                let startPos = depotCenter ? L.latLng(depotCenter.lat, depotCenter.lng) : targetLatLng;

                marker = L.marker(startPos, { icon: icon, draggable: true }).addTo(vehicleLayer);
                marker.vehicleId = v.id; // Attach ID for tracking
                marker.hasContainer = hasContainer; // Track state

                // Add Click Handler for Inspector
                marker.on('click', (e) => {
                    let job = null;
                    if (v.currentJobId) {
                        job = jobManager.jobs.find(j => j.id === v.currentJobId);
                    }
                    inspector.showVehicle(v, job);
                    L.DomEvent.stopPropagation(e);
                });

                vehicleMarkers[v.id] = marker;
                marker.destinationLatLng = targetLatLng;

                // Drag Interaction
                marker.on('dragend', (e) => {
                    const newPos = e.target.getLatLng();
                    console.log(`[Vehicle] Dragged ${v.id} to`, newPos);

                    // Identify Zone Drop
                    const zones = geoManager.getZones();
                    let droppedZone = null;

                    for (const z of zones) {
                        if (z.vertices && geoManager._isPointInPolygon({ lat: newPos.lat, lng: newPos.lng }, z.vertices)) {
                            droppedZone = z.id;
                            break;
                        }
                    }

                    if (droppedZone) {
                        console.log(`[Vehicle] Dropped in ${droppedZone}`);
                        v.currentZone = droppedZone;
                    } else {
                        // User dropped in middle of nowhere. 
                        // To prevent "Fly Back" to old zone, we must clear currentZone or find nearest.
                        // Ideally, we find the nearest node/zone.
                        console.log(`[Vehicle] Dropped outside zone. Clearing currentZone assignment.`);
                        v.currentZone = null;
                    }

                    v.status = 'Active';

                    // Update Position in Manager
                    fleetManager.updateVehiclePosition(v.id, newPos.lat, newPos.lng);

                    // Refresh UI
                    depotUI.renderList();
                    marker.setPopupContent(`<b>${v.id}</b><br>${v.type}<br>${v.currentZone || 'Off-Road'}`);
                    marker.openPopup();
                });

                if (map.distance(startPos, targetLatLng) > 1) {
                    executeMove(marker, startPos, targetLatLng, v);
                }
            }
        });
    };

    // --- Animation Helpers ---
    // ... (Code omitted for brevity, logic remains same)

    // TRUCK RENDERER
    const truckMarkers = {}; // Cache
    const renderTrucks = () => {
        if (!truckManager) return;
        const trucks = truckManager.getTrucks();

        trucks.forEach(t => {
            if (t.status === 'Departed') {
                if (truckMarkers[t.id]) {
                    truckMarkers[t.id].remove();
                    delete truckMarkers[t.id];
                }
                return;
            }

            let marker = truckMarkers[t.id];

            // Create if missing
            if (!marker) {
                // Default Icon
                const iconHtml = `<div style="background: #4caf50; width: 14px; height: 14px; border: 2px solid white; border-radius: 2px; box-shadow: 1px 1px 3px black;"></div>`;
                const icon = L.divIcon({ className: 'truck-marker', html: iconHtml, iconSize: [16, 16] });
                marker = L.marker([t.position.lat, t.position.lng], { icon: icon }).addTo(map);
                marker.bindPopup(`<b>${t.id}</b><br>${t.plate}<br>${t.status}`);
                marker.truckId = t.id;
                truckMarkers[t.id] = marker;
            }

            // Update Icon based on Container Presence
            const hasContainer = !!t.containerId;
            // Check if state changed vs marker state (optimization) or just re-render icon if needed
            // For simplicity, we construct HTML every frame or check a flag. 
            // Let's check flag.
            if (marker.hasContainer !== hasContainer) {
                let containerHtml = '';
                if (hasContainer) {
                    containerHtml = `
                        <div style="
                            position: absolute;
                            top: -6px; left: -3px;
                            width: 20px; height: 10px;
                            background: linear-gradient(45deg, #FF5722, #FF9800); /* Orange for Truck Export/Import */
                            border: 1px solid #333;
                            border-radius: 2px;
                            z-index: 10;
                        "></div>`;
                }
                const iconHtml = `
                    <div style="position: relative;">
                        <div style="background: #4caf50; width: 14px; height: 14px; border: 2px solid white; border-radius: 2px; box-shadow: 1px 1px 3px black;"></div>
                        ${containerHtml}
                    </div>`;

                const newIcon = L.divIcon({ className: 'truck-marker', html: iconHtml, iconSize: [16, 16], iconAnchor: [8, 8] });
                marker.setIcon(newIcon);
                marker.hasContainer = hasContainer;
            }

            // Determine Status Label
            let statusLabel = '🟢 Moving';
            if (t.isPaused) statusLabel = '🛑 Queued (Too Close)';
            else if (['OCR Scan', 'Gate Check', 'Servicing'].includes(t.status)) statusLabel = '⏳ Processing';
            else if (t.status === 'Departing') statusLabel = '🔙 Leaving';

            // Update Popup
            marker.setPopupContent(`<b>${t.plate}</b><br>${t.status}<br>${statusLabel}<br>${hasContainer ? '📦 Loaded' : 'Empty'}`);

            // PAUSE LOGIC: If paused, stop movement
            if (t.isPaused) {
                return;
            }

            // MOVEMENT LOGIC
            // We need to move the truck towards its target zone center.
            if (t.targetZone && !marker.isFollowingPath) {
                const targetCenter = geoManager.getZoneCenter(t.targetZone);
                if (targetCenter) {
                    const currentLatLng = marker.getLatLng();
                    const dist = map.distance(currentLatLng, [targetCenter.lat, targetCenter.lng]);

                    if (dist > 4) {
                        // Find Path
                        const start = { lat: currentLatLng.lat, lng: currentLatLng.lng };
                        const path = pathFinder.findPath(start, t.targetZone);

                        if (path && path.length > 0) {
                            const fullPath = [start, ...path, { lat: targetCenter.lat, lng: targetCenter.lng }];
                            marker.isFollowingPath = true;
                            // Use generic animatePath helper
                            animatePath(marker, fullPath, 13.8); // 50 km/h
                        } else {
                            // Fallback Linear
                            marker.isFollowingPath = true;
                            animateMarker(marker, currentLatLng, L.latLng(targetCenter.lat, targetCenter.lng), (dist / 10) * 1000, () => {
                                marker.isFollowingPath = false;
                            });
                        }
                    }
                }
            }

            // Sync Data Position with Marker
            const pos = marker.getLatLng();
            t.position.lat = pos.lat;
            t.position.lng = pos.lng;
        });
    };

    // Populate Dropdown using the instance created above
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
            let fillRate = 0.3; // 30% full

            // Heavy Load in Crane/Loading areas
            if (zone.id.includes('CRANE') || zone.id.includes('LOADING')) {
                fillRate = 0.95;
            }

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

    // --- 6. Global Simulation Loop ---
    let lastTime = performance.now();
    const gameLoop = (time) => {
        const dt = (time - lastTime) / 1000; // Seconds
        lastTime = time;

        // Updates
        if (truckManager) truckManager.update(dt);
        if (jobManager) jobManager.update(dt);

        // Renders
        renderTrucks();
        renderVehicles(); // Ensure internal fleet moves automatically

        requestAnimationFrame(gameLoop);
    };
    requestAnimationFrame(gameLoop);

    // --- 7. Splash Screen Handling ---
    const splash = document.getElementById('splash-screen');
    if (splash) {
        // Wait for Loading Animation (2s) roughly, plus a bit
        setTimeout(() => {
            splash.classList.add('fade-out');
            // Remove from DOM to free scrolling/interaction completely after fade (3s)
            setTimeout(() => {
                if (splash.parentNode) splash.parentNode.removeChild(splash);
            }, 3000);
        }, 2500);
    }

} catch (e) {
    console.error("APPLICATION CRASHED:", e);
    alert(`Application Error: ${e.message}\nCheck console for details.`);
}
