import React, { useEffect, useState, useRef, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FaBars, FaBell, FaUser } from "react-icons/fa";
import styles from "./Header.module.css"; 
import webLogo from "../../assets/weblogo.png"; 
import { getUserFirstName } from "../../utils/auth";
import { countUnreadNotifications } from "../../apis/notificationApi";
import { subscribe, initSocketFresh, startAutoReconnect, stopAutoReconnect } from "../../utils/webSocketClient";
import Notification from "../Notification/Notification";

const MIN_UNREAD_REFRESH_MS = 1200;

const Header = ({ onHamburgerClick }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState(() => getUserFirstName());
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const notifMenuRef = useRef(null);
  
  const unreadCountInFlightRef = useRef(null);
  const unreadCountLastFetchedRef = useRef(0);
  const unreadCountLastValueRef = useRef(0);
  const headerMountedRef = useRef(true);
  const unreadReadyRef = useRef(false);
  
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

  useEffect(() => {
    headerMountedRef.current = true;
    return () => {
      headerMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    unreadCountLastValueRef.current = unreadCount;
  }, [unreadCount]);

  const refreshUnreadCount = useCallback(async ({ force = false } = {}) => {
    const existing = unreadCountInFlightRef.current;
    if (existing) return existing;

    const now = Date.now();
    if (!force && now - unreadCountLastFetchedRef.current < MIN_UNREAD_REFRESH_MS) {
      if (headerMountedRef.current) setUnreadCount(unreadCountLastValueRef.current);
      return unreadCountLastValueRef.current;
    }

    const request = countUnreadNotifications()
      .then((res) => {
        const count = Number(res?.data?.count ?? 0);
        unreadCountLastFetchedRef.current = Date.now();
        unreadCountLastValueRef.current = count;
        if (headerMountedRef.current) setUnreadCount(count);
        return count;
      })
      .catch((err) => {
        throw err;
      })
      .finally(() => {
        if (unreadCountInFlightRef.current === request) {
          unreadCountInFlightRef.current = null;
        }
      });

    unreadCountInFlightRef.current = request;
    return request;
  }, [setUnreadCount]);

  // Initial load and periodic refresh
  useEffect(() => {
    refreshUnreadCount({ force: true }).catch(() => {});
    
    // Poll every 30 seconds to keep count updated even when panel is closed
    const timer = setInterval(() => {
      refreshUnreadCount().catch(() => {});
    }, 30000);
    
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [refreshUnreadCount]);

  // Refresh unread count when notification panel opens
  useEffect(() => {
    let timer;
    if (isNotifOpen) {
      refreshUnreadCount({ force: true }).catch(() => {});
      timer = setInterval(() => {
        refreshUnreadCount({ force: true }).catch(() => {});
      }, 20000); // Refresh every 20 seconds when panel is open
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isNotifOpen, refreshUnreadCount]);

  // Refresh notification badge on route change
  useEffect(() => {
    if (!unreadReadyRef.current) {
      unreadReadyRef.current = true;
      return;
    }
    refreshUnreadCount().catch(() => {});
  }, [location.pathname, refreshUnreadCount]);

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

  const handleLogoClick = () => {
    navigate('/dashboard');
  };

  return (
    <header className={styles.header}>
      <div className={styles["header-left"]}>
        <div className={styles.hamburger} onClick={onHamburgerClick}>
          <FaBars />
        </div>
        <img 
          src={webLogo} 
          alt="Website Logo" 
          className={styles["header-logo"]} 
          onClick={handleLogoClick}
          style={{ cursor: 'pointer' }}
        />
      </div>

      <div className={styles["header-right"]}>
        <div className={styles["notification-wrapper"]} ref={notifMenuRef}>
          <div 
            className={`${styles["header-action"]} ${styles["header-icon"]} ${styles["notification-icon"]}`}
            onClick={handleNotificationClick}
            style={{ cursor: 'pointer', position: 'center' }}
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
      </div>
    </header>
  );
};

export default Header;