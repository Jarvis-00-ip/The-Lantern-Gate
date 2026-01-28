export class DepotUI {
    constructor(containerId, fleetManager, geoManager, onUpdate) {
        this.container = document.getElementById(containerId);
        this.fleet = fleetManager;
        this.geoManager = geoManager;
        this.onUpdate = onUpdate; // Callback to trigger map re-render
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
                <div style="display:flex; gap:5px; align-items:center;">
                    <button id="btn-deploy-all" style="font-size:0.7rem; background:#238636; color:white; border:1px solid rgba(240,246,252,0.1); padding:2px 6px; border-radius:4px; cursor:pointer; margin-right:10px;">Deploy All</button>
                    <button class="close-btn" id="depot-close">×</button>
                </div>
            </div>
            <div class="floating-content" id="depot-body">
                <!-- Vehicle List -->
            </div>
        `;

        this.container.appendChild(this.element);

        // Close Handler
        this.element.querySelector('#depot-close').addEventListener('click', () => this.hide());

        // Deploy All Handler
        this.element.querySelector('#btn-deploy-all').addEventListener('click', () => this.handleDeployAll());
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

        // Filter: Only allow deployment to Operational Zones
        // types: LOADING, QUAY, GATE
        const allowedTypes = ['LOADING', 'QUAY', 'GATE'];
        const zones = this.geoManager.getZones()
            .filter(z => allowedTypes.includes(z.type) && z.type !== 'DEPOT')
            .map(z => z.id);

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

                    <div style="display:grid; grid-template-columns: 1fr auto auto; gap:5px; align-items:center;">
                        <select id="sel-zone-${v.id}" class="zone-selector" data-id="${v.id}" style="font-size:0.8rem; padding:4px;">
                            <option value="DEPOT_RALLE">Depot (Recall)</option>
                            ${zoneOptions}
                        </select>
                         <span id="eta-${v.id}" style="font-size:0.75rem; color:#8b949e; min-width:50px; text-align:right;"></span>
                        <button class="btn-deploy" data-id="${v.id}" 
                            style="font-size:0.75rem; padding:4px 8px; cursor:pointer; background:var(--accent-color); color:white; border:none; border-radius:4px;">
                            ${v.status === 'Idle' ? 'Deploy' : 'Update'}
                        </button>
                    </div>
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

        // Bind Select Implementation for ETA
        const selects = body.querySelectorAll('.zone-selector');
        selects.forEach(sel => {
            sel.addEventListener('change', (e) => {
                const id = e.target.dataset.id;
                const target = e.target.value;
                this.updateETA(id, target);
            });
        });
    }

    updateETA(vehicleId, targetZone) {
        const etaSpan = document.getElementById(`eta-${vehicleId}`);
        if (!etaSpan) return;

        if (targetZone === 'DEPOT_RALLE') {
            etaSpan.textContent = '';
            return;
        }

        const seconds = this.fleet.calculateTravelTime(vehicleId, targetZone, this.geoManager);
        if (seconds > 0) {
            etaSpan.textContent = `~${seconds}s`;
            etaSpan.style.color = '#e3b341';
        } else {
            etaSpan.textContent = '';
        }
    }

    handleDeploy(id, targetZone) {
        if (targetZone === 'DEPOT_RALLE') {
            this.fleet.recallVehicle(id);
        } else {
            // Updated to pass GeoManager
            this.fleet.deployVehicle(id, targetZone, this.geoManager);
        }
        this.renderList(); // Refresh
        console.log(`Vehicle ${id} updated -> ${targetZone}`);

        // Trigger external update (Map Render)
        if (this.onUpdate) this.onUpdate();
    }

    handleDeployAll() {
        console.log("Batch Deploy Initiated...");
        const selects = this.element.querySelectorAll('.zone-selector');
        let updateCount = 0;
        let scheduledCount = 0;

        selects.forEach(sel => {
            const id = sel.dataset.id;
            const targetZone = sel.value;
            const vehicle = this.fleet.getVehicles().find(v => v.id === id);

            let actionNeeded = false;
            let isRecall = false;

            if (targetZone === 'DEPOT_RALLE') {
                if (vehicle.status !== 'Idle') {
                    isRecall = true;
                    actionNeeded = true;
                }
            } else {
                if (vehicle.currentZone !== targetZone || vehicle.status === 'Idle') {
                    actionNeeded = true;
                }
            }

            if (actionNeeded) {
                // Random Delay: 1s to 6s
                const delayMs = Math.floor(Math.random() * 5000) + 1000;

                console.log(`Scheduling ${id} in ${(delayMs / 1000).toFixed(1)}s`);

                setTimeout(() => {
                    if (isRecall) this.fleet.recallVehicle(id);
                    else this.fleet.deployVehicle(id, targetZone, this.geoManager);

                    // Trigger update after THIS specific move starts
                    if (this.onUpdate) this.onUpdate();
                }, delayMs);

                scheduledCount++;
            }
        });

        if (scheduledCount > 0) {
            console.log(`Batch Deploy: Scheduled ${scheduledCount} vehicles with delays.`);
            // Note: We don't renderList immediately because status hasn't changed yet.
            // But we might want to give visual feedback?
            // For now, let the timeout triggers handle the updates.
        } else {
            console.log("Batch Deploy: No changes detected.");
        }
    }
}
