const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}
const DB_FILE = path.join(DATA_DIR, 'slots.json');

class SlotManager {
    constructor() {
        this.slots = {};
        this.loadState();
    }

    loadState() {
        try {
            if (fs.existsSync(DB_FILE)) {
                const data = fs.readFileSync(DB_FILE, 'utf8');
                this.slots = JSON.parse(data);
                console.log('Slot state loaded from disk.');
            } else {
                this.initializeDefaults();
                this.saveState();
            }
        } catch (err) {
            console.error('Failed to load slot state:', err);
            this.initializeDefaults();
        }
    }

    saveState() {
        try {
            fs.writeFileSync(DB_FILE, JSON.stringify(this.slots, null, 2));
        } catch (err) {
            console.error('Failed to save slot state:', err);
        }
    }

    initializeDefaults() {
        // Initialize 9 Slots (S1 to S9) if no data
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
            this.slots[id].lastUpdated = new Date();
        }
        this.saveState();
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
                return this.slots[slotId];
            }

            this.slots[slotId].status = status;
            this.slots[slotId].lastUpdated = new Date();

            // If freeing up, clear booking details
            if (status === 'FREE') {
                delete this.slots[slotId].bookingDetails;
                delete this.slots[slotId].isBooked;
            }

            this.saveState();
            return this.slots[slotId];
        }
        throw new Error('Slot not found');
    }

    bookSlot(slotId, bookingDetails) {
        if (this.slots[slotId] && this.slots[slotId].status === 'FREE') {
            const now = new Date();
            // Calculate endTime based on duration if not provided
            const endTime = bookingDetails.endTime
                ? new Date(bookingDetails.endTime)
                : new Date(now.getTime() + (bookingDetails.duration || 1) * 60 * 60 * 1000);

            // Validation: End time must be in future
            if (endTime <= now) {
                console.warn(`[SlotManager] Rejected booking for ${slotId}: End time is in the past.`);
                return null;
            }

            this.slots[slotId].status = 'BOOKED';
            this.slots[slotId].lastUpdated = now;
            this.slots[slotId].isBooked = true;
            this.slots[slotId].bookingDetails = {
                ...bookingDetails,
                bookedAt: now,
                startTime: bookingDetails.startTime || now.toISOString(),
                endTime: endTime.toISOString(),
                expiresAt: endTime.getTime() // Unix timestamp for easy comparison
            };
            this.saveState();
            return this.slots[slotId];
        }
        return null; // Slot not available
    }

    // Check and expire bookings that have passed their endTime
    checkExpiredBookings() {
        const now = Date.now();
        const expiredSlots = [];
        let changed = false;

        for (const slotId in this.slots) {
            const slot = this.slots[slotId];
            if (slot.isBooked && slot.bookingDetails && slot.bookingDetails.expiresAt) {
                if (now > slot.bookingDetails.expiresAt) {
                    // Booking has expired - free the slot
                    console.log(`[SlotManager] Booking for ${slotId} has expired. Freeing slot.`);
                    slot.status = 'FREE';
                    slot.isBooked = false;
                    slot.expiredBooking = { ...slot.bookingDetails }; // Keep record of what expired
                    delete slot.bookingDetails;
                    slot.lastUpdated = new Date();
                    expiredSlots.push(slotId);
                    changed = true;
                }
            }
        }

        if (changed) this.saveState();
        return expiredSlots;
    }

    getAllSlots() {
        return Object.values(this.slots);
    }
}

const slotManager = new SlotManager();
module.exports = slotManager;
