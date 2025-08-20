import React from 'react';
import s from './ErrorBanner.module.css';

export default function ErrorBanner({ err, onClose }) {
  if (!err) return null;

  const msg = typeof err === 'string' ? err : err.message || 'Something went wrong';
  const details = Array.isArray(err.details) ? err.details : null;
  const status = err.status || null;

  return (
    <div role="alert" className={s.errorBanner}>
      <div className={s.errorBannerRow}>
        <strong>Error{status ? ` ${status}` : ''}:</strong>
        <span className={s.errorBannerMsg}>{msg}</span>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className={s.errorBannerClose}
            aria-label="Dismiss error"
          >
            ×
          </button>
        )}
      </div>

      {details && details.length > 0 && (
        <ul className={s.errorList}>
          {details.map((d, i) => (
            <li key={i}>
              {d.field ? <b>{d.field}:</b> : null} {d.message || d.code || String(d)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
