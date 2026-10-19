SELECT 
    COUNT(*) AS total_transactions,
    COALESCE(SUM(amount), 0.00) AS total_monetary_volume,
    MIN(amount) AS min_amount,
    MAX(amount) AS max_amount,
    AVG(amount) AS avg_amount
FROM transactions;

SELECT 
    status,
    COUNT(*) AS transaction_count,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM transactions), 2) AS percentage
FROM transactions
GROUP BY status;

SELECT 
    is_fraud_ground_truth,
    COUNT(*) AS transaction_count,
    COALESCE(SUM(amount), 0.00) AS total_volume,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM transactions), 2) AS percentage
FROM transactions
GROUP BY is_fraud_ground_truth;

SELECT 
    r.rule_code,
    r.rule_name,
    r.severity,
    COUNT(a.alert_id) AS alert_count
FROM fraud_rules r
LEFT JOIN fraud_alerts a ON r.rule_id = a.rule_id
GROUP BY r.rule_id, r.rule_code, r.rule_name, r.severity
ORDER BY alert_count DESC;

SELECT 
    status,
    COUNT(*) AS alert_count,
    ROUND(AVG(risk_score), 2) AS avg_risk_score
FROM fraud_alerts
GROUP BY status;

SELECT 
    acc.account_id,
    acc.account_number,
    c.first_name,
    c.last_name,
    COUNT(a.alert_id) AS total_alerts,
    COUNT(DISTINCT a.rule_id) AS distinct_rules_triggered
FROM accounts acc
JOIN customers c ON acc.customer_id = c.customer_id
JOIN transactions t ON acc.account_id = t.source_account_id
JOIN fraud_alerts a ON t.transaction_id = a.transaction_id
GROUP BY acc.account_id, acc.account_number, c.first_name, c.last_name
HAVING COUNT(a.alert_id) > 1
ORDER BY total_alerts DESC
LIMIT 20;

SELECT 
    t.transaction_id,
    t.transaction_reference,
    t.amount,
    t.transaction_timestamp,
    COUNT(a.alert_id) AS rules_triggered_count,
    GROUP_CONCAT(r.rule_code ORDER BY r.rule_code SEPARATOR ', ') AS triggered_rules
FROM transactions t
JOIN fraud_alerts a ON t.transaction_id = a.transaction_id
JOIN fraud_rules r ON a.rule_id = r.rule_id
GROUP BY t.transaction_id, t.transaction_reference, t.amount, t.transaction_timestamp
HAVING COUNT(a.alert_id) > 1
ORDER BY rules_triggered_count DESC
LIMIT 20;

SELECT 
    t.is_fraud_ground_truth AS ground_truth,
    CASE WHEN a.transaction_id IS NOT NULL THEN 1 ELSE 0 END AS alert_generated,
    COUNT(DISTINCT t.transaction_id) AS transaction_count,
    ROUND(COUNT(DISTINCT t.transaction_id) * 100.0 / (SELECT COUNT(*) FROM transactions), 2) AS pct_of_total_transactions
FROM transactions t
LEFT JOIN fraud_alerts a ON t.transaction_id = a.transaction_id
GROUP BY t.is_fraud_ground_truth, CASE WHEN a.transaction_id IS NOT NULL THEN 1 ELSE 0 END;
