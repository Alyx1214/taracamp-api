import React, { useEffect, useState } from "react";
import BoxCard from "./BoxCard";
import { getFacilitiesByType, deleteFacility, searchFacilities } from "../../apis/facilityApi";

export default function Cottages({ onEdit, searchQuery = "" }) {
  const [cottages, setCottages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const q = String(searchQuery || '').trim();
        const res = q
          ? await searchFacilities({ type: 'COTTAGE', query: q })
          : await getFacilitiesByType('COTTAGE');
        if (cancelled) return;
        const mapped = (res.facilities || []).map(f => ({
          id: f.id,
          name: f.name,
          capacity: f.capacity,
          rate: f.ratePerPerson ?? f.price ?? 0,
          image: f.image || null,
        }));
        setCottages(mapped);
      } catch (e) {
        if (!cancelled) setError(e?.data?.error || e.message || 'Failed to load facilities');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [searchQuery]);

  const handleDelete = async (id) => {
    try {
      await deleteFacility(id);
      setCottages((prev) => prev.filter((f) => f.id !== id));
    } catch (e) {
      setError(e?.data?.error || e.message || 'Failed to delete facility');
    }
  };

  return (
    <>
      {loading && <p>Loading cottages...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {!loading && !error && cottages.length === 0 && <p>No Cottages found</p>}
      {!loading && !error && cottages.length > 0 && (
        <BoxCard
          facilities={cottages}
          type="Cottages"
          onEdit={onEdit}
          onDelete={handleDelete}
        />
      )}
    </>
  );
}
