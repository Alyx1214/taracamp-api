import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import HeaderHome from '../HeaderHome/HeaderHome';
import ErrorBanner from '../ErrorBanner/ErrorBanner';
import styles from './ResHistory.module.css';

import { getMyReservations, uploadConfirmationDocuments } from '../../apis/reservationApi';
import { clearCachedReservation } from '../../utils/reservationCache';

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
};

function ReservationHistory() {
  const navigate = useNavigate();
  const location = useLocation();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [reservationsRaw, setReservationsRaw] = useState([]);
  const [openReservationId, setOpenReservationId] = useState(null);
  const [showUploadForId, setShowUploadForId] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState({});
  const [uploadingReservationId, setUploadingReservationId] = useState(null);
  const fileRefs = useRef({});

  useEffect(() => {
    if (!localStorage.getItem('accessToken')) {
      navigate('/auth/login', { replace: true });
    }
  }, [navigate]);

  const mapFacilityTypeLabel = (t) => {
    if (!t) return 'N/A';
    const s = String(t).trim().toUpperCase();
    if (!s) return 'N/A';
    if (s.includes('CONFERENCE')) return 'Conference Hall';
    if (s.includes('DORM')) return 'Dormitory';
    if (s.includes('COTTAGE') || s.includes('GUEST')) return 'Cottage';
    // If no match, return the original value (might already be formatted)
    return String(t).trim() || 'N/A';
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

  // Check for location state to show upload section (separate from data loading)
  useEffect(() => {
    const showUploadFor = location.state?.showUploadFor;
    if (showUploadFor && reservationsRaw.length > 0) {
      // Find the reservation that matches
      const matchingReservation = reservationsRaw.find(r => String(r._id || r.id) === showUploadFor);
      // Only show upload if reservation exists AND is approved
      if (matchingReservation && String(matchingReservation?.status || '').toLowerCase() === 'approved') {
        // Compute the id the same way as in reservationsView
        const computedId = String(matchingReservation._id || matchingReservation.id || Math.random().toString(36).slice(2));
        // Set the reservation to open and show upload
        setOpenReservationId(computedId);
        setShowUploadForId(String(matchingReservation._id || ''));
      }
      // Clear location state to prevent re-triggering
      navigate(location.pathname, { state: {}, replace: true });
    }
  }, [location.state, reservationsRaw, navigate, location.pathname]);

  useEffect(() => {
    let active = true;

    (async () => {
      // Only show loading if we don't have data yet
      if (reservationsRaw.length === 0) {
        setLoading(true);
      }
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

        // Server now provides facilityName, facilityType, addOns, and breakdown
        setReservationsRaw(list);

        // Only set default open reservation if not already set by location state
        if (!location.state?.showUploadFor && !location.state?.openLatest) {
          const firstId = String(list[0]._id || list[0].id || '');
          setOpenReservationId(firstId || null);
        }
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
      
      // Use server-provided facility name and type
      const facName = r?.facilityName || 'N/A';
      // Map facility type from server
      const facType = mapFacilityTypeLabel(r?.facilityType);
      
      const totalGuests = r?.numberOfGuests?.total ?? (
        (parseInt(r?.numberOfAdults || 0, 10) || 0) +
        (parseInt(r?.numberOfChildren || 0, 10) || 0) +
        (parseInt(r?.numberOfPwds || 0, 10) || 0)
      );

      // Use server-provided addOns (already populated with details)
      const addOns = Array.isArray(r?.addOns) && r.addOns.length > 0
        ? r.addOns
        : null;

      // Use server-provided breakdown
      const breakdown = r?.breakdown || {};
      const facilityFee = Number(breakdown?.facilityFee || 0);
      const addOnsTotal = Number(breakdown?.addOnsTotal || 0);
      const serviceFee = Number(breakdown?.serviceFee || 0);
      const discount = Number(breakdown?.discount || 0);

      return {
        _id: String(r?._id || ''),
        id: rid,
        date: fmtMDY(r?.createdAt || r?.dateOfArrival || Date.now()),
        createdAt: r?.createdAt || r?.dateOfArrival || Date.now(),
        type: facType,
        category: r?.category || 'N/A',
        details: {
          type: r?.guestType || 'N/A',
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
        files: {
          letterOfIntentFile: r?.letterOfIntentFile || null,
          seniorCitizenIdFiles: Array.isArray(r?.seniorCitizenIdFiles) ? r.seniorCitizenIdFiles : [],
          pwdIdFiles: Array.isArray(r?.pwdIdFiles) ? r.pwdIdFiles : [],
          governmentIdFiles: Array.isArray(r?.governmentIdFiles) ? r.governmentIdFiles : [],
          moaFile: r?.moaFile || null,
          serviceContractFile: r?.serviceContractFile || null,
          fundsFile: r?.fundsFile || null,
        },
        totalEstimatedAmount: fmtPeso(r?.totalEstimatedAmount),
        status: r?.status || 'Pending',
        approved: String(r?.status || '').toLowerCase() === 'approved',
        confirmed: String(r?.status || '') === 'Confirmed',
      };
    }).sort((a, b) => {
      // Sort by createdAt date, latest first (descending order)
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateB - dateA;
    });
  }, [reservationsRaw]);

  // Handle openLatest state - scroll to top and open latest reservation
  // This must come after reservationsView is defined
  useEffect(() => {
    const openLatest = location.state?.openLatest;
    if (openLatest && reservationsView.length > 0) {
      // Scroll to top
      window.scrollTo({ top: 0, behavior: 'smooth' });
      
      // Open the latest reservation (first in sorted reservationsView, which is already sorted by createdAt descending)
      const latestReservation = reservationsView[0];
      if (latestReservation) {
        setOpenReservationId(latestReservation.id || null);
      }
      
      // Clear location state to prevent re-triggering
      navigate(location.pathname, { state: {}, replace: true });
    }
  }, [location.state, reservationsView, navigate, location.pathname]);

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

  const handleSubmitDocuments = async (e, reservationId) => {
    e.preventDefault();
    
    if (uploadingReservationId === reservationId) return; // Prevent double submission
    
    // Get the reservation to determine client type
    const reservation = reservationsView.find(r => r._id === reservationId);
    if (!reservation) {
      alert('Reservation not found. Please try again.');
      return;
    }
    
    const clientType = getClientType(reservation?.category);
    const fields = uploadFields[clientType] || uploadFields['deped'];
    
    // Collect files from file inputs or selectedFiles state
    const files = {};
    fields.forEach(f => {
      const file = fileRefs.current[f.key]?.files?.[0] || selectedFiles[f.key] || null;
      files[f.key] = file;
    });
    
    // Validate required files based on client type
    const requiredFields = fields.filter(f => !f.label.toLowerCase().includes('optional'));
    const missingFiles = requiredFields.filter(f => !files[f.key]);
    
    if (missingFiles.length > 0) {
      const missingLabels = missingFiles.map(f => f.label).join(', ');
      alert(`Please upload the following required documents: ${missingLabels}`);
      return;
    }
    
    // Map files to API format
    // Backend supports: moaFile (for deped), serviceContractFile (for gov/priva-group), and fundsFile
    const moaFile = files.moa || null;
    const serviceContractFile = files.service || null;
    const fundsFile = files.funds || null;
    
    // For individual type, there's no backend support yet, but we'll still try
    if (files.id) {
      console.warn('ID file upload not yet supported by backend:', files.id.name);
    }
    
    // Validate that at least one supported file is provided
    if (!moaFile && !serviceContractFile && !fundsFile) {
      alert('Please upload at least one required document (MOA, Service Contract, or Certificate of Availability of Funds).');
      return;
    }
    
    setUploadingReservationId(reservationId);
    setErr(null);
    
    try {
      console.log('Uploading documents for reservation:', reservationId, {
        moaFile: moaFile ? moaFile.name : 'none',
        serviceContractFile: serviceContractFile ? serviceContractFile.name : 'none',
        fundsFile: fundsFile ? fundsFile.name : 'none'
      });
      
      // Upload documents and confirm reservation
      await uploadConfirmationDocuments(reservationId, moaFile, serviceContractFile, fundsFile);
      
      // Clear cached reservation data since it's been updated
      clearCachedReservation(reservationId);
      
      // Clear file selections
      setSelectedFiles({});
      Object.keys(fileRefs.current).forEach(key => {
        if (fileRefs.current[key] && fileRefs.current[key].value) {
          fileRefs.current[key].value = '';
        }
      });
      
      // Hide upload section
      setShowUploadForId(null);
      
      // Show success message
      alert('Documents submitted and reservation confirmed. Thank you!');
      
      // Refresh reservations to show updated status
      const data = await getMyReservations().catch((e) => {
        if (e?.status === 404) return { reservations: [] };
        throw e;
      });
      
      const list = Array.isArray(data?.reservations) ? data.reservations : [];
      if (list.length > 0) {
        setReservationsRaw(list);
        // Keep the same reservation open
        const currentReservation = list.find(r => String(r._id || r.id) === reservationId);
        if (currentReservation) {
          const computedId = String(currentReservation._id || currentReservation.id || Math.random().toString(36).slice(2));
          setOpenReservationId(computedId);
        }
      }
    } catch (error) {
      console.error('Failed to upload documents and confirm reservation:', error);
      const errorMessage = error?.data?.error || 
                          error?.data?.message || 
                          error?.message || 
                          'Failed to upload documents and confirm reservation. Please try again.';
      setErr({ message: errorMessage });
      alert(errorMessage);
    } finally {
      setUploadingReservationId(null);
    }
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
                const isUploading = uploadingReservationId === reservation._id;

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
                        {Object.entries(reservation.details).map(([key, value]) => {
                          const isTypeOfService = key === 'typeOfService';
                          
                          return (
                            <React.Fragment key={key}>
                              <div className={styles.detailRow}>
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
                              
                              {/* Insert uploaded files after Type of Service */}
                              {isTypeOfService && (
                                <>
                                  {reservation.files.letterOfIntentFile && (
                                    <div className={styles.detailRow}>
                                      <span className={styles.detailLabel}>Letter of Intent</span>
                                      <span className={styles.detailSeparator}>:</span>
                                      <span className={styles.detailValue}>
                                        <a 
                                          href={reservation.files.letterOfIntentFile.url} 
                                          target="_blank" 
                                          rel="noopener noreferrer"
                                          className={styles.fileLink}
                                        >
                                          Click to open
                                        </a>
                                      </span>
                                    </div>
                                  )}
                                  
                                  {reservation.files.governmentIdFiles.length > 0 && (
                                    <div className={styles.detailRow}>
                                      <span className={styles.detailLabel}>Government ID</span>
                                      <span className={styles.detailSeparator}>:</span>
                                      <span className={styles.detailValue}>
                                        <div className={styles.fileList}>
                                          {reservation.files.governmentIdFiles.map((file, idx) => (
                                            <a 
                                              key={idx}
                                              href={file.url} 
                                              target="_blank" 
                                              rel="noopener noreferrer"
                                              className={styles.fileLink}
                                            >
                                              Click to open
                                            </a>
                                          ))}
                                        </div>
                                      </span>
                                    </div>
                                  )}
                                  
                                  {reservation.files.seniorCitizenIdFiles.length > 0 && (
                                    <div className={styles.detailRow}>
                                      <span className={styles.detailLabel}>Senior Citizen ID</span>
                                      <span className={styles.detailSeparator}>:</span>
                                      <span className={styles.detailValue}>
                                        <div className={styles.fileList}>
                                          {reservation.files.seniorCitizenIdFiles.map((file, idx) => (
                                            <a 
                                              key={idx}
                                              href={file.url} 
                                              target="_blank" 
                                              rel="noopener noreferrer"
                                              className={styles.fileLink}
                                            >
                                              Click to open
                                            </a>
                                          ))}
                                        </div>
                                      </span>
                                    </div>
                                  )}
                                  
                                  {reservation.files.pwdIdFiles.length > 0 && (
                                    <div className={styles.detailRow}>
                                      <span className={styles.detailLabel}>PWD ID</span>
                                      <span className={styles.detailSeparator}>:</span>
                                      <span className={styles.detailValue}>
                                        <div className={styles.fileList}>
                                          {reservation.files.pwdIdFiles.map((file, idx) => (
                                            <a 
                                              key={idx}
                                              href={file.url} 
                                              target="_blank" 
                                              rel="noopener noreferrer"
                                              className={styles.fileLink}
                                            >
                                              Click to open
                                            </a>
                                          ))}
                                        </div>
                                      </span>
                                    </div>
                                  )}
                                  
                                  {reservation.files.moaFile && (
                                    <div className={styles.detailRow}>
                                      <span className={styles.detailLabel}>Memorandum of Agreement</span>
                                      <span className={styles.detailSeparator}>:</span>
                                      <span className={styles.detailValue}>
                                        <a 
                                          href={reservation.files.moaFile.url} 
                                          target="_blank" 
                                          rel="noopener noreferrer"
                                          className={styles.fileLink}
                                        >
                                          Click to open
                                        </a>
                                      </span>
                                    </div>
                                  )}
                                  
                                  {reservation.files.serviceContractFile && (
                                    <div className={styles.detailRow}>
                                      <span className={styles.detailLabel}>Service Contract</span>
                                      <span className={styles.detailSeparator}>:</span>
                                      <span className={styles.detailValue}>
                                        <a 
                                          href={reservation.files.serviceContractFile.url} 
                                          target="_blank" 
                                          rel="noopener noreferrer"
                                          className={styles.fileLink}
                                        >
                                          Click to open
                                        </a>
                                      </span>
                                    </div>
                                  )}
                                  
                                  {reservation.files.fundsFile && (
                                    <div className={styles.detailRow}>
                                      <span className={styles.detailLabel}>Certificate of Availability of Funds</span>
                                      <span className={styles.detailSeparator}>:</span>
                                      <span className={styles.detailValue}>
                                        <a 
                                          href={reservation.files.fundsFile.url} 
                                          target="_blank" 
                                          rel="noopener noreferrer"
                                          className={styles.fileLink}
                                        >
                                          Click to open
                                        </a>
                                      </span>
                                    </div>
                                  )}
                                </>
                              )}
                            </React.Fragment>
                          );
                        })}

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
                              <button 
                                type="button" 
                                onClick={(e) => handleSubmitDocuments(e, reservation._id)} 
                                className={styles.submitBtn}
                                disabled={isUploading}
                              >
                                {isUploading ? 'Uploading...' : 'Submit Documents'}
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

                            {!isUploadVisible && reservation.approved && (
                              <button
                                className={styles.confirmButton}
                                onClick={() => handleConfirmNow(reservation._id, reservation.category)}
                              >
                                {reservation.details.category === 'Private'
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