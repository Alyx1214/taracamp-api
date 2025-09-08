import React, { useCallback, useState } from 'react';
import PropTypes from 'prop-types';
import styles from './Message.module.css';
import weblogo from '../../assets/logo.png';
import { FaPaperclip, FaSmile, FaPaperPlane } from 'react-icons/fa';

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

// Dummy messages for initial render in ChatContainer (not used by dropdown bubble)
const dummyMessages = [
  { sender: 'Alice', text: 'Hi there!', isUser: false, role: 'Support' },
  { sender: 'You', text: 'Hello, Alice.', isUser: true },
  { sender: 'Alice', text: 'How can I help you today?', isUser: false, role: 'Support' }
];

/** Chat container with typing input */
const ChatContainer = ({
  messages = dummyMessages,
  onSend,
  onAttach,
  onEmoji,
  placeholder = 'Enter your message…',
  disabled = false,
}) => {
  const safeMessages = Array.isArray(messages) ? messages : [];
  const [draft, setDraft] = useState('');

  const send = useCallback(() => {
    const text = draft.trim();
    if (!text || disabled) return;
    const payload = { sender: 'You', text, isUser: true };
    if (typeof onSend === 'function') onSend(payload);
    setDraft('');
  }, [draft, onSend, disabled]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        send();
      }
    },
    [send]
  );

  return (
    <div className={styles.chatContainer}>
      <div className={styles.messagesContainer}>
        {safeMessages.length === 0 ? (
          <div className={styles.emptyState}>No messages yet.</div>
        ) : (
          safeMessages.map((message, index) => <Message key={index} {...message} />)
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
          disabled={disabled}
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
            onClick={send}
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
      role: PropTypes.string
    })
  ),
  onSend: PropTypes.func,
  onAttach: PropTypes.func,
  onEmoji: PropTypes.func,
  placeholder: PropTypes.string,
  disabled: PropTypes.bool,
};

export { ChatContainer };
export default Message;
