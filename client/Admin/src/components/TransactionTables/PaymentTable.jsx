import React from "react";
import { useNavigate } from "react-router-dom";
import UnivTable from "../UnivTable/UnivTable.jsx";
import styles from "../UnivTable/UnivTable.module.css"; 

export default function PaymentTable({ data = [], loading = false }) {
  const navigate = useNavigate();

  const columns = ["Name", "Email", "Service Type", "Date", "Actions"];

  const formattedData = data.map(item => ({
    id: item._id,
    name: item.guestName || 'N/A',
    email: item.guestEmail || 'N/A',
    serviceType: item.serviceType || 'N/A',
    date: item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'N/A',
  }));

  const renderActions = (row) => (
      <>
        <button
          className={styles["univ-view-btn"]}
          onClick={() => navigate(`/payment/${row.id}/details`)}
        >
          View Details
        </button>
      </>
    );
  
  return (
    <UnivTable
      columns={columns}
      data={formattedData}
      loading={loading}
      renderActions={renderActions}
    />
  );
}
