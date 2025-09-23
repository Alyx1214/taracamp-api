import { apiGet, apiPost } from './api';

export function listMessages(query) {
  return apiGet('/message/list', query);
}

export function countUnreadMessages() {
  return apiGet('/message/count-unread');
}

export function sendMessage(payload) {
  return apiPost('/message/send', payload);
}

export function markMessageRead(id) {
  return apiPost(`/message/mark-read/${encodeURIComponent(id)}`, {});
}

export function markAllMessagesRead() {
  return apiPost('/message/mark-all-read', {});
}
