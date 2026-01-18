import React from 'react';
import '../index.css';

const Button = ({ children, variant = 'primary', className = '', ...props }) => {
    const baseStyle = {
        padding: '12px var(--space-md)',
        borderRadius: 'var(--radius-md)',
        fontWeight: '600',
        transition: 'all 0.3s ease',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--space-xs)',
    };

    const variants = {
        primary: {
            backgroundColor: 'var(--primary)',
            color: 'white',
            boxShadow: '0 4px 14px 0 rgba(139, 92, 246, 0.39)',
        },
        secondary: {
            backgroundColor: 'var(--bg-tertiary)',
            color: 'var(--text-primary)',
            border: '1px solid var(--glass-border)',
        },
        ghost: {
            backgroundColor: 'transparent',
            color: 'var(--text-secondary)',
        },
        outline: {
            backgroundColor: 'transparent',
            border: '1px solid var(--primary)',
            color: 'var(--primary)',
        }
    };

    const style = { ...baseStyle, ...variants[variant] };

    return (
        <button style={style} className={className} {...props}>
            {children}
        </button>
    );
};

export default Button;
