export function timeAgo(isoDate) {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diffSec = Math.floor((now - then) / 1000);

  if (diffSec < 60) {
    return `${diffSec}s`;
  }
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    return `${diffMin} min${diffMin > 1 ? 's' : ''}`;
  }
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) {
    return `${diffHr} hr${diffHr > 1 ? 's' : ''}`;
  }
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay} d${diffDay > 1 ? 's' : ''}`;
}
