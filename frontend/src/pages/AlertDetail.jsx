import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchAlertDetail, updateAlertStatus } from '../services/api';
import { ArrowLeft, CheckCircle2, AlertCircle, ShieldAlert, Clock, Check } from 'lucide-react';

export default function AlertDetail() {
  const { id } = useParams();
  const [alert, setAlert] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [newStatus, setNewStatus] = useState('');
  const [notes, setNotes] = useState('');
  const [updating, setUpdating] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);
  const [updateError, setUpdateError] = useState(null);

  useEffect(() => {
    setLoading(true);
    fetchAlertDetail(id)
      .then(res => {
        setAlert(res);
        setNewStatus(res.status);
        setNotes(res.investigation_notes || '');
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [id]);

  const handleUpdate = async (e) => {
    e.preventDefault();
    setUpdating(true);
    setSuccessMsg(null);
    setUpdateError(null);

    try {
      const res = await updateAlertStatus(id, {
        status: newStatus,
        investigation_notes: notes
      });
      setAlert(prev => ({
        ...prev,
        status: res.alert.status,
        investigation_notes: res.alert.investigation_notes,
        resolved_at: res.alert.resolved_at
      }));
      setSuccessMsg('Investigation status successfully recorded to database.');
    } catch (err) {
      setUpdateError(err.message);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-xs text-[#6b7280]">
        <div className="w-5 h-5 border-2 border-[#111827] border-t-transparent rounded-full animate-spin mb-2" />
        <span>Loading alert dossier...</span>
      </div>
    );
  }

  if (error || !alert) {
    return (
      <div className="space-y-4">
        <Link to="/alerts" className="text-xs font-medium text-[#4f46e5] flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Alerts</span>
        </Link>
        <div className="p-4 bg-white border border-[#fee2e2] rounded text-xs text-[#b91c1c]">
          {error || 'Alert not found'}
        </div>
      </div>
    );
  }

  const { rule, transaction } = alert;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Breadcrumb */}
      <div>
        <Link to="/alerts" className="text-xs font-medium text-[#4f46e5] hover:text-[#4338ca] inline-flex items-center gap-1 mb-2">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to alerts queue</span>
        </Link>
        <div className="flex items-baseline justify-between">
          <h1 className="text-xl font-semibold text-[#111827] tracking-tight">
            Alert Investigation #{alert.alert_id}
          </h1>
          <span className={`px-2.5 py-1 rounded text-xs font-medium ${
            alert.status === 'PENDING' ? 'bg-[#fffbeb] text-[#b45309]' :
            alert.status === 'CONFIRMED_FRAUD' ? 'bg-[#fef2f2] text-[#b91c1c]' :
            alert.status === 'FALSE_POSITIVE' ? 'bg-[#f3f4f6] text-[#4b5563]' :
            'bg-[#ecfdf5] text-[#065f46]'
          }`}>
            {alert.status}
          </span>
        </div>
        <p className="text-xs text-[#6b7280] mt-0.5">
          Triggered {new Date(alert.triggered_at).toLocaleString()}
          {alert.resolved_at && ` • Resolved ${new Date(alert.resolved_at).toLocaleString()}`}
        </p>
      </div>

      {/* Primary Dossier Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Rule & Transaction */}
        <div className="md:col-span-2 space-y-6">
          {/* Rule Card */}
          <div className="bg-white border border-[#e5e7eb] rounded-lg p-5">
            <div className="flex items-center justify-between pb-3 border-b border-[#f3f4f6]">
              <div>
                <span className="text-[10px] uppercase font-semibold text-[#6b7280]">Triggering Rule</span>
                <h2 className="text-sm font-semibold text-[#111827] mt-0.5">{rule.rule_name}</h2>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-semibold text-[#6b7280]">Risk Score</span>
                <div className="text-base font-bold text-[#111827] tabular-nums">{alert.risk_score}</div>
              </div>
            </div>

            <p className="text-xs text-[#4b5563] mt-3">{rule.description}</p>

            <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-[#f3f4f6] text-xs">
              <div>
                <span className="text-[10px] text-[#6b7280]">Configured Threshold:</span>
                <div className="font-semibold text-[#111827]">
                  {rule.threshold_value ? `$${rule.threshold_value.toLocaleString()}` : 'N/A'}
                </div>
              </div>
              <div>
                <span className="text-[10px] text-[#6b7280]">Time Window:</span>
                <div className="font-semibold text-[#111827]">
                  {rule.time_window_minutes ? `${rule.time_window_minutes} minutes` : 'Single Transaction'}
                </div>
              </div>
            </div>
          </div>

          {/* Transaction & Parties */}
          <div className="bg-white border border-[#e5e7eb] rounded-lg p-5">
            <span className="text-[10px] uppercase font-semibold text-[#6b7280]">Associated Transaction</span>
            <div className="mt-2 flex items-baseline justify-between pb-4 border-b border-[#f3f4f6]">
              <div>
                <span className="font-mono text-sm font-semibold text-[#111827]">{transaction.transaction_reference}</span>
                <span className="text-xs text-[#6b7280] block mt-0.5">
                  {new Date(transaction.transaction_timestamp).toLocaleString()}
                </span>
              </div>
              <div className="text-right">
                <div className="text-xl font-bold tracking-tight text-[#111827] tabular-nums">
                  ${transaction.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                <span className="text-[10px] font-medium text-[#065f46] bg-[#ecfdf5] px-2 py-0.5 rounded">
                  {transaction.status} • {transaction.transaction_type}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 text-xs">
              <div className="border border-[#e5e7eb] rounded p-3 bg-[#f9fafb]">
                <span className="text-[10px] uppercase font-semibold text-[#6b7280]">Source Account</span>
                <div className="font-mono font-medium text-[#111827] mt-1">{transaction.source_account.account_number}</div>
                <div className="text-xs text-[#4b5563] mt-0.5">{transaction.source_account.customer_name}</div>
              </div>
              <div className="border border-[#e5e7eb] rounded p-3 bg-[#f9fafb]">
                <span className="text-[10px] uppercase font-semibold text-[#6b7280]">Destination Account</span>
                <div className="font-mono font-medium text-[#111827] mt-1">{transaction.destination_account.account_number}</div>
                <div className="text-xs text-[#4b5563] mt-0.5">{transaction.destination_account.customer_name}</div>
              </div>
            </div>

            {/* Ground Truth Notice */}
            <div className="mt-4 pt-3 border-t border-[#f3f4f6] text-[11px] text-[#6b7280] flex items-center justify-between">
              <span>Ground-Truth Research Label:</span>
              <span className="font-medium text-[#111827]">
                {transaction.is_fraud_ground_truth === 1 ? 'Designated Synthetic Fraud (1)' : 'Legitimate Transaction (0)'}
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Triage Actions */}
        <div className="space-y-6">
          <div className="bg-white border border-[#e5e7eb] rounded-lg p-5">
            <h2 className="text-sm font-semibold text-[#111827]">Investigation Disposition</h2>
            <p className="text-xs text-[#6b7280] mt-0.5">Record compliance findings</p>

            <form onSubmit={handleUpdate} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-medium text-[#374151] block mb-1">Status Decision</label>
                <select
                  value={newStatus}
                  onChange={e => setNewStatus(e.target.value)}
                  className="w-full text-xs bg-[#f9fafb] border border-[#e5e7eb] rounded p-2 text-[#111827] focus:outline-none focus:border-[#4f46e5]"
                >
                  <option value="PENDING">PENDING (Under Review)</option>
                  <option value="REVIEWED">REVIEWED (Benign Checked)</option>
                  <option value="CONFIRMED_FRAUD">CONFIRMED_FRAUD (Actionable Fraud)</option>
                  <option value="FALSE_POSITIVE">FALSE_POSITIVE (Rule Misclassification)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-[#374151] block mb-1">Analyst Notes</label>
                <textarea
                  rows="4"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Document rationale, verification steps, or escalation findings..."
                  className="w-full text-xs bg-[#f9fafb] border border-[#e5e7eb] rounded p-2 text-[#111827] focus:outline-none focus:border-[#4f46e5]"
                />
              </div>

              {successMsg && (
                <div className="p-2.5 rounded bg-[#ecfdf5] border border-[#a7f3d0] text-xs text-[#065f46] flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              {updateError && (
                <div className="p-2.5 rounded bg-[#fef2f2] border border-[#fecaca] text-xs text-[#b91c1c]">
                  {updateError}
                </div>
              )}

              <button
                type="submit"
                disabled={updating}
                className="w-full py-2 bg-[#111827] hover:bg-[#1f2937] text-white text-xs font-medium rounded disabled:opacity-50 transition-colors"
              >
                {updating ? 'Saving Changes...' : 'Save Disposition'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
