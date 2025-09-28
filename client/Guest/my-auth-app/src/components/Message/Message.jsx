import React, { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import styles from './Message.module.css';
import weblogo from '../../assets/logo.png';
import { FaPaperclip, FaSmile, FaPaperPlane } from 'react-icons/fa';
import { listMessages, sendMessage as sendMessageApi } from '../../apis/messageApi';

/** Single message bubble */
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

Message.propTypes = {
  sender: PropTypes.string,
  text: PropTypes.string,
  isUser: PropTypes.bool,
  role: PropTypes.string
};

Message.defaultProps = {
  sender: 'System',
  text: '',
  isUser: false,
  role: undefined
};

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

/** Chat container with typing input */
const ChatContainer = ({
  messages,
  onSend,
  onAttach,
  onEmoji,
  placeholder = 'Enter your message…',
  disabled = false,
  autoLoad = true,
}) => {
  const manageMessages = typeof messages === 'undefined' && autoLoad;
  const [fetchedMessages, setFetchedMessages] = useState([]);
  const [loading, setLoading] = useState(manageMessages);
  const [loadError, setLoadError] = useState(null);
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Auto-fetch messages when this component manages its own data source
  useEffect(() => {
    if (!manageMessages) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const response = await listMessages({ limit: 50 });
        const rows = Array.isArray(response?.data) ? response.data : [];
        if (!cancelled) setFetchedMessages(rows);
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to fetch messages', error);
          setLoadError(error);
          setFetchedMessages([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [manageMessages]);

  const safeMessages = manageMessages
    ? fetchedMessages
    : Array.isArray(messages)
      ? messages
      : [];

  const handleSend = useCallback(async () => {
    const text = draft.trim();
    if (!text || disabled || isSending) return;
    setIsSending(true);

    const payload = { sender: 'You', text, isUser: true };
    let optimisticEntry = null;

    if (manageMessages) {
      optimisticEntry = {
        ...payload,
        _id: `tmp-${Date.now()}`,
        timeLabel: 'now',
        isRead: true,
      };
      setFetchedMessages(prev => [optimisticEntry, ...prev]);
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
          const withoutOptimistic = optimisticEntry
            ? prev.filter(m => m._id !== optimisticEntry._id)
            : prev;
          return saved ? [saved, ...withoutOptimistic] : withoutOptimistic;
        });
      }
    } catch (error) {
      if (manageMessages && optimisticEntry) {
        setFetchedMessages(prev => prev.filter(m => m._id !== optimisticEntry._id));
      }
      setDraft(text);
      console.error('Failed to send message', error);
    } finally {
      setIsSending(false);
    }
  }, [draft, disabled, isSending, manageMessages, onSend, sendMessageApi]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  return (
    <div className={styles.chatContainer}>
      <div className={styles.messagesContainer}>
        {loading ? (
          <div className={styles.skeletonWrap}>
            <MessageSkeleton />
            <MessageSkeleton isUser />
            <MessageSkeleton />
            <MessageSkeleton isUser />
          </div>
        ) : loadError ? (
          <div className={styles.emptyState}>Unable to load messages.</div>
        ) : safeMessages.length === 0 ? (
          <div className={styles.emptyState}>No messages yet.</div>
        ) : (
          safeMessages.map((message, index) => (
            <Message key={message._id || index} {...message} />
          ))
        )}

      </div>
      <div className={styles.typingContainer}>
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          aria-label="Message input"
          className={styles.input}
          disabled={disabled || isSending}
        />
        <div className={styles.iconContainer}>
          <FaPaperclip
            className={styles.icon}
            role="button"
            tabIndex={0}
            aria-label="Attach file"
            onClick={() => typeof onAttach === 'function' && onAttach()}
          />
          <FaSmile
            className={styles.icon}
            role="button"
            tabIndex={0}
            aria-label="Insert emoji"
            onClick={() => typeof onEmoji === 'function' && onEmoji(setDraft)}
          />
          <FaPaperPlane
            className={styles.icon}
            role="button"
            tabIndex={0}
            aria-label="Send message"
            onClick={handleSend}
          />
        </div>
      </div>
    </div>
  );
};

ChatContainer.propTypes = {
  messages: PropTypes.arrayOf(
    PropTypes.shape({
      sender: PropTypes.string,
      text: PropTypes.string,
      isUser: PropTypes.bool,
      role: PropTypes.string,
      _id: PropTypes.string,
      timeLabel: PropTypes.string,
      isRead: PropTypes.bool,
    })
  ),
  onSend: PropTypes.func,
  onAttach: PropTypes.func,
  onEmoji: PropTypes.func,
  placeholder: PropTypes.string,
  disabled: PropTypes.bool,
  autoLoad: PropTypes.bool,
};

export { ChatContainer, MessageSkeleton };
export default Message;
