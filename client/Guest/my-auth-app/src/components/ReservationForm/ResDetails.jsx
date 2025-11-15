
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import styles from './ResDetails.module.css';
import HeaderHome from '../HeaderHome/HeaderHome';
import ErrorBanner from '../ErrorBanner/ErrorBanner';
import { buildReservationPayload, mapServiceType, pickCategory } from '../../utils/reservationMapper';
import ConfirmationOverlay from './ConfirmationOverlay';
import { estimateAmount as apiEstimateAmount, createReservation as apiCreateReservation, } from '../../apis/reservationApi';
import { getAllAddons } from '../../apis/addonsApi';

function ResDetails({ onClose }) {
  const navigate = useNavigate();
  const location = useLocation();
  const inFlight = useRef(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState(null);
  const [quote, setQuote] = useState(null);
  const [breakdown, setBreakdown] = useState(null);
  const [allAddons, setAllAddons] = useState([]);
  const { type, facilityName, id } = useParams();
  const { step1 = {}, step2 = {}, file, seniorCitizenIdFiles, seniorCitizenIdFile, pwdIdFiles, pwdIdFile, governmentIdFiles, governmentIdFile } = location.state || {};
  const selectedAddons = step2.selectedAddons || [];
  const numberOfSeniors = parseInt(step1?.guests?.senior || 0, 10) || 0;
  const numberOfPwds = parseInt(step1?.guests?.pwds || 0, 10) || 0;
  const isGovernmentCategory = step1?.category?.government === true || step1?.category?.deped === true;
  const isPwdCategory = step1?.category?.pwds === true || step1?.category?.PWDs === true;
  const isPrivateCategory = step1?.category?.private === true || step1?.category?.Private === true;
  const routeType = String(type || '').toLowerCase();
  const isGroup = routeType === 'group' || !!step1?.type?.groups || !!step1?.type?.group;
  const isIndividual = routeType === 'individual' || !!step1?.type?.individual;
  
  const seniorCitizenFiles = seniorCitizenIdFiles || (seniorCitizenIdFile ? [seniorCitizenIdFile] : []);
  const pwdFiles = pwdIdFiles || (pwdIdFile ? [pwdIdFile] : []);
  const governmentFiles = governmentIdFiles || (governmentIdFile ? [governmentIdFile] : []);

  const handlePrevious = () => {
    const numberOfSeniors = parseInt(step1?.guests?.senior || 0, 10) || 0;
    const numberOfPwds = parseInt(step1?.guests?.pwds || 0, 10) || 0;
    const hasSeniors = numberOfSeniors > 0;
    const hasPwds = numberOfPwds > 0;
    const routeType = String(type || '').toLowerCase();
    const isIndividual = Boolean(step1?.type?.individual) || routeType === 'individual';
    const isGroup = Boolean(step1?.type?.groups) || routeType === 'group';
    const isPrivateAndIndividual = isPrivateCategory && isIndividual;
    const isPrivateAndIndividualWithSeniors = isPrivateAndIndividual && hasSeniors;

    // For private+individual: check if seniors are present
    if (isPrivateAndIndividual) {
      if (hasSeniors) {
        // If seniors present, go back to senior citizen ID upload
        navigate(`/reservation-step3-senior/${type}/${facilityName}/${id}`, {
          state: { step1, step2, file: null, seniorCitizenIdFiles: seniorCitizenFiles, pwdIdFiles: [], governmentIdFiles: [] }
        });
      } else {
        // If no seniors, go directly back to step 2
        navigate(`/reservation-step2/${type}/${facilityName}/${id}`, {
          state: { step1, step2, file: null, seniorCitizenIdFiles: [], pwdIdFiles: [], governmentIdFiles: [] }
        });
      }
      return;
    }

    // For gov't/deped groups or individuals: route back to government ID upload (even if seniors/PWDs present)
    // Only gov't/deped ID is needed, not senior citizen ID
    if ((isGroup || isIndividual) && isGovernmentCategory) {
      navigate(`/reservation-step3-government/${type}/${facilityName}/${id}`, {
        state: { step1, step2, file, seniorCitizenIdFiles: seniorCitizenFiles, pwdIdFiles: pwdFiles, governmentIdFiles: governmentFiles }
      });
      return;
    }

    // For private groups: route back appropriately based on what IDs were uploaded
    // If PWD IDs were uploaded, go back to PWD ID upload page
    // If senior citizen IDs were uploaded, go back to senior citizen ID upload page
    // Otherwise, go back to Letter of Intent upload
    if (isGroup && isPrivateCategory) {
      if (pwdFiles.length > 0) {
        // If PWD IDs were uploaded, go back to PWD ID upload page
        navigate(`/reservation-step3-pwd/${type}/${facilityName}/${id}`, {
          state: { step1, step2, file, seniorCitizenIdFiles: seniorCitizenFiles, pwdIdFiles: pwdFiles, governmentIdFiles: [] }
        });
      } else if (seniorCitizenFiles.length > 0) {
        // If senior citizen IDs were uploaded, go back to senior citizen ID upload page
        navigate(`/reservation-step3-senior/${type}/${facilityName}/${id}`, {
          state: { step1, step2, file, seniorCitizenIdFiles: seniorCitizenFiles, pwdIdFiles: [], governmentIdFiles: [] }
        });
      } else {
        // No IDs uploaded, go back to Letter of Intent upload
        navigate(`/reservation-step3/${type}/${facilityName}/${id}`, {
          state: { step1, step2, file, seniorCitizenIdFiles: [], pwdIdFiles: [], governmentIdFiles: [] }
        });
      }
      return;
    }

    // For PWD category groups: route back to PWD ID upload (even if seniors present)
    // Only PWD ID is needed, not senior citizen ID
    if (isGroup && isPwdCategory) {
      navigate(`/reservation-step3-pwd/${type}/${facilityName}/${id}`, {
        state: { step1, step2, file, seniorCitizenIdFiles: seniorCitizenFiles, pwdIdFiles: pwdFiles, governmentIdFiles: governmentFiles }
      });
      return;
    }

    if (hasPwds) {
      navigate(`/reservation-step3-pwd/${type}/${facilityName}/${id}`, {
        state: { step1, step2, file, seniorCitizenIdFiles: seniorCitizenFiles, pwdIdFiles: pwdFiles, governmentIdFiles: governmentFiles }
      });
      return;
    }

    if (hasSeniors) {
      navigate(`/reservation-step3-senior/${type}/${facilityName}/${id}`, {
        state: { step1, step2, file, seniorCitizenIdFiles: seniorCitizenFiles, pwdIdFiles: [], governmentIdFiles: governmentFiles }
      });
      return;
    }

    if (isGroup) {
      navigate(`/reservation-step3/${type}/${facilityName}/${id}`, {
        state: { step1, step2, file, seniorCitizenIdFiles: [], pwdIdFiles: [], governmentIdFiles: governmentFiles }
      });
      return;
    }

    navigate(`/reservation-step2/${type}/${facilityName}/${id}`, {
      state: { step1, step2, file, seniorCitizenIdFiles: [], pwdIdFiles: [], governmentIdFiles: governmentFiles }
    });
  };

  // Helper function to render add-ons with label and indented items
  const renderAddOns = () => {
    const currentSelectedAddons = step2?.selectedAddons || [];
    if (!currentSelectedAddons || currentSelectedAddons.length === 0) {
      return <tr><td>Add-ons</td><td>:</td><td>₱ 0</td></tr>;
    }
    
    return (
      <>
        <tr><td>Add-ons</td><td>:</td><td></td></tr>
        {currentSelectedAddons.map((selectedAddon, index) => {
          // Find the full add-on data by matching the value (ID) or _id
          const addonId = selectedAddon.value || selectedAddon._id;
          const addonData = allAddons.find(addon => addon._id === addonId);
          const price = addonData?.price || 0;
          
          return (
            <tr key={index}>
              <td style={{ paddingLeft: '20px' }}>• {selectedAddon.label || selectedAddon.name || 'Unknown'}</td>
              <td>:</td>
              <td>₱ {Math.round(price).toLocaleString()}</td>
            </tr>
          );
        })}
      </>
    );
  };

  useEffect(() => {
    if (!id) navigate('/user/services', { replace: true });
  }, [id, navigate]);

  // Fetch all add-ons to get price information
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getAllAddons();
        if (!cancelled && data?.addons) {
          setAllAddons(data.addons);
        }
      } catch (error) {
        console.error('Failed to fetch add-ons:', error);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const [adjustedArrivalDate, setAdjustedArrivalDate] = useState(null);
  const [earlyArrivalFee, setEarlyArrivalFee] = useState(0);

  useEffect(() => {
    if (!id) return;

    const a = parseInt(step1?.guests?.adult || 0, 10) || 0;
    const c = parseInt(step1?.guests?.children || 0, 10) || 0;
    const p = parseInt(step1?.guests?.pwds || 0, 10) || 0;
    const s = parseInt(step1?.guests?.senior || 0, 10) || 0;

    const fid = typeof step2?.facilityIdFromList === 'string' ? step2.facilityIdFromList : id;
    
    // Extract selectedAddons from step2 inside the effect to ensure it's always fresh
    const currentSelectedAddons = step2?.selectedAddons || [];
    // Map addon IDs, handling both value and _id properties, and filter out undefined/null values
    const addonIds = currentSelectedAddons
      .map(addon => addon.value || addon._id)
      .filter(Boolean);

    // Convert time to 24-hour format
    const timeArrivalHour = step2?.timeArrivalHour || '02';
    const timeArrivalAMPM = step2?.timeArrivalAMPM || 'PM';
    const hour12 = parseInt(timeArrivalHour, 10) || 2;
    const hour24 = timeArrivalAMPM === 'PM' && hour12 !== 12 
      ? hour12 + 12 
      : (timeArrivalAMPM === 'AM' && hour12 === 12 ? 0 : hour12);
    const timeOfArrival = `${String(hour24).padStart(2, '0')}:00`;

    let abort = false;
    (async () => {
      try {
        const data = await apiEstimateAmount({
          facility: fid,
          adults: a,
          children: c,
          pwds: p,
          seniorCitizens: s,
          serviceType: mapServiceType(step2?.typeService),
          category: pickCategory(step1.category),
          addOns: addonIds.length > 0 ? addonIds : undefined,
          dateOfArrival: step2?.dateArrival,
          dateOfDeparture: step2?.dateDeparture,
          timeOfArrival: timeOfArrival,
        });
        if (!abort) {
          setQuote(data.amount);
          setBreakdown({
            baseAmount: data.baseAmount || 0,
            facilityFee: data.facilityFee || 0,
            serviceFee: data.serviceFee || 0,
            discount: data.discount || 0,
            addonsTotal: data.addonsTotal || 0
          });
          setAdjustedArrivalDate(data.adjustedArrivalDate || null);
          setEarlyArrivalFee(data.earlyArrivalFee || 0);
        }
      } catch {
        if (!abort) {
          setQuote(null);
          setBreakdown(null);
          setAdjustedArrivalDate(null);
          setEarlyArrivalFee(0);
        }
      }
    })();

    return () => {
      abort = true;
    };
  }, [step1, step2, id]);

  const amountText = quote != null ? `₱ ${Math.round(quote).toLocaleString()}` : '—';

  const data = useMemo(() => {
    const guestsTotal =
      (parseInt(step1?.guests?.adult || '0', 10) || 0) +
      (parseInt(step1?.guests?.children || '0', 10) || 0) +
      (parseInt(step1?.guests?.pwds || '0', 10) || 0) +
      (parseInt(step1?.guests?.senior || '0', 10) || 0);

    // Use adjusted arrival date if available, otherwise use original
    const displayArrival = adjustedArrivalDate || step2.dateArrival || 'N/A';

    return {
      group: step1.groupAssociation || 'N/A',
      address: step1.homeAddress || 'N/A',
      officeAddress: step1.officeAddress || 'N/A',
      category: pickCategory(step1.category),
      phone: step1.phoneNo || 'N/A',
      officeTel: step1.officeTelephoneNo || 'N/A',
      guests: String(guestsTotal),
      emergency: step1.emergencyContact || 'N/A',
      arrival: displayArrival,
      departure: step2.dateDeparture || 'N/A',
      facilityType: step2.typeFacilities || 'N/A',
      facilityName: step2.facilityLabelFromList || step2.facilityName || 'N/A',
      service: step2.typeService === 'Other' ? step2.customService || 'Other' : step2.typeService || '—',
    };
  }, [step1, step2, adjustedArrivalDate]);

  async function handleSubmit() {
    if (inFlight.current) return;
    inFlight.current = true;
    setErr(null);
    setSubmitting(true);

    try {
      const payload = buildReservationPayload(step1, step2, id);

      const atLeastOneGuest =
        (payload.numberOfAdults || 0) + (payload.numberOfChildren || 0) + (payload.numberOfPwds || 0) + (payload.numberOfSeniorCitizens || 0) > 0;
      if (!atLeastOneGuest) throw new Error('At least one guest is required.');
      if (!payload.dateOfArrival || !payload.dateOfDeparture)
        throw new Error('Arrival and departure dates are required.');
      if (!payload.timeOfArrival) throw new Error('Time of arrival is required.');
      if (!file && type === 'Group') throw new Error('Letter of Intent file is required.');
      // For private category with individual type: Senior Citizen ID is required if there are seniors
      const isPrivateAndIndividual = isPrivateCategory && isIndividual;
      const isPrivateAndIndividualWithSeniors = isPrivateAndIndividual && numberOfSeniors > 0;
      // Require Senior Citizen ID if there are seniors, EXCEPT for:
      // - gov/deped groups or individuals (only gov ID needed)
      // - PWD groups or individuals (only PWD ID needed)
      // - private+individual WITHOUT seniors (no ID needed)
      // But DO require it for:
      // - private groups WITH seniors (Senior Citizen ID is required)
      // - private+individual WITH seniors
      const shouldSkipSeniorCitizenId = (isGroup && isGovernmentCategory) || 
                                       (isIndividual && isGovernmentCategory) || 
                                       (isGroup && isPwdCategory) || 
                                       (isIndividual && isPwdCategory) ||
                                       (isPrivateAndIndividual && !isPrivateAndIndividualWithSeniors);
      if (numberOfSeniors > 0 && seniorCitizenFiles.length === 0 && !shouldSkipSeniorCitizenId) {
        throw new Error('At least one Senior Citizen ID file is required when there are senior citizens.');
      }
      // Skip PWD ID requirement for government/deped groups, government individuals, and private+individual (without seniors) - only government ID is needed for gov't
      // Note: PWD ID is required for private groups when PWDs are present
      if (numberOfPwds > 0 && pwdFiles.length === 0 && !(isGroup && isGovernmentCategory) && !(isIndividual && isGovernmentCategory) && !isPrivateAndIndividual) {
        throw new Error('At least one PWD ID file is required when there are PWD guests.');
      }
      // Skip government ID requirement for private groups and private+individual - no ID needed for private groups (only Letter of Intent), and for private+individual only Senior Citizen ID if seniors present
      if ((isGroup || isIndividual) && isGovernmentCategory && governmentFiles.length === 0 && !isPrivateAndIndividual && !(isGroup && isPrivateCategory)) {
        throw new Error('At least one Government ID file is required for government/DepEd reservations.');
      }

      const facilityForPost = typeof step2?.facilityIdFromList === 'string' ? step2.facilityIdFromList : id;
      const currentSelectedAddons = step2?.selectedAddons || [];
      const addonIds = currentSelectedAddons.map(addon => addon.value || addon._id).filter(Boolean);
      const apiPayload = { ...payload, facility: facilityForPost };
      
      // Include addons in payload if any are selected
      if (addonIds.length > 0) {
        apiPayload.addOns = addonIds;
      }

      await apiCreateReservation(apiPayload, file, seniorCitizenFiles, pwdFiles, governmentFiles);
      setShowOverlay(true); 
    } catch (e) {
      const server = {
        message: e?.data?.error || e?.data?.message || e.message || 'Reservation failed',
        details: Array.isArray(e?.data?.details) ? e.data.details : null,
        status: e?.status,
      };
      setErr(server);
      let mapped = { errorsStep1: {}, errorsStep2: {} };
      if (server.details?.length) {
        const step1Map = {
          guestName: 'groupAssociation',
          homeAddress: 'homeAddress',
          officeAddress: 'officeAddress',
          category: 'category',
          guestType: 'type',
          telephone: 'phoneNo',
          officeTelephone: 'officeTelephoneNo',
          emergencyContact: 'emergencyContact',
          numberOfAdults: 'guestsAdult',
          numberOfChildren: 'guestsChildren',
          numberOfPwds: 'guestsPwds',
        };
        const step2Map = {
          dateOfArrival: 'dateArrival',
          dateOfDeparture: 'dateDeparture',
          facility: 'facilityName',
          serviceType: 'typeService',
          timeOfArrival: 'timeArrivalHour',
          otherRequests: 'specialRequests',
        };
        const e1 = {};
        const e2 = {};
        for (const d of server.details) {
          const ui1 = step1Map[d.field];
          const ui2 = step2Map[d.field];
          const msg = d.message || d.code || 'Invalid';
          if (ui1) e1[ui1] = msg;
          if (ui2) e2[ui2] = msg;
        }
        mapped = { errorsStep1: e1, errorsStep2: e2 };
      } else {
        const m = (server.message || '').toLowerCase();
        const e1 = {};
        const e2 = {};
        if (m.includes('invalid phone')) e1.phoneNo = 'Enter a valid PH mobile number.';
        if (m.includes('emergency')) e1.emergencyContact = 'Enter a valid PH mobile number.';
        if (m.includes('at least one guest')) e1.guestsAdult = 'Enter at least one guest.';
        if (m.includes('invalid date range')) {
          e2.dateArrival = 'Arrival must be tomorrow or later.';
          e2.dateDeparture = 'Departure must be after arrival.';
        }
        if (m.includes('facility is not available')) {
          e2.dateArrival = 'Facility is not available for the selected dates.';
          e2.dateDeparture = 'Choose different dates.';
          e2.facilityName = 'Select another facility or change the date range.';
        }
        mapped = { errorsStep1: e1, errorsStep2: e2 };
      }

      if (Object.keys(mapped.errorsStep1).length) {
        navigate(`/reservation-form/${type}/${facilityName}/${id}`, { state: { step1, errorsStep1: mapped.errorsStep1, serverError: server, file } });
      } else if (Object.keys(mapped.errorsStep2).length) {
        navigate(`/reservation-step2/${type}/${facilityName}/${id}`, { state: { step1, step2, errorsStep2: mapped.errorsStep2, serverError: server, file } });
      }
    } finally {
      setSubmitting(false);
      inFlight.current = false;
    }
  }


  return (
    <>
      <HeaderHome />
      <div className={styles.overlay}>
        <div className={styles.detailsCard}>
          <div className={styles.headerBar}>
            <span className={styles.title}>RESERVATION DETAILS</span>
            <button className={styles.closeBtn} onClick={onClose}>×</button>
          </div>

          <div className={styles.detailsContent}>
            <ErrorBanner err={err} onClose={() => setErr(null)} />

            <table className={styles.detailsTable}>
              <tbody>
                <tr><td>Group/Association</td><td>:</td><td>{data.group}</td></tr>
                <tr><td>Address</td><td>:</td><td>{data.address}</td></tr>
                <tr><td>Office Address</td><td>:</td><td>{data.officeAddress}</td></tr>
                <tr><td>Category</td><td>:</td><td>{data.category}</td></tr>
                <tr><td>Phone No.</td><td>:</td><td>{data.phone}</td></tr>
                <tr><td>Office Telephone No.</td><td>:</td><td>{data.officeTel}</td></tr>
                <tr><td>Number of Guests</td><td>:</td><td>{data.guests}</td></tr>
                <tr><td>Emergency Contact</td><td>:</td><td>{data.emergency}</td></tr>
                <tr><td>Date of Arrival</td><td>:</td><td>{data.arrival}</td></tr>
                <tr><td>Date of Departure</td><td>:</td><td>{data.departure}</td></tr>
                <tr><td>Type of Facility</td><td>:</td><td>{data.facilityType}</td></tr>
                <tr><td>Facility Name</td><td>:</td><td>{data.facilityName}</td></tr>
                <tr><td>Type of Service</td><td>:</td><td>{data.service}</td></tr>
              </tbody>
            </table>

            {breakdown && (
              <>
                <div className={styles.amountLine}></div>
                <table className={styles.detailsTable}>
                  <tbody>
                    <tr><td><strong>Breakdown of Fees</strong></td><td></td><td></td></tr>
                    <tr><td>Facility Fee</td><td>:</td><td>₱ {Math.round(breakdown.facilityFee || 0).toLocaleString()}</td></tr>
                    {renderAddOns()}
                    <tr><td>10% Service Fee</td><td>:</td><td>₱ {Math.round(breakdown.serviceFee || 0).toLocaleString()}</td></tr>
                    <tr><td>Discount</td><td>:</td><td>₱ {Math.round(breakdown.discount || 0).toLocaleString()}</td></tr>
                    <tr className={styles.amountRow}>
                      <td colSpan={3}>
                        <div className={styles.amountLine}></div>
                        <div className={styles.amountLabel}>Total Estimated Amount</div>
                        <span className={styles.amountValue}>{amountText}</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </>
            )}

            {!breakdown && (
              <table className={styles.detailsTable}>
                <tbody>
                  <tr className={styles.amountRow}>
                    <td colSpan={3}>
                      <div className={styles.amountLine}></div>
                      <div className={styles.amountLabel}>Total Estimated Amount</div>
                      <span className={styles.amountValue}>{amountText}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            )}

            <div className={styles.amountNote}>
              Note that this is just an estimated amount and is subject to change
            </div>
          </div>
        </div>

        <div className={styles.buttonContainer}>
          <button
            type="button"
            className={styles.previousBtn}
            onClick={handlePrevious}
          >
            Previous
          </button>
          <button
            type="button"
            className={styles.submitBtn}
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? 'Submitting…' : 'Submit'}
          </button>
        </div>
      </div>

      {showOverlay && (
        <ConfirmationOverlay
          onDone={() => navigate('/homepage')}
          onReview={() => navigate('/reservations', { state: { openLatest: true } })}
        />
      )}
    </>
  );
}

export default ResDetails;
