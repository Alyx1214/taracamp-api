import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import HeaderHome from '../HeaderHome/HeaderHome';
import ErrorBanner from '../ErrorBanner/ErrorBanner';
import styles from './ResHistory.module.css';

import { getMyReservations } from '../../apis/reservationApi';
import { getFacilityById } from '../../apis/facilityApi';

// Upload fields configuration (copied from NotifUpload.jsx)
const uploadFields = {
  deped: [
    {
      label: 'Upload Memorandum of Agreement',
      description: (
        <>
          Download this <a href="#" className={styles.link}>Memorandum of Agreement Template</a> and upload in the following submission bin.
        </>
      ),
      accept: '.pdf,.doc,.docx',
      key: 'moa',
    },
    {
      label: 'Upload Certificate of Availability of Funds',
      accept: '.pdf,.doc,.docx',
      key: 'funds',
    },
  ],
  gov: [
    {
      label: 'Upload Service Contract',
      accept: '.pdf,.doc,.docx',
      key: 'service',
    },
    {
      label: 'Upload Certificate of Availability of Funds',
      accept: '.pdf,.doc,.docx',
      key: 'funds',
    },
  ],
  'priva-group': [
    {
      label: 'Upload Service Contract',
      accept: '.pdf,.doc,.docx',
      key: 'service',
    },
    {
      label: 'Upload Certificate of Availability of Funds',
      accept: '.pdf,.doc,.docx',
      key: 'funds',
    },
  ],
  individual: [
    {
      label: 'Upload Valid ID (optional)',
      accept: '.pdf,.jpg,.jpeg,.png',
      key: 'id',
    },
  ],
};

