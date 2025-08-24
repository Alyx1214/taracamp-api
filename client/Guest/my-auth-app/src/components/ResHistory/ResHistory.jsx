import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import HeaderHome from '../HeaderHome/HeaderHome';
import ErrorBanner from '../ErrorBanner/ErrorBanner';
import styles from './ResHistory.module.css';

function ReservationHistory() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [reservationsRaw, setReservationsRaw] = useState([]);
  const [openReservationId, setOpenReservationId] = useState(null);
  const abortRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) navigate('/auth/login', { replace: true });
  }, [navigate]);

  const refreshAccessToken = useCallback(async () => {
    const rt = localStorage.getItem('refreshToken');
    if (!rt) throw new Error('No refresh token');
    const res = await fetch('/api/user/refresh-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: rt }),
    });
    const data = res.status !== 404 ? await res.json().catch(() => ({})) : {};
    if (!res.ok || !data?.accessToken) throw new Error(data.error || 'Refresh failed');
    localStorage.setItem('accessToken', data.accessToken);
    return data.accessToken;
  }, []);

  const authorizedFetch = useCallback(async (url, options) => {
    let token = localStorage.getItem('accessToken');
    const headers = new Headers(options?.headers || {});
    if (token) headers.set('Authorization', `Bearer ${token}`);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    let res = await fetch(url, { ...options, headers, signal: ctrl.signal });

    if (res.status === 401 || res.status === 403) {
      try {
        const newToken = await refreshAccessToken();
        const retryHeaders = new Headers(options?.headers || {});
        retryHeaders.set('Authorization', `Bearer ${newToken}`);
        res = await fetch(url, { ...options, headers: retryHeaders, signal: ctrl.signal });
      } catch (e) {
        localStorage.clear();
        navigate('/auth/login', { replace: true });
        throw e;
      }
    }
    return res;
  }, [refreshAccessToken, navigate]);

  const mapFacilityTypeLabel = (t) => {
    const s = String(t || '').trim().toUpperCase();
    if (!s) return 'N/A';
    if (s === 'CONFERENCE' || s === 'CONFERENCE HALL' || s === 'CONFERENCE_HALL' || s === 'HALL') return 'Conference Hall';
    if (s.includes('DORM')) return 'Dormitory';
    if (s.includes('COTTAGE') || s.includes('GUEST')) return 'Cottage';
    return t || 'N/A';
  };

  const mapCategoryLabel = (c) => {
    const s = String(c || '').trim().toUpperCase();
    if (['DEPED', 'DEPARTMENT_OF_EDUCATION', 'DEPARTMENT OF EDUCATION'].includes(s)) return 'DepEd';
    if (['GOVERNMENT', 'GOVT'].includes(s)) return 'Government';
    if (['PWD', 'PWDS', 'PERSONS WITH DISABILITY', 'PERSON WITH DISABILITY'].includes(s)) return 'PWDs';
    if (['PRIVATE', 'PERSONAL'].includes(s)) return 'Private';
    return c || 'N/A';
  };

  const fmtPeso = (n) => {
    const num = Number(n);
    if (!Number.isFinite(num)) return 'N/A';
    return num.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const fmtMDY = (d) => {
    try {
      const date = new Date(d);
      if (Number.isNaN(date.getTime())) return 'N/A';
      return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
    } catch {
      return 'N/A';
    }
  };

  const fmtLong = (d) => {
    try {
      const date = new Date(d);
      if (Number.isNaN(date.getTime())) return '—';
      return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    } catch {
      return 'N/A';
    }
  };

  useEffect(() => {
    let active = true;

    (async () => {
      setLoading(true);
      setErr(null);

      try {
        const res = await authorizedFetch('/api/reservation/get-reservation-by-user-id', { method: 'GET' });
        const json = res.status !== 404 ? await res.json().catch(() => ({})) : {};
        if (!res.ok && res.status !== 404) throw new Error(json.error || 'Failed to load reservations');

        const list = Array.isArray(json?.reservations) ? json.reservations : [];
        if (!active) return;

        if (list.length === 0) {
          setReservationsRaw([]);
          setOpenReservationId(null);
          return;
        }

        const ids = [...new Set(list.map(r => String(r?.facility || '')).filter(Boolean))];
        const pairs = await Promise.all(ids.map(async (fid) => {
          try {
            const rf = await fetch(`/api/facility/get-facility-by-id/${encodeURIComponent(fid)}`);
            const fj = await rf.json().catch(() => ({}));
            const f = fj?.data || fj?.facility || fj?.result || fj;
            return [fid, {
              name: (f?.name || 'N/A'),
              type: (f?.type || f?.facilityType || f?.typeOfFacility || f?.category || 'N/A'),
            }];
          } catch {
            return [fid, { name: 'N/A', type: 'N/A' }];
          }
        }));

        const fidToInfo = Object.fromEntries(pairs);
        setReservationsRaw(list.map(r => ({
          ...r,
          __facilityInfo: fidToInfo[String(r?.facility || '')] || { name: 'N/A', type: 'N/A' },
        })));

        const firstId = String(list[0]._id || list[0].id || '');
        setOpenReservationId(firstId || null);
      } catch (e) {
        if (active) setErr({ message: e.message || 'Unable to load reservations' });
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
      abortRef.current?.abort?.();
    };
  }, [authorizedFetch]);

  const reservationsView = useMemo(() => {
    return reservationsRaw.map((r) => {
      const rid = String(r._id || r.id || Math.random().toString(36).slice(2));
      const facName = r.__facilityInfo?.name || 'N/A';
      const facType = mapFacilityTypeLabel(r.__facilityInfo?.type);
      const totalGuests = r?.numberOfGuests?.total ?? (
        (parseInt(r?.numberOfAdults || 0, 10) || 0) +
        (parseInt(r?.numberOfChildren || 0, 10) || 0) +
        (parseInt(r?.numberOfPwds || 0, 10) || 0)
      );

      return {
        id: rid,
        date: fmtMDY(r?.createdAt || r?.dateOfArrival || Date.now()),
        type: facType,
        details: {
          groupAssociation: r?.guestName || 'N/A',
          address: r?.homeAddress || 'N/A',
          officeAddress: r?.officeAddress || 'N/A',
          category: mapCategoryLabel(r?.category),
          phoneNo: r?.telephone || 'N/A',
          officeTelephoneNo: r?.officeTelephone || 'N/A',
          numberOfGuests: String(totalGuests ?? 'N/A'),
          emergencyContact: r?.emergencyContact || 'N/A',
          dateOfArrival: fmtLong(r?.dateOfArrival),
          dateOfDeparture: fmtLong(r?.dateOfDeparture),
          typeOfFacility: facType,
          facilityName: facName,
          typeOfService: (r?.serviceType || 'N/A'),
        },
        totalEstimatedAmount: fmtPeso(r?.totalEstimatedAmount),
        confirmed: String(r?.status || '').toUpperCase() === 'CONFIRMED',
      };
    });
  }, [reservationsRaw]);

  const handleGoBack = () => navigate(-1);
  const toggleReservation = (id) => setOpenReservationId(openReservationId === id ? null : id);
  const handleConfirmNow = (reservationId) => alert(`Reservation ${reservationId} confirmed! (placeholder)`);

  return (
    <>
      <HeaderHome />
      <div className={styles.reservationHistoryContainer}>
        <div className={styles.contentWrapper}>
          <div className={styles.headerSection}>
            <button onClick={handleGoBack} className={styles.backButton}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12"></line>
                <polyline points="12 19 5 12 12 5"></polyline>
              </svg>
            </button>
            <h1 className={styles.pageTitle}>RESERVATION HISTORY</h1>
          </div>

          {err && <ErrorBanner err={err} onClose={() => setErr(null)} />}

          {loading ? (
            <div className={styles.loading}>Loading reservations…</div>
          ) : (
            <div className={styles.reservationList}>
              {reservationsView.length === 0 && (
                <div className={styles.emptyStateCard}>
                  <h3 className={styles.emptyTitle}>No reservations yet</h3>
                  <p className={styles.emptyDesc}>When you book your first stay, it will appear here.</p>
                  <div className={styles.emptyActions}>
                    <button className={styles.primaryBtn} onClick={() => navigate('/user/services')}>
                      Make a reservation
                    </button>
                  </div>
                </div>
              )}

              {reservationsView.map((reservation) => (
                <div key={reservation.id} className={styles.reservationCard}>
                  <div
                    className={styles.cardHeader}
                    onClick={() => toggleReservation(reservation.id)}
                    aria-expanded={openReservationId === reservation.id}
                  >
                    <h2 className={styles.cardTitle}>{reservation.type}</h2>
                    <span className={styles.cardDate}>{reservation.date}</span>
                    <span className={styles.toggleIcon}>
                      {openReservationId === reservation.id ? '▲' : '▼'}
                    </span>
                  </div>

                  {openReservationId === reservation.id && (
                    <div className={styles.cardDetails}>
                      {Object.entries(reservation.details).map(([key, value]) => (
                        <div className={styles.detailRow} key={key}>
                          <span className={styles.detailLabel}>
                            {key.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase())}
                          </span>
                          <span className={styles.detailSeparator}>:</span>
                          <span className={styles.detailValue}>
                            {(key === 'facilityName' || key === 'typeOfService')
                              ? String(value ?? '')
                                  .toLowerCase()
                                  .split(/(\s|\/)/)
                                  .map(word => /[a-zA-Z]/.test(word)
                                    ? word.charAt(0).toUpperCase() + word.slice(1)
                                    : word
                                  )
                                  .join('')
                              : value}
                          </span>
                        </div>
                      ))}
                      <div className={styles.amountSection}>
                        <span className={styles.totalAmountLabel}>Total Estimated Amount</span>
                        <span className={styles.totalAmountSeparator}>₱</span>
                        <span className={styles.totalAmountValue}>{reservation.totalEstimatedAmount}</span>
                        <button
                          className={`${styles.confirmButton} ${reservation.confirmed ? styles.confirmedButton : ''}`}
                          onClick={() => handleConfirmNow(reservation.id)}
                          disabled={reservation.confirmed}
                        >
                          {reservation.confirmed
                            ? 'Confirmed'
                            : reservation.details.category === 'Private'
                              ? 'Pay Now!'
                              : 'Confirm Now!'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default ReservationHistory;
