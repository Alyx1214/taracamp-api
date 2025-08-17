import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import Header from "../Header/Header";
import Sidebar from "../Sidebar/Sidebar";
import styles from "./Layout.module.css"; 

const Layout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const toggleSidebar = () => setIsSidebarOpen((prev) => !prev);
  const closeSidebar = () => setIsSidebarOpen(false);

  return (
    <div className={styles.layout}>
      <Header onHamburgerClick={toggleSidebar} />

      <div
        className={`${styles.appShell} ${
          isSidebarOpen ? styles.appShellOpen : styles.appShellClosed
        }`}
      >
        <aside
          className={`${styles.shellSidebar} ${
            isSidebarOpen ? styles.shellSidebarOpen : ""
          }`}
        >
          <Sidebar isOpen={isSidebarOpen} onClose={closeSidebar} />
        </aside>

        <main className={styles.shellMain}>
          <Outlet />
        </main>
      </div>

      <div
        className={`${styles.shellOverlay} ${
          isSidebarOpen ? styles.shellOverlayShow : ""
        }`}
        onClick={closeSidebar}
        aria-hidden={!isSidebarOpen}
      />
    </div>
  );
};

export default Layout;
