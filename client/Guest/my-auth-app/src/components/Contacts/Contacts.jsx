import React, { useRef } from 'react';
import HeaderHome from '../HeaderHome/HeaderHome'; 
import Footer from '../FooterHome/FooterHome'; 
import ReserveNow from '../BubbleButton/ReserveNow';
import styles from './Contacts.module.css';

import contactsHeroBg from '../../assets/contactus.png';      
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

function ContactsPage() {
  const handleEmailClick = () => {
    window.location.href = 'mailto:teacherscamp@deped.gov.ph'; 
  };

  const handlePhoneClick = () => {
    window.location.href = 'tel:+63744423517'; 
  };

  const handleChatWithUsClick = () => {
    console.log("Chat with us clicked!");
    // TODO: Implement chat functionality
  };

  const teachersCampPosition = [16.412063876257942, 120.60624646504405]; 

  const teachersCampAddress = "Teachers' Camp, Leonard Wood Road, Baguio City, Philippines";

  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${teachersCampPosition[0]},${teachersCampPosition[1]}`;

  return (
    <div className={styles.contactsPageContainer}>
      <HeaderHome />

      <main>
        {/* Hero Section */}
        <section className={styles.heroSection} style={{ backgroundImage: `url(${contactsHeroBg})` }}>
          <div className={styles.heroContent}>
            <h1 className={styles.heroTitle}>CONTACT US</h1>
            <p className={styles.heroSubtitle}>Teachers' Camp is ready to help with your concerns!</p>
          </div>
        </section>

        {/* Main Content Section */}
        <section className={styles.mainContentSection}>
          <div className={styles.reachUsColumn}>
            <h2 className={styles.reachUsTitle}>Reach Teachers Camp!</h2>
            <p className={styles.reachUsDescription}>
              Have questions or need assistance? Whether you're inquiring about
              reservations, facilities, or events, we're happy to assist you!
            </p>
            <p className={styles.reachUsDescription}>
              If you're struggling with any part of the reservation
              process or your concern isn't covered in our FAQs, feel
              free to reach out! Our team is ready to help you via email
              or phone to ensure a smooth and hassle-free experience.
            </p>
             <div className={styles.mapContainer}>
              {/* Interactive Map */}
              <MapContainer center={teachersCampPosition} zoom={15} scrollWheelZoom={false} className={styles.interactiveMap}>
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <Marker position={teachersCampPosition}>
                  <Popup>
                        <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer" className={styles.mapLink}>
                            Teachers' Camp <br /> Baguio City, Philippines <br />
                        </a>
                  </Popup>
                </Marker>
              </MapContainer>
            </div>
          </div>

          <div className={styles.contactDetailsColumn}>
            <div className={styles.contactCard}>
              <h3 className={styles.contactCardTitle}>Contact Us via Email or Tel No.</h3>
              <p className={styles.contactCardDescription}>
                For any inquiries, concerns, or special requests, feel
                free to reach out to us via email or telephone no.
              </p>
              <button className={styles.contactButton} onClick={handleEmailClick}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feather feather-mail"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                EMAIL
              </button>
              <button className={styles.contactButton} onClick={handlePhoneClick}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feather feather-phone"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2H7c.55 0 1.05.22 1.41.59L9.4 4.1a2 2 0 0 1 .27 2.53l-2.54 2.54a15.9 15.9 0 0 0 7.46 7.46l2.54-2.54a2 2 0 0 1 2.53.27l1.52 1.52c.37.36.59.86.59 1.41z"></path></svg>
                TELEPHONE NUMBER
              </button>
              <button className={styles.contactButton} onClick={handleChatWithUsClick}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feather feather-message-square"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                CHAT WITH US!
              </button>
            </div>

            <div className={styles.howToGetHereCard}>
              <h3 className={styles.howToGetHereTitle}>HOW TO GET HERE:</h3>
              <p className={styles.howToGetHereAddress}>
                Address: Teachers' Camp, Leonard Wood Road, Baguio City, Philippines
              </p>
              <p className={styles.howToGetHereDetail}>
                <span className={styles.detailLabel}>Private Vehicle:</span> Drive along Leonard Wood Road,
                near popular spots like Wright Park and Mines View Park.
              </p>
              <p className={styles.howToGetHereDetail}>
                <span className={styles.detailLabel}>Public Transport:</span> Take a jeepney or taxi from
                downtown Baguio, heading towards Pacdal or Mines View, and ask to be dropped off at Teachers' Camp.
              </p>
            </div>
          </div>
        </section>
      </main>
      {/* Floating Reserve Button */}
      <ReserveNow
        navigateTo="/services"
        className={styles.floatingReserveBtn}
      >
        Reserve Now
      </ReserveNow>
      <Footer />
    </div>
  );
}

export default ContactsPage;