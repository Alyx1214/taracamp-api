import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout/Layout";
import Dashboard from "../src/components/Dashboard/Dashboard.jsx";
import Reservations from "./components/Reservation/Reservations";
import Facilities from "./components/Facility/Facilities";
import AddReservation from "../src/components/Reservation/AddReservation.jsx";
import ReservationDetails from "../src/components/Reservation/ReservationDetail.jsx";
import AddForm from "../src/components/Facility/AddForm.jsx";
import EditForm from "../src/components/Facility/EditForm.jsx"; 
import CheckInOut from "./components/CheckInOut/CheckInOuts.jsx";
import Reports from "./components/Report/Report.jsx";
import User from "./components/Users/Users.jsx";

function App() {
return (
<BrowserRouter>
<Routes>
<Route path="/" element={<Layout />}>
<Route index element={<Dashboard />} />

<Route path="dashboard" element={<Dashboard />} />
<Route path="reservations" element={<Reservations />} />
<Route path="facilities" element={<Facilities />} />
{/* <Route path="transactions" element={<Transactions />} />  */}
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