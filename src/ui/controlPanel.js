import { Container, ContainerType } from '../core/yardManager.js';

export class ControlPanel {
    constructor(yard, renderer, renderCallback, selectionInfoCallback) {
        this.yard = yard;
        this.renderer = renderer;
        this.renderCallback = renderCallback;
        this.selectionInfoCallback = selectionInfoCallback;

        this.init();
    }

    init() {
        // Elements
        this.inpBay = document.getElementById('inp-bay');
        this.inpRow = document.getElementById('inp-row');
        this.inpId = document.getElementById('inp-id');
        this.inpType = document.getElementById('inp-type');

        this.btnAdd = document.getElementById('btn-add');
        this.btnRemove = document.getElementById('btn-remove');

        // Move & Search Elements
        this.btnMoveMode = document.getElementById('btn-move-mode');
        this.moveStatus = document.getElementById('move-status');
        this.inpSearch = document.getElementById('inp-search');
        this.btnSearch = document.getElementById('btn-search');

        // Listeners
        this.btnAdd.addEventListener('click', () => this.handleAdd());
        this.btnRemove.addEventListener('click', () => this.handleRemove());

        // Listen to manual input changes to update button states
        this.inpBay.addEventListener('change', () => this.checkStates());
        this.inpRow.addEventListener('change', () => this.checkStates());

        // New Listeners
        this.btnMoveMode.addEventListener('click', () => this.toggleMoveMode());
        this.btnSearch.addEventListener('click', () => this.handleSearch());

        // State
        this.moveMode = false;
        this.moveSource = null;
    }

    /**
     * Called when a stack is selected in the Grid.
     * Updates inputs and button states.
     */
    setTarget(bay, row) {
        if (this.moveMode) {
            this.handleMoveSelection(bay, row);
        } else {
            this.inpBay.value = bay;
            this.inpRow.value = row;
            this.checkStates();
        }
    }

    toggleMoveMode() {
        this.moveMode = !this.moveMode;
        this.moveSource = null; // Reset source on toggle

        if (this.moveMode) {
            this.btnMoveMode.textContent = "Cancel Move";
            this.btnMoveMode.style.borderColor = "var(--accent-color)";
            this.moveStatus.style.display = 'block';
            this.moveStatus.textContent = "Select Source Stack...";
        } else {
            this.btnMoveMode.textContent = "Toggle Move Mode";
            this.btnMoveMode.style.borderColor = "var(--border-color)";
            this.moveStatus.style.display = 'none';
        }
    }

    handleMoveSelection(bay, row) {
        if (!this.moveSource) {
            // Select Source
            const stackHeight = this.yard.getStackHeight(bay, row);
            if (stackHeight === 0) {
                alert("Source stack is empty!");
                return;
            }
            this.moveSource = { bay, row };
            this.moveStatus.textContent = `Source: Bay ${bay}, Row ${row}. Select Destination...`;
            // Visual feedback could be added here (e.g. highlight)
            console.log("Move Source Selected:", this.moveSource);
        } else {
            // Select Destination and Execute
            if (this.moveSource.bay === bay && this.moveSource.row === row) {
                alert("Cannot move to the same stack!");
                return;
            }
            this.executeMove(this.moveSource.bay, this.moveSource.row, bay, row);
        }
    }

    executeMove(fromBay, fromRow, toBay, toRow) {
        const success = this.yard.moveContainer(fromBay, fromRow, toBay, toRow);

        if (success) {
            console.log(`Moved container from ${fromBay}-${fromRow} to ${toBay}-${toRow}`);
            this.refresh(fromBay, fromRow); // Refresh source
            this.refresh(toBay, toRow);     // Refresh dest

            // Exit move mode
            this.toggleMoveMode();
        } else {
            alert("Move Failed. Check if destination is full.");
            // Reset source to let user try again or cancel
            this.moveSource = null;
            this.moveStatus.textContent = "Move Failed. Select Source Again...";
        }
    }

    handleSearch() {
        const id = this.inpSearch.value.trim();
        if (!id) return;

        const result = this.yard.findContainer(id);
        if (result) {
            console.log("Found container:", result);
            // Select the found stack
            this.setTarget(result.bay, result.row);
            // Force info panel update directly to show the specific stack if not in move mode
            if (!this.moveMode && this.selectionInfoCallback) {
                this.selectionInfoCallback(result.bay, result.row);
            }
            // Optional: Highlight logic could be pushed to renderer
            alert(`Container ${result.container.id} found at Bay ${result.bay}, Row ${result.row}, Tier ${result.tier}`);
        } else {
            alert(`Container ${id} not found.`);
        }
    }

    checkStates() {
        const bay = parseInt(this.inpBay.value);
        const row = parseInt(this.inpRow.value);

        if (isNaN(bay) || isNaN(row)) return;

        const height = this.yard.getStackHeight(bay, row);
        const max = this.yard.maxTiers;

        // Smart Buttons Logic
        if (height >= max) {
            this.btnAdd.disabled = true;
            this.btnAdd.title = "Stack is Full";
        } else {
            this.btnAdd.disabled = false;
            this.btnAdd.title = "";
        }

        if (height === 0) {
            this.btnRemove.disabled = true;
        } else {
            this.btnRemove.disabled = false;
        }
    }

    handleAdd() {
        const bay = parseInt(this.inpBay.value);
        const row = parseInt(this.inpRow.value);
        const id = this.inpId.value;
        const type = this.inpType.value;

        if (!id) {
            alert("Please enter a Container ID");
            return;
        }

        const container = new Container(id, type);
        const success = this.yard.addContainer(container, bay, row);

        if (success) {
            console.log(`Added ${id} to Bay ${bay}, Row ${row}`);
            this.refresh(bay, row);

            // Auto-increment ID for convenience
            const numericPart = id.match(/\d+/);
            if (numericPart) {
                const num = parseInt(numericPart[0]) + 1;
                const prefix = id.replace(/\d+/, '');
                this.inpId.value = prefix + num.toString().padStart(numericPart[0].length, '0');
            }
        } else {
            alert(`Failed to add container. Stack at Bay ${bay}, Row ${row} might be full.`);
        }
    }

    handleRemove() {
        const bay = parseInt(this.inpBay.value);
        const row = parseInt(this.inpRow.value);

        const removed = this.yard.removeContainer(bay, row);

        if (removed) {
            console.log(`Removed ${removed.id} from Bay ${bay}, Row ${row}`);
            this.refresh(bay, row);
        } else {
            alert(`No container to remove at Bay ${bay}, Row ${row}.`);
        }
    }

    refresh(bay, row) {
        // 1. Re-render Grid
        if (this.renderCallback) {
            this.renderCallback();
        }

        // 2. Update Inspection Panel (force refresh of the current target)
        if (this.selectionInfoCallback) {
            this.selectionInfoCallback(bay, row);
        }

        // 3. Update Button States
        this.checkStates();
    }
}
