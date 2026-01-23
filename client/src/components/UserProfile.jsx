import React, { useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useNavigate, Link } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import './UserProfile.css';

const UserProfile = () => {
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalBookings: 0,
        totalSpent: 0,
        activeBookings: 0,
        completedBookings: 0,
        totalHours: 0
    });

    // Dynamic Loyalty Data
    const [loyalty, setLoyalty] = useState({
        level: 'Bronze Member',
        points: 0,
        nextLevelPoints: 500,
        progress: 0
    });

    // Dynamic Achievements
    const [achievements, setAchievements] = useState({
        firstRide: false,
        frequentFlyer: false, // 5+ bookings
        bigSpender: false,   // > 500 spent
        nightOwl: false      // Booking after 8 PM
    });

    const [settings, setSettings] = useState({
        notifications: true,
        darkMode: true,
        biometric: false
    });

    const [historyFilter, setHistoryFilter] = useState('all');
    const [isEditingVehicle, setIsEditingVehicle] = useState(false);
    const [editVehicle, setEditVehicle] = useState({ type: '', number: '' });

    const navigate = useNavigate();

    useEffect(() => {
        const fetchUserData = async () => {
            if (!auth.currentUser) return; // Wait for auth

            try {
                const docRef = doc(db, "users", auth.currentUser.uid);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setUserData(data);

                    // Calculate stats from history
                    const history = data.history || [];
                    const totalSpent = history.reduce((acc, b) => acc + (b.cost || 0), 0);
                    const totalBookings = history.length;
                    const totalHours = history.reduce((acc, b) => acc + (parseFloat(b.duration) || 1), 0);

                    setStats({
                        totalBookings,
                        totalSpent,
                        totalHours: Math.round(totalHours),
                        activeBookings: history.filter(b => ['BOOKED', 'OCCUPIED', 'booked', 'occupied'].includes(b.status)).length,
                        completedBookings: history.filter(b => ['COMPLETED', 'completed'].includes(b.status)).length
                    });

                    // Calculate Loyalty (10 points per booking + 1 point per ₹10 spent)
                    const points = (totalBookings * 50) + Math.floor(totalSpent / 10);
                    let level = 'Bronze Member';
                    let nextLevelPoints = 500;

                    if (points >= 1000) {
                        level = 'Platinum Member';
                        nextLevelPoints = 2500; // Arbitrary next goal
                    } else if (points >= 500) {
                        level = 'Gold Member';
                        nextLevelPoints = 1000;
                    }

                    const progress = Math.min(100, (points / nextLevelPoints) * 100);

                    setLoyalty({
                        level,
                        points,
                        nextLevelPoints,
                        progress
                    });

                    // Calculate Achievements
                    const hasNightBooking = history.some(b => {
                        const date = new Date(b.date);
                        return date.getHours() >= 20 || date.getHours() < 5;
                    });

                    setAchievements({
                        firstRide: totalBookings > 0,
                        frequentFlyer: totalBookings >= 5,
                        bigSpender: totalSpent >= 500,
                        nightOwl: hasNightBooking
                    });
                }
            } catch (error) {
                console.error("Error fetching profile:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchUserData();
    }, [navigate]);

    const handleCancel = async (booking, index) => {
        if (!window.confirm("Are you sure you want to cancel this booking?")) return;

        try {
            const api = (await import('../api')).default;
            await api.post('/parking/cancel', { slotId: booking.slotId });

            const newHistory = [...userData.history];
            newHistory[index] = { ...newHistory[index], status: 'CANCELLED' };

            const userRef = doc(db, "users", auth.currentUser.uid);
            await updateDoc(userRef, { history: newHistory });

            setUserData(prev => ({ ...prev, history: newHistory }));
            alert("Booking cancelled successfully.");
        } catch (error) {
            console.error("Cancellation failed:", error);
            alert("Failed to cancel booking.");
        }
    };

    const handleLogout = async () => {
        try {
            await signOut(auth);
            navigate('/login');
        } catch (error) {
            console.error('Error logging out:', error);
        }
    };

    const toggleSetting = async (setting) => {
        const newSettings = { ...settings, [setting]: !settings[setting] };
        setSettings(newSettings);

        // Save to Firebase
        try {
            if (auth.currentUser) {
                const userRef = doc(db, "users", auth.currentUser.uid);
                await updateDoc(userRef, { settings: newSettings });
            }
        } catch (error) {
            console.error('Failed to save settings:', error);
        }
    };

    const handleEditVehicle = () => {
        setEditVehicle({
            type: userData?.vehicleType || 'Car',
            number: userData?.vehicleNumber || ''
        });
        setIsEditingVehicle(true);
    };

    const handleSaveVehicle = async () => {
        if (!editVehicle.number.trim()) {
            alert('Please enter a vehicle number');
            return;
        }

        try {
            const userRef = doc(db, "users", auth.currentUser.uid);
            await updateDoc(userRef, {
                vehicleType: editVehicle.type,
                vehicleNumber: editVehicle.number.toUpperCase()
            });
            setUserData(prev => ({
                ...prev,
                vehicleType: editVehicle.type,
                vehicleNumber: editVehicle.number.toUpperCase()
            }));
            setIsEditingVehicle(false);
            alert('Vehicle updated successfully!');
        } catch (error) {
            console.error('Failed to update vehicle:', error);
            alert('Failed to update vehicle');
        }
    };

    const getFilteredHistory = () => {
        if (!userData?.history) return [];
        const history = [...userData.history].reverse();

        switch (historyFilter) {
            case 'active':
                return history.filter(b => ['BOOKED', 'OCCUPIED'].includes(b.status?.toUpperCase()));
            case 'completed':
                return history.filter(b => b.status?.toUpperCase() === 'COMPLETED');
            default:
                return history;
        }
    };

    if (loading) {
        return (
            <div className="profile-loading">
                <div className="loading-spinner"></div>
                <p>Loading Profile...</p>
            </div>
        );
    }

    return (
        <div className="profile-page">
            {/* Header */}
            <header className="profile-header-bar">
                <div className="header-left">
                    <Link to="/" className="back-link">
                        <span>←</span> Back to Dashboard
                    </Link>
                </div>
                <div className="header-brand">
                    <span className="brand-icon">🅿️</span>
                    <span className="brand-text">Smart Parking</span>
                </div>
                <button className="logout-btn" onClick={handleLogout}>
                    🚪 Logout
                </button>
            </header>

            <div className="profile-container">
                {/* Hero Section */}
                <div className="profile-hero">
                    <div className="profile-info-primary">
                        <div className="profile-avatar-wrapper">
                            <div className="profile-avatar">
                                {userData?.email?.charAt(0).toUpperCase() || 'U'}
                            </div>
                            <div className="online-status"></div>
                        </div>
                        <div className="profile-text">
                            <h1>{userData?.email || 'Guest User'}</h1>
                            <div className="badges-row">
                                <span className={`badge-pill ${loyalty.level.includes('Gold') ? 'gold' : loyalty.level.includes('Platinum') ? 'platinum' : 'bronze'}`}>🏆 {loyalty.level}</span>
                                <span className="badge-pill verified">✓ Verified</span>
                            </div>
                        </div>
                    </div>

                    <div className="loyalty-card">
                        <div className="loyalty-header">
                            <span className="loyalty-title">Loyalty Points</span>
                            <span className="loyalty-points">{loyalty.points} / {loyalty.nextLevelPoints}</span>
                        </div>
                        <div className="progress-bar-container">
                            <div
                                className="progress-bar-fill"
                                style={{ width: `${loyalty.progress}%`, background: 'linear-gradient(90deg, #f97316, #fbbf24)' }}
                            ></div>
                        </div>
                        <p className="loyalty-next">
                            {loyalty.nextLevelPoints - loyalty.points} points to Platinum
                        </p>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="stats-grid">
                    <div className="stat-card">
                        <div className="stat-icon-wrapper orange">
                            🎫
                        </div>
                        <div className="stat-content">
                            <h3>{stats.totalBookings}</h3>
                            <p>Total Bookings</p>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon-wrapper green">
                            💰
                        </div>
                        <div className="stat-content">
                            <h3>₹{stats.totalSpent}</h3>
                            <p>Money Saved</p>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon-wrapper blue">
                            ⭐
                        </div>
                        <div className="stat-content">
                            <h3>4.9</h3>
                            <p>User Rating</p>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon-wrapper purple">
                            🕒
                        </div>
                        <div className="stat-content">
                            <h3>{stats.totalHours}h</h3>
                            <p>Hours Parked</p>
                        </div>
                    </div>
                </div>

                <div className="profile-content-layout">
                    {/* Left Column */}
                    <div className="profile-left-col">
                        {/* Vehicle Card */}
                        <div className="glass-card vehicle-card">
                            <div className="card-header-row">
                                <h3>My Vehicle</h3>
                                <button className="edit-btn" onClick={handleEditVehicle}>Edit</button>
                            </div>
                            <div className="vehicle-display">
                                <span className="vehicle-large-icon">
                                    {userData?.vehicleType === 'Car' ? '🚘' : userData?.vehicleType === 'Bike' ? '🏍️' : '🚛'}
                                </span>
                                <div className="vehicle-info-block">
                                    <span className="vehicle-type-label">{userData?.vehicleType || 'Not Registered'}</span>
                                    <span className="vehicle-plate">{userData?.vehicleNumber || '--- ---'}</span>
                                </div>
                            </div>
                        </div>

                        {/* Achievements */}
                        <div className="glass-card achievements-card">
                            <div className="card-header-row">
                                <h3>Achievements</h3>
                                <Link to="#" className="see-all">See All</Link>
                            </div>
                            <div className="achievements-grid">
                                <div className={`achievement-item ${achievements.firstRide ? 'unlocked' : 'locked'}`} title="First Ride: Complete your first booking">
                                    <span>🎈</span>
                                </div>
                                <div className={`achievement-item ${achievements.frequentFlyer ? 'unlocked' : 'locked'}`} title="Regular: 5+ bookings">
                                    <span>⭐</span>
                                </div>
                                <div className={`achievement-item ${achievements.bigSpender ? 'unlocked' : 'locked'}`} title="Big Spender: Spend ₹500+">
                                    <span>💎</span>
                                </div>
                                <div className={`achievement-item ${achievements.nightOwl ? 'unlocked' : 'locked'}`} title="Night Owl: Book after 8 PM">
                                    <span>🦉</span>
                                </div>
                            </div>
                        </div>

                        {/* Settings */}
                        <div className="glass-card settings-card">
                            <h3>Preferences</h3>
                            <div className="setting-row">
                                <div className="setting-label">
                                    <span>🔔</span> Notifications
                                </div>
                                <label className="toggle-switch">
                                    <input
                                        type="checkbox"
                                        checked={settings.notifications}
                                        onChange={() => toggleSetting('notifications')}
                                    />
                                    <span className="slider"></span>
                                </label>
                            </div>
                            <div className="setting-row">
                                <div className="setting-label">
                                    <span>🌙</span> Dark Mode
                                </div>
                                <label className="toggle-switch">
                                    <input
                                        type="checkbox"
                                        checked={settings.darkMode}
                                        onChange={() => toggleSetting('darkMode')}
                                    />
                                    <span className="slider"></span>
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Right Column - History */}
                    <div className="profile-right-col">
                        <div className="glass-card history-panel">
                            <div className="card-header-row">
                                <h3>Booking History</h3>
                                <div className="filter-tabs">
                                    <span
                                        className={historyFilter === 'all' ? 'active' : ''}
                                        onClick={() => setHistoryFilter('all')}
                                    >All</span>
                                    <span
                                        className={historyFilter === 'active' ? 'active' : ''}
                                        onClick={() => setHistoryFilter('active')}
                                    >Active</span>
                                    <span
                                        className={historyFilter === 'completed' ? 'active' : ''}
                                        onClick={() => setHistoryFilter('completed')}
                                    >Completed</span>
                                </div>
                            </div>

                            {getFilteredHistory().length > 0 ? (
                                <div className="enhanced-history-list">
                                    {getFilteredHistory().slice(0, 10).map((booking, index) => (
                                        <div key={index} className={`enhanced-history-item ${booking.status?.toLowerCase()}`}>
                                            <div className="history-time-col">
                                                <span className="history-date-day">
                                                    {new Date(booking.date).getDate()}
                                                </span>
                                                <span className="history-date-month">
                                                    {new Date(booking.date).toLocaleString('default', { month: 'short' })}
                                                </span>
                                            </div>
                                            <div className="history-info-col">
                                                <div className="history-slot-row">
                                                    <span className="history-slot-id">Slot {booking.slotId}</span>
                                                    <span className={`status-pill ${booking.status?.toLowerCase()}`}>{booking.status}</span>
                                                </div>
                                                <span className="history-time-detail">
                                                    {new Date(booking.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {booking.duration || 1} hour(s)
                                                </span>
                                            </div>
                                            <div className="history-action-col">
                                                <span className="history-price">₹{booking.cost}</span>
                                                {booking.status === 'BOOKED' && (
                                                    <button
                                                        className="mini-cancel-btn"
                                                        onClick={() => handleCancel(booking, userData.history.length - 1 - index)}
                                                    >
                                                        Cancel
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="empty-state-enhanced">
                                    <div className="empty-illustration">🏎️</div>
                                    <h4>No rides yet!</h4>
                                    <p>Your journey starts with a single booking.</p>
                                    <Link to="/book" className="primary-glow-btn">
                                        Find a Spot
                                    </Link>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Edit Vehicle Modal */}
            {isEditingVehicle && (
                <div className="modal-overlay" onClick={() => setIsEditingVehicle(false)}>
                    <div className="edit-modal" onClick={e => e.stopPropagation()}>
                        <h3>Edit Vehicle</h3>
                        <div className="modal-form">
                            <label>Vehicle Type</label>
                            <select
                                value={editVehicle.type}
                                onChange={e => setEditVehicle(prev => ({ ...prev, type: e.target.value }))}
                            >
                                <option value="Car">🚗 Car</option>
                                <option value="Bike">🏍️ Bike</option>
                                <option value="Truck">🚛 Truck</option>
                            </select>

                            <label>Vehicle Number</label>
                            <input
                                type="text"
                                value={editVehicle.number}
                                onChange={e => setEditVehicle(prev => ({ ...prev, number: e.target.value.toUpperCase() }))}
                                placeholder="AP01XY1234"
                            />

                            <div className="modal-actions">
                                <button className="cancel-btn" onClick={() => setIsEditingVehicle(false)}>Cancel</button>
                                <button className="save-btn" onClick={handleSaveVehicle}>Save Changes</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserProfile;
