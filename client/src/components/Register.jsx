import React, { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { setDoc, doc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { Link, useNavigate } from 'react-router-dom';
import './Auth.css';

const Register = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPass, setConfirmPass] = useState('');
    const [vehicleType, setVehicleType] = useState('Car');
    const [vehicleNumber, setVehicleNumber] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const validatePassword = (pwd) => {
        const regex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/;
        return regex.test(pwd);
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        setError('');

        if (password !== confirmPass) {
            return setError("Passwords do not match");
        }

        if (!validatePassword(password)) {
            return setError("Password must be at least 8 characters with 1 number and 1 special character.");
        }

        if (!vehicleNumber.trim()) {
            return setError("Please enter your vehicle number");
        }

        setLoading(true);
        try {
            // Create Auth User
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Create User Profile in Firestore
            await setDoc(doc(db, "users", user.uid), {
                email: user.email,
                vehicleType,
                vehicleNumber: vehicleNumber.toUpperCase(),
                createdAt: new Date().toISOString(),
                history: []
            });

            navigate('/');
        } catch (err) {
            const errorMessage = err.message.replace('Firebase: ', '').replace(/\(auth\/.*\)/, '').trim();
            setError(errorMessage || 'Registration failed. Please try again.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-card">
                {/* Logo */}
                <div className="auth-logo">
                    <span className="auth-logo-icon">🅿️</span>
                    <span className="auth-logo-text">Smart Parking</span>
                </div>

                {/* Title */}
                <h2>Create Account</h2>
                <p className="auth-subtitle">Join us for a smarter parking experience</p>

                {/* Error Message */}
                {error && <div className="error-msg">{error}</div>}

                {/* Register Form */}
                <form className="auth-form" onSubmit={handleRegister}>
                    {/* Account Details */}
                    <div className="form-section">
                        <label className="section-label">Account Details</label>

                        <div className="input-group">
                            <input
                                type="email"
                                placeholder="Email Address"
                                className="auth-input"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                autoComplete="email"
                            />
                            <span className="input-icon">📧</span>
                        </div>

                        <div className="input-group">
                            <input
                                type="password"
                                placeholder="Password"
                                className="auth-input"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                autoComplete="new-password"
                            />
                            <span className="input-icon">🔒</span>
                        </div>
                        <div className="password-hint">
                            Min 8 characters, 1 number, 1 special character
                        </div>

                        <div className="input-group">
                            <input
                                type="password"
                                placeholder="Confirm Password"
                                className="auth-input"
                                value={confirmPass}
                                onChange={(e) => setConfirmPass(e.target.value)}
                                required
                                autoComplete="new-password"
                            />
                            <span className="input-icon">🔐</span>
                        </div>
                    </div>

                    {/* Vehicle Details */}
                    <div className="form-section">
                        <label className="section-label">Vehicle Information</label>

                        <div className="input-group">
                            <select
                                className="auth-input"
                                value={vehicleType}
                                onChange={(e) => setVehicleType(e.target.value)}
                                style={{ paddingLeft: '48px' }}
                            >
                                <option value="Car">🚗 Car</option>
                                <option value="Bike">🏍️ Bike</option>
                                <option value="Truck">🚛 Truck</option>
                            </select>
                            <span className="input-icon">🚘</span>
                        </div>

                        <div className="input-group">
                            <input
                                type="text"
                                placeholder="Vehicle Number (e.g., AP01XY1234)"
                                className="auth-input"
                                value={vehicleNumber}
                                onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
                                required
                                style={{ textTransform: 'uppercase', fontFamily: 'monospace' }}
                            />
                            <span className="input-icon">🔢</span>
                        </div>
                    </div>

                    <button
                        type="submit"
                        className={`auth-btn ${loading ? 'loading' : ''}`}
                        disabled={loading}
                    >
                        {loading ? 'Creating Account...' : 'Create Account'}
                    </button>
                </form>

                {/* Login Link */}
                <div className="auth-link">
                    Already have an account? <Link to="/login">Sign In</Link>
                </div>
            </div>
        </div>
    );
};

export default Register;
