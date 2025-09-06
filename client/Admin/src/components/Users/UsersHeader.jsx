import React from "react";
import { FaPlus } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import styles from "./UsersHeader.module.css";


const UsersHeader = () => {
  const navigate = useNavigate();


  return (
    <div className={styles["users-header__container"]}>
      <h1 className={styles["users-header__title"]}>USERS</h1>


      <button
        className={styles["users-header__add-btn"]}
        onClick={() => navigate("/users/add")}
      >
        <FaPlus className={styles["users-header__icon"]} />
        Add User
      </button>
    </div>
  );
};


export default UsersHeader;
