import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import styles from './HeaderHome.module.css';
import mountainLogo from '../../assets/logo.png';
import Notif from '../Notification/Notif';
import { countUnreadNotifications } from '../../apis/notificationApi';
import Message, { MessageSkeleton } from '../Message/Message';
import { tryRefresh, clearTokens, ensureFreshAccess } from '../../apis/api';
import {
  listMessages,
  countUnreadMessages,
  sendMessage as sendMessageApi,
  markAllMessagesRead,
} from '../../apis/messageApi';
import { subscribe, initSocketFresh, startAutoReconnect, stopAutoReconnect } from '../../utils/webSocketClient';

let refreshingPromise = null;
const MIN_UNREAD_REFRESH_MS = 1200;

function getAccessToken() {
  return localStorage.getItem('accessToken');
}

function getMessageTimestamp(message) {
  const source = message?.createdAt ?? message?.created_at ?? message?.timestamp;
  if (source === undefined || source === null || source === '') return null;

  if (source instanceof Date && !Number.isNaN(source.getTime())) {
    return source.getTime();
  }

  const time = new Date(source).getTime();
  return Number.isNaN(time) ? null : time;
}

function sortMessagesAscending(messages = []) {
  if (!Array.isArray(messages)) return [];

  return [...messages]
    .map((message, index) => {
      const timestamp = getMessageTimestamp(message);
      return {
        message,
        timestamp,
        index,
      };
    })
    .sort((a, b) => {
      if (a.timestamp === null && b.timestamp === null) return a.index - b.index;
      if (a.timestamp === null) return -1;
      if (b.timestamp === null) return 1;
      if (a.timestamp === b.timestamp) return a.index - b.index;
      return a.timestamp - b.timestamp;
    })
    .map((entry) => entry.message);
}

