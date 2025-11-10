import React, { useState, useRef, useEffect, useCallback } from "react";
import { Search } from "lucide-react";
import styles from "./Messages.module.css";
import { listUsersWithMessages, getMessagesForUser, sendAdminReply } from "../../apis/messageApi";
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
                    setUsers(usersList);
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
                    const messageUserId = newMessage.userId;
                    
                    if (messageUserId && activeUserId && messageUserId.toString() === activeUserId.toString()) {
                        setMessages(prev => {
                            const exists = prev.some(m => m._id === newMessage._id);
                            if (exists) return prev;
                            return [...prev, newMessage];
                        });
                        
                        listUsersWithMessages()
                            .then(response => {
                                const usersList = Array.isArray(response?.data) ? response.data : [];
                                setUsers(usersList);
                            })
                            .catch(() => {});
                    } else if (messageUserId && newMessage.isUser) {
                        listUsersWithMessages()
                            .then(response => {
                                const usersList = Array.isArray(response?.data) ? response.data : [];
                                setUsers(usersList);
                            })
                            .catch(() => {});
                    }
                }
            } catch (error) {
                console.error('Error parsing WebSocket message:', error);
            }
        };

        const unsubscribe = subscribe(handleWebSocketMessage);

        return () => {
            unsubscribe();
            stopAutoReconnect();
        };
    }, [activeUserId]);

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
            }
        } catch (err) {
            setMessages(prev => prev.filter(m => m._id !== optimisticMessage._id));
            setError(err?.data?.error || err?.message || "Failed to send message");
            console.error("Error sending message:", err);
        } finally {
            setSending(false);
        }
    }, [input, activeUserId, sending]);

    const filteredUsers = users.filter(user => {
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
                <aside className={styles["messenger-sidebar"]}>
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
                                >
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                                        <span>{user.name || "Unknown"}</span>
                                        {user.unreadCount > 0 && (
                                            <span style={{
                                                background: "#007bff",
                                                color: "white",
                                                borderRadius: "50%",
                                                width: "20px",
                                                height: "20px",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                fontSize: "12px",
                                                fontWeight: "bold"
                                            }}>
                                                {user.unreadCount}
                                            </span>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </aside>
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