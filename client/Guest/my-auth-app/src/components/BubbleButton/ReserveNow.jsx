import React from 'react';
import { useNavigate } from 'react-router-dom';
import './ReserveNow.module.css';

const ReserveNow = ({ 
  onClick, 
  disabled = false, 
  size = 'medium',
  variant = 'primary',
  className = '',
  children,
  navigateToServices = true 
}) => {
  const navigate = useNavigate();

  const handleClick = (e) => {
    if (!disabled) {
      // Create bubble animation on click
      const button = e.currentTarget;
      const rect = button.getBoundingClientRect();
      const ripple = document.createElement('span');
      const size = Math.max(rect.width, rect.height);
      const x = e.clientX - rect.left - size / 2;
      const y = e.clientY - rect.top - size / 2;
      
      ripple.style.width = ripple.style.height = size + 'px';
      ripple.style.left = x + 'px';
      ripple.style.top = y + 'px';
      ripple.classList.add('ripple');
      
      button.appendChild(ripple);
      
      setTimeout(() => {
        ripple.remove();
      }, 600);

      // Handle navigation or custom onClick
      if (navigateToServices) {
        setTimeout(() => navigate('/services'), 200);
      } else if (onClick) {
        onClick(e);
      }
    }
  };

  return (
    <button
      className={`reserve-now-btn ${size} ${variant} ${disabled ? 'disabled' : ''} ${className}`}
      onClick={handleClick}
      disabled={disabled}
      aria-label="Reserve Now"
    >
      <span className="btn-text">
        {children || 'Reserve Now!'}
      </span>
      <div className="bubble-effect"></div>
      <div className="floating-bubbles">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </button>
  );
};

export default ReserveNow;