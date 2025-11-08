import React, { useEffect, useState, useRef } from "react";
import { FaBars, FaBell, FaUser } from "react-icons/fa";
import styles from "./Header.module.css"; 
import webLogo from "../../assets/weblogo.png"; 
import { getUserFirstName } from "../../utils/auth";
import { countUnreadNotifications } from "../../apis/notificationApi";
import { subscribe, initSocketFresh, startAutoReconnect, stopAutoReconnect } from "../../utils/webSocketClient";
import Notification from "../Notification/Notification";

const Header = ({ onHamburgerClick }) => {
  const [firstName, setFirstName] = useState(() => getUserFirstName());
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const notifMenuRef = useRef(null);
  
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

  // Load unread notification count
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await countUnreadNotifications();
        if (!cancelled && res?.data?.count !== undefined) {
          setUnreadCount(Number(res.data.count) || 0);
        }
      } catch (error) {
        console.warn('Failed to load notification count:', error);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // Refresh unread count when notification panel opens
  useEffect(() => {
    let timer;
    if (isNotifOpen) {
      async function refresh() {
        try {
          const res = await countUnreadNotifications();
          if (res?.data?.count !== undefined) {
            setUnreadCount(Number(res.data.count) || 0);
          }
        } catch (error) {
          console.warn('Failed to refresh notification count:', error);
        }
      }
      refresh();
      timer = setInterval(refresh, 20000); // Refresh every 20 seconds
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isNotifOpen]);

  // WebSocket listener for real-time notification updates
  useEffect(() => {
    initSocketFresh().catch(() => {});
    startAutoReconnect();

    const handleWebSocketMessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'notification' && data.notification) {
          setUnreadCount(prev => prev + 1);
        }
      } catch (error) {
        // Ignore parsing errors
      }
    };

    const unsubscribe = subscribe(handleWebSocketMessage);

    return () => {
      unsubscribe();
      stopAutoReconnect();
    };
  }, []);

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (notifMenuRef.current && !notifMenuRef.current.contains(event.target)) {
        setIsNotifOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotificationClick = () => {
    setIsNotifOpen(prev => !prev);
  };

  const handleMarkAllAsRead = () => {
    setUnreadCount(0);
  };

  return (
    <header className={styles.header}>
      <div className={styles["header-left"]}>
        <div className={styles.hamburger} onClick={onHamburgerClick}>
          <FaBars />
        </div>
        <img src={webLogo} alt="Website Logo" className={styles["header-logo"]} />
      </div>

      <div className={styles["header-right"]}>
        <div className={styles["notification-wrapper"]} ref={notifMenuRef}>
          <div 
            className={`${styles["header-action"]} ${styles["header-icon"]} ${styles["notification-icon"]}`}
            onClick={handleNotificationClick}
            style={{ cursor: 'pointer', position: 'relative' }}
          >
            <FaBell />
            {unreadCount > 0 && (
              <span className={styles["notification-badge"]}>{unreadCount > 99 ? '99+' : unreadCount}</span>
            )}
          </div>
          {isNotifOpen && (
            <div className={styles["notification-dropdown"]} role="dialog" aria-label="Notifications">
              <Notification onMarkAllAsRead={handleMarkAllAsRead} />
            </div>
          )}
        </div>
        <FaUser className={`${styles["header-action"]} ${styles["header-icon"]}`} />
        <h1 className={styles["header-title"]}>{welcomeText}</h1>
      </div>
    </header>
  );
};

export default Header;
