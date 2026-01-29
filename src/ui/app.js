import { Yard, Container, ContainerType } from '../core/yardManager.js';
import { GeoManager } from '../core/GeoManager.js';
import { ControlPanel } from './controlPanel.js';
import { FloatingInspector } from './FloatingInspector.js';
import { FleetManager } from '../core/FleetManager.js';
import { DepotUI } from './DepotUI.js';
import { PathFinder } from '../core/PathFinder.js';
import { ROAD_NETWORK } from '../core/RoadNetworkData.js';

console.log("Initializing The Lantern Gate UI (Geospatial Mode)...");

if (typeof L === 'undefined') {
    alert("CRITICAL ERROR: Leaflet (L) is not defined. Check your internet connection or CDN links.");
}

try {
    // --- 1. System Initialization ---
    const yard = new Yard();
    const geoManager = new GeoManager();
    const inspector = new FloatingInspector('yard-container');

    // New Vehicle Systems
    const fleetManager = new FleetManager();
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

    // Satellite Layer (Esri World Imagery)
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri',
        maxZoom: 19
    }).addTo(map);

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
    const manualRoads = [...ROAD_NETWORK];

    // Render Persistent Roads
    manualRoads.forEach(roadPath => {
        L.polyline(roadPath, { color: '#FFD700', dashArray: '10, 5', weight: 4, opacity: 0.7 }).addTo(map);
    });

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
                manualRoads.push(latlngs);
                console.log("Road Segment Added. Total:", manualRoads.length);

                // Update PathFinder Live
                pathFinder.setManualMode(true);
                pathFinder.updateGraphFromPolylines(manualRoads);

                // Visual Debug (New lines match persistent style)
                e.layer.setStyle({ color: '#FFD700', dashArray: '10, 5', weight: 4 });
            } else {
                logZoneCoordinates(e.layer);
            }

            e.layer.on('pm:edit', () => { if (e.shape !== 'Line') logZoneCoordinates(e.layer) });
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

    // Mode Toggle Logic
    const modeSwitch = document.getElementById('mode-switch');
    const modeLabel = document.getElementById('mode-label');

    if (modeSwitch) {
        modeSwitch.addEventListener('change', (e) => {
            const isMapping = e.target.checked;
            modeLabel.textContent = isMapping ? "MAPPING MODE" : "TEST MODE";
            modeLabel.style.color = isMapping ? "#ff7800" : "var(--text-secondary)";

            updateEditorMode(isMapping);
            exportBtn.style.display = isMapping ? 'block' : 'none';
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
            if (v.status !== 'Active' || !v.position || !v.position.lat) {
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

                if (marker.isFollowingPath && !destChanged) return;

                if (destChanged) {
                    console.log(`Vehicle ${v.id} redirected to ${v.currentZone}`);
                    marker.destinationLatLng = targetLatLng;
                    marker.isFollowingPath = false;
                    executeMove(marker, oldLatLng, targetLatLng, v);
                    marker.setPopupContent(`<b>${v.id}</b><br>${v.type}<br>${v.currentZone}`);
                }
                else if (map.distance(oldLatLng, targetLatLng) > 10 && !marker.isFollowingPath) {
                    marker.setLatLng(targetLatLng);
                }

            } else {
                // --- CREATE NEW MARKER ---
                const color = v.type === 'Ralla' ? '#e3b341' : '#f78166';
                const iconHtml = `<div style="background-color: ${color}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.5); transition: all 0.3s ease;"></div>`;
                const icon = L.divIcon({ className: 'vehicle-marker', html: iconHtml, iconSize: [16, 16], iconAnchor: [8, 8] });

                const depotCenter = geoManager.getZoneCenter('DEPOT_RALLE');
                let startPos = depotCenter ? L.latLng(depotCenter.lat, depotCenter.lng) : targetLatLng;

                marker = L.marker(startPos, { icon: icon, draggable: true }).addTo(vehicleLayer).bindPopup(`<b>${v.id}</b><br>${v.type}<br>${v.currentZone}`);

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
                        v.status = 'Active'; // Assume active if moved manually
                    }

                    // Update Position in Manager
                    fleetManager.updateVehiclePosition(v.id, newPos.lat, newPos.lng);

                    // Refresh UI
                    depotUI.renderList();
                    marker.setPopupContent(`<b>${v.id}</b><br>${v.type}<br>${v.currentZone}`);
                    marker.openPopup();
                });

                if (map.distance(startPos, targetLatLng) > 1) {
                    executeMove(marker, startPos, targetLatLng, v);
                }
            }
        });
    };

    // --- Animation Helpers ---

    const animatePath = (marker, pathPoints, speedMps) => {
        // pathPoints is array of {lat, lng}
        let currentStep = 0;

        const loop = () => {
            if (!marker.isFollowingPath) return; // Abort if flag cleared
            if (currentStep >= pathPoints.length - 1) {
                marker.isFollowingPath = false; // Done
                return;
            }

            const start = L.latLng(pathPoints[currentStep]);
            const end = L.latLng(pathPoints[currentStep + 1]);

            const dist = map.distance(start, end);
            const duration = (dist / speedMps) * 1000;

            if (duration <= 0) {
                currentStep++;
                loop();
                return;
            }

            animateMarker(marker, start, end, duration, () => {
                currentStep++;
                loop();
            });
        };

        // Start at first point
        marker.setLatLng([pathPoints[0].lat, pathPoints[0].lng]);
        loop();
    };

    // Updated Simple Linear Animation Helper to support Callback
    const animateMarker = (marker, startLatLng, endLatLng, duration, onComplete) => {
        const startTime = performance.now();

        const animate = (currentTime) => {
            // Safety check if marker still exists
            if (!marker._map) return;

            const elapsed = currentTime - startTime;
            const t = Math.min(elapsed / duration, 1); // 0 to 1

            // Interpolate
            const lat = startLatLng.lat + (endLatLng.lat - startLatLng.lat) * t;
            const lng = startLatLng.lng + (endLatLng.lng - startLatLng.lng) * t;

            marker.setLatLng([lat, lng]);

            if (t < 1) {
                // Check if interrupted
                // if (!marker.isFollowingPath && onComplete) ... handled by loop outer check
                requestAnimationFrame(animate);
            } else {
                if (onComplete) onComplete();
            }
        };
        requestAnimationFrame(animate);
    };

    // Update DepotUI to trigger renderApp
    const depotUI = new DepotUI('yard-container', fleetManager, geoManager, renderApp);

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
