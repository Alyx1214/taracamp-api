import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getReservationById } from '../../apis/reservationApi';
import { getAllAddons } from '../../apis/addonsApi';

export default function EditReservation() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await getReservationById(id);
        if (cancelled) return;

        if (!res?.reservation) {
          setError('Reservation not found.');
          return;
        }

        const reservation = res.reservation;

        // Map reservation data to form structure
        const step1 = {
          groupAssociation: reservation.guestName || '',
          homeAddress: reservation.homeAddress || '',
          officeAddress: reservation.officeAddress || '',
          category: {
            deped: reservation.category === 'DepEd',
            government: reservation.category === 'Government',
            pwds: reservation.category === 'PWDs',
            private: reservation.category === 'Private',
          },
          type: {
            groups: reservation.guestType === 'Group',
            individual: reservation.guestType === 'Individual',
          },
          phoneNo: reservation.telephone || '',
          guestEmail: reservation.guestEmail || '',
          officeTelephoneNo: reservation.officeTelephone || '',
          guests: {
            adult: String(reservation.numberOfGuests?.adult ?? reservation.numberOfAdults ?? 0),
            children: String(reservation.numberOfGuests?.children ?? reservation.numberOfChildren ?? 0),
            pwds: String(reservation.numberOfGuests?.pwds ?? reservation.numberOfPwds ?? 0),
            senior: String(reservation.numberOfGuests?.seniorCitizen ?? reservation.numberOfSeniorCitizens ?? 0),
          },
          emergencyContactPerson: reservation.emergencyContactPerson || '',
          emergencyContact: reservation.emergencyContact || '',
        };

        // Parse time of arrival (format: HH:00)
        let timeArrivalHour = '2';
        let timeArrivalAMPM = 'PM';
        if (reservation.timeOfArrival) {
          const timeMatch = reservation.timeOfArrival.match(/(\d+):/);
          if (timeMatch) {
            const hour24 = parseInt(timeMatch[1], 10);
            if (hour24 === 0) {
              timeArrivalHour = '12';
              timeArrivalAMPM = 'AM';
            } else if (hour24 < 12) {
              timeArrivalHour = String(hour24);
              timeArrivalAMPM = 'AM';
            } else if (hour24 === 12) {
              timeArrivalHour = '12';
              timeArrivalAMPM = 'PM';
            } else {
              timeArrivalHour = String(hour24 - 12);
              timeArrivalAMPM = 'PM';
            }
          }
        }

        // Map addons if they exist
        // First, fetch all addons to get their names
        let allAddonsList = [];
        try {
          const addonsResponse = await getAllAddons();
          if (addonsResponse?.addons && Array.isArray(addonsResponse.addons)) {
            allAddonsList = addonsResponse.addons;
          }
        } catch (addonError) {
          console.warn('Failed to fetch addons for mapping:', addonError);
        }

        const selectedAddons = [];
        if (reservation.addOns && Array.isArray(reservation.addOns)) {
          reservation.addOns.forEach(addon => {
            // Handle case where addon is an ObjectId string
            let addonId = null;
            let addonName = 'Unknown';
            
            if (typeof addon === 'string') {
              // addon is an ObjectId string
              addonId = addon;
              // Find the addon name from the fetched list
              const addonData = allAddonsList.find(a => String(a._id) === String(addonId));
              if (addonData) {
                addonName = addonData.name || 'Unknown';
              }
            } else if (addon && (addon._id || addon.id)) {
              // addon is an object with _id or id
              addonId = String(addon._id || addon.id);
              addonName = addon.name || 'Unknown';
              // If name is not available, try to find it from the fetched list
              if (addonName === 'Unknown') {
                const addonData = allAddonsList.find(a => String(a._id) === String(addonId));
                if (addonData) {
                  addonName = addonData.name || 'Unknown';
                }
              }
            }
            
            if (addonId) {
              selectedAddons.push({
                value: addonId,
                label: addonName,
                _id: addonId,
              });
            }
          });
        }

        const step2 = {
          dateArrival: reservation.dateOfArrival ? new Date(reservation.dateOfArrival).toISOString().split('T')[0] : '',
          dateDeparture: reservation.dateOfDeparture ? new Date(reservation.dateOfDeparture).toISOString().split('T')[0] : '',
          typeFacilities: reservation.facilityType || '',
          facilityName: reservation.facility?._id || reservation.facility || '',
          typeService: reservation.serviceType || '',
          timeArrivalHour,
          timeArrivalAMPM,
          specialRequests: '',
          facilityIdFromList: reservation.facility?._id || reservation.facility || '',
          facilityLabelFromList: reservation.facilityName || '',
          facilityCapacity: Number(reservation.facility?.capacity) || 0,
          facilityRatePerPerson: Number(reservation.facility?.ratePerPerson) || 0,
          selectedAddons,
        };

        // Prepare file objects for letter of intent
        let letterOfIntentFile = null;
        // Check if letter of intent file exists (the API returns a signed URL)
        // The URL can be null if no file exists, or a string URL if it does
        const loiFileUrl = reservation.letterOfIntentFile;
        
        if (loiFileUrl && typeof loiFileUrl === 'string' && loiFileUrl.trim() !== '' && loiFileUrl !== 'null') {
          // Create a file-like object from the URL for display
          // The URL can be used to display/download the existing file
          letterOfIntentFile = {
            url: loiFileUrl,
            name: 'Letter of Intent',
            isExisting: true,
          };
        }

        // Prepare senior citizen ID files
        const seniorCitizenIdFiles = (reservation.seniorCitizenIdFiles || []).map(file => ({
          url: file.url,
          name: file.name || 'Senior Citizen ID',
          isExisting: true,
        }));

        // Prepare PWD ID files
        const pwdIdFiles = (reservation.pwdIdFiles || []).map(file => ({
          url: file.url,
          name: file.name || 'PWD ID',
          isExisting: true,
        }));

        // Prepare Government ID files
        const governmentIdFiles = (reservation.governmentIdFiles || []).map(file => ({
          url: file.url,
          name: file.name || 'Government ID',
          isExisting: true,
        }));

        // Store original type to detect changes during edit
        const originalType = reservation.guestType || 'Individual'; // 'Group' or 'Individual'
        
        // Navigate to the first form step with pre-populated data
        navigate('/reservation-form', {
          state: {
            step1,
            step2,
            reservationId: id, // Pass reservation ID for edit mode
            isEdit: true,
            originalType: originalType, // Store original type to detect changes
            file: letterOfIntentFile, // Letter of Intent file
            seniorCitizenIdFiles: seniorCitizenIdFiles,
            pwdIdFiles: pwdIdFiles,
            governmentIdFiles: governmentIdFiles,
            userEmail: reservation.userEmail || null, // User account email
          },
          replace: true,
        });
      } catch (e) {
        if (!cancelled) {
          setError(e?.message || 'Failed to load reservation.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, navigate]);

  if (loading) {
    return (
      <div style={{ padding: 16, textAlign: 'center' }}>
        Loading reservation...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 16 }}>
        <p>Error: {error}</p>
        <button onClick={() => navigate('/reservations')}>Back to Reservations</button>
      </div>
    );
  }

  return null; // Navigation will handle rendering
}

