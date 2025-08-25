import React from "react";
import BoxCard from "./BoxCard";

export default function Dormitory({ onEdit }) {
  const dorms = [
    { id: "d1", name: "Male Dorm A", rate: 800, capacity: 20, status: "Available" },
    { id: "d2", name: "Female Dorm B", rate: 850, capacity: 18, status: "Occupied" },
  ];

  const handleDelete = (id) => {
    console.log("Delete Dormitory:", id);
  };

  return (
    <BoxCard
      facilities={dorms}
      type="Dormitory"
      onEdit={onEdit}
      onDelete={handleDelete}
    />
  );
}
