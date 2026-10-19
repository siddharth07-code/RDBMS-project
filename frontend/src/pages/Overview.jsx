import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  fetchDashboardSummary, 
  fetchTransactionTrends, 
  fetchAlertsByRule, 
  fetchAlerts 
} from '../services/api';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid 
} from 'recharts';
import { ArrowUpRight, ShieldCheck, AlertCircle } from 'lucide-react';

export default function Overview() {
  const [summary, setSummary] = useState(null);
  const [trends, setTrends] = useState([]);
  const [rules, setRules] = useState([]);
  const [recentAlerts, setRecentAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([
      fetchDashboardSummary(),
      fetchTransactionTrends(),
      fetchAlertsByRule(),
      fetchAlerts({ limit: 5, status: 'PENDING' })
    ])
      .then(([sumRes, trendsRes, rulesRes, alertsRes]) => {
        setSummary(sumRes);
        setTrends(trendsRes.trends || []);
        setRules(rulesRes.rules || []);
        setRecentAlerts(alertsRes.data || []);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-sm text-[#6b7280]">
        <div className="w-5 h-5 border-2 border-[#111827] border-t-transparent rounded-full animate-spin mb-3" />
        <span>Loading operational metrics...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-white border border-[#fee2e2] rounded-lg text-sm text-[#b91c1c] flex items-center gap-2">
        <AlertCircle className="w-4 h-4 flex-shrink-0" />
        <span>Failed to load overview data: {error}</span>
      </div>
    );
  }

  const { transactions, alerts } = summary;

  return (
    <div className="space-y-8">
      {/* Top Section */}
      <div>
        <h1 className="text-xl font-semibold text-[#111827] tracking-tight">Overview</h1>
        <p className="text-xs text-[#6b7280] mt-1">
          High-level operational health, transactional volume, and compliance review queues.
        </p>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#e5e7eb] rounded-lg p-5">
          <span className="text-xs font-medium text-[#6b7280] uppercase tracking-wider">Total Volume</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-semibold tracking-tight tabular-nums">
              ${transactions.total_volume.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <span className="text-xs text-[#6b7280] mt-1 block">
            Across {transactions.total_count.toLocaleString()} ledger entries
          </span>
        </div>

        <div className="bg-white border border-[#e5e7eb] rounded-lg p-5">
          <span className="text-xs font-medium text-[#6b7280] uppercase tracking-wider">Total Transactions</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-semibold tracking-tight tabular-nums">
              {transactions.total_count.toLocaleString()}
            </span>
            <span className="text-xs text-[#10b981] font-medium bg-[#ecfdf5] px-2 py-0.5 rounded">
              {((transactions.by_status.success / transactions.total_count) * 100).toFixed(1)}% success
            </span>
          </div>
          <span className="text-xs text-[#6b7280] mt-1 block">
            {transactions.by_status.failed} failed, {transactions.by_status.blocked} blocked
          </span>
        </div>

        <div className="bg-white border border-[#e5e7eb] rounded-lg p-5">
          <span className="text-xs font-medium text-[#6b7280] uppercase tracking-wider">Pending Alerts</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-semibold tracking-tight text-[#b45309] tabular-nums">
              {alerts.pending_investigation}
            </span>
            <span className="text-xs text-[#b45309] bg-[#fffbeb] px-2 py-0.5 rounded font-medium">
              Queue
            </span>
          </div>
          <span className="text-xs text-[#6b7280] mt-1 block">
            {alerts.total_alerts} total triggered by SQL rules
          </span>
        </div>

        <div className="bg-white border border-[#e5e7eb] rounded-lg p-5">
          <span className="text-xs font-medium text-[#6b7280] uppercase tracking-wider">Ground-Truth Cases</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-semibold tracking-tight tabular-nums">
              {transactions.ground_truth_fraud_count}
            </span>
            <span className="text-xs text-[#6b7280] bg-[#f3f4f6] px-2 py-0.5 rounded font-medium">
              Research Label
            </span>
          </div>
          <span className="text-xs text-[#6b7280] mt-1 block">
            Independent research benchmark label
          </span>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Transaction Volume Over Time */}
        <div className="lg:col-span-2 bg-white border border-[#e5e7eb] rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-[#111827]">Daily Transaction Volume</h2>
              <p className="text-xs text-[#6b7280] mt-0.5">Aggregated daily dollar volume over time</p>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trends} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="volumeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis 
                  dataKey="date" 
                  tickLine={false} 
                  axisLine={{ stroke: '#e5e7eb' }} 
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  tickFormatter={val => val ? val.slice(5) : ''}
                />
                <YAxis 
                  tickLine={false} 
                  axisLine={false} 
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  tickFormatter={val => `$${(val / 1000).toFixed(0)}k`}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e5e7eb', fontSize: '12px', borderRadius: '6px' }}
                  formatter={(val) => [`$${Number(val).toLocaleString()}`, 'Volume']}
                />
                <Area 
                  type="monotone" 
                  dataKey="total_amount" 
                  stroke="#4f46e5" 
                  strokeWidth={1.5} 
                  fillOpacity={1} 
                  fill="url(#volumeGrad)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Rule Breakdown */}
        <div className="bg-white border border-[#e5e7eb] rounded-lg p-5 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[#111827]">Alerts by Rule</h2>
            <p className="text-xs text-[#6b7280] mt-0.5">Detection rule activity and risk evaluation</p>
            <div className="mt-5 space-y-4">
              {rules.map(rule => (
                <div key={rule.rule_id} className="border-b border-[#f3f4f6] pb-3 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-[#111827]">{rule.rule_name}</span>
                    <span className="font-semibold tabular-nums text-[#111827]">{rule.alert_count}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-[#6b7280] mt-1">
                    <span>Severity: <span className="uppercase font-medium text-[#4b5563]">{rule.severity}</span></span>
                    <span>Avg Score: <span className="tabular-nums font-medium text-[#4b5563]">{rule.avg_risk_score}</span></span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="pt-4 border-t border-[#f3f4f6] mt-4">
            <Link to="/alerts" className="text-xs font-medium text-[#4f46e5] hover:text-[#4338ca] flex items-center justify-between">
              <span>View all active alerts</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Recent Alerts Table */}
      <div className="bg-white border border-[#e5e7eb] rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-[#e5e7eb] flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[#111827]">Recent Pending Alerts</h2>
            <p className="text-xs text-[#6b7280] mt-0.5">High-priority items awaiting compliance review</p>
          </div>
          <Link to="/alerts" className="text-xs font-medium text-[#4f46e5] hover:text-[#4338ca] flex items-center gap-1">
            <span>Alerts queue</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {recentAlerts.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#6b7280]">
            No pending alerts requiring investigation.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#f9fafb] text-[#6b7280] border-b border-[#e5e7eb]">
                <tr>
                  <th className="px-5 py-2.5 font-medium">Ref</th>
                  <th className="px-5 py-2.5 font-medium">Rule</th>
                  <th className="px-5 py-2.5 font-medium">Risk Score</th>
                  <th className="px-5 py-2.5 font-medium">Amount</th>
                  <th className="px-5 py-2.5 font-medium">Triggered</th>
                  <th className="px-5 py-2.5 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f3f4f6]">
                {recentAlerts.map(alert => (
                  <tr key={alert.alert_id} className="hover:bg-[#f9fafb] transition-colors">
                    <td className="px-5 py-3 font-mono text-[11px] text-[#111827]">
                      {alert.transaction_reference}
                    </td>
                    <td className="px-5 py-3 text-[#111827]">{alert.rule_name}</td>
                    <td className="px-5 py-3 tabular-nums font-semibold text-[#111827]">
                      {alert.risk_score}
                    </td>
                    <td className="px-5 py-3 tabular-nums text-[#111827]">
                      ${alert.transaction_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-5 py-3 text-[#6b7280]">
                      {new Date(alert.triggered_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link 
                        to={`/alerts/${alert.alert_id}`}
                        className="text-xs font-medium text-[#4f46e5] hover:text-[#4338ca]"
                      >
                        Investigate
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
