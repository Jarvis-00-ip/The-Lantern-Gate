import { ROAD_NETWORK } from './RoadNetworkData.js';

/**
 * Cost multipliers per OSM road class. A* weighs edges by distance alone
 * otherwise, which is why trucks would cut through residential hill streets
 * whenever that shaved a few metres off the motorway approach.
 *
 * IMPORTANT: every factor must be >= 1.0. The A* heuristic is straight-line
 * distance in metres, so it only stays admissible (never overestimates) while
 * no edge is cheaper than its true length. Discounting a road class below 1.0
 * silently breaks optimality.
 *
 * `service` is kept low on purpose: terminal internal roads are tagged that
 * way, and making them expensive would wreck routing inside the yard.
 */
export const ROAD_COST = {
    motorway: 1.0, motorway_link: 1.0,
    trunk: 1.0, trunk_link: 1.0,
    primary: 1.1, primary_link: 1.1,
    secondary: 1.25, secondary_link: 1.25,
    tertiary: 1.45, tertiary_link: 1.45,
    service: 1.3,
    unclassified: 1.8,
    road: 1.8,
    residential: 2.6,
    living_street: 3.2,
    track: 3.2,
    pedestrian: 6.0,
    footway: 6.0
};

export const DEFAULT_ROAD_COST = 1.6;

/**
 * Ways no vehicle can use, kept out of the routing graph entirely.
 * They are still drawn on the map — they exist, trucks just cannot drive them.
 * Verified: excluding these leaves every leg of the truck route connected and
 * actually shortens it, because the pedestrian "shortcuts" it used to take
 * were detours in disguise.
 */
export const NON_DRIVABLE_TYPES = [
    // Not built / no longer there
    'construction', 'proposed', 'razed', 'abandoned', 'disused', 'demolished',
    // Rail
    'rail', 'subway', 'tram', 'railway', 'train', 'light_rail', 'narrow_gauge',
    // Not for vehicles
    'footway', 'pedestrian', 'steps', 'cycleway', 'path', 'bridleway', 'corridor'
];

export class PathFinder {
    constructor(geoManager) {
        this.geoManager = geoManager;
        this.graph = new Map(); // Node -> [Neighbors]
        this.nodes = [];
        this.manualMode = false;
        // Don't init auto graph if not needed, or let it stick as fallback
        this.initRoadGraph();
    }

    /**
     * Converts a real distance into a routing cost by road class.
     * @param {number} meters - True edge length.
     * @param {string} type - OSM highway/railway class.
     * @returns {number} Weight in "cost metres" (always >= meters).
     */
    _edgeCost(meters, type) {
        const factor = ROAD_COST[type] !== undefined ? ROAD_COST[type] : DEFAULT_ROAD_COST;
        return meters * factor;
    }

    /**
     * Breaks a computed route down by road class. Used to check that traffic
     * actually prefers main roads rather than trusting the weights blindly.
     * @param {Array} path - Points returned by findPath().
     * @returns {Object} { totalMeters, byType: { type: meters } }
     */
    describeRoute(path) {
        const byType = {};
        let totalMeters = 0;
        if (!path || path.length < 2) return { totalMeters, byType };

        for (let i = 0; i < path.length - 1; i++) {
            const a = this._findClosestNode(path[i]);
            const b = this._findClosestNode(path[i + 1]);
            if (!a || !b) continue;

            const meters = this.geoManager._distanceMeters(path[i], path[i + 1]);
            totalMeters += meters;

            const edge = (this.graph.get(a.id) || []).find(e => e.node.id === b.id);
            const type = edge ? (edge.type || 'unknown') : 'unknown';
            byType[type] = (byType[type] || 0) + meters;
        }

        return { totalMeters, byType };
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
            let minD = 40; // Increased from snapRadius to 40m default to be more forgiving

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
        roadSegments.forEach(road => {
            const type = road.properties ? road.properties.type : 'unknown';
            if (NON_DRIVABLE_TYPES.includes(type)) return;
            // Additional check for OSM tags if properties.type is generic
            if (road.properties && (road.properties.railway || road.properties.train)) return;

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
                        const w = this._edgeCost(d, type);
                        if (prevNode.id !== currentNode.id) {
                            this.graph.get(prevNode.id).push({ node: currentNode, weight: w, type });
                            if (!oneWay) {
                                this.graph.get(currentNode.id).push({ node: prevNode, weight: w, type });
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

                        const w = this._edgeCost(dist, type);

                        const edgesA = this.graph.get(prevNode.id);
                        if (!edgesA.some(e => e.node.id === nodeB.id)) {
                            edgesA.push({ node: nodeB, weight: w, type });
                        }

                        if (!oneWay) {
                            const edgesB = this.graph.get(nodeB.id);
                            if (!edgesB.some(e => e.node.id === prevNode.id)) {
                                edgesB.push({ node: prevNode, weight: w, type });
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

    /**
     * Rebuilds the navigation graph from a set of road polylines, always
     * splicing in the highway connector. Every caller must go through here:
     * calling updateGraphFromPolylines() directly with the editable road list
     * silently drops the connector and strands the Genova-Ovest truck spawn.
     * @param {Array} roads - Road segments ({ path, properties })
     */
    rebuildFromRoads(roads) {
        this.updateGraphFromPolylines([...roads, ...this.getHighwayConnector()]);
    }

    /**
     * The synthetic motorway spine linking the Genova-Ovest toll booth to the
     * port gates via the customs areas. It is not part of the editable road
     * network, so it lives here and is re-added on every rebuild.
     */
    getHighwayConnector() {
        return [
            // Main Spine from Casello to Port Area
            {
                path: [
                    { lat: 44.41776, lng: 8.902517 }, // Spawn/Despawn (Genova Ovest)
                    { lat: 44.41400, lng: 8.903000 }, // Intermediate
                    { lat: 44.41100, lng: 8.904000 }, // Approach Dogana
                ],
                properties: { type: 'motorway', oneway: false }
            },
            // Branch down to the port gate area (customs in / OCR)
            {
                path: [
                    { lat: 44.41100, lng: 8.904000 },
                    { lat: 44.40965, lng: 8.905500 }, // Approach to the gate area
                    { lat: 44.40660, lng: 8.907800 }  // Connect to OCR/Gate Area
                ],
                properties: { type: 'primary', oneway: false }
            },
            // Branch back to the motorway from the exit gate
            {
                path: [
                    { lat: 44.40714, lng: 8.904790 }, // GATE OUT
                    { lat: 44.40865, lng: 8.904250 }, // Northbound leg
                    { lat: 44.41100, lng: 8.904000 }  // Merge back to Highway
                ],
                properties: { type: 'primary', oneway: false }
            }
        ];
    }

    initRoadGraph() {
        console.log("PathFinder: Building Graph from ROAD_NETWORK...");
        this.rebuildFromRoads(ROAD_NETWORK);
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
