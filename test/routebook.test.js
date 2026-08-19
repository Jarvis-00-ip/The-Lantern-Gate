import { describe, it, assert, equal } from './harness.js';
import { RouteBook } from '../src/core/RouteBook.js';
import { GeoManager } from '../src/core/GeoManager.js';
import { TruckRoute, TRUCK_LEGS, GATE_OUT_OF_GAUGE } from '../src/core/TruckManager.js';
import { DEFAULT_TRUCK_ROUTES } from '../src/core/DefaultTruckRoutes.js';

const geo = new GeoManager();

/** Storage finto: isola la logica del RouteBook dal localStorage. */
function fakeStorage() {
    const box = {};
    return {
        box,
        async save(k, v) { box[k] = JSON.parse(JSON.stringify(v)); return true; },
        async load(k, fb = null) { return k in box ? box[k] : fb; }
    };
}

const nuovo = () => new RouteBook(fakeStorage(), geo);

describe('RouteBook — memorizzazione per tratta', () => {
    it('una tratta senza default e senza disegno resta automatica', () => {
        // OCR → varco fuori sagoma è l'unica tratta non ancora tracciata
        equal(nuovo().get(TruckRoute.OCR, GATE_OUT_OF_GAUGE), null);
    });

    it('restituisce il percorso disegnato', () => {
        const rb = nuovo();
        const pts = [{ lat: 44.4066, lng: 8.9079 }, { lat: 44.4062, lng: 8.9095 }, { lat: 44.4060, lng: 8.9108 }];
        rb.set(TruckRoute.OCR, TruckRoute.LANES_IN, pts);
        equal(rb.get(TruckRoute.OCR, TruckRoute.LANES_IN).length, 3);
        assert(rb.has(TruckRoute.OCR, TruckRoute.LANES_IN));
    });

    it('disegnare una tratta non tocca le altre', () => {
        const rb = nuovo();
        rb.set(TruckRoute.OCR, TruckRoute.LANES_IN, [{ lat: 44.4066, lng: 8.9079 }, { lat: 44.4060, lng: 8.9108 }]);
        equal(rb.overrideCount(), 1, 'ha sovrascritto più di una tratta');
        equal(rb.sourceOf(TruckRoute.YARD, TruckRoute.LANES_OUT), 'default', 'una tratta ha invaso l\'altra');
    });

    it('rifiuta un percorso con meno di due punti', () => {
        let alzata = false;
        try { nuovo().set(TruckRoute.OCR, TruckRoute.LANES_IN, [{ lat: 44.4, lng: 8.9 }]); }
        catch (e) { alzata = true; }
        assert(alzata, 'un singolo punto non è un percorso');
    });

    it('cancellare un disegno riporta al default di serie', () => {
        const rb = nuovo();
        rb.set(TruckRoute.OCR, TruckRoute.LANES_IN, [{ lat: 44.4066, lng: 8.9079 }, { lat: 44.4060, lng: 8.9108 }]);
        equal(rb.sourceOf(TruckRoute.OCR, TruckRoute.LANES_IN), 'locale');

        rb.remove(TruckRoute.OCR, TruckRoute.LANES_IN);
        equal(rb.sourceOf(TruckRoute.OCR, TruckRoute.LANES_IN), 'default', 'non è tornato al percorso di serie');
        assert(rb.get(TruckRoute.OCR, TruckRoute.LANES_IN), 'la tratta è rimasta scoperta');
    });

    it('cancellare una tratta senza default la riporta all\'automatico', () => {
        const rb = nuovo();
        rb.set(TruckRoute.OCR, GATE_OUT_OF_GAUGE, [{ lat: 44.4066, lng: 8.9079 }, { lat: 44.4062, lng: 8.9075 }]);
        rb.remove(TruckRoute.OCR, GATE_OUT_OF_GAUGE);
        equal(rb.get(TruckRoute.OCR, GATE_OUT_OF_GAUGE), null);
    });
});

describe('RouteBook — verso di percorrenza', () => {
    // Disegnare partendo dal capo sbagliato è un errore facilissimo, e manderebbe
    // i camion contromano lungo la tratta.
    const daOCR = () => geo.getZoneCenter(TruckRoute.OCR);
    const aCorsie = () => geo.getZoneCenter(TruckRoute.LANES_IN);

    it('mantiene il verso se disegnato correttamente', () => {
        const rb = nuovo();
        const salvato = rb.set(TruckRoute.OCR, TruckRoute.LANES_IN, [daOCR(), aCorsie()]);
        assert(geo._distanceMeters(salvato[0], daOCR()) < 50, 'il percorso non parte dall\'origine');
    });

    it('inverte il percorso se disegnato al contrario', () => {
        const rb = nuovo();
        const salvato = rb.set(TruckRoute.OCR, TruckRoute.LANES_IN, [aCorsie(), daOCR()]);
        assert(geo._distanceMeters(salvato[0], daOCR()) < 50,
            'disegnato al contrario e non corretto: i camion andrebbero contromano');
        assert(geo._distanceMeters(salvato[salvato.length - 1], aCorsie()) < 50, 'la fine non è la destinazione');
    });
});

