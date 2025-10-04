import React, { useState } from 'react';
import './PopupServices.module.css';

const PopupServices = ({ isOpen, onClose }) => {
    const [selectedService, setSelectedService] = useState('Dormitory');
    const [checkInDate, setCheckInDate] = useState('');
    const [checkOutDate, setCheckOutDate] = useState('');
    const [adults, setAdults] = useState(1);
    const [children, setChildren] = useState(1);

    const serviceTypes = ['Dormitory', 'Cottage', 'Conference'];

    // Set default dates on component mount
    React.useEffect(() => {
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        setCheckInDate(today.toISOString().split('T')[0]);
        setCheckOutDate(tomorrow.toISOString().split('T')[0]);
    }, []);

    const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { 
            day: 'numeric', 
            month: 'short', 
            year: 'numeric' 
        });
    };

    const getDayOfWeek = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { weekday: 'long' });
    };

    const handleSearch = () => {
        const searchData = {
            serviceType: selectedService,
            checkIn: checkInDate,
            checkOut: checkOutDate,
            adults: adults,
            children: children
        };
        console.log('Search data:', searchData);
        // Add your search logic here
    };

    const incrementCount = (type) => {
        if (type === 'adults') {
            setAdults(prev => prev + 1);
        } else if (type === 'children') {
            setChildren(prev => prev + 1);
        }
    };

    const decrementCount = (type) => {
        if (type === 'adults' && adults > 1) {
            setAdults(prev => prev - 1);
        } else if (type === 'children' && children > 0) {
            setChildren(prev => prev - 1);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="popup-overlay">
            <div className="popup-container">
                <div className="popup-header">
                    <h2>Book Your Stay</h2>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>
                
                <div className="popup-content">
                    {/* Service Type Selection */}
                    <div className="service-types">
                        {serviceTypes.map((service) => (
                            <button
                                key={service}
                                className={`service-btn ${selectedService === service ? 'active' : ''}`}
                                onClick={() => setSelectedService(service)}
                            >
                                {service}
                            </button>
                        ))}
                    </div>

                    {/* Date Selection */}
                    <div className="date-section">
                        <div className="date-input">
                            <label>Check-in</label>
                            <div className="date-field">
                                <span className="calendar-icon">📅</span>
                                <input
                                    type="date"
                                    value={checkInDate}
                                    onChange={(e) => setCheckInDate(e.target.value)}
                                    min={new Date().toISOString().split('T')[0]}
                                />
                                <div>
                                    <div className="date-value">{formatDate(checkInDate)}</div>
                                    <div className="date-day">{getDayOfWeek(checkInDate)}</div>
                                </div>
                            </div>
                        </div>
                        
                        <div className="date-input">
                            <label>Check-out</label>
                            <div className="date-field">
                                <span className="calendar-icon">📅</span>
                                <input
                                    type="date"
                                    value={checkOutDate}
                                    onChange={(e) => setCheckOutDate(e.target.value)}
                                    min={checkInDate || new Date().toISOString().split('T')[0]}
                                />
                                <div>
                                    <div className="date-value">{formatDate(checkOutDate)}</div>
                                    <div className="date-day">{getDayOfWeek(checkOutDate)}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Guest Selection */}
                    <div className="guest-section">
                        <div className="guest-input">
                            <label>Adult</label>
                            <div className="counter">
                                <button 
                                    className="counter-btn"
                                    onClick={() => decrementCount('adults')}
                                    disabled={adults <= 1}
                                >
                                    -
                                </button>
                                <span className="count">{adults}</span>
                                <button 
                                    className="counter-btn"
                                    onClick={() => incrementCount('adults')}
                                >
                                    +
                                </button>
                            </div>
                        </div>
                        
                        <div className="guest-input">
                            <label>Child</label>
                            <div className="counter">
                                <button 
                                    className="counter-btn"
                                    onClick={() => decrementCount('children')}
                                    disabled={children <= 0}
                                >
                                    -
                                </button>
                                <span className="count">{children}</span>
                                <button 
                                    className="counter-btn"
                                    onClick={() => incrementCount('children')}
                                >
                                    +
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Search Button */}
                    <button className="search-btn" onClick={handleSearch}>
                        SEARCH
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PopupServices;