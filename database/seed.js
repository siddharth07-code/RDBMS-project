const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

class LcgRng {
    constructor(seed = 123456789) {
        this.seed = seed >>> 0;
    }
    next() {
        this.seed = (Math.imul(1664525, this.seed) + 1013904223) >>> 0;
        return this.seed / 4294967296;
    }
    range(min, max) {
        return min + Math.floor(this.next() * (max - min + 1));
    }
    decimal(min, max, decimals = 2) {
        const val = min + this.next() * (max - min);
        return parseFloat(val.toFixed(decimals));
    }
    pick(arr) {
        return arr[this.range(0, arr.length - 1)];
    }
}

function runSql(sql) {
    const res = spawnSync('docker', [
        'exec',
        '-i',
        'fraudlens-mysql',
        'mysql',
        '-u',
        'fraudlens_user',
        '-pfraudlens_secure_pass_2026',
        'fraudlens_db'
    ], {
        input: sql,
        encoding: 'utf-8',
        maxBuffer: 50 * 1024 * 1024
    });
    if (res.status !== 0) {
        throw new Error(res.stderr || res.stdout);
    }
    return res.stdout;
}

function checkExisting() {
    const out = runSql("SELECT COUNT(*) AS c FROM customers;");
    const lines = out.trim().split('\n');
    const lastLine = lines[lines.length - 1].trim();
    const count = parseInt(lastLine, 10);
    return isNaN(count) ? 0 : count;
}

