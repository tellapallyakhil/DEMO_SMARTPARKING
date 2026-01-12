import React, { useEffect, useState } from 'react';
import api from '../api';
import './MapVisualizer.css';

const MapVisualizer = ({ targetSlotId, onClose }) => {
    const [graph, setGraph] = useState(null);
    const [routes, setRoutes] = useState([]);
    const [activeRouteIndex, setActiveRouteIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [animatedPathIndex, setAnimatedPathIndex] = useState(0);

    // Fetch Graph Layout
    useEffect(() => {
        const fetchLayout = async () => {
            try {
                const response = await api.get('/parking/layout');
                if (response.data.success) {
                    setGraph(response.data.data);
                }
            } catch (error) {
                console.error("Failed to load map layout", error);
            } finally {
                setLoading(false);
            }
        };
        fetchLayout();
    }, []);

    // Fetch Multiple Paths
    useEffect(() => {
        if (!graph || !targetSlotId) return;

        const fetchRoutes = async () => {
            try {
                const response = await api.post('/parking/routes', {
                    startNode: 'ENTRANCE',
                    endNode: targetSlotId
                });
                if (response.data.success && response.data.data.length > 0) {
                    setRoutes(response.data.data);
                    setActiveRouteIndex(0);
                }
            } catch (error) {
                console.error("Failed to fetch routes", error);
            }
        };
        fetchRoutes();
    }, [graph, targetSlotId]);

    // Animate path drawing
    useEffect(() => {
        if (routes.length === 0) return;

        const activePath = routes[activeRouteIndex]?.path || [];
        if (activePath.length === 0) return;

        setAnimatedPathIndex(0);
        const timer = setInterval(() => {
            setAnimatedPathIndex(prev => {
                if (prev >= activePath.length - 1) {
                    clearInterval(timer);
                    return prev;
                }
                return prev + 1;
            });
        }, 300);

        return () => clearInterval(timer);
    }, [routes, activeRouteIndex]);

    const getNodePosition = (nodeId) => {
        if (!graph?.nodes?.[nodeId]) return { x: 0, y: 0 };
        return graph.nodes[nodeId].coordinates;
    };

    const activePath = routes[activeRouteIndex]?.path || [];
    const activeDistance = routes[activeRouteIndex]?.distance || 0;

    // Calculate estimated walk time (assuming 1.4 m/s walking speed)
    const walkTime = Math.round((activeDistance * 10) / 1.4); // Convert to seconds

    if (loading) {
        return (
            <div className="nav-overlay">
                <div className="nav-loading">
                    <div className="nav-loading-spinner"></div>
                    <p>Calculating best route...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="nav-overlay">
            <div className="nav-container">
                {/* Header */}
                <div className="nav-header">
                    <div className="nav-title">
                        <span className="nav-icon">🗺️</span>
                        <div>
                            <h2>Navigation to {targetSlotId}</h2>
                            <p>Follow the highlighted path</p>
                        </div>
                    </div>
                    <button className="nav-close-btn" onClick={onClose}>×</button>
                </div>

                {/* Route Stats */}
                <div className="route-stats">
                    <div className="stat-item">
                        <span className="stat-icon">📏</span>
                        <div className="stat-info">
                            <span className="stat-value">{activeDistance * 10}m</span>
                            <span className="stat-label">Distance</span>
                        </div>
                    </div>
                    <div className="stat-item">
                        <span className="stat-icon">🚶</span>
                        <div className="stat-info">
                            <span className="stat-value">{walkTime}s</span>
                            <span className="stat-label">Walk Time</span>
                        </div>
                    </div>
                    <div className="stat-item">
                        <span className="stat-icon">🛤️</span>
                        <div className="stat-info">
                            <span className="stat-value">{activePath.length - 1}</span>
                            <span className="stat-label">Steps</span>
                        </div>
                    </div>
                </div>

                {/* Route Selection */}
                {routes.length > 1 && (
                    <div className="route-selector">
                        <span className="selector-label">Choose Route:</span>
                        <div className="route-buttons">
                            {routes.map((route, idx) => (
                                <button
                                    key={idx}
                                    className={`route-select-btn ${activeRouteIndex === idx ? 'active' : ''}`}
                                    onClick={() => setActiveRouteIndex(idx)}
                                >
                                    <span className="route-badge">{idx === 0 ? '⚡ Fastest' : `Alt ${idx}`}</span>
                                    <span className="route-distance">{route.distance * 10}m</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* SVG Map */}
                <div className="nav-map-container">
                    <svg viewBox="0 0 800 600" className="nav-svg-map">
                        <defs>
                            {/* Path Gradient */}
                            <linearGradient id="pathGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="#f97316" />
                                <stop offset="100%" stopColor="#22c55e" />
                            </linearGradient>

                            {/* Glow Filter */}
                            <filter id="pathGlow" x="-50%" y="-50%" width="200%" height="200%">
                                <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                                <feMerge>
                                    <feMergeNode in="coloredBlur" />
                                    <feMergeNode in="SourceGraphic" />
                                </feMerge>
                            </filter>

                            {/* Arrow Marker */}
                            <marker id="arrowhead" markerWidth="10" markerHeight="7"
                                refX="9" refY="3.5" orient="auto">
                                <polygon points="0 0, 10 3.5, 0 7" fill="#f97316" />
                            </marker>
                        </defs>

                        {/* Background Roads */}
                        {graph && Object.keys(graph.adjacencyList || {}).map(nodeId => {
                            const from = getNodePosition(nodeId);
                            return (graph.adjacencyList[nodeId] || []).map((edge, idx) => {
                                const to = getNodePosition(edge.node);
                                return (
                                    <line
                                        key={`${nodeId}-${edge.node}-${idx}`}
                                        x1={from.x}
                                        y1={from.y}
                                        x2={to.x}
                                        y2={to.y}
                                        stroke="rgba(100, 116, 139, 0.4)"
                                        strokeWidth="12"
                                        strokeLinecap="round"
                                    />
                                );
                            });
                        })}

                        {/* Lane Markers */}
                        <text x="680" y="150" fill="rgba(255,255,255,0.15)" fontSize="30" fontWeight="900">LANE 1</text>
                        <text x="680" y="300" fill="rgba(255,255,255,0.15)" fontSize="30" fontWeight="900">LANE 2</text>
                        <text x="680" y="450" fill="rgba(255,255,255,0.15)" fontSize="30" fontWeight="900">LANE 3</text>

                        {/* Animated Path Highlight */}
                        {activePath.slice(0, animatedPathIndex + 1).map((nodeId, idx) => {
                            if (idx === 0) return null;
                            const from = getNodePosition(activePath[idx - 1]);
                            const to = getNodePosition(nodeId);
                            return (
                                <g key={`path-${idx}`}>
                                    {/* Glow effect */}
                                    <line
                                        x1={from.x}
                                        y1={from.y}
                                        x2={to.x}
                                        y2={to.y}
                                        stroke="#f97316"
                                        strokeWidth="20"
                                        strokeLinecap="round"
                                        opacity="0.3"
                                        className="path-glow"
                                    />
                                    {/* Main path */}
                                    <line
                                        x1={from.x}
                                        y1={from.y}
                                        x2={to.x}
                                        y2={to.y}
                                        stroke="url(#pathGradient)"
                                        strokeWidth="8"
                                        strokeLinecap="round"
                                        filter="url(#pathGlow)"
                                        className="animated-path"
                                    />
                                </g>
                            );
                        })}

                        {/* All Nodes */}
                        {graph && Object.values(graph.nodes || {}).map(node => {
                            const pos = getNodePosition(node.id);
                            const isOnPath = activePath.includes(node.id);
                            const isTarget = node.id === targetSlotId;
                            const isEntrance = node.type === 'ENTRANCE';
                            const isSlot = node.type === 'SLOT';
                            const pathIndex = activePath.indexOf(node.id);
                            const isAnimated = pathIndex <= animatedPathIndex;

                            if (isEntrance) {
                                return (
                                    <g key={node.id} className={isAnimated ? 'node-animated' : ''}>
                                        <circle
                                            cx={pos.x}
                                            cy={pos.y}
                                            r="22"
                                            fill="#fbbf24"
                                            stroke="white"
                                            strokeWidth="3"
                                        />
                                        <text x={pos.x} y={pos.y + 1} textAnchor="middle" dominantBaseline="middle"
                                            fontSize="10" fontWeight="700" fill="#000">ENTRY</text>
                                        <text x={pos.x} y={pos.y + 38} textAnchor="middle"
                                            fontSize="11" fontWeight="600" fill="#fbbf24">START HERE</text>
                                    </g>
                                );
                            }

                            if (isSlot) {
                                return (
                                    <g key={node.id} className={isAnimated && isOnPath ? 'node-animated' : ''}>
                                        <rect
                                            x={pos.x - 28}
                                            y={pos.y - 28}
                                            width="56"
                                            height="56"
                                            rx="10"
                                            fill={isTarget ? '#22c55e' : isOnPath && isAnimated ? 'rgba(249, 115, 22, 0.3)' : '#1e293b'}
                                            stroke={isTarget ? '#fff' : isOnPath && isAnimated ? '#f97316' : '#334155'}
                                            strokeWidth={isTarget ? 4 : 2}
                                        />
                                        <text x={pos.x} y={pos.y + 1} textAnchor="middle" dominantBaseline="middle"
                                            fontSize="16" fontWeight="700" fill="white"
                                            fontFamily="'JetBrains Mono', monospace">{node.id}</text>
                                        {isTarget && (
                                            <>
                                                <text x={pos.x} y={pos.y + 45} textAnchor="middle"
                                                    fontSize="11" fontWeight="600" fill="#22c55e">YOUR SLOT</text>
                                                <circle cx={pos.x} cy={pos.y} r="40" fill="none"
                                                    stroke="#22c55e" strokeWidth="2" opacity="0.5"
                                                    className="target-pulse" />
                                            </>
                                        )}
                                    </g>
                                );
                            }

                            // Junction nodes
                            return (
                                <circle
                                    key={node.id}
                                    cx={pos.x}
                                    cy={pos.y}
                                    r={isOnPath && isAnimated ? 10 : 6}
                                    fill={isOnPath && isAnimated ? '#f97316' : '#475569'}
                                    className={isAnimated && isOnPath ? 'node-animated' : ''}
                                />
                            );
                        })}

                        {/* Path Step Numbers */}
                        {activePath.slice(0, animatedPathIndex + 1).map((nodeId, idx) => {
                            if (idx === 0) return null;
                            const pos = getNodePosition(nodeId);
                            const node = graph?.nodes?.[nodeId];
                            if (node?.type === 'SLOT' || node?.type === 'ENTRANCE') return null;

                            return (
                                <g key={`step-${idx}`}>
                                    <circle cx={pos.x} cy={pos.y - 20} r="12" fill="#f97316" />
                                    <text x={pos.x} y={pos.y - 19} textAnchor="middle" dominantBaseline="middle"
                                        fontSize="10" fontWeight="700" fill="white">{idx}</text>
                                </g>
                            );
                        })}
                    </svg>
                </div>

                {/* Step-by-step Directions */}
                <div className="nav-directions">
                    <h4>📍 Turn-by-Turn Directions</h4>
                    <div className="directions-list">
                        {activePath.map((nodeId, idx) => {
                            const isAnimated = idx <= animatedPathIndex;
                            const node = graph?.nodes?.[nodeId];
                            let direction = '';

                            if (idx === 0) {
                                direction = '🚗 Start at ENTRANCE';
                            } else if (idx === activePath.length - 1) {
                                direction = `🎯 Arrive at ${targetSlotId}`;
                            } else {
                                // Calculate direction based on position change
                                const prevPos = getNodePosition(activePath[idx - 1]);
                                const currPos = getNodePosition(nodeId);
                                const nextPos = idx < activePath.length - 1 ? getNodePosition(activePath[idx + 1]) : currPos;

                                const dx1 = currPos.x - prevPos.x;
                                const dy1 = currPos.y - prevPos.y;
                                const dx2 = nextPos.x - currPos.x;
                                const dy2 = nextPos.y - currPos.y;

                                if (Math.abs(dx2) > Math.abs(dy2)) {
                                    direction = dx2 > 0 ? '➡️ Go Right' : '⬅️ Go Left';
                                } else {
                                    direction = dy2 > 0 ? '⬇️ Go Down' : '⬆️ Go Up';
                                }

                                if (node?.type === 'SLOT') {
                                    direction = `📍 Pass ${nodeId}`;
                                }
                            }

                            return (
                                <div key={idx} className={`direction-step ${isAnimated ? 'active' : ''}`}>
                                    <span className="step-number">{idx + 1}</span>
                                    <span className="step-text">{direction}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="nav-actions">
                    <button className="nav-action-btn secondary" onClick={onClose}>
                        Close
                    </button>
                    <button className="nav-action-btn primary" onClick={() => setAnimatedPathIndex(0)}>
                        🔄 Replay Animation
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MapVisualizer;
