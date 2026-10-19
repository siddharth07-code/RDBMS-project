INSERT INTO fraud_rules (rule_code, rule_name, description, severity, is_active, threshold_value, time_window_minutes)
VALUES 
('RULE_HIGH_VAL', 'High-Value Transaction', 'Flags transactions exceeding configured amount threshold', 'HIGH', 1, 10000.00, NULL),
('RULE_RAPID_TX', 'Rapid Successive Transactions', 'Flags multiple outgoing transactions from same source account within short time window', 'CRITICAL', 1, 3.00, 5),
('RULE_REPEAT_TRANSFER', 'Repeated Transfers Between Same Accounts', 'Flags multiple successive transfers between identical source and destination accounts within short time window', 'MEDIUM', 1, 2.00, 15)
ON DUPLICATE KEY UPDATE 
    rule_name = VALUES(rule_name),
    description = VALUES(description),
    severity = VALUES(severity),
    is_active = VALUES(is_active),
    threshold_value = VALUES(threshold_value),
    time_window_minutes = VALUES(time_window_minutes);
