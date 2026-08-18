import { describe, it, assert, equal } from './harness.js';
import { FleetManager, VehicleType, VehicleStatus } from '../src/core/FleetManager.js';
import { GeoManager } from '../src/core/GeoManager.js';

const geo = new GeoManager();

describe('FleetManager — posizionamento iniziale', () => {
    it('dà a ogni mezzo coordinate reali (regressione: mappa vuota all\'avvio)', () => {
        const f = new FleetManager();
        // prima del seed i mezzi hanno il placeholder {x:0,y:0} e il renderer li scarta
        assert(f.getVehicles().every(v => v.position.lat === undefined), 'partenza inattesa');

        f.seedInitialPositions(geo);
        const senzaCoord = f.getVehicles().filter(v => !v.position || typeof v.position.lat !== 'number');
        equal(senzaCoord.length, 0, 'alcuni mezzi restano senza lat/lng');
    });

    it('parcheggia la flotta vicino al depot, non sparpagliata', () => {
        const f = new FleetManager();
        f.seedInitialPositions(geo);
        const depot = geo.getZoneCenter('DEPOT_RALLE');
        const lontani = f.getVehicles().filter(v => geo._distanceMeters(v.position, depot) > 30);
        equal(lontani.length, 0, 'mezzi troppo lontani dal depot: farebbero partire un pathfinding all\'avvio');
    });
});

describe('FleetManager — regole di deploy', () => {
    it('manda una ralla in banchina', () => {
        const f = new FleetManager(); f.seedInitialPositions(geo);
        const ralla = f.getVehicles().find(v => v.type === VehicleType.RALLA);
        assert(f.deployVehicle(ralla.id, 'QUAY', geo), 'deploy rifiutato');
        equal(ralla.currentZone, 'QUAY');
        equal(ralla.status, VehicleStatus.ACTIVE);
    });

    it('impedisce a una ralla di entrare in un blocco di stoccaggio', () => {
        const f = new FleetManager(); f.seedInitialPositions(geo);
        const ralla = f.getVehicles().find(v => v.type === VehicleType.RALLA);
        equal(f.deployVehicle(ralla.id, 'BLOCK_A', geo), false, 'una ralla non opera nei blocchi');
    });

    it('ammette il reach stacker nei blocchi', () => {
        const f = new FleetManager(); f.seedInitialPositions(geo);
        const rs = f.getVehicles().find(v => v.type === VehicleType.REACH_STACKER);
        assert(f.deployVehicle(rs.id, 'BLOCK_A', geo), 'reach stacker rifiutato nel blocco');
    });

    it('rifiuta zone e mezzi inesistenti', () => {
        const f = new FleetManager(); f.seedInitialPositions(geo);
        equal(f.deployVehicle(f.getVehicles()[0].id, 'ZONA_FANTASMA', geo), false);
        equal(f.deployVehicle('MEZZO-FANTASMA', 'QUAY', geo), false);
    });
});

describe('FleetManager — rientro al depot', () => {
    it('riporta il mezzo su un punto reale, non su {0,0}', () => {
        const f = new FleetManager(); f.seedInitialPositions(geo);
        const v = f.getVehicles()[0];
        f.deployVehicle(v.id, 'QUAY', geo);

        f.recallVehicle(v.id, geo);
        equal(v.status, VehicleStatus.IDLE);
        equal(v.currentZone, 'DEPOT_RALLE');
        assert(typeof v.position.lat === 'number', 'il mezzo sparirebbe dalla mappa');
        assert(geo._distanceMeters(v.position, geo.getZoneCenter('DEPOT_RALLE')) < 200, 'non è nel depot');
    });

    it('libera il job in corso', () => {
        const f = new FleetManager(); f.seedInitialPositions(geo);
        const v = f.getVehicles()[0];
        v.currentJobId = 'JOB-X';
        f.recallVehicle(v.id, geo);
        equal(v.currentJobId, null, 'job non rilasciato: il mezzo resterebbe non assegnabile');
    });
});

describe('GeoManager — geometria', () => {
    it('calcola distanze plausibili fra le zone', () => {
        const d = geo._distanceMeters(geo.getZoneCenter('GATE_IN'), geo.getZoneCenter('OCR_GATE'));
        assert(d > 200 && d < 300, `distanza GATE_IN→OCR fuori scala: ${d}m`);
    });

    it('riconosce se un punto è dentro una zona', () => {
        const z = geo.getZones().find(x => x.id === 'DEPOT_RALLE');
        assert(geo._isPointInPolygon(geo.getZoneCenter('DEPOT_RALLE'), z.vertices), 'centro fuori dal poligono');
        assert(!geo._isPointInPolygon({ lat: 0, lng: 0 }, z.vertices), 'punto lontano dato per interno');
    });

    it('genera punti casuali dentro la zona richiesta', () => {
        for (let i = 0; i < 20; i++) {
            const p = geo.getRandomPointInZone('DEPOT_RALLE');
            assert(p && typeof p.lat === 'number', 'punto non valido');
        }
    });
});