function ReservationHistory() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [reservationsRaw, setReservationsRaw] = useState([]);
  const [openReservationId, setOpenReservationId] = useState(null);
  const [showUploadForId, setShowUploadForId] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState({});
  const fileRefs = useRef({});

  useEffect(() => {
    if (!localStorage.getItem('accessToken')) {
      navigate('/auth/login', { replace: true });
    }
  }, [navigate]);

  const mapFacilityTypeLabel = (t) => {
    const s = String(t || '').trim().toUpperCase();
    if (!s) return 'N/A';
    if (s.includes('Conference')) return 'Conference Hall';
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

  const getClientType = (category) => {
    const s = String(category || '').trim().toUpperCase();
    if (['DEPED', 'DEPARTMENT_OF_EDUCATION', 'DEPARTMENT OF EDUCATION'].includes(s)) return 'deped';
    if (['GOVERNMENT', 'GOVT'].includes(s)) return 'gov';
    if (['PRIVATE', 'PERSONAL'].includes(s)) return 'individual';
    return 'deped';
  };

  const fmtPeso = (n) => {
    const num = Number(n);
    if (!Number.isFinite(num)) return 'N/A';
    return num.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const fmtMDY = (d) => {
    try {
      const dt = new Date(d);
      if (Number.isNaN(dt.getTime())) return 'N/A';
      return dt.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
    } catch { return 'N/A'; }
  };

  const fmtLong = (d) => {
    try {
      const dt = new Date(d);
      if (Number.isNaN(dt.getTime())) return '—';
      return dt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    } catch { return 'N/A'; }
  };

  useEffect(() => {
    let active = true;

    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const data = await getMyReservations().catch((e) => {
          if (e?.status === 404) return { reservations: [] }; 
          throw e;
        });

        if (!active) return;

        const list = Array.isArray(data?.reservations) ? data.reservations : [];
        if (list.length === 0) {
          setReservationsRaw([]);
          setOpenReservationId(null);
          return;
        }

        const ids = [...new Set(list.map(r => String(r?.facility || '')).filter(Boolean))];
        const pairs = await Promise.all(ids.map(async (fid) => {
          try {
            const fj = await getFacilityById(fid);
            const f = fj?.data || fj?.facility || fj?.result || fj;
            return [fid, {
              name: f?.name || 'N/A',
              type: f?.type || f?.facilityType || f?.typeOfFacility || f?.category || 'N/A',
            }];
          } catch {
            return [fid, { name: 'N/A', type: 'N/A' }];
          }
        }));

        if (!active) return;

        const byId = Object.fromEntries(pairs);
        setReservationsRaw(list.map(r => ({
          ...r,
          __facilityInfo: byId[String(r?.facility || '')] || { name: 'N/A', type: 'N/A' },
        })));

        const firstId = String(list[0]._id || list[0].id || '');
        setOpenReservationId(firstId || null);
      } catch (e) {
        if (!active) return;
        setErr({ message: e?.data?.error || e?.message || 'Unable to load reservations' });
        if (e?.status === 401 || e?.status === 403) {
          navigate('/auth/login', { replace: true });
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => { active = false; };
  }, [navigate]);

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

      // Process add-ons
      const addOns = Array.isArray(r?.addOns) && r.addOns.length > 0
        ? r.addOns
        : null;

      // Calculate breakdown
      const facilityFee = Number(r?.facilityFee || 0);
      const addOnsTotal = addOns 
        ? addOns.reduce((sum, addon) => sum + (Number(addon.price) || 0), 0)
        : 0;
      const serviceFee = Number(r?.serviceFee || 0);
      const discount = Number(r?.discount || 0);

      return {
        _id: String(r?._id || ''),
        id: rid,
        date: fmtMDY(r?.createdAt || r?.dateOfArrival || Date.now()),
        type: facType,
        category: r?.category || 'N/A',
        details: {
          type: r?.type || 'N/A',
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
          typeOfService: r?.serviceType || 'N/A',
        },
        breakdown: {
          facilityFee: facilityFee,
          addOns: addOns,
          addOnsTotal: addOnsTotal,
          serviceFee: serviceFee,
          discount: discount,
        },
        totalEstimatedAmount: fmtPeso(r?.totalEstimatedAmount),
        confirmed: String(r?.status || '') === 'Confirmed',
      };
    });
  }, [reservationsRaw]);

  const handleGoBack = () => navigate(-1);
  
  const toggleReservation = (id) =>
    setOpenReservationId(openReservationId === id ? null : id);
  
  const handleConfirmNow = (reservationId, category) => {
    // Show upload section for this reservation
    setShowUploadForId(reservationId);
    // Clear any previous file selections
    setSelectedFiles({});
  };

  const handleFileClick = (key) => {
    fileRefs.current[key]?.click();
  };

  const handleFileChange = (key, e) => {
    const file = e.target.files?.[0] || null;
    setSelectedFiles(prev => ({
      ...prev,
      [key]: file
    }));
  };

  const handleSubmitDocuments = (e, reservationId) => {
    e.preventDefault();
    
    // Get the reservation to determine client type
    const reservation = reservationsView.find(r => r._id === reservationId);
    const clientType = getClientType(reservation?.category);
    const fields = uploadFields[clientType] || uploadFields['deped'];
    
    const files = {};
    fields.forEach(f => {
      const file = fileRefs.current[f.key]?.files?.[0] || selectedFiles[f.key] || null;
      files[f.key] = file;
    });
    
    console.log('Submitting documents for reservation:', reservationId, files);
    
    // TODO: API call to submit documents
    // After successful submission, navigate to transactions
    navigate(`/transactions?reservationId=${encodeURIComponent(reservationId)}`);
  };

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
                    <button className={styles.primaryBtn} onClick={() => navigate('/services')}>
                      Make a reservation
                    </button>
                  </div>
                </div>
              )}

              {reservationsView.map((reservation) => {
                const clientType = getClientType(reservation.category);
                const fields = uploadFields[clientType] || uploadFields['deped'];
                const isUploadVisible = showUploadForId === reservation._id;

                return (
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

                        {/* Breakdown of Fees Section */}
                        <div className={styles.breakdownSection}>
                          <h3 className={styles.breakdownTitle}>Breakdown of Fees</h3>
                          
                          <div className={styles.detailRow}>
                            <span className={styles.detailLabel}>Facility Fee</span>
                            <span className={styles.detailSeparator}>:</span>
                            <span className={styles.detailValue}>₱ {fmtPeso(reservation.breakdown.facilityFee)}</span>
                          </div>

                          {reservation.breakdown.addOns && reservation.breakdown.addOns.length > 0 && (
                            <div className={styles.detailRow}>
                              <span className={styles.detailLabel}>Add-ons</span>
                              <span className={styles.detailSeparator}>:</span>
                              <span className={styles.detailValue}>
                                <div className={styles.addOnsList}>
                                  {reservation.breakdown.addOns.map((addon, index) => (
                                    <div key={index} className={styles.addOnItem}>
                                      {addon.name}: ₱ {fmtPeso(addon.price)}
                                    </div>
                                  ))}
                                </div>
                              </span>
                            </div>
                          )}

                          {!reservation.breakdown.addOns && (
                            <div className={styles.detailRow}>
                              <span className={styles.detailLabel}>Add-ons</span>
                              <span className={styles.detailSeparator}>:</span>
                              <span className={styles.detailValue}>₱ 0.00</span>
                            </div>
                          )}

                          <div className={styles.detailRow}>
                            <span className={styles.detailLabel}>10% Service Fee</span>
                            <span className={styles.detailSeparator}>:</span>
                            <span className={styles.detailValue}>₱ {fmtPeso(reservation.breakdown.serviceFee)}</span>
                          </div>

                          <div className={styles.detailRow}>
                            <span className={styles.detailLabel}>Discount</span>
                            <span className={styles.detailSeparator}>:</span>
                            <span className={styles.detailValue}>₱ {fmtPeso(reservation.breakdown.discount)}</span>
                          </div>
                        </div>

                        {/* Upload Section - Separate and Below Breakdown */}
                        {isUploadVisible && (
                          <div className={styles.uploadSection}>
                            <div className={styles.uploadHeader}>
                              <div className={styles.uploadHeaderTitle}>
                                <span className={styles.uploadHeaderIcon}>📋</span>
                                Document Upload Required
                              </div>
                              <div className={styles.uploadNotice}>
                                Please ensure to download and upload the necessary documents before your arrival to avoid conflict on your reservation.
                              </div>
                            </div>
                            <div className={styles.uploadContent}>
                              <form onSubmit={(e) => handleSubmitDocuments(e, reservation._id)}>
                                <div className={styles.uploadsContainer}>
                                  {fields.map((f) => (
                                    <div className={styles.uploadField} key={f.key}>
                                      <div className={styles.uploadLabel}>{f.label}</div>
                                      {f.description && <div className={styles.uploadDesc}>{f.description}</div>}
                                      <div className={styles.uploadInputRow}>
                                        <input
                                          type="file"
                                          accept={f.accept}
                                          ref={el => {
                                            if (!fileRefs.current[f.key]) fileRefs.current[f.key] = {};
                                            fileRefs.current[f.key] = el;
                                          }}
                                          style={{ display: 'none' }}
                                          onChange={(e) => handleFileChange(f.key, e)}
                                        />
                                        <div
                                          className={styles.uploadInput}
                                          role="button"
                                          tabIndex={0}
                                          onClick={() => handleFileClick(f.key)}
                                          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleFileClick(f.key)}
                                          aria-label={`Upload ${f.label}`}
                                        >
                                          {selectedFiles[f.key] ? selectedFiles[f.key].name : '📎 Click to upload or drag & drop'}
                                        </div>
                                        <button type="button" className={styles.uploadIconBtn} onClick={() => handleFileClick(f.key)} aria-label="Browse">
                                          <span className={styles.uploadIcon}>📤</span>
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </form>
                            </div>
                            <div className={styles.submitBtnWrapper}>
                              <button type="button" onClick={(e) => handleSubmitDocuments(e, reservation._id)} className={styles.submitBtn}>
                                Submit Documents
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Amount Section*/}
                        <div className={styles.amountSection}>
                          <div className={styles.amountRow}>
                            <div className={styles.amountValueContainer}>
                              <span className={styles.totalAmountLabel}>Total Estimated Amount</span>
                              <span className={styles.totalAmountSeparator}>₱</span>
                              <span className={styles.totalAmountValue}>{reservation.totalEstimatedAmount}</span>
                            </div>

                            {!isUploadVisible && (
                              <button
                                className={`${styles.confirmButton} ${reservation.confirmed ? styles.confirmedButton : ''}`}
                                onClick={() => handleConfirmNow(reservation._id, reservation.category)}
                                title={reservation.confirmed ? 'Upload required documents' : undefined}
                              >
                                {reservation.confirmed
                                  ? 'Confirm Now'
                                  : reservation.details.category === 'Private'
                                    ? 'Pay Now!'
                                    : 'Confirm Now!'}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default ReservationHistory;