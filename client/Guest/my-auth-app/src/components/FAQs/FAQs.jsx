import React, { useState } from 'react';
import HeaderHome from '../HeaderHome/HeaderHome';
import FooterHome from '../FooterHome/FooterHome'; 
import { useNavigate, useLocation } from 'react-router-dom'; 
// import ReserveNow from '../BubbleButton/ReserveNow';
import styles from './FAQs.module.css';

function FAQsPage() {
  const [openFAQ, setOpenFAQ] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  const faqs = [
    {
      id: 1,
      question: 'What Is Included In Board And Lodging?',
      answer: 'Board and Lodging at Teachers’ Camp include accommodation and meals. Additional amenities such as housekeeping, utilities, and conference facilities may also be available depending on the package or room type selected. Please refer to your specific reservation details for a comprehensive list of inclusions.'
    },
    {
      id: 2,
      question: 'What Types Of Rooms Are Available?',
      answer: 'Teachers’ Camp offers a variety of accommodations including dormitory-style rooms, private cottages, and traditional hall rooms. Each option is designed to suit different group sizes and preferences, from individual travelers to large seminars.'
    },
    {
      id: 3,
      question: 'Are Meals Provided, And What Kind Of Food Is Served?',
      answer: 'Yes, meals are provided as part of the board and lodging package. We serve a range of Filipino and international dishes, prepared fresh daily. Specific dietary requests can often be accommodated with advance notice. Please contact our dining services for more information.'
    },
    {
      id: 4,
      question: 'What Are The Check-In And Check-Out Times?',
      answer: 'Standard check-in time is 2:00 PM, and check-out time is 12:00 PM (noon). Early check-in or late check-out requests are subject to availability and may incur additional charges. Please coordinate with the front desk for such requests.'
    },
    {
      id: 5,
      question: 'Are Pets Allowed?',
      answer: 'Currently, Teachers’ Camp does not permit pets within its accommodations or facilities, with the exception of service animals. We appreciate your understanding and cooperation in maintaining a comfortable environment for all guests.'
    },
    {
      id: 6,
      question: 'How Do I Make A Reservation?',
      answer: 'Reservations can be made through our official website’s reservation form, or by contacting our reservations team directly via phone or email. We recommend booking in advance, especially during peak seasons, to ensure availability.'
    },
    {
      id: 7,
      question: 'What Facilities Are Available At Teachers’ Camp?',
      answer: 'Our facilities include various halls for conferences and events, dining areas, recreational spaces, and lush outdoor areas perfect for relaxation and outdoor activities. We also offer basic amenities like Wi-Fi in designated areas.'
    },
    {
      id: 8,
      question: 'Can I Book A Venue For Conferences Or Seminars?',
      answer: 'Yes, Teachers’ Camp is an ideal venue for conferences, seminars, workshops, and other large gatherings. We offer several function halls of varying sizes equipped to meet your event needs. Please contact our events team for inquiries and bookings.'
    },
    {
      id: 9,
      question: 'Are There Special Discounts For Large Groups Or Events?',
      answer: 'We offer special rates and packages for large group bookings and events. The pricing depends on the number of attendees, duration of stay, and specific facility requirements. Please reach out to our sales team for a customized quotation.'
    },
    {
      id: 10,
      question: 'Is There Parking Available For Guests?',
      answer: 'Yes, ample parking space is available for guests within the Teachers’ Camp premises. Parking is generally complimentary for registered guests. Please follow signs and instructions from our staff upon arrival.'
    },
  ];

  const toggleFAQ = (id) => {
    setOpenFAQ(openFAQ === id ? null : id); 
  };

  const handleReserveNowClick = () => {
    const servicesPath = '/user/services';
    
    if (location.pathname === servicesPath) {
      // Already on services page, just go to top instantly
      window.scrollTo({ top: 0, behavior: 'instant' });
    } else {
      // Navigate to services page and go to top instantly
      navigate(servicesPath);
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'instant' });
      }, 100);
    }
  };

  return (
    <div className={styles.faqsPageContainer}>
      <HeaderHome />

      <main>
        <section className={styles.heroSection}>
          <div className={styles.heroContent}>
            <h1 className={styles.heroTitle}>FREQUENTLY ASK QUESTIONS</h1>
          </div>
        </section>

        <section className={styles.faqsContentSection}>
          <div className={styles.faqList}>
            {faqs.map((faq) => (
              <div key={faq.id} className={styles.faqItem}>
                <button
                  className={styles.faqQuestionButton}
                  onClick={() => toggleFAQ(faq.id)}
                  aria-expanded={openFAQ === faq.id}
                >
                  <span className={styles.faqNumber}>{faq.id}.</span>
                  <span className={styles.faqQuestion}>{faq.question}</span>
                  <span className={styles.faqToggleIcon}>
                    {openFAQ === faq.id ? '▲' : '▼'}
                  </span>
                </button>
                {openFAQ === faq.id && (
                  <div className={styles.faqAnswer}>
                    <p>{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className={styles.reserveNowSection}>
            <button className={styles.reserveNowButton} onClick={handleReserveNowClick}>
              RESERVE NOW!
            </button>
          </div>
        </section>
      </main>

      {/* Floating Reserve Button
      <ReserveNow
        navigateTo="/user/services"
        className={styles.floatingReserveBtn}
      >
        Reserve Now
      </ReserveNow> */}

      <FooterHome />
    </div>
  );
}

export default FAQsPage;