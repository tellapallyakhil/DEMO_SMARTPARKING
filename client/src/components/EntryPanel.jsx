import React, { useState } from 'react';
import api from '../api';
import './EntryPanel.css';

const EntryPanel = () => {
    const [rfid, setRfid] = useState('TAG12345');
    const [message, setMessage] = useState('');
    const [allocation, setAllocation] = useState(null);

    const handleScan = async () => {
        try {
            setMessage('Scanning...');
            setAllocation(null);

            const response = await api.post('/rfid/authenticate', { rfid });

            if (response.data.success) {
                setMessage(response.data.message);
                if (response.data.authorized && response.data.allocation) {
                    setAllocation(response.data.allocation);
                }
            } else {
                setMessage(response.data.message || 'Access Denied');
                setTimeout(() => setMessage(''), 3000);
            }
        } catch (error) {
            console.error(error);
            setMessage('Error connecting to system');
        }
    };

    return (
        <div className="entry-panel">
            <h2>🚗 Gate Control</h2>

            <div className="controls">
                <div className="input-group">
                    <label className="input-label">RFID Tag ID</label>
                    <input
                        type="text"
                        className="rfid-input"
                        value={rfid}
                        onChange={(e) => setRfid(e.target.value)}
                        placeholder="Scan Card..."
                    />
                </div>
                <button className="scan-btn" onClick={handleScan}>
                    Simulate Scan
                </button>
            </div>

            {message && <p className="status-message">{message}</p>}

            {allocation && (
                <div className="allocation-card">
                    <h3>✅ Access Granted</h3>
                    <p><strong>Assigned Slot:</strong> {allocation.slotId}</p>
                    <p><strong>Distance:</strong> {allocation.distance}m</p>
                    <div className="path-display">
                        <span>Route: </span>
                        <div className="path-steps">
                            {allocation.path.map((step, idx) => (
                                <span key={idx} className="path-node">
                                    {step}{idx < allocation.path.length - 1 ? ' → ' : ''}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EntryPanel;
