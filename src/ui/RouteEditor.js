import { TRUCK_LEGS } from '../core/TruckManager.js';

/**
 * Route Editor — lets an operator draw the path trucks actually take.
 *
 * One leg at a time: pick a leg, draw the line on the map, it is saved and used
 * from then on. Legs left undrawn keep using automatic routing, so this can be
 * applied only where the automatic result is wrong.
 */
export class RouteEditor {
    /**
     * @param {Object} deps
     * @param {RouteBook} deps.routeBook
     * @param {Object} deps.geoManager
     * @param {Object} deps.map - Leaflet map (for the Geoman draw tool)
     * @param {Function} deps.onChange - Called after any save/delete
     */
    constructor({ routeBook, geoManager, map, onChange }) {
        this.routeBook = routeBook;
        this.geoManager = geoManager;
        this.map = map;
        this.onChange = onChange || (() => { });
        this.isVisible = false;
        this.capturingLeg = null; // leg awaiting a drawing

        this._build();
    }

    _build() {
        this.element = document.createElement('div');
        this.element.className = 'floating-menu route-editor';
        this.element.style.cssText = `
            position: absolute; top: 100px; left: 120px; width: 470px;
            background: #161b22; border: 1px solid #30363d; border-radius: 8px;
            z-index: 10000; display: none; flex-direction: column;
            box-shadow: 0 8px 24px rgba(0,0,0,0.6); color: #c9d1d9;
            font-family: Inter, sans-serif;
        `;

        this.element.innerHTML = `
            <div style="background:#2f363d; padding:10px 12px; border-radius:8px 8px 0 0;
                        display:flex; justify-content:space-between; align-items:center; cursor:move;">
                <span style="font-weight:600;">🛣️ Percorsi Camion</span>
                <button id="route-close" style="background:none;border:none;color:#c9d1d9;font-size:20px;cursor:pointer;line-height:1;">×</button>
            </div>

            <div id="route-hint" style="padding:10px 12px; font-size:0.78rem; color:#8b949e; border-bottom:1px solid #30363d;">
                Scegli una tratta e disegnala sulla mappa. Le tratte non disegnate
                continuano a usare il calcolo automatico.
            </div>

            <div id="route-body" style="max-height:420px; overflow-y:auto; padding:8px 12px;"></div>

            <div style="padding:10px 12px; border-top:1px solid #30363d; display:flex; gap:8px; justify-content:space-between; align-items:center;">
                <span id="route-count" style="font-size:0.75rem; color:#8b949e;"></span>
                <div style="display:flex; gap:6px;">
                    <button id="route-export" style="font-size:0.72rem; padding:5px 9px; background:#21262d; color:#c9d1d9; border:1px solid #30363d; border-radius:4px; cursor:pointer;">📋 Esporta</button>
                    <button id="route-clear" style="font-size:0.72rem; padding:5px 9px; background:#8b2c2c; color:#fff; border:none; border-radius:4px; cursor:pointer;">🗑 Cancella tutti</button>
                </div>
            </div>
        `;

        document.body.appendChild(this.element);

        this.element.querySelector('#route-close').onclick = () => this.hide();
        this.element.querySelector('#route-clear').onclick = () => this._clearAll();
        this.element.querySelector('#route-export').onclick = () => this._export();

        this._makeDraggable(this.element.querySelector('div'));
        this.render();
    }

    _makeDraggable(handle) {
        let dx = 0, dy = 0, dragging = false;
        handle.addEventListener('mousedown', e => {
            if (e.target.tagName === 'BUTTON') return;
            dragging = true;
            dx = e.clientX - this.element.offsetLeft;
            dy = e.clientY - this.element.offsetTop;
            e.preventDefault();
        });
        document.addEventListener('mousemove', e => {
            if (!dragging) return;
            this.element.style.left = `${e.clientX - dx}px`;
            this.element.style.top = `${e.clientY - dy}px`;
        });
        document.addEventListener('mouseup', () => { dragging = false; });
    }

    show() { this.isVisible = true; this.element.style.display = 'flex'; this.render(); }
    hide() { this.isVisible = false; this.element.style.display = 'none'; this._cancelCapture(); }
    toggle() { this.isVisible ? this.hide() : this.show(); }

