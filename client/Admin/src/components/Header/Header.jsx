import React, { useEffect, useState } from "react";
import { FaBars, FaBell, FaUser } from "react-icons/fa";
import styles from "./Header.module.css"; 
import webLogo from "../../assets/weblogo.png"; 
import { getUserFirstName } from "../../utils/auth";

const Header = ({ onHamburgerClick }) => {
  const [firstName, setFirstName] = useState(() => getUserFirstName());
  
  useEffect(() => {
    // Check for name updates in localStorage (e.g., after login)
    const checkName = () => {
      const name = getUserFirstName();
      if (name && name !== firstName) {
        setFirstName(name);
      }
    };
    
    // Check immediately
    checkName();
    
    // Poll for name updates (in case it's set after component mounts)
    const interval = setInterval(checkName, 500);
    
    // Also listen for storage events (from other tabs)
    const handleStorageChange = (e) => {
      if (e.key === 'userName') {
        const newFirstName = e.newValue ? e.newValue.trim().split(/\s+/)[0] : '';
        setFirstName(newFirstName);
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [firstName]);

  const welcomeText = firstName ? `Welcome ${firstName}!` : 'Welcome!';

  return (
    <header className={styles.header}>
      <div className={styles["header-left"]}>
        <div className={styles.hamburger} onClick={onHamburgerClick}>
          <FaBars />
        </div>
        <img src={webLogo} alt="Website Logo" className={styles["header-logo"]} />
      </div>

      <div className={styles["header-right"]}>
        <FaBell className={`${styles["header-action"]} ${styles["header-icon"]}`} />
        <FaUser className={`${styles["header-action"]} ${styles["header-icon"]}`} />
        <h1 className={styles["header-title"]}>{welcomeText}</h1>
      </div>
    </header>
  );
};

export default Header;
