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
        this.element.style.width = '420px';
        this.element.style.zIndex = '10000'; // Top priority
        this.activeTab = 'Ralla'; // Default tab

        this.element.innerHTML = `
            <div class="floating-header" style="background: #2f363d; display:flex; flex-direction:column; gap:5px;">
                <div style="display:flex; justify-content:space-between; width:100%;">
                    <span>🚜 Depot Management</span>
                    <button class="close-btn" id="depot-close">×</button>
                </div>
                <div style="display:flex; gap:10px; margin-top:5px; border-bottom:1px solid rgba(255,255,255,0.1);">
                    <div class="tab-btn active" data-tab="Ralla">Ralle (Tractors)</div>
                    <div class="tab-btn" data-tab="Reach Stacker">Semoventi (RS)</div>
                </div>
            </div>
            
            <div class="floating-toolbar" style="padding:10px; border-bottom:1px solid #30363d; display:flex; justify-content:space-between; align-items:center;">
                <span id="vehicle-count" style="font-size:0.8rem; color:#8b949e;"></span>
                <button id="btn-deploy-all" style="font-size:0.75rem; background:#238636; color:white; border:1px solid rgba(240,246,252,0.1); padding:4px 8px; border-radius:4px; cursor:pointer;">
                    Deploy Visible
                </button>
            </div>

            <div class="floating-content" id="depot-body" style="height:400px; overflow-y:auto;">
                <!-- Vehicle List -->
            </div>
            <style>
                .tab-btn {
                    padding: 5px 10px;
                    font-size: 0.8rem;
                    cursor: pointer;
                    color: #8b949e;
                    border-bottom: 2px solid transparent;
                }
                .tab-btn.active {
                    color: white;
                    border-bottom: 2px solid #58a6ff;
                    font-weight: bold;
                }
                .tab-btn:hover { color: #c9d1d9; }
            </style>
        `;

        this.container.appendChild(this.element);

        // Close Handler
        this.element.querySelector('#depot-close').addEventListener('click', () => this.hide());

        // Deploy All Handler (Current Tab)
        this.element.querySelector('#btn-deploy-all').addEventListener('click', () => this.handleDeployAll());

        // Tab Handlers
        this.element.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.element.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.activeTab = e.target.dataset.tab;
                this.renderList();
            });
        });
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
        const countSpan = this.element.querySelector('#vehicle-count');

        // Filter Vehicles by Tab
        const allVehicles = this.fleet.getVehicles();
        const vehicles = allVehicles.filter(v => v.type === this.activeTab);

        countSpan.textContent = `Showing ${vehicles.length} units`;

        // Filter: Only allow deployment to Operational Zones + Depot
        const allowedTypes = ['LOADING', 'QUAY', 'GATE'];
        const zones = this.geoManager.getZones()
            .filter(z => allowedTypes.includes(z.type) && z.type !== 'DEPOT')
            .map(z => z.id);

        let html = `
            <div class="vehicle-list" style="display:flex; flex-direction:column; gap:8px;">
        `;

        vehicles.forEach(v => {
            const statusColor = v.status === 'Active' ? '#3fb950' : '#8b949e';

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
        console.log(`Batch Deploy Initiated for tab: ${this.activeTab}`);
        const selects = this.element.querySelectorAll('.zone-selector');
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
            console.log(`Batch Deploy: Scheduled ${scheduledCount} vehicles.`);
        } else {
            console.log("Batch Deploy: No changes detected.");
        }
    }
}
