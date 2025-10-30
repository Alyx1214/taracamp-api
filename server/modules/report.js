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
        // Match the sample title casing exactly
        const title = `ACCOMODATION REPORT FOR THE MONTH OF ${monthNames[m - 1].toUpperCase()} ${y}`;

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
            // Normalize facility id to ObjectId for lookup (handles string ids)
            {
                $addFields: {
                    facilityIdForLookup: {
                        $cond: [
                            { $eq: [{ $type: '$facility' }, 'string'] },
                            { $toObjectId: '$facility' },
                            '$facility'
                        ]
                    },
                    // Compute total guests if not stored
                    totalGuestsResolved: {
                        $ifNull: [
                            '$numberOfGuests.total',
                            {
                                $add: [
                                    { $ifNull: ['$numberOfGuests.adult', 0] },
                                    { $ifNull: ['$numberOfGuests.children', 0] },
                                    { $ifNull: ['$numberOfGuests.pwds', 0] },
                                    // Some data may use seniorCitizen vs seniorCitizens
                                    { $ifNull: ['$numberOfGuests.seniorCitizen', 0] },
                                    { $ifNull: ['$numberOfGuests.seniorCitizens', 0] }
                                ]
                            }
                        ]
                    }
                }
            },
            {
                $lookup: {
                    from: 'facilities',
                    localField: 'facilityIdForLookup',
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
                    contactNo: 1,
                    contactNumber: 1,
                    mobile: 1,
                    phoneNumber: 1,
                    phone: 1,
                    homeAddress: 1,
                    category: 1,
                    numberOfGuests: 1,
                    totalGuests: 1,
                    numOfGuests: 1,
                    guests: 1,
                    guestCount: 1,
                    dateOfArrival: 1,
                    dateOfDeparture: 1,
                    facilityName: '$facility.name',
                    facilityCapacity: { $ifNull: ['$facility.capacity', '$capacity'] },
                    totalGuests: '$totalGuestsResolved',
                    facilityLabel: '$facility.label',
                    capacity: 1,
                    checkedOutBy: 1,
                    checkOutEmployee: 1,
                    coEmployee: 1
                }
            }
        ]);

        const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 36 });
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

        // Title (centered, bold)
        doc.fontSize(12).font('Helvetica-Bold').text(title, { align: 'center' });
        doc.moveDown(0.5);

        // Table setup
        const headers = [
            'RF. no.',
            'Facility Used',
            'Check-in Date',
            'Check-out Date',
            'No. of Nights',
            'No. of Guest',
            'DepEd',
            'Non-DepEd',
            'Private',
            'C/O Employee',
            'Name of Guest/Group/Assoc.',
            'Contact No.',
            'Address'
        ];

        // Base widths (will be scaled to fit page width)
        const baseColumnWidths = [
            55, 85, 88, 88, 68, 75, 50, 60, 55, 95, 150, 90, 150
        ];

        // Scale columns to exactly fit the available width
        const availableWidth = (doc.page.width - doc.page.margins.left - doc.page.margins.right);
        const baseTotalWidth = baseColumnWidths.reduce((a, b) => a + b, 0);
        const widthScale = availableWidth / baseTotalWidth;
        const columnWidths = baseColumnWidths.map(w => Math.floor(w * widthScale));
        const scaledTotal = columnWidths.reduce((a, b) => a + b, 0);
        if (scaledTotal !== availableWidth) {
            columnWidths[columnWidths.length - 1] += (availableWidth - scaledTotal);
        }

        const startX = doc.page.margins.left;
        let yPos = doc.y;

        const noWrapHeaderIndexes = new Set([headers.indexOf('Private')]);

        function drawRow(cells, isHeader = false) {
            const height = isHeader ? 26 : 18;
            let x = startX;
            doc.font(isHeader ? 'Helvetica-Bold' : 'Helvetica').fontSize(isHeader ? 7 : 8);

            for (let i = 0; i < cells.length; i++) {
                const cell = String(cells[i] ?? '');
                const width = columnWidths[i] ?? 60;
                doc.rect(x, yPos, width, height).strokeColor('#c0c0c0').stroke();
                const textOptions = { width: width - 6, height: height - 6, align: isHeader ? 'center' : 'left' };
                if (isHeader && noWrapHeaderIndexes.has(i)) {
                    textOptions.lineBreak = false; // keep header on one line (e.g., "Private")
                }
                doc.fillColor('#000000').text(cell, x + 3, yPos + 3, textOptions);
                x += width;
            }
            yPos += height;

            // Page break handling
            if (yPos > doc.page.height - 60) {
                doc.addPage();
                yPos = 36;
            }
        }

        // Header row (allow multi-line labels for slashed titles except those marked no-wrap)
        const headerDisplay = headers.map((h, idx) => {
            if (noWrapHeaderIndexes.has(idx)) return h;
            if (h === 'C/O Employee') return 'C/O\nEmployee';
            return h.includes('/') ? h.replace('/', '/\n') : h;
        });
        drawRow(headerDisplay, true);

        // Helper for date formatting like "Fri, July 4"
        const prettyDate = (d) => {
            try {
                const dt = new Date(d);
                return new Intl.DateTimeFormat('en-US', {
                    weekday: 'short', month: 'long', day: 'numeric'
                }).format(dt);
            } catch {
                return '';
            }
        };

        // Data rows
        for (const r of reservations) {
            const rfNo = r.reservationCode || '';
            const facilityName = r.facilityName || r.facilityLabel || r.facility?.name || '';
            const checkIn = r.dateOfArrival ? prettyDate(r.dateOfArrival) : '';
            const checkOut = r.dateOfDeparture ? prettyDate(r.dateOfDeparture) : '';
            const nights = (r.dateOfArrival && r.dateOfDeparture)
                ? Math.max(0, Math.ceil((new Date(r.dateOfDeparture) - new Date(r.dateOfArrival)) / (1000 * 60 * 60 * 24)))
                : '';
            const numGuests = (r?.totalGuests ?? r?.numberOfGuests?.total ?? (
                (r?.numberOfGuests?.adult ?? 0) +
                (r?.numberOfGuests?.children ?? 0) +
                (r?.numberOfGuests?.pwds ?? 0) +
                (r?.numberOfGuests?.seniorCitizen ?? r?.numberOfGuests?.seniorCitizens ?? 0)
            ));

            const deped = r.category === Category.DEPED ? '1' : '';
            const isPrivate = r.category === Category.PRIVATE ? '1' : '';
            const nonDeped = (!deped && !isPrivate) ? '1' : '';

            const employee = r.checkOutEmployee || r.checkedOutBy || r.coEmployee || '';
            const guestName = r.guestName || '';
            const contact = r.telephone || r.contactNo || r.contactNumber || r.mobile || r.phoneNumber || r.phone || '';
            const address = r.homeAddress || '';

            drawRow([
                rfNo,
                facilityName,
                checkIn,
                checkOut,
                String(nights),
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


