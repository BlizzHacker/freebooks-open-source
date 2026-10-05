# Alpha capability matrix — 0.1.0-alpha.1

Source and issue tracking: [freebooks-open-source](https://github.com/BlizzHacker/freebooks-open-source). Public alpha distribution supports evaluation; production readiness remains pending.

This describes code paths and prerequisites. It does not assert that an operator has configured every provider or that all external connections have been verified.

| Area | Available in the application | Operator requirements / limits |
| --- | --- | --- |
| Accounting | Double-entry records, contacts, purchases, invoices and reports inherited from the accounting engine | Complete organization setup; review ledger postings and balances |
| Source documents | Upload/store documents and associate them with financial review evidence | Storage/backup required; PDF extraction quality varies |
| CSV transactions | Import/review transaction files | Validate date, amount signs, account mapping and duplicate periods |
| Auto organization | Configurable household/business/employment labels and exception queues | New policy disabled until configured; labels are advisory |
| Multiple books | Organizations and branch assignments | Legal entities need their own books; a branch is not a separate legal entity |
| Plaid | Bank-feed integration code and provider authorization flow | Own approved production credentials, enabled products, institution coverage and redirects; sandbox is not live bank access |
| Stripe | Payment provider connection and checkout code | Own live platform/provider setup and webhook verification |
| Square / PayPal / Authorize.Net | Provider connection/payment code | Own credentials, supported account type, permissions and provider settings; no claim of universal verified sync |
| Crypto | Wallet/crypto-related application code | No universal exchange connector, custody system, mining deployment or autonomous trading service promised |
| Retailer receipts | Upload and import source evidence | No universal authenticated Walmart/Amazon/eBay receipt API connection included |
| Email receipts | Existing document/import workflows | No automatic access to another operator's Gmail account; consent and configuration required |
| Tax preparation | Evidence organization, accounting reports and export work | Not a complete tax filing engine or certified TurboTax replacement |
| Desktop | Server profile client and Docker-based local-server mode | Docker/Python required locally; target platform package testing/signing still required |

## Data integrity

Review large transactions, debt payments, refunds, transfers, split purchases and conflicting evidence. A confident merchant label does not prove business purpose or a tax deduction. Preserve the original files and account identifiers needed to trace every imported record.

## Alpha expectations

Keep primary financial originals and an independent backup. Compare opening/closing balances and sample transactions before trusting a new import. Connection failures must remain visible; a saved credential alone does not mean transactions were imported.
