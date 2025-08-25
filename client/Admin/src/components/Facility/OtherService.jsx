import React from "react";
import BoxCard from "./BoxCard";

export default function OtherService({ onEdit }) {
const services = [
{ id: "s1", name: "Laundry Service", rate: 100, capacity: 20, status: "Available" },
{ id: "s2", name: "Shuttle Service", rate: 500, capacity: 10, status: "Occupied" },
];

return (
<BoxCard
facilities={services}
type="Other Service"
onEdit={onEdit}
onDelete={(id) => console.log("Delete Service", id)}
/>
);
}