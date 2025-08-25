import React from "react";
import BoxCard from "./BoxCard";

export default function Conference({ onEdit }) {
const conferences = [
{ id: "conf1", name: "Main Hall", rate: 5000, capacity: 200, status: "Available" },
{ id: "conf2", name: "Meeting Room", rate: 2500, capacity: 50, status: "Under Maintenance" },
];

return (
<BoxCard
facilities={conferences}
type="Conference"
onEdit={onEdit}
onDelete={(id) => console.log("Delete Conference", id)}
/>
);
}