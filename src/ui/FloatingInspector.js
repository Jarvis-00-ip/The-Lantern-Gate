export class FloatingInspector {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.isVisible = false;
        this.isDragging = false;
        this.currentX = 50;
        this.currentY = 50;

        this.dragOffset = { x: 0, y: 0 };

        this.init();
    }

    init() {
        // Create DOM Structure
        this.element = document.createElement('div');
        this.element.className = 'floating-menu';
        this.element.innerHTML = `
            <div class="floating-header">
                <span id="floating-title">Inspeciton</span>
                <div class="floating-controls">
                    <button class="close-btn" id="floating-close">×</button>
                </div>
            </div>
            <div class="floating-content" id="floating-body">
                <!-- Content goes here -->
            </div>
        `;

        this.container.appendChild(this.element);

        // Bind Events
        const header = this.element.querySelector('.floating-header');
        const closeBtn = this.element.querySelector('#floating-close');

        // Dragging
        header.addEventListener('mousedown', (e) => {
            this.isDragging = true;
            this.dragOffset.x = e.clientX - this.element.offsetLeft;
            this.dragOffset.y = e.clientY - this.element.offsetTop;
            header.style.cursor = 'grabbing';
        });

        document.addEventListener('mousemove', (e) => {
            if (this.isDragging) {
                this.currentX = e.clientX - this.dragOffset.x;
                this.currentY = e.clientY - this.dragOffset.y;
                this.updatePosition();
            }
        });

        document.addEventListener('mouseup', () => {
            this.isDragging = false;
            header.style.cursor = 'move';
        });

        // Close
        closeBtn.addEventListener('click', () => {
            this.hide();
        });
    }

    updatePosition() {
        this.element.style.left = `${this.currentX}px`;
        this.element.style.top = `${this.currentY}px`;
    }

    show(bay, row, stackData) {
        this.isVisible = true;
        this.element.style.display = 'flex';

        // Update Title
        const title = this.element.querySelector('#floating-title');
        title.textContent = `Bay ${bay} - Row ${row}`;

        // Update Content
        const body = this.element.querySelector('#floating-body');

        if (!stackData || stackData.length === 0) {
            body.innerHTML = `<div style="color: #8b949e; font-style: italic; padding: 10px;">Empty Stack</div>`;
            return;
        }

        let html = '';
        [...stackData].reverse().forEach((c, index) => {
            const actualTier = stackData.length - 1 - index;
            html += `
                <div class="info-row" style="padding: 6px; background: #21262d; border-radius: 4px; margin-bottom: 4px; border: 1px solid #30363d;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-weight:bold; color: ${this._getColorForType(c.type)}">${c.id}</span>
                        <span style="font-size:0.75rem; background:#30363d; padding:2px 6px; border-radius:4px;">T${actualTier}</span>
                    </div>
                    <div style="font-size: 0.8rem; color: #8b949e; margin-top:2px;">
                        ${c.type} <span style="float:right">Digs: ${index}</span>
                    </div>
                </div>
            `;
        });
        body.innerHTML = html;
    }

    showZone(zoneId, containers) {
        console.log(`[Inspector] ShowZone called for ${zoneId}`, containers);
        this.isVisible = true;
        this.element.style.display = 'flex';
        this.element.style.zIndex = "9999"; // Force inline z-index

        // Update Title
        const title = this.element.querySelector('#floating-title');
        title.textContent = `Zone Inspector: ${zoneId}`;

        const body = this.element.querySelector('#floating-body');

        if (!containers || containers.length === 0) {
            body.innerHTML = `<div style="color: #8b949e; font-style: italic; padding: 10px;">Zone Empty</div>`;
            return;
        }

        let html = `
            <div style="max-height: 300px; overflow-y: auto;">
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 4px; padding-bottom: 8px; border-bottom: 1px solid #30363d; font-weight: bold; color: #8b949e; font-size: 0.8rem;">
                    <span>ID</span>
                    <span>Typ.</span>
                    <span>Loc</span>
                    <span>Digs</span>
                </div>
        `;

        containers.forEach(c => {
            // Color code penalty
            const penColor = c.penalty > 0 ? (c.penalty > 2 ? '#da3633' : '#e3b341') : '#3fb950';

            html += `
                <div style="display: grid; grid-template-columns: 1fr 0.5fr 1fr 0.5fr; gap: 4px; padding: 4px 0; border-bottom: 1px solid #21262d; font-size: 0.85rem; align-items: center;">
                    <span style="font-weight:bold; color: ${this._getColorForType(c.type)}">${c.id}</span>
                    <span style="color: #8b949e;">${c.type.substring(0, 3)}</span>
                    <span style="font-family: monospace; background: #21262d; padding: 2px 4px; border-radius: 4px; font-size: 0.75rem;">${c.bay}-${c.row}-${c.tier + 1}</span>
                    <span style="font-weight:bold; color: ${penColor}; text-align:center;">${c.penalty}</span>
                </div>
            `;
        });

        html += `</div>
            <div style="font-size: 0.75rem; color: #8b949e; margin-top: 8px; border-top: 1px solid #30363d; padding-top: 4px;">
                Total Containers: ${containers.length}
            </div>
        `;

        body.innerHTML = html;
    }

    hide() {
        this.isVisible = false;
        this.element.style.display = 'none';
        // Notify callback if needed (e.g. clear selection)
        if (this.onClose) this.onClose();
    }

    setOnClose(callback) {
        this.onClose = callback;
    }

    _getColorForType(type) {
        switch (type) {
            case 'Reefer': return '#58a6ff'; // Use a visible blue for text
            case 'IMO': return '#da3633';
            default: return '#c9d1d9';
        }
    }
}
