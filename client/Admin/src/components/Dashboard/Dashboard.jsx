import React from "react";
import DashboardCard from "../DashboardCard/DashboardCard.jsx";
import ReservationGraph from "../ReservationGraph/ReservationGraph.jsx";
import ReservationCalendar from "../DashboardCalendar/DashboardCalendar.jsx";
import Sidebar from "../Sidebar/Sidebar.jsx"; 
import "../Dashboard/Dashboard.module.css";

const Dashboard = ({ isOpen, onClose }) => {
  return (
    <div className="dashboard-wrapper">
      <Sidebar isOpen={isOpen} onClose={onClose} />

      <div className={`dashboard-content ${isOpen ? "shifted" : ""}`}>
        <header className="dashboard-header">
          <h1>Mabuhay, Admin!</h1>
        </header>

        <div className="dashboard-cards">
          <DashboardCard title="Today's Reservations" value="10" />
          <DashboardCard title="Monthly Check-ins" value="100" />
          <DashboardCard title="Confirmed Reservations" value="50" />
          <DashboardCard title="Total Users" value="150" />
        </div>

        <div className="dashboard-stats">
          <div className="stats-section">
            <ReservationGraph />
          </div>

          <div className="calendar-section">
            <ReservationCalendar />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
