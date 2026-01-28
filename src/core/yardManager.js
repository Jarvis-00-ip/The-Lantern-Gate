/**
 * The Lantern Gate - Yard Manager Core
 * Gestione dello yard e dei container.
 */

// Tipi di container supportati
export const ContainerType = {
    STANDARD: 'Standard',
    REEFER: 'Reefer',
    IMO: 'IMO' // Merci pericolose
};

export class Container {
    /**
     * @param {string} id - Identificativo univoco del container (es. "GEN123456")
     * @param {string} type - Tipo di container (vedi ContainerType)
     * @param {number} weight - Peso in tonnellate
     * @param {string} destination - Destinazione finale
     */
    constructor(id, type = ContainerType.STANDARD, weight = 10, destination = 'Unset') {
        this.id = id;
        this.type = type;
        this.weight = weight;
        this.destination = destination;
    }
}

export class Yard {
    constructor() {
        // La struttura dello yard è una mappa di Bay -> Row -> Tier
        // Per semplicità nell'MVP, useremo una mappa piatta con chiave "Bay-Row" che contiene un array (stack) rappresentante i Tier
        this.stacks = new Map();
        this.maxTiers = 5; // Altezza massima di impilamento
    }

    /**
     * Genera una chiave univoca per lo slot a terra (Bay + Row)
     * @param {number} bay 
     * @param {number} row 
     * @returns {string} Key
     */
    _getStackKey(bay, row) {
        return `${bay}-${row}`;
    }

    /**
     * Aggiunge un container in una specifica posizione.
     * @param {Container} container 
     * @param {number} bay 
     * @param {number} row 
     * @returns {boolean} Successo dell'operazione
     */
    addContainer(container, bay, row) {
        const key = this._getStackKey(bay, row);

        if (!this.stacks.has(key)) {
            this.stacks.set(key, []);
        }

        const stack = this.stacks.get(key);

        if (stack.length >= this.maxTiers) {
            console.error(`Stack full at Bay ${bay}, Row ${row}`);
            return false;
        }

        stack.push(container);
        return true;
    }

    /**
     * Rimuove il container in cima alla pila (LIFO).
     * @param {number} bay 
     * @param {number} row 
     * @returns {Container|null} Il container rimosso o null se stack vuoto
     */
    removeContainer(bay, row) {
        const key = this._getStackKey(bay, row);
        const stack = this.stacks.get(key);

        if (!stack || stack.length === 0) {
            return null;
        }

        return stack.pop();
    }



    /**
     * Restituisce l'altezza dello stack in una data posizione.
     * @param {number} bay 
     * @param {number} row 
     * @returns {number} Numero di container
     */
    getStackHeight(bay, row) {
        const key = this._getStackKey(bay, row);
        const stack = this.stacks.get(key);
        return stack ? stack.length : 0;
    }

    /**
     * Calcola la "Digging Penalty": quanti container devono essere spostati per prendere il target.
     * @param {number} bay 
     * @param {number} row 
     * @param {number} targetTier - Il tier (0-indexed) dove si trova il container target (0 è il ground)
     * @returns {number} Numero di movimenti extra (digs)
     */
    calculateDiggingPenalty(bay, row, targetTier) {
        const key = this._getStackKey(bay, row);
        const stack = this.stacks.get(key);

        if (!stack) {
            return 0; // Stack vuoto o inesistente
        }

        // Il container target esiste?
        if (targetTier < 0 || targetTier >= stack.length) {
            // Potremmo lanciare errore, ma per ora ritorniamo 0 o -1 per indicare "non trovato" logicamente
            return 0;
        }

        // I container sopra il target sono quelli da "scavare"
        // Esempio: Stack size 5. Target a tier 1. 
        // Indici: 0, 1 (target), 2, 3, 4.
        // Container sopra: 2, 3, 4 -> Totale 3.
        // Formula: (stack.length - 1) - targetTier

        return (stack.length - 1) - targetTier;
    }

    /**
     * Helper per ottenere un container (utile per test)
     */
    getContainer(bay, row, tier) {
        const key = this._getStackKey(bay, row);
        const stack = this.stacks.get(key);
        if (stack && stack[tier]) {
            return stack[tier];
        }
        return null;
    }
    /**
     * Sposta un container da uno stack all'altro.
     * @param {number} fromBay 
     * @param {number} fromRow 
     * @param {number} toBay 
     * @param {number} toRow 
     * @returns {boolean} Successo
     */
    moveContainer(fromBay, fromRow, toBay, toRow) {
        const sourceKey = this._getStackKey(fromBay, fromRow);
        const destKey = this._getStackKey(toBay, toRow);

        // Controllo esistenza stack sorgente
        const sourceStack = this.stacks.get(sourceKey);
        if (!sourceStack || sourceStack.length === 0) {
            console.error(`Move Failed: Source stack empty at ${fromBay}-${fromRow}`);
            return false;
        }

        // Controllo capacità stack destinazione
        // Nota: se la chiave non esiste, lo stack è vuoto (len 0), quindi ok.
        let destStack = this.stacks.get(destKey);
        if (destStack && destStack.length >= this.maxTiers) {
            console.error(`Move Failed: Destination stack full at ${toBay}-${toRow}`);
            return false;
        }

        // Recupera container
        const container = sourceStack.pop();

        // Aggiungi a destinazione
        if (!destStack) {
            destStack = [];
            this.stacks.set(destKey, destStack);
        }
        destStack.push(container);

        // Pulizia se stack sorgente diventa vuoto (opzionale, ma mantiene la map pulita)
        if (sourceStack.length === 0) {
            this.stacks.delete(sourceKey);
        }

        return true;
    }

    /**
     * Cerca un container per ID.
     * @param {string} id 
     * @returns {Object|null} { bay, row, tier, container } oppure null
     */
    findContainer(id) {
        if (!id) return null;
        const searchId = id.toUpperCase();

        for (const [key, stack] of this.stacks.entries()) {
            for (let i = 0; i < stack.length; i++) {
                if (stack[i].id.toUpperCase() === searchId) {
                    const [bay, row] = key.split('-').map(Number);
                    return {
                        bay,
                        row,
                        tier: i, // 0-indexed da terra
                        container: stack[i]
                    };
                }
            }
        }
        return null;
    }
}
