import React, { useState, useEffect } from 'react';
import api from '../api';
import { auth, db } from '../firebase';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import './BookingForm.css';

const BookingForm = ({ slotId, onClose, onSuccess }) => {
    const [vehicleType, setVehicleType] = useState('Car');
    const [vehicleNumber, setVehicleNumber] = useState('');
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [duration, setDuration] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [step, setStep] = useState(1);
    const [couponCode, setCouponCode] = useState('');
    const [discount, setDiscount] = useState(0);
    const [showCouponInput, setShowCouponInput] = useState(false);

    const pricePerHour = 50;
    const basePrice = Math.ceil(duration) * pricePerHour;
    const discountAmount = Math.round(basePrice * (discount / 100));
    const totalPrice = basePrice - discountAmount;

    // Set default times (now + 10 min to now + 1 hour)
    useEffect(() => {
        const now = new Date();
        const start = new Date(now.getTime() + 10 * 60000);
        const end = new Date(now.getTime() + 70 * 60000);
        setStartTime(start.toISOString().slice(0, 16));
        setEndTime(end.toISOString().slice(0, 16));
    }, []);

    // Auto-calculate duration when times change
    useEffect(() => {
        if (startTime && endTime) {
            const start = new Date(startTime);
            const end = new Date(endTime);
            const diffMs = end - start;
            const diffHrs = diffMs / (1000 * 60 * 60);

            if (diffHrs > 0) {
                setDuration(diffHrs.toFixed(2));
            } else {
                setDuration(0);
            }
        }
    }, [startTime, endTime]);

    const applyCoupon = () => {
        const code = couponCode.toUpperCase();
        if (code === 'FIRST10' || code === 'WELCOME10') {
            setDiscount(10);
            setError('');
        } else if (code === 'PARK20') {
            setDiscount(20);
            setError('');
        } else {
            setError('Invalid coupon code');
            setDiscount(0);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        if (duration <= 0) {
            setLoading(false);
            return setError("End time must be after start time.");
        }

        try {
            const response = await api.post('/parking/book', {
                slotId,
                vehicleType,
                vehicleNumber: vehicleNumber.toUpperCase(),
                duration: parseFloat(duration),
                startTime,
                endTime
            });

            if (response.data.success) {
                // If logged in, save to Firestore History & Global Bookings
                if (auth.currentUser) {
                    const bookingRecord = {
                        slotId,
                        vehicleType,
                        vehicleNumber: vehicleNumber.toUpperCase(),
                        date: new Date().toISOString(),
                        startTime,
                        endTime,
                        cost: totalPrice,
                        originalCost: basePrice,
                        discount: discount,
                        couponCode: couponCode || null,
                        status: 'BOOKED',
                        userId: auth.currentUser.uid,
                        userEmail: auth.currentUser.email
                    };

                    // 1. User's private history
                    const userRef = doc(db, "users", auth.currentUser.uid);
                    await updateDoc(userRef, {
                        history: arrayUnion(bookingRecord)
                    }).catch(err => console.error("Failed to save history", err));

                    // 2. Global Bookings Collection (For Admin Analytics)
                    const { addDoc, collection } = await import('firebase/firestore');
                    await addDoc(collection(db, "bookings"), {
                        ...bookingRecord,
                        createdAt: new Date().toISOString()
                    }).catch(err => console.error("Failed to save global booking", err));
                }

                onSuccess();
            }
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.message || 'Failed to book slot');
        } finally {
            setLoading(false);
        }
    };

    const nextStep = () => {
        if (step === 1 && (!vehicleNumber || vehicleNumber.length < 4)) {
            setError('Please enter a valid vehicle number');
            return;
        }
        setError('');
        setStep(step + 1);
    };

    const prevStep = () => {
        setError('');
        setStep(step - 1);
    };

    return (
        <div className="booking-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="booking-modal enhanced">
                {/* Header */}
                <div className="modal-header-enhanced">
                    <div className="slot-badge-large">{slotId}</div>
                    <div className="header-info">
                        <h2>Book Your Spot</h2>
                        <p>Secure this parking slot in seconds</p>
                    </div>
                    <button className="close-modal-btn" onClick={onClose}>×</button>
                </div>

                {/* Progress Steps */}
                <div className="booking-steps">
                    <div className={`step ${step >= 1 ? 'active' : ''} ${step > 1 ? 'completed' : ''}`}>
                        <div className="step-number">{step > 1 ? '✓' : '1'}</div>
                        <span>Vehicle</span>
                    </div>
                    <div className="step-line"></div>
                    <div className={`step ${step >= 2 ? 'active' : ''} ${step > 2 ? 'completed' : ''}`}>
                        <div className="step-number">{step > 2 ? '✓' : '2'}</div>
                        <span>Duration</span>
                    </div>
                    <div className="step-line"></div>
                    <div className={`step ${step >= 3 ? 'active' : ''}`}>
                        <div className="step-number">3</div>
                        <span>Confirm</span>
                    </div>
                </div>

                {error && <div className="error-msg animated">{error}</div>}

                <form className="booking-form" onSubmit={handleSubmit}>
                    {/* Step 1: Vehicle Details */}
                    {step === 1 && (
                        <div className="step-content slide-in">
                            <div className="form-group">
                                <label>🚗 Vehicle Type</label>
                                <div className="vehicle-type-grid">
                                    {['Car', 'Bike', 'Truck'].map(type => (
                                        <button
                                            key={type}
                                            type="button"
                                            className={`vehicle-type-btn ${vehicleType === type ? 'active' : ''}`}
                                            onClick={() => setVehicleType(type)}
                                        >
                                            <span className="type-icon">
                                                {type === 'Car' ? '🚗' : type === 'Bike' ? '🏍️' : '🚛'}
                                            </span>
                                            <span>{type}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="form-group">
                                <label>📝 Vehicle Number</label>
                                <input
                                    type="text"
                                    className="form-input large"
                                    value={vehicleNumber}
                                    onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
                                    placeholder="e.g. AP-39-HQ-1234"
                                    required
                                />
                                <span className="input-hint">Enter your vehicle registration number</span>
                            </div>

                            <button type="button" className="next-step-btn" onClick={nextStep}>
                                Continue <span>→</span>
                            </button>
                        </div>
                    )}

                    {/* Step 2: Duration */}
                    {step === 2 && (
                        <div className="step-content slide-in">
                            <div className="time-selection">
                                <div className="form-group">
                                    <label>🕐 Start Time</label>
                                    <input
                                        type="datetime-local"
                                        className="form-input"
                                        value={startTime}
                                        onChange={(e) => setStartTime(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>🕕 End Time</label>
                                    <input
                                        type="datetime-local"
                                        className="form-input"
                                        value={endTime}
                                        onChange={(e) => setEndTime(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="duration-preview">
                                <div className="duration-icon">⏱️</div>
                                <div className="duration-info">
                                    <span className="duration-value">{duration > 0 ? `${duration} Hours` : '--'}</span>
                                    <span className="duration-note">Estimated parking time</span>
                                </div>
                            </div>

                            <div className="quick-duration-btns">
                                <span className="quick-label">Quick select:</span>
                                {[1, 2, 4, 8].map(hours => (
                                    <button
                                        key={hours}
                                        type="button"
                                        className="quick-duration-btn"
                                        onClick={() => {
                                            const start = new Date();
                                            const end = new Date(start.getTime() + hours * 60 * 60 * 1000);
                                            setStartTime(start.toISOString().slice(0, 16));
                                            setEndTime(end.toISOString().slice(0, 16));
                                        }}
                                    >
                                        {hours}h
                                    </button>
                                ))}
                            </div>

                            <div className="step-nav">
                                <button type="button" className="back-btn" onClick={prevStep}>
                                    ← Back
                                </button>
                                <button type="button" className="next-step-btn" onClick={nextStep} disabled={duration <= 0}>
                                    Review <span>→</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Confirmation */}
                    {step === 3 && (
                        <div className="step-content slide-in">
                            <div className="booking-summary">
                                <h4>📋 Booking Summary</h4>

                                <div className="summary-row">
                                    <span>Parking Slot</span>
                                    <strong className="slot-highlight">{slotId}</strong>
                                </div>
                                <div className="summary-row">
                                    <span>Vehicle</span>
                                    <strong>{vehicleNumber} ({vehicleType})</strong>
                                </div>
                                <div className="summary-row">
                                    <span>Duration</span>
                                    <strong>{Math.ceil(duration)} Hour(s)</strong>
                                </div>
                                <div className="summary-row">
                                    <span>Rate</span>
                                    <strong>₹{pricePerHour}/hour</strong>
                                </div>

                                {/* Coupon Section */}
                                <div className="coupon-section">
                                    {!showCouponInput ? (
                                        <button
                                            type="button"
                                            className="coupon-toggle"
                                            onClick={() => setShowCouponInput(true)}
                                        >
                                            🎟️ Have a coupon code?
                                        </button>
                                    ) : (
                                        <div className="coupon-input-group">
                                            <input
                                                type="text"
                                                placeholder="Enter code"
                                                value={couponCode}
                                                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                                                className="coupon-input"
                                            />
                                            <button type="button" className="apply-coupon-btn" onClick={applyCoupon}>
                                                Apply
                                            </button>
                                        </div>
                                    )}
                                    {discount > 0 && (
                                        <div className="discount-applied">
                                            ✅ {discount}% discount applied!
                                        </div>
                                    )}
                                </div>

                                <div className="price-breakdown">
                                    <div className="price-row">
                                        <span>Subtotal</span>
                                        <span>₹{basePrice}</span>
                                    </div>
                                    {discount > 0 && (
                                        <div className="price-row discount">
                                            <span>Discount ({discount}%)</span>
                                            <span>-₹{discountAmount}</span>
                                        </div>
                                    )}
                                    <div className="price-row total">
                                        <span>Total</span>
                                        <span className="total-amount">₹{totalPrice}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="payment-note">
                                <span>💳</span>
                                <span>Pay at exit gate • Cash/UPI/Card accepted</span>
                            </div>

                            <div className="step-nav">
                                <button type="button" className="back-btn" onClick={prevStep}>
                                    ← Back
                                </button>
                                <button type="submit" className="confirm-booking-btn" disabled={loading}>
                                    {loading ? (
                                        <>
                                            <span className="loading-spinner-small"></span>
                                            Booking...
                                        </>
                                    ) : (
                                        <>
                                            ✓ Confirm Booking
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}
                </form>
            </div>
        </div>
    );
};

export default BookingForm;
