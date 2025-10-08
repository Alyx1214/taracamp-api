export function timeAgo(isoDate) {
  if (!isoDate) return '';
  const d = isoDate instanceof Date ? isoDate : new Date(isoDate);
  if (Number.isNaN(d.getTime())) return '';

  const now = Date.now();
  let diffSec = Math.floor((now - d.getTime()) / 1000);

  if (diffSec < 0) diffSec = 0;

  if (diffSec < 5) return 'Just now';

  if (diffSec < 60) return `${diffSec}s`;

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;

  const nowDate = new Date();
  const y = new Date(nowDate);
  y.setDate(nowDate.getDate() - 1);
  if (isSameDay(d, y)) return 'Yesterday';

  if (d.getFullYear() === nowDate.getFullYear()) {
    return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
  }

  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
      && a.getMonth() === b.getMonth()
      && a.getDate() === b.getDate();
}
