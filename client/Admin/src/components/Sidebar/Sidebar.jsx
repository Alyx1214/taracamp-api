import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
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
import { logout as apiLogout } from "../../apis/userApi";
import { clearTokens } from "../../apis/api";

const Sidebar = ({ isOpen, onClose }) => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await apiLogout();
    } catch (e) {
      // ignore API error; proceed to clear client state
    } finally {
      try { clearTokens(); } catch {}
      navigate('/auth/login', { replace: true });
    }
  };
  return (
    <div className={`sidebar ${isOpen ? "open" : ""}`}>
      
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
        <button className="logout-btn" onClick={handleLogout}>
          <FaSignOutAlt />
          <span>LOG OUT</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
