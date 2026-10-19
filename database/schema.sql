CREATE TABLE customers (
    customer_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    phone_number VARCHAR(20) NOT NULL UNIQUE,
    kyc_status ENUM('PENDING', 'VERIFIED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE accounts (
    account_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    account_number VARCHAR(20) NOT NULL UNIQUE,
    customer_id BIGINT NOT NULL,
    account_type ENUM('CHECKING', 'SAVINGS', 'BUSINESS') NOT NULL,
    balance DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    status ENUM('ACTIVE', 'FROZEN', 'CLOSED') NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_accounts_customer FOREIGN KEY (customer_id) 
        REFERENCES customers(customer_id) 
        ON UPDATE RESTRICT 
        ON DELETE RESTRICT,
    CONSTRAINT chk_accounts_balance CHECK (balance >= 0.00)
) ENGINE=InnoDB;

CREATE TABLE transactions (
    transaction_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    transaction_reference VARCHAR(36) NOT NULL UNIQUE,
    source_account_id BIGINT NOT NULL,
    destination_account_id BIGINT NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    transaction_type ENUM('TRANSFER', 'PAYMENT', 'WITHDRAWAL', 'DEPOSIT') NOT NULL,
    status ENUM('SUCCESS', 'FAILED', 'FLAGGED', 'BLOCKED') NOT NULL DEFAULT 'SUCCESS',
    is_fraud_ground_truth TINYINT(1) NOT NULL DEFAULT 0,
    transaction_timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_tx_source_account FOREIGN KEY (source_account_id) 
        REFERENCES accounts(account_id) 
        ON UPDATE RESTRICT 
        ON DELETE RESTRICT,
    CONSTRAINT fk_tx_destination_account FOREIGN KEY (destination_account_id) 
        REFERENCES accounts(account_id) 
        ON UPDATE RESTRICT 
        ON DELETE RESTRICT,
    CONSTRAINT chk_tx_amount_positive CHECK (amount > 0.00),
    CONSTRAINT chk_tx_distinct_accounts CHECK (source_account_id <> destination_account_id),
    CONSTRAINT chk_tx_ground_truth_bool CHECK (is_fraud_ground_truth IN (0, 1))
) ENGINE=InnoDB;

CREATE TABLE fraud_rules (
    rule_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    rule_code VARCHAR(30) NOT NULL UNIQUE,
    rule_name VARCHAR(100) NOT NULL,
    description VARCHAR(255) NOT NULL,
    severity ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL DEFAULT 'MEDIUM',
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    threshold_value DECIMAL(15, 2) NULL,
    time_window_minutes INT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_rules_active_bool CHECK (is_active IN (0, 1)),
    CONSTRAINT chk_rules_window_positive CHECK (time_window_minutes IS NULL OR time_window_minutes > 0),
    CONSTRAINT chk_rules_threshold_positive CHECK (threshold_value IS NULL OR threshold_value > 0.00)
) ENGINE=InnoDB;

CREATE TABLE fraud_alerts (
    alert_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    transaction_id BIGINT NOT NULL,
    rule_id BIGINT NOT NULL,
    risk_score DECIMAL(5, 2) NOT NULL,
    status ENUM('PENDING', 'REVIEWED', 'CONFIRMED_FRAUD', 'FALSE_POSITIVE') NOT NULL DEFAULT 'PENDING',
    investigation_notes VARCHAR(500) NULL,
    triggered_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP NULL,
    CONSTRAINT fk_alerts_transaction FOREIGN KEY (transaction_id) 
        REFERENCES transactions(transaction_id) 
        ON UPDATE RESTRICT 
        ON DELETE RESTRICT,
    CONSTRAINT fk_alerts_rule FOREIGN KEY (rule_id) 
        REFERENCES fraud_rules(rule_id) 
        ON UPDATE RESTRICT 
        ON DELETE RESTRICT,
    CONSTRAINT uq_alerts_tx_rule UNIQUE (transaction_id, rule_id),
    CONSTRAINT chk_alerts_risk_score CHECK (risk_score >= 0.00 AND risk_score <= 100.00)
) ENGINE=InnoDB;
