import styles from './StatsCard.module.css';

const StatsCard = ({ icon, value, label, iconColor, onClick }) => {
  return (
    <div 
      className={`${styles.statsCard} ${onClick ? styles.clickable : ''}`}
      onClick={onClick}
    >
      <div className={styles.cardContent}>
        <div className={`${styles.iconContainer} ${styles[iconColor]}`}>
          {icon}
        </div>
        <div className={styles.textContent}>
          <div className={styles.label}>{label}</div>
          <div className={styles.value}>{value}</div>
        </div>
      </div>
    </div>
  );
};

export default StatsCard;