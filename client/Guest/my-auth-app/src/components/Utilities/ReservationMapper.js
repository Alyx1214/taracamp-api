export function pickCategory(cat = {}) {
  if (cat.deped) return 'DepEd';
  if (cat.government) return 'Government';
  if (cat.pwds) return 'PWDs';
  if (cat.private) return 'Private';
  return 'Others';
}

export function pickGuestType(t = {}) {
  return t.groups ? 'Group' : 'Individual';
}

export function mapServiceType(label = '') {
  const s = String(label || '').trim().toUpperCase();
  const allowed = new Set([
    'Meeting/Conference',
    'Wedding',
    'Birthday Party',
    'Corporate Event',
    'Training/Seminar',
    'Accommodation',
    'Other',
  ]);
  return allowed.has(s) ? s : 'Other';
}

export function to24h(hour12, ampm) {
  let h = parseInt(hour12 || '0', 10);
  if (isNaN(h) || h < 1 || h > 12) return '00:00';
  if ((ampm || 'AM') === 'PM' && h !== 12) h += 12;
  if ((ampm || 'AM') === 'AM' && h === 12) h = 0;
  const hh = String(h).padStart(2, '0');
  return `${hh}:00`;
}

export function buildReservationPayload(step1 = {}, step2 = {}, facilityId) {
  const adults   = parseInt(step1?.guests?.adult    || '0', 10) || 0;
  const children = parseInt(step1?.guests?.children || '0', 10) || 0;
  const pwds     = parseInt(step1?.guests?.pwds     || '0', 10) || 0;

  return {
    guestName: step1.groupAssociation?.trim(),
    homeAddress: step1.homeAddress?.trim(),
    officeAddress: step1.officeAddress?.trim(),
    category: pickCategory(step1.category),
    guestType: pickGuestType(step1.type),
    telephone: step1.phoneNo?.trim(),
    officeTelephone: step1.officeTelephoneNo?.trim(),
    numberOfAdults: adults,
    numberOfChildren: children,
    numberOfPwds: pwds,
    emergencyContact: step1.emergencyContact?.trim(),
    emergencyContactPerson: step1.emergencyContactPerson?.trim(),
    dateOfArrival: step2.dateArrival,         
    dateOfDeparture: step2.dateDeparture,     
    facility: facilityId,                    
    serviceType: mapServiceType(
      String(step2?.typeService || '') === 'Other' ? 'Other' : step2?.typeService
    ),
    timeOfArrival: to24h(step2.timeArrivalHour, step2.timeArrivalAMPM || 'AM'),
    otherRequests: step2.specialRequests || ''
  };
}
