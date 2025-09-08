import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import styles from './HeaderHome.module.css';
import mountainLogo from '../../assets/logo.png';
import Notif from '../Notification/Notif';
import Message from '../Message/Message';

let refreshingPromise = null;

function getAccessToken() {
  return localStorage.getItem('accessToken');
}
function getRefreshToken() {
  return localStorage.getItem('refreshToken');
}
function setTokens({ accessToken, refreshToken }) {
  if (accessToken) localStorage.setItem('accessToken', accessToken);
  if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
}

async function callRefresh() {
  if (refreshingPromise) return refreshingPromise;
  const rt = getRefreshToken();
  if (!rt) throw new Error('No refresh token');

  refreshingPromise = fetch('/api/user/refresh-token', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: rt }),
  })
    .then(async (res) => {
      const json = await res.json().catch(() => ({}));
      const ok = res.ok && (json?.accessToken || json?.status === 200);
      if (!ok) throw new Error(json?.error || `HTTP ${res.status}`);
      setTokens({ accessToken: json.accessToken, refreshToken: json.refreshToken });
      return json.accessToken;
    })
    .finally(() => { refreshingPromise = null; });

  return refreshingPromise;
}

async function authFetch(url, opts = {}, didRetry = false) {
  const token = getAccessToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(opts.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(url, { credentials: 'include', ...opts, headers });
  if (res.status !== 401 || didRetry) return res;

  try {
    await callRefresh();
  } catch {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    throw new Error('Unauthorized');
  }

  const newToken = getAccessToken();
  const retryHeaders = {
    'Content-Type': 'application/json',
    ...(opts.headers || {}),
    ...(newToken ? { Authorization: `Bearer ${newToken}` } : {}),
  };
  return fetch(url, { credentials: 'include', ...opts, headers: retryHeaders });
}

async function api(path, opts = {}) {
  const res = await authFetch(path, opts);
  const text = await res.text().catch(() => '');
  if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
  return text ? JSON.parse(text) : {};
}
/* ================== end auth-aware fetch ================== */

function HeaderHome() {
  const navigate = useNavigate();
  const location = useLocation();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  // Notifications badge
  const [unreadCount, setUnreadCount] = useState(0);

  // Messages dropdown state
  const [isMsgOpen, setIsMsgOpen] = useState(false);
  const [msgUnreadCount, setMsgUnreadCount] = useState(0);
  const [messages, setMessages] = useState([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [msgDraft, setMsgDraft] = useState('');
  const [msgSending, setMsgSending] = useState(false);

  const accountMenuRef = useRef(null);
  const notifMenuRef = useRef(null);
  const msgMenuRef = useRef(null);

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 992);

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth <= 992);
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Close menus when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      // Don’t auto-close menus if hamburger menu is open
      if (isMobile && isMenuOpen) return;

      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target)) {
        setIsAccountMenuOpen(false);
      }
      if (notifMenuRef.current && !notifMenuRef.current.contains(event.target)) {
        setIsNotifOpen(false);
      }
      if (msgMenuRef.current && !msgMenuRef.current.contains(event.target)) {
        setIsMsgOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMobile, isMenuOpen]);

  // Fetch unread notifications when panel opens; refresh while open
  useEffect(() => {
    let timer;
    let cancelled = false;

    async function refreshCount() {
      try {
        const json = await api('/api/notification/count-unread');
        if (!cancelled) setUnreadCount(Number(json?.data?.count || 0));
      } catch {
        // ignore badge errors
      }
    }

    if (isNotifOpen) {
      refreshCount();
      timer = setInterval(refreshCount, 20000);
    }
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [isNotifOpen]);

  // Refresh notification badge on route change
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const json = await api('/api/notification/count-unread');
        if (!cancelled) setUnreadCount(Number(json?.data?.count || 0));
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [location.pathname]);

  // Load messages when opening the dropdown
  useEffect(() => {
    let cancelled = false;
    async function loadMessages() {
      try {
        setMsgLoading(true);
        // Replace with your API:
        // const json = await api('/api/message/list');
        // const items = json?.data ?? [];
        const items = [
          { _id: 'm1', sender: 'Front Desk', role: 'Support', text: 'Hi! Your booking is confirmed. Need anything else?', timeLabel: '3m', isRead: false, isUser: false },
          { _id: 'm2', sender: 'You', text: 'Thanks! What time is check-in?', timeLabel: '7m', isRead: true, isUser: true },
          { _id: 'm3', sender: 'Front Desk', role: 'Support', text: 'Check-in starts at 2 PM. See you soon!', timeLabel: '10m', isRead: false, isUser: false },
        ];
        if (!cancelled) setMessages(items);
      } catch {
        if (!cancelled) setMessages([]);
      } finally {
        if (!cancelled) setMsgLoading(false);
      }
    }
    if (isMsgOpen) loadMessages();
    return () => { cancelled = true; };
  }, [isMsgOpen]);

  // Unread messages badge: refresh while open
  useEffect(() => {
    let timer;
    let cancelled = false;
    async function refreshCount() {
      try {
        // const json = await api('/api/message/count-unread');
        // if (!cancelled) setMsgUnreadCount(Number(json?.data?.count || 0));
        if (!cancelled) setMsgUnreadCount(2); // demo placeholder
      } catch {
        // ignore badge errors
      }
    }
    if (isMsgOpen) {
      refreshCount();
      timer = setInterval(refreshCount, 20000);
    }
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [isMsgOpen]);

  // Also refresh message badge on route change
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // const json = await api('/api/message/count-unread');
        // if (!cancelled) setMsgUnreadCount(Number(json?.data?.count || 0));
        if (!cancelled) setMsgUnreadCount(2); // demo
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [location.pathname]);

  const handleNavLinkClick = (path, sectionId) => {
    setIsMenuOpen(false);
    setIsAccountMenuOpen(false);
    setIsNotifOpen(false);
    setIsMsgOpen(false);

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
    setIsMsgOpen(false);
  };

  const handleProfileClick = () => {
    setIsAccountMenuOpen(prev => !prev);
    if (!isMobile) setIsMenuOpen(false);  // only close nav on desktop
    setIsNotifOpen(false);
    setIsMsgOpen(false);
  };


  const handleNotificationsClick = () => {
    setIsNotifOpen(prev => !prev);
    if (!isMobile) setIsMenuOpen(false);
    setIsAccountMenuOpen(false);
    setIsMsgOpen(false);
  };

  const handleMessagesClick = () => {
    setIsMsgOpen(prev => !prev);
    if (!isMobile) setIsMenuOpen(false);
    setIsAccountMenuOpen(false);
    setIsNotifOpen(false);
  };

  const handleSendMessage = async () => {
    const text = msgDraft.trim();
    if (!text || msgSending) return;
    setMsgSending(true);
    const optimistic = {
      _id: `tmp-${Date.now()}`,
      sender: 'You',
      text,
      isUser: true,
      isRead: true,
      timeLabel: 'now',
    };
    setMessages((prev) => [optimistic, ...prev]);
    setMsgDraft('');
    try {
      // Replace with your API call
      // await api('/api/message/send', { method: 'POST', body: JSON.stringify({ text }) });
    } catch (e) {
      // revert optimistic add on error
      setMessages((prev) => prev.filter((m) => m._id !== optimistic._id));
      setMsgDraft(text);
    } finally {
      setMsgSending(false);
    }
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

  return (
    <header className={styles.headerContainer}>
      <div className={styles.logoGroup}>
        <a onClick={() => handleNavLinkClick('/', 'hero')} className={styles.headerLogoLink}>
          <img src={mountainLogo} alt="Baguio Teachers Camp Logo" className={styles.headerLogo} />
          <p className={styles.headerLogoText}>Baguio Teachers' Camp</p>
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

        {/* Mobile-only user icons inside hamburger */}
          <div className={styles.mobileUserIcons}>
            {/* Notifications */}
            <div className={styles.accountIconWrapper} ref={notifMenuRef}>
              <button className={styles.iconButton} onClick={handleNotificationsClick}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    className="feather feather-bell">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                </svg>
                {unreadCount > 0 && <span className={styles.badge}>{unreadCount}</span>}
              </button>
              {isNotifOpen && (
                <div className={styles.accountDropdownMenu}>
                  <Notif onMarkAllAsRead={() => setUnreadCount(0)} />
                </div>
              )}
            </div>

            {/* Messages */}
            <div className={styles.accountIconWrapper} ref={msgMenuRef}>
              <button className={styles.iconButton} onClick={handleMessagesClick}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    className="feather feather-message-square">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 1 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
                {msgUnreadCount > 0 && <span className={styles.badge}>{msgUnreadCount}</span>}
              </button>
              {isMsgOpen && (
                <div className={styles.accountDropdownMenu} role="dialog" aria-label="Messages">
                  <div className={styles.msgHeaderRow}>
                    <span className={styles.msgHeaderTitle}>Messages</span>
                    <button
                      className={styles.markAllBtn}
                      onClick={() => {
                        setMessages(arr => arr.map(m => ({ ...m, isRead: true })));
                        setMsgUnreadCount(0);
                        // api('/api/message/mark-all-read', { method: 'POST' }).catch(()=>{});
                      }}
                    >
                      Mark all as Read
                    </button>
                  </div>

                  <div className={styles.msgList}>
                    {msgLoading && <div className={styles.msgEmpty}>Loading…</div>}
                    {!msgLoading && messages.length === 0 && (
                      <div className={styles.msgEmpty}>No messages yet.</div>
                    )}
                    {!msgLoading && messages.map(m => (
                      <div key={m._id} className={m.isRead ? styles.msgItemRead : styles.msgItem}>
                        <div className={styles.msgMetaRow}>
                          <span className={styles.msgTime}>{m.timeLabel}</span>
                        </div>
                        <Message sender={m.sender} text={m.text} isUser={m.isUser} role={m.role} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Account */}
            <div className={styles.accountIconWrapper} ref={accountMenuRef}>
              <button className={styles.iconButton} onClick={handleProfileClick}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    className="feather feather-user">
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
      </nav>

      <div className={styles.desktopActions}>
        <div className={styles.userIconsGroup}>
          {/* Notifications */}
          <div className={styles.accountIconWrapper} ref={notifMenuRef}>
            <button
              className={styles.iconButton}
              onClick={handleNotificationsClick}
              aria-haspopup="dialog"
              aria-expanded={isNotifOpen}
              aria-controls="notif-dropdown"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none"
                   stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                   className="feather feather-bell">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
              </svg>
              {unreadCount > 0 && <span className={styles.badge}>{unreadCount}</span>}
            </button>

            {isNotifOpen && (
              <div id="notif-dropdown" className={styles.accountDropdownMenu} role="dialog" aria-label="Notifications">
                <Notif onMarkAllAsRead={() => setUnreadCount(0)} />
              </div>
            )}
          </div>

          {/* Messages dropdown that reuses Message.jsx */}
          <div className={styles.accountIconWrapper} ref={msgMenuRef}>
            <button
              className={styles.iconButton}
              onClick={handleMessagesClick}
              aria-haspopup="dialog"
              aria-expanded={isMsgOpen}
              aria-controls="msg-dropdown"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none"
                   stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                   className="feather feather-message-square">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
              {msgUnreadCount > 0 && <span className={styles.badge}>{msgUnreadCount}</span>}
            </button>

            {isMsgOpen && (
              <div id="msg-dropdown" className={styles.accountDropdownMenu} role="dialog" aria-label="Messages">
                <div className={styles.msgHeaderRow}>
                  <span className={styles.msgHeaderTitle}>Messages</span>
                  <button
                    className={styles.markAllBtn}
                    onClick={() => {
                      setMessages(arr => arr.map(m => ({ ...m, isRead: true })));
                      setMsgUnreadCount(0);
                      // Optionally persist:
                      // api('/api/message/mark-all-read', { method: 'POST' }).catch(()=>{});
                    }}
                  >
                    Mark all as Read
                  </button>
                </div>

                <div className={styles.msgList}>
                  {msgLoading && <div className={styles.msgEmpty}>Loading…</div>}
                  {!msgLoading && messages.length === 0 && (
                    <div className={styles.msgEmpty}>No messages yet.</div>
                  )}
                  {!msgLoading && messages.map(m => (
                    <div key={m._id} className={m.isRead ? styles.msgItemRead : styles.msgItem}>
                      <div className={styles.msgMetaRow}>
                        <span className={styles.msgTime}>{m.timeLabel}</span>
                      </div>
                      <Message sender={m.sender} text={m.text} isUser={m.isUser} role={m.role} />
                    </div>
                  ))}
                </div>
                <div className={styles.msgTypingRow}>
                  <input
                    type="text"
                    className={styles.msgInput}
                    placeholder="Type a message…"
                    value={msgDraft}
                    onChange={(e) => setMsgDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSendMessage(); } }}
                    disabled={msgSending}
                    aria-label="Message input"
                  />
                  <button
                    className={styles.msgSendBtn}
                    onClick={handleSendMessage}
                    disabled={msgSending || !msgDraft.trim()}
                    aria-label="Send message"
                    title="Send"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13"></line>
                      <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Account menu */}
          <div className={styles.accountIconWrapper} ref={accountMenuRef}>
            <button className={styles.iconButton} onClick={handleProfileClick}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none"
                   stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                   className="feather feather-user">
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

      {/* Mobile hamburger */}
      <button className={styles.hamburgerButton} onClick={toggleMenu}>
        <svg fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
          <path fillRule="evenodd"
                d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
                clipRule="evenodd"></path>
        </svg>
      </button>
    </header>
  );
}

export default HeaderHome;
