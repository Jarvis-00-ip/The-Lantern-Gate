import { describe, it, assert, equal } from './harness.js';
import { Yard, Container, ContainerType } from '../src/core/yardManager.js';

describe('Yard — stacking e coordinate', () => {
    it('impila i container e ne riporta l\'altezza', () => {
        const y = new Yard();
        assert(y.addContainer(new Container('A1'), 'BLOCK_A', 1, 1), 'primo add fallito');
        assert(y.addContainer(new Container('A2'), 'BLOCK_A', 1, 1), 'secondo add fallito');
        equal(y.getStackHeight('BLOCK_A', 1, 1), 2, 'altezza stack');
    });

    it('tiene separate le zone che condividono bay/row', () => {
        const y = new Yard();
        y.addContainer(new Container('A1'), 'BLOCK_A', 1, 1);
        y.addContainer(new Container('B1'), 'BLOCK_B', 1, 1);
        equal(y.getStackHeight('BLOCK_A', 1, 1), 1, 'BLOCK_A non isolato');
        equal(y.getStackHeight('BLOCK_B', 1, 1), 1, 'BLOCK_B non isolato');
    });

    it('rifiuta lo stack oltre maxTiers', () => {
        const y = new Yard();
        for (let i = 0; i < y.maxTiers; i++) {
            assert(y.addContainer(new Container(`C${i}`), 'BLOCK_A', 1, 1), `add ${i} fallito`);
        }
        equal(y.addContainer(new Container('OVER'), 'BLOCK_A', 1, 1), false, 'ha accettato oltre il limite');
        equal(y.getStackHeight('BLOCK_A', 1, 1), y.maxTiers, 'altezza oltre il massimo');
    });

    it('rimuove in LIFO', () => {
        const y = new Yard();
        y.addContainer(new Container('BASSO'), 'BLOCK_A', 1, 1);
        y.addContainer(new Container('ALTO'), 'BLOCK_A', 1, 1);
        equal(y.removeContainer('BLOCK_A', 1, 1).id, 'ALTO', 'non ha tolto quello in cima');
        equal(y.removeContainer('BLOCK_A', 1, 1).id, 'BASSO');
        equal(y.removeContainer('BLOCK_A', 1, 1), null, 'stack vuoto deve dare null');
    });
});

describe('Yard — digging penalty', () => {
    it('conta i container sopra a quello cercato', () => {
        const y = new Yard();
        ['T0', 'T1', 'T2'].forEach(id => y.addContainer(new Container(id), 'BLOCK_A', 2, 3));
        const found = y.getContainersInZone('BLOCK_A');

        // penalty = quanti pezzi vanno spostati per estrarlo
        equal(found.find(c => c.id === 'T2').penalty, 0, 'quello in cima non ha penalty');
        equal(found.find(c => c.id === 'T1').penalty, 1);
        equal(found.find(c => c.id === 'T0').penalty, 2, 'quello in fondo ha la penalty massima');
    });

    it('riporta bay e row corretti', () => {
        const y = new Yard();
        y.addContainer(new Container('X'), 'BLOCK_A', 4, 2);
        const c = y.getContainersInZone('BLOCK_A')[0];
        equal(c.bay, 4, 'bay'); equal(c.row, 2, 'row');
    });
});

describe('Yard — ricerca e spostamento', () => {
    it('trova un container per id, senza distinzione di maiuscole', () => {
        const y = new Yard();
        y.addContainer(new Container('MSCU123'), 'AREA_FRIGO', 2, 3);
        const hit = y.findContainer('mscu123');
        assert(hit, 'non trovato');
        equal(hit.zoneId, 'AREA_FRIGO'); equal(hit.bay, 2); equal(hit.row, 3);
    });

    it('restituisce null per un id inesistente', () => {
        equal(new Yard().findContainer('NESSUNO'), null);
    });

    it('sposta fra zone e ripulisce lo stack vuoto', () => {
        const y = new Yard();
        y.addContainer(new Container('M1'), 'BLOCK_A', 1, 1);
        assert(y.moveContainer('BLOCK_A', 1, 1, 'BLOCK_B', 2, 2), 'move fallito');
        equal(y.getStackHeight('BLOCK_A', 1, 1), 0, 'origine non svuotata');
        equal(y.getStackHeight('BLOCK_B', 2, 2), 1, 'destinazione non riempita');
        equal(y.findContainer('M1').zoneId, 'BLOCK_B', 'posizione non aggiornata');
    });

    it('non sposta da uno stack vuoto', () => {
        equal(new Yard().moveContainer('BLOCK_A', 9, 9, 'BLOCK_B', 1, 1), false);
    });

    it('non sposta dentro uno stack pieno', () => {
        const y = new Yard();
        y.addContainer(new Container('SRC'), 'BLOCK_A', 1, 1);
        for (let i = 0; i < y.maxTiers; i++) y.addContainer(new Container(`F${i}`), 'BLOCK_B', 1, 1);
        equal(y.moveContainer('BLOCK_A', 1, 1, 'BLOCK_B', 1, 1), false, 'ha accettato una destinazione piena');
    });
});

describe('Container', () => {
    it('usa Standard come tipo di default', () => {
        equal(new Container('D1').type, ContainerType.STANDARD);
    });
    it('conserva il tipo richiesto', () => {
        equal(new Container('R1', ContainerType.REEFER).type, 'Reefer');
    });
});
