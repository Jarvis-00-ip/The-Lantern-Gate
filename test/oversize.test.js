import { describe, it, assert, equal } from './harness.js';
import { GeoManager } from '../src/core/GeoManager.js';
import { Yard } from '../src/core/yardManager.js';
import { FleetManager } from '../src/core/FleetManager.js';
import { JobManager } from '../src/core/JobManager.js';
import { TruckManager, TruckRoute, GATE_OUT_OF_GAUGE, TruckStatus } from '../src/core/TruckManager.js';

function nuovoManager() {
    const geo = new GeoManager(), yard = new Yard(), fleet = new FleetManager();
    fleet.seedInitialPositions(geo);
    const tm = new TruckManager(geo, new JobManager(fleet, yard, geo), yard);
    globalThis.window.truckManager = tm;
    return { tm, geo };
}

// Lo spawn logga; silenziamolo per non sporcare l'output dei test.
function spawn(tm, tipo, opzioni) {
    const q = console.log; console.log = () => {};
    const t = tm.spawnTruck(tipo, opzioni);
    console.log = q;
    return t;
}

describe('Fuori sagoma — instradamento al varco dedicato', () => {
    it('un camion fuori sagoma usa il GATE_OOG', () => {
        const { tm } = nuovoManager();
        const t = spawn(tm, null, { oversize: true });
        assert(t.isOversize, 'il flag non è stato applicato');
        equal(tm.entryGateFor(t), GATE_OUT_OF_GAUGE, 'non instradato al varco fuori sagoma');
    });

    it('un camion normale non tocca mai il GATE_OOG', () => {
        const { tm } = nuovoManager();
        const t = spawn(tm, null, { oversize: false });
        equal(tm.entryGateFor(t), TruckRoute.LANES_IN, 'un camion ordinario deve usare le corsie normali');
    });

    it('il flag richiesto esplicitamente vince sulla probabilità', () => {
        const { tm } = nuovoManager();
        tm.oversizeSpawnChance = 1.0; // tutti fuori sagoma, se lasciato al caso
        const t = spawn(tm, null, { oversize: false });
        equal(t.isOversize, false, 'l\'opzione esplicita è stata ignorata');
    });

    it('senza indicazioni resta una minoranza', () => {
        const { tm } = nuovoManager();
        assert(tm.oversizeSpawnChance > 0 && tm.oversizeSpawnChance < 0.5,
            'la quota di fuori sagoma dev\'essere una minoranza plausibile');
    });
});

describe('Fuori sagoma — tempi di controllo', () => {
    it('i controlli al varco dedicato durano di più', () => {
        const { tm } = nuovoManager();
        assert(tm.oversizeGateProcessingTimeMs > tm.gateProcessingTimeMs,
            'un fuori sagoma richiede più tempo di un carico ordinario');
    });
});

describe('Fuori sagoma — il resto del percorso non cambia', () => {
    it('prima tappa e uscita restano quelle standard', () => {
        const { tm } = nuovoManager();
        const t = spawn(tm, null, { oversize: true });
        equal(t.targetZone, TruckRoute.CUSTOMS_IN, 'la dogana resta la prima tappa anche per i fuori sagoma');
        equal(t.status, TruckStatus.INBOUND);
    });

    it('il GATE_OOG resta fuori dall\'itinerario condiviso', () => {
        assert(!Object.values(TruckRoute).includes(GATE_OUT_OF_GAUGE),
            'il varco fuori sagoma non deve comparire nel percorso standard');
    });
});
