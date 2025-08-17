import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout/Layout";
import Dashboard from "./components/Dashboard";
import Reservations from "./components/Reservation/Reservations";
import Facilities from "./components/Facility/Facilities";
import Transactions from "./components/Transactions";
import User from "./components/User";
import Reports from "./components/Reports.jsx";
import CheckInOut from "./components/ChecksInOut/CheckInOut";
import AddReservation from "./components/Reservation/AddReservation.jsx";
import ReservationDetails from "./components/Reservation/ReservationDetail.jsx";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />

          <Route path="dashboard" element={<Dashboard />} />
          <Route path="reservations" element={<Reservations />} />
          <Route path="facilities" element={<Facilities />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="user" element={<User />} />
          <Route path="checkin" element={<CheckInOut />} />
          <Route path="reports" element={<Reports />} />
          <Route path="/reservations/add" element={<AddReservation />} />
          <Route path="/reservations/:id" element={<ReservationDetails />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
