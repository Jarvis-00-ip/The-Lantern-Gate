export class GeoManager {
    constructor() {
        this.metersPerDegLat = 111132;
        this.metersPerDegLon = 79952; // at 44.4 N

        // --- ZONES CONFIGURATION ---
        this.zones = [
            // --- YARD BLOCKS ---
            {
                id: 'AREA_FRIGO', type: 'REEFER',
                vertices: [
                    { "lat": 44.406491, "lng": 8.90823 },
                    { "lat": 44.406244, "lng": 8.909443 },
                    { "lat": 44.405952, "lng": 8.909341 },
                    { "lat": 44.40619, "lng": 8.90812 }
                ]
            },
            {
                id: 'AREA_1', type: 'STANDARD',
                vertices: [
                    { "lat": 44.405979, "lng": 8.909381 },
                    { "lat": 44.40623, "lng": 8.909478 },
                    { "lat": 44.406035, "lng": 8.910419 },
                    { "lat": 44.405741, "lng": 8.910328 },
                    { "lat": 44.405793, "lng": 8.910076 },
                    { "lat": 44.405853, "lng": 8.910108 }
                ]
            },
            {
                id: 'BLOCK_A', type: 'STANDARD', description: 'No Carroponte',
                vertices: [
                    { "lat": 44.406034, "lng": 8.90811 },
                    { "lat": 44.40542, "lng": 8.911242 },
                    { "lat": 44.405209, "lng": 8.911165 },
                    { "lat": 44.405846, "lng": 8.907984 }
                ]
            },
            {
                id: 'BLOCK_B', type: 'STANDARD', description: 'No Carroponte',
                vertices: [
                    { "lat": 44.405539, "lng": 8.907906 },
                    { "lat": 44.404891, "lng": 8.911079 },
                    { "lat": 44.405129, "lng": 8.911167 },
                    { "lat": 44.405727, "lng": 8.907978 }
                ]
            },
            {
                id: 'BLOCK_C', type: 'STANDARD', description: 'No Carroponte',
                vertices: [
                    { "lat": 44.404665, "lng": 8.910851 },
                    { "lat": 44.404828, "lng": 8.910915 },
                    { "lat": 44.405451, "lng": 8.90782 },
                    { "lat": 44.405265, "lng": 8.907753 }
                ]
            },
            {
                id: 'BLOCK_D', type: 'STANDARD', description: 'No Carroponte',
                vertices: [
                    { "lat": 44.404995, "lng": 8.908169 },
                    { "lat": 44.404903, "lng": 8.908241 },
                    { "lat": 44.40483, "lng": 8.908399 },
                    { "lat": 44.404665, "lng": 8.909209 },
                    { "lat": 44.404828, "lng": 8.909271 },
                    { "lat": 44.405037, "lng": 8.90815 }
                ]
            },
            {
                id: 'BLOCK_LT', type: 'STANDARD', description: 'Lungo Termine',
                vertices: [
                    { "lat": 44.40478, "lng": 8.909295 },
                    { "lat": 44.404421, "lng": 8.909158 },
                    { "lat": 44.404174, "lng": 8.91032 },
                    { "lat": 44.404592, "lng": 8.910475 }
                ]
            },
            {
                id: 'BLOCK_BC_CRANES', type: 'CRANE_AREA',
                vertices: [
                    { "lat": 44.404056, "lng": 8.910797 },
                    { "lat": 44.404359, "lng": 8.910905 },
                    { "lat": 44.403277, "lng": 8.916129 },
                    { "lat": 44.402913, "lng": 8.916001 }
                ]
            },
            {
                id: 'BLOCK_AC_CRANES', type: 'CRANE_AREA',
                vertices: [
                    { "lat": 44.404816, "lng": 8.911985 },
                    { "lat": 44.404504, "lng": 8.911865 },
                    { "lat": 44.403416, "lng": 8.917106 },
                    { "lat": 44.403753, "lng": 8.917235 }
                ]
            },
            {
                id: 'IMO', type: 'IMO',
                vertices: [
                    { "lat": 44.404532, "lng": 8.91179 },
                    { "lat": 44.404862, "lng": 8.911913 },
                    { "lat": 44.404969, "lng": 8.911361 },
                    { "lat": 44.404647, "lng": 8.911221 }
                ]
            },
            {
                id: 'DAMAGED', type: 'DAMAGED',
                vertices: [
                    { "lat": 44.405828, "lng": 8.911065 },
                    { "lat": 44.405628, "lng": 8.910993 },
                    { "lat": 44.405557, "lng": 8.911323 },
                    { "lat": 44.405766, "lng": 8.911401 }
                ]
            },
            {
                id: 'DEPOT_RALLE', type: 'DEPOT',
                vertices: [
                    { "lat": 44.405995, "lng": 8.911484 },
                    { "lat": 44.405834, "lng": 8.911626 },
                    { "lat": 44.405561, "lng": 8.911583 },
                    { "lat": 44.405379, "lng": 8.912331 },
                    { "lat": 44.406424, "lng": 8.912763 },
                    { "lat": 44.406495, "lng": 8.91246 },
                    { "lat": 44.406106, "lng": 8.912334 },
                    { "lat": 44.406235, "lng": 8.911626 }
                ]
            },

            // --- INFRASTRUCTURE ---
            {
                id: 'QUAY', type: 'QUAY', description: 'Banchina Gru',
                vertices: [
                    { "lat": 44.405217, "lng": 8.912407 },
                    { "lat": 44.403914, "lng": 8.918602 },
                    { "lat": 44.403768, "lng": 8.918549 },
                    { "lat": 44.405067, "lng": 8.912321 }
                ]
            },
            {
                id: 'RAIL', type: 'RAIL',
                vertices: [
                    { "lat": 44.404162, "lng": 8.909134 },
                    { "lat": 44.402772, "lng": 8.915625 },
                    { "lat": 44.40253, "lng": 8.91555 },
                    { "lat": 44.403937, "lng": 8.909027 },
                    { "lat": 44.404136, "lng": 8.908512 },
                    { "lat": 44.404558, "lng": 8.90789 },
                    { "lat": 44.404735, "lng": 8.907643 },
                    { "lat": 44.404785, "lng": 8.907761 },
                    { "lat": 44.404478, "lng": 8.908238 },
                    { "lat": 44.404221, "lng": 8.908812 }
                ]
            },
            {
                id: 'GATE_IN', type: 'GATE', description: 'Dogana / Varco Ingresso',
                vertices: [
                    { "lat": 44.406212, "lng": 8.904971 },
                    { "lat": 44.406091, "lng": 8.904794 },
                    { "lat": 44.40593, "lng": 8.905038 },
                    { "lat": 44.406055, "lng": 8.905205 }
                ]
            },
            {
                id: 'GATE_OUT', type: 'GATE', description: 'Dogana / Varco Uscita',
                vertices: [
                    { "lat": 44.40714, "lng": 8.904792 },
                    { "lat": 44.406961, "lng": 8.904899 },
                    { "lat": 44.407042, "lng": 8.905175 },
                    { "lat": 44.407228, "lng": 8.905057 }
                ]
            },
            {
                id: 'OCR_GATE', type: 'GATE', description: 'Pre-Gate Auto Scanner',
                vertices: [
                    { "lat": 44.406584, "lng": 8.907822 },
                    { "lat": 44.406652, "lng": 8.907822 },
                    { "lat": 44.406652, "lng": 8.907897 },
                    { "lat": 44.406584, "lng": 8.907897 }
                ]
            },
            // NOTE: the former DOGANA_IN / DOGANA_OUT zones were removed. They were
            // synthetic placeholders (axis-aligned rectangles on round coordinates,
            // "placed between highway and OCR") that did not correspond to anything
            // on the ground. Customs is handled at GATE_IN / GATE_OUT, which are
            // real traced polygons.
            {
                id: 'SPAWN_POINT_1', type: 'GATE', description: 'Casello Genova Ovest',
                vertices: [
                    { "lat": 44.417907, "lng": 8.902442 },
                    { "lat": 44.41776, "lng": 8.902517 },
                    { "lat": 44.417541, "lng": 8.901873 },
                    { "lat": 44.417758, "lng": 8.901777 }
                ]
            },
            {
                id: 'DESPAWN_POINT_1', type: 'GATE', description: 'Uscita Genova Ovest',
                vertices: [
                    { "lat": 44.417907, "lng": 8.902442 },
                    { "lat": 44.417971, "lng": 8.902777 },
                    { "lat": 44.417829, "lng": 8.90286 },
                    { "lat": 44.41776, "lng": 8.902517 }
                ]
            },
            {
                // Truck gate lanes, immediately east of the OCR portal and right
                // next to the yard. These are the real entry/exit for trucks:
                // GATE_IN / GATE_OUT sit ~235m WEST of the OCR, so routing through
                // them sent trucks backwards past the out-of-gauge gate.
                id: 'TRUCK_LANES_IN', type: 'GATE', description: '3 Corsie Ingresso (dopo varco OCR)',
                vertices: [
                    { "lat": 44.406093, "lng": 8.910714 },
                    { "lat": 44.405996, "lng": 8.910656 },
                    { "lat": 44.405919, "lng": 8.910989 },
                    { "lat": 44.406022, "lng": 8.911059 }
                ]
            },
            {
                // Shares its southern edge with TRUCK_LANES_IN — same gate complex.
                id: 'TRUCK_LANES_OUT', type: 'GATE', description: '2 Corsie Uscita Camion',
                vertices: [
                    { "lat": 44.406206, "lng": 8.910763 },
                    { "lat": 44.406092, "lng": 8.910719 },
                    { "lat": 44.406022, "lng": 8.911059 },
                    { "lat": 44.406166, "lng": 8.911106 }
                ]
            },
            {
                // Reserved for out-of-gauge loads ONLY — never part of the
                // standard truck route.
                id: 'GATE_OOG', type: 'GATE', description: 'Fuori Sagoma',
                vertices: [
                    { "lat": 44.406271, "lng": 8.907463 },
                    { "lat": 44.406179, "lng": 8.907428 },
                    { "lat": 44.406169, "lng": 8.90753 },
                    { "lat": 44.406269, "lng": 8.907576 }
                ]
            },
            {
                id: 'OFFICE', type: 'BUILDING',
                vertices: [
                    { "lat": 44.405737, "lng": 8.910854 },
                    { "lat": 44.40581, "lng": 8.91047 },
                    { "lat": 44.405965, "lng": 8.910542 },
                    { "lat": 44.405901, "lng": 8.91095 }
                ]
            },

            // --- LOADING AREAS (TRANSFER ZONES) ---
            {
                id: 'LOADING_RAIL', type: 'LOADING',
                vertices: [
                    { "lat": 44.404162, "lng": 8.909134 },
                    { "lat": 44.404344, "lng": 8.90922 },
                    { "lat": 44.403375, "lng": 8.913753 },
                    { "lat": 44.403188, "lng": 8.913683 }
                ]
            },
            {
                id: 'WAITING_CAMION', type: 'LOADING',
                vertices: [
                    { "lat": 44.405781, "lng": 8.909399 },
                    { "lat": 44.405924, "lng": 8.909464 },
                    { "lat": 44.405793, "lng": 8.910076 },
                    { "lat": 44.405741, "lng": 8.910328 },
                    { "lat": 44.405628, "lng": 8.910993 },
                    { "lat": 44.405478, "lng": 8.910947 }
                ]
            },
            {
                id: 'LOADING_AB', type: 'LOADING',
                vertices: [
                    { "lat": 44.405846, "lng": 8.907984 },
                    { "lat": 44.405727, "lng": 8.907978 },
                    { "lat": 44.405129, "lng": 8.911167 },
                    { "lat": 44.405209, "lng": 8.911165 }
                ]
            },
            {
                id: 'LOADING_BC', type: 'LOADING',
                vertices: [
                    { "lat": 44.405451, "lng": 8.90782 },
                    { "lat": 44.405539, "lng": 8.907906 },
                    { "lat": 44.404918, "lng": 8.910947 },
                    { "lat": 44.404828, "lng": 8.910915 }
                ]
            },
            {
                id: 'LOADING_CD_LT', type: 'LOADING',
                vertices: [
                    { "lat": 44.405265, "lng": 8.907753 },
                    { "lat": 44.405037, "lng": 8.90815 },
                    { "lat": 44.404619, "lng": 8.910491 },
                    { "lat": 44.404725, "lng": 8.910541 }
                ]
            },
            {
                id: 'LOADING_BC_CRANES', type: 'LOADING',
                vertices: [
                    { "lat": 44.404493, "lng": 8.911205 },
                    { "lat": 44.404312, "lng": 8.911134 },
                    { "lat": 44.403408, "lng": 8.915498 },
                    { "lat": 44.403573, "lng": 8.915545 }
                ]
            },
            {
                id: 'LOADING_AC_CRANES', type: 'LOADING',
                vertices: [
                    { "lat": 44.404816, "lng": 8.911985 },
                    { "lat": 44.40498, "lng": 8.912074 },
                    { "lat": 44.403898, "lng": 8.917277 },
                    { "lat": 44.403753, "lng": 8.917235 }
                ]
            }
        ];
    } // End Constructor

    /**
     * Calculates maximum container capacity (Bays x Rows) for a zone
     * based on its geospatial dimensions.
     */
    getZoneCapacity(zoneId) {
        const zone = this.zones.find(z => z.id === zoneId);
        if (!zone || !zone.vertices || zone.vertices.length < 3) return { bays: 0, rows: 0 };

        const p0 = zone.vertices[0];
        const p1 = zone.vertices[1];
        const p2 = zone.vertices[2];

        // Distances
        const width = this._distanceMeters(p0, p1);
        const height = this._distanceMeters(p1, p2);

        // Container Dimensions
        const slotW = 6.4;
        const slotH = 2.6;

        // Calculate counts
        const maxBays = Math.floor(width / slotW);
        const maxRows = Math.floor(height / slotH);

        return {
            bays: Math.max(1, maxBays),
            rows: Math.max(1, maxRows),
            widthMeters: width,
            heightMeters: height
        };
    }

    _distanceMeters(p1, p2) {
        const R = 6371e3; // metres
        const φ1 = p1.lat * Math.PI / 180;
        const φ2 = p2.lat * Math.PI / 180;
        const Δφ = (p2.lat - p1.lat) * Math.PI / 180;
        const Δλ = (p2.lng - p1.lng) * Math.PI / 180;

        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c;
    }

    getZones() {
        return this.zones;
    }

    getZonePolygon(zoneId) {
        const zone = this.zones.find(z => z.id === zoneId);
        if (!zone) return null;
        if (zone.vertices) return zone.vertices;
        return null; // Should handle non-polygon zones if any
    }

    getRandomPointInZone(zoneId) {
        const zone = this.zones.find(z => z.id === zoneId);
        if (!zone || !zone.vertices || zone.vertices.length < 3) return null;

        // Simple Bounding Box approach for MVP
        // (For more precision in non-rectangular rotated zones, we would use Ray Casting or similar)
        let minLat = 90, maxLat = -90;
        let minLng = 180, maxLng = -180;

        zone.vertices.forEach(v => {
            if (v.lat < minLat) minLat = v.lat;
            if (v.lat > maxLat) maxLat = v.lat;
            if (v.lng < minLng) minLng = v.lng;
            if (v.lng > maxLng) maxLng = v.lng;
        });

        // Simple valid point finder (Try 10 times to find a point inside polygon)
        for (let i = 0; i < 10; i++) {
            const lat = minLat + Math.random() * (maxLat - minLat);
            const lng = minLng + Math.random() * (maxLng - minLng);

            if (this._isPointInPolygon({ lat, lng }, zone.vertices)) {
                return { lat, lng };
            }
        }

        // Fallback to center if efficient check fails
        return {
            lat: (minLat + maxLat) / 2,
            lng: (minLng + maxLng) / 2
        };
    }

    _isPointInPolygon(point, vs) {
        // Ray-casting algorithm based on
        // http://www.ecse.rpi.edu/Homepages/wrf/Research/Short_Notes/pnpoly.html

        const x = point.lat, y = point.lng;

        let inside = false;
        for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
            const xi = vs[i].lat, yi = vs[i].lng;
            const xj = vs[j].lat, yj = vs[j].lng;

            const intersect = ((yi > y) !== (yj > y))
                && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }

        return inside;
    }

    /**
     * Whether a point falls inside a zone's polygon.
     *
     * Distance-to-centre is a poor test for arrival: WAITING_CAMION is ~127m
     * long, so a truck can be properly parked in it and still sit 48m from the
     * centroid. Zones are areas, not points.
     * @returns {boolean}
     */
    isInsideZone(point, zoneId) {
        const zone = this.zones.find(z => z.id === zoneId);
        if (!zone || !zone.vertices || zone.vertices.length < 3 || !point) return false;
        return this._isPointInPolygon(point, zone.vertices);
    }

    /**
     * A parking spot inside a zone, spread along its long axis.
     *
     * Vehicles used to all drive to the geometric centre, so they stacked on
     * the same pixel when stopped. Slots are laid out between the zone's two
     * farthest vertices — that follows the real orientation, which matters for
     * the diagonal quays and lanes here, where a bounding-box axis would fall
     * outside the polygon.
     *
     * @param {string} zoneId
     * @param {number} slotIndex - 0-based.
     * @param {number} slotCount - How many slots to divide the zone into.
     * @returns {{lat:number,lng:number}|null}
     */
    getParkingSlot(zoneId, slotIndex = 0, slotCount = 8) {
        const zone = this.zones.find(z => z.id === zoneId);
        const centre = this.getZoneCenter(zoneId);
        if (!zone || !zone.vertices || zone.vertices.length < 3 || !centre) return centre;

        // Long axis = the most distant pair of vertices.
        let a = zone.vertices[0], b = zone.vertices[1], best = -1;
        for (let i = 0; i < zone.vertices.length; i++) {
            for (let j = i + 1; j < zone.vertices.length; j++) {
                const d = this._distanceMeters(zone.vertices[i], zone.vertices[j]);
                if (d > best) { best = d; a = zone.vertices[i]; b = zone.vertices[j]; }
            }
        }

        const count = Math.max(1, slotCount);
        const idx = ((slotIndex % count) + count) % count;

        // Keep off the ends so vehicles do not sit on the boundary.
        const INSET = 0.18;
        const t = INSET + ((idx + 0.5) / count) * (1 - 2 * INSET);

        let p = { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };

        // The long axis is a chord, so for concave or slanted shapes it can pass
        // outside. Pull towards the centre until it is in.
        for (let k = 0; k < 8 && !this._isPointInPolygon(p, zone.vertices); k++) {
            p = { lat: (p.lat + centre.lat) / 2, lng: (p.lng + centre.lng) / 2 };
        }

        return p;
    }

    /**
     * A tidy grid of parking spots filling a zone — for a depot holding dozens
     * of vehicles, where a single line of slots would run off the end.
     *
     * Spots are laid out along the zone's two axes and filtered to those that
     * actually fall inside the polygon, then returned ordered by distance to
     * `exitToward` when given. That ordering is what lets the vehicles nearest
     * the way out be dispatched first, instead of one at the back having to
     * thread past everyone.
     *
     * @param {string} zoneId
     * @param {number} wanted - How many spots are needed.
     * @param {{lat:number,lng:number}|null} exitToward - Sort spots towards this.
     * @returns {Array<{lat:number,lng:number}>}
     */
    getParkingGrid(zoneId, wanted = 10, exitToward = null) {
        const zone = this.zones.find(z => z.id === zoneId);
        if (!zone || !zone.vertices || zone.vertices.length < 3) return [];

        let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
        zone.vertices.forEach(v => {
            minLat = Math.min(minLat, v.lat); maxLat = Math.max(maxLat, v.lat);
            minLng = Math.min(minLng, v.lng); maxLng = Math.max(maxLng, v.lng);
        });

        // Oversample: a good share of grid points land outside a non-rectangular
        // polygon, so ask for more than needed and keep the ones that fit.
        let cols = Math.ceil(Math.sqrt(wanted * 2.5));
        let rows = cols;
        let spots = [];

        for (let attempt = 0; attempt < 4 && spots.length < wanted; attempt++) {
            spots = [];
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const p = {
                        lat: minLat + (maxLat - minLat) * ((r + 0.5) / rows),
                        lng: minLng + (maxLng - minLng) * ((c + 0.5) / cols)
                    };
                    if (this._isPointInPolygon(p, zone.vertices)) spots.push(p);
                }
            }
            if (spots.length < wanted) { cols += 3; rows += 3; }
        }

        if (exitToward) {
            spots.sort((a, b) =>
                this._distanceMeters(a, exitToward) - this._distanceMeters(b, exitToward));
        }

        return spots.slice(0, wanted);
    }

    getZoneCenter(zoneId) {
        const zone = this.zones.find(z => z.id === zoneId);
        if (!zone || !zone.vertices) return null;

        let latSum = 0, lngSum = 0;
        zone.vertices.forEach(v => {
            latSum += v.lat;
            lngSum += v.lng;
        });

        return {
            lat: latSum / zone.vertices.length,
            lng: lngSum / zone.vertices.length
        };
    }
}
