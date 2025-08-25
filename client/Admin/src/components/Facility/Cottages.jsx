import React from "react";
import BoxCard from "./BoxCard";

export default function Cottages({ onEdit }) {
const cottages = [
{ id: "c1", name: "Beachfront Cottage", rate: 1500, capacity: 4, status: "Available" },
{ id: "c2", name: "Garden Cottage", rate: 1200, capacity: 3, status: "Occupied" },
];

return (
<BoxCard
facilities={cottages}
type="Cottages"
onEdit={onEdit}
onDelete={(id) => console.log("Delete Cottage", id)}
/>
);
}