import { apiGet } from "./api";

export const getDashboardStats = async () => {
  return await apiGet("/dashboard/get-dashboard-stats");
};

export const getReservationsForCalendar = async (year, month) => {
  return await apiGet("/dashboard/get-reservations-for-calendar", { year, month });
};

export const getMonthlyReservations = async (year) => {
  return await apiGet("/dashboard/get-monthly-reservations", { year });
};
