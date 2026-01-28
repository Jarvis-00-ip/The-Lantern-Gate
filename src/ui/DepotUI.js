export class DepotUI {
    constructor(containerId, fleetManager, geoManager) {
        this.container = document.getElementById(containerId);
        this.fleet = fleetManager;
        this.geoManager = geoManager;
        this.isVisible = false;

        this.init();
    }

    init() {
        this.element = document.createElement('div');
        this.element.className = 'floating-menu depot-panel'; // reusing floating style
        this.element.style.width = '400px';
        this.element.style.zIndex = '10000'; // Top priority

        this.element.innerHTML = `
            <div class="floating-header" style="background: #2f363d;">
                <span>🚜 Depot Management</span>
                <button class="close-btn" id="depot-close">×</button>
            </div>
            <div class="floating-content" id="depot-body">
                <!-- Vehicle List -->
            </div>
        `;

        this.container.appendChild(this.element);

        // Close Handler
        this.element.querySelector('#depot-close').addEventListener('click', () => this.hide());
    }

    show() {
        this.isVisible = true;
        this.element.style.display = 'flex';
        this.element.style.top = '100px';
        this.element.style.left = '100px';
        this.renderList();
    }

    hide() {
        this.isVisible = false;
        this.element.style.display = 'none';
        if (this.onClose) this.onClose();
    }

    renderList() {
        const body = this.element.querySelector('#depot-body');
        const vehicles = this.fleet.getVehicles();
        const zones = this.geoManager.getZones().filter(z => z.type !== 'DEPOT').map(z => z.id);

        let html = `
            <div style="margin-bottom:10px; font-size:0.85rem; color:#8b949e;">
                Manage active fleet and assignments.
            </div>
            <div class="vehicle-list" style="display:flex; flex-direction:column; gap:8px;">
        `;

        vehicles.forEach(v => {
            const statusColor = v.status === 'Active' ? '#3fb950' : '#8b949e';
            const location = v.status === 'Active' ? v.currentZone : 'Depot';

            // Generate Zone Options
            const zoneOptions = zones.map(z =>
                `<option value="${z}" ${v.currentZone === z ? 'selected' : ''}>${z}</option>`
            ).join('');

            html += `
                <div class="vehicle-card" style="background:#0d1117; border:1px solid #30363d; padding:10px; border-radius:6px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <div>
                            <span style="font-weight:bold; color:#c9d1d9;">${v.id}</span>
                            <span style="font-size:0.75rem; color:#8b949e; margin-left:5px;">${v.type}</span>
                        </div>
                        <span style="font-size:0.75rem; padding:2px 6px; border-radius:10px; border:1px solid ${statusColor}; color:${statusColor}">
                            ${v.status}
                        </span>
                    </div>

                    <div style="display:grid; grid-template-columns: 1fr auto; gap:5px; align-items:center;">
                        <select id="sel-zone-${v.id}" style="font-size:0.8rem; padding:4px;">
                            <option value="DEPOT_RALLE">Depot (Recall)</option>
                            ${zoneOptions}
                        </select>
                        <button class="btn-deploy" data-id="${v.id}" 
                            style="font-size:0.75rem; padding:4px 8px; cursor:pointer; background:var(--accent-color); color:white; border:none; border-radius:4px;">
                            ${v.status === 'Idle' ? 'Deploy' : 'Update'}
                        </button>
                    </div>
                    ${v.assignedBlock ? `<div style="font-size:0.75rem; color:#e3b341; margin-top:4px;">Assigned: ${v.assignedBlock}</div>` : ''}
                </div>
            `;
        });

        html += `</div>`;
        body.innerHTML = html;

        // Bind Buttons
        const btns = body.querySelectorAll('.btn-deploy');
        btns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.dataset.id;
                const sel = document.getElementById(`sel-zone-${id}`);
                this.handleDeploy(id, sel.value);
            });
        });
    }

    handleDeploy(id, targetZone) {
        if (targetZone === 'DEPOT_RALLE') {
            this.fleet.recallVehicle(id);
        } else {
            this.fleet.deployVehicle(id, targetZone);
        }
        this.renderList(); // Refresh
        console.log(`Vehicle ${id} updated -> ${targetZone}`);
    }
}
