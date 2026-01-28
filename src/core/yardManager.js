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
}
