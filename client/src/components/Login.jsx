import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { Link, useNavigate } from 'react-router-dom';
import './Auth.css';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        // Admin Fixed Credentials Check
        if (email === 'admin@parking.com' && password === 'admin123') {
            localStorage.setItem('isAdmin', 'true');
            setLoading(false);
            navigate('/admin');
            return;
        }

        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Check if user is disabled/blocked
            const { doc, getDoc } = await import('firebase/firestore');
            const { db } = await import('../firebase');
            const { signOut } = await import('firebase/auth');

            const userRef = doc(db, "users", user.uid);
            const userSnap = await getDoc(userRef);

            if (userSnap.exists() && userSnap.data().disabled) {
                await signOut(auth);
                setError('🚫 Access Denied: Your account has been blocked by the administrator.');
                setLoading(false);
                return;
            }

            navigate('/');
        } catch (err) {
            setError('Invalid credentials. Please check your email and password.');
            console.error(err);
        } finally {
            if (!error) setLoading(false); // Only unset if no error set above
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
                <h2>Welcome Back</h2>
                <p className="auth-subtitle">Sign in to manage your parking experience</p>

                {/* Error Message */}
                {error && <div className="error-msg">{error}</div>}

                {/* Login Form */}
                <form className="auth-form" onSubmit={handleLogin}>
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
                            autoComplete="current-password"
                        />
                        <span className="input-icon">🔒</span>
                    </div>

                    <button
                        type="submit"
                        className={`auth-btn ${loading ? 'loading' : ''}`}
                        disabled={loading}
                    >
                        {loading ? 'Signing In...' : 'Sign In'}
                    </button>
                </form>

                {/* Divider */}
                <div className="auth-divider">or</div>

                {/* Admin Login Hint */}
                <div className="admin-indicator">
                    Admin: admin@parking.com
                </div>

                {/* Register Link */}
                <div className="auth-link">
                    Don't have an account? <Link to="/register">Create Account</Link>
                </div>

                {/* Features */}
                <div className="auth-features">
                    <div className="feature-item">
                        <span className="feature-icon">🚗</span>
                        <span>Book parking slots in seconds</span>
                    </div>
                    <div className="feature-item">
                        <span className="feature-icon">📊</span>
                        <span>Track your booking history</span>
                    </div>
                    <div className="feature-item">
                        <span className="feature-icon">🗺️</span>
                        <span>Navigate with real-time maps</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
