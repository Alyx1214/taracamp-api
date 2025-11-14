import React, { useState, useRef } from 'react'; 
import styles from './FAQSection.module.css';

const faqData = [
  {
    id: 1,
    question: 'What Is Included In Board And Lodging?',
    answer: 'Board And Lodging At Teachers\' Camp Include Accommodation And Meals, Additional Amenities Such As Housekeeping, Utilities, And Conference Facilities May Also Be Available.',
  },
  {
    id: 2,
    question: 'What Types Of Rooms Are Available?',
    answer: 'Teachers\' Camp offers a variety of room types including single rooms, double rooms, and dormitory-style accommodations to suit different needs and group sizes. Please contact us for specific availability.',
  },
  {
    id: 3,
    question: 'Are Meals Provided, And What Kind Of Food Is Served?',
    answer: 'Yes, meals are provided as part of the board and lodging package. We offer a selection of hearty Filipino and international dishes, served buffet style. Specific menu items may vary.',
  },
  {
    id: 4,
    question: 'What Are The Check-In And Check-Out Times?',
    answer: 'Standard check-in time is 2:00 PM, and check-out time is 12:00 PM (noon). Early check-in or late check-out may be accommodated upon request, subject to availability and additional charges.',
  },
  {
    id: 5,
    question: 'Are Pets Allowed?',
    answer: 'Unfortunately, for the comfort and safety of all guests, pets are generally not allowed within the camp premises. Please inquire directly if you have special needs.',
  },
  {
    id: 6,
    question: 'How Do I Make A Reservation?',
    answer: 'Reservations can be made through our official website\'s "Reserve Now" section, or by contacting our reservations office directly via phone or email. We recommend booking in advance, especially during peak seasons.',
  },
];

function FAQSection() {
  const [openItemId, setOpenItemId] = useState(null);

  const toggleAccordion = (itemId) => {
    setOpenItemId(prevId => prevId === itemId ? null : itemId);
  };

  return (
    <section className={styles.faqSection} id="faq-section">
      <h2 className={styles.sectionTitle}>FREQUENTLY ASK QUESTIONS</h2>
      <div className={styles.accordionContainer}>
        {faqData.map((item) => (
          <AccordionItem
            key={item.id}
            item={item}
            isOpen={openItemId === item.id}
            toggleAccordion={toggleAccordion}
          />
        ))}
      </div>
    </section>
  );
}

function AccordionItem({ item, isOpen, toggleAccordion }) {
  const contentRef = useRef(null);

  return (
    <div className={`${styles.accordionItem} ${isOpen ? styles.active : ''}`}>
      <div className={styles.accordionHeader} onClick={() => toggleAccordion(item.id)}>
        <h3 className={styles.questionNumber}>{item.id}.</h3>
        <p className={styles.questionText}>{item.question}</p>
        <span className={`${styles.accordionIcon} ${isOpen ? styles.rotate : ''}`}>
          &#9660;
        </span>
      </div>
      <div
        ref={contentRef}
        className={styles.accordionContent}
        style={{ maxHeight: isOpen && contentRef.current ? contentRef.current.scrollHeight + 'px' : '0px' }}
      >
        <p>{item.answer}</p>
      </div>
    </div>
  );
}

export default FAQSection;