import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, getDoc, query, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import api from '../api';
import ParkingMap from './ParkingMap';
import './AdminDashboard.css';

const AdminDashboard = () => {
    const [activeTab, setActiveTab] = useState('overview');
    const [slots, setSlots] = useState({});
    const [bookings, setBookings] = useState([]);
    const [users, setUsers] = useState([]);
    const [config, setConfig] = useState({ hourlyRate: 50 });
    const [newRate, setNewRate] = useState(50);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    // Stats
    const [stats, setStats] = useState({
        totalEarnings: 0,
        todayEarnings: 0,
        weekEarnings: 0,
        totalBookings: 0,
        activeBookings: 0,
        completedBookings: 0,
        cancelledBookings: 0,
        peakHour: null,
        avgDuration: 0
    });

    // Analytics
    const [analytics, setAnalytics] = useState({
        slotUtilization: {},
        hourlyDistribution: [],
        weeklyTrend: []
    });

    const navigate = useNavigate();

    // --- DATA FETCHING ---
    const fetchSlots = async () => {
        try {
            const response = await api.get('/parking/slots');
            if (response.data.success) {
                setSlots(response.data.data);
            }
        } catch (error) {
            console.error('Error fetching slots:', error);
        }
    };

    const fetchConfig = async () => {
        try {
            const response = await api.get('/parking/config');
            if (response.data.success) {
                setConfig(response.data.data);
                setNewRate(response.data.data.hourlyRate);
            }
        } catch (error) { console.error("Error fetching config", error); }
    };

    const fetchHistory = async () => {
        try {
            const q = query(collection(db, "bookings"), orderBy("createdAt", "desc"));
            const querySnapshot = await getDocs(q);
            const historyData = [];
            let totalEarn = 0, todayEarn = 0, weekEarn = 0;
            let activeCount = 0, completedCount = 0, cancelledCount = 0;
            const todayStr = new Date().toDateString();
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            const now = new Date();

            const hourCounts = {};
            const slotCounts = {};
            const expiredBookingsToUpdate = [];

            querySnapshot.forEach((docSnapshot) => {
                const data = docSnapshot.data();

                // Check if booking has expired (endTime passed but still marked BOOKED)
                const endTime = data.endTime ? new Date(data.endTime) : null;
                const status = (data.status || 'UNKNOWN').toUpperCase();
                const isExpired = endTime && now > endTime && ['BOOKED', 'RESERVED', 'OCCUPIED'].includes(status);

                if (isExpired) {
                    // Mark for update
                    expiredBookingsToUpdate.push({ id: docSnapshot.id, ...data });
                    // Treat as completed for stats
                    data.status = 'COMPLETED';
                }

                historyData.push({ id: docSnapshot.id, ...data, isExpired });

                // Earnings
                totalEarn += (data.cost || 0);
                const bookingDate = new Date(data.date);
                if (bookingDate.toDateString() === todayStr) todayEarn += (data.cost || 0);
                if (bookingDate >= weekAgo) weekEarn += (data.cost || 0);

                // Status counts (Case Insensitive) - use potentially updated status
                const currentStatus = (data.status || 'UNKNOWN').toUpperCase();

                if (['BOOKED', 'OCCUPIED', 'RESERVED'].includes(currentStatus)) activeCount++;
                else if (['COMPLETED', 'PAID', 'FINISHED'].includes(currentStatus)) completedCount++;
                else if (['CANCELLED', 'CANCELED', 'VOID'].includes(currentStatus)) cancelledCount++;
                else {
                    console.warn(`Uncategorized status found: ${currentStatus}`);
                }

                // Hour distribution
                const hour = bookingDate.getHours();
                hourCounts[hour] = (hourCounts[hour] || 0) + 1;

                // Slot utilization
                const slotId = data.slotId || 'Unknown';
                slotCounts[slotId] = (slotCounts[slotId] || 0) + 1;
            });

            // Auto-update expired bookings in Firebase
            if (expiredBookingsToUpdate.length > 0) {
                console.log(`[Admin] Auto-completing ${expiredBookingsToUpdate.length} expired booking(s)...`);
                for (const booking of expiredBookingsToUpdate) {
                    try {
                        const bookingRef = doc(db, "bookings", booking.id);
                        await updateDoc(bookingRef, {
                            status: 'COMPLETED',
                            autoCompleted: true,
                            completedAt: new Date().toISOString()
                        });

                        // Sync with User's history
                        if (booking.userId) {
                            try {
                                const userRef = doc(db, "users", booking.userId);
                                const userSnap = await getDoc(userRef);
                                if (userSnap.exists()) {
                                    const userData = userSnap.data();
                                    const history = userData.history || [];
                                    const updatedHistory = history.map(h => {
                                        // Match by slotId and rough time or just assume last booking for that slot?
                                        // Better to match by equality of properties if ID is not in history
                                        if (h.slotId === booking.slotId && h.date === booking.date) {
                                            return { ...h, status: 'COMPLETED' };
                                        }
                                        return h;
                                    });
                                    await updateDoc(userRef, { history: updatedHistory });
                                }
                            } catch (uErr) {
                                console.error(`Failed to sync user history for ${booking.userId}:`, uErr);
                            }
                        }

                        console.log(`[Admin] Booking ${booking.id} (Slot ${booking.slotId}) auto-completed & User synced.`);
                    } catch (err) {
                        console.error(`Failed to auto-complete booking ${booking.id}:`, err);
                    }
                }
            }

            // Find peak hour
            const peakHour = Object.keys(hourCounts).reduce((a, b) =>
                hourCounts[a] > hourCounts[b] ? a : b, null
            );

            setBookings(historyData);
            setStats({
                totalEarnings: totalEarn,
                todayEarnings: todayEarn,
                weekEarnings: weekEarn,
                totalBookings: historyData.length,
                activeBookings: activeCount,
                completedBookings: completedCount,
                cancelledBookings: cancelledCount,
                otherBookings: historyData.length - (activeCount + completedCount + cancelledCount),
                peakHour: peakHour ? `${peakHour}:00` : 'N/A',
                avgDuration: historyData.length > 0 ? (historyData.reduce((acc, b) => acc + (parseFloat(b.duration) || 1), 0) / historyData.length).toFixed(1) : 0
            });

            setAnalytics({
                slotUtilization: slotCounts,
                hourlyDistribution: hourCounts
            });

        } catch (error) { console.error("Error fetching history:", error); }
    };

    const fetchUsers = async () => {
        try {
            const querySnapshot = await getDocs(collection(db, "users"));
            const usersData = [];
            querySnapshot.forEach(doc => {
                usersData.push({ id: doc.id, ...doc.data() });
            });
            setUsers(usersData);
        } catch (err) { console.error("Error fetching users", err); }
    };

    useEffect(() => {
        fetchSlots();
        fetchHistory();
        fetchConfig();
        if (activeTab === 'users') fetchUsers();

        const interval = setInterval(() => {
            fetchSlots();
            fetchHistory();
        }, 5000);
        return () => clearInterval(interval);
    }, [activeTab]);

    // --- ACTIONS ---
    const handleLogout = () => {
        localStorage.removeItem('isAdmin');
        navigate('/login');
    };

    const handleUpdateRate = async () => {
        try {
            await api.post('/parking/config', { hourlyRate: newRate });
            alert("Pricing updated successfully!");
            fetchConfig();
        } catch (err) { alert("Failed to update pricing"); }
    };

    const updateStatus = async (slotId, status, action = null) => {
        try {
            await api.post('/parking/update-slot', { slotId, status, action });
            fetchSlots();
        } catch (error) {
            alert('Failed to update slot');
        }
    };

    const toggleUserBlock = async (userId, currentStatus) => {
        const userRef = doc(db, "users", userId);
        const newStatus = !currentStatus;
        try {
            await updateDoc(userRef, { disabled: newStatus });
            setUsers(users.map(u => u.id === userId ? { ...u, disabled: newStatus } : u));
        } catch (err) { console.error("Failed to block user", err); }
    };

    const exportToCSV = () => {
        const headers = ["Booking ID", "Date", "User Email", "Vehicle", "Slot", "Cost", "Status"];
        const rows = bookings.map(b => [
            b.id, new Date(b.date).toLocaleString(), b.userEmail, `${b.vehicleType}-${b.vehicleNumber}`, b.slotId, b.cost, b.status
        ]);

        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += headers.join(",") + "\r\n";
        rows.forEach(rowArray => {
            csvContent += rowArray.join(",") + "\r\n";
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `parking_history_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Filter bookings
    const filteredBookings = bookings.filter(b => {
        const matchesSearch = searchQuery === '' ||
            b.userEmail?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            b.vehicleNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            b.slotId?.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesStatus = statusFilter === 'all' ||
            b.status?.toLowerCase() === statusFilter.toLowerCase();

        return matchesSearch && matchesStatus;
    });

    // Calculate slot stats
    const totalSlots = Object.keys(slots).length;
    const occupiedSlots = Object.values(slots).filter(s => s.status === 'OCCUPIED' || s.isBooked).length;
    const freeSlots = totalSlots - occupiedSlots;
    const occupancyRate = totalSlots > 0 ? Math.round((occupiedSlots / totalSlots) * 100) : 0;

    return (
        <div className="admin-container">
            <header className="admin-header">
                <div className="header-title">
                    <h1>🛡️ Admin Command Center</h1>
                    <p>Real-time parking management & analytics</p>
                </div>
                <div className="header-tabs">
                    <button className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
                        📊 Overview
                    </button>
                    <button className={`tab-btn ${activeTab === 'analytics' ? 'active' : ''}`} onClick={() => setActiveTab('analytics')}>
                        📈 Analytics
                    </button>
                    <button className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}>
                        👥 Users
                    </button>
                    <button className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
                        ⚙️ Settings
                    </button>
                </div>
                <button className="logout-btn" onClick={handleLogout}>🚪 Logout</button>
            </header>

            {/* OVERVIEW TAB */}
            {activeTab === 'overview' && (
                <div className="tab-content">
                    {/* Stats Grid */}
                    <div className="stats-grid">
                        <div className="stat-card earnings">
                            <h3>Today's Revenue</h3>
                            <div className="value">₹{stats.todayEarnings.toLocaleString()}</div>
                            <div className="sub-text">
                                Weekly: ₹{stats.weekEarnings.toLocaleString()} • Total: ₹{stats.totalEarnings.toLocaleString()}
                            </div>
                            <div className="stat-icon-bg">💰</div>
                        </div>
                        <div className="stat-card bookings">
                            <h3>Bookings Overview</h3>
                            <div className="value">{stats.totalBookings}</div>
                            <div className="sub-text">
                                {stats.activeBookings} Active • {stats.completedBookings} Completed • {stats.cancelledBookings} Cancelled
                            </div>
                            <div className="stat-icon-bg">📋</div>
                        </div>
                        <div className="stat-card occupancy">
                            <h3>Live Occupancy</h3>
                            <div className="value">{occupiedSlots} / {totalSlots}</div>
                            <div className="sub-text">
                                {occupancyRate}% Full • {freeSlots} spots available
                            </div>
                            <div className="stat-icon-bg">🚗</div>
                        </div>
                    </div>

                    <div className="dashboard-content">
                        {/* Live Slots Panel - Enhanced Parking Map */}
                        <div className="section-panel live-panel">
                            {/* Beautiful SVG Parking Map */}
                            <ParkingMap slots={slots} onSlotClick={() => { }} />

                            {/* Admin Quick Controls */}
                            <div className="admin-controls-section">
                                <h4>🎛️ Admin Slot Controls</h4>
                                <div className="admin-slots-grid compact">
                                    {Object.values(slots).sort((a, b) => a.id.localeCompare(b.id)).map(slot => {
                                        const isOccupied = slot.status === 'OCCUPIED';
                                        const isBooked = slot.isBooked;
                                        const slotClass = isBooked ? 'booked' : slot.status.toLowerCase();

                                        return (
                                            <div key={slot.id} className={`admin-slot-card ${slotClass}`}>
                                                <span className="admin-slot-id">{slot.id}</span>
                                                <span className="admin-slot-status">
                                                    {isOccupied ? '🚗' : isBooked ? '📋' : '✓'}
                                                </span>
                                                <div className="slot-quick-actions">
                                                    <button
                                                        onClick={() => updateStatus(slot.id, 'FREE', 'force')}
                                                        className="quick-btn green"
                                                        title="Set Available"
                                                    >
                                                        ✓
                                                    </button>
                                                    <button
                                                        onClick={() => updateStatus(slot.id, 'OCCUPIED', 'force')}
                                                        className="quick-btn red"
                                                        title="Set Occupied"
                                                    >
                                                        🚗
                                                    </button>
                                                    <button
                                                        onClick={() => updateStatus(slot.id, 'FREE', 'reset')}
                                                        className="quick-btn blue"
                                                        title="Clear Booking"
                                                    >
                                                        ↺
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Booking History Panel */}
                        <div className="section-panel history-panel">
                            <div className="panel-header">
                                <h2>📜 Recent Bookings</h2>
                                <button className="export-btn" onClick={exportToCSV}>📥 Export CSV</button>
                            </div>

                            {/* Filters */}
                            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                                <input
                                    type="text"
                                    placeholder="🔍 Search by email, vehicle, slot..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    style={{
                                        flex: 1,
                                        padding: '10px 16px',
                                        background: '#0f0f1a',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '10px',
                                        color: 'white',
                                        fontSize: '0.9rem'
                                    }}
                                />
                                <select
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    style={{
                                        padding: '10px 16px',
                                        background: '#0f0f1a',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '10px',
                                        color: 'white',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <option value="all">All Status</option>
                                    <option value="booked">Booked</option>
                                    <option value="completed">Completed</option>
                                    <option value="cancelled">Cancelled</option>
                                </select>
                            </div>

                            <div className="table-wrapper">
                                <table className="history-table">
                                    <thead>
                                        <tr>
                                            <th>Booking Period</th>
                                            <th>User</th>
                                            <th>Vehicle</th>
                                            <th>Slot</th>
                                            <th>Duration</th>
                                            <th>Amount</th>
                                            <th>Status</th>
                                            <th>Expires</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredBookings.slice(0, 15).map(b => {
                                            // Calculate expiration status
                                            const endTime = b.endTime ? new Date(b.endTime) : null;
                                            const now = new Date();
                                            const isExpired = endTime && now > endTime;
                                            const timeRemaining = endTime ? endTime - now : null;

                                            // Format remaining time
                                            let expiresText = '--';
                                            if (b.status?.toUpperCase() === 'BOOKED' && endTime) {
                                                if (isExpired) {
                                                    expiresText = '⏰ Expired';
                                                } else if (timeRemaining) {
                                                    const hoursLeft = Math.floor(timeRemaining / (1000 * 60 * 60));
                                                    const minsLeft = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
                                                    expiresText = hoursLeft > 0 ? `${hoursLeft}h ${minsLeft}m` : `${minsLeft}m`;
                                                }
                                            } else if (b.status?.toUpperCase() === 'COMPLETED') {
                                                expiresText = '✅ Done';
                                            } else if (b.status?.toUpperCase() === 'CANCELLED') {
                                                expiresText = '❌ Cancelled';
                                            }

                                            return (
                                                <tr key={b.id}>
                                                    <td>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                            <span style={{ fontSize: '0.85rem' }}>
                                                                {b.startTime ? new Date(b.startTime).toLocaleDateString() : new Date(b.date).toLocaleDateString()}
                                                            </span>
                                                            <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                                                                {b.startTime ? new Date(b.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                                                                {' → '}
                                                                {b.endTime ? new Date(b.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.85rem' }}>
                                                        {b.userEmail}
                                                    </td>
                                                    <td className="vehicle-badge">{b.vehicleNumber}</td>
                                                    <td>
                                                        <span style={{
                                                            padding: '4px 12px',
                                                            background: 'rgba(249, 115, 22, 0.15)',
                                                            borderRadius: '6px',
                                                            fontFamily: 'monospace',
                                                            fontWeight: '600'
                                                        }}>
                                                            {b.slotId}
                                                        </span>
                                                    </td>
                                                    <td style={{ fontSize: '0.85rem' }}>
                                                        <span style={{ color: '#60a5fa' }}>{parseFloat(b.duration || 1).toFixed(1)}h</span>
                                                    </td>
                                                    <td className="cost-cell">₹{b.cost}</td>
                                                    <td><span className={`status-pill ${b.status?.toLowerCase()}`}>{b.status}</span></td>
                                                    <td>
                                                        <span style={{
                                                            fontSize: '0.8rem',
                                                            color: isExpired ? '#f87171' : (b.status?.toUpperCase() === 'BOOKED' ? '#4ade80' : '#94a3b8'),
                                                            fontWeight: isExpired ? '600' : '400'
                                                        }}>
                                                            {expiresText}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                                {filteredBookings.length === 0 && (
                                    <div className="no-data">
                                        <div className="no-data-icon">📭</div>
                                        <p>No bookings found matching your criteria</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ANALYTICS TAB */}
            {activeTab === 'analytics' && (
                <div className="tab-content">
                    <div className="stats-grid">
                        <div className="stat-card earnings">
                            <h3>Average Booking Value</h3>
                            <div className="value">₹{stats.totalBookings > 0 ? Math.round(stats.totalEarnings / stats.totalBookings) : 0}</div>
                            <div className="sub-text">Per booking average</div>
                        </div>
                        <div className="stat-card bookings">
                            <h3>Peak Hour</h3>
                            <div className="value">{stats.peakHour}</div>
                            <div className="sub-text">Most bookings occur around this time</div>
                        </div>
                        <div className="stat-card occupancy">
                            <h3>Avg. Parking Duration</h3>
                            <div className="value">{stats.avgDuration} hrs</div>
                            <div className="sub-text">Average time per booking</div>
                        </div>
                    </div>

                    <div className="analytics-row">
                        {/* Booking Status Distribution */}
                        <div className="analytics-card">
                            <h4>📊 Booking Status Distribution</h4>
                            <div className="progress-bar-container">
                                {stats.totalBookings > 0 ? (
                                    <>
                                        <div className="progress-item">
                                            <span className="progress-label">Completed</span>
                                            <div className="progress-bar">
                                                <div
                                                    className="progress-fill success"
                                                    style={{ width: `${(stats.completedBookings / stats.totalBookings) * 100}%` }}
                                                ></div>
                                            </div>
                                            <span className="progress-value">{stats.completedBookings}</span>
                                        </div>
                                        <div className="progress-item">
                                            <span className="progress-label">Active</span>
                                            <div className="progress-bar">
                                                <div
                                                    className="progress-fill warning"
                                                    style={{ width: `${(stats.activeBookings / stats.totalBookings) * 100}%` }}
                                                ></div>
                                            </div>
                                            <span className="progress-value">{stats.activeBookings}</span>
                                        </div>
                                        <div className="progress-item">
                                            <span className="progress-label">Cancelled</span>
                                            <div className="progress-bar">
                                                <div
                                                    className="progress-fill danger"
                                                    style={{ width: `${(stats.cancelledBookings / stats.totalBookings) * 100}%` }}
                                                ></div>
                                            </div>
                                            <span className="progress-value">{stats.cancelledBookings}</span>
                                        </div>
                                        {stats.otherBookings > 0 && (
                                            <div className="progress-item">
                                                <span className="progress-label">Other</span>
                                                <div className="progress-bar">
                                                    <div
                                                        className="progress-fill"
                                                        style={{ width: `${(stats.otherBookings / stats.totalBookings) * 100}%`, background: '#94a3b8' }}
                                                    ></div>
                                                </div>
                                                <span className="progress-value">{stats.otherBookings}</span>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="no-data-chart">
                                        <p>No booking history available</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Slot Utilization */}
                        <div className="analytics-card">
                            <h4>🅿️ Slot Utilization</h4>
                            <div className="progress-bar-container">
                                {Object.entries(analytics.slotUtilization)
                                    .sort((a, b) => b[1] - a[1])
                                    .slice(0, 5)
                                    .map(([slotId, count]) => (
                                        <div key={slotId} className="progress-item">
                                            <span className="progress-label">{slotId}</span>
                                            <div className="progress-bar">
                                                <div
                                                    className="progress-fill success"
                                                    style={{
                                                        width: `${(count / Math.max(...Object.values(analytics.slotUtilization))) * 100}%`
                                                    }}
                                                ></div>
                                            </div>
                                            <span className="progress-value">{count}</span>
                                        </div>
                                    ))}
                                {Object.keys(analytics.slotUtilization).length === 0 && (
                                    <p style={{ color: '#64748b', textAlign: 'center' }}>No utilization data yet</p>
                                )}
                            </div>
                        </div>

                        {/* Revenue Stats */}
                        <div className="analytics-card">
                            <h4>💰 Revenue Summary</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: '#0f0f1a', borderRadius: '10px' }}>
                                    <span style={{ color: '#94a3b8' }}>Today</span>
                                    <span style={{ fontWeight: '700', color: '#4ade80', fontSize: '1.2rem' }}>₹{stats.todayEarnings.toLocaleString()}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: '#0f0f1a', borderRadius: '10px' }}>
                                    <span style={{ color: '#94a3b8' }}>This Week</span>
                                    <span style={{ fontWeight: '700', color: '#60a5fa', fontSize: '1.2rem' }}>₹{stats.weekEarnings.toLocaleString()}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: '#0f0f1a', borderRadius: '10px' }}>
                                    <span style={{ color: '#94a3b8' }}>All Time</span>
                                    <span style={{ fontWeight: '700', color: '#a78bfa', fontSize: '1.2rem' }}>₹{stats.totalEarnings.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>

                        {/* Quick Stats */}
                        <div className="analytics-card">
                            <h4>⚡ Quick Stats</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div style={{ textAlign: 'center', padding: '20px', background: '#0f0f1a', borderRadius: '12px' }}>
                                    <div style={{ fontSize: '2rem', fontWeight: '700', color: '#a78bfa' }}>
                                        {stats.totalBookings > 0 ? Math.round((stats.completedBookings / stats.totalBookings) * 100) : 0}%
                                    </div>
                                    <div style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '4px' }}>Completion Rate</div>
                                </div>
                                <div style={{ textAlign: 'center', padding: '20px', background: '#0f0f1a', borderRadius: '12px' }}>
                                    <div style={{ fontSize: '2rem', fontWeight: '700', color: '#f59e0b' }}>
                                        {occupancyRate}%
                                    </div>
                                    <div style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '4px' }}>Current Occupancy</div>
                                </div>
                                <div style={{ textAlign: 'center', padding: '20px', background: '#0f0f1a', borderRadius: '12px' }}>
                                    <div style={{ fontSize: '2rem', fontWeight: '700', color: '#10b981' }}>
                                        {users.length}
                                    </div>
                                    <div style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '4px' }}>Total Users</div>
                                </div>
                                <div style={{ textAlign: 'center', padding: '20px', background: '#0f0f1a', borderRadius: '12px' }}>
                                    <div style={{ fontSize: '2rem', fontWeight: '700', color: '#ef4444' }}>
                                        {stats.cancelledBookings}
                                    </div>
                                    <div style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '4px' }}>Cancellations</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* USERS TAB */}
            {activeTab === 'users' && (
                <div className="tab-content">
                    <div className="section-panel">
                        <div className="users-header">
                            <h2>👥 Registered Users</h2>
                            <div className="users-stats">
                                <div className="user-stat">
                                    <span className="user-stat-value">{users.length}</span>
                                    <span className="user-stat-label">Total Users</span>
                                </div>
                                <div className="user-stat">
                                    <span className="user-stat-value">{users.filter(u => !u.disabled).length}</span>
                                    <span className="user-stat-label">Active Users</span>
                                </div>
                            </div>
                        </div>
                        <div className="table-wrapper">
                            <table className="history-table">
                                <thead>
                                    <tr>
                                        <th>User</th>
                                        <th>Vehicle</th>
                                        <th>Joined</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map(u => (
                                        <tr key={u.id}>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    <div style={{
                                                        width: '40px',
                                                        height: '40px',
                                                        background: 'linear-gradient(135deg, #f97316, #fbbf24)',
                                                        borderRadius: '10px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontWeight: '700',
                                                        fontSize: '1rem'
                                                    }}>
                                                        {u.email?.charAt(0).toUpperCase()}
                                                    </div>
                                                    <span>{u.email}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <span className="vehicle-badge">{u.vehicleType} • {u.vehicleNumber}</span>
                                            </td>
                                            <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                                            <td>
                                                <span className={`status-pill ${u.disabled ? 'cancelled' : 'completed'}`}>
                                                    {u.disabled ? '🚫 BLOCKED' : '✅ ACTIVE'}
                                                </span>
                                            </td>
                                            <td>
                                                <button
                                                    className={`admin-btn ${u.disabled ? 'btn-unblock' : 'btn-occupy'}`}
                                                    onClick={() => toggleUserBlock(u.id, u.disabled)}
                                                >
                                                    {u.disabled ? '✓ Unblock' : '🚫 Block'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {users.length === 0 && (
                                <div className="no-data">
                                    <div className="no-data-icon">👥</div>
                                    <p>No users registered yet</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* SETTINGS TAB */}
            {activeTab === 'settings' && (
                <div className="tab-content">
                    <div className="settings-grid">
                        <div className="settings-card">
                            <h3>💰 Pricing Configuration</h3>
                            <div className="form-group">
                                <label>Base Hourly Parking Rate (₹)</label>
                                <input
                                    type="number"
                                    value={newRate}
                                    onChange={(e) => setNewRate(e.target.value)}
                                    min="1"
                                />
                            </div>
                            <button className="auth-btn" onClick={handleUpdateRate}>
                                💾 Update Pricing
                            </button>

                            <div className="config-info">
                                <h3>Current Settings</h3>
                                <p><strong>Hourly Rate:</strong> ₹{config.hourlyRate}</p>
                                <p><strong>Total Slots:</strong> {totalSlots}</p>
                                <p><strong>System Version:</strong> 2.0.0 (Premium)</p>
                            </div>
                        </div>

                        <div className="settings-card">
                            <h3>📊 System Statistics</h3>
                            <div className="config-info" style={{ marginTop: 0 }}>
                                <p><strong>Total Users:</strong> {users.length}</p>
                                <p><strong>Total Bookings:</strong> {stats.totalBookings}</p>
                                <p><strong>Total Revenue:</strong> ₹{stats.totalEarnings.toLocaleString()}</p>
                                <p><strong>Active Bookings:</strong> {stats.activeBookings}</p>
                                <p><strong>Completion Rate:</strong> {stats.totalBookings > 0 ? Math.round((stats.completedBookings / stats.totalBookings) * 100) : 0}%</p>
                            </div>

                            <button
                                className="auth-btn"
                                onClick={exportToCSV}
                                style={{ marginTop: '20px', background: 'linear-gradient(135deg, #f97316, #ea580c)' }}
                            >
                                📥 Download Full Report
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminDashboard;
