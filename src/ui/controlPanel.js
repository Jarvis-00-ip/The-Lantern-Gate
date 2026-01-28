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

        // Listeners
        this.btnAdd.addEventListener('click', () => this.handleAdd());
        this.btnRemove.addEventListener('click', () => this.handleRemove());

        // Listen to manual input changes to update button states
        this.inpBay.addEventListener('change', () => this.checkStates());
        this.inpRow.addEventListener('change', () => this.checkStates());
    }

    /**
     * Called when a stack is selected in the Grid.
     * Updates inputs and button states.
     */
    setTarget(bay, row) {
        this.inpBay.value = bay;
        this.inpRow.value = row;
        this.checkStates();
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
