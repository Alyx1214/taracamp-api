import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import dbHelper from './dbHelper.js';
import { Category, ReservationStatus, ServiceType, FacilityType } from '../constants.js';
import { computeEstimate } from './payment.js';

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
                    dateOfDeparture: { $gte: startDate },
                    status: ReservationStatus.CHECKED_OUT
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
            // Lookup user by email if checkedOutBy is an email
            {
                $addFields: {
                    checkedOutByEmail: {
                        $cond: [
                            {
                                $and: [
                                    { $ne: ['$checkedOutBy', null] },
                                    { $ne: ['$checkedOutBy', ''] },
                                    { $regexMatch: { input: '$checkedOutBy', regex: '@' } }
                                ]
                            },
                            { $toLower: { $trim: { input: '$checkedOutBy' } } },
                            null
                        ]
                    }
                }
            },
            {
                $lookup: {
                    from: 'users',
                    let: { email: '$checkedOutByEmail' },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $ne: ['$$email', null] },
                                        { $eq: [{ $toLower: '$email' }, '$$email'] }
                                    ]
                                }
                            }
                        },
                        { $project: { name: 1, _id: 0 } }
                    ],
                    as: 'checkOutUser'
                }
            },
            {
                $project: {
                    _id: 1,
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
                    checkedInAt: 1,
                    facilityName: '$facility.name',
                    facilityCapacity: { $ifNull: ['$facility.capacity', '$capacity'] },
                    totalGuests: '$totalGuestsResolved',
                    facilityLabel: '$facility.label',
                    capacity: 1,
                    checkedOutBy: {
                        $cond: [
                            { $gt: [{ $size: '$checkOutUser' }, 0] },
                            { $arrayElemAt: ['$checkOutUser.name', 0] },
                            { $ifNull: ['$checkOutEmployee', { $ifNull: ['$checkedOutBy', { $ifNull: ['$coEmployee', ''] }] }] }
                        ]
                    },
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
        // RF. no., Facility, Check-in, Check-out, Nights, Guests, DepEd, Non-DepEd, Private, C/O Employee, Name, Contact, Address
        const baseColumnWidths = [
            140, 85, 150, 150, 68, 75, 50, 60, 55, 95, 150, 120, 180
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
            let x = startX;
            const fontSize = isHeader ? 7 : 8;
            doc.font(isHeader ? 'Helvetica-Bold' : 'Helvetica').fontSize(fontSize);

            // Calculate the maximum height needed for this row based on text wrapping
            let maxHeight = isHeader ? 26 : 18;
            if (!isHeader) {
                for (let i = 0; i < cells.length; i++) {
                    const cell = String(cells[i] ?? '');
                    const width = columnWidths[i] ?? 60;
                    const availableTextWidth = width - 6;
                    
                    // Use PDFKit's heightOfString to get accurate text height
                    try {
                        const textHeight = doc.heightOfString(cell, {
                            width: availableTextWidth,
                            align: 'left'
                        });
                        const cellHeight = Math.max(18, Math.ceil(textHeight) + 6);
                        maxHeight = Math.max(maxHeight, cellHeight);
                    } catch (e) {
                        // Fallback estimation if heightOfString fails
                        const estimatedLines = Math.ceil((cell.length * (fontSize * 0.6)) / availableTextWidth) || 1;
                        const cellHeight = Math.max(18, estimatedLines * (fontSize + 2) + 4);
                        maxHeight = Math.max(maxHeight, cellHeight);
                    }
                }
            }

            for (let i = 0; i < cells.length; i++) {
                const cell = String(cells[i] ?? '');
                const width = columnWidths[i] ?? 60;
                doc.rect(x, yPos, width, maxHeight).strokeColor('#c0c0c0').stroke();
                const textOptions = { width: width - 6, height: maxHeight - 6, align: isHeader ? 'center' : 'left' };
                if (isHeader && noWrapHeaderIndexes.has(i)) {
                    textOptions.lineBreak = false; // keep header on one line (e.g., "Private")
                }
                doc.fillColor('#000000').text(cell, x + 3, yPos + 3, textOptions);
                x += width;
            }
            yPos += maxHeight;

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

        // Helper for date formatting like "Fri, July 4, 2024"
        const prettyDate = (d) => {
            try {
                const dt = new Date(d);
                return new Intl.DateTimeFormat('en-US', {
                    weekday: 'short', month: 'long', day: 'numeric', year: 'numeric'
                }).format(dt);
            } catch {
                return '';
            }
        };


        // Data rows - use a Set to track seen reservation IDs to prevent duplicates
        const seenReservationIds = new Set();
        for (const r of reservations) {
            // Skip if we've already processed this reservation (prevent duplicates)
            const reservationId = r._id?.toString() || r._id;
            if (reservationId && seenReservationIds.has(reservationId)) {
                console.warn(`Duplicate reservation detected in report: ${reservationId} (Code: ${r.reservationCode})`);
                continue;
            }
            if (reservationId) {
                seenReservationIds.add(reservationId);
            }
            
            const rfNo = r.reservationCode || '';
            const facilityName = r.facilityName || r.facilityLabel || r.facility?.name || '';
            // Use checkedInAt if available (actual check-in date), otherwise fall back to dateOfArrival (scheduled)
            const checkIn = (r.checkedInAt ? prettyDate(r.checkedInAt) : (r.dateOfArrival ? prettyDate(r.dateOfArrival) : ''));
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

            // checkedOutBy now contains the employee name (resolved from email if needed)
            const employee = r.checkedOutBy || r.checkOutEmployee || r.coEmployee || '';
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
    },

    /**
     * Generate Accommodation Report Excel for a given month and year.
     * Streams the Excel file to the provided writable stream (e.g., Express response).
     * @param {Object} options { month: 1-12, year: 4-digit }
     * @param {Object} res Express response to stream the Excel file
     */
    generateAccommodationReportExcel: async (options = {}, res) => {
        const { month, year } = options;

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
        const title = `ACCOMODATION REPORT FOR THE MONTH OF ${monthNames[m - 1].toUpperCase()} ${y}`;

        // Calculate date range [start, end)
        const startDate = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
        const endDate = new Date(Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 1, 0, 0, 0));

        // Fetch reservations overlapping the month window (same query as PDF version)
        const reservations = await dbHelper.aggregate('reservation', [
            {
                $match: {
                    dateOfArrival: { $lt: endDate },
                    dateOfDeparture: { $gte: startDate },
                    status: ReservationStatus.CHECKED_OUT
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
            // Lookup user by email if checkedOutBy is an email
            {
                $addFields: {
                    checkedOutByEmail: {
                        $cond: [
                            {
                                $and: [
                                    { $ne: ['$checkedOutBy', null] },
                                    { $ne: ['$checkedOutBy', ''] },
                                    { $regexMatch: { input: '$checkedOutBy', regex: '@' } }
                                ]
                            },
                            { $toLower: { $trim: { input: '$checkedOutBy' } } },
                            null
                        ]
                    }
                }
            },
            {
                $lookup: {
                    from: 'users',
                    let: { email: '$checkedOutByEmail' },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $ne: ['$$email', null] },
                                        { $eq: [{ $toLower: '$email' }, '$$email'] }
                                    ]
                                }
                            }
                        },
                        { $project: { name: 1, _id: 0 } }
                    ],
                    as: 'checkOutUser'
                }
            },
            {
                $project: {
                    _id: 1,
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
                    checkedInAt: 1,
                    facilityName: '$facility.name',
                    facilityCapacity: { $ifNull: ['$facility.capacity', '$capacity'] },
                    totalGuests: '$totalGuestsResolved',
                    facilityLabel: '$facility.label',
                    capacity: 1,
                    checkedOutBy: {
                        $cond: [
                            { $gt: [{ $size: '$checkOutUser' }, 0] },
                            { $arrayElemAt: ['$checkOutUser.name', 0] },
                            { $ifNull: ['$checkOutEmployee', { $ifNull: ['$checkedOutBy', { $ifNull: ['$coEmployee', ''] }] }] }
                        ]
                    },
                    checkOutEmployee: 1,
                    coEmployee: 1
                }
            }
        ]);

        // Create Excel workbook
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Accommodation Report');

        // Set title
        worksheet.mergeCells('A1:M1');
        worksheet.getCell('A1').value = title;
        worksheet.getCell('A1').font = { size: 14, bold: true };
        worksheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
        worksheet.getRow(1).height = 25;

        // Headers
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
        
        worksheet.addRow(headers);
        const headerRow = worksheet.getRow(2);
        headerRow.font = { bold: true };
        headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
        };

        // Helper for date formatting like "Fri, July 4, 2024"
        const prettyDate = (d) => {
            try {
                const dt = new Date(d);
                return new Intl.DateTimeFormat('en-US', {
                    weekday: 'short', month: 'long', day: 'numeric', year: 'numeric'
                }).format(dt);
            } catch {
                return '';
            }
        };

        // Add data rows - use a Set to track seen reservation IDs to prevent duplicates
        const seenReservationIds = new Set();
        for (const r of reservations) {
            // Skip if we've already processed this reservation (prevent duplicates)
            const reservationId = r._id?.toString() || r._id;
            if (reservationId && seenReservationIds.has(reservationId)) {
                console.warn(`Duplicate reservation detected in report: ${reservationId} (Code: ${r.reservationCode})`);
                continue;
            }
            if (reservationId) {
                seenReservationIds.add(reservationId);
            }
            
            const rfNo = r.reservationCode || '';
            const facilityName = r.facilityName || r.facilityLabel || r.facility?.name || '';
            // Use checkedInAt if available (actual check-in date), otherwise fall back to dateOfArrival (scheduled)
            const checkIn = (r.checkedInAt ? prettyDate(r.checkedInAt) : (r.dateOfArrival ? prettyDate(r.dateOfArrival) : ''));
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

            // checkedOutBy now contains the employee name (resolved from email if needed)
            const employee = r.checkedOutBy || r.checkOutEmployee || r.coEmployee || '';
            const guestName = r.guestName || '';
            const contact = r.telephone || r.contactNo || r.contactNumber || r.mobile || r.phoneNumber || r.phone || '';
            const address = r.homeAddress || '';

            worksheet.addRow([
                rfNo,
                facilityName,
                checkIn,
                checkOut,
                nights,
                numGuests ?? '',
                deped,
                nonDeped,
                isPrivate,
                employee,
                guestName,
                contact,
                address,
            ]);
        }

        // Set column widths
        worksheet.columns = [
            { width: 18 },  // RF. no. 
            { width: 18 },  // Facility Used
            { width: 20 },  // Check-in Date
            { width: 20 },  // Check-out Date
            { width: 12 },  // No. of Nights
            { width: 12 },  // No. of Guest
            { width: 8 },   // DepEd
            { width: 10 },  // Non-DepEd
            { width: 10 },  // Private
            { width: 28 }, // C/O Employee 
            { width: 30 }, // Name of Guest/Group/Assoc.
            { width: 15 }, // Contact No.
            { width: 35 }  // Address
        ];

        // Set response headers
        if (res && typeof res.setHeader === 'function') {
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="accommodation-report-${y}-${String(m).padStart(2, '0')}.xlsx"`);
            
            // Write to response
            await workbook.xlsx.write(res);
            res.end();
        } else {
            throw new Error('No valid response object provided');
        }
    },

    /**
     * Generate Revenue Report Excel for a given month and year.
     * Streams the Excel file to the provided writable stream (e.g., Express response).
     * @param {Object} options { month: 1-12, year: 4-digit }
     * @param {Object} res Express response to stream the Excel file
     */
    generateRevenueReportExcel: async (options = {}, res) => {
        const { month, year } = options;

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
        const title = `Revenue Report for the Month of ${monthNames[m - 1]} ${y}`;

        // Calculate date range [start, end)
        const startDate = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
        const endDate = new Date(Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 1, 0, 0, 0));

        // Fetch checked-out reservations overlapping the month window
        const reservations = await dbHelper.aggregate('reservation', [
            {
                $match: {
                    dateOfArrival: { $lt: endDate },
                    dateOfDeparture: { $gte: startDate },
                    status: ReservationStatus.CHECKED_OUT
                }
            },
            {
                $addFields: {
                    facilityIdForLookup: {
                        $cond: [
                            { $eq: [{ $type: '$facility' }, 'string'] },
                            { $toObjectId: '$facility' },
                            '$facility'
                        ]
                    },
                    checkedOutByEmail: {
                        $cond: [
                            {
                                $and: [
                                    { $ne: ['$checkedOutBy', null] },
                                    { $ne: ['$checkedOutBy', ''] },
                                    { $regexMatch: { input: '$checkedOutBy', regex: '@' } }
                                ]
                            },
                            { $toLower: { $trim: { input: '$checkedOutBy' } } },
                            null
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
            {
                $lookup: {
                    from: 'addons',
                    localField: 'addOns',
                    foreignField: '_id',
                    as: 'addons'
                }
            },
            {
                $lookup: {
                    from: 'users',
                    let: { email: '$checkedOutByEmail' },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $ne: ['$$email', null] },
                                        { $eq: [{ $toLower: '$email' }, '$$email'] }
                                    ]
                                }
                            }
                        },
                        { $project: { name: 1, _id: 0 } }
                    ],
                    as: 'checkOutUser'
                }
            },
            { $unwind: { path: '$facility', preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    _id: 1,
                    reservationCode: 1,
                    dateOfArrival: 1,
                    dateOfDeparture: 1,
                    checkedInAt: 1,
                    facilityName: '$facility.name',
                    facilityLabel: '$facility.label',
                    facilityDoc: '$facility',
                    category: 1,
                    numberOfGuests: 1,
                    serviceType: 1,
                    timeOfArrival: 1,
                    addOns: 1,
                    addons: 1,
                    totalEstimatedAmount: 1,
                    checkedOutBy: {
                        $cond: [
                            { $gt: [{ $size: '$checkOutUser' }, 0] },
                            { $arrayElemAt: ['$checkOutUser.name', 0] },
                            { $ifNull: ['$checkOutEmployee', { $ifNull: ['$checkedOutBy', { $ifNull: ['$coEmployee', ''] }] }] }
                        ]
                    }
                }
            }
        ]);

        // Create Excel workbook
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Revenue Report');

        // Set title
        worksheet.mergeCells('A1:M1');
        worksheet.getCell('A1').value = title;
        worksheet.getCell('A1').font = { size: 14, bold: true };
        worksheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
        worksheet.getRow(1).height = 25;

        // Headers
        const headers = [
            'Ref. No.',
            'C/I Date',
            'C/O Date',
            'Facility',
            'Category',
            'PWD',
            'Senior Citizen',
            'C/O Employee',
            'Facility Rate',
            'Discount',
            'Service Fee',
            'Add-ons',
            'Total Amount'
        ];
        
        worksheet.addRow(headers);
        const headerRow = worksheet.getRow(2);
        headerRow.font = { bold: true };
        headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
        };

        // Helper for date formatting like "11/2/25"
        const formatDateShort = (d) => {
            try {
                const dt = new Date(d);
                const month = dt.getMonth() + 1;
                const day = dt.getDate();
                const year = dt.getFullYear().toString().slice(-2);
                return `${month}/${day}/${year}`;
            } catch {
                return '';
            }
        };

        // Process reservations and calculate totals
        const seenReservationIds = new Set();
        let totalSales = 0;

        for (const r of reservations) {
            const reservationId = r._id?.toString() || r._id;
            if (reservationId && seenReservationIds.has(reservationId)) {
                console.warn(`Duplicate reservation detected in report: ${reservationId} (Code: ${r.reservationCode})`);
                continue;
            }
            if (reservationId) {
                seenReservationIds.add(reservationId);
            }

            // Calculate estimate using the same logic as payment module
            const adults = r.numberOfGuests?.adult || 0;
            const children = r.numberOfGuests?.children || 0;
            const pwds = r.numberOfGuests?.pwds || 0;
            const seniorCitizens = r.numberOfGuests?.seniorCitizens || r.numberOfGuests?.seniorCitizen || 0;
            
            // Calculate addons total
            const addonsTotal = (r.addons || []).reduce((sum, addon) => sum + (Number(addon.price) || 0), 0);

            const estimateResult = computeEstimate({
                facilityDoc: r.facilityDoc || {},
                adults,
                children,
                pwds,
                seniorCitizens,
                serviceType: r.serviceType,
                addonsTotal,
                category: r.category,
                dateOfArrival: r.dateOfArrival,
                dateOfDeparture: r.dateOfDeparture,
                timeOfArrival: r.timeOfArrival
            });

            const refNo = r.reservationCode || '';
            const checkIn = r.checkedInAt ? formatDateShort(r.checkedInAt) : (r.dateOfArrival ? formatDateShort(r.dateOfArrival) : '');
            const checkOut = r.dateOfDeparture ? formatDateShort(r.dateOfDeparture) : '';
            const facility = r.facilityName || r.facilityLabel || '';
            const category = r.category === Category.DEPED ? 'DepEd' : (r.category === Category.PRIVATE ? 'Private' : 'Non-DepEd');
            const pwd = (pwds > 0) ? '1' : '0';
            const seniorCitizen = (seniorCitizens > 0) ? '1' : '0';
            const employee = r.checkedOutBy || '';
            const facilityRate = Math.round(estimateResult.facilityFee * 100) / 100;
            const discount = Math.round(estimateResult.discount * 100) / 100;
            const serviceFee = Math.round(estimateResult.serviceFee * 100) / 100;
            const addons = Math.round(addonsTotal * 100) / 100;
            const totalAmount = Math.round(Number(r.totalEstimatedAmount || estimateResult.amount) * 100) / 100;

            totalSales += totalAmount;

            worksheet.addRow([
                refNo,
                checkIn,
                checkOut,
                facility,
                category,
                pwd,
                seniorCitizen,
                employee,
                facilityRate,
                discount,
                serviceFee,
                addons,
                totalAmount
            ]);
        }

        // Add total sales row
        const totalRow = worksheet.addRow([]);
        totalRow.getCell(12).value = 'Total Sales';
        totalRow.getCell(12).font = { bold: true };
        totalRow.getCell(12).alignment = { horizontal: 'right' };
        totalRow.getCell(13).value = Math.round(totalSales * 100) / 100;
        totalRow.getCell(13).font = { bold: true };

        // Set column widths
        worksheet.columns = [
            { width: 18 },  // Ref. No.
            { width: 12 },  // C/I Date
            { width: 12 },  // C/O Date
            { width: 18 },  // Facility
            { width: 12 },  // Category
            { width: 8 },   // PWD
            { width: 15 },  // Senior Citizen
            { width: 18 },  // C/O Employee
            { width: 14 },  // Facility Rate
            { width: 12 },  // Discount
            { width: 12 },  // Service Fee
            { width: 12 },  // Add-ons
            { width: 14 }   // Total Amount
        ];

        // Set response headers
        if (res && typeof res.setHeader === 'function') {
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="revenue-report-${y}-${String(m).padStart(2, '0')}.xlsx"`);
            
            // Write to response
            await workbook.xlsx.write(res);
            res.end();
        } else {
            throw new Error('No valid response object provided');
        }
    }
};

export default reportModule;