function escapeStr(s) {
    return s.replace(/'/g, "''");
}

function formatDate(d) {
    return d.toISOString().replace('T', ' ').substring(0, 19);
}

function main() {
    const existing = checkExisting();
    if (existing > 0) {
        console.log(`Database already contains ${existing} customers. Skipping generation to avoid duplicate data.`);
        return;
    }

    const rng = new LcgRng(42);

    const firstNames = ['James', 'Mary', 'Robert', 'Patricia', 'John', 'Jennifer', 'Michael', 'Linda', 'David', 'Elizabeth',
        'William', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica', 'Thomas', 'Sarah', 'Charles', 'Karen',
        'Christopher', 'Nancy', 'Daniel', 'Lisa', 'Matthew', 'Betty', 'Anthony', 'Margaret', 'Mark', 'Sandra',
        'Donald', 'Ashley', 'Steven', 'Kimberly', 'Paul', 'Emily', 'Andrew', 'Donna', 'Joshua', 'Michelle',
        'Kenneth', 'Carol', 'Kevin', 'Amanda', 'Brian', 'Dorothy', 'George', 'Melissa', 'Edward', 'Deborah'];

    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
        'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
        'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson',
        'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores'];

    const NUM_CUSTOMERS = 500;
    const NUM_ACCOUNTS = 800;
    const NUM_TRANSACTIONS = 10000;

    console.log(`Generating ${NUM_CUSTOMERS} customers...`);
    const customersSql = [];
    const baseCustDate = new Date('2026-08-01T00:00:00Z');

    for (let i = 1; i <= NUM_CUSTOMERS; i++) {
        const fn = rng.pick(firstNames);
        const ln = rng.pick(lastNames);
        const email = `user_${i}_${fn.toLowerCase()}.${ln.toLowerCase()}@example.org`;
        const phone = `+1-${String(rng.range(200, 999))}-${String(rng.range(100, 999))}-${String(i).padStart(4, '0')}`;
        const kycRoll = rng.next();
        const kyc = kycRoll < 0.85 ? 'VERIFIED' : (kycRoll < 0.95 ? 'PENDING' : 'REJECTED');
        const custDate = new Date(baseCustDate.getTime() + rng.range(0, 40) * 86400000);

        customersSql.push(`(${i}, '${escapeStr(fn)}', '${escapeStr(ln)}', '${email}', '${phone}', '${kyc}', '${formatDate(custDate)}')`);
    }

    runSql(`INSERT INTO customers (customer_id, first_name, last_name, email, phone_number, kyc_status, created_at) VALUES\n${customersSql.join(',\n')};`);

    console.log(`Generating ${NUM_ACCOUNTS} accounts...`);
    const accountsSql = [];
    const accountTypes = ['CHECKING', 'SAVINGS', 'BUSINESS'];

    for (let i = 1; i <= NUM_ACCOUNTS; i++) {
        const custId = i <= NUM_CUSTOMERS ? i : rng.range(1, NUM_CUSTOMERS);
        const accNum = `ACC${String(i).padStart(8, '0')}`;
        const typeRoll = rng.next();
        const accType = typeRoll < 0.60 ? 'CHECKING' : (typeRoll < 0.90 ? 'SAVINGS' : 'BUSINESS');
        const balance = rng.decimal(100.00, 75000.00, 2);
        const statusRoll = rng.next();
        const status = statusRoll < 0.94 ? 'ACTIVE' : (statusRoll < 0.98 ? 'FROZEN' : 'CLOSED');
        const accDate = new Date(baseCustDate.getTime() + rng.range(40, 60) * 86400000);

        accountsSql.push(`(${i}, '${accNum}', ${custId}, '${accType}', ${balance.toFixed(2)}, '${status}', '${formatDate(accDate)}')`);
    }

    runSql(`INSERT INTO accounts (account_id, account_number, customer_id, account_type, balance, status, created_at) VALUES\n${accountsSql.join(',\n')};`);

    console.log(`Generating ${NUM_TRANSACTIONS} transactions...`);
    const txStart = new Date('2026-10-01T00:00:00Z').getTime();
    const txTypes = ['TRANSFER', 'PAYMENT', 'WITHDRAWAL', 'DEPOSIT'];
    const transactions = [];

    let txCounter = 0;

    const numHighVal = 150;
    for (let k = 0; k < numHighVal; k++) {
        txCounter++;
        let src = rng.range(1, NUM_ACCOUNTS);
        let dst = rng.range(1, NUM_ACCOUNTS);
        while (dst === src) dst = rng.range(1, NUM_ACCOUNTS);

        const amt = rng.decimal(10050.00, 45000.00, 2);
        const ts = new Date(txStart + rng.range(0, 14 * 86400) * 1000);
        const isFraud = rng.next() < 0.70 ? 1 : 0;
        const status = rng.next() < 0.92 ? 'SUCCESS' : (isFraud ? 'FLAGGED' : 'FAILED');

        transactions.push({
            id: txCounter,
            ref: `TX-HV-${String(txCounter).padStart(8, '0')}`,
            src,
            dst,
            amt,
            type: rng.pick(txTypes),
            status,
            isFraud,
            ts
        });
    }

    const numBursts = 50;
    for (let b = 0; b < numBursts; b++) {
        const src = rng.range(1, NUM_ACCOUNTS);
        const burstSize = rng.range(4, 7);
        const burstStartTime = txStart + rng.range(0, 14 * 86400) * 1000;
        const isFraudBurst = rng.next() < 0.80 ? 1 : 0;

        for (let j = 0; j < burstSize; j++) {
            txCounter++;
            let dst = rng.range(1, NUM_ACCOUNTS);
            while (dst === src) dst = rng.range(1, NUM_ACCOUNTS);

            const amt = rng.decimal(150.00, 4500.00, 2);
            const ts = new Date(burstStartTime + (j * 45 * 1000) + rng.range(0, 15000));
            const status = rng.next() < 0.90 ? 'SUCCESS' : 'FLAGGED';

            transactions.push({
                id: txCounter,
                ref: `TX-RS-${String(txCounter).padStart(8, '0')}`,
                src,
                dst,
                amt,
                type: 'TRANSFER',
                status,
                isFraud: isFraudBurst,
                ts
            });
        }
    }

    const numRepeatPairs = 60;
    for (let p = 0; p < numRepeatPairs; p++) {
        const src = rng.range(1, NUM_ACCOUNTS);
        let dst = rng.range(1, NUM_ACCOUNTS);
        while (dst === src) dst = rng.range(1, NUM_ACCOUNTS);

        const pairSize = rng.range(3, 5);
        const pairStartTime = txStart + rng.range(0, 14 * 86400) * 1000;
        const isFraudPair = rng.next() < 0.75 ? 1 : 0;

        for (let j = 0; j < pairSize; j++) {
            txCounter++;
            const amt = rng.decimal(250.00, 3500.00, 2);
            const ts = new Date(pairStartTime + (j * 180 * 1000) + rng.range(0, 30000));
            const status = rng.next() < 0.92 ? 'SUCCESS' : 'FLAGGED';

            transactions.push({
                id: txCounter,
                ref: `TX-RP-${String(txCounter).padStart(8, '0')}`,
                src,
                dst,
                amt,
                type: 'TRANSFER',
                status,
                isFraud: isFraudPair,
                ts
            });
        }
    }

    while (txCounter < NUM_TRANSACTIONS) {
        txCounter++;
        let src = rng.range(1, NUM_ACCOUNTS);
        let dst = rng.range(1, NUM_ACCOUNTS);
        while (dst === src) dst = rng.range(1, NUM_ACCOUNTS);

        const amtRoll = rng.next();
        let amt;
        if (amtRoll < 0.75) {
            amt = rng.decimal(5.00, 600.00, 2);
        } else if (amtRoll < 0.95) {
            amt = rng.decimal(600.00, 3000.00, 2);
        } else {
            amt = rng.decimal(3000.00, 8500.00, 2);
        }

        const ts = new Date(txStart + rng.range(0, 14 * 86400) * 1000);
        const statRoll = rng.next();
        const status = statRoll < 0.93 ? 'SUCCESS' : (statRoll < 0.98 ? 'FAILED' : 'BLOCKED');
        const isFraud = rng.next() < 0.015 ? 1 : 0;

        transactions.push({
            id: txCounter,
            ref: `TX-STD-${String(txCounter).padStart(8, '0')}`,
            src,
            dst,
            amt,
            type: rng.pick(txTypes),
            status,
            isFraud,
            ts
        });
    }

    transactions.sort((a, b) => a.ts.getTime() - b.ts.getTime());

    const batchSize = 1000;
    for (let i = 0; i < transactions.length; i += batchSize) {
        const slice = transactions.slice(i, i + batchSize);
        const rows = slice.map(t =>
            `(${t.id}, '${t.ref}', ${t.src}, ${t.dst}, ${t.amt.toFixed(2)}, '${t.type}', '${t.status}', ${t.isFraud}, '${formatDate(t.ts)}')`
        );
        runSql(`INSERT INTO transactions (transaction_id, transaction_reference, source_account_id, destination_account_id, amount, transaction_type, status, is_fraud_ground_truth, transaction_timestamp) VALUES\n${rows.join(',\n')};`);
        console.log(`Inserted transactions ${i + 1} to ${i + slice.length}`);
    }

    console.log('Seeding completed successfully.');
}

main();
