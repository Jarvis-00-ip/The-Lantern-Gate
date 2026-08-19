import { describe, it, assert, equal } from './harness.js';
import { GeoManager } from '../src/core/GeoManager.js';
import { Yard, Container } from '../src/core/yardManager.js';
import { FleetManager } from '../src/core/FleetManager.js';
import {
    TranstainerManager, TranstainerJobType, TranstainerPhase, TRANSTAINER_UNITS
} from '../src/core/TranstainerManager.js';

const geo = new GeoManager();

function setup() {
    const yard = new Yard(), fleet = new FleetManager();
    fleet.seedInitialPositions(geo);
    const rtg = new TranstainerManager(geo, fleet, yard);
    // accelerato per i test: la choreografia è la stessa, solo più veloce
    rtg.pickTimeMs = 5; rtg.transferTimeMs = 5; rtg.dockTimeMs = 5; rtg.stackTimeMs = 5;
    return { yard, fleet, rtg };
}

/** Fa avanzare un job teletrasportando i mezzi coinvolti alla loro destinazione
 *  corrente a ogni tick — isola la macchina a stati dal rendering/animazione. */
async function drive(rtg, fleet, jobs, ticks = 80) {
    for (let i = 0; i < ticks; i++) {
        jobs.forEach(job => {
            [job.reachStackerId, job.rallaId].forEach(id => {
                if (!id) return;
                const v = fleet.getVehicle(id);
                if (v && v.currentZone) {
                    const c = geo.getZoneCenter(v.currentZone);
                    if (c) v.position = { lat: c.lat, lng: c.lng };
                }
            });
        });
        rtg.update(0.05);
        await new Promise(r => setTimeout(r, 5));
    }
}

describe('Transtainer — unità e zone riusate', () => {
    it('ogni unità punta a una zona LOADING esistente, non geometria nuova', () => {
        TRANSTAINER_UNITS.forEach(u => {
            assert(geo.getZoneCenter(u.dockZone), `dock inesistente: ${u.dockZone}`);
            const zone = geo.getZones().find(z => z.id === u.dockZone);
            equal(zone.type, 'LOADING', `${u.dockZone} non è una zona LOADING`);
        });
    });
});

describe('Transtainer — export (blocco → transtainer)', () => {
    it('rifiuta un blocco senza container', () => {
        const { rtg } = setup();
        equal(rtg.requestExport('BLOCK_A'), null, 'ha creato un job dal nulla');
    });

    it('rimuove il container giusto dal blocco e lo consegna al transtainer', async () => {
        const { yard, fleet, rtg } = setup();
        yard.addContainer(new Container('EXP-1'), 'BLOCK_A', 1, 1);
        yard.addContainer(new Container('EXP-2'), 'BLOCK_A', 2, 1);

        const job = rtg.requestExport('BLOCK_A');
        assert(job, 'nessun job creato');
        equal(job.type, TranstainerJobType.EXPORT);

        await drive(rtg, fleet, [job]);

        equal(job.phase, TranstainerPhase.COMPLETED, 'il job non è arrivato a compimento');
        equal(yard.getContainersInZone('BLOCK_A').length, 1, 'doveva restarne uno solo');
        assert(!yard.findContainer(job.containerId), 'il container esportato è ancora nello yard');

        const unit = rtg.units.find(u => u.id === job.unitId);
        equal(unit.exportedCount, 1);
    });

    it('rilascia entrambi i mezzi al depot senza lasciarli agganciati al job', async () => {
        const { yard, fleet, rtg } = setup();
        yard.addContainer(new Container('EXP-1'), 'BLOCK_A', 1, 1);
        const job = rtg.requestExport('BLOCK_A');
        await drive(rtg, fleet, [job]);

        const rs = fleet.getVehicle(job.reachStackerId);
        const ralla = fleet.getVehicle(job.rallaId);
        equal(rs.currentJobId, null, 'reach stacker ancora agganciato al job');
        equal(ralla.currentJobId, null, 'ralla ancora agganciata al job');
        equal(rs.carriedContainer, null, 'reach stacker ancora carico');
        equal(ralla.carriedContainer, null, 'ralla ancora carica');
    });
});

describe('Transtainer — import (transtainer → blocco)', () => {
    it('consegna il container al blocco richiesto', async () => {
        const { yard, fleet, rtg } = setup();
        const job = rtg.requestImport('IMP-1', 'BLOCK_B');
        equal(job.type, TranstainerJobType.IMPORT);

        await drive(rtg, fleet, [job]);

        equal(job.phase, TranstainerPhase.COMPLETED);
        assert(yard.findContainer('IMP-1'), 'il container importato non è nello yard');
        equal(yard.findContainer('IMP-1').zoneId, 'BLOCK_B', 'stoccato nel blocco sbagliato');

        const unit = rtg.units.find(u => u.id === job.unitId);
        equal(unit.importedCount, 1);
    });

    it('genera un id se non specificato', () => {
        const { rtg } = setup();
        const job = rtg.requestImport();
        assert(job.containerId, 'nessun id generato');
        assert(job.targetBlock, 'nessun blocco di destinazione scelto');
    });
});

describe('Transtainer — job concorrenti', () => {
    it('due export dallo stesso blocco non si contendono lo stesso container', async () => {
        const { yard, fleet, rtg } = setup();
        for (let i = 0; i < 4; i++) yard.addContainer(new Container(`C-${i}`), 'BLOCK_A', i + 1, 1);

        const jobs = [rtg.requestExport('BLOCK_A'), rtg.requestExport('BLOCK_A')];
        assert(jobs[0].containerId !== jobs[1].containerId, 'stesso container assegnato a due job');

        await drive(rtg, fleet, jobs);

        jobs.forEach(j => equal(j.phase, TranstainerPhase.COMPLETED));
        equal(yard.getContainersInZone('BLOCK_A').length, 2, 'ne dovevano restare 2 su 4');
    });

    it('job diversi ricevono mezzi diversi', async () => {
        const { yard, fleet, rtg } = setup();
        yard.addContainer(new Container('A-1'), 'BLOCK_A', 1, 1);
        yard.addContainer(new Container('B-1'), 'BLOCK_B', 1, 1);

        const jobs = [rtg.requestExport('BLOCK_A'), rtg.requestExport('BLOCK_B')];
        await drive(rtg, fleet, jobs);

        assert(jobs[0].reachStackerId !== jobs[1].reachStackerId, 'stesso reach stacker su due job');
        assert(jobs[0].rallaId !== jobs[1].rallaId, 'stessa ralla su due job');
    });

    it('nessun mezzo resta agganciato dopo una raffica di job', async () => {
        const { yard, fleet, rtg } = setup();
        for (let i = 0; i < 3; i++) yard.addContainer(new Container(`X-${i}`), 'BLOCK_C', i + 1, 1);
        const jobs = [rtg.requestExport('BLOCK_C'), rtg.requestExport('BLOCK_C'), rtg.requestImport('Y-1', 'BLOCK_D')];

        await drive(rtg, fleet, jobs);

        const stuck = fleet.getVehicles().filter(v => v.currentJobId);
        equal(stuck.length, 0, `mezzi ancora agganciati: ${stuck.map(v => v.id).join(', ')}`);
    });
});
