import React, { useEffect, useState } from "react";
import BoxCard from "./BoxCard";
import { getFacilitiesByType, deleteFacility, searchFacilities } from "../../apis/facilityApi";
import styles from "./Dormitory.module.css";

export default function Dormitory({ onEdit, searchQuery = "", filters = {}, isFrontdesk = false }) {
  const [dorms, setDorms] = useState([]);
  const [state, setState] = useState({ loading: true, error: null });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setState({ loading: true, error: null });
        const q = String(searchQuery || "").trim();
        
        // Build search parameters
        const searchParams = {
          type: "Dormitory",
          ...(q && { query: q }),
          ...(filters.minPrice && { minPrice: Number(filters.minPrice) }),
          ...(filters.maxPrice && { maxPrice: Number(filters.maxPrice) }),
          ...(filters.capacity && { capacity: Number(filters.capacity) }),
          ...(filters.maxCapacity && { maxCapacity: Number(filters.maxCapacity) })
        };

        const res = (q || filters.minPrice || filters.maxPrice || filters.capacity || filters.maxCapacity)
          ? await searchFacilities(searchParams)
          : await getFacilitiesByType("Dormitory");

        if (cancelled) return;

        // Treat payload-level error as failure
        const payloadError = res?.error || res?.message;
        if (payloadError) {
          throw new Error(typeof payloadError === "string" ? payloadError : "Invalid response.");
        }

        const list =
          Array.isArray(res?.facilities) ? res.facilities :
          Array.isArray(res?.data?.facilities) ? res.data.facilities :
          Array.isArray(res?.data) ? res.data :
          [];

        if (!Array.isArray(list)) {
          throw new Error('Response missing "facilities" list.');
        }

        let mapped = list.map(f => ({
          id: f._id ?? f.id,
          name: f.name ?? "Unnamed Dorm",
          capacity: f.capacity,
          rate: f.ratePerPerson ?? f.price ?? 0,
          images: Array.isArray(f.images) ? f.images : [],
        }));

        // Apply sorting
        if (filters.sortBy) {
          mapped = [...mapped].sort((a, b) => {
            switch (filters.sortBy) {
              case "name":
                return (a.name || "").localeCompare(b.name || "");
              case "price-asc":
                return (a.rate || 0) - (b.rate || 0);
              case "price-desc":
                return (b.rate || 0) - (a.rate || 0);
              case "capacity-asc":
                return (a.capacity || 0) - (b.capacity || 0);
              case "capacity-desc":
                return (b.capacity || 0) - (a.capacity || 0);
              default:
                return 0;
            }
          });
        }

        setDorms(mapped);
        setState({ loading: false, error: null });
      } catch (e) {
        if (!cancelled) {
          const msg =
            e?.response?.data?.error ||
            e?.response?.data?.message ||
            e?.data?.error ||
            e?.message ||
            "Failed to load dormitories.";
          setState({ loading: false, error: msg });
        }
      }
    })();

    return () => { cancelled = true; };
  }, [searchQuery, filters?.minPrice, filters?.maxPrice, filters?.capacity, filters?.maxCapacity, filters?.sortBy]);

  const handleDelete = async (id) => {
    try {
      await deleteFacility(id);
      setDorms(prev => prev.filter(f => f.id !== id));
    } catch (e) {
      const msg =
        e?.response?.data?.error ||
        e?.response?.data?.message ||
        e?.data?.error ||
        e?.message ||
        "Failed to delete facility.";
      setState(s => ({ ...s, error: msg }));
    }
  };

  const isLoading = state.loading;
  const hasError = !isLoading && Boolean(state.error);
  const isEmpty = !isLoading && !hasError && dorms.length === 0;

  return (
    <section className={styles.dormitoryContainer}>
      {isLoading && (
        <div className={styles.skeletonGrid}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div className={styles.skeletonCard} key={i}>
              <div className={styles.skelImg} />
              <div className={styles.skelBody}>
                <span className={styles.skelLine} />
                <span className={styles.skelLineShort} />
                <span className={styles.skelLineShorter} />
              </div>
            </div>
          ))}
        </div>
      )}

      {hasError && (
        <div className={styles.emptyState} role="alert">
          <div className={styles.emptyCard}>
            <svg className={styles.emptyIcon} viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
              <path fill="currentColor" d="M11 15h2v2h-2v-2zm0-8h2v6h-2V7zm1-5C6.48 2 2 6.48 2 12s4.48 10 10 10
                10-4.48 10-10S17.52 2 12 2z"/>
            </svg>
            <h4 className={styles.emptyTitle}>Couldn’t load dormitories</h4>
            <p className={styles.emptyDesc}>{state.error}</p>
          </div>
        </div>
      )}

      {isEmpty && (
        <div className={styles.emptyState}>
          <div className={styles.emptyCard}>
            <svg className={styles.emptyIcon} viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
              <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 14h-2v-2h2v2zm0-4h-2V7h2v5z"/>
            </svg>
            <h4 className={styles.emptyTitle}>No dormitories found</h4>
          </div>
        </div>
      )}

      {!isLoading && !hasError && !isEmpty && (
        <BoxCard
          facilities={dorms}
          type="Dormitory"
          onEdit={onEdit}
          onDelete={handleDelete}
          isFrontdesk={isFrontdesk}
        />
      )}
    </section>
  );
}
