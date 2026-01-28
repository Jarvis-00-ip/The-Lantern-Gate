import { InputHandler } from './InputHandler.js';
import { ZoneType } from '../../core/LayoutManager.js';

export class CanvasRenderer {
    constructor(yard, layoutManager, canvasId) {
        this.yard = yard;
        this.layoutManager = layoutManager;
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');

        // Camera State
        this.camera = {
            x: -400, // Centered on the main terminal body
            y: -100,
            zoom: 0.6 // Zoomed out to see the whole "Boot"
        };

        // Selection State
        this.selectedStack = null; // { bay, row }

        // Configuration
        this.config = {
            slotWidth: 60,
            slotHeight: 120, // 20ft container proportion approx
            gap: 20,
            gridRows: 4,
            gridBays: 5
        };

        // Initialize Input
        this.input = new InputHandler(this.canvas, this.camera);
        this.input.setOnClick((wx, wy) => this.handleWorldClick(wx, wy));

        // Start Loop
        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.loop();
    }

    resize() {
        this.canvas.width = this.canvas.parentElement.clientWidth;
        this.canvas.height = this.canvas.parentElement.clientHeight;
        this.render();
    }

    loop() {
        this.render();
        requestAnimationFrame(() => this.loop());
    }

    /**
     * Converts logic coordinates (Bay, Row) to World Coordinates (Center of slot)
     */
    getSlotWorldPosition(bay, row) {
        // Center the grid around 0,0
        const totalWidth = this.config.gridBays * (this.config.slotWidth + this.config.gap);
        const totalHeight = this.config.gridRows * (this.config.slotHeight + this.config.gap);

        const startX = -totalWidth / 2;
        const startY = -totalHeight / 2;

        const x = startX + (bay - 1) * (this.config.slotWidth + this.config.gap) + this.config.slotWidth / 2;
        const y = startY + (row - 1) * (this.config.slotHeight + this.config.gap) + this.config.slotHeight / 2;

        return { x, y };
    }

    render() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        // Clear
        ctx.fillStyle = '#0d1117';
        ctx.fillRect(0, 0, w, h);

        // Apply Camera Transform
        ctx.save();
        ctx.translate(w / 2, h / 2); // Center of screen
        ctx.scale(this.camera.zoom, this.camera.zoom);
        ctx.translate(-this.camera.x, -this.camera.y);

        // 1. Draw Port Layout (Background Zones: Water, Quay, Yard)
        this.drawLayout(ctx);

        // 2. Draw Grid & Stacks (Containers)
        this.drawGrid(ctx);
        this.drawStacks(ctx);

        // 3. Draw STS Cranes (Foreground Overlay)
        this.drawCranes(ctx);

        // Draw Selection Highlight
        if (this.selectedStack) {
            this.drawSelection(ctx);
        }

        ctx.restore();

