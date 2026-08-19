import { describe, it, assert, equal } from './harness.js';
import { GeoManager } from '../src/core/GeoManager.js';
import { Yard } from '../src/core/yardManager.js';
import { FleetManager } from '../src/core/FleetManager.js';
import { JobManager } from '../src/core/JobManager.js';
import { TruckManager, TruckRoute } from '../src/core/TruckManager.js';

const geo = new GeoManager();

function nuovo() {
    const yard = new Yard(), fleet = new FleetManager();
    fleet.seedInitialPositions(geo);
    const tm = new TruckManager(geo, new JobManager(fleet, yard, geo), yard);
    globalThis.window.truckManager = tm;
    return tm;
}
const zitto = fn => { const q = console.log; console.log = () => { }; const r = fn(); console.log = q; return r; };

describe('Posti di sosta — geometria', () => {
    it('i posti cadono dentro la zona', () => {
        ['WAITING_CAMION', 'TRUCK_LANES_IN', 'GATE_IN', 'DEPOT_RALLE'].forEach(z => {
            for (let i = 0; i < 8; i++) {
                const p = geo.getParkingSlot(z, i, 8);
                assert(p, `${z} slot ${i}: nessun punto`);
                assert(geo.isInsideZone(p, z), `${z} slot ${i} cade fuori dalla zona`);
            }
        });
    });

    it('posti diversi non si sovrappongono', () => {
        // Il motivo per cui esistono: prima tutti i mezzi puntavano al centroide
        // e si accavallavano da fermi.
        const pts = [];
        for (let i = 0; i < 8; i++) pts.push(geo.getParkingSlot('WAITING_CAMION', i, 8));
        for (let i = 0; i < pts.length; i++) {
            for (let j = i + 1; j < pts.length; j++) {
                assert(geo._distanceMeters(pts[i], pts[j]) > 3,
                    `slot ${i} e ${j} praticamente sovrapposti`);
            }
        }
    });

    it('lo stesso indice dà sempre lo stesso punto', () => {
        const a = geo.getParkingSlot('WAITING_CAMION', 3, 8);
        const b = geo.getParkingSlot('WAITING_CAMION', 3, 8);
        equal(a.lat, b.lat); equal(a.lng, b.lng);
    });
});

describe('Posti di sosta — assegnazione', () => {
    it('camion diversi ricevono posti diversi nella stessa zona', () => {
        const tm = nuovo();
        const a = zitto(() => tm.spawnTruck('EXPORT'));
        const b = zitto(() => tm.spawnTruck('EXPORT'));
        if (!a || !b) return; // spawn bloccato dalla distanza minima: non applicabile

        tm.claimParkingSlot(a, TruckRoute.YARD);
        tm.claimParkingSlot(b, TruckRoute.YARD);
        assert(a.parkingSlot !== b.parkingSlot, 'due camion sullo stesso posto');
    });

    it('cambiare destinazione libera il posto precedente', () => {
        const tm = nuovo();
        const t = zitto(() => tm.spawnTruck('EXPORT'));
        tm.claimParkingSlot(t, TruckRoute.YARD);
        equal(t.parkingZone, TruckRoute.YARD);

        tm.claimParkingSlot(t, TruckRoute.LANES_OUT);
        equal(t.parkingZone, TruckRoute.LANES_OUT, 'non ha cambiato zona');
        equal(tm.parkingSlots.get(TruckRoute.YARD).size, 0, 'il posto vecchio non è stato liberato');
    });

    it('il posto liberato viene riusato', () => {
        const tm = nuovo();
        const t = zitto(() => tm.spawnTruck('EXPORT'));
        tm.claimParkingSlot(t, TruckRoute.YARD);
        const primo = t.parkingSlot;

        tm.releaseParkingSlot(t);
        const t2 = zitto(() => tm.spawnTruck('EXPORT'));
        if (!t2) return;
        tm.claimParkingSlot(t2, TruckRoute.YARD);
        equal(t2.parkingSlot, primo, 'il posto libero non è stato riutilizzato');
    });

    it('il punto di sosta è dentro la zona bersaglio', () => {
        const tm = nuovo();
        const t = zitto(() => tm.spawnTruck('EXPORT'));
        tm.claimParkingSlot(t, TruckRoute.YARD);
        const p = tm.parkingPointFor(t, TruckRoute.YARD);
        assert(geo.isInsideZone(p, TruckRoute.YARD), 'il punto di sosta è fuori dal piazzale');
    });
});

describe('Arrivo — area, non centroide', () => {
    it('un camion dentro una zona lunga risulta arrivato anche lontano dal centro', () => {
        // È il bug che faceva girare i camion in tondo: fermi nel piazzale ma
        // considerati "ancora da muovere", quindi rispediti sul percorso da capo.
        const tm = nuovo();
        const t = zitto(() => tm.spawnTruck('EXPORT'));
        const bordo = geo.getParkingSlot('WAITING_CAMION', 7, 8);
        t.position = { lat: bordo.lat, lng: bordo.lng };

        const centro = geo.getZoneCenter('WAITING_CAMION');
        assert(geo._distanceMeters(t.position, centro) > 25, 'test inefficace: troppo vicino al centro');
        assert(tm._hasArrived(t, 'WAITING_CAMION', 25), 'non riconosciuto come arrivato');
    });

    it('un camion lontano dalla zona non risulta arrivato', () => {
        const tm = nuovo();
        const t = zitto(() => tm.spawnTruck('EXPORT'));
        t.position = { lat: 44.4179, lng: 8.9024 }; // al casello
        equal(tm._hasArrived(t, 'WAITING_CAMION', 25), false);
    });
});
