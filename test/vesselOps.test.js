import { describe, it, assert, equal } from './harness.js';
import { GeoManager } from '../src/core/GeoManager.js';
import { Yard, Container } from '../src/core/yardManager.js';
import { FleetManager } from '../src/core/FleetManager.js';
import { TranstainerManager } from '../src/core/TranstainerManager.js';
import { VesselManager } from '../src/core/VesselManager.js';
import { VesselOpsManager } from '../src/core/VesselOpsManager.js';

const geo = new GeoManager();

function setup() {
    const yard = new Yard(), fleet = new FleetManager();
    fleet.seedInitialPositions(geo);
    const rtg = new TranstainerManager(geo, fleet, yard);
    rtg.pickTimeMs = 5; rtg.transferTimeMs = 5; rtg.dockTimeMs = 5; rtg.stackTimeMs = 5;

    const vesselManager = new VesselManager();
    const ops = new VesselOpsManager(geo, vesselManager, rtg);
    // Fast enough to actually finish inside a test, same shape of choreography.
    // minBerthMs stays well above a handful of 2ms test ticks so a still-working
    // BERTHED state is actually observable instead of being skipped over.
    ops.speedMps = 4000;
    ops.craneCycleMs = 5;
    ops.minBerthMs = 150;

    return { yard, fleet, rtg, vesselManager, ops };
}

/**
 * No renderer is running in these tests, so a claimed Reach Stacker/Ralla
 * would otherwise sit frozen at its last position forever and every
 * TranstainerManager job would stall waiting for an "arrival" that never
 * happens — same technique transtainer.test.js uses to isolate the state
 * machine from real map animation.
 */
function teleportFleet(fleet) {
    fleet.getVehicles().forEach(v => {
        if (!v.currentZone) return;
        const c = geo.getZoneCenter(v.currentZone);
        if (c) v.position = { lat: c.lat, lng: c.lng, rotation: v.position?.rotation || 0 };
    });
}

/**
 * Ticks the ops loop, driving vessels to their next milestone. Mirrors the
 * real game loop in app.js, where TranstainerManager and VesselOpsManager
 * are updated as independent siblings every frame — vessels only progress
 * because rtg.update() is what actually moves their import/export jobs
 * along.
 */
async function drive(ops, rtg, fleet, ticks = 400) {
    for (let i = 0; i < ticks; i++) {
        teleportFleet(fleet);
        rtg.update(0.05);
        ops.update(0.05);
        await new Promise(r => setTimeout(r, 2));
    }
}

/** Ticks until `predicate(vessel)` holds, or gives up after `maxTicks`. */
async function driveUntil(ops, rtg, fleet, vessel, predicate, maxTicks = 400) {
    for (let i = 0; i < maxTicks && !predicate(vessel); i++) {
        teleportFleet(fleet);
        rtg.update(0.05);
        ops.update(0.05);
        await new Promise(r => setTimeout(r, 2));
    }
    return predicate(vessel);
}

/** requestArrival() waits on a real ETA; back-date it so tests don't stall on wall-clock time. */
function arriveNow(ops, name = null) {
    const vessel = ops.requestArrival(name);
    vessel.eta = new Date(Date.now() - 1000);
    return vessel;
}

describe('VesselOps — schedulazione', () => {
    it('crea una nave INBOUND con un manifest popolato', () => {
        const { ops } = setup();
        const vessel = ops.requestArrival();
        equal(vessel.status, 'INBOUND');
        assert(vessel.manifest.discharge.length >= 2, 'nessun container da scaricare');
        assert(vessel.manifest.load.length >= 2, 'nessun container da caricare');
        assert(!vessel.position, 'non dovrebbe avere una posizione prima di salpare');
    });
});

describe('VesselOps — arrivo e ormeggio', () => {
    it('la nave arriva al largo, punta verso banchina, e attracca', async () => {
        const { ops, rtg, fleet, vesselManager } = setup();
        const vessel = arriveNow(ops);

        const reachedBerth = await driveUntil(ops, rtg, fleet, vessel, v => v.status !== 'INBOUND' && v.status !== 'APPROACHING');
        assert(reachedBerth, 'non ha mai lasciato lo stato di avvicinamento');
        equal(vessel.status, 'BERTHED', 'non ha attraccato');
        equal(vesselManager.activeVessel.id, vessel.id);

        const berth = ops.berths.find(b => b.vesselId === vessel.id);
        assert(berth, 'nessun molo assegnato');
        assert(geo._distanceMeters(vessel.position, berth.position) < 5, 'non è alla posizione del molo');
    });

    it('due navi ricevono moli distinti', async () => {
        const { ops, rtg, fleet } = setup();
        const v1 = arriveNow(ops), v2 = arriveNow(ops);
        await driveUntil(ops, rtg, fleet, v1, v => v.status === 'BERTHED');
        await driveUntil(ops, rtg, fleet, v2, v => v.status === 'BERTHED');

        const b1 = ops.berths.find(b => b.vesselId === v1.id);
        const b2 = ops.berths.find(b => b.vesselId === v2.id);
        assert(b1 && b2, 'una delle due navi non ha molo');
        assert(b1.id !== b2.id, 'stesso molo assegnato a due navi');
    });
});

describe('VesselOps — scarico e carico', () => {
    it('scarica un container della nave nel blocco di piazzale corretto', async () => {
        const { ops, rtg, fleet, yard } = setup();
        const vessel = arriveNow(ops, 'Test Carrier');
        // Only interested in discharge here — empty the load list so the ship
        // can depart as soon as it is done unloading.
        vessel.manifest.load = [];
        const firstDischarge = vessel.manifest.discharge[0];

        await drive(ops, rtg, fleet, 250);

        equal(vessel.status, 'DEPARTED', 'la nave non è mai partita');
        const stored = yard.findContainer(firstDischarge);
        assert(stored, 'il container scaricato non è mai arrivato nello yard');

        const berth = ops.berths.find(b => b.vesselId === vessel.id);
        assert(!berth, 'il molo non è stato liberato alla partenza');
    });

    it('carica sulla nave un container reale prelevato dallo yard', async () => {
        const { ops, fleet, yard, rtg } = setup();
        yard.addContainer(new Container('DOCK-1'), 'BLOCK_A', 1, 1);

        const vessel = arriveNow(ops, 'Test Loader');
        vessel.manifest.discharge = []; // isolate the load path
        vessel.manifest.load = ['DOCK-1'];

        const before = yard.getContainersInZone('BLOCK_A').length;
        await drive(ops, rtg, fleet, 250);

        equal(vessel.status, 'DEPARTED', 'la nave non è mai partita');
        const after = yard.getContainersInZone('BLOCK_A').length;
        equal(after, before - 1, 'nessun container è stato prelevato dal blocco per il carico');

        const anyUnit = rtg.units.find(u => u.exportedCount > 0);
        assert(anyUnit, 'nessuna unità transtainer ha registrato un export');
    });

    it('non resta bloccata se non c\'è nulla da caricare — parte comunque', async () => {
        const { ops, rtg, fleet } = setup(); // yard vuoto: niente da esportare
        const vessel = arriveNow(ops, 'Empty Yard Ship');
        vessel.manifest.discharge = [];
        vessel.manifest.load = ['GHOST-1', 'GHOST-2'];

        await drive(ops, rtg, fleet, 250);
        equal(vessel.status, 'DEPARTED', 'la nave è rimasta bloccata in attesa di carico introvabile');
    });
});
