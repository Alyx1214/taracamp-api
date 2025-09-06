import React, { useState } from "react";
import UnivTable from "../UnivTable/UnivTable.jsx";
import SearchFil from "../SearchFil/SearchFil.jsx";
import UsersHeader from "./UsersHeader.jsx";
import styles from "./Users.module.css";
import Pagination from "../Pagination/Pagination.jsx";


export default function Users() {
  const [activeTab, setActiveTab] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState({});
  const [users] = useState([
    { id: "U001", name: "Alice Johnson", email: "alice.j@gmail.com", lastloggedin: "Aug 25, 2025", role: "Admin" },
    { id: "U002", name: "Mark Reyes", email: "mark.r@gmail.com", lastloggedin: "Aug 20, 2025", role: "Front Desk" },
    { id: "U003", name: "Sofia Cruz", email: "sofia.c@gmail.com", lastloggedin: "Aug 18, 2025", role: "Superintendent" },
    { id: "U004", name: "Kevin Tan", email: "kevin.t@gmail.com", lastloggedin: "Aug 10, 2025", role: "Staff" },
    { id: "U005", name: "Maria Santos", email: "maria.s@gmail.com", lastloggedin: "Jul 30, 2025", role: "Front Desk" },
  ]);

  const filteredData = users.filter((u) => {
    if (activeTab !== "All" && u.role !== activeTab) return false;
    if (
      searchQuery &&
      !u.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !u.email.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    if (filters.role && u.role.toLowerCase() !== filters.role.toLowerCase()) {
      return false;
    }
    return true;
  });

  const columns = ["ID", "Name", "Email", "Last Logged In", "Role", "Actions"];

  return(
    <div className={styles["users-container"]}>
      <UsersHeader/>
      <div className={styles["controlsContainer"]}>
        <div className={styles.roleTabsContainer}>
          {["All", "Admin", "Front Desk", "Staff", "Superintendent"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`${styles.roleTabBtn} ${activeTab === tab ? styles.active : ""}`}
            >
              {tab}
            </button>
          ))}
        </div>
        <SearchFil
            placeholder="Search users..."
            onSearch={(query) => setSearchQuery(query)}
            onApplyFilters={(applied) => setFilters(applied)}
            filterFields={[
              { name: "role", label: "Role", type: "text", placeholder: "e.g. Admin" },
            ]}
        />
      </div>
    <div className={styles.tableShiftRight}>
      <UnivTable
         columns={columns}
         data={filteredData}
         renderActions={() => (
           <button className={styles.editBtn}>
             Edit
           </button>
         )}
         renderMenu={(row) => [
           { label: "Delete", onClick: () => alert(`Deleting ${row.name}`) },
           { label: "View", onClick: () => alert(`Viewing ${row.name}`) },
         ]}
       />
       <Pagination />
       </div>

       
    </div>


      
      

      
  );
}
