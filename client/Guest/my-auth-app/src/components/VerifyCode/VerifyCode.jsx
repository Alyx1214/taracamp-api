import React, { useEffect, useState } from "react";
import AuthFormContainer from "../AuthFormContainer/AuthFormContainer";
import OtpInput from "../OtpInput/OtpInput";
import styles from "./VerifyCode.module.css";
import { forgotPassword, verifyPasswordResetCode } from "../../apis/userApi";

const RESEND_SECONDS = 45;

const VerifyCode = ({ email, onBackToForgot, onVerified }) => {
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [resendLeft, setResendLeft] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (resendLeft <= 0) return;
    const t = setTimeout(() => setResendLeft(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendLeft]);

  useEffect(() => {
    setCode("");
    setResendLeft(RESEND_SECONDS);
    setMessage(email ? { type: "", text: "" } : { type: "error", text: "Enter your email again to request a code." });
  }, [email]);

  const handleSubmit = async e => {
    e.preventDefault();
    if (code.length !== 6) return;
    if (!email) {
      setMessage({ type: "error", text: "We need your email to verify the code. Go back and request a new one." });
      return;
    }
    setSubmitting(true);
    setMessage({ type: "", text: "" });
    try {
      const res = await verifyPasswordResetCode({ email, verificationCode: code });
      const { resetToken } = res || {};
      if (!resetToken) {
        setMessage({ type: "error", text: "Unable to continue. Please request a new code." });
        return;
      }
      setMessage({ type: "success", text: res?.message || "Code verified. Redirecting..." });
      onVerified?.(resetToken);
    } catch (err) {
      setMessage({ type: "error", text: err?.data?.error || err?.message || "Invalid or expired code." });
    } finally {
      setSubmitting(false);
    }
  };

  const resend = async () => {
    if (resendLeft > 0) return;
    if (!email) {
      setMessage({ type: "error", text: "Enter your email again to request a new code." });
      return;
    }
    try {
      const res = await forgotPassword({ email });
      setResendLeft(RESEND_SECONDS);
      setMessage({ type: "success", text: res?.message || "A new code was sent to your email." });
    } catch (err) {
      setMessage({ type: "error", text: err?.data?.error || err?.message || "Couldn’t resend code. Try again later." });
    }
  };

  const rightPanelContent = (
    <div className={styles.verifyForm}>
      <h2>Verify Your Code</h2>

      {email ? (
        <p className={styles.emailHint}>
          We sent a 6-digit code to <strong>{email}</strong>.
        </p>
      ) : (
        <p className={styles.emailHint}>
          No email on file.{" "}
          <button type="button" className={styles.backLink} onClick={onBackToForgot}>
            Request a code
          </button>
          .
        </p>
      )}

      {message.text ? (
        <div
          className={[
            styles.message,
            message.type === "success" ? styles.success : styles.error,
          ].join(" ")}
        >
          {message.text}
        </div>
      ) : null}

      <form onSubmit={handleSubmit}>
        <div className={styles.inputGroup}>
          <OtpInput
            length={6}
            value={code}
            onChange={setCode}
            onComplete={setCode}
            autoFocus
            disabled={!email || submitting}
          />
        </div>

        <button
          type="submit"
          className={styles.verifyBtn}
          disabled={submitting || code.length !== 6 || !email}
        >
          {submitting ? "Verifying..." : "Verify"}
        </button>

        <div className={styles.resendRow}>
          <button
            type="button"
            onClick={onBackToForgot}
            className={styles.backLink}
            disabled={submitting}
          >
            Use a different email
          </button>
        </div>

        <div className={styles.resendRow}>
          {resendLeft > 0 ? (
            <span className={styles.resendHint}>
              Resend available in {resendLeft}s
            </span>
          ) : (
            <button
              type="button"
              onClick={resend}
              className={styles.resendLink}
              disabled={submitting}
            >
              Resend code
            </button>
          )}
        </div>
      </form>
    </div>
  );

  return (
    <AuthFormContainer rightContent={rightPanelContent} />
  );
};

export default VerifyCode;
