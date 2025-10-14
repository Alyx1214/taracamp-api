import React, { useState } from 'react'; 
import { Link, useNavigate, useLocation } from 'react-router-dom';
import styles from './Header.module.css';
import mountainLogo from '../../assets/logo.png';

function Header({ onReserveNow }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false); 

  const handleNavLinkClick = (path, sectionId) => {
    setIsMenuOpen(false); 
    if (location.pathname === path || (location.pathname === '/' && path === '/')) {
      const element = document.getElementById(sectionId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    } else {
      navigate(path);
      setTimeout(() => {
        const element = document.getElementById(sectionId);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    }
  };

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const handleKeyDown = (event, action) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      action();
    }
  };

  return (
    <header className={styles.headerContainer} role="banner">
      <div className={styles.logoGroup}>
        <a 
          onClick={() => handleNavLinkClick('/', 'hero')} 
          className={styles.headerLogoLink}
          aria-label="Go to homepage"
          onKeyDown={(e) => handleKeyDown(e, () => handleNavLinkClick('/', 'hero'))}
          tabIndex={0}
        >
          <img 
            src={mountainLogo} 
            alt="Baguio Teachers Camp Logo - Mountain silhouette representing the historic retreat" 
            className={styles.headerLogo} 
          />
          <p className={styles.headerLogoText}>Baguio Teachers' Camp</p>
        </a>
      </div>

      <nav 
        className={`${styles.navbarNav} ${isMenuOpen ? styles.menuOpen : ''}`} 
        role="navigation" 
        aria-label="Main navigation"
      >
        <ul className={styles.navList}>
          <li className={styles.navItem}>
            <a 
              onClick={() => handleNavLinkClick('/', 'hero')} 
              className={styles.navLink}
              aria-label="Navigate to home section"
              onKeyDown={(e) => handleKeyDown(e, () => handleNavLinkClick('/', 'hero'))}
              tabIndex={0}
            >
              HOME
            </a>
          </li>
          <li className={styles.navItem}>
            <a 
              onClick={() => handleNavLinkClick('/', 'history-section')} 
              className={styles.navLink}
              aria-label="Navigate to history section"
              onKeyDown={(e) => handleKeyDown(e, () => handleNavLinkClick('/', 'history-section'))}
              tabIndex={0}
            >
              HISTORY
            </a>
          </li>
          <li className={styles.navItem}>
            <a 
              onClick={() => handleNavLinkClick('/', 'services-section')} 
              className={styles.navLink}
              aria-label="Navigate to services section"
              onKeyDown={(e) => handleKeyDown(e, () => handleNavLinkClick('/', 'services-section'))}
              tabIndex={0}
            >
              SERVICES
            </a>
          </li>
          <li className={styles.navItem}>
            <a 
              onClick={() => handleNavLinkClick('/', 'faq-section')} 
              className={styles.navLink}
              aria-label="Navigate to FAQ section"
              onKeyDown={(e) => handleKeyDown(e, () => handleNavLinkClick('/', 'faq-section'))}
              tabIndex={0}
            >
              FAQS
            </a>
          </li>
          <li className={styles.navItem}>
            <a 
              onClick={() => handleNavLinkClick('/', 'footer')} 
              className={styles.navLink}
              aria-label="Navigate to contacts section"
              onKeyDown={(e) => handleKeyDown(e, () => handleNavLinkClick('/', 'footer'))}
              tabIndex={0}
            >
              CONTACTS
            </a>
          </li>
          <li className={styles.mobileOnlyNavItem}>
            <button 
              className={styles.reserveNowButtonMobile} 
              onClick={() => { setIsMenuOpen(false); navigate('/auth/signup'); }}
              aria-label="Sign up for an account"
            >
              Sign Up
            </button>
          </li>
        </ul>
      </nav>

      <div className={styles.desktopActions}>
        <button 
          className={styles.reserveNowButton} 
          onClick={() => navigate('/auth/signup')}
          aria-label="Sign up for an account"
        >
          Sign Up 
        </button>
      </div>
      
      <button 
        className={styles.hamburgerButton} 
        onClick={toggleMenu}
        aria-label={isMenuOpen ? "Close navigation menu" : "Open navigation menu"}
        aria-expanded={isMenuOpen}
        aria-controls="main-navigation"
      >
        <svg fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
            clipRule="evenodd"
          ></path>
        </svg>
      </button>
    </header>
  );
}

export default Header;
