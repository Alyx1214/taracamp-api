import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import styles from './HeaderHome.module.css';
import mountainLogo from '../../assets/logo.png';
import { useNotifications } from '../Utilities/useNotifications';
import Notif from '../Notification/Notif';
import NotifPreview from '../Notification/NotifPreview';

function HeaderHome() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifPane, setNotifPane] = useState('list');
  const [selectedNotif, setSelectedNotif] = useState(null);
  const accountMenuRef = useRef(null);
  const notifMenuRef = useRef(null);
  const { items: notifications, unreadCount, markAllAsRead, markRead } = useNotifications();

  useEffect(() => {
    function handleClickOutside(event) {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target)) {
        setIsAccountMenuOpen(false);
      }
      if (notifMenuRef.current && !notifMenuRef.current.contains(event.target)) {
        setIsNotifOpen(false);
        setNotifPane('list');
        setSelectedNotif(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNavLinkClick = (path, sectionId) => {
    setIsMenuOpen(false);
    setIsAccountMenuOpen(false);
    setIsNotifOpen(false);
    setNotifPane('list');
    setSelectedNotif(null);
    if (location.pathname === path || (location.pathname === '/' && path === '/')) {
      const element = document.getElementById(sectionId);
      if (element) element.scrollIntoView({ behavior: 'smooth' });
    } else {
      navigate(path);
      setTimeout(() => {
        const element = document.getElementById(sectionId);
        if (element) element.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  };

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
    setIsAccountMenuOpen(false);
    setIsNotifOpen(false);
    setNotifPane('list');
    setSelectedNotif(null);
  };

  const handleProfileClick = () => {
    setIsAccountMenuOpen(prev => !prev);
    setIsMenuOpen(false);
    setIsNotifOpen(false);
    setNotifPane('list');
    setSelectedNotif(null);
  };

  const handleNotificationsClick = () => {
    setIsNotifOpen(prev => {
      const next = !prev;
      if (next) {
        setNotifPane('list');
        setSelectedNotif(null);
      }
      return next;
    });
    setIsMenuOpen(false);
    setIsAccountMenuOpen(false);
  };

  const handleMessagesClick = () => {
    setIsMenuOpen(false);
    setIsAccountMenuOpen(false);
    setIsNotifOpen(false);
    setNotifPane('list');
    setSelectedNotif(null);
  };

  const handleReservationClick = () => {
    setIsAccountMenuOpen(false);
    navigate('/reservations');
  };

  const handleTransactionsClick = () => {
    setIsAccountMenuOpen(false);
    navigate('/transactions');
  };

  const handleLogoutClick = () => {
    localStorage.clear();
    navigate('/auth/login');
  };

  function openNotifDetail(notif) {
    if (!notif?.reservationId) {
      // no linked reservation; stay on list and do nothing useful
      return;
    }
    if (notif?.id) markRead(notif.id);

    if (window.matchMedia('(max-width: 640px)').matches) {
      setIsNotifOpen(false);
      setNotifPane('list');
      setSelectedNotif(null);
      navigate(`/notifications/${notif.id}/preview`);
      return;
    }
    setSelectedNotif(notif);
    setNotifPane('preview');
    setIsNotifOpen(true);
  }

  async function loadReservation(notif) {
    const reservationId = notif?.reservationId;
    if (!reservationId) throw new Error('Missing reservationId');
    const url = `/api/reservation/get-reservation-by-id/${reservationId}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      credentials: 'include',
    });

    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) {
      const text = await res.text();
      throw new Error(`Non-JSON response ${res.status} ${text.slice(0, 80)}`);
    }

    const json = await res.json();
    if (!res.ok || json.error) {
      throw new Error(json.error || `HTTP ${res.status}`);
    }

    const r = json.reservation || json;

    function humanizeType(t) {
      if (!t) return null;
      return String(t).toLowerCase()
        .replace(/_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());  
    }

    return {
      title: r.title,
      body: r.message,
      checkInDate: r.dateOfArrival,
      checkOutDate: r.dateOfDeparture,
      accommodationType: humanizeType(r.facilityType) || humanizeType(r?.facility?.type) || r.accommodationType,  
      numGuests: r?.numberOfGuests?.total ?? r.guests ?? r.pax,
      source: r.source || 'Teachers Camp',
      time: r.updatedAt || r.createdAt,
    };
  }

  return (
    <header className={styles.headerContainer}>
      <div className={styles.logoGroup}>
        <a onClick={() => handleNavLinkClick('/', 'hero')} className={styles.headerLogoLink}>
          <img src={mountainLogo} alt="Baguio Teachers Camp Logo" className={styles.headerLogo} />
          <p className={styles.headerLogoText}>BTC</p>
        </a>
      </div>

      <nav className={`${styles.navbarNav} ${isMenuOpen ? styles.menuOpen : ''}`}>
        <ul className={styles.navList}>
          <li className={styles.navItem}>
            <Link to="/homepage" className={styles.navLink} onClick={() => handleNavLinkClick('/homepage', 'hero')}>HOME</Link>
          </li>
          <li className={styles.navItem}>
            <Link to="/history" className={styles.navLink} onClick={() => handleNavLinkClick('/history', 'history-top')}>HISTORY</Link>
          </li>
          <li className={styles.navItem}>
            <Link to="/user/services" className={styles.navLink} onClick={() => handleNavLinkClick('/user/services', 'services-top')}>SERVICES</Link>
          </li>
          <li className={styles.navItem}>
            <Link to="/faqs" className={styles.navLink} onClick={() => handleNavLinkClick('/faqs', 'faqs-top')}>FAQS</Link>
          </li>
          <li className={styles.navItem}>
            <Link to="/contacts" className={styles.navLink} onClick={() => handleNavLinkClick('/contacts', 'contacts-top')}>CONTACTS</Link>
          </li>
        </ul>
      </nav>

      <div className={styles.desktopActions}>
        <div className={styles.userIconsGroup}>
          <div className={styles.accountIconWrapper} ref={notifMenuRef}>
            <button className={styles.iconButton} onClick={handleNotificationsClick} aria-haspopup="dialog" aria-expanded={isNotifOpen}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feather feather-bell">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
              </svg>
              {unreadCount > 0 && <span className={styles.badge}>{unreadCount}</span>}
            </button>

            {isNotifOpen && (
              <div className={styles.accountDropdownMenu} role="dialog" aria-label="Notifications">
                {notifPane === 'list' ? (
                  <Notif
                    notifications={notifications.map(n => ({
                      ...n,
                      onAction: () => openNotifDetail(n),
                    }))}
                    onMarkAllAsRead={markAllAsRead}
                    onItemClick={(n) => openNotifDetail(n)}
                  />
                ) : (
                  <NotifPreview
                    notif={selectedNotif || {}}
                    clientType={(selectedNotif && selectedNotif.clientType) || 'individual'}
                    loadReservation={loadReservation}
                    onBack={() => setNotifPane('list')}
                    onConfirm={() => {
                      setIsNotifOpen(false);
                      setNotifPane('list');
                      setSelectedNotif(null);
                      navigate('/transactions');
                    }}
                    onCancel={() => {
                      setIsNotifOpen(false);
                      setNotifPane('list');
                      setSelectedNotif(null);
                      navigate('/reservations');
                    }}
                  />
                )}
              </div>
            )}
          </div>

          <button className={styles.iconButton} onClick={handleMessagesClick}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feather feather-message-square">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
          </button>

          <div className={styles.accountIconWrapper} ref={accountMenuRef}>
            <button className={styles.iconButton} onClick={handleProfileClick}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feather feather-user">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            </button>
            {isAccountMenuOpen && (
              <div className={styles.accountDropdownMenu}>
                <button className={styles.dropdownItem} onClick={handleReservationClick}>Reservations</button>
                <button className={styles.dropdownItem} onClick={handleTransactionsClick}>Transactions</button>
                <button className={styles.dropdownItem} onClick={handleLogoutClick}>Log out</button>
              </div>
            )}
          </div>
        </div>
      </div>

      <button className={styles.hamburgerButton} onClick={toggleMenu}>
        <svg fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
          <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd"></path>
        </svg>
      </button>
    </header>
  );
}

export default HeaderHome;
