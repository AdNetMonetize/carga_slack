import type { InputHTMLAttributes, ReactNode } from 'react';
import { forwardRef } from 'react';
import './Input.css';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    icon?: ReactNode;
    iconRight?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ label, error, icon, iconRight, className = '', ...props }, ref) => {
        return (
            <div className={`form-group ${error ? 'has-error' : ''}`}>
                {label && <label className="form-label">{label}</label>}
                <div className="input-wrapper">
                    {icon && <span className="input-icon">{icon}</span>}
                    <input
                        ref={ref}
                        className={`form-input ${icon ? 'has-icon' : ''} ${iconRight ? 'has-icon-right' : ''} ${className}`}
                        {...props}
                    />
                    {iconRight && <span className="input-icon-right">{iconRight}</span>}
                </div>
                {error && <span className="form-error">{error}</span>}
            </div>
        );
    }
);

Input.displayName = 'Input';
