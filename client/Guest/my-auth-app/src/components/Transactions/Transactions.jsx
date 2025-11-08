import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import styles from './Transactions.module.css';
import HeaderHome from '../HeaderHome/HeaderHome'; 
import { createPaymentIntent, createPaymentMethod, attachPaymentMethod, listPaymentsByReservation, reconcilePaymentIntent, getPaymentSummary } from '../../apis/paymentApi';

function Transactions() {
  const navigate = useNavigate();
  const { search } = useLocation();
  const reservationId = new URLSearchParams(search).get('reservationId');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState(null);
  const [amount, setAmount] = useState('');
  const [amountError, setAmountError] = useState('');
  const [payments, setPayments] = useState([]);

  const handleGoBack = () => {
    navigate(-1); // Go back to the previous page in history
  };

  const [startingCheckout, setStartingCheckout] = useState(false);

  const startPaymongoCheckout = async (channel) => {
    if (!reservationId) { setError('No reservation selected.'); return; }
    if (startingCheckout) return;
    // Basic amount validation on client
    const amtNum = Number(String(amount).replace(/,/g, ''));
    const max = Number(summary?.totalEstimatedAmount || 0);
    if (!Number.isFinite(amtNum) || amtNum <= 0) {
      setAmountError('Enter a valid amount greater than 0');
      return;
    }
    if (max > 0 && amtNum > max) {
      setAmountError('Amount cannot exceed total');
      return;
    }
    setAmountError('');
    setStartingCheckout(true);
    setError(null);
    try {
      // 1) Create Payment Intent for this reservation, allowing only the chosen channel
      const intentRes = await createPaymentIntent(reservationId, {
        paymentMethodAllowed: [channel],
        description: `Payment for Reservation ${reservationId}`,
        captureType: 'automatic',
        amount: amtNum,
      });
      const intent = intentRes?.paymentIntent || intentRes?.data?.paymentIntent || {};

      if (!intent?.id) throw new Error('Failed to create payment intent');

      // 2) Create Payment Method (redirect type for gcash and paymaya)
      const pmRes = await createPaymentMethod({ type: channel });
      const pm = pmRes?.paymentMethod || pmRes?.data?.paymentMethod || {};
      if (!pm?.id) throw new Error('Failed to create payment method');

      // 3) Attach to intent and redirect user
      const returnUrl = `${window.location.origin}/transactions?reservationId=${encodeURIComponent(reservationId)}`;
      const attachRes = await attachPaymentMethod({
        paymentIntentId: intent.id,
        paymentMethodId: pm.id,
        returnUrl,
        paymentMethodType: channel,
      });

      const nextAction = attachRes?.paymentIntent?.nextAction || attachRes?.paymentIntent?.next_action || {};
      const redirectUrl = nextAction?.redirect?.url || nextAction?.redirect?.redirect_url || nextAction?.url;
      if (redirectUrl) {
        window.location.href = redirectUrl;
        return;
      }
      // If no redirect, surface status
      const status = attachRes?.paymentIntent?.status;
      if (status === 'succeeded') {
        // Let webhook/process reflect success; optionally refresh summary
        setSummary({ ...(summary || {}), lastStatus: 'paid' });
      } else {
        setError('Unable to start checkout. Please try again.');
      }
    } catch (e) {
      setError(e?.data?.error || e?.message || 'Failed to start checkout');
    } finally {
      setStartingCheckout(false);
    }
  };

  useEffect(() => {
    let active = true;
    const run = async () => {
      if (!reservationId) return;
      setLoading(true);
      setError(null);
      try {
        const res = await getPaymentSummary(reservationId);
        if (!active) return;
        const s = res?.data || res;
        setSummary(s);
        // Default the amount to the suggested downpayment when available
        if (s) {
          const dp = typeof s.downpaymentAmount === 'number' ? s.downpaymentAmount : 0;
          const rem = typeof s.remainingBalance === 'number' ? s.remainingBalance : dp;
          const defaultAmt = Math.max(0, Math.min(dp || rem, rem));
          if (defaultAmt > 0) setAmount(String(defaultAmt));
        }

        // Load any existing online transactions
        const listRes = await listPaymentsByReservation(reservationId);
        if (active) {
          const rows = listRes?.data || listRes || [];
          setPayments(Array.isArray(rows) ? rows : []);
        }
      } catch (e) {
        if (!active) return;
        setError(e?.data?.error || e?.message || 'Failed to load payment summary');
      } finally {
        if (active) setLoading(false);
      }
    };
    run();
    return () => { active = false; };
  }, [reservationId]);

  // When PayMongo redirects back to our return_url, attempt to reconcile the PI
  useEffect(() => {
    let cancelled = false;
    const sp = new URLSearchParams(window.location.search);
    const piId = sp.get('payment_intent_id') || sp.get('payment_intent') || sp.get('pi_id') || sp.get('id');
    if (!reservationId || !piId) return;

    (async () => {
      try {
        await reconcilePaymentIntent(piId);
        if (cancelled) return;
        // Refresh the visible payment list after reconcile
        const listRes = await listPaymentsByReservation(reservationId);
        if (!cancelled) {
          const rows = listRes?.data || listRes || [];
          setPayments(Array.isArray(rows) ? rows : []);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e?.data?.error || e?.message || 'Failed to reconcile payment');
        }
      }
    })();

    return () => { cancelled = true; };
  }, [reservationId]);

  return (
    <>
      <HeaderHome />
      <div className={styles.transactionsPageContainer}>
        <div className={styles.contentWrapper}>
          <div className={styles.headerSection}>
            <button onClick={handleGoBack} className={styles.backButton}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12"></line>
                <polyline points="12 19 5 12 12 5"></polyline>
              </svg>
            </button>
            <h1 className={styles.pageTitle}>Payment Transaction</h1>
          </div>

            <div className={styles.mainContent}>
              <div className={styles.onlineTransactionCard}>
                <h2 className={styles.cardTitle}>Online Transaction</h2>
                <div className={styles.tableHeader}>
                  <span className={styles.tableHeaderItem}>Date</span>
                  <span className={styles.tableHeaderItem}>Channel</span>
                  <span className={styles.tableHeaderItem}>Reference</span>
                  <span className={styles.tableHeaderItem}>Amount</span>
                </div>
                <div className={styles.tableContent}>
                  {(() => {
                    const visible = (payments || []).filter(p => {
                      const s = String(p.status || '').toLowerCase();
                      return s === 'paid' || s === 'succeeded';
                    });
                    if (visible.length === 0) {
                      return (
                        <p className={styles.noTransactions}>No transactions yet.</p>
                      );
                    }
                    return visible.map((p) => {
                      const date = p.paidAt || p.createdAt;
                      const dt = date ? new Date(date) : null;
                      const dateStr = dt ? dt.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
                      const channel = String(p.paymentMethodType || '—')
                        .toLowerCase()
                        .replace(/[_-]+/g, ' ')
                        .split(/\s+/)
                        .map(w => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
                        .join(' ');
                      const ref = String(p.referenceNumber || p.paymentId || p._id || '—').toUpperCase();
                      const amt = Number((p.amountCentavos ?? 0) / 100);
                      const amtStr = isNaN(amt) ? '—' : `₱ ${amt.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
                      return (
                        <div key={p._id || `${p.piId}-${p.paymentId}`} className={styles.tableRow}>
                          <div className={styles.tableDataItem}>{dateStr}</div>
                          <div className={styles.tableDataItem}>{channel}</div>
                          <div className={styles.tableDataItem}>{ref}</div>
                          <div className={styles.tableDataItem}>{amtStr}</div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              <div className={styles.sidebarContent}>
                <div className={styles.downpaymentBalanceCard}>
                  <h2 className={styles.cardTitle}>Payment Summary</h2>
                  {!reservationId && (
                    <>
                      <p className={styles.note}>No reservation selected.</p>
                      <p className={styles.note}>Return to Reservation History and choose Pay/Confirm.</p>
                    </>
                  )}
                  {reservationId && (
                    <>
                      {(() => {
                        const paid = Number(summary?.totalPaid || 0) > 0;
                        const main = paid ? Number(summary?.remainingBalance || 0) : Number(summary?.downpaymentAmount || 0);
                        return (
                          <>
                            <p className={styles.dueDate}>
                              Due Date: <span className={styles.highlightDate}>
                                {loading ? 'Loading…' : error ? '—' : new Date(summary?.dueDate || Date.now()).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                              </span>
                            </p>
                            <p className={styles.balanceAmount}>
                              ₱ {loading ? '—' : main.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                            </p>
                            {paid ? (
                              <p className={styles.note}>
                                Paid so far: ₱ {Number(summary?.totalPaid || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                              </p>
                            ) : (
                              <p className={styles.note}>
                                Suggested downpayment
                              </p>
                            )}
                          </>
                        );
                      })()}
                      <div className={styles.amountInputGroup}>
                        <label htmlFor="amountInput">Amount to pay (PHP)</label>
                        <input
                          id="amountInput"
                          type="number"
                          inputMode="decimal"
                          min="0.01"
                          step="0.01"
                          value={amount}
                          onChange={(e) => {
                            setAmount(e.target.value);
                            setAmountError('');
                          }}
                          className={styles.amountInput}
                          placeholder="0.00"
                        />
                        <div className={styles.amountHint}>
                          Max: ₱ {Number(summary?.totalEstimatedAmount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </div>
                        {amountError && (
                          <div className={styles.amountError}>{amountError}</div>
                        )}
                      </div>
                      <p className={styles.note}>
                        Please ensure the downpayment is made before the due date to avoid cancellation of your reservation.
                      </p>
                      {error && <p className={styles.note} style={{ color: '#b00020' }}>{error}</p>}
                    </>
                  )}
                </div>

                <div className={styles.paymentChannelsCard}>
                  <h2 className={styles.cardTitle}>Payment Channels</h2>
                  <div className={styles.channelButtons}>
                    <button
                      className={styles.channelButton}
                      disabled={!reservationId || startingCheckout || !!amountError || !amount}
                      onClick={() => startPaymongoCheckout('gcash')}
                      title={!reservationId ? 'Select a reservation first' : 'Pay with GCash'}
                    >
                      <img
                        src="https://logos-world.net/wp-content/uploads/2023/05/GCash-Logo.jpg"
                        alt="GCash"
                        className={styles.channelLogo}
                      />
                    </button>
                    <button
                      className={styles.channelButton}
                      disabled={!reservationId || startingCheckout || !!amountError || !amount}
                      onClick={() => startPaymongoCheckout('grab_pay')}
                      title={!reservationId ? 'Select a reservation first' : 'Pay with GrabPay'}
                    >
                      <img
                        src="https://bux.ph/wp-content/uploads/sites/10/2023/07/logo-grabpay.png"
                        alt="GrabPay"
                        className={styles.channelLogo}
                      />
                    </button>
                    <button
                      className={styles.channelButton}
                      disabled={!reservationId || startingCheckout || !!amountError || !amount}
                      onClick={() => startPaymongoCheckout('paymaya')}
                      title={!reservationId ? 'Select a reservation first' : 'Pay with PayMaya'}
                    >
                      <img
                        src="https://fameplus.com/uploads/_export_enablers/1661479316374_WeBuildPossibilitieslogo-ChristineRemando.jpg"
                        alt="DBP"
                        className={styles.channelLogo}
                      />
                    </button>
                  </div>
                </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default Transactions;
