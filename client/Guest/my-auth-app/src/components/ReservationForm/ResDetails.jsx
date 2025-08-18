import React from 'react';
import styles from './ResDetails.module.css';
import HeaderHome from '../HeaderHome/HeaderHome';

function ResDetails({ details, onClose, onSubmit }) {
  // Example details prop structure (replace with actual props or context as needed)
  const data = details || {
    group: 'Philippine Educators Association',
    address: '123 Mabini Street, Quezon City, Philippines',
    officeAddress: 'DepEd Regional Office, Manila',
    category: 'DepEd',
    phone: '0912 345 6789',
    officeTel: '(02) 8785 4321',
    guests: '100',
    emergency: '0918 765 4321',
    arrival: 'July 24, 2025',
    departure: 'August 5, 2025',
    facilityType: 'Conference Hall',
    facilityName: 'Quirino Conf Hall',
    service: 'Events',
    amount: '₱ 12,000.00',
  };

  return (
    <>
      <HeaderHome />
      <div className={styles.overlay}>
        <div className={styles.detailsCard}>
          <div className={styles.headerBar}>
            <span className={styles.title}>RESERVATION DETAILS</span>
            <button className={styles.closeBtn} onClick={onClose}>×</button>
          </div>
          <div className={styles.detailsContent}>
            <table className={styles.detailsTable}>
              <tbody>
                <tr><td>Group/Association</td><td>:</td><td>{data.group}</td></tr>
                <tr><td>Address</td><td>:</td><td>{data.address}</td></tr>
                <tr><td>Office Address</td><td>:</td><td>{data.officeAddress}</td></tr>
                <tr><td>Category</td><td>:</td><td>{data.category}</td></tr>
                <tr><td>Phone No.</td><td>:</td><td>{data.phone}</td></tr>
                <tr><td>Office Telephone No.</td><td>:</td><td>{data.officeTel}</td></tr>
                <tr><td>Number of Guests</td><td>:</td><td>{data.guests}</td></tr>
                <tr><td>Emergency Contact</td><td>:</td><td>{data.emergency}</td></tr>
                <tr><td>Date of Arrival</td><td>:</td><td>{data.arrival}</td></tr>
                <tr><td>Date of Departure</td><td>:</td><td>{data.departure}</td></tr>
                <tr><td>Type of Facility</td><td>:</td><td>{data.facilityType}</td></tr>
                <tr><td>Facility Name</td><td>:</td><td>{data.facilityName}</td></tr>
                <tr><td>Type of Service</td><td>:</td><td>{data.service}</td></tr>
                <tr className={styles.amountRow}>
                  <td colSpan={3}>
                    <div className={styles.amountLine}></div>
                    <div className={styles.amountLabel}>Total Estimated Amount</div>
                    <span className={styles.amountValue}>{data.amount}</span>
                  </td>
                </tr>
              </tbody>
            </table>
            <div className={styles.amountNote}>
              Note that this is just an estimated amount and is subject to change
            </div>
          </div>
        </div>
        <button className={styles.submitBtn} onClick={onSubmit}>Submit</button>
      </div>
    </>
  );
}

export default ResDetails;