        // HUD / Overlay (if any needed directly on canvas)
    }

    drawLayout(ctx) {
        if (!this.layoutManager) return;

        const zones = this.layoutManager.getZones();

        zones.forEach(zone => {
            // Skip Cranes (drawn later)
            if (zone.type === ZoneType.STS_CRANE) return;

            ctx.fillStyle = this._getColorForZone(zone.type);

            if (zone.type === ZoneType.LANDMARK && zone.name === 'Lanterna') {
                // ... (Lanterna code remains the same) ...
                ctx.save();
                ctx.fillStyle = '#d4ae75';
                ctx.fillRect(zone.x, zone.y, zone.width, zone.height);
                ctx.fillStyle = '#000';
                ctx.fillRect(zone.x + 20, zone.y + 20, 40, 40);
                ctx.fillStyle = '#fff';
                ctx.font = '12px Arial';
                ctx.textAlign = 'center';
                ctx.fillText("Lanterna", zone.x + zone.width / 2, zone.y - 10);
                ctx.restore();
            } else {
                ctx.fillRect(zone.x, zone.y, zone.width, zone.height);
            }

            // Textures/Details
            if (zone.type === ZoneType.RAILWAY) {
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 1;
                ctx.strokeRect(zone.x, zone.y, zone.width, zone.height);
            }
            // Optional: Borders for distinct areas
            if (zone.type === ZoneType.YARD || zone.type === ZoneType.QUAY) {
                ctx.strokeStyle = 'rgba(255,255,255,0.1)';
                ctx.lineWidth = 2;
                ctx.strokeRect(zone.x, zone.y, zone.width, zone.height);
            }
        });
    }

    drawCranes(ctx) {
        if (!this.layoutManager) return;
        const zones = this.layoutManager.getZones();

        zones.forEach(zone => {
            if (zone.type !== ZoneType.STS_CRANE) return;

            // Draw Crane Structure (Red RAL 3020)
            ctx.save();

            // Shadow (for depth)
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(zone.x + 10, zone.y + 10, zone.width, zone.height);

            // Legs/Base
            ctx.fillStyle = '#cc0000'; // Darker Red for base
            ctx.fillRect(zone.x, zone.y, zone.width, zone.height);

            // Cab/Arm Details
            ctx.fillStyle = '#ff0000'; // Bright Red
            ctx.fillRect(zone.x + 5, zone.y + 5, zone.width - 10, zone.height - 10);

            // Arm Overhang (visual flourish over water)
            ctx.fillStyle = '#b91c1c';
            ctx.fillRect(zone.x + 10, zone.y + zone.height, 20, 40); // Overhang downward (South)

            ctx.restore();
        });
    }

    _getColorForZone(type) {
        switch (type) {
            case ZoneType.WATER: return '#0a192f'; // Deep Blue
            case ZoneType.QUAY: return '#8b949e';  // Concrete Grey
            case ZoneType.YARD: return '#161b22';  // Dark Asphalt (Standard BG)
            case ZoneType.ROAD: return '#21262d';  // Lighter Asphalt
            case ZoneType.GATE: return '#3fb950';  // Green for Gate
            default: return '#0d1117';
        }
    }

    drawGrid(ctx) {
        // Draw slots
        for (let r = 1; r <= this.config.gridRows; r++) {
            for (let b = 1; b <= this.config.gridBays; b++) {
                const pos = this.getSlotWorldPosition(b, r);

                // Ground Slot
                ctx.fillStyle = '#21262d';
                ctx.strokeStyle = '#30363d';
                ctx.lineWidth = 2;

                const hw = this.config.slotWidth / 2;
                const hh = this.config.slotHeight / 2;

                ctx.fillRect(pos.x - hw, pos.y - hh, this.config.slotWidth, this.config.slotHeight);
                ctx.strokeRect(pos.x - hw, pos.y - hh, this.config.slotWidth, this.config.slotHeight);

                // Label
                ctx.fillStyle = '#58a6ff';
                ctx.font = '10px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(`B${b}-R${r}`, pos.x, pos.y);
            }
        }
    }

    drawStacks(ctx) {
        // Iterate all logic stacks
        this.yard.stacks.forEach((stack, key) => {
            if (stack.length === 0) return;
            const [bay, row] = key.split('-').map(Number);
            const pos = this.getSlotWorldPosition(bay, row);

            // Draw just the top container for 2D top-down view
            const topContainer = stack[stack.length - 1];

            // Container Body
            ctx.fillStyle = this._getColorForType(topContainer.type);
            const hw = (this.config.slotWidth - 4) / 2;
            const hh = (this.config.slotHeight - 4) / 2;

            ctx.fillRect(pos.x - hw, pos.y - hh, hw * 2, hh * 2);

            // Container ID
            ctx.fillStyle = 'white';
            ctx.font = 'bold 12px Arial';
            ctx.fillText(topContainer.id.substring(0, 4), pos.x, pos.y - 10);
            ctx.font = '10px Arial';
            ctx.fillText(topContainer.id.substring(4), pos.x, pos.y + 10);

            // Stack Height Badge
            ctx.fillStyle = 'rgba(0,0,0,0.7)';
            ctx.beginPath();
            ctx.arc(pos.x + hw, pos.y - hh, 10, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 10px Arial';
            ctx.fillText(stack.length, pos.x + hw, pos.y - hh + 3);
        });
    }

    selectStack(bay, row) {
        if (!bay || !row) {
            this.selectedStack = null;
        } else {
            this.selectedStack = { bay, row };
        }
        this.render(); // Immediate update
    }

    drawSelection(ctx) {
        if (!this.selectedStack) return;
        const { bay, row } = this.selectedStack;
        const pos = this.getSlotWorldPosition(bay, row);

        const hw = this.config.slotWidth / 2;
        const hh = this.config.slotHeight / 2;

        // Yellow Glow Effect
        ctx.shadowColor = '#e3b341'; // GitHub Yellow
        ctx.shadowBlur = 15;
        ctx.strokeStyle = '#e3b341';
        ctx.lineWidth = 4;

        ctx.strokeRect(pos.x - hw, pos.y - hh, this.config.slotWidth, this.config.slotHeight);

        // Reset Shadow
        ctx.shadowBlur = 0;
    }

    _getColorForType(type) {
        switch (type) {
            case 'Reefer': return '#f0f6fc'; // Whiteish
            case 'IMO': return '#da3633';    // Red
            default: return '#1f6feb';       // Blue
        }
    }

    handleWorldClick(wx, wy) {
        // Find which slot was clicked
        // Simple bounding box check
        const hw = this.config.slotWidth / 2;
        const hh = this.config.slotHeight / 2;

        for (let r = 1; r <= this.config.gridRows; r++) {
            for (let b = 1; b <= this.config.gridBays; b++) {
                const pos = this.getSlotWorldPosition(b, r);
                if (wx >= pos.x - hw && wx <= pos.x + hw &&
                    wy >= pos.y - hh && wy <= pos.y + hh) {

                    if (this.onStackClick) {
                        this.onStackClick(b, r);
                    }
                    return;
                }
            }
        }
    }

    setOnStackClick(callback) {
        this.onStackClick = callback;
    }

    // Compatibility methods for old renderer interface
    updateSelectionPanel(bay, row) {
        // Reuse logic from old renderer or just emit event?
        // Ideally we keep logic separated. 
        // For MVP quick port, we'll let the ControlPanel handle UI updates 
        // by reading from logic directly, but we might need to recreate the HTML generation here
        // or pass it to a UI helper.
        // Let's implement a minimal version here or assume ControlPanel accesses a UI helper.

        // For now, let's look at how app.js uses it.
        // app.js calls renderer.updateSelectionPanel.
        // We can just query DOM here as a quick fix or (cleaner) emit an event.
        // Let's try to simulate the old behavior:

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

        [...stackData].reverse().forEach((c, index) => {
            const actualTier = stackData.length - 1 - index;
            html += `
                <div class="info-row" style="padding: 4px; background: #21262d; border-radius: 4px; margin-bottom: 4px;">
                    <div style="font-weight:bold; color: ${this._getColorForType(c.type) === '#f0f6fc' ? '#0969da' : this._getColorForType(c.type)}">${c.id}</div>
                    <div style="font-size: 0.8rem; color: #8b949e;">Type: ${c.type} | Tier: ${actualTier} | Digs: ${index}</div>
                </div>
            `;
        });

        infoPanel.innerHTML = html;
    }
}
