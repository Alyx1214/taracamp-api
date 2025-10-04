import React from 'react';
import dormitoriesData from '../../data/dormitories';
import cottagesData from '../../data/cottages';
import conferencesData from '../../data/conferences';
import './AllServices.module.css';

const AllServices = () => {
  // Limit each section to 6 items
  const limitedDormitories = dormitoriesData.slice(0, 6);
  const limitedCottages = cottagesData.slice(0, 6);
  const limitedConferences = conferencesData.slice(0, 6);

  const handleViewAll = (section) => {
    // Navigate to respective section page
    console.log(`View all ${section}`);
    // You can implement navigation logic here
  };

  const ServiceCard = ({ item, type }) => (
    <div className="service-card">
      <div className="service-image">
        <img src={item.image || '/placeholder-image.jpg'} alt={item.name} />
      </div>
      <div className="service-info">
        <h3>{item.name}</h3>
        <p>{item.description}</p>
        <p className="capacity">Capacity: {item.capacity}</p>
        <button className="check-btn">Check</button>
      </div>
    </div>
  );

  return (
    <div className="all-services">
      {/* Dormitories Section */}
      <section className="service-section">
        <h2 className="section-title">DORMITORIES</h2>
        <div className="services-grid">
          {limitedDormitories.map((dormitory, index) => (
            <ServiceCard key={index} item={dormitory} type="dormitory" />
          ))}
        </div>
        <button 
          className="view-all-btn"
          onClick={() => handleViewAll('dormitories')}
        >
          View All
        </button>
      </section>

      {/* Cottages Section */}
      <section className="service-section">
        <h2 className="section-title">COTTAGES / GUESTHOUSE</h2>
        <div className="services-grid">
          {limitedCottages.map((cottage, index) => (
            <ServiceCard key={index} item={cottage} type="cottage" />
          ))}
        </div>
        <button 
          className="view-all-btn"
          onClick={() => handleViewAll('cottages')}
        >
          View All
        </button>
      </section>

      {/* Conferences Section */}
      <section className="service-section">
        <h2 className="section-title">CONFERENCES</h2>
        <div className="services-grid">
          {limitedConferences.map((conference, index) => (
            <ServiceCard key={index} item={conference} type="conference" />
          ))}
        </div>
        <button 
          className="view-all-btn"
          onClick={() => handleViewAll('conferences')}
        >
          View All
        </button>
      </section>
    </div>
  );
};

export default AllServices;