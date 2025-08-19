export function pickCategory(cat = {}) {
  if (cat.deped) return 'DEPED';
  if (cat.government) return 'GOVERNMENT';
  if (cat.private) return 'PRIVATE';
  return 'OTHERS';
}

export function pickGuestType(t = {}) {
  return t.groups ? 'GROUP' : 'INDIVIDUAL';
}

export function mapServiceType(label = '') {
  switch (label) {
    case 'Meeting/Conference': return 'MEETING/CONFERENCE';
    case 'Wedding': return 'WEDDING';
    case 'Birthday Party': return 'BIRTHDAY PARTY';
    case 'Corporate Event': return 'CORPORATE EVENT';
    case 'Training/Seminar': return 'TRAINING/SEMINAR';
    case 'Accommodation': return 'ACCOMMODATION';
    default: return 'OTHER';
  }
}

export function to24h(hour12, ampm) {
  let h = parseInt(hour12 || '0', 10);
  if (isNaN(h) || h < 1 || h > 12) return '00:00';
  if ((ampm || 'AM') === 'PM' && h !== 12) h += 12;
  if ((ampm || 'AM') === 'AM' && h === 12) h = 0;
  const hh = String(h).padStart(2, '0');
  return `${hh}:00`;
}

export function buildReservationPayload(step1 = {}, step2 = {}, facilityId, file) {
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
    dateOfArrival: step2.dateArrival,         
    dateOfDeparture: step2.dateDeparture,     
    facility: facilityId,                    
    serviceType: mapServiceType(step2.typeService === 'OTHER' ? step2.customService : step2.typeService),
    timeOfArrival: to24h(step2.timeArrivalHour, step2.timeArrivalAMPM || 'AM'),
    otherRequests: step2.specialRequests || '',
    file
  };
}
