import PDFDocument from 'pdfkit';
import dbHelper from './dbHelper.js';
import { Category } from '../constants.js';

const reportModule = {
    /**
     * Generate Accommodation Report PDF for a given month and year.
     * Streams the PDF to the provided writable stream (e.g., Express response).
     * @param {Object} options { month: 1-12, year: 4-digit, outputStream?: Writable }
     * @param {Object} res Express response to stream the PDF (optional if outputStream provided)
     */
    generateAccommodationReportPDF: async (options = {}, res) => {
        const { month, year, outputStream } = options;

        const m = Number(month);
        const y = Number(year);
        if (!Number.isInteger(m) || m < 1 || m > 12 || !Number.isInteger(y) || y < 1970) {
            if (res && typeof res.status === 'function') {
                res.status(400).json({ status: 400, error: 'Invalid month/year' });
                return;
            }
            throw new Error('Invalid month/year');
        }

        const monthNames = [
            'January','February','March','April','May','June','July','August','September','October','November','December'
        ];
        const title = `Accommodation Report for the Month of ${monthNames[m - 1]} ${y}`;

        // Calculate date range [start, end)
        const startDate = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
        const endDate = new Date(Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 1, 0, 0, 0));

        // Fetch reservations overlapping the month window
        const reservations = await dbHelper.aggregate('reservation', [
            {
                $match: {
                    dateOfArrival: { $lt: endDate },
                    dateOfDeparture: { $gte: startDate }
                }
            },
            {
                $lookup: {
                    from: 'facilities',
                    localField: 'facility',
                    foreignField: '_id',
                    as: 'facility'
                }
            },
            { $unwind: { path: '$facility', preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    reservationCode: 1,
                    guestName: 1,
                    telephone: 1,
                    homeAddress: 1,
                    category: 1,
                    numberOfGuests: 1,
                    dateOfArrival: 1,
                    dateOfDeparture: 1,
                    facilityName: '$facility.name',
                    facilityCapacity: '$facility.capacity'
                }
            }
        ]);

        const doc = new PDFDocument({ size: 'A4', margin: 36 });
        if (res && typeof res.setHeader === 'function') {
            // Prepare response headers for HTTP response
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `inline; filename="accommodation-report-${y}-${String(m).padStart(2, '0')}.pdf"`);
            doc.pipe(res);
        } else if (outputStream && typeof outputStream.write === 'function') {
            doc.pipe(outputStream);
        } else {
            throw new Error('No valid output stream provided');
        }

        // Title
        doc.fontSize(14).font('Helvetica-Bold').text(title, { align: 'center' });
        doc.moveDown(1);

        // Table setup
        const headers = [
            'RF. No.',
            'Facility Used',
            'Check-in Date',
            'Check-out Date',
            'No. of Nights',
            'Capacity',
            'Actual',
            'No. of Guest',
            'DepEd',
            'Non-DepEd',
            'Private',
            'Check-out employee',
            'Name of Guest/Group/Association',
            'Contact No.',
            'Address'
        ];

        const columnWidths = [
            70, 90, 70, 70, 55, 55, 50, 60, 45, 60, 50, 95, 150, 80, 160
        ];

        const startX = doc.x;
        let yPos = doc.y;

        function drawRow(cells, isHeader = false) {
            const height = 20;
            let x = startX;
            doc.font(isHeader ? 'Helvetica-Bold' : 'Helvetica').fontSize(8);

            for (let i = 0; i < cells.length; i++) {
                const cell = String(cells[i] ?? '');
                const width = columnWidths[i] ?? 60;
                doc.rect(x, yPos, width, height).strokeColor('#cccccc').stroke();
                doc.fillColor('#000000').text(cell, x + 2, yPos + 4, { width: width - 4, height: height - 8 });
                x += width;
            }
            yPos += height;

            // Page break handling
            if (yPos > doc.page.height - 60) {
                doc.addPage();
                yPos = 36;
            }
        }

        // Header row
        drawRow(headers, true);

        // Data rows
        for (const r of reservations) {
            const rfNo = r.reservationCode || '';
            const facilityName = r.facilityName || '';
            const checkIn = r.dateOfArrival ? new Date(r.dateOfArrival).toISOString().split('T')[0] : '';
            const checkOut = r.dateOfDeparture ? new Date(r.dateOfDeparture).toISOString().split('T')[0] : '';
            const nights = (r.dateOfArrival && r.dateOfDeparture)
                ? Math.max(0, Math.ceil((new Date(r.dateOfDeparture) - new Date(r.dateOfArrival)) / (1000 * 60 * 60 * 24)))
                : '';
            const capacity = r.facilityCapacity ?? '';
            const numGuests = r?.numberOfGuests?.total ?? '';
            const actual = numGuests; // Assumption: Actual equals actual guest count

            const deped = r.category === Category.DEPED ? '1' : '';
            const isPrivate = r.category === Category.PRIVATE ? '1' : '';
            const nonDeped = (!deped && !isPrivate) ? '1' : '';

            const employee = '';
            const guestName = r.guestName || '';
            const contact = r.telephone || '';
            const address = r.homeAddress || '';

            drawRow([
                rfNo,
                facilityName,
                checkIn,
                checkOut,
                String(nights),
                String(capacity ?? ''),
                String(actual ?? ''),
                String(numGuests ?? ''),
                deped,
                nonDeped,
                isPrivate,
                employee,
                guestName,
                contact,
                address,
            ]);
        }

        doc.end();
    }
};

export default reportModule;


