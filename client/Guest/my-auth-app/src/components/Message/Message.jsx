import React from 'react';
import styles from './Message.module.css';
import weblogo from '../../assets/logo.png';
import { FaPaperclip, FaSmile, FaPaperPlane } from 'react-icons/fa';

/**
 * Message component 
 * @param {Object} props
 * @param {string} props.sender - Sender name 
 * @param {string} props.text - Message text
 * @param {boolean} props.isUser - If true, message is from user
 * @param {string} [props.role] - Optional role or tag (e.g., 'Sales')
 */
const Message = ({ sender, text, isUser, role }) => {
  return (
    <div className={styles.messageRow + ' ' + (isUser ? styles.user : styles.bot)}>
      {!isUser && (
        <img src={weblogo} alt="Teachers Camp" className={styles.avatar} />
      )}
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
};

const ChatContainer = ({ messages }) => {
  return (
    <div className={styles.chatContainer}>
      <div className={styles.messagesContainer}>
        {messages.map((message, index) => (
          <Message key={index} {...message} />
        ))}
      </div>
      <div className={styles.typingContainer}>
        <input
          type="text"
          placeholder="Enter your message..."
          className={styles.inputBox}
        />
        <div className={styles.iconContainer}>
          <FaPaperclip className={styles.icon} />
          <FaSmile className={styles.icon} />
          <FaPaperPlane className={styles.icon} />
        </div>
      </div>
    </div>
  );
};

export default ChatContainer;
