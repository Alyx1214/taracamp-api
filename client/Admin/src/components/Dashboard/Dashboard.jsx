import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './Dashboard.module.css';
import StatsCard from './StatsCard';
import MonthlyChart from './MonthlyChart';
import ReservationsCalendar from './ReservationsCalendar';
import { Icon } from '@iconify/react';
import { getDashboardStats } from '../../apis/dashboardApi';

const CalendarIcon = () => <Icon icon="mdi:calendar" style={{ width: '50px', height: '50px' }} />;
const CheckInIcon = () => <Icon icon="mdi:hotel" style={{ width: '50px', height: '50px' }}/>;
const ConfirmedIcon = () => <Icon icon="mdi:check-circle" style={{ width: '50px', height: '50px' }} />;
const UsersIcon = () => <Icon icon="mdi:account-group" style={{ width: '50px', height: '50px' }}/>;
const PendingIcon = () => <Icon icon="mdi:clock-outline" style={{ width: '50px', height: '50px' }}/>;
const CancelledIcon = () => <Icon icon="mdi:close-circle" style={{ width: '50px', height: '50px' }}/>;

const Dashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [todaysReservations, setTodaysReservations] = useState(0);
  const [monthlyCheckIns, setMonthlyCheckIns] = useState(0);
  const [confirmedReservations, setConfirmedReservations] = useState(0);
  const [totalGuestUsers, setTotalGuestUsers] = useState(0);
  const [pendingReservations, setPendingReservations] = useState(0);
  const [cancelledReservations, setCancelledReservations] = useState(0);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const payload = await getDashboardStats();
        if (payload && payload.stats) {
          const s = payload.stats;
          setTodaysReservations(s.todaysReservations ?? 0);
          setMonthlyCheckIns(s.monthlyCheckIns ?? 0);
          setConfirmedReservations(s.confirmedReservations ?? 0);
          setTotalGuestUsers(s.totalGuestUsers ?? 0);
          setPendingReservations(s.pendingReservations ?? 0);
          setCancelledReservations(s.cancelledReservations ?? 0);
        } else {
          console.error("Unexpected dashboard stats payload:", payload);
          setError("Unexpected dashboard stats payload");
        }
      } catch (e) {
        console.error(e);
        setError(e?.message || "Failed to load dashboard stats");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className={styles.dashboard}>
      <div className={styles.welcomeSection}>
        <h1 className={styles.welcomeTitle}>Mabuhay, Admin!</h1>
      </div>

      {error && <div className={styles.errorBox}>{error}</div>}

      <div className={styles.statsGrid} aria-busy={loading}>
        <StatsCard 
          icon={<CalendarIcon />}
          value={todaysReservations}
          label="Today's Reservations"
          iconColor="green"
        />
        <StatsCard 
          icon={<CheckInIcon />}
          value={monthlyCheckIns}
          label="Monthly Check-ins"
          iconColor="brown"
        />
        <StatsCard 
          icon={<ConfirmedIcon />}
          value={confirmedReservations}
          label="Confirmed Reservations"
          iconColor="green"
          onClick={() => navigate('/reservations', { state: { activeTab: 'Confirmed' } })}
        />
        <StatsCard 
          icon={<UsersIcon />}
          value={totalGuestUsers}
          label="Total Users"
          iconColor="gray"
          onClick={() => navigate('/user', { state: { activeTab: 'Guest' } })}
        />
        <StatsCard 
          icon={<PendingIcon />}
          value={pendingReservations}
          label="Pending Reservations"
          iconColor="brown"
          onClick={() => navigate('/reservations', { state: { activeTab: 'Pending' } })}
        />
        <StatsCard 
          icon={<CancelledIcon />}
          value={cancelledReservations}
          label="Cancelled Reservations"
          iconColor="green"
          onClick={() => navigate('/reservations', { state: { activeTab: 'Cancelled' } })}
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
