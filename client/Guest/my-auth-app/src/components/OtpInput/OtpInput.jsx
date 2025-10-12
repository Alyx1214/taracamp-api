import React, { useEffect, useMemo, useRef } from "react";
import styles from "./OtpInput.module.css";

const OtpInput = ({
  length = 6,
  value = "",
  onChange,
  onComplete,
  disabled = false,
  autoFocus = true,
}) => {
  const chars = useMemo(() => {
    const v = (value || "").replace(/\D/g, "").slice(0, length);
    return [...v.padEnd(length)].map(c => (c && /\d/.test(c) ? c : ""));
  }, [value, length]);

  const inputsRef = useRef([]);

  useEffect(() => {
    if (!autoFocus || disabled) return;
    const idx = Math.max(chars.findIndex(c => !c), 0);
    const el = inputsRef.current[idx];
    if (el) el.focus();
  }, []);

  const setCharAt = (idx, digit) => {
    const arr = [...chars];
    arr[idx] = digit;
    const next = arr.join("").slice(0, length);
    onChange?.(next);
    if (next.length === length && !arr.includes("")) {
      onComplete?.(next);
    }
  };

  const handleChange = (e, idx) => {
    const raw = e.target.value;
    if (!raw) {
      setCharAt(idx, "");
      return;
    }
    const digits = raw.replace(/\D/g, "");
    if (!digits) return;

    if (digits.length === 1) {
      setCharAt(idx, digits);
      const nextEl = inputsRef.current[idx + 1];
      if (nextEl) nextEl.focus();
      return;
    }

    const arr = [...chars];
    let i = idx;
    for (const d of digits) {
      if (i >= length) break;
      arr[i++] = d;
    }
    const next = arr.join("").slice(0, length);
    onChange?.(next);
    const focusIndex = Math.min(i, length - 1);
    inputsRef.current[focusIndex]?.focus();
    if (next.length === length && !arr.includes("")) {
      onComplete?.(next);
    }
  };

  const handleKeyDown = (e, idx) => {
    const key = e.key;

    if (key === "Backspace") {
      if (chars[idx]) {
        // clear current
        setCharAt(idx, "");
      } else if (idx > 0) {
        // go back and clear
        const prev = inputsRef.current[idx - 1];
        if (prev) {
          prev.focus();
          setCharAt(idx - 1, "");
        }
      }
      e.preventDefault();
      return;
    }

    if (key === "ArrowLeft" && idx > 0) {
      inputsRef.current[idx - 1]?.focus();
      e.preventDefault();
      return;
    }

    if (key === "ArrowRight" && idx < length - 1) {
      inputsRef.current[idx + 1]?.focus();
      e.preventDefault();
      return;
    }

    if (/^\d$/.test(key)) {
      // type a single digit
      setCharAt(idx, key);
      inputsRef.current[idx + 1]?.focus();
      e.preventDefault();
    }

    // block non-digits
    if (key.length === 1 && !/^\d$/.test(key)) {
      e.preventDefault();
    }
  };

  const handlePaste = (e, idx) => {
    const text = e.clipboardData.getData("text");
    if (!text) return;
    e.preventDefault();
    handleChange({ target: { value: text } }, idx);
  };

  return (
    <div className={styles.otpContainer} role="group" aria-label="One-time code">
      {Array.from({ length }).map((_, idx) => (
        <input
          key={idx}
          ref={el => (inputsRef.current[idx] = el)}
          className={styles.otpBox}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{1}"
          maxLength={1}
          value={chars[idx]}
          onChange={e => handleChange(e, idx)}
          onKeyDown={e => handleKeyDown(e, idx)}
          onPaste={e => handlePaste(e, idx)}
          disabled={disabled}
          aria-label={`Digit ${idx + 1}`}
        />
      ))}
    </div>
  );
};

export default OtpInput;
