import { describe, it, assert } from './harness.js';
import { GeoManager } from '../src/core/GeoManager.js';
import { DEFAULT_TRUCK_ROUTES } from '../src/core/DefaultTruckRoutes.js';
import { TRUCK_LEGS } from '../src/core/TruckManager.js';

const geo = new GeoManager();
const voci = Object.entries(DEFAULT_TRUCK_ROUTES);

// Questi percorsi sono dati tracciati a mano ed esportati. I controlli qui
// valgono per qualunque futuro aggiornamento: un export sbagliato (verso
// invertito, estremo agganciato alla zona sbagliata, clic andato lontano)
// deve far fallire la suite invece di finire in produzione.
describe('Percorsi di serie — struttura', () => {
    it('ogni tratta ha almeno due punti con coordinate valide', () => {
        voci.forEach(([chiave, pts]) => {
            assert(Array.isArray(pts) && pts.length >= 2, `${chiave}: percorso troppo corto`);
            pts.forEach((p, i) => {
                assert(typeof p.lat === 'number' && typeof p.lng === 'number', `${chiave}[${i}]: coordinata non numerica`);
                assert(p.lat > 44.39 && p.lat < 44.43, `${chiave}[${i}]: latitudine fuori dall'area del porto`);
                assert(p.lng > 8.88 && p.lng < 8.93, `${chiave}[${i}]: longitudine fuori dall'area del porto`);
            });
        });
    });

    it('ogni chiave corrisponde a una tratta dichiarata', () => {
        const attese = TRUCK_LEGS.map(l => `${l.from}>${l.to}`);
        voci.forEach(([chiave]) => assert(attese.includes(chiave), `tratta non riconosciuta: ${chiave}`));
    });
});

describe('Percorsi di serie — aggancio alle zone', () => {
    voci.forEach(([chiave, pts]) => {
        const [from, to] = chiave.split('>');

        it(`${chiave} parte e finisce dove deve`, () => {
            const zFrom = geo.getZoneCenter(from), zTo = geo.getZoneCenter(to);
            assert(zFrom && zTo, 'zona inesistente');

            // "Vicino" significa dentro l'area oppure entro 60m dal centro: le
            // zone lunghe (WAITING_CAMION è ~127m) hanno un centroide che non
            // rappresenta il punto di sosta.
            const vicino = (p, zonaId, centro) =>
                geo.isInsideZone(p, zonaId) || geo._distanceMeters(p, centro) < 60;

            assert(vicino(pts[0], from, zFrom), `non parte da ${from}`);
            assert(vicino(pts[pts.length - 1], to, zTo), `non arriva a ${to}`);
        });

        it(`${chiave} è orientata nel verso di marcia`, () => {
            const zFrom = geo.getZoneCenter(from), zTo = geo.getZoneCenter(to);
            const primo = pts[0];
            assert(geo._distanceMeters(primo, zFrom) <= geo._distanceMeters(primo, zTo),
                'verso invertito: i camion la percorrerebbero contromano');
        });
    });
});

describe('Percorsi di serie — continuità', () => {
    voci.forEach(([chiave, pts]) => {
        it(`${chiave} non ha salti anomali fra punti consecutivi`, () => {
            let max = 0, dove = -1;
            for (let i = 0; i < pts.length - 1; i++) {
                const d = geo._distanceMeters(pts[i], pts[i + 1]);
                if (d > max) { max = d; dove = i; }
            }
            // 250m tollera i tratti dritti di autostrada, ma intercetta un clic
            // finito dall'altra parte della mappa.
            assert(max < 250, `salto di ${Math.round(max)}m fra i punti ${dove} e ${dove + 1}`);
        });
    });
});
