export class MainMenu {
    constructor(panels) {
        this.panels = panels; // Object: { 'control': el, 'fleet': instance, 'tos': instance }
        this.isVisible = false;
        this.init();
    }

    init() {
        // 1. Create Burger Button
        this.btn = document.createElement('div');
        this.btn.className = 'main-menu-btn';
        this.btn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/></svg>`;
        this.btn.style.cssText = `
            position: absolute;
            top: 20px;
            left: 20px;
            width: 40px;
            height: 40px;
            background: #2f363d;
            border-radius: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            z-index: 10001;
            box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        `;
        document.body.appendChild(this.btn);

        // 2. Create Menu Dropdown
        this.menu = document.createElement('div');
        this.menu.className = 'main-menu-dropdown';
        this.menu.style.cssText = `
            position: absolute;
            top: 70px;
            left: 20px;
            width: 200px;
            background: #21262d;
            border: 1px solid #30363d;
            border-radius: 6px;
            display: none;
            flex-direction: column;
            z-index: 10001;
            box-shadow: 0 4px 12px rgba(0,0,0,0.5);
            padding: 5px;
        `;

        const items = [
            { id: 'control', label: '🛠️ Yard Control', action: () => this.togglePanel('control') },
            { id: 'fleet', label: '🚜 Fleet & Depot', action: () => this.togglePanel('fleet') },
            { id: 'tos', label: '🧠 TOS Ops', action: () => this.togglePanel('tos') },
            { id: 'map', label: '🌍 Map Options', action: () => this.togglePanel('map') },
            { isDivider: true },
            { id: 'sim_trk_exp', label: '🎮 Spawn Truck (Export)', action: () => window.truckManager && window.truckManager.spawnTruck('DROP_EXPORT') },
            { id: 'sim_trk_imp', label: '🎮 Spawn Truck (Import)', action: () => window.truckManager && window.truckManager.spawnTruck('PICK_IMPORT') }
        ];

        items.forEach(item => {
            if (item.isDivider) {
                const div = document.createElement('div');
                div.style.cssText = `height: 1px; background: #30363d; margin: 5px 0;`;
                this.menu.appendChild(div);
                return;
            }

            const el = document.createElement('div');
            el.textContent = item.label;
            el.style.cssText = `
                padding: 10px;
                color: #c9d1d9;
                cursor: pointer;
                border-radius: 4px;
                font-family: 'Segoe UI', sans-serif;
                font-size: 14px;
            `;
            el.onmouseover = () => el.style.background = '#30363d';
            el.onmouseout = () => el.style.background = 'transparent';
            el.onclick = () => {
                item.action();
                this.hide();
            };
            this.menu.appendChild(el);
        });

        document.body.appendChild(this.menu);

        // Listeners
        this.btn.onclick = (e) => {
            e.stopPropagation();
            this.toggleMenu();
        };

        // Close on click outside
        document.addEventListener('click', (e) => {
            if (this.isVisible && !this.menu.contains(e.target) && e.target !== this.btn) {
                this.hide();
            }
        });
    }

    toggleMenu() {
        this.isVisible = !this.isVisible;
        this.menu.style.display = this.isVisible ? 'flex' : 'none';
        this.btn.style.background = this.isVisible ? '#58a6ff' : '#2f363d';
    }

    hide() {
        this.isVisible = false;
        this.menu.style.display = 'none';
        this.btn.style.background = '#2f363d';
    }

    togglePanel(id) {
        console.log("Toggle Panel:", id);

        // Hide All first? Or just toggle specific?
        // Let's toggle specific.

        switch (id) {
            case 'control':
                const cp = document.getElementById('control-panel');
                if (cp) cp.style.display = cp.style.display === 'none' ? 'block' : 'none';
                break;
            case 'fleet':
                if (this.panels.fleet) {
                    this.panels.fleet.isVisible ? this.panels.fleet.hide() : this.panels.fleet.show();
                }
                break;
            case 'tos':
                if (this.panels.tos) {
                    this.panels.tos.isVisible ? this.panels.tos.hide() : this.panels.tos.show();
                }
                break;
            case 'map':
                // Focus on floating Toolbar if needed, or open a map settings modal
                alert("Map Options available in top-right toolbar.");
                break;
        }
    }
}
