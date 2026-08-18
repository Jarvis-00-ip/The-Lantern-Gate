import { describe, it, assert, equal } from './harness.js';
import { GeoManager } from '../src/core/GeoManager.js';
import { PathFinder, ROAD_COST, DEFAULT_ROAD_COST, NON_DRIVABLE_TYPES } from '../src/core/PathFinder.js';
import { TruckRoute, GATE_OUT_OF_GAUGE } from '../src/core/TruckManager.js';

const geo = new GeoManager();

// Il grafo è caro da costruire: una volta sola per tutta la suite.
const quiet = console.log; console.log = () => {};
const pf = new PathFinder(geo);
pf.setManualMode(true);
console.log = quiet;

describe('PathFinder — ammissibilità dell\'euristica', () => {
    it('nessun costo di strada scende sotto 1.0', () => {
        // L'euristica di A* è la distanza in linea d'aria in metri: se un arco
        // costasse meno della sua lunghezza reale, A* smetterebbe di garantire
        // il percorso ottimo, silenziosamente.
        for (const [tipo, fattore] of Object.entries(ROAD_COST)) {
            assert(fattore >= 1.0, `${tipo} ha costo ${fattore} < 1.0: euristica non più ammissibile`);
        }
        assert(DEFAULT_ROAD_COST >= 1.0, 'il costo di default rompe l\'ammissibilità');
    });

    it('penalizza le residenziali più delle principali', () => {
        assert(ROAD_COST.residential > ROAD_COST.primary, 'le residenziali devono costare di più');
        assert(ROAD_COST.motorway <= ROAD_COST.secondary, 'l\'autostrada deve essere la più conveniente');
    });

    it('tiene basse le strade di servizio (routing interno al terminal)', () => {
        assert(ROAD_COST.service < ROAD_COST.residential,
            'le strade interne al terminal hanno tag service: se costano care il routing nello yard si rompe');
    });
});

describe('PathFinder — vie non carrabili', () => {
    it('esclude percorsi pedonali, scale e ciclabili', () => {
        ['footway', 'pedestrian', 'steps', 'cycleway', 'path'].forEach(t =>
            assert(NON_DRIVABLE_TYPES.includes(t), `${t} deve essere escluso dal grafo`));
    });

    it('esclude ferrovie e infrastrutture mai realizzate', () => {
        ['rail', 'tram', 'construction', 'proposed'].forEach(t =>
            assert(NON_DRIVABLE_TYPES.includes(t), `${t} deve essere escluso`));
    });

    it('nessun arco del grafo è di tipo non carrabile', () => {
        let colpevoli = 0;
        for (const archi of pf.graph.values()) {
            for (const a of archi) if (NON_DRIVABLE_TYPES.includes(a.type)) colpevoli++;
        }
        equal(colpevoli, 0, 'ci sono archi non carrabili nel grafo di navigazione');
    });
});

describe('Percorso camion — nessun ritorno all\'indietro', () => {
    const tappe = ['SPAWN', 'CUSTOMS_IN', 'OCR', 'LANES_IN'];

    it('entrando, la longitudine cresce sempre verso il porto', () => {
        // Il bug originale: il varco usato stava 235m a OVEST dell'OCR, quindi
        // i camion tornavano indietro passando davanti al gate fuori sagoma.
        let prec = -Infinity;
        for (const t of tappe) {
            const lng = geo.getZoneCenter(TruckRoute[t]).lng;
            assert(lng > prec, `${t} (lng ${lng.toFixed(5)}) torna indietro rispetto alla tappa precedente`);
            prec = lng;
        }
    });

    it('uscendo, la longitudine cala sempre verso l\'autostrada', () => {
        let prec = Infinity;
        for (const t of ['LANES_OUT', 'CUSTOMS_OUT', 'DESPAWN']) {
            const lng = geo.getZoneCenter(TruckRoute[t]).lng;
            assert(lng < prec, `${t} (lng ${lng.toFixed(5)}) torna indietro in uscita`);
            prec = lng;
        }
    });

    it('il gate fuori sagoma non fa parte dell\'itinerario', () => {
        assert(!Object.values(TruckRoute).includes(GATE_OUT_OF_GAUGE),
            'GATE_OOG va usato solo per i fuori sagoma');
    });

    it('non usa le zone dogana sintetiche eliminate', () => {
        Object.values(TruckRoute).forEach(z =>
            assert(!z.startsWith('DOGANA'), `${z} era un segnaposto inventato, la dogana è ai varchi reali`));
    });

    it('ogni tappa dell\'itinerario esiste davvero come zona', () => {
        Object.entries(TruckRoute).forEach(([nome, id]) =>
            assert(geo.getZoneCenter(id), `la tappa ${nome} punta a una zona inesistente: ${id}`));
    });
});

describe('Percorso camion — connettività reale su strada', () => {
    const tratte = [
        ['SPAWN', 'CUSTOMS_IN'], ['CUSTOMS_IN', 'OCR'], ['OCR', 'LANES_IN'],
        ['LANES_IN', 'YARD'], ['YARD', 'LANES_OUT'], ['LANES_OUT', 'CUSTOMS_OUT'],
        ['CUSTOMS_OUT', 'DESPAWN']
    ];

    tratte.forEach(([da, a]) => {
        it(`${da} → ${a} ha un percorso su strada sensato`, () => {
            const partenza = geo.getZoneCenter(TruckRoute[da]);
            const q = console.log; console.log = () => {};
            const percorso = pf.findPath(partenza, TruckRoute[a]);
            console.log = q;

            assert(percorso && percorso.length > 1, 'nessun percorso trovato');

            const crow = geo._distanceMeters(partenza, geo.getZoneCenter(TruckRoute[a]));
            const { totalMeters } = pf.describeRoute(percorso);

            // Soglia proporzionale + margine fisso: su una tratta di 60m aggirare
            // un isolato costa già 200m, quindi il solo rapporto boccerebbe un
            // percorso corretto. Il margine assorbe il giro dell'isolato, il
            // fattore continua a intercettare le deviazioni vere sulle tratte lunghe.
            const massimo = crow * 2.5 + 200;
            assert(totalMeters <= massimo,
                `deviazione eccessiva: ${Math.round(totalMeters)}m per ${Math.round(crow)}m in linea d'aria (limite ${Math.round(massimo)}m)`);
        });
    });
});
