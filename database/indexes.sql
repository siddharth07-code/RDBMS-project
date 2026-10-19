CREATE INDEX idx_tx_amount ON transactions(amount);

CREATE INDEX idx_tx_source_timestamp ON transactions(source_account_id, transaction_timestamp);

CREATE INDEX idx_tx_pair_timestamp ON transactions(source_account_id, destination_account_id, transaction_timestamp);

CREATE INDEX idx_tx_status_timestamp ON transactions(status, transaction_timestamp);

CREATE INDEX idx_alerts_status_risk ON fraud_alerts(status, risk_score);
