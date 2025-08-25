import React from 'react';
import styles from './Message.module.css';
import weblogo from '../../assets/logo.png';

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
        <div className={styles.senderRow}>
          <span className={styles.sender}>{sender}</span>
          {role && <span className={styles.roleTag}>{role}</span>}
        </div>
        <div className={styles.bubble}>{text}</div>
      </div>
    </div>
  );
};

export default Message;
