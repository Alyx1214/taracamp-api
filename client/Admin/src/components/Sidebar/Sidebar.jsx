import React from "react";
import { NavLink } from "react-router-dom";
import {
  FaTachometerAlt,
  FaBed,
  FaClipboardList,
  FaExchangeAlt,
  FaUser,
  FaDoorOpen,
  FaChartBar,
  FaSignOutAlt,
  FaTimes,
} from "react-icons/fa";
import "./Sidebar.css";

const Sidebar = ({ isOpen, onClose }) => {
  return (
    <div className={`sidebar ${isOpen ? "open" : ""}`}>
      <div className="sidebar-header">
        <div className="close-btn" onClick={onClose}>
          <FaTimes />
        </div>
      </div>

      <nav className="nav-links">
        <NavLink to="/dashboard" className="nav-item" activeclassname="active">
          <FaTachometerAlt />
          <span>DASHBOARD</span>
        </NavLink>
        <NavLink to="/facilities" className="nav-item" activeclassname="active">
          <FaBed />
          <span>FACILITIES</span>
        </NavLink>
        <NavLink to="/reservations" className="nav-item" activeclassname="active">
          <FaClipboardList />
          <span>RESERVATIONS</span>
        </NavLink>
        <NavLink to="/transactions" className="nav-item" activeclassname="active">
          <FaExchangeAlt />
          <span>TRANSACTIONS</span>
        </NavLink>
        <NavLink to="/user" className="nav-item" activeclassname="active">
          <FaUser />
          <span>USER</span>
        </NavLink>
        <NavLink to="/checkin" className="nav-item" activeclassname="active">
          <FaDoorOpen />
          <span>CHECK-IN/OUT</span>
        </NavLink>
        <NavLink to="/reports" className="nav-item" activeclassname="active">
          <FaChartBar />
          <span>REPORTS</span>
        </NavLink>
      </nav>

      <div className="logout-section">
        <button className="logout-btn" onClick={onClose}>
          <FaSignOutAlt />
          <span>LOG OUT</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
