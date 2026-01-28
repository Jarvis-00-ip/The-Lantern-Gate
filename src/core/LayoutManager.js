export const ZoneType = {
    WATER: 'WATER',
    QUAY: 'QUAY',       // Banchina
    YARD: 'YARD',       // Piazzale (Asphalt)
    CONCRETE_PAD: 'CONCRETE_PAD', // Sotto RTG
    ROAD: 'ROAD',
    GATE: 'GATE',
    BUILDING: 'BUILDING',
    RAILWAY: 'RAILWAY',
    STS_CRANE: 'STS_CRANE', // Gru di banchina
    LANDMARK: 'LANDMARK'    // Lanterna, etc.
};

export class LayoutManager {
    constructor() {
        this.zones = [];
        this.initPSASech();
    }

    initPSASech() {
        // COMPLEX PSA SECH LAYOUT (Satellite Reference)
        // Recreating the "Boot" shape: Narrower West, Wider East
        // Coordinate System: 0,0 is roughly the center of operations

        // --- 1. WATER (Bacino di Sampierdarena) ---
        // Deep South Area
        this.addZone(ZoneType.WATER, -2000, 300, 4000, 1000);

        // --- 2. QUAY (Banchina) ---
        // Runs along the South edge
        this.addZone(ZoneType.QUAY, -900, 250, 1600, 60);

        // --- 3. YARD (Piazzale) - Composite Shape ---

        // Zone A: West Section (Narrower, closer to Lanterna)
        // From x=-900 to x=-100
        this.addZone(ZoneType.YARD, -900, -150, 800, 400);

        // Zone B: East Section (Wider/Taller - The "L" upstroke)
        // From x=-100 to x=700
        // Extends further North towards the Gate
        this.addZone(ZoneType.YARD, -100, -350, 800, 600);

        // RTG/Stacking Lanes (Visual Concrete Strips)
        // West Lanes
        for (let i = 0; i < 4; i++) {
            this.addZone(ZoneType.CONCRETE_PAD, -850 + (i * 180), -130, 60, 380);
        }
        // East Lanes (Longer)
        for (let i = 0; i < 4; i++) {
            this.addZone(ZoneType.CONCRETE_PAD, -50 + (i * 180), -330, 60, 580);
        }

        // --- 4. INFRASTRUCTURE ---
        // Sopraelevata (Curved visual boundary North)
        this.addZone(ZoneType.ROAD, -1000, -400, 2000, 50);

        // Railway Entry (North East)
        this.addZone(ZoneType.RAILWAY, 0, -380, 800, 30);

        // Gate Complex (North East varco)
        this.addZone(ZoneType.GATE, 600, -420, 120, 80);
        this.addZone(ZoneType.BUILDING, 450, -390, 100, 40); // Admin Building

        // --- 5. STS CRANES (Red Giants) ---
        // Spaced along the quay
        const craneXStart = -600;
        const craneSpacing = 280;
        for (let i = 0; i < 5; i++) {
            this.addZone(ZoneType.STS_CRANE, craneXStart + (i * craneSpacing), 250, 50, 90);
        }

        // --- 6. LANDMARKS ---
        // La Lanterna (West tip)
        this.addZone(ZoneType.LANDMARK, -1000, -300, 80, 80, { name: 'Lanterna' });
    }

    addZone(type, x, y, width, height, props = {}) {
        this.zones.push({
            type,
            x,
            y,
            width,
            height,
            ...props
        });
    }

    getZones() {
        return this.zones;
    }
}
