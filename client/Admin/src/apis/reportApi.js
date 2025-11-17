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

export async function downloadSalesReportPDF({ year, month }) {
  try {
    const response = await apiGet('/report/sales-report-pdf', { year, month }, { responseType: 'blob' });
    
    const blob = new Blob([response], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Sales_Report_${year}_${String(month).padStart(2, '0')}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    
    return response;
  } catch (error) {
    console.error('Error downloading sales report PDF:', error);
    throw error;
  }
}


