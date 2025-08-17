import React from "react";
import { useNavigate } from "react-router-dom";
import UnivTable from "./UnivTable";
import styles from "./UnivTable.module.css"; 

export default function Pending() {
  const navigate = useNavigate();

  const columns = ["ID", "Name", "Email", "Service Type", "Date", "Actions"];

  const pendingData = [
    { id: "0508", name: "Tom John", email: "john.tom@gmail.com", serviceType: "Lodging", date: "April 6, 2025" },
    { id: "0509", name: "Jerome Bell", email: "jeromebell@gmail.com", serviceType: "Event and Lodging", date: "April 5, 2025" },
    { id: "0510", name: "Wade Warren", email: "warren05@gmail.com", serviceType: "Event", date: "April 4, 2025" },
    { id: "0511", name: "Eleanor Pena", email: "eleanorpena@gmail.com", serviceType: "Lodging", date: "April 3, 2025" },
    { id: "0512", name: "Michelle Smith", email: "smith_mt@gmail.com", serviceType: "Lodging", date: "April 2, 2025" },
    { id: "0513", name: "Leona Richards", email: "leanor.r01@gmail.com", serviceType: "Lodging", date: "April 1, 2025" },
    { id: "0514", name: "Patricia Rivera", email: "patrivera@gmail.com", serviceType: "Event and Lodging", date: "March 28, 2025" },
    { id: "0515", name: "Gabriela Bolton", email: "hsmgabbby@gmail.com", serviceType: "Event", date: "March 19, 2025" },
    { id: "0516", name: "Carlito Pardilla", email: "par_carlitsr@gmail.com", serviceType: "Event", date: "March 10, 2025" },
    { id: "0517", name: "Shan Camero", email: "shan01camt@gmail.com", serviceType: "Event and Lodging", date: "Feb 20, 2025" },
    { id: "0518", name: "Sharpay Evans", email: "evans_shay@gmail.com", serviceType: "Lodging", date: "Feb 15, 2025" },
    { id: "0519", name: "Skye Borromeo", email: "skyeb1004@gmail.com", serviceType: "Event and Lodging", date: "Feb 1, 2025" },
    { id: "0520", name: "Diana Mendiola", email: "mend_diana@gmail.com", serviceType: "Lodging", date: "Jan 20, 2025" },
    { id: "0521", name: "Jerome Bell", email: "jerbell@gmail.com", serviceType: "Event", date: "Jan 18, 2025" },
    { id: "0522", name: "Luna Ereno", email: "jerbell@gmail.com", serviceType: "Lodging", date: "Jan 10, 2025" },
  ];

  const renderActions = (row) => (
    <>
      <button className={styles["univ-approve-btn"]}>Approve</button>
      <button className={styles["univ-decline-btn"]}>Decline</button>
    </>
  );

  const renderMenu = (row) => [
    {
      label: "See Details",
      onClick: () => navigate(`/reservations/${row.id}`), 
    },
  ];

  return (
    <UnivTable
      columns={columns}
      data={pendingData}
      renderActions={renderActions}
      renderMenu={renderMenu}
    />
  );
}
