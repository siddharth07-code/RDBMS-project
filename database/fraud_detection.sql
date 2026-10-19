INSERT INTO fraud_alerts (transaction_id, rule_id, risk_score, status, investigation_notes, triggered_at)
SELECT 
    t.transaction_id,
    r.rule_id,
    80.00,
    'PENDING',
    CONCAT('High-value transaction detected: amount $', t.amount, ' exceeds threshold $', r.threshold_value),
    CURRENT_TIMESTAMP
FROM transactions t
JOIN fraud_rules r ON r.rule_code = 'RULE_HIGH_VAL' AND r.is_active = 1
WHERE t.status IN ('SUCCESS', 'FLAGGED')
  AND t.amount > r.threshold_value
ON DUPLICATE KEY UPDATE 
    risk_score = VALUES(risk_score);

INSERT INTO fraud_alerts (transaction_id, rule_id, risk_score, status, investigation_notes, triggered_at)
SELECT 
    t1.transaction_id,
    r.rule_id,
    95.00,
    'PENDING',
    CONCAT('Rapid successive transactions: ', COUNT(t2.transaction_id), ' transactions within ', r.time_window_minutes, ' minutes'),
    CURRENT_TIMESTAMP
FROM transactions t1
JOIN fraud_rules r ON r.rule_code = 'RULE_RAPID_TX' AND r.is_active = 1
JOIN transactions t2 
  ON t1.source_account_id = t2.source_account_id
 AND t2.status IN ('SUCCESS', 'FLAGGED')
 AND t2.transaction_timestamp <= t1.transaction_timestamp
 AND t2.transaction_timestamp >= t1.transaction_timestamp - INTERVAL r.time_window_minutes MINUTE
WHERE t1.status IN ('SUCCESS', 'FLAGGED')
GROUP BY t1.transaction_id, r.rule_id, r.threshold_value, r.time_window_minutes
HAVING COUNT(t2.transaction_id) >= r.threshold_value
ON DUPLICATE KEY UPDATE 
    risk_score = VALUES(risk_score);

INSERT INTO fraud_alerts (transaction_id, rule_id, risk_score, status, investigation_notes, triggered_at)
SELECT 
    t1.transaction_id,
    r.rule_id,
    70.00,
    'PENDING',
    CONCAT('Repeated transfers: ', COUNT(t2.transaction_id), ' transfers between same accounts within ', r.time_window_minutes, ' minutes'),
    CURRENT_TIMESTAMP
FROM transactions t1
JOIN fraud_rules r ON r.rule_code = 'RULE_REPEAT_TRANSFER' AND r.is_active = 1
JOIN transactions t2 
  ON t1.source_account_id = t2.source_account_id
 AND t1.destination_account_id = t2.destination_account_id
 AND t2.status IN ('SUCCESS', 'FLAGGED')
 AND t2.transaction_timestamp <= t1.transaction_timestamp
 AND t2.transaction_timestamp >= t1.transaction_timestamp - INTERVAL r.time_window_minutes MINUTE
WHERE t1.status IN ('SUCCESS', 'FLAGGED')
GROUP BY t1.transaction_id, r.rule_id, r.threshold_value, r.time_window_minutes
HAVING COUNT(t2.transaction_id) >= r.threshold_value
ON DUPLICATE KEY UPDATE 
    risk_score = VALUES(risk_score);
