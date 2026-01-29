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

    showTruck(truck) {
        this.isVisible = true;
        this.element.style.display = 'flex';
        this.element.style.zIndex = "9999";

        // Update Title
        const title = this.element.querySelector('#floating-title');
        title.textContent = `Vehicle Inspector`;

        const body = this.element.querySelector('#floating-body');

        // Status Color
        const statusColor = truck.status === 'Servicing' ? '#e3b341' : '#3fb950';

        let content = `
            <div style="padding: 10px;">
                <div style="font-size: 1.1rem; font-weight: bold; margin-bottom: 5px; color: white;">
                    ${truck.id} <span style="font-size: 0.8rem; color: #8b949e;">(${truck.plate})</span>
                </div>
                
                <div style="margin-bottom: 10px; border-bottom: 1px solid #30363d; padding-bottom: 10px;">
                     <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                        <span style="color: #8b949e;">Status:</span>
                        <span style="color: ${statusColor}; font-weight: bold;">${truck.status}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: #8b949e;">Mission:</span>
                        <span style="color: white;">${truck.missionType}</span>
                    </div>
                </div>

                <div style="font-size: 0.9rem;">
        `;

        if (truck.missionType === 'DROP_EXPORT') {
            if (truck.containerId) {
                content += `
                    <div style="color: #8b949e;">Carrying Export:</div>
                    <div style="font-family: monospace; background: #21262d; padding: 4px; border-radius: 4px; margin-top: 4px; border: 1px solid #30363d;">
                        ${truck.containerId}
                    </div>
                 `;
            } else {
                content += `<div style="color: #8b949e; font-style: italic;">Empty (Delivered)</div>`;
            }
        } else {
            // IMPORT
            if (truck.containerId) {
                content += `
                    <div style="color: #8b949e;">Carrying Import:</div>
                    <div style="font-family: monospace; background: #21262d; padding: 4px; border-radius: 4px; margin-top: 4px; border: 1px solid #30363d;">
                        ${truck.containerId}
                    </div>
                 `;
            } else {
                content += `
                    <div style="color: #8b949e;">Waiting for:</div>
                    <div style="font-family: monospace; background: #21262d; padding: 4px; border-radius: 4px; margin-top: 4px; border: 1px dashed #8b949e; color: #e3b341;">
                        ${truck.targetContainerId || 'Assignment...'}
                    </div>
                 `;
            }
        }

        content += `</div></div>`;
        body.innerHTML = content;
    }

    showVehicle(vehicle, job) {
        this.isVisible = true;
        this.element.style.display = 'flex';
        this.element.style.zIndex = "9999";

        // Update Title
        const title = this.element.querySelector('#floating-title');
        title.textContent = `Fleet Inspector`;

        const body = this.element.querySelector('#floating-body');

        let content = `
            <div style="padding: 10px;">
                <div style="font-size: 1.1rem; font-weight: bold; margin-bottom: 5px; color: white;">
                    ${vehicle.id} <span style="font-size: 0.8rem; color: #8b949e;">(${vehicle.type})</span>
                </div>
                
                 <div style="margin-bottom: 8px;">
                    <span style="background: ${vehicle.status === 'Idle' ? '#30363d' : '#e3b341'}; 
                                 color: ${vehicle.status === 'Idle' ? '#8b949e' : 'black'}; 
                                 padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 0.8rem;">
                        ${vehicle.status}
                    </span>
                </div>
        `;

        if (job) {
            content += `
                <div style="border-top: 1px solid #30363d; padding-top: 8px; margin-top: 8px;">
                     <div style="color: white; font-weight: bold; font-size: 0.9rem; margin-bottom: 4px;">Current Job: ${job.type}</div>
                     <div style="color: #8b949e; font-size: 0.8rem;">ID: ${job.id}</div>
                     
                     <div style="display: grid; grid-template-columns: 1fr 20px 1fr; margin-top: 8px; align-items: center; text-align: center;">
                        <div style="background: #21262d; padding: 4px; border-radius: 4px; color: #8b949e; font-size: 0.8rem;">
                            ${job.sourceZone}
                        </div>
                        <div style="color: #8b949e;">➜</div>
                        <div style="background: #21262d; padding: 4px; border-radius: 4px; color: white; border: 1px solid #30363d; font-size: 0.8rem;">
                            ${job.targetZone}
                        </div>
                     </div>

                     <div style="margin-top: 8px;">
                        <span style="color: #8b949e; font-size: 0.8rem;">Container:</span> <span style="font-family: monospace;">${job.containerId || 'N/A'}</span>
                     </div>
                </div>
             `;
        } else {
            content += `<div style="color: #8b949e; font-style: italic; margin-top: 10px;">No Active Jobs</div>`;
        }

        content += `</div>`;
        body.innerHTML = content;
    }

    _getColorForType(type) {
        switch (type) {
            case 'Reefer': return '#58a6ff'; // Use a visible blue for text
            case 'IMO': return '#da3633';
            default: return '#c9d1d9';
        }
    }
}