    render() {
        const body = this.element.querySelector('#route-body');

        body.innerHTML = TRUCK_LEGS.map((leg, i) => {
            const drawn = this.routeBook.has(leg.from, leg.to);
            const capturing = this.capturingLeg &&
                this.capturingLeg.from === leg.from && this.capturingLeg.to === leg.to;

            const meters = drawn ? Math.round(this.routeBook.lengthMeters(leg.from, leg.to)) : 0;
            const points = drawn ? this.routeBook.get(leg.from, leg.to).length : 0;

            const badge = capturing
                ? `<span style="color:#e3b341;">✏️ disegna sulla mappa…</span>`
                : drawn
                    ? `<span style="color:#3fb950;">✓ tracciato · ${points} punti · ${meters} m</span>`
                    : `<span style="color:#8b949e;">automatico</span>`;

            return `
                <div style="padding:8px 0; border-bottom:1px solid #21262d;">
                    <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
                        <div style="min-width:0;">
                            <div style="font-size:0.82rem; color:#c9d1d9;">
                                ${leg.oversize ? '📐 ' : ''}${leg.label}
                            </div>
                            <div style="font-size:0.72rem; margin-top:2px;">${badge}</div>
                        </div>
                        <div style="display:flex; gap:5px; flex-shrink:0;">
                            <button data-act="draw" data-i="${i}"
                                style="font-size:0.72rem; padding:4px 8px; cursor:pointer; border:none; border-radius:4px;
                                       background:${capturing ? '#e3b341' : '#1f6feb'}; color:${capturing ? '#000' : '#fff'};">
                                ${capturing ? 'Annulla' : (drawn ? 'Ridisegna' : 'Disegna')}
                            </button>
                            <button data-act="del" data-i="${i}" ${drawn ? '' : 'disabled'}
                                style="font-size:0.72rem; padding:4px 7px; cursor:${drawn ? 'pointer' : 'default'};
                                       background:#21262d; color:${drawn ? '#f78166' : '#484f58'};
                                       border:1px solid #30363d; border-radius:4px;">🗑</button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        body.querySelectorAll('button[data-act]').forEach(btn => {
            btn.onclick = () => {
                const leg = TRUCK_LEGS[parseInt(btn.dataset.i, 10)];
                if (btn.dataset.act === 'draw') this._toggleCapture(leg);
                else this._delete(leg);
            };
        });

        const n = this.routeBook.count();
        this.element.querySelector('#route-count').textContent =
            `${n} di ${TRUCK_LEGS.length} tratte tracciate a mano`;
    }

    // --- Drawing ---

    _toggleCapture(leg) {
        if (this.capturingLeg && this.capturingLeg.from === leg.from && this.capturingLeg.to === leg.to) {
            this._cancelCapture();
            return;
        }

        this.capturingLeg = leg;
        this._setHint(`Disegna <b>${leg.label}</b>: clicca i punti lungo la strada, doppio clic per finire.
                       Il verso si corregge da solo se parti dal capo sbagliato.`, '#e3b341');

        if (this.map.pm) this.map.pm.enableDraw('Line', { snappable: true, snapDistance: 15 });
        this.render();
    }

    _cancelCapture() {
        this.capturingLeg = null;
        if (this.map.pm) this.map.pm.disableDraw();
        this._setHint(`Scegli una tratta e disegnala sulla mappa. Le tratte non disegnate
                       continuano a usare il calcolo automatico.`, '#8b949e');
        this.render();
    }

    /** True while a drawn line should be captured as a route rather than a road. */
    isCapturing() {
        return this.capturingLeg !== null;
    }

    /**
     * Consumes a line drawn on the map for the leg being captured.
     * @param {Array<{lat:number,lng:number}>} latlngs
     */
    capture(latlngs) {
        const leg = this.capturingLeg;
        if (!leg) return false;

        try {
            this.routeBook.set(leg.from, leg.to, latlngs);
        } catch (err) {
            this._setHint(`⚠️ ${err.message}`, '#f78166');
            return false;
        }

        this.capturingLeg = null;
        if (this.map.pm) this.map.pm.disableDraw();

        const meters = Math.round(this.routeBook.lengthMeters(leg.from, leg.to));
        this._setHint(`✅ <b>${leg.label}</b> salvata (${meters} m). I camion la useranno da subito.`, '#3fb950');

        this.routeBook.persist();
        this.onChange();
        this.render();
        return true;
    }

    _delete(leg) {
        if (!confirm(`Cancellare il percorso tracciato per "${leg.label}"?\nLa tratta tornerà al calcolo automatico.`)) return;
        this.routeBook.remove(leg.from, leg.to);
        this.routeBook.persist();
        this.onChange();
        this.render();
    }

    _clearAll() {
        if (!confirm('Cancellare TUTTI i percorsi tracciati?\nTutte le tratte torneranno al calcolo automatico.')) return;
        this.routeBook.clear();
        this.routeBook.persist();
        this.onChange();
        this.render();
    }

    _export() {
        const json = JSON.stringify(this.routeBook.routes, null, 2);
        navigator.clipboard.writeText(json)
            .then(() => this._setHint('📋 Percorsi copiati negli appunti (JSON).', '#3fb950'))
            .catch(() => this._setHint('⚠️ Copia non riuscita: vedi la console.', '#f78166'));
        console.log('[RouteEditor] Percorsi tracciati:', json);
    }

    _setHint(html, color) {
        const hint = this.element.querySelector('#route-hint');
        hint.innerHTML = html;
        hint.style.color = color;
    }
}
