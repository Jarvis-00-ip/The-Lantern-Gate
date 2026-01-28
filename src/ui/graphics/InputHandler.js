export class InputHandler {
    constructor(canvas, camera) {
        this.canvas = canvas;
        this.camera = camera;

        // Interaction State
        this.isDragging = false;
        this.lastX = 0;
        this.lastY = 0;

        // Callbacks
        this.onClick = null;

        this.init();
    }

    init() {
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.canvas.addEventListener('mouseleave', (e) => this.onMouseUp(e));
        this.canvas.addEventListener('wheel', (e) => this.onWheel(e));
    }

    setOnClick(callback) {
        this.onClick = callback;
    }

    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    onMouseDown(e) {
        if (e.button === 0) { // Left Click
            this.isDragging = true;
            const pos = this.getMousePos(e);
            this.lastX = pos.x;
            this.lastY = pos.y;
            this.canvas.style.cursor = 'grabbing';
            this.dragStartX = pos.x;
            this.dragStartY = pos.y;
        }
    }

    onMouseMove(e) {
        if (this.isDragging) {
            const pos = this.getMousePos(e);
            const dx = pos.x - this.lastX;
            const dy = pos.y - this.lastY;

            this.camera.x -= dx / this.camera.zoom;
            this.camera.y -= dy / this.camera.zoom;

            this.lastX = pos.x;
            this.lastY = pos.y;
        }
    }

    onMouseUp(e) {
        if (this.isDragging) {
            this.isDragging = false;
            this.canvas.style.cursor = 'grab';

            // Detect Click (if moved very little)
            const pos = this.getMousePos(e);
            const dist = Math.hypot(pos.x - this.dragStartX, pos.y - this.dragStartY);

            if (dist < 5 && this.onClick) {
                // Convert Screen to World
                const worldX = (pos.x - this.canvas.width / 2) / this.camera.zoom + this.camera.x;
                const worldY = (pos.y - this.canvas.height / 2) / this.camera.zoom + this.camera.y;
                this.onClick(worldX, worldY);
            }
        }
    }

    onWheel(e) {
        e.preventDefault();
        const zoomIntensity = 0.1;
        const delta = e.deltaY;

        if (delta < 0) {
            this.camera.zoom *= (1 + zoomIntensity);
        } else {
            this.camera.zoom /= (1 + zoomIntensity);
        }

        // Clamp Zoom
        this.camera.zoom = Math.min(Math.max(0.1, this.camera.zoom), 5);
    }
}
