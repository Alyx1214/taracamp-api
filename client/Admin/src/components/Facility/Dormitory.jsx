import React, { useEffect, useState } from "react";
import BoxCard from "./BoxCard";
import { getFacilitiesByType, deleteFacility, searchFacilities } from "../../apis/facilityApi";

export default function Dormitory({ onEdit, searchQuery = "" }) {
  const [dorms, setDorms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const q = String(searchQuery || '').trim();
        const res = q
          ? await searchFacilities({ type: 'DORMITORY', query: q })
          : await getFacilitiesByType('DORMITORY');
        if (cancelled) return;
        const mapped = (res.facilities || []).map(f => ({
          id: f.id,
          name: f.name,
          capacity: f.capacity,
          rate: f.ratePerPerson ?? f.price ?? 0,
          image: f.image || null,
        }));
        setDorms(mapped);
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
      setDorms((prev) => prev.filter((f) => f.id !== id));
    } catch (e) {
      setError(e?.data?.error || e.message || 'Failed to delete facility');
    }
  };

  return (
    <>
      {loading && <p>Loading dormitories...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {!loading && !error && dorms.length === 0 && <p>No Dormitory found</p>}
      {!loading && !error && dorms.length > 0 && (
        <BoxCard
          facilities={dorms}
          type="Dormitory"
          onEdit={onEdit}
          onDelete={handleDelete}
        />
      )}
    </>
  );
}