async function callRefresh() {
  if (refreshingPromise) return refreshingPromise;

  refreshingPromise = tryRefresh()
    .then((token) => {
      if (!token) throw new Error('Unable to refresh access token');
      return token;
    })
    .finally(() => {
      refreshingPromise = null;
    });

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

  let newToken;
  try {
    newToken = await callRefresh();
  } catch {
    clearTokens();
    throw new Error('Unauthorized');
  }

  if (!newToken) {
    clearTokens();
    throw new Error('Unauthorized');
  }

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

  const unreadCountInFlightRef = useRef(null);
  const unreadCountLastFetchedRef = useRef(0);
  const unreadCountLastValueRef = useRef(0);
  const headerMountedRef = useRef(true);
  const unreadReadyRef = useRef(false);

  const accountMenuRef = useRef(null);
  const notifMenuRef = useRef(null);
  const msgMenuRef = useRef(null);
  const msgListRef = useRef(null);
  const msgListUserScrolledRef = useRef(false);
  const messagesLastFetchedRef = useRef(0);
  const MESSAGE_CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes - server already handles caching, this is just for instant UX

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 992);

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth <= 992);
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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
    if (isNotifOpen) {
      refreshUnreadCount({ force: true }).catch(() => {});
      timer = setInterval(() => {
        refreshUnreadCount({ force: true }).catch(() => {});
      }, 20000);
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

  useEffect(() => {
    refreshUnreadCount({ force: true }).catch(() => {});
  }, [refreshUnreadCount]);

  // Load messages when opening the dropdown (following notification pattern)
  useEffect(() => {
    let cancelled = false;
    async function loadMessages() {
      const now = Date.now();
      const cacheAge = now - messagesLastFetchedRef.current;
      const hasCache = messages.length > 0;
      const cacheFresh = cacheAge < MESSAGE_CACHE_TTL_MS;
      
      // Use cached messages if available and fresh (< 2 minutes old) for instant UX
      if (hasCache && cacheFresh && !cancelled) {
        // Still check if we need to mark as read
        const unreadCount = messages.filter((m) => !m.isRead).length;
        if (unreadCount > 0) {
          try {
            await markAllMessagesRead();
            setMessages(arr => arr.map(m => ({ ...m, isRead: true })));
            setMsgUnreadCount(0);
          } catch (err) {
            console.error('Failed to mark messages as read:', err);
          }
        }
        msgListUserScrolledRef.current = false;
        return;
      }
      
      // Fetch fresh messages
      try {
        setMsgLoading(true);
        const response = await listMessages({ limit: 20 });
        const items = Array.isArray(response?.data) ? response.data : [];
        if (!cancelled) {
          setMessages(sortMessagesAscending(items));
          messagesLastFetchedRef.current = Date.now();
          const unreadCount = items.filter((m) => !m.isRead).length;
          setMsgUnreadCount(unreadCount);
          msgListUserScrolledRef.current = false;
          
          // Automatically mark all messages as read when opening the dropdown
          if (unreadCount > 0) {
            try {
              await markAllMessagesRead();
              setMessages(arr => arr.map(m => ({ ...m, isRead: true })));
              setMsgUnreadCount(0);
            } catch (err) {
              // Silently fail - badge will refresh from server
              console.error('Failed to mark messages as read:', err);
            }
          }
        }
      } catch {
        if (!cancelled) {
          // Don't clear cache on error, just keep existing messages
          if (messages.length === 0) {
            setMessages([]);
          }
        }
      } finally {
        if (!cancelled) setMsgLoading(false);
      }
    }
    if (isMsgOpen) loadMessages();
    return () => { cancelled = true; };
  }, [isMsgOpen]);


  // Unread messages badge: refresh while open (following notification pattern - 20 seconds)
  useEffect(() => {
    let timer;
    let cancelled = false;
    async function refreshCount() {
      try {
        const response = await countUnreadMessages();
        if (!cancelled) setMsgUnreadCount(Number(response?.data?.count || 0));
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
        const response = await countUnreadMessages();
        if (!cancelled) setMsgUnreadCount(Number(response?.data?.count || 0));
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [location.pathname]);

  // WebSocket connection and message handling (following notification pattern)
  useEffect(() => {
    // Initialize WebSocket connection and start auto-reconnect
    const API_ORIGIN = 'https://taracamp-api.onrender.comonrender.com';
    
    // Initialize WebSocket immediately
    initSocketFresh(API_ORIGIN).catch(() => {});
    
    // Start auto-reconnect to maintain the connection
    // This will check every 30 seconds and reconnect if needed
    startAutoReconnect(ensureFreshAccess, API_ORIGIN, 30000);

    const handleWebSocketMessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'new_message') {
          const newMessage = data.data;
          
          // Skip user's own messages as they're already handled by optimistic updates
          if (newMessage.isUser) {
            return;
          }
          
          // Immediately add to messages list if it doesn't already exist (following notification pattern)
          setMessages(prev => {
            // Check if message already exists to avoid duplicates
            const exists = prev.some(m => m._id === newMessage._id);
            if (exists) return prev;
            
            // Add new message and sort by timestamp
            const updated = sortMessagesAscending([...prev, newMessage]);
            // Update cache timestamp to reflect new message
            messagesLastFetchedRef.current = Date.now();
            return updated;
          });
          
          // Update unread count for non-user messages
          setMsgUnreadCount(prev => prev + 1);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    // Subscribe to WebSocket messages
    const unsubscribe = subscribe(handleWebSocketMessage);

    return () => {
      unsubscribe();
      // Stop auto-reconnect when component unmounts
      stopAutoReconnect();
    };
  }, []);

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
    setIsMsgOpen(prev => {
      const next = !prev;
      if (next) {
        msgListUserScrolledRef.current = false;
        setTimeout(() => {
          const list = msgListRef.current;
          if (list) list.scrollTop = list.scrollHeight;
        }, 0);
      }
      return next;
    });
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
      createdAt: new Date(),
    };
    setMessages((prev) => sortMessagesAscending([...prev, optimistic]));
    setMsgDraft('');
    try {
      const response = await sendMessageApi({ text });
      const saved = response?.data || null;
      setMessages((prev) => {
        const withoutOptimistic = prev.filter((m) => m._id !== optimistic._id);
        if (!saved) return sortMessagesAscending(withoutOptimistic);
        return sortMessagesAscending([...withoutOptimistic, saved]);
      });
    } catch (e) {
      setMessages((prev) => prev.filter((m) => m._id !== optimistic._id));
      setMsgDraft(text);
    } finally {
      setMsgSending(false);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllMessagesRead();
      setMessages(arr => arr.map(m => ({ ...m, isRead: true })));
      setMsgUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all messages as read:', err);
    }
  };

  const handleMessageListScroll = useCallback(() => {
    const list = msgListRef.current;
    if (!list) return;

    const distanceFromBottom = list.scrollHeight - list.scrollTop - list.clientHeight;
    msgListUserScrolledRef.current = distanceFromBottom > 60;
  }, []);

  useEffect(() => {
    if (!isMsgOpen) return;
    const list = msgListRef.current;
    if (!list) return;

    const distanceFromBottom = list.scrollHeight - list.scrollTop - list.clientHeight;
    const shouldStick = !msgListUserScrolledRef.current || distanceFromBottom < 120;
    if (shouldStick) {
      list.scrollTop = list.scrollHeight;
      msgListUserScrolledRef.current = false;
    }
  }, [messages, isMsgOpen]);

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
    navigate('/');
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
              <button
                className={`${styles.iconButton} ${isMobile ? styles.mobileNavButton : ''}`}
                onClick={handleNotificationsClick}
              >
                {isMobile ? (
                  'NOTIFICATIONS'
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none"
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                      className="feather feather-bell">
                      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                      <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                    </svg>
                    {unreadCount > 0 && <span className={styles.badge}>{unreadCount}</span>}
                  </>
                )}
              </button>
              {isMobile && isNotifOpen && (
                <div className={styles.fullscreenOverlay}>
                  <div className={styles.fullscreenContent}>
                    <div className={styles.overlayHeader}>
                      <button onClick={() => setIsNotifOpen(false)}>✕</button>
                    </div>
                    <Notif onMarkAllAsRead={() => setUnreadCount(0)} />
                  </div>
                </div>
              )}
            </div>

            {/* Messages */}
            <div className={styles.accountIconWrapper} ref={msgMenuRef}>
              <button
                className={`${styles.iconButton} ${isMobile ? styles.mobileNavButton : ''}`}
                onClick={handleMessagesClick}
              >
                {isMobile ? (
                  'MESSAGES'
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none"
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                      className="feather feather-message-square">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 1 1 2-2h14a2 2 0 0 1 2 2z"></path>
                    </svg>
                    {msgUnreadCount > 0 && <span className={styles.badge}>{msgUnreadCount}</span>}
                  </>
                )}
              </button>
              {isMobile && isMsgOpen && (
                <div className={styles.fullscreenOverlay} role="dialog" aria-label="Messages">
                  <div className={styles.fullscreenContent}>
                    {/* Header Bar */}
                    <div className={styles.msgHeaderRow}>
                      <span className={styles.msgHeaderTitle}>Messages</span>
                      <div className={styles.headerActions}>
                        <button
                          className={styles.markAllBtn}
                          onClick={handleMarkAllAsRead}
                        >
                          Mark all as Read
                        </button>
                        <button
                          className={styles.closeBtn}
                          onClick={() => setIsMsgOpen(false)}
                          aria-label="Close messages"
                        >
                          ✕
                        </button>
                      </div>
                    </div>

                    {/* Message List */}
                    <div className={styles.msgList} ref={msgListRef} onScroll={handleMessageListScroll}>
                      {msgLoading ? (
                        <>
                          <MessageSkeleton compact />
                          <MessageSkeleton isUser compact />
                          <MessageSkeleton compact />
                        </>
                      ) : messages.length === 0 ? (
                        <div className={styles.msgEmpty}>No messages yet.</div>
                      ) : (
                        messages.map(m => (
                          <div key={m._id} className={m.isRead ? styles.msgItemRead : styles.msgItem}>
                            <div className={styles.msgMetaRow}>
                              <span className={styles.msgTime}>{m.timeLabel}</span>
                            </div>
                            <Message sender={m.sender} text={m.text} isUser={m.isUser} role={m.role} />
                          </div>
                        ))
                      )}
                    </div>

                    {/* Input Bar */}
                    <div className={styles.msgTypingRow}>
                      <input
                        type="text"
                        className={styles.msgInput}
                        placeholder="Type a message…"
                        value={msgDraft}
                        onChange={(e) => setMsgDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSendMessage();
                          }
                        }}
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
                </div>
              )}
            </div>

            {/* Account */}
            <div className={styles.accountIconWrapper} ref={accountMenuRef}>
              <button
                className={`${styles.iconButton} ${isMobile ? styles.mobileNavButton : ''}`}
                onClick={handleProfileClick}
              >
                {isMobile ? (
                  'ACCOUNT'
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    className="feather feather-user">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                )}
              </button>
              {isAccountMenuOpen && (
                <div className={styles.preview}>
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
              <div id="notif-dropdown" className={styles.preview} role="dialog" aria-label="Notifications">
                <Notif onMarkAllAsRead={() => setUnreadCount(0)} />
              </div>
            )}
          </div>

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

              {!isMobile && isMsgOpen && (
                <div id="msg-dropdown" className={styles.preview} role="dialog" aria-label="Messages">
                <div className={styles.msgHeaderRow}>
                  <span className={styles.msgHeaderTitle}>Messages</span>
                  <button
                    className={styles.markAllBtn}
                    onClick={handleMarkAllAsRead}
                  >
                    Mark all as Read
                  </button>
                </div>

                <div
                  className={styles.msgList}
                  ref={msgListRef}
                  onScroll={handleMessageListScroll}
                >
                 {msgLoading ? (
                      <>
                        <MessageSkeleton compact />
                        <MessageSkeleton isUser compact />
                        <MessageSkeleton compact />
                      </>
                    ) : messages.length === 0 ? (
                      <div className={styles.msgEmpty}>No messages yet.</div>
                    ) : (
                    messages.map(m => (
                      <div key={m._id} className={m.isRead ? styles.msgItemRead : styles.msgItem}>
                        <div className={styles.msgMetaRow}>
                          <span className={styles.msgTime}>{m.timeLabel}</span>
                        </div>
                        <Message sender={m.sender} text={m.text} isUser={m.isUser} role={m.role} />
                      </div>
                    ))
                  )}
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
              <div className={styles.preview}>
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
