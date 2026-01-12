import React, { useEffect, useState, useRef } from 'react';
import api from '../api';
import BookingForm from './BookingForm';
import MapVisualizer from './MapVisualizer';
import ParkingMap from './ParkingMap';
import './ParkingLot.css';

const ParkingLot = () => {
    const [slots, setSlots] = useState({});
    const [loading, setLoading] = useState(true);
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [bookedSlot, setBookedSlot] = useState(null);
    const [showConfetti, setShowConfetti] = useState(false);
    const [bookingSuccess, setBookingSuccess] = useState(null);
    const [weather, setWeather] = useState({ temp: '28°C', condition: '☀️ Sunny', tip: 'Great day for outdoor parking!' });
    const [currentTime, setCurrentTime] = useState(new Date());
    const [recommendedSlot, setRecommendedSlot] = useState(null);
    const [showQuickTip, setShowQuickTip] = useState(true);
    const [recentBookings, setRecentBookings] = useState([]);
    const confettiRef = useRef(null);

    // Fetch parking slots
    const fetchSlots = async () => {
        try {
            const response = await api.get('/parking/slots');
            if (response.data.success) {
                setSlots(response.data.data);
                // Find recommended slot (closest to entrance that's free)
                const slotList = Object.values(response.data.data).filter(s => s.id?.startsWith('S'));
                const freeSlots = slotList.filter(s => s.status === 'FREE' && !s.isBooked);
                if (freeSlots.length > 0) {
                    // Prefer slots closer to entrance (lower numbers)
                    const sorted = freeSlots.sort((a, b) => {
                        const numA = parseInt(a.id.replace('S', ''));
                        const numB = parseInt(b.id.replace('S', ''));
                        return numA - numB;
                    });
                    setRecommendedSlot(sorted[0]);
                }
            }
        } catch (error) {
            console.error('Error fetching slots:', error);
        } finally {
            setLoading(false);
        }
    };

    // Update time every second
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        fetchSlots();
        const interval = setInterval(fetchSlots, 3000);
        return () => clearInterval(interval);
    }, []);

    // Create confetti explosion
    const createConfetti = () => {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 4000);
    };

    const handleSlotClick = (slot) => {
        if (slot.status === 'FREE' && !slot.isBooked) {
            setSelectedSlot(slot.id);
            // Play selection sound (subtle)
            try {
                const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleUMYIWTB2u6tXD4NAEWZ0+/KjGI+DwBTo9b01YdaOQADT5zT7ciJXjkAAU+e1O7FhFo3AAFQn9XswIBYNQABUJ/V7L+AWDUAAVCf1ey/gFg1AAFQ');
                audio.volume = 0.1;
                audio.play().catch(() => { });
            } catch { }
        }
    };

    const handleBookingSuccess = () => {
        const slotId = selectedSlot;
        setSelectedSlot(null);
        setBookingSuccess(slotId);
        createConfetti();

        // Store recent booking
        setRecentBookings(prev => [
            { slotId, time: new Date().toLocaleTimeString() },
            ...prev.slice(0, 2)
        ]);

        // Show success for 3 seconds then show map
        setTimeout(() => {
            setBookingSuccess(null);
            setBookedSlot(slotId);
        }, 3000);

        fetchSlots();
    };

    // Calculate stats
    const slotList = Object.values(slots).filter(s => s.id?.startsWith('S'));
    const totalSlots = slotList.length;
    const freeSlots = slotList.filter(s => s.status === 'FREE' && !s.isBooked).length;
    const bookedSlots = slotList.filter(s => s.isBooked).length;
    const occupiedSlots = slotList.filter(s => s.status === 'OCCUPIED').length;
    const occupancyRate = totalSlots > 0 ? Math.round(((bookedSlots + occupiedSlots) / totalSlots) * 100) : 0;

    if (loading) {
        return (
            <div className="premium-loading">
                <div className="loading-orb"></div>
                <div className="loading-rings">
                    <div className="ring ring-1"></div>
                    <div className="ring ring-2"></div>
                    <div className="ring ring-3"></div>
                </div>
                <h3>Loading Smart Parking...</h3>
                <p>Connecting to IoT sensors</p>
            </div>
        );
    }

    return (
        <div className="premium-parking-container">
            {/* Confetti Effect */}
            {showConfetti && (
                <div className="confetti-container" ref={confettiRef}>
                    {[...Array(50)].map((_, i) => (
                        <div
                            key={i}
                            className="confetti"
                            style={{
                                left: `${Math.random() * 100}%`,
                                animationDelay: `${Math.random() * 2}s`,
                                backgroundColor: ['#f97316', '#fbbf24', '#22c55e', '#ef4444', '#fff'][Math.floor(Math.random() * 5)]
                            }}
                        />
                    ))}
                </div>
            )}

            {/* Booking Success Celebration */}
            {bookingSuccess && (
                <div className="success-celebration">
                    <div className="celebration-content">
                        <div className="success-icon-large">🎉</div>
                        <h2>Booking Confirmed!</h2>
                        <p>Slot <strong>{bookingSuccess}</strong> is now yours</p>
                        <div className="success-details">
                            <span>🚗 Drive safely</span>
                            <span>⏱️ Navigation loading...</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Top Info Bar */}
            <div className="top-info-bar">
                {/* Live Clock */}
                <div className="info-widget clock-widget">
                    <div className="widget-icon">🕐</div>
                    <div className="widget-content">
                        <span className="widget-label">Current Time</span>
                        <span className="widget-value">{currentTime.toLocaleTimeString()}</span>
                    </div>
                </div>

                {/* Weather Widget */}
                <div className="info-widget weather-widget">
                    <div className="widget-icon">{weather.condition.split(' ')[0]}</div>
                    <div className="widget-content">
                        <span className="widget-label">{weather.temp}</span>
                        <span className="widget-value">{weather.tip}</span>
                    </div>
                </div>

                {/* Quick Stats */}
                <div className="info-widget stats-widget">
                    <div className="mini-stats">
                        <div className="mini-stat available">
                            <span className="stat-num">{freeSlots}</span>
                            <span className="stat-txt">Free</span>
                        </div>
                        <div className="mini-stat occupied">
                            <span className="stat-num">{occupiedSlots + bookedSlots}</span>
                            <span className="stat-txt">Taken</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="main-booking-area">
                {/* Left Sidebar - Smart Features */}
                <div className="smart-sidebar">
                    {/* AI Recommendation Card */}
                    {recommendedSlot && (
                        <div className="feature-card recommendation-card">
                            <div className="card-header">
                                <span className="card-icon">🤖</span>
                                <span className="card-title">AI Recommendation</span>
                                <span className="ai-badge">SMART</span>
                            </div>
                            <div className="card-body">
                                <div className="recommended-slot">
                                    <div className="slot-preview">{recommendedSlot.id}</div>
                                    <div className="slot-info">
                                        <span className="info-row">📍 Closest to entrance</span>
                                        <span className="info-row">🚶 ~15 sec walk</span>
                                        <span className="info-row">💨 Well ventilated</span>
                                    </div>
                                </div>
                                <button
                                    className="quick-book-ai-btn"
                                    onClick={() => handleSlotClick(recommendedSlot)}
                                >
                                    ⚡ Quick Book This Slot
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Occupancy Meter */}
                    <div className="feature-card occupancy-card">
                        <div className="card-header">
                            <span className="card-icon">📊</span>
                            <span className="card-title">Lot Occupancy</span>
                        </div>
                        <div className="card-body">
                            <div className="circular-progress">
                                <svg viewBox="0 0 100 100">
                                    <circle className="progress-bg" cx="50" cy="50" r="40" />
                                    <circle
                                        className="progress-fill"
                                        cx="50" cy="50" r="40"
                                        style={{
                                            strokeDasharray: `${occupancyRate * 2.51} 251`,
                                            stroke: occupancyRate > 80 ? '#ef4444' : occupancyRate > 50 ? '#fbbf24' : '#22c55e'
                                        }}
                                    />
                                </svg>
                                <div className="progress-text">
                                    <span className="percent">{occupancyRate}%</span>
                                    <span className="label">Full</span>
                                </div>
                            </div>
                            <div className="occupancy-status">
                                {occupancyRate < 50 ? '🟢 Plenty of space!' :
                                    occupancyRate < 80 ? '🟡 Filling up...' :
                                        '🔴 Almost full!'}
                            </div>
                        </div>
                    </div>

                    {/* Recent Bookings */}
                    {recentBookings.length > 0 && (
                        <div className="feature-card recent-card">
                            <div className="card-header">
                                <span className="card-icon">📋</span>
                                <span className="card-title">Recent Bookings</span>
                            </div>
                            <div className="card-body">
                                {recentBookings.map((booking, idx) => (
                                    <div key={idx} className="recent-item">
                                        <span className="recent-slot">{booking.slotId}</span>
                                        <span className="recent-time">{booking.time}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Quick Tips */}
                    {showQuickTip && (
                        <div className="feature-card tips-card">
                            <div className="card-header">
                                <span className="card-icon">💡</span>
                                <span className="card-title">Pro Tips</span>
                                <button className="close-tip" onClick={() => setShowQuickTip(false)}>×</button>
                            </div>
                            <div className="card-body">
                                <div className="tip-item">
                                    <span className="tip-icon">🎯</span>
                                    <span>Click any green slot to book instantly</span>
                                </div>
                                <div className="tip-item">
                                    <span className="tip-icon">🗺️</span>
                                    <span>Navigation guide appears after booking</span>
                                </div>
                                <div className="tip-item">
                                    <span className="tip-icon">💸</span>
                                    <span>₹50/hour - Pay when you exit</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Center - Enhanced Parking Map */}
                <div className="map-wrapper">
                    <div className="map-header-enhanced">
                        <div className="map-title">
                            <h2>🗺️ Interactive Parking Map</h2>
                            <div className="live-indicator">
                                <span className="live-dot"></span>
                                <span>LIVE</span>
                            </div>
                        </div>
                        <div className="map-legend-inline">
                            <span className="legend-item"><span className="dot available"></span> Available</span>
                            <span className="legend-item"><span className="dot reserved"></span> Reserved</span>
                            <span className="legend-item"><span className="dot occupied"></span> In Use</span>
                        </div>
                    </div>

                    <ParkingMap slots={slots} onSlotClick={handleSlotClick} />

                    {/* Floating Action Button */}
                    <div className="fab-container">
                        {recommendedSlot && (
                            <button
                                className="fab-button pulse-animation"
                                onClick={() => handleSlotClick(recommendedSlot)}
                                title="Quick book recommended slot"
                            >
                                ⚡
                            </button>
                        )}
                    </div>
                </div>

                {/* Right Sidebar - Info Panel */}
                <div className="info-sidebar">
                    {/* Pricing Card */}
                    <div className="feature-card pricing-card">
                        <div className="card-header">
                            <span className="card-icon">💰</span>
                            <span className="card-title">Pricing</span>
                        </div>
                        <div className="card-body">
                            <div className="price-row main-price">
                                <span className="price-label">Per Hour</span>
                                <span className="price-value">₹50</span>
                            </div>
                            <div className="price-row">
                                <span className="price-label">Day Pass (8h)</span>
                                <span className="price-value">₹350</span>
                            </div>
                            <div className="price-row">
                                <span className="price-label">Weekly</span>
                                <span className="price-value">₹2000</span>
                            </div>
                            <div className="discount-badge">
                                🎁 10% off for first booking!
                            </div>
                        </div>
                    </div>

                    {/* Amenities Card */}
                    <div className="feature-card amenities-card">
                        <div className="card-header">
                            <span className="card-icon">✨</span>
                            <span className="card-title">Amenities</span>
                        </div>
                        <div className="card-body amenities-grid">
                            <div className="amenity-item">
                                <span className="amenity-icon">🅿️</span>
                                <span>Covered</span>
                            </div>
                            <div className="amenity-item">
                                <span className="amenity-icon">🔒</span>
                                <span>Secured</span>
                            </div>
                            <div className="amenity-item">
                                <span className="amenity-icon">💡</span>
                                <span>Well Lit</span>
                            </div>
                            <div className="amenity-item">
                                <span className="amenity-icon">♿</span>
                                <span>Accessible</span>
                            </div>
                            <div className="amenity-item">
                                <span className="amenity-icon">🚻</span>
                                <span>Restrooms</span>
                            </div>
                            <div className="amenity-item">
                                <span className="amenity-icon">⚡</span>
                                <span>EV Charge</span>
                            </div>
                        </div>
                    </div>

                    {/* Contact/Help Card */}
                    <div className="feature-card help-card">
                        <div className="card-header">
                            <span className="card-icon">🆘</span>
                            <span className="card-title">Need Help?</span>
                        </div>
                        <div className="card-body">
                            <button className="help-btn">
                                <span>📞</span> Call Attendant
                            </button>
                            <button className="help-btn secondary">
                                <span>💬</span> Live Chat
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Booking Modal */}
            {selectedSlot && (
                <BookingForm
                    slotId={selectedSlot}
                    onClose={() => setSelectedSlot(null)}
                    onSuccess={handleBookingSuccess}
                />
            )}

            {/* Navigation Visualizer */}
            {bookedSlot && (
                <MapVisualizer
                    targetSlotId={bookedSlot}
                    onClose={() => setBookedSlot(null)}
                />
            )}
        </div>
    );
};

export default ParkingLot;
