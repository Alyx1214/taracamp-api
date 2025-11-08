import React from "react";
import { FaBars, FaBell, FaUser } from "react-icons/fa";
import styles from "./Header.module.css"; 
import webLogo from "../../assets/weblogo.png"; 

const Header = ({ onHamburgerClick }) => {
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
      </div>
    </header>
  );
};

export default Header;
