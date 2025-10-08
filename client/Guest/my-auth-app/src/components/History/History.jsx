import React, { useRef } from 'react';
import HeaderHome from '../HeaderHome/HeaderHome';
import Footer from '../FooterHome/FooterHome';
import ReserveNow from '../BubbleButton/ReserveNow';
import styles from './History.module.css';

import historyHeroBg from '../../assets/history.png';
import historyMarkerImg from '../../assets/marker.png';
import evolution1911Img from '../../assets/1911.png';
import evolution1912Img from '../../assets/1912.png';
import evolution1937Img from '../../assets/1937.png';

function HistoryPage() {
  const historyContentRef = useRef(null);

  const handleExploreClick = () => {
    historyContentRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className={styles.historyPageContainer}>
      <HeaderHome />

      <main>
        {/* Hero Section */}
        <section
          className={styles.heroSection}
          style={{ backgroundImage: `url(${historyHeroBg})` }}
        >
          <div className={styles.heroContent}>
            <h1 className={styles.heroTitle}>THE HISTORY OF TEACHERS CAMP:</h1>
            <p className={styles.heroSubtitle}>A Legacy of Learning and Inspiration</p>
            <button className={styles.exploreButton} onClick={handleExploreClick}>
              Explore
            </button>
          </div>
        </section>

        {/* Historic Haven Section */}
        <section className={styles.historyContentSection} ref={historyContentRef}>
          <div className={styles.imageColumn}>
            <img
              src={historyMarkerImg}
              alt="Baguio Teachers' Camp historical marker"
              className={styles.historyMarkerImage}
            />
          </div>
          <div className={styles.textColumn}>
            <h2 className={styles.contentTitle}>A HISTORIC HAVEN FOR EDUCATORS</h2>
            <p className={styles.contentParagraph}>
              Teachers' Camp stands as a testament to the enduring commitment to education and professional
              development in the Philippines. Its inception dates back to December 11, 1907, when Benguet Governor
              William Pack issued an ordinance establishing a dedicated space for both American and Filipino
              educators. This initiative received enthusiastic support from W. Morgan Schuster, Secretary of the
              Bureau of Public Instruction, who outlined the camp&apos;s plan on January 18, 1908.
            </p>
            <p className={styles.contentParagraph}>
              Officially opening its doors on April 6, 1908, Teachers' Camp welcomed participants to its first
              Teachers Vacation Assembly, which continued until May 30 of that year. In its nascent stages, the camp
              featured tents that served as classrooms, kitchens, dining areas, and storage facilities, embodying
              the pioneering spirit of its founders.
            </p>
          </div>
        </section>

        {/* Evolution of Teachers Camp Section */}
        <section className={styles.evolutionSection}>
          <h2 className={styles.evolutionTitle}>EVOLUTION OF TEACHERS CAMP</h2>
          <div className={styles.timelineGrid}>
            <div className={styles.timelineEntry}>
              <div className={styles.timelineImageContainer}>
                <img src={evolution1911Img} alt="Teachers' Camp 1911" className={styles.timelineImage} />
              </div>
              <div className={styles.timelineTextContent}>
                <h3 className={styles.timelineYear}>1911</h3>
                <p className={styles.timelineDescription}>
                  Construction of the first permanent building, alongside the development of access roads and pathways.
                </p>
              </div>
            </div>

            <div className={styles.timelineEntry}>
              <div className={styles.timelineImageContainer}>
                <img src={evolution1912Img} alt="Teachers' Camp 1912 Benitez Hall" className={styles.timelineImage} />
              </div>
              <div className={styles.timelineTextContent}>
                <h3 className={styles.timelineYear}>1912</h3>
                <p className={styles.timelineDescription}>
                  Erection of Benitez Hall, the camp&apos;s largest facility, along with cottages designated for officials of the Bureau of Education and the camp director.
                </p>
              </div>
            </div>

            <div className={styles.timelineEntry}>
              <div className={styles.timelineImageContainer}>
                <img src={evolution1937Img} alt="Teachers' Camp 1937 General Luna Hall" className={styles.timelineImage} />
              </div>
              <div className={styles.timelineTextContent}>
                <h3 className={styles.timelineYear}>1937</h3>
                <p className={styles.timelineDescription}>
                  Addition of General Luna Hall during the Philippine Military Academy&apos;s temporary occupancy from 1936 to 1941.
                </p>
              </div>
            </div>
          </div>

          <p className={styles.evolutionConclusion}>
            Throughout its storied history, <span className={styles.highlightGreen}>Teachers&apos; Camp</span> has played host to a myriad of <span className={styles.highlightBrown}>seminars, workshops, and assemblies</span>, fostering
            the <span className={styles.highlightGreen}>growth and development</span> of <span className={styles.highlightBrown}>countless educators</span>. Its enduring presence amidst the cool, serene landscapes of Baguio
            <span className={styles.highlightGreen}> continues to inspire and cultivate</span> a community dedicated to the pursuit of <span className={styles.highlightBrown}>knowledge</span> and <span className={styles.highlightGreen}>excellence</span>.
          </p>
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

export default HistoryPage;
