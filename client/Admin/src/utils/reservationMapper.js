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
  const s = String(label || '').trim();
  // Server expects: 'Event', 'Event and Lodging', 'Lodging'
  const validServiceTypes = ['Event', 'Event and Lodging', 'Lodging'];
  if (validServiceTypes.includes(s)) {
    return s;
  }
  // Default to 'Event' if invalid
  return 'Event';
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
  const seniors  = parseInt(step1?.guests?.senior   || '0', 10) || 0;

  return {
    guestName: step1.groupAssociation?.trim(),
    homeAddress: step1.homeAddress?.trim(),
    officeAddress: step1.officeAddress?.trim(),
    category: pickCategory(step1.category),
    guestType: pickGuestType(step1.type),
    telephone: step1.phoneNo?.trim(),
    officeTelephone: step1.officeTelephoneNo?.trim(),
    guestEmail: (step1.guestEmail || '').trim() || undefined,
    numberOfAdults: adults,
    numberOfChildren: children,
    numberOfPwds: pwds,
    numberOfSeniorCitizens: seniors,
    emergencyContact: step1.emergencyContact?.trim(),
    dateOfArrival: step2.dateArrival,         
    dateOfDeparture: step2.dateDeparture,     
    facility: facilityId,                    
    serviceType: mapServiceType(step2?.typeService),
    timeOfArrival: to24h(step2.timeArrivalHour || '2', step2.timeArrivalAMPM || 'PM'),
    otherRequests: step2.specialRequests || ''
  };
}
