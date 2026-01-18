import React from 'react';

const Input = ({ label, type = 'text', placeholder, icon: Icon, value, onChange, ...props }) => {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)', marginBottom: 'var(--space-md)' }}>
            {label && (
                <label style={{
                    fontSize: '0.9rem',
                    color: 'var(--text-secondary)',
                    fontWeight: '500'
                }}>
                    {label}
                </label>
            )}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                {Icon && (
                    <div style={{
                        position: 'absolute',
                        left: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        pointerEvents: 'none' // Prevent icon from blocking clicks
                    }}>
                        <Icon size={18} />
                    </div>
                )}
                <input
                    type={type}
                    placeholder={placeholder}
                    value={value}
                    onChange={onChange}
                    style={{
                        width: '100%',
                        height: '48px', // Force explicit height
                        padding: '12px',
                        paddingLeft: Icon ? '40px' : '12px',
                        backgroundColor: 'var(--bg-tertiary)',
                        border: '1px solid var(--glass-border)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--text-primary)',
                        outline: 'none',
                        fontSize: '1rem',
                        boxSizing: 'border-box', // Ensure padding doesn't affect width/height
                        transition: 'border-color 0.2s',
                    }}
                    onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                    onBlur={(e) => e.target.style.borderColor = 'var(--glass-border)'}
                    {...props}
                />
            </div>
        </div>
    );
};

export default Input;
