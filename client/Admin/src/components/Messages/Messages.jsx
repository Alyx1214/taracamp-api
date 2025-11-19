import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Search, MoreVertical, Trash2 } from "lucide-react";
import styles from "./Messages.module.css";
import { listUsersWithMessages, getMessagesForUser, sendAdminReply, deleteConversation } from "../../apis/messageApi";
import { subscribe, initSocketFresh, startAutoReconnect, stopAutoReconnect } from "../../utils/webSocketClient";

export default function Messages() {
    const [users, setUsers] = useState([]);
    const [activeUserId, setActiveUserId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [sidebarWidth, setSidebarWidth] = useState(280);
    const [isResizing, setIsResizing] = useState(false);
    const [hoveredUserId, setHoveredUserId] = useState(null);
    const messagesEndRef = useRef(null);

    // Load users with messages
    useEffect(() => {
        let cancelled = false;
        async function loadUsers() {
            setLoading(true);
            setError(null);
            try {
                const response = await listUsersWithMessages();
                const usersList = Array.isArray(response?.data) ? response.data : [];
                if (!cancelled) {
                    // Create a new array reference to ensure React detects the change
                    setUsers([...usersList]);
                    if (usersList.length > 0) {
                        setActiveUserId(prev => prev || usersList[0]._id);
                    }
                }
            } catch (err) {
                if (!cancelled) {
                    setError(err?.data?.error || err?.message || "Failed to load users");
                    console.error("Error loading users:", err);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        loadUsers();
        return () => { cancelled = true; };
    }, []);

    // Load messages for active user
    useEffect(() => {
        if (!activeUserId) return;
        let cancelled = false;
        async function loadMessages() {
            setMessages([]);
            setError(null);
            try {
                const response = await getMessagesForUser(activeUserId, { limit: 50 });
                const messagesList = Array.isArray(response?.data) ? response.data : [];
                if (!cancelled) {
                    setMessages([...messagesList].reverse());
                    // Refresh users list to update unread counts (messages are marked as read on server)
                    listUsersWithMessages()
                        .then(response => {
                            if (!cancelled) {
                                const usersList = Array.isArray(response?.data) ? response.data : [];
                                // Create a new array reference to ensure React detects the change
                                setUsers([...usersList]);
                            }
                        })
                        .catch((err) => {
                            console.error('Error refreshing users list:', err);
                        });
                }
            } catch (err) {
                if (!cancelled) {
                    setError(err?.data?.error || err?.message || "Failed to load messages");
                    console.error("Error loading messages:", err);
                }
            }
        }
        loadMessages();
        return () => { cancelled = true; };
    }, [activeUserId]);

    // Scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages.length, activeUserId]);

    // WebSocket subscription for real-time messages
    useEffect(() => {
        initSocketFresh().catch(() => {});
        startAutoReconnect();

        const handleWebSocketMessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'new_message' && data.data) {
                    const newMessage = data.data;
                    if (!newMessage || !newMessage.userId) {
                        console.warn('Received invalid message format:', newMessage);
                        return;
                    }
                    
                    const messageUserId = String(newMessage.userId);
                    const currentActiveUserId = activeUserId ? String(activeUserId) : null;
                    
                    // Normalize IDs for comparison - ensure both are strings
                    const isForActiveUser = currentActiveUserId && messageUserId === currentActiveUserId;
                    
                    // If message is for the currently active user, add it to messages immediately
                    if (isForActiveUser) {
                        setMessages(prev => {
                            // Check if message already exists to avoid duplicates
                            const exists = prev.some(m => {
                                const prevId = m._id ? String(m._id) : null;
                                const newId = newMessage._id ? String(newMessage._id) : null;
                                return prevId && newId && prevId === newId;
                            });
                            if (exists) {
                                return prev;
                            }
                            // Add new message to the end
                            return [...prev, newMessage];
                        });
                    }
                    
                    // Update users list in real-time when receiving any new message (from guest or admin)
                    // Update local state immediately for instant UI update and sorting
                    setUsers(prevUsers => {
                        const updatedUsers = prevUsers.map(user => {
                            const userIdStr = String(user._id);
                            if (userIdStr === messageUserId) {
                                // Update this user's lastMessage with the new message
                                return {
                                    ...user,
                                    lastMessage: {
                                        _id: newMessage._id,
                                        userId: newMessage.userId,
                                        sender: newMessage.sender || (newMessage.isUser ? user.name : 'Admin'),
                                        text: newMessage.text,
                                        isUser: newMessage.isUser,
                                        isRead: newMessage.isRead,
                                        timeLabel: newMessage.timeLabel || 'now',
                                        createdAt: newMessage.createdAt
                                    },
                                    // Update unread count if it's a user message
                                    unreadCount: newMessage.isUser && !newMessage.isRead 
                                        ? (user.unreadCount || 0) + 1 
                                        : (newMessage.isUser && newMessage.isRead ? Math.max(0, (user.unreadCount || 0) - 1) : user.unreadCount)
                                };
                            }
                            return user;
                        });
                        
                        // If user doesn't exist in the list, fetch from server
                        const userExists = updatedUsers.some(u => String(u._id) === messageUserId);
                        if (!userExists) {
                            // User not in list, fetch from server (async, won't block UI update)
                            setTimeout(() => {
                                listUsersWithMessages()
                                    .then(response => {
                                        const usersList = Array.isArray(response?.data) ? response.data : [];
                                        setUsers([...usersList]);
                                    })
                                    .catch((err) => {
                                        console.error('Error fetching users list:', err);
                                    });
                            }, 0);
                        }
                        
                        // Return updated users - useMemo will automatically re-sort
                        // Create a new array reference to ensure React detects the change
                        return [...updatedUsers];
                    });
                    
                    // Also fetch from server in background to ensure consistency
                    // This runs after the immediate update to sync with server state
                    setTimeout(() => {
                        listUsersWithMessages()
                            .then(response => {
                                const usersList = Array.isArray(response?.data) ? response.data : [];
                                setUsers([...usersList]);
                            })
                            .catch((err) => {
                                console.error('Error updating users list:', err);
                            });
                    }, 500); // Small delay to avoid race conditions
                    
                    // If this message is for the active user, ensure it's in the messages list
                    // (in case activeUserId was null when message arrived)
                    if (isForActiveUser) {
                        setMessages(prev => {
                            const exists = prev.some(m => {
                                const prevId = m._id ? String(m._id) : null;
                                const newId = newMessage._id ? String(newMessage._id) : null;
                                return prevId && newId && prevId === newId;
                            });
                            if (!exists) {
                                return [...prev, newMessage];
                            }
                            return prev;
                        });
                    }
                }
            } catch (error) {
                console.error('Error parsing WebSocket message:', error, event.data);
            }
        };

        const unsubscribe = subscribe(handleWebSocketMessage);

        return () => {
            unsubscribe();
            stopAutoReconnect();
        };
    }, [activeUserId]);

    // Handle resizing
    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!isResizing) return;
            const newWidth = e.clientX - 40; // 40px is the left padding
            if (newWidth >= 200 && newWidth <= 500) {
                setSidebarWidth(newWidth);
            }
        };

        const handleMouseUp = () => {
            setIsResizing(false);
        };

        if (isResizing) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing]);

    const handleSend = useCallback(async (e) => {
        e.preventDefault();
        if (!input.trim() || !activeUserId || sending) return;

        const text = input.trim();
        setInput("");
        setSending(true);

        const optimisticMessage = {
            _id: `temp-${Date.now()}`,
            sender: "You",
            text,
            isUser: false,
            timeLabel: "now",
            createdAt: new Date(),
        };
        setMessages(prev => [...prev, optimisticMessage]);

        try {
            const response = await sendAdminReply(activeUserId, { text });
            const savedMessage = response?.data;
            if (savedMessage) {
                setMessages(prev => {
                    const withoutTemp = prev.filter(m => m._id !== optimisticMessage._id);
                    return [...withoutTemp, savedMessage];
                });
                
                // Immediately update users list to trigger real-time sorting
                setUsers(prevUsers => {
                    const updatedUsers = prevUsers.map(user => {
                        const userIdStr = String(user._id);
                        const activeUserIdStr = String(activeUserId);
                        if (userIdStr === activeUserIdStr) {
                            // Update this user's lastMessage with the admin's reply
                            return {
                                ...user,
                                lastMessage: {
                                    _id: savedMessage._id,
                                    userId: savedMessage.userId,
                                    sender: savedMessage.sender || 'Admin',
                                    text: savedMessage.text,
                                    isUser: savedMessage.isUser || false,
                                    isRead: savedMessage.isRead || false,
                                    timeLabel: savedMessage.timeLabel || 'now',
                                    createdAt: savedMessage.createdAt
                                }
                            };
                        }
                        return user;
                    });
                    // Create a new array reference to ensure React detects the change
                    return [...updatedUsers];
                });
            }
        } catch (err) {
            setMessages(prev => prev.filter(m => m._id !== optimisticMessage._id));
            setError(err?.data?.error || err?.message || "Failed to send message");
            console.error("Error sending message:", err);
        } finally {
            setSending(false);
        }
    }, [input, activeUserId, sending]);

    const handleDeleteChat = useCallback(async (userId, e) => {
        e.stopPropagation();
        if (!window.confirm('Are you sure you want to delete this conversation? This action cannot be undone.')) {
            return;
        }

        try {
            const response = await deleteConversation(userId);
            if (response?.status === 200 || response?.data?.status === 200) {
                // Remove user from list
                setUsers(prev => {
                    const updated = prev.filter(u => u._id !== userId);
                    // If this was the active user, switch to another user or clear
                    if (activeUserId === userId) {
                        if (updated.length > 0) {
                            setActiveUserId(updated[0]._id);
                        } else {
                            setActiveUserId(null);
                            setMessages([]);
                        }
                    }
                    return updated;
                });
            } else {
                setError(response?.data?.error || response?.error || 'Failed to delete conversation');
            }
        } catch (err) {
            setError(err?.data?.error || err?.message || 'Failed to delete conversation');
            console.error('Error deleting conversation:', err);
        }
    }, [activeUserId]);

    // Sort users by latest message (regardless of sender) - most recent first
    // Use useMemo to ensure sorting recalculates when users state changes
    const sortedUsers = useMemo(() => {
        return [...users].sort((a, b) => {
        const aLastMessage = a.lastMessage;
        const bLastMessage = b.lastMessage;
        
        // Users without messages go to the end
        if (!aLastMessage && !bLastMessage) return 0;
        if (!aLastMessage) return 1;
        if (!bLastMessage) return -1;
        
        // Sort by createdAt timestamp (most recent first)
        // Handle different date formats (Date object, ISO string, timestamp)
        let aTime = 0;
        let bTime = 0;
        
        try {
            if (aLastMessage && aLastMessage.createdAt) {
                const dateValue = aLastMessage.createdAt;
                if (dateValue instanceof Date) {
                    aTime = dateValue.getTime();
                } else if (typeof dateValue === 'string' || typeof dateValue === 'number') {
                    const date = new Date(dateValue);
                    aTime = isNaN(date.getTime()) ? 0 : date.getTime();
                }
            }
        } catch (e) {
            console.warn('Error parsing date for user', a.name, aLastMessage?.createdAt, e);
            aTime = 0;
        }
        
        try {
            if (bLastMessage && bLastMessage.createdAt) {
                const dateValue = bLastMessage.createdAt;
                if (dateValue instanceof Date) {
                    bTime = dateValue.getTime();
                } else if (typeof dateValue === 'string' || typeof dateValue === 'number') {
                    const date = new Date(dateValue);
                    bTime = isNaN(date.getTime()) ? 0 : date.getTime();
                }
            }
        } catch (e) {
            console.warn('Error parsing date for user', b.name, bLastMessage?.createdAt, e);
            bTime = 0;
        }
        
        // Compare timestamps - most recent first (descending order)
        // If times are equal, maintain original order
        if (bTime === aTime) return 0;
        return bTime - aTime;
        });
    }, [users]);

    const filteredUsers = sortedUsers.filter(user => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return (
            user.name?.toLowerCase().includes(query) ||
            user.email?.toLowerCase().includes(query)
        );
    });

    const activeUser = users.find(u => u._id === activeUserId);

    const handleSearchClick = () => {
        // Search is handled by filteredUsers automatically
    };

    const handleResizeStart = (e) => {
        e.preventDefault();
        setIsResizing(true);
    };

    // Helper function to check if user has unread messages from client
    const hasUnreadClientMessages = (user) => {
        // Check if user has unreadCount property (messages from client not read by admin)
        const count = Number(user?.unreadCount) || 0;
        return count > 0;
    };

    return (
        <>
            <div className={styles["messages-header"]}>
                <h1 className={styles["messages-header__title"]}>MESSAGES</h1>
                <div className={styles["searchFilContainer"]}>
                    <input
                        type="text"
                        className={styles["input"]}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search users..."
                    />
                    <button 
                        type="button" 
                        className={styles["iconButton"]}
                        onClick={handleSearchClick}
                        aria-label="Search"
                    >
                        <Search />
                    </button>
                </div>
            </div>

            {error && (
                <div style={{ padding: "10px", background: "#fee", color: "#c00", margin: "10px" }}>
                    {error}
                </div>
            )}

            <div className={styles["messenger-container"]}>
                <aside className={styles["messenger-sidebar"]} style={{ width: `${sidebarWidth}px` }}>
                    <h2 className={styles["messenger-title"]}>Chats</h2>
                    {loading ? (
                        <div style={{ padding: "20px", textAlign: "center" }}>Loading...</div>
                    ) : filteredUsers.length === 0 ? (
                        <div style={{ padding: "20px", textAlign: "center", color: "#666" }}>
                            No users with messages found
                        </div>
                    ) : (
                        <ul className={styles["messenger-list"]}>
                            {filteredUsers.map((user) => (
                                <li
                                    key={user._id}
                                    className={`${styles["messenger-list-item"]} ${
                                        activeUserId === user._id ? styles["active"] : ""
                                    }`}
                                    onClick={() => setActiveUserId(user._id)}
                                    onMouseEnter={() => setHoveredUserId(user._id)}
                                    onMouseLeave={() => setHoveredUserId(null)}
                                >
                                    <div className={styles["user-item-content"]}>
                                        <div className={styles["user-info"]}>
                                            {hasUnreadClientMessages(user) ? (
                                                <span 
                                                    className={styles["unread-indicator"]} 
                                                    title="New message"
                                                    aria-label="New message"
                                                />
                                            ) : null}
                                            <span className={styles["user-name"]}>{user.name || "Unknown"}</span>
                                        </div>
                                        {hoveredUserId === user._id && (
                                            <button
                                                className={styles["delete-btn"]}
                                                onClick={(e) => handleDeleteChat(user._id, e)}
                                                aria-label="Delete conversation"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </aside>
                
                <div 
                    className={styles["resizer"]}
                    onMouseDown={handleResizeStart}
                />

                <main className={styles["messenger-main"]}>
                    {activeUser ? (
                        <>
                            <div className={styles["messenger-header"]}>
                                <span className={styles["messenger-chat-name"]}>
                                    {activeUser.name || "Unknown User"}
                                </span>
                                {activeUser.email && (
                                    <span style={{ fontSize: "12px", color: "#666", marginLeft: "10px" }}>
                                        {activeUser.email}
                                    </span>
                                )}
                            </div>
                            <div className={styles["messenger-messages"]}>
                                {messages.length === 0 ? (
                                    <div style={{ padding: "20px", textAlign: "center", color: "#666" }}>
                                        No messages yet
                                    </div>
                                ) : (
                                    messages.map((msg) => {
                                        const isAdminMessage = !msg.isUser;
                                        return (
                                            <div
                                                key={msg._id}
                                                className={
                                                    isAdminMessage
                                                        ? styles["messenger-message-me"]
                                                        : styles["messenger-message-other"]
                                                }
                                            >
                                                <div
                                                    className={
                                                        isAdminMessage
                                                            ? styles["messenger-message-text-me"]
                                                            : styles["messenger-message-text-other"]
                                                    }
                                                >
                                                    {msg.text}
                                                </div>
                                                <div
                                                    className={
                                                        isAdminMessage
                                                            ? styles["messenger-message-time-me"]
                                                            : styles["messenger-message-time-other"]
                                                    }
                                                >
                                                    {msg.timeLabel || "now"}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                                <div ref={messagesEndRef} />
                            </div>
                            <form
                                className={styles["messenger-input-row"]}
                                onSubmit={handleSend}
                            >
                                <input
                                    type="text"
                                    className={styles["messenger-input"]}
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    placeholder="Type a message..."
                                    disabled={sending}
                                />
                                <button
                                    className={styles["messenger-send-btn"]}
                                    type="submit"
                                    disabled={sending || !input.trim()}
                                >
                                    {sending ? "Sending..." : "Send"}
                                </button>
                            </form>
                        </>
                    ) : (
                        <div style={{ padding: "40px", textAlign: "center", color: "#666" }}>
                            Select a user to view messages
                        </div>
                    )}
                </main>
            </div>
        </>
    );
}