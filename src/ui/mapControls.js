export class MapControls {
    constructor(containerId, contentId) {
        this.container = document.getElementById(containerId);
        this.content = document.getElementById(contentId);

        // State
        this.scale = 0.8; // User requested reduced zoom
        this.panning = false;
        this.pointX = 0;
        this.pointY = 0;
        this.startX = 0;
        this.startY = 0;

        // Current Transform
        this.transformX = 0;
        this.transformY = 0;

        this.init();
    }

    init() {
        // --- Panning ---
        this.container.addEventListener('mousedown', (e) => {
            // Only left mouse button
            if (e.button !== 0) return;

            this.panning = true;
            this.startX = e.clientX - this.transformX;
            this.startY = e.clientY - this.transformY;
            this.container.style.cursor = 'grabbing';
        });

        this.container.addEventListener('mouseup', () => {
            this.panning = false;
            this.container.style.cursor = 'grab';
        });

        this.container.addEventListener('mouseleave', () => {
            this.panning = false;
            this.container.style.cursor = 'grab';
        });

        this.container.addEventListener('mousemove', (e) => {
            if (!this.panning) return;
            e.preventDefault();
            this.transformX = e.clientX - this.startX;
            this.transformY = e.clientY - this.startY;
            this.updateTransform();
        });

        // --- Zooming ---
        this.container.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY;
            const zoomStep = 0.1;

            if (delta > 0) {
                this.setScale(this.scale - zoomStep);
            } else {
                this.setScale(this.scale + zoomStep);
            }
        });

        // UI Controls Wiring
        this.zoomSlider = document.getElementById('zoom-slider');
        this.btnReset = document.getElementById('btn-reset-view');

        if (this.zoomSlider) {
            this.zoomSlider.addEventListener('input', (e) => {
                this.setScale(parseFloat(e.target.value));
            });
        }

        if (this.btnReset) {
            this.btnReset.addEventListener('click', () => {
                this.reset();
            });
        }

        // Initial set
        this.reset();
    }

    setScale(newScale) {
        // Clamp scale
        this.scale = Math.min(Math.max(newScale, 0.2), 3);

        // Sync slider
        if (this.zoomSlider) {
            this.zoomSlider.value = this.scale;
        }

        // Update Zoom Text
        const label = document.getElementById('zoom-val');
        if (label) {
            label.textContent = Math.round(this.scale * 100) + '%';
        }

        this.updateTransform();
    }

    updateTransform() {
        this.content.style.transform = `translate(${this.transformX}px, ${this.transformY}px) scale(${this.scale})`;
    }

    reset() {
        // Center the content approximately
        // Since content is centered via CSS translate(-50%, -50%) initially, 
        // we can just reset our dynamic offsets to 0.
        this.transformX = 0;
        this.transformY = 0;
        this.setScale(0.8);
    }
}
