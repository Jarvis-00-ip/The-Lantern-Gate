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
                id: 'GATE_IN', type: 'GATE',
                vertices: [
                    { "lat": 44.406212, "lng": 8.904971 },
                    { "lat": 44.406091, "lng": 8.904794 },
                    { "lat": 44.40593, "lng": 8.905038 },
                    { "lat": 44.406055, "lng": 8.905205 }
                ]
            },
            {
                id: 'GATE_OUT', type: 'GATE',
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
            {
                id: 'DOGANA_IN', type: 'GATE', description: 'Dogana Ingresso',
                // Placed between Highway Spawn and OCR
                vertices: [
                    { "lat": 44.40950, "lng": 8.90550 },
                    { "lat": 44.40980, "lng": 8.90550 },
                    { "lat": 44.40980, "lng": 8.90600 },
                    { "lat": 44.40950, "lng": 8.90600 }
                ]
            },
            {
                id: 'DOGANA_OUT', type: 'GATE', description: 'Dogana Uscita',
                // Placed after Gate Out, before Highway Despawn
                vertices: [
                    { "lat": 44.40850, "lng": 8.90400 },
                    { "lat": 44.40880, "lng": 8.90400 },
                    { "lat": 44.40880, "lng": 8.90450 },
                    { "lat": 44.40850, "lng": 8.90450 }
                ]
            },
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
