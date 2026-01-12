class SlotManager {
    constructor() {
        this.slots = {};
        // Initialize 9 Slots (S1 to S9)
        for (let i = 1; i <= 9; i++) {
            const id = `S${i}`;
            this.slots[id] = {
                id: id,
                status: 'FREE', // FREE, OCCUPIED, BOOKED
                lastUpdated: new Date()
            };
        }
    }

    resetAll() {
        for (let i = 1; i <= 9; i++) {
            const id = `S${i}`;
            this.slots[id].status = 'FREE';
            delete this.slots[id].bookingDetails;
            delete this.slots[id].isBooked;
        }
    }

    getSlots() {
        return this.slots;
    }

    updateSlotStatus(slotId, status, force = false) {
        if (this.slots[slotId]) {
            const currentStatus = this.slots[slotId].status;

            // PROTECT BOOKING: If slot is BOOKED, ignore sensor 'FREE' updates
            // unless it's a forced update (e.g., from Admin or specific logic)
            if (currentStatus === 'BOOKED' && status === 'FREE' && !force) {
                // Return current state without changes
                return this.slots[slotId];
            }

            this.slots[slotId].status = status;
            this.slots[slotId].lastUpdated = new Date();

            // If freeing up, clear booking details (Only if forced or transition from OCCUPIED)
            // If it was BOOKED and we are forcing FREE, clear it.
            // If it was OCCUPIED and now FREE, clear it (car left).
            if (status === 'FREE') {
                delete this.slots[slotId].bookingDetails;
                delete this.slots[slotId].isBooked;
            }

            return this.slots[slotId];
        }
        throw new Error('Slot not found');
    }

    bookSlot(slotId, bookingDetails) {
        if (this.slots[slotId] && this.slots[slotId].status === 'FREE') {
            this.slots[slotId].status = 'BOOKED';
            this.slots[slotId].lastUpdated = new Date();
            this.slots[slotId].isBooked = true;
            this.slots[slotId].bookingDetails = {
                ...bookingDetails,
                bookedAt: new Date()
            };
            return this.slots[slotId];
        }
        return null; // Slot not available
    }

    getAllSlots() {
        return Object.values(this.slots);
    }
}

const slotManager = new SlotManager();
module.exports = slotManager;
