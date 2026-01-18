import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen } from 'lucide-react';

const StateBoards = () => {
    const navigate = useNavigate();

    const states = [
        "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat",
        "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh",
        "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
        "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh",
        "Uttarakhand", "West Bengal"
    ];

    return (
        <div className="container" style={{ padding: 'var(--space-lg) var(--space-md)', overflowY: 'auto', height: '100%' }}>
            <div style={{ marginBottom: 'var(--space-lg)' }}>
                <h1 className="text-gradient" style={{ fontSize: '2rem', marginBottom: 'var(--space-xs)' }}>State Boards</h1>
                <p style={{ color: 'var(--text-secondary)' }}>Select your state board to view resources</p>
            </div>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: 'var(--space-md)'
            }}>
                {states.map((state, index) => (
                    <div
                        key={index}
                        className="glass"
                        onClick={() => navigate(`/library?category=${encodeURIComponent(state)}`)} // Placeholder navigation
                        style={{
                            padding: 'var(--space-md)',
                            borderRadius: 'var(--radius-md)',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            textAlign: 'center',
                            gap: 'var(--space-sm)',
                            transition: 'transform 0.2s, background 0.2s',
                            border: '1px solid var(--glass-border)'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-4px)';
                            e.currentTarget.style.background = 'rgba(139, 92, 246, 0.1)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.background = 'var(--glass-bg)';
                        }}
                    >
                        <div style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '50%',
                            background: 'var(--bg-tertiary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--primary)'
                        }}>
                            <BookOpen size={24} />
                        </div>
                        <h3 style={{ fontSize: '1rem', fontWeight: '500' }}>{state}</h3>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default StateBoards;
