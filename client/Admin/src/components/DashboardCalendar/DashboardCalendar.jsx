import React, { useState } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import "./DashboardCalendar.module.css";

const ReservationCalendar = () => {
  const [date, setDate] = useState(new Date());

  const onChange = (date) => {
    setDate(date);
  };

  return (
    <div className="calendar">
      <h3>Reservations Calendar</h3>
      <Calendar
        onChange={onChange}
        value={date}
        tileClassName="calendar-tile"
      />
    </div>
  );
};

export default ReservationCalendar;
