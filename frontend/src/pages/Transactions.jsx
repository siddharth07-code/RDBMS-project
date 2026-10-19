import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchTransactions, fetchTransactionDetail } from '../services/api';
import { Search, ChevronLeft, ChevronRight, X, AlertCircle, ShieldAlert } from 'lucide-react';

export default function Transactions() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [transactions, setTransactions] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, total_pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedTxId, setSelectedTxId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const search = searchParams.get('search') || '';
  const status = searchParams.get('status') || '';
  const type = searchParams.get('type') || '';
  const groundTruth = searchParams.get('ground_truth') || '';
  const page = parseInt(searchParams.get('page'), 10) || 1;

  useEffect(() => {
    setLoading(true);
    fetchTransactions({
      page,
      limit: 20,
      search,
      status,
      transaction_type: type,
      is_fraud_ground_truth: groundTruth
    })
      .then(res => {
        setTransactions(res.data);
        setPagination(res.pagination);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [page, search, status, type, groundTruth]);

  const handleSelectTx = (id) => {
    setSelectedTxId(id);
    setDetailLoading(true);
    fetchTransactionDetail(id)
      .then(res => {
        setDetail(res);
        setDetailLoading(false);
      })
      .catch(() => setDetailLoading(false));
  };

  const updateFilter = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    next.set('page', '1');
    setSearchParams(next);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-[#111827] tracking-tight">Transactions</h1>
        <p className="text-xs text-[#6b7280] mt-1">
          Complete ledger of accounts, transfer amounts, statuses, and ground-truth research labels.
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-[#e5e7eb] rounded-lg p-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#9ca3af]" />
          <input
            type="text"
            placeholder="Search by reference (e.g. TX-HV...)"
            value={search}
            onChange={e => updateFilter('search', e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#f9fafb] border border-[#e5e7eb] rounded focus:outline-none focus:border-[#4f46e5]"
          />
        </div>

        <select
          value={status}
          onChange={e => updateFilter('status', e.target.value)}
          className="text-xs bg-[#f9fafb] border border-[#e5e7eb] rounded px-2.5 py-1.5 text-[#374151] focus:outline-none focus:border-[#4f46e5]"
        >
          <option value="">All Statuses</option>
          <option value="SUCCESS">Success</option>
          <option value="FAILED">Failed</option>
          <option value="BLOCKED">Blocked</option>
          <option value="FLAGGED">Flagged</option>
        </select>

        <select
          value={type}
          onChange={e => updateFilter('type', e.target.value)}
          className="text-xs bg-[#f9fafb] border border-[#e5e7eb] rounded px-2.5 py-1.5 text-[#374151] focus:outline-none focus:border-[#4f46e5]"
        >
          <option value="">All Types</option>
          <option value="TRANSFER">Transfer</option>
          <option value="PAYMENT">Payment</option>
          <option value="WITHDRAWAL">Withdrawal</option>
          <option value="DEPOSIT">Deposit</option>
        </select>

        <select
          value={groundTruth}
          onChange={e => updateFilter('ground_truth', e.target.value)}
          className="text-xs bg-[#f9fafb] border border-[#e5e7eb] rounded px-2.5 py-1.5 text-[#374151] focus:outline-none focus:border-[#4f46e5]"
        >
          <option value="">All Research Labels</option>
          <option value="1">Ground Truth: Fraud (1)</option>
          <option value="0">Ground Truth: Legitimate (0)</option>
        </select>
      </div>

      {/* Main Table */}
      <div className="bg-white border border-[#e5e7eb] rounded-lg overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-xs text-[#6b7280]">
            <div className="w-5 h-5 border-2 border-[#111827] border-t-transparent rounded-full animate-spin mb-2" />
            <span>Fetching ledger transactions...</span>
          </div>
        ) : error ? (
          <div className="p-6 text-center text-xs text-[#b91c1c]">{error}</div>
        ) : transactions.length === 0 ? (
          <div className="p-12 text-center text-xs text-[#6b7280]">No transactions match criteria.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#f9fafb] text-[#6b7280] border-b border-[#e5e7eb]">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Reference</th>
                  <th className="px-4 py-2.5 font-medium">Source Acc</th>
                  <th className="px-4 py-2.5 font-medium">Dest Acc</th>
                  <th className="px-4 py-2.5 font-medium">Type</th>
                  <th className="px-4 py-2.5 font-medium">Amount</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Ground Truth</th>
                  <th className="px-4 py-2.5 font-medium">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f3f4f6]">
                {transactions.map(tx => (
                  <tr 
                    key={tx.transaction_id}
                    onClick={() => handleSelectTx(tx.transaction_id)}
                    className="hover:bg-[#f9fafb] cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-[11px] text-[#4f46e5] font-medium">
                      {tx.transaction_reference}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-[#4b5563]">
                      {tx.source_account_number}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-[#4b5563]">
                      {tx.destination_account_number}
                    </td>
                    <td className="px-4 py-3 text-[#374151]">{tx.transaction_type}</td>
                    <td className="px-4 py-3 tabular-nums font-semibold text-[#111827]">
                      ${tx.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                        tx.status === 'SUCCESS' ? 'bg-[#ecfdf5] text-[#065f46]' :
                        tx.status === 'FLAGGED' ? 'bg-[#fffbeb] text-[#92400e]' :
                        tx.status === 'BLOCKED' ? 'bg-[#fef2f2] text-[#991b1b]' :
                        'bg-[#f3f4f6] text-[#374151]'
                      }`}>
                        {tx.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {tx.is_fraud_ground_truth === 1 ? (
                        <span className="text-[10px] text-[#b91c1c] font-medium bg-[#fef2f2] px-1.5 py-0.5 rounded">
                          Fraud (1)
                        </span>
                      ) : (
                        <span className="text-[10px] text-[#6b7280]">
                          Legit (0)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[#6b7280]">
                      {new Date(tx.transaction_timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        <div className="px-4 py-3 border-t border-[#e5e7eb] flex items-center justify-between text-xs text-[#6b7280]">
          <span>
            Showing page <span className="font-semibold text-[#111827]">{pagination.page}</span> of{' '}
            <span className="font-semibold text-[#111827]">{pagination.total_pages}</span> ({pagination.total.toLocaleString()} total)
          </span>
          <div className="flex items-center gap-2">
            <button
              disabled={pagination.page <= 1}
              onClick={() => updateFilter('page', String(pagination.page - 1))}
              className="p-1 rounded border border-[#e5e7eb] disabled:opacity-40 hover:bg-[#f9fafb]"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              disabled={pagination.page >= pagination.total_pages}
              onClick={() => updateFilter('page', String(pagination.page + 1))}
              className="p-1 rounded border border-[#e5e7eb] disabled:opacity-40 hover:bg-[#f9fafb]"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Slide-over Detail Drawer */}
      {selectedTxId && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="fixed inset-0 bg-black/20" onClick={() => setSelectedTxId(null)} />
          <div className="relative w-full max-w-md bg-white h-full shadow-lg border-l border-[#e5e7eb] p-6 overflow-y-auto z-10 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-[#e5e7eb]">
                <div>
                  <h2 className="text-sm font-semibold text-[#111827]">Transaction Details</h2>
                  <span className="text-xs font-mono text-[#6b7280]">{detail?.transaction_reference}</span>
                </div>
                <button 
                  onClick={() => setSelectedTxId(null)}
                  className="p-1 text-[#6b7280] hover:text-[#111827]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {detailLoading || !detail ? (
                <div className="py-20 text-center text-xs text-[#6b7280]">Loading details...</div>
              ) : (
                <div className="mt-6 space-y-6 text-xs">
                  {/* Financial Summary */}
                  <div className="bg-[#f9fafb] p-4 rounded border border-[#e5e7eb]">
                    <span className="text-[10px] uppercase font-semibold text-[#6b7280]">Transfer Amount</span>
                    <div className="text-2xl font-bold tracking-tight text-[#111827] mt-1 tabular-nums">
                      ${detail.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <span className="px-2 py-0.5 rounded bg-white border border-[#e5e7eb] text-[10px] font-medium">
                        {detail.status}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-white border border-[#e5e7eb] text-[10px] font-medium">
                        {detail.transaction_type}
                      </span>
                    </div>
                  </div>

                  {/* Parties */}
                  <div className="space-y-4">
                    <div className="border border-[#e5e7eb] rounded p-3">
                      <span className="text-[10px] uppercase font-semibold text-[#6b7280]">Source Account & Customer</span>
                      <div className="mt-1 font-mono font-medium text-[#111827]">{detail.source_account.account_number}</div>
                      <div className="text-xs text-[#4b5563] mt-0.5">
                        {detail.source_account.customer.first_name} {detail.source_account.customer.last_name}
                      </div>
                      <div className="text-[11px] text-[#6b7280]">{detail.source_account.customer.email}</div>
                    </div>

                    <div className="border border-[#e5e7eb] rounded p-3">
                      <span className="text-[10px] uppercase font-semibold text-[#6b7280]">Destination Account & Customer</span>
                      <div className="mt-1 font-mono font-medium text-[#111827]">{detail.destination_account.account_number}</div>
                      <div className="text-xs text-[#4b5563] mt-0.5">
                        {detail.destination_account.customer.first_name} {detail.destination_account.customer.last_name}
                      </div>
                      <div className="text-[11px] text-[#6b7280]">{detail.destination_account.customer.email}</div>
                    </div>
                  </div>

                  {/* Ground Truth vs Alerts */}
                  <div className="border border-[#e5e7eb] rounded p-3">
                    <span className="text-[10px] uppercase font-semibold text-[#6b7280]">Research Evaluation</span>
                    <div className="mt-2 flex items-center justify-between">
                      <span>Ground-Truth Fraud Label:</span>
                      <span className="font-semibold">{detail.is_fraud_ground_truth === 1 ? 'Yes (1)' : 'No (0)'}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span>Rules Triggered:</span>
                      <span className="font-semibold">{detail.associated_alerts.length}</span>
                    </div>

                    {detail.associated_alerts.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-[#f3f4f6] space-y-2">
                        {detail.associated_alerts.map(a => (
                          <div key={a.alert_id} className="text-[11px] flex items-center justify-between">
                            <span className="text-[#b91c1c] font-medium">{a.rule_name}</span>
                            <span className="text-[#6b7280]">Score: {a.risk_score}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-[#e5e7eb]">
              <button
                onClick={() => setSelectedTxId(null)}
                className="w-full py-1.5 text-xs font-medium bg-[#111827] text-white rounded hover:bg-[#1f2937]"
              >
                Close Panel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
