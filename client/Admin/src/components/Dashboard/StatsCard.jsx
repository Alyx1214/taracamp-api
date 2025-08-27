import styles from './StatsCard.module.css';

const StatsCard = ({ icon, value, label, iconColor }) => {
  return (
    <div className={styles.statsCard}>
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
