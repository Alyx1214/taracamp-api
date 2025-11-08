import { apiGet, apiPost } from './api';

export function listNotifications({ limit = 20, page = 1 } = {}) {
  return apiGet(`/notification/list?limit=${limit}&page=${page}`);
}

export function countUnreadNotifications() {
  return apiGet('/notification/count-unread');
}

export function markAllNotificationsRead() {
  return apiPost('/notification/mark-all-read');
}

export function markNotificationRead({ id }) {
  return apiPost(`/notification/mark-read/${id}`);
}

export function deleteNotification({ id }) {
  return apiPost(`/notification/delete/${id}`);
}

export function deleteAllNotifications() {
  return apiPost('/notification/delete-all');
}
