const API_BASE = '/api';

export async function fetchHealth() {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error('Health check failed');
  return res.json();
}

export async function fetchDashboardSummary() {
  const res = await fetch(`${API_BASE}/dashboard/summary`);
  if (!res.ok) throw new Error('Failed to fetch dashboard summary');
  return res.json();
}

export async function fetchTransactionTrends() {
  const res = await fetch(`${API_BASE}/dashboard/transaction-trends`);
  if (!res.ok) throw new Error('Failed to fetch transaction trends');
  return res.json();
}

export async function fetchAlertsByRule() {
  const res = await fetch(`${API_BASE}/dashboard/alerts-by-rule`);
  if (!res.ok) throw new Error('Failed to fetch alerts by rule');
  return res.json();
}

export async function fetchTransactions(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null && val !== '') {
      query.append(key, val);
    }
  });
  const res = await fetch(`${API_BASE}/transactions?${query.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch transactions');
  return res.json();
}

export async function fetchTransactionDetail(id) {
  const res = await fetch(`${API_BASE}/transactions/${id}`);
  if (!res.ok) throw new Error('Transaction not found');
  return res.json();
}

export async function fetchAlerts(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null && val !== '') {
      query.append(key, val);
    }
  });
  const res = await fetch(`${API_BASE}/alerts?${query.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch alerts');
  return res.json();
}

export async function fetchAlertDetail(id) {
  const res = await fetch(`${API_BASE}/alerts/${id}`);
  if (!res.ok) throw new Error('Alert not found');
  return res.json();
}

export async function updateAlertStatus(id, { status, investigation_notes }) {
  const res = await fetch(`${API_BASE}/alerts/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, investigation_notes })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to update alert status');
  return data;
}

export async function fetchFraudMetrics() {
  const res = await fetch(`${API_BASE}/research/fraud-metrics`);
  if (!res.ok) throw new Error('Failed to fetch fraud metrics');
  return res.json();
}

export async function fetchRulePerformance() {
  const res = await fetch(`${API_BASE}/research/rule-performance`);
  if (!res.ok) throw new Error('Failed to fetch rule performance');
  return res.json();
}
