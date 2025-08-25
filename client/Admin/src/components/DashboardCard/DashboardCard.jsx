import React from "react";
import "./DashboardCard.module.css";

const DashboardCard = ({ title, value }) => {
  return (
    <div className="dashboard-card">
      <h2 className="card-title">{title}</h2>
      <p className="card-value">{value}</p>
    </div>
  );
};

export default DashboardCard;
