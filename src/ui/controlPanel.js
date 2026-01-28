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
        this.currentZoneId = null;
        this.moveMode = false;
        this.moveSource = null;

        // Create Zone Dropdown
        const headerGroup = document.createElement('div');
        headerGroup.className = 'control-group';
        headerGroup.style.marginBottom = '0.5rem';
        headerGroup.innerHTML = `
            <label>Operational Area</label>
            <select id="sel-current-zone" style="background:#21262d; border:1px solid var(--border-color); color:var(--accent-color); font-weight:bold;">
                <option value="">Select Zone...</option>
            </select>
        `;
        // Insert before Location group
        const locationGroup = this.inpBay.closest('.control-group');
        locationGroup.parentNode.insertBefore(headerGroup, locationGroup);

        this.selZone = document.getElementById('sel-current-zone');

        // Listener for Dropdown
        this.selZone.addEventListener('change', (e) => {
            if (e.target.value) {
                this.setZone(e.target.value);
                // Also trigger map feedback if needed (optional, circle back to renderer?)
            }
        });
    }

    /**
     * Populates the zone dropdown with available zones.
     * @param {Array} zones - List of zone objects
     */
    populateZones(zones) {
        // Clear existing except first
        this.selZone.innerHTML = '<option value="">Select Zone...</option>';

        // Filter for storage/interesting zones only? Or all? 
        // Let's show all for now, or maybe just storage.
        // User asked to select "Operational Area".
        zones.forEach(z => {
            const opt = document.createElement('option');
            opt.value = z.id;
            opt.textContent = `${z.id} (${z.type})`;
            this.selZone.appendChild(opt);
        });
    }

    /**
     * Sets the active zone for operations.
     * @param {string} zoneId 
     */
    setZone(zoneId) {
        this.currentZoneId = zoneId;

        // Sync Dropdown (if set externally e.g. from Map click)
        if (this.selZone.value !== zoneId) {
            this.selZone.value = zoneId;
        }

        console.log(`[ControlPanel] Zone set to ${zoneId}`);
        // Reset inputs to 1-1
        this.inpBay.value = 1;
        this.inpRow.value = 1;
        this.checkStates();
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
        if (!this.currentZoneId) {
            alert("Please select a zone first!");
            return;
        }

        if (!this.moveSource) {
            // Select Source
            const stackHeight = this.yard.getStackHeight(this.currentZoneId, bay, row);
            if (stackHeight === 0) {
                alert("Source stack is empty!");
                return;
            }
            this.moveSource = { zone: this.currentZoneId, bay, row };
            this.moveStatus.textContent = `Source: ${this.currentZoneId} ${bay}-${row}. Select Destination...`;
            console.log("Move Source Selected:", this.moveSource);
        } else {
            // Select Destination and Execute
            if (this.moveSource.zone === this.currentZoneId && this.moveSource.bay === bay && this.moveSource.row === row) {
                alert("Cannot move to the same stack!");
                return;
            }
            this.executeMove(this.moveSource.zone, this.moveSource.bay, this.moveSource.row, this.currentZoneId, bay, row);
        }
    }

    executeMove(fromZone, fromBay, fromRow, toZone, toBay, toRow) {
        const success = this.yard.moveContainer(fromZone, fromBay, fromRow, toZone, toBay, toRow);

        if (success) {
            console.log(`Moved container from ${fromZone}:${fromBay}-${fromRow} to ${toZone}:${toBay}-${toRow}`);
            this.refresh(fromZone, fromBay, fromRow); // Refresh source
            this.refresh(toZone, toBay, toRow);     // Refresh dest

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

            // Switch zone if needed
            if (result.zoneId !== this.currentZoneId) {
                this.setZone(result.zoneId);
            }

            // Select the found stack
            this.setTarget(result.bay, result.row);

            // Force info panel update directly
            if (this.selectionInfoCallback) {
                this.selectionInfoCallback(result.bay, result.row);
            }
            alert(`Container ${result.container.id} found in ${result.zoneId} at Bay ${result.bay}, Row ${result.row}, Tier ${result.tier}`);
        } else {
            alert(`Container ${id} not found.`);
        }
    }

    checkStates() {
        if (!this.currentZoneId) {
            this.btnAdd.disabled = true;
            this.btnRemove.disabled = true;
            return;
        }

        const bay = parseInt(this.inpBay.value);
        const row = parseInt(this.inpRow.value);

        if (isNaN(bay) || isNaN(row)) return;

        const height = this.yard.getStackHeight(this.currentZoneId, bay, row);
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
        if (!this.currentZoneId) {
            alert("Please select a Zone from the map first.");
            return;
        }

        const bay = parseInt(this.inpBay.value);
        const row = parseInt(this.inpRow.value);
        const id = this.inpId.value;
        const type = this.inpType.value;

        if (!id) {
            alert("Please enter a Container ID");
            return;
        }

        const container = new Container(id, type);
        const success = this.yard.addContainer(container, this.currentZoneId, bay, row);

        if (success) {
            console.log(`Added ${id} to ${this.currentZoneId} Bay ${bay}, Row ${row}`);
            this.refresh(this.currentZoneId, bay, row);

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
        if (!this.currentZoneId) return;

        const bay = parseInt(this.inpBay.value);
        const row = parseInt(this.inpRow.value);

        const removed = this.yard.removeContainer(this.currentZoneId, bay, row);

        if (removed) {
            console.log(`Removed ${removed.id} from ${this.currentZoneId} Bay ${bay}, Row ${row}`);
            this.refresh(this.currentZoneId, bay, row);
        } else {
            alert(`No container to remove at Bay ${bay}, Row ${row}.`);
        }
    }

    refresh(zoneId, bay, row) {
        // 1. Re-render Grid (if we had one)
        if (this.renderCallback) {
            this.renderCallback();
        }

        // 2. Update Inspection Panel
        // Only update if we are looking at the same zone
        if (this.selectionInfoCallback && this.currentZoneId === zoneId) {
            this.selectionInfoCallback(bay, row);
        }

        // 3. Update Button States
        this.checkStates();
    }
}
