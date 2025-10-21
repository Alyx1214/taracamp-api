import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import PropTypes from 'prop-types';
import styles from './Message.module.css';
import weblogo from '../../assets/logo.png';
import { FaPaperclip, FaSmile, FaPaperPlane } from 'react-icons/fa';
import { listMessages, sendMessage as sendMessageApi } from '../../apis/messageApi';
import { subscribe } from '../../utils/webSocketClient';

const Message = ({ sender, text, isUser, role }) => (
  <div className={styles.messageRow + ' ' + (isUser ? styles.user : styles.bot)}>
    {!isUser && <img src={weblogo} alt="Teachers Camp" className={styles.avatar} />}
    <div className={styles.bubbleContainer}>
      <div className={styles.messages}>
        <div className={styles.senderRow}>
          <span className={styles.sender}>{sender}</span>
          {role && <span className={styles.roleTag}>{role}</span>}
        </div>
        <div className={styles.bubble}>{text}</div>
      </div>
    </div>
  </div>
);

const MessageSkeleton = ({ isUser = false, compact = false }) => (
  <div
    className={
      styles.messageRow +
      ' ' +
      (isUser ? styles.user : styles.bot) +
      (compact ? ' ' + styles.skelCompact : '')
    }
    role="status"
    aria-busy="true"
  >
    {!isUser && <div className={styles.skelAvatar} />}
    <div className={styles.bubbleContainer}>
      <div className={styles.senderRow}>
        <div className={styles.skelSender} />
        {!isUser && <div className={styles.skelRole} />}
      </div>
      <div className={styles.skelBubble}>
        <div className={styles.skelLine} />
        <div className={styles.skelLine} />
        <div className={styles.skelLineShort} />
      </div>
    </div>
  </div>
);


const ChatContainer = ({ messages, onSend, onAttach, onEmoji, placeholder = 'Enter your message…', disabled = false, autoLoad = true }) => {
  const manageMessages = typeof messages === 'undefined' && autoLoad;
  const [fetchedMessages, setFetchedMessages] = useState([]);
  const [loading, setLoading] = useState(manageMessages);
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);

  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!manageMessages) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const response = await listMessages({ limit: 50 });
        const rows = Array.isArray(response?.data) ? response.data : [];
        if (!cancelled) setFetchedMessages(toChronological(rows));
      } catch {
        if (!cancelled) setFetchedMessages([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [manageMessages]);

  // WebSocket message handling for auto-managed messages
  useEffect(() => {
    if (!manageMessages) return;

    const handleWebSocketMessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'new_message') {
          const newMessage = data.data;
          
          // Skip user's own messages as they're already handled by optimistic updates
          if (newMessage.isUser) {
            return;
          }
          
          setFetchedMessages(prev => {
            // Check if message already exists to avoid duplicates
            const exists = prev.some(m => m._id === newMessage._id);
            if (exists) return prev;
            return toChronological([...prev, newMessage]);
          });
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    const unsubscribe = subscribe(handleWebSocketMessage);

    return () => {
      unsubscribe();
    };
  }, [manageMessages]);

  const safeMessages = manageMessages ? fetchedMessages : Array.isArray(messages) ? messages : [];
  const displayMessages = useMemo(() => toChronological(safeMessages), [safeMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [displayMessages.length]);

  const handleSend = useCallback(async () => {
    const text = draft.trim();
    if (!text || disabled || isSending) return;
    setIsSending(true);

    const payload = { sender: 'You', text, isUser: true };
    let optimisticEntry = null;

    if (manageMessages) {
      optimisticEntry = { ...payload, _id: `tmp-${Date.now()}`, timeLabel: 'now', isRead: true, createdAt: new Date() };
      setFetchedMessages(prev => toChronological([...prev, optimisticEntry]));
    }

    setDraft('');
    try {
      let saved = null;
      if (typeof onSend === 'function') {
        saved = await onSend(payload);
      } else {
        const response = await sendMessageApi({ text });
        saved = response?.data || null;
      }

      if (manageMessages) {
        setFetchedMessages(prev => {
          const withoutOptimistic = optimisticEntry ? prev.filter(m => m._id !== optimisticEntry._id) : prev;
          if (!saved) return withoutOptimistic;
          return toChronological([...withoutOptimistic, saved]);
        });
      }
    } finally {
      setIsSending(false);
    }
  }, [draft, disabled, isSending, manageMessages, onSend]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  return (
    <div className={styles.chatContainer}>
      <div className={styles.messagesContainer}>
        {loading ? (
          <div>Loading…</div>
        ) : displayMessages.length === 0 ? (
          <div className={styles.emptyState}>No messages yet.</div>
        ) : (
          <>
            {displayMessages.map((message, index) => (
              <Message key={message._id || index} {...message} />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>
      <div className={styles.typingContainer}>
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={styles.input}
          disabled={disabled || isSending}
        />
        <div className={styles.iconContainer}>
          <FaPaperclip className={styles.icon} onClick={() => typeof onAttach === 'function' && onAttach()} />
          <FaSmile className={styles.icon} onClick={() => typeof onEmoji === 'function' && onEmoji(setDraft)} />
          <FaPaperPlane className={styles.icon} onClick={handleSend} />
        </div>
      </div>
    </div>
  );
};

ChatContainer.propTypes = {
  messages: PropTypes.array,
  onSend: PropTypes.func,
  onAttach: PropTypes.func,
  onEmoji: PropTypes.func,
  placeholder: PropTypes.string,
  disabled: PropTypes.bool,
  autoLoad: PropTypes.bool,
};

export { ChatContainer, MessageSkeleton };
export default Message;

function toChronological(messages) {
  if (!Array.isArray(messages)) return [];

  return messages
    .map((message, index) => {
      const normalized = normalizeMessage(message);
      if (!normalized) return null;
      return {
        message: normalized,
        index,
        timestamp: getMessageTimestamp(normalized) ?? index,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.timestamp === b.timestamp) return a.index - b.index;
      return a.timestamp - b.timestamp;
    })
    .map(item => item.message);
}

function normalizeMessage(message) {
  if (!message || typeof message !== 'object') return null;

  const timestamp = getMessageTimestamp(message);
  if (timestamp === null) {
    return { ...message };
  }

  const createdAt = message.createdAt instanceof Date && !Number.isNaN(message.createdAt.getTime())
    ? message.createdAt
    : new Date(timestamp);

  return { ...message, createdAt };
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
