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
     * Genera una chiave univoca per lo slot a terra (Zone + Bay + Row)
     * @param {string} zoneId 
     * @param {number} bay 
     * @param {number} row 
     * @returns {string} Key
     */
    _getStackKey(zoneId, bay, row) {
        return `${zoneId}:${bay}-${row}`;
    }

    /**
     * Aggiunge un container in una specifica posizione.
     * @param {Container} container 
     * @param {string} zoneId
     * @param {number} bay 
     * @param {number} row 
     * @returns {boolean} Successo dell'operazione
     */
    addContainer(container, zoneId, bay, row) {
        const key = this._getStackKey(zoneId, bay, row);

        if (!this.stacks.has(key)) {
            this.stacks.set(key, []);
        }

        const stack = this.stacks.get(key);

        if (stack.length >= this.maxTiers) {
            console.error(`Stack full at ${zoneId} Bay ${bay}, Row ${row}`);
            return false;
        }

        stack.push(container);
        return true;
    }

    /**
     * Rimuove il container in cima alla pila (LIFO).
     * @param {string} zoneId
     * @param {number} bay 
     * @param {number} row 
     * @returns {Container|null} Il container rimosso o null se stack vuoto
     */
    removeContainer(zoneId, bay, row) {
        const key = this._getStackKey(zoneId, bay, row);
        const stack = this.stacks.get(key);

        if (!stack || stack.length === 0) {
            return null;
        }

        return stack.pop();
    }

    /**
     * Restituisce l'altezza dello stack in una data posizione.
     * @param {string} zoneId
     * @param {number} bay 
     * @param {number} row 
     * @returns {number} Numero di container
     */
    getStackHeight(zoneId, bay, row) {
        const key = this._getStackKey(zoneId, bay, row);
        const stack = this.stacks.get(key);
        return stack ? stack.length : 0;
    }

    /**
     * Helper per ottenere un container (utile per test)
     */
    getContainer(zoneId, bay, row, tier) {
        const key = this._getStackKey(zoneId, bay, row);
        const stack = this.stacks.get(key);
        if (stack && stack[tier]) {
            return stack[tier];
        }
        return null;
    }

    /**
     * Sposta un container da uno stack all'altro.
     * @param {string} fromZone
     * @param {number} fromBay 
     * @param {number} fromRow 
     * @param {string} toZone
     * @param {number} toBay 
     * @param {number} toRow 
     * @returns {boolean} Successo
     */
    moveContainer(fromZone, fromBay, fromRow, toZone, toBay, toRow) {
        const sourceKey = this._getStackKey(fromZone, fromBay, fromRow);
        const destKey = this._getStackKey(toZone, toBay, toRow);

        // Controllo esistenza stack sorgente
        const sourceStack = this.stacks.get(sourceKey);
        if (!sourceStack || sourceStack.length === 0) {
            console.error(`Move Failed: Source stack empty`);
            return false;
        }

        // Controllo capacità stack destinazione
        let destStack = this.stacks.get(destKey);
        if (destStack && destStack.length >= this.maxTiers) {
            console.error(`Move Failed: Destination stack full`);
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

        // Pulizia
        if (sourceStack.length === 0) {
            this.stacks.delete(sourceKey);
        }

        return true;
    }

    /**
     * Cerca un container per ID.
     * @param {string} id 
     * @returns {Object|null} { zoneId, bay, row, tier, container } oppure null
     */
    findContainer(id) {
        if (!id) return null;
        const searchId = id.toUpperCase();

        for (const [key, stack] of this.stacks.entries()) {
            for (let i = 0; i < stack.length; i++) {
                if (stack[i].id.toUpperCase() === searchId) {
                    const [zoneId, coords] = key.split(':');
                    const [bay, row] = coords.split('-').map(Number);
                    return {
                        zoneId,
                        bay,
                        row,
                        tier: i,
                        container: stack[i]
                    };
                }
            }
        }
        return null;
    }
    /**
     * Retrieves all containers within a specific zone.
     * @param {string} zoneId 
     * @returns {Array} List of container objects with location info
     */
    getContainersInZone(zoneId) {
        const results = [];
        const prefix = `${zoneId}:`;

        for (const [key, stack] of this.stacks.entries()) {
            if (key.startsWith(prefix)) {
                const [_, coords] = key.split(':');
                const [bay, row] = coords.split('-').map(Number);

                stack.forEach((container, index) => {
                    results.push({
                        ...container,
                        bay,
                        row,
                        tier: index
                    });
                });
            }
        }
        return results;
    }
}
