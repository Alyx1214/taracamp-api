import styles from './Dashboard.module.css';
import StatsCard from './StatsCard';
import MonthlyChart from './MonthlyChart';
import ReservationsCalendar from './ReservationsCalendar';
import { Icon } from '@iconify/react';

const CalendarIcon = () => <Icon icon="mdi:calendar" />;
const CheckInIcon = () => <Icon icon="mdi:hotel" />;
const ConfirmedIcon = () => <Icon icon="mdi:check-circle" />;
const UsersIcon = () => <Icon icon="mdi:account-group" />;
const PendingIcon = () => <Icon icon="mdi:clock-outline" />;
const CancelledIcon = () => <Icon icon="mdi:close-circle" />;

const Dashboard = () => {
  return (
    <div className={styles.dashboard}>
      <div className={styles.welcomeSection}>
        <h1 className={styles.welcomeTitle}>Mabuhay, Admin!</h1>
      </div>
      
      <div className={styles.statsGrid}>
        <StatsCard 
          icon={<CalendarIcon />}
          value="10"
          label="Today's Reservations"
          iconColor="green"
        />
        
        <StatsCard 
          icon={<CheckInIcon />}
          value="100"
          label="Monthly Check-ins"
          iconColor="brown"
        />
        
        <StatsCard 
          icon={<ConfirmedIcon />}
          value="50"
          label="Confirmed Reservations"
          iconColor="green"
        />
        
        <StatsCard 
          icon={<UsersIcon />}
          value="150"
          label="Total Users"
          iconColor="gray"
        />
        
        <StatsCard 
          icon={<PendingIcon />}
          value="40"
          label="Pending Reservations"
          iconColor="brown"
        />
        
        <StatsCard 
          icon={<CancelledIcon />}
          value="10"
          label="Cancelled Reservations"
          iconColor="green"
        />
      </div>
      
      <div className={styles.chartsSection}>
        <MonthlyChart />
        <ReservationsCalendar />
      </div>
    </div>
  );
};

export default Dashboard;
