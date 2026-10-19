# FraudLens: Entity-Relationship (ER) Diagram

This diagram represents the physical relational schema implemented in [database/schema.sql](file:///Users/siddharthlal/Desktop/fraudlens/database/schema.sql).

---

## Mermaid Entity-Relationship Diagram

```mermaid
erDiagram
    CUSTOMERS ||--o{ ACCOUNTS : "owns (1:N)"
    ACCOUNTS ||--o{ TRANSACTIONS : "sources (1:N)"
    ACCOUNTS ||--o{ TRANSACTIONS : "receives (1:N)"
    TRANSACTIONS ||--o{ FRAUD_ALERTS : "triggers (1:N)"
    FRAUD_RULES ||--o{ FRAUD_ALERTS : "defines (1:N)"

    CUSTOMERS {
        bigint customer_id PK
        varchar_50 first_name
        varchar_50 last_name
        varchar_100 email UK
        varchar_20 phone_number UK
        enum kyc_status
        timestamp created_at
    }

    ACCOUNTS {
        bigint account_id PK
        varchar_20 account_number UK
        bigint customer_id FK
        enum account_type
        decimal_15_2 balance
        enum status
        timestamp created_at
    }

    TRANSACTIONS {
        bigint transaction_id PK
        varchar_36 transaction_reference UK
        bigint source_account_id FK
        bigint destination_account_id FK
        decimal_15_2 amount
        enum transaction_type
        enum status
        tinyint_1 is_fraud_ground_truth
        timestamp transaction_timestamp
    }

    FRAUD_RULES {
        bigint rule_id PK
        varchar_30 rule_code UK
        varchar_100 rule_name
        varchar_255 description
        enum severity
        tinyint_1 is_active
        decimal_15_2 threshold_value
        int time_window_minutes
        timestamp created_at
    }

    FRAUD_ALERTS {
        bigint alert_id PK
        bigint transaction_id FK
        bigint rule_id FK
        decimal_5_2 risk_score
        enum status
        varchar_500 investigation_notes
        timestamp triggered_at
        timestamp resolved_at
    }
```

---

## Cardinalities and Referential Integrity

1. **`CUSTOMERS` to `ACCOUNTS` (1:N)**:
   - One customer can hold zero or more accounts.
   - Each account belongs to exactly one customer (`customer_id NOT NULL`).
   - Action: `ON UPDATE RESTRICT ON DELETE RESTRICT`.

2. **`ACCOUNTS` to `TRANSACTIONS` (1:N)**:
   - An account can be the source of zero or more transactions (`source_account_id`).
   - An account can be the destination of zero or more transactions (`destination_account_id`).
   - Constraint: `CHECK (source_account_id <> destination_account_id)`.
   - Action: `ON UPDATE RESTRICT ON DELETE RESTRICT`.

3. **`TRANSACTIONS` to `FRAUD_ALERTS` (1:N)**:
   - A transaction may trigger zero or multiple fraud alerts if it violates multiple distinct detection rules.
   - Each alert is tied to exactly one transaction.
   - Action: `ON UPDATE RESTRICT ON DELETE RESTRICT`.

4. **`FRAUD_RULES` to `FRAUD_ALERTS` (1:N)**:
   - A rule can trigger multiple alerts across transactions over time.
   - Each alert identifies the specific rule that generated it.
   - Action: `ON UPDATE RESTRICT ON DELETE RESTRICT`.
