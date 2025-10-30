import { apiPostBlob } from './api';

export async function generateAccommodationReportPDF({ year, month }) {
  return apiPostBlob('/report/generate-pdf', { year, month });
}

export async function downloadAccommodationReportPDF({ year, month, filename }) {
  const blob = await generateAccommodationReportPDF({ year, month });
  const link = document.createElement('a');
  const href = URL.createObjectURL(blob);
  link.href = href;
  const mm = String(month).padStart(2, '0');
  link.download = filename || `accommodation-report-${year}-${mm}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);
}


