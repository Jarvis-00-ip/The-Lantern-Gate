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
        // roadSegments is Array of { path: [{lat,lng}...], properties: { oneWay: boolean } }
        console.log("PathFinder: Rebuilding graph from Manual Lines...");
        this.nodes = [];
        this.graph = new Map();

        let nodeIdCounter = 0;
        // Optimization: Use a simple list for brute-force distance check (N is small < 1000)

        const SNAP_ENDPOINT = 12; // Connect loose ends (endpoints only)
        const SNAP_INTERNAL = 1;  // Strict shape preservation (1m precision)

        const getOrCreateNode = (lat, lng, snapRadius) => {
            // 1. Check if an existing node is very close
            const candidate = { lat, lng };
            for (const node of this.nodes) {
                if (this.geoManager._distanceMeters(node, candidate) < snapRadius) {
                    return node;
                }
            }

            // 2. Create new if no close match
            const node = { id: `m_${nodeIdCounter++}`, lat, lng, type: 'MANUAL_ROAD' };
            this.nodes.push(node);
            this.graph.set(node.id, []);
            return node;
        };

        const MAX_SEGMENT_LEN = 5; // High fidelity curves (5m segments)

        const excludedTypes = ['construction', 'proposed', 'razed', 'abandoned', 'disused', 'demolished'];

        roadSegments.forEach(road => {
            const type = road.properties ? road.properties.type : 'unknown';
            if (excludedTypes.includes(type)) return; // Skip unusable roads

            const segment = road.path;
            const oneWay = road.properties ? road.properties.oneWay : false;

            for (let i = 0; i < segment.length - 1; i++) {
                const start = segment[i];
                const end = segment[i + 1];

                const totalDist = this.geoManager._distanceMeters(start, end);

                // Determine Snap Radius for Start Node
                // Only snap aggressively if it's the very first point of the Way
                const snapA = (i === 0) ? SNAP_ENDPOINT : SNAP_INTERNAL;
                let prevNode = getOrCreateNode(start.lat, start.lng, snapA);

                // Densification: Split long segments
                if (totalDist > MAX_SEGMENT_LEN) {
                    const steps = Math.ceil(totalDist / MAX_SEGMENT_LEN);

                    for (let s = 1; s <= steps; s++) {
                        const t = s / steps;
                        // Interpolate
                        const lat = start.lat + (end.lat - start.lat) * t;
                        const lng = start.lng + (end.lng - start.lng) * t;

                        // Determine Snap Radius
                        // If it's the final step, it represents the 'end' node of the segment
                        let currentSnap = SNAP_INTERNAL;
                        if (s === steps) {
                            // It's the segment endpoint. Check if it's the ROAD endpoint.
                            const isLastPoint = (i + 1 === segment.length - 1);
                            currentSnap = isLastPoint ? SNAP_ENDPOINT : SNAP_INTERNAL;
                        }

                        const currentNode = getOrCreateNode(lat, lng, currentSnap);

                        // Link prev -> current
                        const dist = this.geoManager._distanceMeters(prevNode, currentNode);
                        if (prevNode.id !== currentNode.id) {
                            // Link Forward
                            if (!this.graph.get(prevNode.id).some(n => n.node.id === currentNode.id)) {
                                this.graph.get(prevNode.id).push({ node: currentNode, weight: dist });
                            }
                            // Link Backward (Only if NOT one-way)
                            if (!oneWay) {
                                if (!this.graph.get(currentNode.id).some(n => n.node.id === prevNode.id)) {
                                    this.graph.get(currentNode.id).push({ node: prevNode, weight: dist });
                                }
                            }
                        }
                        prevNode = currentNode;
                    }

                } else {
                    // Standard Link
                    // Determine Snap Radius for End Node
                    // Only snap aggressively if it's the very last point of the Way
                    const isLastPoint = (i + 1 === segment.length - 1);
                    const snapB = isLastPoint ? SNAP_ENDPOINT : SNAP_INTERNAL;

                    const nodeB = getOrCreateNode(end.lat, end.lng, snapB);

                    if (prevNode.id === nodeB.id) continue;

                    const dist = this.geoManager._distanceMeters(prevNode, nodeB);

                    // Forward Edge (A -> B)
                    const neighborsA = this.graph.get(prevNode.id);
                    if (!neighborsA.some(n => n.node.id === nodeB.id)) {
                        neighborsA.push({ node: nodeB, weight: dist });
                    }

                    // Backward Edge (B -> A) - Only if NOT one-way
                    if (!oneWay) {
                        const neighborsB = this.graph.get(nodeB.id);
                        if (!neighborsB.some(n => n.node.id === prevNode.id)) {
                            neighborsB.push({ node: prevNode, weight: dist });
                        }
                    }
                }
            }
        });

        console.log(`PathFinder: Manual Graph built with ${this.nodes.length} nodes (Hybrid Snap: ${SNAP_ENDPOINT}m/${SNAP_INTERNAL}m).`);
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
