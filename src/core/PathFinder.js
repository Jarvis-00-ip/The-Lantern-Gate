export class PathFinder {
    constructor(geoManager) {
        this.geoManager = geoManager;
        this.graph = new Map(); // Node -> [Neighbors]
        this.nodes = [];
        this.manualMode = false;
        // Don't init auto graph if not needed, or let it stick as fallback
        this.initRoadGraph();
    }

    setManualMode(enabled) {
        this.manualMode = enabled;
        if (!enabled) this.initRoadGraph(); // Revert to grid/node
    }

    updateGraphFromPolylines(roadSegments) {
        console.log("PathFinder: Rebuilding graph from Manual Lines...");
        this.nodes = [];
        this.graph = new Map();

        let nodeIdCounter = 0;

        // OPTIMIZATION: Spatial Grid for O(1) Lookup
        // 0.00015 deg is approx 12-16 meters.
        const GRID_SIZE = 0.00015;
        const spatialGrid = new Map(); // "latIdx_lngIdx" -> [nodes]

        const getGridKey = (lat, lng) => {
            const y = Math.floor(lat / GRID_SIZE);
            const x = Math.floor(lng / GRID_SIZE);
            return `${y}_${x}`;
        };

        const addToGrid = (node) => {
            const key = getGridKey(node.lat, node.lng);
            if (!spatialGrid.has(key)) spatialGrid.set(key, []);
            spatialGrid.get(key).push(node);
        };

        const getOrCreateNode = (lat, lng, snapRadius) => {
            // 1. Check Spatial Grid (Current + 9 Neighbors)
            const centerY = Math.floor(lat / GRID_SIZE);
            const centerX = Math.floor(lng / GRID_SIZE);

            let bestCandidate = null;
            let minD = snapRadius;

            // Check 3x3 grid around the point
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    const key = `${centerY + dy}_${centerX + dx}`;
                    const bucket = spatialGrid.get(key);
                    if (bucket) {
                        for (const node of bucket) {
                            const d = this.geoManager._distanceMeters(node, { lat, lng });
                            if (d < minD) {
                                minD = d;
                                bestCandidate = node;
                            }
                        }
                    }
                }
            }

            if (bestCandidate) return bestCandidate;

            // 2. Create new if no close match
            const node = { id: `m_${nodeIdCounter++}`, lat, lng, type: 'MANUAL_ROAD' };
            this.nodes.push(node);
            this.graph.set(node.id, []);
            addToGrid(node); // Index it
            return node;
        };

        const SNAP_ENDPOINT = 12; // Connect loose ends
        const SNAP_INTERNAL = 1;  // Strict shape preservation

        const MAX_SEGMENT_LEN = 5;
        const excludedTypes = ['construction', 'proposed', 'razed', 'abandoned', 'disused', 'demolished'];

        roadSegments.forEach(road => {
            const type = road.properties ? road.properties.type : 'unknown';
            if (excludedTypes.includes(type)) return;

            const segment = road.path;
            const oneWay = road.properties ? road.properties.oneWay : false;

            if (segment.length < 2) return;

            for (let i = 0; i < segment.length - 1; i++) {
                const start = segment[i];
                const end = segment[i + 1];

                const totalDist = this.geoManager._distanceMeters(start, end);
                const snapA = (i === 0) ? SNAP_ENDPOINT : SNAP_INTERNAL;

                // Note: Densification logic simplified for performance on massive datasets 
                // If segment is HUGE (e.g. straight highway), we split. 
                // But for imported OSM data, nodes are usually dense enough.

                let prevNode = getOrCreateNode(start.lat, start.lng, snapA);

                // Only densify if really long (> 20m) to avoid exploding node count further
                if (totalDist > 20) {
                    const steps = Math.ceil(totalDist / MAX_SEGMENT_LEN);
                    for (let s = 1; s <= steps; s++) {
                        const t = s / steps;
                        const lat = start.lat + (end.lat - start.lat) * t;
                        const lng = start.lng + (end.lng - start.lng) * t;

                        // Endpoint check
                        const isLastOfSegment = (s === steps);
                        const isLastOfPath = (i + 1 === segment.length - 1);
                        const currentSnap = (isLastOfSegment && isLastOfPath) ? SNAP_ENDPOINT : SNAP_INTERNAL;

                        const currentNode = getOrCreateNode(lat, lng, currentSnap);

                        // Link
                        const d = this.geoManager._distanceMeters(prevNode, currentNode);
                        if (prevNode.id !== currentNode.id) {
                            this.graph.get(prevNode.id).push({ node: currentNode, weight: d });
                            if (!oneWay) {
                                this.graph.get(currentNode.id).push({ node: prevNode, weight: d });
                            }
                        }
                        prevNode = currentNode;
                    }
                } else {
                    // Standard Link
                    const isLastPoint = (i + 1 === segment.length - 1);
                    const snapB = isLastPoint ? SNAP_ENDPOINT : SNAP_INTERNAL;
                    const nodeB = getOrCreateNode(end.lat, end.lng, snapB);

                    if (prevNode.id !== nodeB.id) {
                        const dist = this.geoManager._distanceMeters(prevNode, nodeB);
                        // Prevent duplicate edges? 
                        // Graph array search is expensive if many neighbors. 
                        // But usually degree is low (2-4).

                        const edgesA = this.graph.get(prevNode.id);
                        if (!edgesA.some(e => e.node.id === nodeB.id)) {
                            edgesA.push({ node: nodeB, weight: dist });
                        }

                        if (!oneWay) {
                            const edgesB = this.graph.get(nodeB.id);
                            if (!edgesB.some(e => e.node.id === prevNode.id)) {
                                edgesB.push({ node: prevNode, weight: dist });
                            }
                        }
                    }
                }
            }
        });

        console.log(`PathFinder: Manual Graph built with ${this.nodes.length} nodes (Optimized Spatial Grid).`);
    }

    // Override or Modify findPath to snap to nearest Manual Node
    findPath(startPos, endZoneId) {
        if (this.manualMode) {
            // Manual Mode Logic
            const startNode = this._findClosestNode(startPos);
            const targetCenter = this.geoManager.getZoneCenter(endZoneId);

            if (!targetCenter) {
                console.error(`[SENSOR] ❌ Target Zone ${endZoneId} center not found!`);
                return null;
            }

            const endNode = this._findClosestNode(targetCenter);

            // SENSOR LOGS
            const distStart = this.geoManager._distanceMeters(startPos, startNode);
            const distEnd = this.geoManager._distanceMeters(targetCenter, endNode);

            console.log(`[SENSOR] 🛣️ Routing Request:`);
            console.log(`  > Start Pos: (${startPos.lat.toFixed(5)}, ${startPos.lng.toFixed(5)}) -> Snapped to Node: ${startNode?.id} (Dist: ${Math.round(distStart)}m)`);
            console.log(`  > Target Zone: ${endZoneId} -> Snapped to Node: ${endNode?.id} (Dist: ${Math.round(distEnd)}m)`);

            if (distStart > 20) console.warn(`[SENSOR] ⚠️ Start position is far from road network (${Math.round(distStart)}m)`);
            if (distEnd > 20) console.warn(`[SENSOR] ⚠️ End position is far from road network (${Math.round(distEnd)}m)`);

            if (!startNode || !endNode) {
                console.warn("[SENSOR] ❌ Start/End not connected to road network.");
                return null;
            }

            const path = this._astar(startNode, endNode);

            if (path) {
                console.log(`[SENSOR] ✅ Path Found: ${path.length} nodes.`);
                // console.log(`[SENSOR] Path Sequence: ${path.map(p => this._findClosestNode(p).id).join(' -> ')}`);
            } else {
                console.warn(`[SENSOR] ❌ A* returned null. No path possible between ${startNode.id} and ${endNode.id}.`);
            }
            return path;
        } else {
            // Grid Mode Fallback
            return null;
        }
    }

    initRoadGraph() {
        const zones = this.geoManager.getZones();
        const navigableTypes = ['ROAD', 'GATE', 'LOADING', 'QUAY', 'DEPOT'];

        const nodes = [];
        let nodeIdCounter = 0;

        // Grid Settings
        const GRID_STEP = 0.0003; // degrees (~20-30 meters)

        zones.forEach(z => {
            if (navigableTypes.includes(z.type) || z.type === 'DEPOT_RALLE') {

                // Get Bounding Box of Zone
                const vertices = this.geoManager.getZonePolygon(z.id);
                if (!vertices || vertices.length < 3) return;

                let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
                vertices.forEach(v => {
                    if (v.lat < minLat) minLat = v.lat;
                    if (v.lat > maxLat) maxLat = v.lat;
                    if (v.lng < minLng) minLng = v.lng;
                    if (v.lng > maxLng) maxLng = v.lng;
                });

                // Scan Grid
                for (let lat = minLat; lat <= maxLat; lat += GRID_STEP) {
                    for (let lng = minLng; lng <= maxLng; lng += GRID_STEP) {
                        const point = { lat, lng };
                        if (this.geoManager._isPointInPolygon(point, vertices)) {
                            nodes.push({
                                id: `n_${nodeIdCounter++}`,
                                lat: point.lat,
                                lng: point.lng,
                                originZone: z.id,
                                type: z.type
                            });
                        }
                    }
                }
            }
        });

        this.nodes = nodes;

        // 2. Build Edges (Connect Grid Neighbors)
        // Since it's a grid, we look for neighbors within slightly more than GRID_STEP
        // We use a spatial hash or simple distance check (optimized)
        // For MVP, simple N^2 on filtered set is too slow if N is large.
        // Optimization: Sort by Lat? Or just brute force if N < 500. 
        // Let's assume N is manageable (~200 nodes). If huge, we need optimization.

        const MAX_CONN_DIST = 80; // meters (Increased to ensure diagonals and zone jumps connect)

        nodes.forEach(nodeA => {
            nodes.forEach(nodeB => {
                if (nodeA.id === nodeB.id) return;

                // Quick Lat/Lng check before heavy distance calc (0.001 deg ~ 80-110m)
                if (Math.abs(nodeA.lat - nodeB.lat) > 0.001) return;
                if (Math.abs(nodeA.lng - nodeB.lng) > 0.001) return;

                const dist = this.geoManager._distanceMeters(nodeA, nodeB);

                if (dist < MAX_CONN_DIST) {
                    if (!this.graph.has(nodeA.id)) this.graph.set(nodeA.id, []);
                    this.graph.get(nodeA.id).push({ node: nodeB, weight: dist });
                }
            });
        });

        console.log(`PathFinder: GRID Graph built with ${nodes.length} nodes.`);
    }


    _findClosestNode(latLng) {
        let closest = null;
        let minDist = Infinity;

        this.nodes.forEach(n => {
            const dist = this.geoManager._distanceMeters(latLng, n);
            if (dist < minDist) {
                minDist = dist;
                closest = n;
            }
        });
        return closest;
    }

    _astar(start, goal) {
        // OpenSet: IDs to visit
        const openSet = [start.id];

        // CameFrom: path reconstruction
        const cameFrom = new Map();

        // G-Score: Cost from start to node
        const gScore = new Map();
        gScore.set(start.id, 0);

        // F-Score: Estimated total cost (G + Heuristic)
        const fScore = new Map();
        fScore.set(start.id, this.geoManager._distanceMeters(start, goal));

        let loops = 0;
        while (openSet.length > 0) {
            loops++;
            if (loops > 50000) { console.warn("A* Loop Limit Exceeded"); break; }

            // Get node with lowest fScore
            let currentId = openSet[0];
            let lowestF = fScore.get(currentId) || Infinity;

            for (let i = 1; i < openSet.length; i++) {
                const f = fScore.get(openSet[i]) || Infinity;
                if (f < lowestF) {
                    lowestF = f;
                    currentId = openSet[i];
                }
            }

            if (currentId === goal.id) {
                return this._reconstructPath(cameFrom, currentId);
            }

            // Remove current from Open
            openSet.splice(openSet.indexOf(currentId), 1);

            // Neighbors
            const neighbors = this.graph.get(currentId) || [];

            for (const neighbor of neighbors) {
                const currentIdG = gScore.get(currentId);
                const gVal = (currentIdG !== undefined) ? currentIdG : Infinity;

                const tentativeG = gVal + neighbor.weight;
                const neighborG = gScore.get(neighbor.node.id);
                const currentNeighborhoodG = (neighborG !== undefined) ? neighborG : Infinity;

                if (tentativeG < currentNeighborhoodG) {
                    cameFrom.set(neighbor.node.id, currentId);
                    gScore.set(neighbor.node.id, tentativeG);

                    const h = this.geoManager._distanceMeters(neighbor.node, goal);
                    fScore.set(neighbor.node.id, tentativeG + h);

                    if (!openSet.includes(neighbor.node.id)) {
                        openSet.push(neighbor.node.id);
                    }
                }
            }
        }

        console.warn("A* Failed: No path found in openSet. Visited:", gScore.size);
        return null;
    }

    _reconstructPath(cameFrom, currentId) {
        const totalPath = [];
        let curr = this.nodes.find(n => n.id === currentId);
        if (curr) totalPath.push({ lat: curr.lat, lng: curr.lng });

        while (cameFrom.has(currentId)) {
            currentId = cameFrom.get(currentId);
            curr = this.nodes.find(n => n.id === currentId);
            if (curr) totalPath.unshift({ lat: curr.lat, lng: curr.lng });
        }
        return totalPath;
    }
}
