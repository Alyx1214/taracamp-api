import React, { useEffect, useState } from "react";
import TableServices from "./TableServices";
import styles from "./TableServices.module.css";
import { getAllAddons, searchAddons, deleteAddon } from "../../apis/addonsApi";

export default function OtherService({ onEdit, searchQuery = "" }) {
  const [services, setServices] = useState([]);
  const [state, setState] = useState({ loading: true, error: null });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setState({ loading: true, error: null });
        const q = String(searchQuery || "").trim();
        const res = q ? await searchAddons({ query: q }) : await getAllAddons();

        if (cancelled) return;

        // Treat payload-level error as failure
        const payloadError = res?.error || res?.message;
        if (payloadError) {
          throw new Error(typeof payloadError === "string" ? payloadError : "Invalid response.");
        }

        const list = Array.isArray(res?.addons) ? res.addons : [];
        if (!Array.isArray(list)) {
          throw new Error('Response missing "addons" list.');
        }

        const mapped = list.map((s) => ({
          id: s._id ?? s.id,
          name: s.name,
          rate: s.price ?? 0,
          unit: s.unit ?? "-",
        }));

        setServices(mapped);
        setState({ loading: false, error: null });
      } catch (e) {
        if (!cancelled) {
          const msg =
            e?.response?.data?.error ||
            e?.response?.data?.message ||
            e?.data?.error ||
            e?.message ||
            "Failed to load add-ons.";
          setState({ loading: false, error: msg });
        }
      }
    })();

    return () => { cancelled = true; };
  }, [searchQuery]);

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this service?")) {
      return;
    }

    try {
      await deleteAddon(id);
      setServices((prev) => prev.filter((s) => String(s.id) !== String(id)));
    } catch (e) {
      const msg =
        e?.response?.data?.error ||
        e?.response?.data?.message ||
        e?.data?.error ||
        e?.message ||
        "Failed to delete add-on.";
      setState(s => ({ ...s, error: msg }));
    }
  };

  const isLoading = state.loading;
  const hasError = !isLoading && Boolean(state.error);
  const isEmpty = !isLoading && !hasError && services.length === 0;

  return (
    <div className={styles.container}>
      <h2 className={styles.heading}>ADD-ONS</h2>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead className={styles.thead}>
            <tr>
              <th className={styles.th}>EQUIPMENTS</th>
              <th className={`${styles.th} ${styles.thRight}`}>PRICE</th>
            </tr>
          </thead>
          <tbody>
            {isLoading &&
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className={styles.skeletonRow}>
                  <td className={styles.td}>
                    <span className={styles.skelName} />
                  </td>
                  <td className={styles.td}>
                    <span className={styles.skelPrice} />
                  </td>
                </tr>
              ))
            }

            {hasError && (
              <tr>
                <td colSpan="2" className={styles.td}>
                  <div className={styles.emptyState} role="alert">
                    <div className={styles.emptyCard}>
                      <svg className={styles.emptyIcon} viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
                        <path fill="currentColor" d="M11 15h2v2h-2v-2zm0-8h2v6h-2V7zm1-5C6.48 2 2 6.48 2 12s4.48 10 10 10
                          10-4.48 10-10S17.52 2 12 2z"/>
                      </svg>
                      <h4 className={styles.emptyTitle}>Couldn't load add-ons</h4>
                      <p className={styles.emptyDesc}>{state.error}</p>
                    </div>
                  </div>
                </td>
              </tr>
            )}

            {isEmpty && (
              <tr>
                <td colSpan="2" className={styles.td}>
                  <div className={styles.emptyState}>
                    <div className={styles.emptyCard}>
                      <svg className={styles.emptyIcon} viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
                        <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 14h-2v-2h2v2zm0-4h-2V7h2v5z"/>
                      </svg>
                      <h4 className={styles.emptyTitle}>No add-ons found</h4>
                    </div>
                  </div>
                </td>
              </tr>
            )}

            {!isLoading && !hasError && !isEmpty &&
              services.map((service, idx) => (
                <tr key={service?.id ?? idx} className={styles.tr}>
                  <td className={styles.td}>
                    <span className={styles.equipmentName}>{service.name}</span>
                  </td>
                  <td className={styles.td}>
                    <span className={styles.price}>₱{service.rate?.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                      {service.unit ? `/${service.unit}` : ''}
                    </span>
                  </td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>
    </div>
  );
}