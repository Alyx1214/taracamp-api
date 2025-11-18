import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import UnivTable from "../UnivTable/UnivTable.jsx";
import styles from "../UnivTable/UnivTable.module.css";
import { getPaymentSummary } from "../../apis/paymentApi.js";

export default function PaymentTable({ data = [], loading = false }) {
  const navigate = useNavigate();
  const [unpaidOrPartialIds, setUnpaidOrPartialIds] = useState(new Set());
  const [statusLoading, setStatusLoading] = useState(false);

  const columns = ["Name", "Email", "Service Type", "Date", "Actions"];

  // Fetch payment summaries for all payments and filter to only not paid and partially paid
  useEffect(() => {
    if (!data || data.length === 0) {
      setUnpaidOrPartialIds(new Set());
      return;
    }

    let cancelled = false;
    setStatusLoading(true);

    async function fetchStatuses() {
      try {
        // Fetch all payment summaries in parallel
        const promises = data.map(async (item) => {
          if (!item._id) return null;
          try {
            const res = await getPaymentSummary(item._id);
            const summary = res?.data?.data ?? res?.data ?? res;
            if (summary) {
              const isFullyPaid = summary.isFullyPaid || false;
              const totalPaid = summary.totalPaid || 0;
              
              // Return ID if not fully paid (either not paid or partially paid)
              if (!isFullyPaid) {
                return item._id;
              }
            }
          } catch (err) {
            console.warn(`Failed to fetch payment summary for ${item._id}:`, err);
          }
          return null;
        });

        const results = await Promise.all(promises);
        
        if (!cancelled) {
          const unpaidOrPartialIds = new Set(results.filter(id => id !== null));
          setUnpaidOrPartialIds(unpaidOrPartialIds);
        }
      } catch (err) {
        console.error('Error fetching payment statuses:', err);
      } finally {
        if (!cancelled) {
          setStatusLoading(false);
        }
      }
    }

    fetchStatuses();
    return () => {
      cancelled = true;
    };
  }, [data]);

  // Filter data to only show not paid and partially paid transactions
  const filteredData = useMemo(() => {
    if (statusLoading) {
      return []; // Don't show anything while loading
    }
    return data.filter(item => unpaidOrPartialIds.has(item._id));
  }, [data, unpaidOrPartialIds, statusLoading]);

  const formattedData = filteredData.map(item => ({
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
      loading={loading || statusLoading}
      renderActions={renderActions}
    />
  );
}
