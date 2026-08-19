import { describe, it, assert, equal } from './harness.js';
import { GeoManager } from '../src/core/GeoManager.js';
import { Yard } from '../src/core/yardManager.js';
import { FleetManager } from '../src/core/FleetManager.js';
import { JobManager, JobStatus } from '../src/core/JobManager.js';
import { TruckManager, TruckStatus } from '../src/core/TruckManager.js';

const geo = new GeoManager();

function setup() {
    const yard = new Yard(), fleet = new FleetManager();
    fleet.seedInitialPositions(geo);
    const jm = new JobManager(fleet, yard, geo);
    const tm = new TruckManager(geo, jm, yard);
    globalThis.window.truckManager = tm;
    return { yard, fleet, jm, tm };
}
const zitto = fn => { const q = console.log; console.log = () => { }; const r = fn(); console.log = q; return r; };

describe('Dispatch anticipato — il job nasce a OCR, non al varco fisico', () => {
    it('_dispatchYardJob crea e assegna subito il job', () => {
        const { jm, tm } = setup();
        const t = zitto(() => tm.spawnTruck('EXPORT', { oversize: false }));
        equal(t.assignedJobId, null, 'il job esiste già prima della dispatch');

        zitto(() => tm._dispatchYardJob(t));
        assert(t.assignedJobId, 'il camion non ha ricevuto un job');

        const job = jm.jobs.find(j => j.id === t.assignedJobId);
        assert(job, 'job non trovato');
        equal(job.status, JobStatus.ASSIGNED, 'il job non è stato assegnato a un mezzo');
        assert(job.assignedVehicleId, 'nessun mezzo assegnato');
    });

    it('handleOCRArrival dispaccia alla fine della scansione, senza aspettare l\'arrivo fisico', async () => {
        const { tm } = setup();
        const t = zitto(() => tm.spawnTruck('EXPORT', { oversize: false }));
        tm.ocrProcessingTimeMs = 10; // accelerato per il test

        zitto(() => tm.handleOCRArrival(t));
        equal(t.assignedJobId, null, 'dispacciato troppo presto, prima che la scansione finisca');

        await new Promise(r => setTimeout(r, 40));
        assert(t.assignedJobId, 'il job non è stato dispacciato al termine della scansione OCR');
        equal(t.status, 'Gate Queue', 'il camion deve comunque proseguire per conto suo verso il varco');
    });
});

describe('JobManager._hasArrivedAtZone — area, non centroide', () => {
    it('riconosce un mezzo dentro una zona lunga anche lontano dal centro', () => {
        // Lo stesso bug già visto per i camion: WAITING_CAMION è lungo ~127m,
        // un mezzo parcheggiato al proprio slot può stare a 40-60m dal
        // centroide. Con solo il controllo sul centro il job resterebbe
        // bloccato in ASSIGNED per sempre, mezzo fermo ma job invisibile.
        const { jm } = setup();
        const bordo = geo.getParkingSlot('WAITING_CAMION', 7, 8);
        const centro = geo.getZoneCenter('WAITING_CAMION');
        assert(geo._distanceMeters(bordo, centro) > 25, 'test inefficace: troppo vicino al centro');
        assert(jm._hasArrivedAtZone(bordo, 'WAITING_CAMION'), 'non riconosciuto come arrivato');
    });

    it('non considera arrivato un mezzo lontano dalla zona', () => {
        const { jm } = setup();
        equal(jm._hasArrivedAtZone({ lat: 44.4179, lng: 8.9024 }, 'WAITING_CAMION'), false);
    });
});

describe('Guardia _sourceReady — niente prelievo da un camion non ancora fermo', () => {
    it('un job TRUCK_EXPORT non è pronto finché il camion non è Servicing', () => {
        const { jm, tm } = setup();
        const t = zitto(() => tm.spawnTruck('EXPORT', { oversize: false }));
        const job = jm.createJob('TRUCK_EXPORT', t.containerId, 'WAITING_CAMION', 'YARD');

        t.status = TruckStatus.INBOUND;
        equal(jm._sourceReady(job), false, 'risulta pronto anche se il camion è ancora in viaggio');

        t.status = TruckStatus.SERVICING;
        equal(jm._sourceReady(job), true, 'non riconosciuto pronto quando il camion è fermo e in servizio');
    });

    it('un job TRUCK_IMPORT non dipende da nessun camion per il prelievo', () => {
        const { jm } = setup();
        const job = jm.createJob('TRUCK_IMPORT', 'MOCK-1', 'WAITING_CAMION', 'YARD');
        equal(jm._sourceReady(job), true, 'l\'import non deve aspettare un camion per il pickup');
    });

    it('il semovente arrivato in anticipo aspetta invece di prelevare a vuoto', () => {
        const { jm, fleet, tm } = setup();
        const t = zitto(() => tm.spawnTruck('EXPORT', { oversize: false }));
        const job = jm.createJob('TRUCK_EXPORT', t.containerId, 'WAITING_CAMION', 'YARD');
        job.status = JobStatus.ASSIGNED;

        const rs = fleet.getVehicles().find(v => v.type === 'Reach Stacker');
        job.assignedVehicleId = rs.id;
        rs.currentJobId = job.id;
        rs.status = 'Job Assigned';
        rs.position = geo.getZoneCenter('WAITING_CAMION'); // già sul posto

        t.status = TruckStatus.INBOUND; // il camion non c'è ancora

        zitto(() => jm.update(0.1));
        equal(job.status, JobStatus.ASSIGNED, 'ha iniziato il prelievo senza che il camion fosse arrivato');
        equal(rs.status, 'Job Assigned', 'lo stato del mezzo è cambiato troppo presto');

        t.status = TruckStatus.SERVICING; // ora il camion è parcheggiato
        zitto(() => jm.update(0.1));
        equal(job.status, 'PICKING_UP', 'non è partito il prelievo una volta arrivato il camion');
    });
});
