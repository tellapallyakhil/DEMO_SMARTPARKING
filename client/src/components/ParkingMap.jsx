import React, { useEffect, useState } from 'react';
import api from '../api';
import './ParkingMap.css';

const ParkingMap = ({ slots, onSlotClick }) => {
    const [graph, setGraph] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLayout = async () => {
            try {
                const response = await api.get('/parking/layout');
                if (response.data.success) {
                    setGraph(response.data.data);
                }
            } catch (error) {
                console.error('Error fetching layout:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchLayout();
    }, []);

    // Calculate slot statistics
    const slotList = Object.values(slots).filter(s => s.id?.startsWith('S'));
    const totalSlots = slotList.length;
    const freeSlots = slotList.filter(s => s.status === 'FREE' && !s.isBooked).length;
    const bookedSlots = slotList.filter(s => s.isBooked).length;
    const occupiedSlots = slotList.filter(s => s.status === 'OCCUPIED').length;
    const occupancyRate = totalSlots > 0 ? Math.round(((bookedSlots + occupiedSlots) / totalSlots) * 100) : 0;

    if (loading) return <div className="map-loading">Loading Map...</div>;
    if (!graph) return <div className="map-error">Failed to load map layout</div>;

    const { nodes, adjacencyList } = graph;
    const nodeList = Object.values(nodes);

    const edges = [];
    const seenEdges = new Set();

    Object.keys(adjacencyList).forEach(fromNode => {
        adjacencyList[fromNode].forEach(({ node: toNode }) => {
            const edgeKey = [fromNode, toNode].sort().join('-');
            if (!seenEdges.has(edgeKey)) {
                seenEdges.add(edgeKey);
                edges.push({ from: fromNode, to: toNode });
            }
        });
    });

    const getSlotStatus = (slotId) => {
        const slot = slots[slotId];
        if (!slot) return 'unknown';
        if (slot.isBooked) return 'booked';
        if (slot.status === 'OCCUPIED') return 'occupied';
        if (slot.status === 'FREE') return 'free';
        return 'unknown';
    };

    const getSlotColor = (slotId) => {
        const status = getSlotStatus(slotId);
        switch (status) {
            case 'free': return '#22c55e';      // Green for available
            case 'occupied': return '#ef4444';  // Red for in-use
            case 'booked': return '#f97316';    // Orange for reserved
            default: return '#64748b';
        }
    };

    return (
        <div className="parking-map-container">
            {/* Header with Stats */}
            <div className="map-header">
                <h3>🗺️ Live Parking Map</h3>
                <div className="live-badge">
                    <span className="pulse-dot"></span>
                    <span>LIVE</span>
                </div>
            </div>

            {/* Quick Stats Bar */}
            <div className="stats-bar">
                <div className="stat-item available">
                    <span className="stat-dot"></span>
                    <span className="stat-label">Available</span>
                    <span className="stat-value">{freeSlots}</span>
                </div>
                <div className="stat-item reserved">
                    <span className="stat-dot"></span>
                    <span className="stat-label">Reserved</span>
                    <span className="stat-value">{bookedSlots}</span>
                </div>
                <div className="stat-item occupied">
                    <span className="stat-dot"></span>
                    <span className="stat-label">In Use</span>
                    <span className="stat-value">{occupiedSlots}</span>
                </div>
            </div>

            {/* SVG Map */}
            <div className="svg-wrapper">
                <svg viewBox="0 0 700 550" className="parking-svg">
                    {/* Gradient Definitions */}
                    <defs>
                        <linearGradient id="freeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#22c55e" />
                            <stop offset="100%" stopColor="#4ade80" />
                        </linearGradient>
                        <linearGradient id="occupiedGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#ef4444" />
                            <stop offset="100%" stopColor="#f87171" />
                        </linearGradient>
                        <linearGradient id="bookedGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#f59e0b" />
                            <stop offset="100%" stopColor="#fbbf24" />
                        </linearGradient>
                        <filter id="glow">
                            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                            <feMerge>
                                <feMergeNode in="coloredBlur" />
                                <feMergeNode in="SourceGraphic" />
                            </feMerge>
                        </filter>
                    </defs>

                    {/* Roads */}
                    {edges.map((edge, idx) => {
                        const n1 = nodes[edge.from].coordinates;
                        const n2 = nodes[edge.to].coordinates;
                        return (
                            <g key={idx}>
                                {/* Road base */}
                                <line
                                    x1={n1.x} y1={n1.y}
                                    x2={n2.x} y2={n2.y}
                                    stroke="#1e293b"
                                    strokeWidth="18"
                                    strokeLinecap="round"
                                />
                                {/* Road center line */}
                                <line
                                    x1={n1.x} y1={n1.y}
                                    x2={n2.x} y2={n2.y}
                                    stroke="#fbbf24"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeDasharray="10 8"
                                    opacity="0.5"
                                />
                            </g>
                        );
                    })}

                    {/* Nodes */}
                    {nodeList.map((node) => {
                        const isSlot = node.type === 'SLOT';
                        const isEntrance = node.type === 'ENTRANCE';
                        const slot = slots[node.id];
                        const slotStatus = getSlotStatus(node.id);
                        const isFree = slotStatus === 'free';

                        return (
                            <g
                                key={node.id}
                                onClick={() => isSlot && slot && isFree && onSlotClick(slot)}
                                className={isSlot ? 'map-slot' : ''}
                                style={{ cursor: isSlot && isFree ? 'pointer' : 'default' }}
                            >
                                {isSlot ? (
                                    <>
                                        {/* Slot Glow Effect for free slots */}
                                        {isFree && (
                                            <rect
                                                x={node.coordinates.x - 30}
                                                y={node.coordinates.y - 30}
                                                width="60"
                                                height="60"
                                                rx="12"
                                                fill="none"
                                                stroke="#14b8a6"
                                                strokeWidth="2"
                                                opacity="0.3"
                                                filter="url(#glow)"
                                            />
                                        )}
                                        {/* Slot Shape */}
                                        <rect
                                            x={node.coordinates.x - 28}
                                            y={node.coordinates.y - 28}
                                            width="56"
                                            height="56"
                                            rx="10"
                                            fill={
                                                slotStatus === 'free' ? 'url(#freeGradient)' :
                                                    slotStatus === 'occupied' ? 'url(#occupiedGradient)' :
                                                        slotStatus === 'booked' ? 'url(#bookedGradient)' : '#64748b'
                                            }
                                            stroke="rgba(255,255,255,0.2)"
                                            strokeWidth="2"
                                            className="slot-rect"
                                        />
                                        {/* Status Icon */}
                                        <text
                                            x={node.coordinates.x}
                                            y={node.coordinates.y - 2}
                                            textAnchor="middle"
                                            fontSize="22"
                                            fill="white"
                                            style={{ pointerEvents: 'none' }}
                                        >
                                            {slotStatus === 'occupied' ? '🚗' : slotStatus === 'booked' ? '📋' : '✓'}
                                        </text>
                                        {/* Slot ID */}
                                        <text
                                            x={node.coordinates.x}
                                            y={node.coordinates.y + 18}
                                            textAnchor="middle"
                                            fontSize="13"
                                            fontWeight="700"
                                            fill="white"
                                            style={{ pointerEvents: 'none', fontFamily: "'JetBrains Mono', monospace" }}
                                        >
                                            {node.id}
                                        </text>
                                    </>
                                ) : (
                                    <>
                                        {/* Junction or Entrance */}
                                        <circle
                                            cx={node.coordinates.x}
                                            cy={node.coordinates.y}
                                            r={isEntrance ? 16 : 8}
                                            fill={isEntrance ? '#fbbf24' : '#334155'}
                                            stroke="rgba(255,255,255,0.2)"
                                            strokeWidth="2"
                                        />
                                        {isEntrance && (
                                            <>
                                                <text
                                                    x={node.coordinates.x}
                                                    y={node.coordinates.y + 4}
                                                    textAnchor="middle"
                                                    fontSize="12"
                                                    fill="white"
                                                    style={{ pointerEvents: 'none' }}
                                                >
                                                    🚪
                                                </text>
                                                <text
                                                    x={node.coordinates.x}
                                                    y={node.coordinates.y + 32}
                                                    textAnchor="middle"
                                                    fontSize="10"
                                                    fontWeight="600"
                                                    fill="#fbbf24"
                                                    style={{ pointerEvents: 'none' }}
                                                >
                                                    ENTRY
                                                </text>
                                            </>
                                        )}
                                    </>
                                )}
                            </g>
                        );
                    })}
                </svg>
            </div>

            {/* Capacity Bar */}
            <div className="capacity-bar-section">
                <div className="capacity-info">
                    <span>Lot Capacity</span>
                    <span className="capacity-percent">{occupancyRate}% Full</span>
                </div>
                <div className="capacity-track">
                    <div
                        className="capacity-fill"
                        style={{
                            width: `${occupancyRate}%`,
                            background: occupancyRate > 80 ? '#ef4444' :
                                occupancyRate > 50 ? '#f59e0b' : '#14b8a6'
                        }}
                    ></div>
                </div>
            </div>

            {/* Legend */}
            <div className="map-legend">
                <span className="legend-item"><span className="dot free"></span> Available - Click to book</span>
                <span className="legend-item"><span className="dot booked"></span> Reserved</span>
                <span className="legend-item"><span className="dot occupied"></span> In Use</span>
            </div>
        </div>
    );
};

export default ParkingMap;
