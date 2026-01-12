import React, { useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import { doc, getDoc, collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { useNavigate, Link } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import './UserDashboard.css';

const UserDashboard = () => {
    const [userData, setUserData] = useState(null);
    const [bookings, setBookings] = useState([]);
    const [stats, setStats] = useState({
        totalBookings: 0,
        totalSpent: 0,
        activeBookings: 0,
        cancelledBookings: 0,
        completedBookings: 0,
        averageDuration: 0,
        favoriteSlot: null,
        peakHour: null,
        monthlySpend: []
    });
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview');
    const navigate = useNavigate();

    useEffect(() => {
        const fetchUserData = async () => {
            if (!auth.currentUser) {
                navigate('/login');
                return;
            }

            try {
                // Fetch user profile
                const docRef = doc(db, "users", auth.currentUser.uid);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setUserData(data);

                    // Process history for analytics
                    const history = data.history || [];
                    setBookings(history);
                    calculateStats(history);
                }
            } catch (error) {
                console.error("Error fetching data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchUserData();
    }, [navigate]);

    const calculateStats = (history) => {
        if (!history || history.length === 0) {
            setStats({
                totalBookings: 0,
                totalSpent: 0,
                activeBookings: 0,
                cancelledBookings: 0,
                completedBookings: 0,
                averageDuration: 0,
                favoriteSlot: null,
                peakHour: null,
                monthlySpend: []
            });
            return;
        }

        const totalBookings = history.length;
        const totalSpent = history.reduce((acc, b) => acc + (b.cost || 0), 0);
        const activeBookings = history.filter(b => b.status === 'BOOKED' || b.status === 'OCCUPIED').length;
        const cancelledBookings = history.filter(b => b.status === 'CANCELLED').length;
        const completedBookings = history.filter(b => b.status === 'COMPLETED').length;

        // Calculate average duration (assuming duration in hours based on cost)
        const avgDuration = totalBookings > 0 ? (history.reduce((acc, b) => acc + (b.duration || 1), 0) / totalBookings).toFixed(1) : 0;

        // Find favorite slot
        const slotCounts = {};
        history.forEach(b => {
            slotCounts[b.slotId] = (slotCounts[b.slotId] || 0) + 1;
        });
        const favoriteSlot = Object.keys(slotCounts).reduce((a, b) => slotCounts[a] > slotCounts[b] ? a : b, null);

        // Calculate monthly spending (last 6 months)
        const monthlyData = {};
        const now = new Date();
        for (let i = 5; i >= 0; i--) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = date.toLocaleDateString('en-US', { month: 'short' });
            monthlyData[key] = 0;
        }

        history.forEach(b => {
            const date = new Date(b.date);
            const key = date.toLocaleDateString('en-US', { month: 'short' });
            if (monthlyData.hasOwnProperty(key)) {
                monthlyData[key] += (b.cost || 0);
            }
        });

        // Find peak booking hour
        const hourCounts = {};
        history.forEach(b => {
            const hour = new Date(b.date).getHours();
            hourCounts[hour] = (hourCounts[hour] || 0) + 1;
        });
        const peakHour = Object.keys(hourCounts).reduce((a, b) => hourCounts[a] > hourCounts[b] ? a : b, null);

        setStats({
            totalBookings,
            totalSpent,
            activeBookings,
            cancelledBookings,
            completedBookings,
            averageDuration: avgDuration,
            favoriteSlot,
            peakHour: peakHour ? `${peakHour}:00` : null,
            monthlySpend: Object.entries(monthlyData)
        });
    };

    const handleLogout = async () => {
        try {
            await signOut(auth);
            navigate('/login');
        } catch (error) {
            console.error('Error logging out:', error);
        }
    };

    const handleCancel = async (booking, index) => {
        if (!window.confirm("Are you sure you want to cancel this booking?")) return;

        try {
            const api = (await import('../api')).default;
            await api.post('/parking/cancel', { slotId: booking.slotId });

            const { updateDoc, doc } = await import('firebase/firestore');
            const newHistory = [...userData.history];
            newHistory[index] = { ...newHistory[index], status: 'CANCELLED' };

            const userRef = doc(db, "users", auth.currentUser.uid);
            await updateDoc(userRef, { history: newHistory });

            setUserData(prev => ({ ...prev, history: newHistory }));
            setBookings(newHistory);
            calculateStats(newHistory);
            alert("Booking cancelled successfully.");
        } catch (error) {
            console.error("Cancellation failed:", error);
            alert("Failed to cancel booking.");
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'BOOKED': return '🎫';
            case 'OCCUPIED': return '🚗';
            case 'COMPLETED': return '✅';
            case 'CANCELLED': return '❌';
            default: return '📋';
        }
    };

    const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // Get max value for chart scaling
    const maxMonthlySpend = Math.max(...stats.monthlySpend.map(([_, val]) => val), 1);

    if (loading) {
        return (
            <div className="dashboard-loading">
                <div className="loading-spinner"></div>
                <p>Loading your dashboard...</p>
            </div>
        );
    }

    return (
        <div className="user-dashboard">
            {/* Header */}
            <header className="dashboard-header">
                <div className="header-left">
                    <div className="logo">
                        <span className="logo-icon">🅿️</span>
                        <h1>Smart Parking</h1>
                    </div>
                </div>
                <nav className="header-nav">
                    <Link to="/" className="nav-link active">
                        <span className="nav-icon">📊</span>
                        Dashboard
                    </Link>
                    <Link to="/book" className="nav-link">
                        <span className="nav-icon">🎫</span>
                        Book Now
                    </Link>
                </nav>
                <div className="header-right">
                    <div className="user-info">
                        <div className="user-avatar">
                            {userData?.email?.charAt(0).toUpperCase()}
                        </div>
                        <div className="user-details">
                            <span className="user-email">{userData?.email}</span>
                            <span className="user-vehicle">{userData?.vehicleNumber}</span>
                        </div>
                    </div>
                    <button className="logout-btn" onClick={handleLogout}>
                        <span>🚪</span> Logout
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <main className="dashboard-main">
                {/* Welcome Section */}
                <section className="welcome-section">
                    <div className="welcome-content">
                        <h2>Welcome back! 👋</h2>
                        <p>Here's your parking activity overview</p>
                    </div>
                    <Link to="/book" className="quick-book-btn">
                        <span>➕</span> Book a Spot
                    </Link>
                </section>

                {/* Stats Cards */}
                <section className="stats-section">
                    <div className="stat-card primary">
                        <div className="stat-icon">📊</div>
                        <div className="stat-content">
                            <span className="stat-value">{stats.totalBookings}</span>
                            <span className="stat-label">Total Bookings</span>
                        </div>
                        <div className="stat-trend up">
                            <span>↑ All Time</span>
                        </div>
                    </div>
                    <div className="stat-card success">
                        <div className="stat-icon">💰</div>
                        <div className="stat-content">
                            <span className="stat-value">₹{stats.totalSpent}</span>
                            <span className="stat-label">Total Spent</span>
                        </div>
                        <div className="stat-trend">
                            <span>Avg: ₹{stats.totalBookings > 0 ? Math.round(stats.totalSpent / stats.totalBookings) : 0}/booking</span>
                        </div>
                    </div>
                    <div className="stat-card warning">
                        <div className="stat-icon">🎯</div>
                        <div className="stat-content">
                            <span className="stat-value">{stats.activeBookings}</span>
                            <span className="stat-label">Active Bookings</span>
                        </div>
                        <div className="stat-trend">
                            <span>{stats.completedBookings} completed</span>
                        </div>
                    </div>
                    <div className="stat-card info">
                        <div className="stat-icon">⭐</div>
                        <div className="stat-content">
                            <span className="stat-value">{stats.favoriteSlot || 'N/A'}</span>
                            <span className="stat-label">Favorite Slot</span>
                        </div>
                        {stats.peakHour && (
                            <div className="stat-trend">
                                <span>Peak: {stats.peakHour}</span>
                            </div>
                        )}
                    </div>
                </section>

                {/* Dashboard Tabs */}
                <div className="tab-navigation">
                    <button
                        className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
                        onClick={() => setActiveTab('overview')}
                    >
                        <span>📈</span> Overview
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
                        onClick={() => setActiveTab('history')}
                    >
                        <span>📜</span> History
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
                        onClick={() => setActiveTab('analytics')}
                    >
                        <span>📊</span> Analytics
                    </button>
                </div>

                {/* Tab Content */}
                <div className="tab-content">
                    {activeTab === 'overview' && (
                        <div className="overview-grid">
                            {/* Recent Bookings */}
                            <div className="panel recent-bookings">
                                <div className="panel-header">
                                    <h3>🕐 Recent Bookings</h3>
                                    <button className="view-all-btn" onClick={() => setActiveTab('history')}>
                                        View All →
                                    </button>
                                </div>
                                <div className="booking-list">
                                    {bookings.slice(0, 5).map((booking, index) => (
                                        <div key={index} className={`booking-item ${booking.status?.toLowerCase()}`}>
                                            <div className="booking-icon">
                                                {getStatusIcon(booking.status)}
                                            </div>
                                            <div className="booking-info">
                                                <span className="booking-slot">Slot {booking.slotId}</span>
                                                <span className="booking-date">{formatDate(booking.date)}</span>
                                            </div>
                                            <div className="booking-amount">
                                                <span className="amount">₹{booking.cost}</span>
                                                <span className={`status-badge ${booking.status?.toLowerCase()}`}>
                                                    {booking.status}
                                                </span>
                                            </div>
                                            {booking.status === 'BOOKED' && (
                                                <button
                                                    className="cancel-mini-btn"
                                                    onClick={() => handleCancel(booking, index)}
                                                >
                                                    Cancel
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                    {bookings.length === 0 && (
                                        <div className="empty-state">
                                            <span className="empty-icon">🚗</span>
                                            <p>No bookings yet. Book your first spot!</p>
                                            <Link to="/book" className="empty-cta">Book Now</Link>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Quick Stats */}
                            <div className="panel quick-insights">
                                <div className="panel-header">
                                    <h3>💡 Quick Insights</h3>
                                </div>
                                <div className="insights-list">
                                    <div className="insight-item">
                                        <div className="insight-icon">🏆</div>
                                        <div className="insight-content">
                                            <span className="insight-label">Favorite Slot</span>
                                            <span className="insight-value">{stats.favoriteSlot || 'Book to find out!'}</span>
                                        </div>
                                    </div>
                                    <div className="insight-item">
                                        <div className="insight-icon">⏰</div>
                                        <div className="insight-content">
                                            <span className="insight-label">Peak Booking Time</span>
                                            <span className="insight-value">{stats.peakHour || 'N/A'}</span>
                                        </div>
                                    </div>
                                    <div className="insight-item">
                                        <div className="insight-icon">📅</div>
                                        <div className="insight-content">
                                            <span className="insight-label">Average Duration</span>
                                            <span className="insight-value">{stats.averageDuration} hrs</span>
                                        </div>
                                    </div>
                                    <div className="insight-item">
                                        <div className="insight-icon">✅</div>
                                        <div className="insight-content">
                                            <span className="insight-label">Completion Rate</span>
                                            <span className="insight-value">
                                                {stats.totalBookings > 0
                                                    ? Math.round((stats.completedBookings / stats.totalBookings) * 100)
                                                    : 0}%
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Spending Chart */}
                            <div className="panel spending-chart">
                                <div className="panel-header">
                                    <h3>💳 Monthly Spending</h3>
                                </div>
                                <div className="chart-container">
                                    <div className="bar-chart">
                                        {stats.monthlySpend.map(([month, amount], index) => (
                                            <div key={month} className="bar-item">
                                                <div
                                                    className="bar"
                                                    style={{ height: `${(amount / maxMonthlySpend) * 100}%` }}
                                                >
                                                    <span className="bar-value">₹{amount}</span>
                                                </div>
                                                <span className="bar-label">{month}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'history' && (
                        <div className="history-container">
                            <div className="panel full-width">
                                <div className="panel-header">
                                    <h3>📜 Complete Booking History</h3>
                                    <div className="history-filters">
                                        <span className="filter-label">Filter:</span>
                                        <select className="filter-select">
                                            <option value="all">All Bookings</option>
                                            <option value="completed">Completed</option>
                                            <option value="active">Active</option>
                                            <option value="cancelled">Cancelled</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="history-table-wrapper">
                                    <table className="history-table">
                                        <thead>
                                            <tr>
                                                <th>Date & Time</th>
                                                <th>Slot</th>
                                                <th>Duration</th>
                                                <th>Amount</th>
                                                <th>Status</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {bookings.map((booking, index) => (
                                                <tr key={index} className={booking.status?.toLowerCase()}>
                                                    <td>
                                                        <div className="date-cell">
                                                            <span className="date-main">{new Date(booking.date).toLocaleDateString()}</span>
                                                            <span className="date-sub">{new Date(booking.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <span className="slot-badge">{booking.slotId}</span>
                                                    </td>
                                                    <td>{booking.duration || 1} hr(s)</td>
                                                    <td className="amount-cell">₹{booking.cost}</td>
                                                    <td>
                                                        <span className={`status-pill ${booking.status?.toLowerCase()}`}>
                                                            {getStatusIcon(booking.status)} {booking.status}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        {booking.status === 'BOOKED' && (
                                                            <button
                                                                className="action-btn cancel"
                                                                onClick={() => handleCancel(booking, index)}
                                                            >
                                                                Cancel
                                                            </button>
                                                        )}
                                                        {booking.status === 'COMPLETED' && (
                                                            <button className="action-btn rebook">
                                                                Rebook
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {bookings.length === 0 && (
                                        <div className="empty-state large">
                                            <span className="empty-icon">📋</span>
                                            <h4>No booking history</h4>
                                            <p>Your booking history will appear here once you make your first reservation.</p>
                                            <Link to="/book" className="empty-cta">Make First Booking</Link>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'analytics' && (
                        <div className="analytics-grid">
                            {/* Booking Distribution */}
                            <div className="panel booking-distribution">
                                <div className="panel-header">
                                    <h3>📊 Booking Status Distribution</h3>
                                </div>
                                <div className="donut-chart">
                                    <div className="donut-visual">
                                        <div className="donut-center">
                                            <span className="donut-value">{stats.totalBookings}</span>
                                            <span className="donut-label">Total</span>
                                        </div>
                                    </div>
                                    <div className="donut-legend">
                                        <div className="legend-item completed">
                                            <span className="legend-color"></span>
                                            <span className="legend-label">Completed</span>
                                            <span className="legend-value">{stats.completedBookings}</span>
                                        </div>
                                        <div className="legend-item active">
                                            <span className="legend-color"></span>
                                            <span className="legend-label">Active</span>
                                            <span className="legend-value">{stats.activeBookings}</span>
                                        </div>
                                        <div className="legend-item cancelled">
                                            <span className="legend-color"></span>
                                            <span className="legend-label">Cancelled</span>
                                            <span className="legend-value">{stats.cancelledBookings}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Usage Patterns */}
                            <div className="panel usage-patterns">
                                <div className="panel-header">
                                    <h3>⏰ Usage Patterns</h3>
                                </div>
                                <div className="pattern-stats">
                                    <div className="pattern-item">
                                        <div className="pattern-icon">🌅</div>
                                        <div className="pattern-info">
                                            <span className="pattern-title">Most Active Period</span>
                                            <span className="pattern-value">{stats.peakHour ? `Around ${stats.peakHour}` : 'Not enough data'}</span>
                                        </div>
                                    </div>
                                    <div className="pattern-item">
                                        <div className="pattern-icon">📍</div>
                                        <div className="pattern-info">
                                            <span className="pattern-title">Preferred Slot</span>
                                            <span className="pattern-value">{stats.favoriteSlot || 'Not enough data'}</span>
                                        </div>
                                    </div>
                                    <div className="pattern-item">
                                        <div className="pattern-icon">⏱️</div>
                                        <div className="pattern-info">
                                            <span className="pattern-title">Avg Parking Time</span>
                                            <span className="pattern-value">{stats.averageDuration} hours</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Spending Trend */}
                            <div className="panel spending-trend full-width">
                                <div className="panel-header">
                                    <h3>📈 6-Month Spending Trend</h3>
                                </div>
                                <div className="trend-chart">
                                    <div className="trend-bars">
                                        {stats.monthlySpend.map(([month, amount], index) => (
                                            <div key={month} className="trend-bar-container">
                                                <div className="trend-amount">₹{amount}</div>
                                                <div
                                                    className="trend-bar"
                                                    style={{
                                                        height: `${Math.max((amount / maxMonthlySpend) * 150, 5)}px`,
                                                        background: `linear-gradient(180deg, #fb923c ${0}%, #f97316 ${100}%)`
                                                    }}
                                                ></div>
                                                <div className="trend-label">{month}</div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="trend-summary">
                                        <div className="summary-item">
                                            <span className="summary-value">₹{stats.totalSpent}</span>
                                            <span className="summary-label">Total Spent</span>
                                        </div>
                                        <div className="summary-item">
                                            <span className="summary-value">₹{stats.totalBookings > 0 ? Math.round(stats.totalSpent / 6) : 0}</span>
                                            <span className="summary-label">Monthly Avg</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default UserDashboard;
