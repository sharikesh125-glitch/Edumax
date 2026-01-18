import React from 'react';

const AuthLayout = ({ children, title, subtitle }) => {
    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'radial-gradient(circle at 10% 20%, rgb(30, 41, 59) 0%, rgb(15, 23, 42) 90.2%)',
            position: 'relative',
            overflow: 'hidden'
        }}>
            {/* Abstract Background Blobs */}
            <div style={{
                position: 'absolute',
                top: '-10%',
                left: '-10%',
                width: '500px',
                height: '500px',
                borderRadius: '50%',
                background: 'linear-gradient(to right, var(--primary), var(--accent))',
                opacity: '0.15',
                filter: 'blur(80px)',
            }} />
            <div style={{
                position: 'absolute',
                bottom: '-10%',
                right: '-10%',
                width: '500px',
                height: '500px',
                borderRadius: '50%',
                background: 'linear-gradient(to right, var(--secondary), var(--success))',
                opacity: '0.15',
                filter: 'blur(80px)',
            }} />

            <div className="glass" style={{
                width: '100%',
                maxWidth: '450px',
                padding: 'var(--space-xl)',
                borderRadius: 'var(--radius-lg)',
                zIndex: 1,
                margin: 'var(--space-md)'
            }}>
                <div style={{ marginBottom: 'var(--space-lg)', textAlign: 'center' }}>
                    <h2 style={{ fontSize: '2rem', marginBottom: 'var(--space-xs)' }}>{title}</h2>
                    <p style={{ color: 'var(--text-muted)' }}>{subtitle}</p>
                </div>
                {children}
            </div>
        </div>
    );
};

export default AuthLayout;
