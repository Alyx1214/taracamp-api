import { apiGet } from "./api";

export const getDashboardStats = async () => {
  return await apiGet("/api/dashboard/get-dashboard-stats");
};

export const getReservationsForCalendar = async (year, month) => {
  return await apiGet("/api/dashboard/get-reservations-for-calendar", { year, month });
};

export const getMonthlyReservations = async (year) => {
  return await apiGet("/api/dashboard/get-monthly-reservations", { year });
};
