export class YardRenderer {
    constructor(yard, containerId) {
        this.yard = yard;
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error(`Container #${containerId} not found`);
        }
    }

    /**
     * Renders the grid based on configured yard dimensions.
     * @param {number} totalBays 
     * @param {number} totalRows 
     */
    render(totalBays = 5, totalRows = 4) {
        this.container.innerHTML = '';

        // Setup grid columns
        this.container.style.gridTemplateColumns = `repeat(${totalBays}, 1fr)`;

        for (let r = 1; r <= totalRows; r++) {
            for (let b = 1; b <= totalBays; b++) {
                const stackEl = this._createStackElement(b, r);
                this.container.appendChild(stackEl);
            }
        }
    }

    _createStackElement(bay, row) {
        const div = document.createElement('div');
        div.className = 'stack';
        div.dataset.bay = bay;
        div.dataset.row = row;
        div.title = `Bay ${bay}, Row ${row}`;

        // Get stack data from Yard
        // Note: We need a method in Yard to get stack by coords without side effects
        // Using internal knowledge or waiting for public API.
        // Assuming yard.stacks stores keys as "Bay-Row".

        const key = `${bay}-${row}`;
        const stackData = this.yard.stacks.get(key);

        if (stackData && stackData.length > 0) {
            const count = stackData.length;
            const topContainer = stackData[count - 1]; // Top container

            // Render container visual
            const contDiv = document.createElement('div');
            contDiv.className = `container-view type-${topContainer.type}`;
            contDiv.textContent = topContainer.id.substring(0, 4); // Show prefix
            div.appendChild(contDiv);

            // Render stack count badge
            const badge = document.createElement('span');
            badge.className = 'stack-count';
            badge.textContent = count;
            div.appendChild(badge);
        } else {

            div.textContent = `${bay}-${row}`;
        }

        // Add Click Event for Inspection
        div.addEventListener('click', () => {
            this.updateSelectionPanel(bay, row);
            if (this.onStackClick) {
                this.onStackClick(bay, row);
            }
        });

        return div;
    }

    /**
     * Set callback for stack clicks.
     * @param {function(number, number): void} callback 
     */
    setOnStackClick(callback) {
        this.onStackClick = callback;
    }

    /**
     * Updates the info panel with details for the specified stack.
     * Public so it can be called externally (e.g. after add/remove).
     */
    updateSelectionPanel(bay, row) {
        const key = `${bay}-${row}`;
        const stackData = this.yard.stacks.get(key);
        const infoPanel = document.getElementById('selected-info');
        if (!stackData || stackData.length === 0) {
            infoPanel.innerHTML = `
                <div class="info-row"><span class="label">Location:</span> Bay ${bay}, Row ${row}</div>
                <div class="info-row">Empty Slot</div>
            `;
            return;
        }

        let html = `<div class="info-row"><span class="label">Location:</span> Bay ${bay}, Row ${row}</div>
                    <div class="info-row"><span class="label">Height:</span> ${stackData.length} tiers</div>
                    <hr style="border-color: #30363d; opacity: 0.5;">`;

        // List containers from top to bottom
        [...stackData].reverse().forEach((c, index) => {
            const actualTier = stackData.length - 1 - index;
            html += `
                <div class="info-row" style="padding: 4px; background: #21262d; border-radius: 4px; margin-bottom: 4px;">
                    <div style="font-weight:bold; color: ${this._getColorForType(c.type)}">${c.id}</div>
                    <div style="font-size: 0.8rem; color: #8b949e;">Type: ${c.type} | Tier: ${actualTier} | Digs: ${index}</div>
                </div>
            `;
        });

        infoPanel.innerHTML = html;
    }

    _getColorForType(type) {
        switch (type) {
            case 'Reefer': return '#f0f6fc';
            case 'IMO': return '#da3633';
            default: return '#58a6ff';
        }
    }
}
