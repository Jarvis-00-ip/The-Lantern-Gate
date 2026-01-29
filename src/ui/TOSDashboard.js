export class TOSDashboard {
    constructor(vesselManager, jobManager) {
        this.vesselManager = vesselManager;
        this.jobManager = jobManager;
        this.isVisible = false;
        this.init();

        // Auto-refresh loop when visible
        setInterval(() => {
            if (this.isVisible) this.render();
        }, 1000);
    }

    init() {
        this.element = document.createElement('div');
        this.element.className = 'floating-menu tos-panel';
        this.element.style.cssText = `
            position: absolute;
            top: 100px;
            right: 100px; 
            width: 350px;
            max-height: 500px;
            background: #161b22; /* Darker Theme */
            border: 1px solid #30363d;
            border-radius: 6px;
            z-index: 9999;
            color: #c9d1d9;
            display: none;
            flex-direction: column;
            box-shadow: 0 8px 24px rgba(0,0,0,0.5);
        `;

        this.element.innerHTML = `
            <div class="floating-header" style="padding:10px; background:#21262d; border-bottom:1px solid #30363d; display:flex; justify-content:space-between; align-items:center;">
                <span style="font-weight:bold;">🧠 TOS Dashboard</span>
                <button class="close-btn" style="background:none; border:none; color:#8b949e; cursor:pointer; font-size:16px;">×</button>
            </div>
            <div id="tos-content" style="padding:10px; overflow-y:auto; flex:1;">
                <!-- Dynamic Content -->
            </div>
        `;

        document.body.appendChild(this.element);

        this.element.querySelector('.close-btn').addEventListener('click', () => this.hide());
    }

    show() {
        this.isVisible = true;
        this.element.style.display = 'flex';
        this.render();
    }

    hide() {
        this.isVisible = false;
        this.element.style.display = 'none';
    }

    render() {
        const content = this.element.querySelector('#tos-content');
        const vessel = this.vesselManager.activeVessel;
        const jobs = this.jobManager.jobs;
        const pending = jobs.filter(j => j.status === 'PENDING').length;
        const active = jobs.filter(j => j.status === 'ASSIGNED' || j.status === 'IN_PROGRESS').length;
        const completed = jobs.filter(j => j.status === 'COMPLETED').length;

        let vesselHtml = `<div style="text-align:center; padding:20px; color:#8b949e;">No Active Vessel</div>`;

        if (vessel) {
            const now = new Date();
            const timeLeft = Math.max(0, (vessel.etd - now) / 1000); // Seconds
            const hours = Math.floor(timeLeft / 3600);
            const minutes = Math.floor((timeLeft % 3600) / 60);

            // Time Color
            const timeColor = hours < 1 ? '#f85149' : '#3fb950';

            vesselHtml = `
                <div style="background:#0d1117; padding:10px; border-radius:6px; border:1px solid #30363d; margin-bottom:10px;">
                    <div style="font-size:1.1rem; font-weight:bold; color:white;">🚢 ${vessel.name}</div>
                    <div style="display:flex; justify-content:space-between; margin-top:5px; font-size:0.9rem;">
                        <span style="color:#8b949e;">ETD Deadline:</span>
                        <span style="color:${timeColor}; font-weight:bold;">-${hours}h ${minutes}m</span>
                    </div>
                     <div style="display:flex; justify-content:space-between; margin-top:2px; font-size:0.8rem;">
                        <span style="color:#8b949e;">Manifest:</span>
                        <span>Load: ${vessel.manifest.load.length} | Disch: ${vessel.manifest.discharge.length}</span>
                    </div>
                </div>
            `;
        }

        content.innerHTML = `
            ${vesselHtml}
            
            <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:5px; margin-bottom:10px;">
                <div style="background:#238636; padding:5px; border-radius:4px; text-align:center; color:white;">
                    <div style="font-size:1.2rem; font-weight:bold;">${completed}</div>
                    <div style="font-size:0.7rem;">Done</div>
                </div>
                <div style="background:#1f6feb; padding:5px; border-radius:4px; text-align:center; color:white;">
                    <div style="font-size:1.2rem; font-weight:bold;">${active}</div>
                    <div style="font-size:0.7rem;">Active</div>
                </div>
                 <div style="background:#d29922; padding:5px; border-radius:4px; text-align:center; color:white;">
                    <div style="font-size:1.2rem; font-weight:bold;">${pending}</div>
                    <div style="font-size:0.7rem;">Queue</div>
                </div>
            </div>

            <div style="font-size:0.85rem; color:#8b949e; border-bottom:1px solid #30363d; padding-bottom:5px; margin-bottom:5px;">Recent Activity</div>
            <div style="display:flex; flex-direction:column; gap:4px;">
                ${jobs.slice(-5).reverse().map(j => `
                    <div style="font-size:0.8rem; padding:4px; border-left:2px solid ${this.getStatusColor(j.status)}; background:rgba(255,255,255,0.03);">
                        <span style="color:white;">${j.type} ${j.containerId}</span>
                        <span style="color:#8b949e;"> -> ${j.assignedVehicleId || '...'}</span>
                    </div>
                `).join('')}
            </div>
        `;
    }

    getStatusColor(status) {
        if (status === 'COMPLETED') return '#238636';
        if (status === 'IN_PROGRESS') return '#1f6feb';
        return '#d29922';
    }
}
