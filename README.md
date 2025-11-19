# CodeX - TaraCamp Reservation System

A comprehensive reservation management system for Baguio Teachers' Camp, built with modern web technologies.

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [System Architecture](#system-architecture)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [User Roles](#user-roles)
- [Key Modules](#key-modules)
- [API Documentation](#api-documentation)
- [Security Features](#security-features)
- [Contributing](#contributing)
- [License](#license)

## 🎯 Overview

**TaraCamp** is a full-stack reservation management system designed for Baguio Teachers' Camp (BTC). The system streamlines the booking process for various facilities including conference halls, dormitories, and cottages, while providing comprehensive administrative tools for staff management.

## ✨ Features

### Guest Features
- **User Authentication**: Secure registration and login system
- **Facility Browsing**: View available facilities with detailed information
- **Reservation Management**: 
  - Multi-step reservation form
  - Real-time availability checking
  - Document upload (Letter of Intent, IDs, etc.)
  - Payment proof submission
- **Reservation History**: Track all bookings and their status
- **Notifications**: Real-time updates on reservation status
- **Profile Management**: Update personal information and preferences

### Administrative Features
- **Dashboard**: Comprehensive overview of reservations and statistics
- **Reservation Management**: Approve, decline, or modify reservations
- **User Management**: Manage guest accounts and staff users
- **Facility Management**: Add, edit, or remove facilities and amenities
- **Document Verification**: Review uploaded documents (MOA, Service Contracts, IDs)
- **Payment Tracking**: Monitor payment submissions and validations
- **Reports & Analytics**: Generate insights on bookings and revenue
- **Role-Based Access Control**: Different permissions for various staff roles

## 🏗️ System Architecture

```
CodeX/
├── client/
│   ├── Admin/          # Administrative interface
│   └── Guest/          # Guest-facing application
└── server/             # Backend API and business logic
```

## 🛠️ Technology Stack

### Frontend
- **Framework**: React.js
- **Routing**: React Router v6
- **Styling**: CSS Modules
- **State Management**: React Hooks (useState, useEffect, useContext)
- **HTTP Client**: Fetch API
- **Icons**: Lucide React, React Icons
- **OCR**: Tesseract.js (for reference number extraction)
- **Date Handling**: Native JavaScript Date API

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB Atlas
- **Authentication**: JWT (JSON Web Tokens) with jti
- **File Storage**: Google Cloud Storage
- **Email**: Nodemailer
- **Security**: bcrypt, helmet, cors
- **Validation**: express-validator

### Development Tools
- **Package Manager**: npm
- **Version Control**: Git
- **Environment Variables**: dotenv
- **API Testing**: Postman 

## 📁 Project Structure

### Client (Guest)
```
client/Guest/my-auth-app/src/
├── components/
│   ├── Auth/                    # Login, Register, Verification
│   ├── HeaderHome/              # Navigation header
│   ├── ReservationForm/         # Multi-step booking form
│   ├── ResHistory/              # Booking history
│   ├── Services/                # Facility listings
│   ├── Transactions/            # Payment management
│   ├── Profile/                 # User profile
│   └── NotificationModal/       # Real-time notifications
├── apis/                        # API integration
├── assets/                      # Static files (images, PDFs)
├── utils/                       # Helper functions
└── App.jsx                      # Main application component
```

### Client (Admin)
```
client/Admin/src/
├── components/
│   ├── Dashboard/               # Admin dashboard
│   ├── ReservationManage/       # Reservation administration
│   ├── UserManage/              # User management
│   ├── FacilityManage/          # Facility administration
│   ├── UnivTable/               # Reusable data table
│   └── Shared/                  # Shared components
├── pages/                       # Page components
└── App.jsx                      # Admin application root
```

### Server
```
server/
├── routes/                      # API route definitions
├── controllers/                 # Business logic handlers
├── models/                      # MongoDB schemas
├── middleware/                  # Authentication, validation
├── utils/                       # Helper functions
├── config/                      # Configuration files
└── server.js                    # Application entry point
```

## 🚀 Getting Started

### Prerequisites
- Node.js (v14 or higher)
- MongoDB (v4.4 or higher)
- npm or yarn
- Google Cloud Storage account (for file uploads)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd CodeX
   ```

2. **Install dependencies**
   
   ```bash
   # Install server dependencies
   cd server
   npm install
   
   # Install guest client dependencies
   cd ../client/Guest/my-auth-app
   npm install
   
   # Install admin client dependencies
   cd ../../Admin
   npm install
   ```

3. **Configure environment variables**
   
   Create `.env` files in the server directory:
   
   ```env
   # Server .env
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/taracamp
   JWT_SECRET=your_jwt_secret_key
   JWT_EXPIRES_IN=7d
   
   # Google Cloud Storage
   GCS_BUCKET_NAME=your_bucket_name
   GCS_PROJECT_ID=your_project_id
   GOOGLE_APPLICATION_CREDENTIALS=path/to/credentials.json
   
   # Email Configuration
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_USER=your_email@gmail.com
   EMAIL_PASSWORD=your_app_password
   
   # Frontend URLs
   CLIENT_URL=http://localhost:5173
   ADMIN_URL=http://localhost:5174
   ```

4. **Start the applications**
   
   ```bash
   # Start backend server
   cd server
   npm run dev
   
   # Start guest client (in a new terminal)
   cd client/Guest/my-auth-app
   npm start
   
   # Start admin client (in a new terminal)
   cd client/Admin
   npm start
   ```

5. **Access the applications**
   - Guest Portal: http://localhost:5173
   - Admin Portal: http://localhost:5174
   - API Server: https://taracamp-api.azurewebsites.net

## 👥 User Roles

### Guest
- Create and manage reservations
- Upload required documents
- Submit payment proofs
- View booking history
- Receive notifications

### Front Desk
- View incoming reservations
- Manage check-in/check-out
- Verify documents
- Update reservation status

### Superintendent
- Approve/decline reservations
- Override system decisions
- Access all administrative functions
- View comprehensive reports

### Accounting
- Verify payments
- Process financial documents
- Generate financial reports
- Manage payment records

### CRMS (Customer Relationship Management System)
- Manage customer data
- Handle customer inquiries
- Track customer interactions

### Reservations Unit
- Coordinate bookings
- Manage facility schedules
- Handle reservation modifications

## 🔑 Key Modules

### 1. Authentication & Authorization
- JWT-based authentication
- Role-based access control
- Email verification
- Password reset functionality
- Secure password hashing with bcrypt

### 2. Reservation System
- Multi-step booking form
- Real-time availability checking
- Dynamic pricing calculation
- Add-ons and amenities selection
- Discount application (seniors, PWDs, government)
- Document upload and validation

### 3. Document Management
- Letter of Intent upload
- MOA/Service Contract submission
- Certificate of Availability of Funds
- ID verification (Senior Citizen, PWD, Government)
- OCR-powered reference number extraction
- Google Cloud Storage integration

### 4. Payment Processing
- Multiple payment channels (GCash, GrabPay, DBP)
- Payment proof upload
- Reference number validation
- Payment status tracking
- Receipt generation

### 5. Notification System
- Real-time status updates
- Email notifications
- In-app notification modal
- Reservation confirmations
- Payment reminders

### 6. Administrative Dashboard
- Reservation overview
- User management
- Facility management
- Document verification
- Analytics and reporting

## 📡 API Documentation

All API endpoints are prefixed with `/api/v1`.

### Authentication & User Endpoints
```
POST   /api/v1/user/register
POST   /api/v1/user/login
POST   /api/v1/user/google-login
POST   /api/v1/user/facebook-login
POST   /api/v1/user/send-password-reset-verification-code
POST   /api/v1/user/verify-password-reset-code
POST   /api/v1/user/reset-password
POST   /api/v1/user/refresh-token
POST   /api/v1/user/verify-email
POST   /api/v1/user/resend-verification-email
GET    /api/v1/user/profile
POST   /api/v1/user/profile
POST   /api/v1/user/profile-picture
POST   /api/v1/user/change-password
GET    /api/v1/user/get-all-users-by-role/:role
GET    /api/v1/user/search-users
POST   /api/v1/user/add-user
POST   /api/v1/user/update-user/:id
POST   /api/v1/user/delete-user/:id
POST   /api/v1/user/logout
```

### Reservation Endpoints
```
GET    /api/v1/reservation/get-reservation-by-id/:id
GET    /api/v1/reservation/estimate-amount
GET    /api/v1/reservation/check-availability
GET    /api/v1/reservation/get-reservation-by-user-id
GET    /api/v1/reservation/get-all-reservations-by-status/:id
GET    /api/v1/reservation/search-reservations
POST   /api/v1/reservation/create-reservation
POST   /api/v1/reservation/cancel-booking/:id
POST   /api/v1/reservation/accept-or-decline-reservation/:id
POST   /api/v1/reservation/checkin-or-checkout-reservation/:id
POST   /api/v1/reservation/delete-reservation/:id
POST   /api/v1/reservation/upload-nonavailability-certificate/:id
POST   /api/v1/reservation/update-meal-preference/:id
POST   /api/v1/reservation/update-reservation/:id
```

### Facility Endpoints
```
GET    /api/v1/facility/get-all-facilities
GET    /api/v1/facility/get-facility-by-id/:id
GET    /api/v1/facility/get-facilities-by-type/:id
GET    /api/v1/facility/get-unavailable-dates-by-facility/:id
GET    /api/v1/facility/search-facilities
GET    /api/v1/facility/get-room-availability-by-facility/:id
POST   /api/v1/facility/create-facility
POST   /api/v1/facility/update-facility/:id
POST   /api/v1/facility/delete-facility/:id
POST   /api/v1/facility/update-rooms/:id
```

### Payment Endpoints
```
POST   /api/v1/payment/webhook
GET    /api/v1/payment/get-payment-intent/:id
GET    /api/v1/payment/list-by-reservation/:id
GET    /api/v1/payment/reconcile/:id
GET    /api/v1/payment/get-payment-summary/:id
GET    /api/v1/payment/get-payment-details/:id
GET    /api/v1/payment/get-transaction-details/:reservationId
POST   /api/v1/payment/create-payment-intent/:id
POST   /api/v1/payment/attach-payment-method
POST   /api/v1/payment/create-payment-method
POST   /api/v1/payment/submit-manual-payment/:id
POST   /api/v1/payment/update-payment-status/:id
POST   /api/v1/payment/upload-invoice/:id
```

### Addons Endpoints
```
GET    /api/v1/addons/get-all-addons
GET    /api/v1/addons/get-addon-by-id/:id
GET    /api/v1/addons/search-addons
POST   /api/v1/addons/create-addon
POST   /api/v1/addons/update-addon/:id
POST   /api/v1/addons/update-many-addons
POST   /api/v1/addons/delete-addon/:id
```

### Dashboard Endpoints
```
GET    /api/v1/dashboard/get-monthly-reservations
GET    /api/v1/dashboard/get-dashboard-stats
GET    /api/v1/dashboard/get-reservations-for-calendar
```

### Message Endpoints
```
GET    /api/v1/message/list
GET    /api/v1/message/count-unread
POST   /api/v1/message/send
POST   /api/v1/message/mark-read/:id
POST   /api/v1/message/mark-all-read
GET    /api/v1/message/auto-response/config
POST   /api/v1/message/auto-response/config
POST   /api/v1/message/auto-response/test
GET    /api/v1/message/admin/users
GET    /api/v1/message/admin/user/:userId/messages
POST   /api/v1/message/admin/reply/:userId
DELETE /api/v1/message/admin/conversation/:userId
```

### Notification Endpoints
```
GET    /api/v1/notification/list
GET    /api/v1/notification/count-unread
POST   /api/v1/notification/mark-read/:id
POST   /api/v1/notification/mark-all-read
POST   /api/v1/notification/delete-all
```

### Review Endpoints
```
GET    /api/v1/reviews/get-reviews-by-facility-id/:id
GET    /api/v1/reviews/get-reviews-by-user/:userId
POST   /api/v1/reviews/add-review
POST   /api/v1/reviews/update-review/:id
POST   /api/v1/reviews/delete-review/:id
POST   /api/v1/reviews/admin-reply/:id
POST   /api/v1/reviews/toggle-visibility/:id
```

### Report Endpoints
```
POST   /api/v1/report/generate-pdf
POST   /api/v1/report/generate-excel
POST   /api/v1/report/generate-revenue-excel
```

## 🔒 Security Features

- **Password Security**: bcrypt hashing with salt rounds
- **JWT Authentication**: Secure token-based authentication
- **Input Validation**: Express-validator for request validation
- **CORS Protection**: Configured CORS policies
- **Helmet.js**: Security headers protection
- **Rate Limiting**: API rate limiting to prevent abuse
- **File Upload Validation**: Type and size restrictions
- **Role-Based Access**: Granular permission control
- **SQL Injection Prevention**: MongoDB parameterized queries
- **XSS Protection**: Input sanitization

## 📝 Business Rules

### Reservation Categories
1. **DepEd**: Requires MOA and Certificate of Availability of Funds
2. **Government**: Requires Service Contract and Certificate of Availability of Funds
3. **Private (Group)**: Requires Letter of Intent, Service Contract, and Certificate of Availability of Funds
4. **Private (Individual)**: Pay-on-arrival, no pre-documents required

### Discounts
- **Senior Citizens**: Eligible for discount with valid ID
- **PWDs**: Eligible for discount with valid PWD ID
- **Government/DepEd**: Special rates apply

### Payment Terms
- **Government/DepEd**: Payment via official channels (checks, bank transfers)
- **Private**: Cash or online payment upon arrival
- **Payment Verification**: Required before check-in

### Document Requirements
- **Letter of Intent**: Required for group reservations
- **MOA**: Required for DepEd bookings
- **Service Contract**: Required for Government and Private groups
- **Certificate of Availability of Funds**: Required for Government and DepEd
- **Valid IDs**: Required for discount eligibility

## 🧪 Testing

### Frontend Testing
```bash
cd client/Guest/my-auth-app
npm test
```

### Backend Testing
```bash
cd server
npm test
```

## 📊 Database Schema

### User Schema
```javascript
{
  username: String,
  email: String,
  password: String (hashed),
  role: String (enum: guest, frontdesk, superintendent, etc.),
  isVerified: Boolean,
  verificationToken: String,
  resetPasswordToken: String,
  resetPasswordExpires: Date
}
```

### Reservation Schema
```javascript
{
  userId: ObjectId,
  facilityType: String,
  facilityName: String,
  dateOfArrival: Date,
  dateOfDeparture: Date,
  numberOfGuests: {
    total: Number,
    adults: Number,
    children: Number,
    seniors: Number,
    pwds: Number
  },
  category: String,
  guestType: String,
  addOns: Array,
  breakdown: {
    facilityFee: Number,
    addOnsTotal: Number,
    serviceFee: Number,
    discount: Number
  },
  totalEstimatedAmount: Number,
  status: String (enum: pending, approved, declined, confirmed),
  uploadedFiles: Array,
  createdAt: Date,
  updatedAt: Date
}
```

### Facility Schema
```javascript
{
  name: String,
  type: String,
  capacity: Number,
  basePrice: Number,
  amenities: Array,
  description: String,
  images: Array,
  isAvailable: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Coding Standards
- Use consistent indentation (2 spaces)
- Follow React best practices
- Write meaningful commit messages
- Add comments for complex logic
- Update documentation for new features

## 📄 License

This project is proprietary software developed for Baguio Teachers' Camp.

## 📞 Support

For support and inquiries:
- Email: support@teacherscamp.gov.ph
- Phone: (074) XXX-XXXX
- Address: Baguio Teachers' Camp, Baguio City, Philippines

## 🙏 Acknowledgments

- Baguio Teachers' Camp Management
- Development Team
- All contributors and testers

## 🗺️ Roadmap

### Future Enhancements
- [ ] Mobile application (iOS/Android)
- [ ] SMS notifications
- [ ] Online payment gateway integration
- [ ] Calendar integration
- [ ] Automated email reminders
- [ ] Guest feedback system
- [ ] Advanced analytics dashboard
- [ ] Multi-language support
- [ ] Accessibility improvements
- [ ] API rate limiting enhancements

## 📈 Version History

### v1.0.0 (Current)
- Initial release
- Core reservation system
- User authentication
- Document management
- Payment tracking
- Administrative dashboard
- Multi-role support

---

**Built with ❤️ for Baguio Teachers' Camp**