import React from 'react';
import styles from './Terms.module.css';

function Terms({ onClose }) {
  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <button className={styles.closeButton} onClick={onClose}>
          &times;
        </button>
        <h2>TaraCamp Terms of Service & Privacy Policy</h2>
        <div className={styles.policyText}>
          <h3>Terms of Service</h3>

          <h4>1.1 Acceptance of Terms</h4>
          <p>
            By creating an account, accessing, or using the TaraCamp Reservation System, you agree to comply with these Terms of Service. 
            Baguio Teachers' Camp reserves the right to update these terms as the system evolves.
          </p>

          <h4>1.2 User Responsibilities</h4>
          <p>Users agree to:</p>
          <ul>
            <li>Provide accurate and truthful reservation information.</li>
            <li>Upload only valid and required documents based on their client type (e.g., Letter of Intent, MOA, CAF, Service Contracts).</li>
            <li>Refrain from attempting unauthorized access or activities that disrupt system operations.</li>
            <li>Comply with Teachers' Camp policies regarding facility use, payments, check-in/check-out, and guest limits.</li>
          </ul>

          <h4>1.3 Reservation Policies</h4>
          <h5>Reservation Submission</h5>
          <ul>
            <li>Guests must submit complete and accurate reservation details.</li>
            <li>Required supporting documents must be uploaded before submission.</li>
            <li>Reservation requests undergo review by the Camp Superintendent and staff.</li>
          </ul>

          <h5>Confirmation & Notifications</h5>
          <ul>
            <li>Users will receive real-time status updates through system notifications.</li>
            <li>Reservations are only considered valid once approved.</li>
          </ul>

          <h5>Cancellations & Modifications</h5>
          <ul>
            <li>Guests may cancel before approval.</li>
            <li>Approved reservations follow BTC's cancellation rules (subject to fees if applicable).</li>
            <li>Rescheduling is allowed only upon approval by the Superintendent and available schedule.</li>
          </ul>

          <h5>Guest Count & Facility Usage</h5>
          <ul>
            <li>Guests must follow the maximum capacity of chosen facilities.</li>
            <li>Exceeding the agreed number of guests may incur additional fees.</li>
          </ul>

          <h5>Check-in / Check-out</h5>
          <ul>
            <li>Users must adhere to designated check-in and check-out times.</li>
            <li>Late check-outs or extensions require approval and may incur additional charges.</li>
            <li>Front Desk and Accounting will verify documents and payments during check-in or check-out.</li>
          </ul>

          <h4>1.4 Payment Terms</h4>
          <ul>
            <li>BTC supports cash payments, government checks, and government bank transfers.</li>
            <li>Payment validation is handled by the Accounting Office.</li>
            <li>Private clients must settle payments face-to-face.</li>
            <li>Online payment integration (if available) will follow approved secure payment channels.</li>
          </ul>

          <h4>1.5 Facility and Equipment Use</h4>
          <ul>
            <li>Amenities and equipment may have additional charges.</li>
            <li>Borrowed equipment must be returned in good condition.</li>
            <li>Facility damage will incur corresponding fees or deductions (if a security deposit applies).</li>
          </ul>

          <h4>1.6 System Access & User Roles</h4>
          <p>The system uses role-based access control:</p>
          <ul>
            <li><strong>Guests:</strong> Submit reservations, upload documents, view notifications.</li>
            <li><strong>Front Desk:</strong> Manage bookings, check-in/check-out, view reservation details.</li>
            <li><strong>Superintendent:</strong> Approve/decline reservations, manage facilities, access administrative dashboard.</li>
            <li><strong>CRMS, Accounting, Reservations Unit:</strong> Perform tasks based on their assigned responsibilities.</li>
          </ul>
          <p>Unauthorized access or misuse of system privileges is strictly prohibited.</p>

          <h4>1.7 System Availability</h4>
          <p>TaraCamp aims to remain available 24/7; however:</p>
          <ul>
            <li>Scheduled maintenance, network issues, or internal updates may cause temporary downtime.</li>
            <li>BTC is not liable for losses caused by system unavailability.</li>
          </ul>

          <h3>Privacy Policy</h3>

          <h4>2.1 Information We Collect</h4>
          <p>We collect the following data necessary for reservation processing and user management:</p>
          
          <h5>Personal Information</h5>
          <ul>
            <li>Full Name</li>
            <li>Email Address</li>
            <li>Phone Number</li>
            <li>Organization / Client Type</li>
            <li>Uploaded documents (Letter of Intent, MOA, CAF, IDs, etc.)</li>
          </ul>

          <h5>Account Information</h5>
          <ul>
            <li>Username and encrypted passwords</li>
          </ul>

          <h5>Reservation & Usage Data</h5>
          <ul>
            <li>Facility usage details</li>
            <li>Booking history</li>
            <li>Logs and activity records</li>
            <li>System interactions to ensure security and audit tracking</li>
          </ul>

          <h5>Uploaded Documents</h5>
          <p>Stored securely in accordance with Teachers' Camp's administrative and government requirements.</p>

          <h4>2.2 How We Use Your Information</h4>
          <p>Your information is used for:</p>
          <ul>
            <li>Processing reservations and validating required documents</li>
            <li>Managing user accounts and role-based permissions</li>
            <li>Communicating reservation updates, notifications, and approvals</li>
            <li>Internal auditing, reporting, and operational improvements</li>
            <li>Ensuring security and preventing unauthorized access</li>
          </ul>

          <h4>2.3 Data Storage & Security</h4>
          <p>TaraCamp implements security measures that include:</p>
          <ul>
            <li>Password encryption</li>
            <li>Input validation and access control</li>
            <li>Protection against unauthorized access</li>
            <li>Hosting and storage using secure, reliable infrastructure</li>
            <li>Routine backups and recovery policies</li>
            <li>Secure handling of uploaded files via Google Cloud Storage</li>
          </ul>
          <p>However, no system can guarantee 100% security.</p>

          <h4>2.4 Data Sharing & Disclosure</h4>
          <p>We may disclose your information only when:</p>
          <ul>
            <li>Required by law or government regulations</li>
            <li>Necessary to verify payment or administrative documents</li>
            <li>Needed to protect the privacy, safety, or rights of users</li>
            <li>Requested by authorized BTC offices (Superintendent, Accounting, Cash Section, CRMS)</li>
          </ul>
          <p>We do not share your information with third-party marketers or external organizations unrelated to BTC operations.</p>

          <h4>2.5 Document Retention</h4>
          <p>Documents uploaded for reservations may be retained:</p>
          <ul>
            <li>For audit and verification</li>
            <li>For compliance with government financial and administrative policies</li>
            <li>As part of BTC's legal and operational requirements</li>
          </ul>

          <h4>2.6 User Rights</h4>
          <p>Users may:</p>
          <ul>
            <li>Update their profile information</li>
            <li>View their reservation history</li>
            <li>Request cancellation of pending reservations</li>
            <li>Contact BTC for data-related concerns</li>
          </ul>

          <h4>2.7 Consent</h4>
          <p>By using TaraCamp, you consent to:</p>
          <ul>
            <li>The collection and use of your information</li>
            <li>The processing of uploaded documents</li>
            <li>Receiving system-generated updates and notifications</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default Terms;