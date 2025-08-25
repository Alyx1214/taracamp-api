import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout/Layout";
import Dashboard from "./components/DashboardCard/DashboardCard.jsx";
import Reservations from "./components/Reservation/Reservations";
import Facilities from "./components/Facility/Facilities";
import Transactions from "./components/Transaction/Transaction.jsx";
import User from "./components/Users/Users.jsx";
import Reports from "./components/Report/Report.jsx";
import CheckInOut from "./components/CheckInOuts/CheckInOuts.jsx";
import AddReservation from "./components/Reservation/AddReservation.jsx";
import ReservationDetails from "./components/Reservation/ReservationDetail.jsx";
import AddForm from "./components/Facility/AddForm.jsx";
import EditForm from "./components/Facility/EditForm.jsx"; 

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

<Route path="/add-facility" element={<AddForm />} />
<Route path="/facilities/edit/:id" element={<EditForm />} /> 

<Route path="*" element={<Navigate to="/" replace />} />
</Route>
</Routes>
</BrowserRouter>
);
}

export default App;