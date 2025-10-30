import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  FaTachometerAlt,
  FaBed,
  FaClipboardList,
  FaExchangeAlt,
  FaUser,
  FaDoorOpen,
  FaEnvelope,
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
  // Read role from storage (normalized to uppercase elsewhere)
  const role = (typeof window !== 'undefined' && localStorage.getItem('userRole')) || '';

  // Map allowed nav keys per role
  const roleAllowedKeys = {
    'CRMS TEAM': new Set(["dashboard", "facilities", "reservations", "transactions"]),
    'ACCOUNTING': new Set(["dashboard", "transactions"]),
    'FRONTDESK': new Set(["dashboard", "facilities", "reservations", "transactions", "checkin"]),
  };

  const allItems = [
    { key: "dashboard", to: "/dashboard", icon: <FaTachometerAlt />, label: "DASHBOARD" },
    { key: "facilities", to: "/facilities", icon: <FaBed />, label: "FACILITIES" },
    { key: "reservations", to: "/reservations", icon: <FaClipboardList />, label: "RESERVATIONS" },
    { key: "transactions", to: "/transactions", icon: <FaExchangeAlt />, label: "TRANSACTIONS" },
    { key: "user", to: "/user", icon: <FaUser />, label: "USER" },
    { key: "checkin", to: "/checkin", icon: <FaDoorOpen />, label: "CHECK-IN/OUT" },
    { key: "messages", to: "/messages", icon: <FaEnvelope />, label: "MESSAGES" },
  ];

  const allowedSet = roleAllowedKeys[role] || null; // null → show all

  const visibleItems = allowedSet
    ? allItems.filter(item => allowedSet.has(item.key))
    : allItems;

  return (
    <div className={`sidebar ${isOpen ? "open" : ""}`}>
      <nav className="nav-links">
        {visibleItems.map(item => (
          <NavLink key={item.key} to={item.to} className="nav-item" activeclassname="active">
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}
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
