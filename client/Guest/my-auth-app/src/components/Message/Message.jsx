import React from 'react';
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

/** Chat container */
const ChatContainer = ({ messages = dummyMessages }) => {
  const safeMessages = Array.isArray(messages) ? messages : [];

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
        <input type="text" placeholder="Enter your message..." className={styles.inputBox} />
        <div className={styles.iconContainer}>
          <FaPaperclip className={styles.icon} />
          <FaSmile className={styles.icon} />
          <FaPaperPlane className={styles.icon} />
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
  )
};

export { ChatContainer };
export default Message;
