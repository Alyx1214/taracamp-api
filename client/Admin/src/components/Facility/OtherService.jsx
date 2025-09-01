import React, { useEffect, useState } from "react";
import BoxCard from "./BoxCard";
import { getAllSpecialServices, searchSpecialServices, deleteSpecialService } from "../../apis/specialServiceApi";

export default function OtherService({ onEdit, searchQuery = "" }) {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const q = String(searchQuery || '').trim();
        const res = q
          ? await searchSpecialServices({ query: q })
          : await getAllSpecialServices();
        if (cancelled) return;
        const mapped = (res.specialServices || []).map((s) => ({
          id: s._id || s.id,
          name: s.name,
          rate: s.price ?? 0,
          capacity: s.unit || '-',
        }));
        setServices(mapped);
      } catch (e) {
        if (!cancelled) setError(e?.data?.error || e.message || 'Failed to load services');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchQuery]);

  const handleDelete = async (id) => {
    try {
      await deleteSpecialService(id);
      setServices(prev => prev.filter(s => String(s.id) !== String(id)));
    } catch (e) {
      setError(e?.data?.error || e.message || 'Failed to delete service');
    }
  };

  return (
    <>
      {loading && <p>Loading services...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {!loading && !error && services.length === 0 && <p>No Other Service found</p>}
      {!loading && !error && services.length > 0 && (
        <BoxCard
          facilities={services}
          type="Other Service"
          onEdit={onEdit}
          onDelete={handleDelete}
        />
      )}
    </>
  );
}