describe('RouteBook — persistenza', () => {
    it('rilegge i percorsi salvati', async () => {
        const storage = fakeStorage();
        const rb = new RouteBook(storage, geo);
        rb.set(TruckRoute.OCR, TruckRoute.LANES_IN, [{ lat: 44.4066, lng: 8.9079 }, { lat: 44.4060, lng: 8.9108 }]);
        await rb.persist();

        const rb2 = new RouteBook(storage, geo);
        await rb2.load();
        equal(rb2.overrideCount(), 1, 'il disegno non è sopravvissuto al ricaricamento');
        equal(rb2.sourceOf(TruckRoute.OCR, TruckRoute.LANES_IN), 'locale');
    });

    it('senza nulla di salvato restano i default di serie', async () => {
        const rb = new RouteBook(fakeStorage(), geo);
        await rb.load();
        equal(rb.overrideCount(), 0, 'non dovrebbero esserci disegni locali');
        equal(rb.count(), Object.keys(DEFAULT_TRUCK_ROUTES).length, 'i default non sono attivi');
    });

    it('i default coprono le tratte principali dell\'itinerario', () => {
        const rb = nuovo();
        [
            [TruckRoute.SPAWN, TruckRoute.CUSTOMS_IN],
            [TruckRoute.CUSTOMS_IN, TruckRoute.OCR],
            [TruckRoute.OCR, TruckRoute.LANES_IN],
            [TruckRoute.LANES_IN, TruckRoute.YARD],
            [TruckRoute.YARD, TruckRoute.LANES_OUT],
            [TruckRoute.LANES_OUT, TruckRoute.CUSTOMS_OUT],
            [TruckRoute.CUSTOMS_OUT, TruckRoute.DESPAWN]
        ].forEach(([a, b]) => assert(rb.has(a, b), `tratta scoperta nei default: ${a}→${b}`));
    });
});

describe('RouteBook — misure e copertura tratte', () => {
    it('misura la lunghezza del tracciato', () => {
        const rb = nuovo();
        const a = geo.getZoneCenter(TruckRoute.OCR), b = geo.getZoneCenter(TruckRoute.LANES_IN);
        rb.set(TruckRoute.OCR, TruckRoute.LANES_IN, [a, b]);
        const atteso = geo._distanceMeters(a, b);
        const misurato = rb.lengthMeters(TruckRoute.OCR, TruckRoute.LANES_IN);
        assert(Math.abs(misurato - atteso) < 1, `lunghezza errata: ${misurato} vs ${atteso}`);
    });

    it('ogni tratta proposta dall\'editor punta a zone esistenti', () => {
        TRUCK_LEGS.forEach(leg => {
            assert(geo.getZoneCenter(leg.from), `origine inesistente: ${leg.from}`);
            assert(geo.getZoneCenter(leg.to), `destinazione inesistente: ${leg.to}`);
            assert(leg.label && leg.label.length > 0, 'tratta senza etichetta');
        });
    });

    it('copre l\'intero itinerario, ordinario e fuori sagoma', () => {
        const chiavi = TRUCK_LEGS.map(l => `${l.from}>${l.to}`);
        [
            `${TruckRoute.SPAWN}>${TruckRoute.CUSTOMS_IN}`,
            `${TruckRoute.CUSTOMS_IN}>${TruckRoute.OCR}`,
            `${TruckRoute.OCR}>${TruckRoute.LANES_IN}`,
            `${TruckRoute.LANES_IN}>${TruckRoute.YARD}`,
            `${TruckRoute.YARD}>${TruckRoute.LANES_OUT}`,
            `${TruckRoute.LANES_OUT}>${TruckRoute.CUSTOMS_OUT}`,
            `${TruckRoute.CUSTOMS_OUT}>${TruckRoute.DESPAWN}`
        ].forEach(k => assert(chiavi.includes(k), `tratta mancante nell'editor: ${k}`));

        assert(TRUCK_LEGS.some(l => l.oversize), 'manca la deviazione fuori sagoma');
    });
});
