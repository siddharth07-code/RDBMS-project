import React, { useEffect, useState } from 'react';
import { fetchFraudMetrics, fetchRulePerformance } from '../services/api';
import { ShieldCheck, AlertCircle, Info, BarChart2 } from 'lucide-react';

export default function Research() {
  const [metrics, setMetrics] = useState(null);
  const [rulePerf, setRulePerf] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([fetchFraudMetrics(), fetchRulePerformance()])
      .then(([mRes, rRes]) => {
        setMetrics(mRes);
        setRulePerf(rRes.rules || []);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-xs text-[#6b7280]">
        <div className="w-5 h-5 border-2 border-[#111827] border-t-transparent rounded-full animate-spin mb-2" />
        <span>Loading research performance data...</span>
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="p-4 bg-white border border-[#fee2e2] rounded text-xs text-[#b91c1c]">
        {error || 'Failed to load research metrics'}
      </div>
    );
  }

  const { confusion_matrix: cm, performance_metrics: pm } = metrics;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-[#111827] tracking-tight">Research Analytics</h1>
        <p className="text-xs text-[#6b7280] mt-1">
          Empirical evaluation of deterministic relational detection rules against synthetic ground-truth labels.
        </p>
      </div>

      {/* Notice Banner */}
      <div className="p-4 bg-white border border-[#e5e7eb] rounded-lg text-xs text-[#4b5563] flex items-start gap-2.5">
        <Info className="w-4 h-4 text-[#4f46e5] flex-shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-[#111827]">Academic Methodology Note:</span> Ground-truth labels (`is_fraud_ground_truth`) were generated via independent synthetic scenarios. Detection rules operate purely via SQL sliding-window queries without model training or machine learning.
        </div>
      </div>

      {/* Performance Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-[#e5e7eb] rounded-lg p-5">
          <span className="text-[10px] font-medium text-[#6b7280] uppercase tracking-wider">Precision (PPV)</span>
          <div className="text-3xl font-bold tracking-tight text-[#111827] mt-2 tabular-nums">
            {(pm.precision * 100).toFixed(2)}%
          </div>
          <span className="text-xs text-[#6b7280] mt-1 block">
            {cm.true_positives} true fraud of {cm.true_positives + cm.false_positives} flagged transactions
          </span>
        </div>

        <div className="bg-white border border-[#e5e7eb] rounded-lg p-5">
          <span className="text-[10px] font-medium text-[#6b7280] uppercase tracking-wider">Recall (Sensitivity)</span>
          <div className="text-3xl font-bold tracking-tight text-[#111827] mt-2 tabular-nums">
            {(pm.recall * 100).toFixed(2)}%
          </div>
          <span className="text-xs text-[#6b7280] mt-1 block">
            {cm.true_positives} detected of {cm.true_positives + cm.false_negatives} total ground-truth fraud
          </span>
        </div>

        <div className="bg-white border border-[#e5e7eb] rounded-lg p-5">
          <span className="text-[10px] font-medium text-[#6b7280] uppercase tracking-wider">Overall Accuracy</span>
          <div className="text-3xl font-bold tracking-tight text-[#111827] mt-2 tabular-nums">
            {(pm.accuracy * 100).toFixed(2)}%
          </div>
          <span className="text-xs text-[#6b7280] mt-1 block">
            Across {cm.total_transactions.toLocaleString()} transaction dataset
          </span>
        </div>
      </div>

      {/* Confusion Matrix Section */}
      <div className="bg-white border border-[#e5e7eb] rounded-lg p-6">
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-[#111827]">Transaction Confusion Matrix</h2>
          <p className="text-xs text-[#6b7280] mt-0.5">
            Classified at transaction level (N = {cm.total_transactions.toLocaleString()}). Multi-rule triggers count once.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-center text-xs border-collapse">
            <thead>
              <tr>
                <th className="p-3 border border-[#e5e7eb] bg-[#f9fafb] text-left font-medium text-[#6b7280]">
                  Actual / Predicted
                </th>
                <th className="p-3 border border-[#e5e7eb] bg-[#f9fafb] font-medium text-[#111827]">
                  Alert Generated (Predicted Fraud)
                </th>
                <th className="p-3 border border-[#e5e7eb] bg-[#f9fafb] font-medium text-[#111827]">
                  No Alert (Predicted Legitimate)
                </th>
                <th className="p-3 border border-[#e5e7eb] bg-[#f9fafb] font-medium text-[#6b7280]">
                  Total Actual
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="p-3 border border-[#e5e7eb] bg-[#f9fafb] font-semibold text-left text-[#111827]">
                  Ground Truth Fraud (1)
                </td>
                <td className="p-4 border border-[#e5e7eb] bg-[#ecfdf5]">
                  <div className="text-lg font-bold text-[#065f46] tabular-nums">{cm.true_positives}</div>
                  <span className="text-[10px] text-[#065f46] uppercase font-semibold">True Positive (TP)</span>
                  <div className="text-[10px] text-[#047857]">{((cm.true_positives / cm.total_transactions) * 100).toFixed(2)}%</div>
                </td>
                <td className="p-4 border border-[#e5e7eb] bg-[#fef2f2]">
                  <div className="text-lg font-bold text-[#991b1b] tabular-nums">{cm.false_negatives}</div>
                  <span className="text-[10px] text-[#991b1b] uppercase font-semibold">False Negative (FN)</span>
                  <div className="text-[10px] text-[#b91c1c]">{((cm.false_negatives / cm.total_transactions) * 100).toFixed(2)}%</div>
                </td>
                <td className="p-4 border border-[#e5e7eb] font-semibold text-[#111827] bg-[#f9fafb]">
                  {cm.true_positives + cm.false_negatives}
                </td>
              </tr>
              <tr>
                <td className="p-3 border border-[#e5e7eb] bg-[#f9fafb] font-semibold text-left text-[#111827]">
                  Ground Truth Legitimate (0)
                </td>
                <td className="p-4 border border-[#e5e7eb] bg-[#fffbeb]">
                  <div className="text-lg font-bold text-[#92400e] tabular-nums">{cm.false_positives}</div>
                  <span className="text-[10px] text-[#92400e] uppercase font-semibold">False Positive (FP)</span>
                  <div className="text-[10px] text-[#b45309]">{((cm.false_positives / cm.total_transactions) * 100).toFixed(2)}%</div>
                </td>
                <td className="p-4 border border-[#e5e7eb] bg-[#f9fafb]">
                  <div className="text-lg font-bold text-[#111827] tabular-nums">{cm.true_negatives}</div>
                  <span className="text-[10px] text-[#6b7280] uppercase font-semibold">True Negative (TN)</span>
                  <div className="text-[10px] text-[#6b7280]">{((cm.true_negatives / cm.total_transactions) * 100).toFixed(2)}%</div>
                </td>
                <td className="p-4 border border-[#e5e7eb] font-semibold text-[#111827] bg-[#f9fafb]">
                  {cm.false_positives + cm.true_negatives}
                </td>
              </tr>
              <tr className="bg-[#f9fafb] font-semibold">
                <td className="p-3 border border-[#e5e7eb] text-left text-[#6b7280]">Total Predicted</td>
                <td className="p-3 border border-[#e5e7eb] text-[#111827]">{cm.true_positives + cm.false_positives}</td>
                <td className="p-3 border border-[#e5e7eb] text-[#111827]">{cm.false_negatives + cm.true_negatives}</td>
                <td className="p-3 border border-[#e5e7eb] text-[#111827]">{cm.total_transactions}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Per-Rule Performance Breakdown */}
      <div className="bg-white border border-[#e5e7eb] rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-[#e5e7eb]">
          <h2 className="text-sm font-semibold text-[#111827]">Rule Performance & Specificity</h2>
          <p className="text-xs text-[#6b7280] mt-0.5">
            Analysis of individual SQL detection heuristics against ground-truth fraudulent transactions.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#f9fafb] text-[#6b7280] border-b border-[#e5e7eb]">
              <tr>
                <th className="px-5 py-2.5 font-medium">Rule Code</th>
                <th className="px-5 py-2.5 font-medium">Rule Name</th>
                <th className="px-5 py-2.5 font-medium">Severity</th>
                <th className="px-5 py-2.5 font-medium">Total Alerts</th>
                <th className="px-5 py-2.5 font-medium">Unique Tx Flagged</th>
                <th className="px-5 py-2.5 font-medium">True Positives</th>
                <th className="px-5 py-2.5 font-medium">False Positives</th>
                <th className="px-5 py-2.5 font-medium text-right">Precision</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f3f4f6]">
              {rulePerf.map(r => (
                <tr key={r.rule_id} className="hover:bg-[#f9fafb]">
                  <td className="px-5 py-3 font-mono text-[11px] text-[#4f46e5]">{r.rule_code}</td>
                  <td className="px-5 py-3 font-medium text-[#111827]">{r.rule_name}</td>
                  <td className="px-5 py-3 uppercase text-[10px] font-semibold text-[#6b7280]">{r.severity}</td>
                  <td className="px-5 py-3 tabular-nums text-[#111827]">{r.total_alerts}</td>
                  <td className="px-5 py-3 tabular-nums text-[#111827]">{r.unique_transactions_flagged}</td>
                  <td className="px-5 py-3 tabular-nums text-[#065f46] font-medium">{r.true_positive_transactions}</td>
                  <td className="px-5 py-3 tabular-nums text-[#b45309] font-medium">{r.false_positive_transactions}</td>
                  <td className="px-5 py-3 tabular-nums font-semibold text-right text-[#111827]">
                    {(r.precision * 100).toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
