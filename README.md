# Vekai

Vekai brings the number calculator and two login-backed readings together. Visitors can preview the number calculator locally. The HK$89 five-axis reading and the HK$390 twenty-number reading require a signed-in account. Without Stripe keys, those purchases are recorded as paid immediately in HKD.

## Run locally

Requires Node.js 22 or newer.

```sh
npm install
cp .env.example .env
npm run dev
```

Open [http://localhost:4173](http://localhost:4173). The number preview works immediately. Account creation uses a local SQLite file at `data/vekai.sqlite` when `DATABASE_URL` is empty, and applies its schema on startup. Outside production, sign-up marks the account verified when Resend or Twilio credentials are absent, so login works without those keys. Set `DATABASE_URL` to use PostgreSQL instead. Set `PAYWALL_ENABLED=true` only when Stripe is ready for the number calculator; the two paid readings do not call Stripe.

## Render deployment

Create a Render Web Service from this repository and a Render PostgreSQL database. Set the following on the web service:

- `NODE_ENV=production`
- `APP_URL=https://<your-render-domain>`
- `DATABASE_URL` from the Render PostgreSQL connection string
- `ADMIN_EMAILS` as a comma-separated allowlist of administrator account email addresses
- `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` from a GitHub OAuth App with callback URL `<APP_URL>/api/auth/github/callback`
- `PAYWALL_ENABLED=true`
- `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` from Stripe (test keys first)
- `RESEND_API_KEY` and `EMAIL_FROM` for email verification
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_FROM_NUMBER` for mobile verification

The database schema is applied on server startup. The five-axis reading is HK$89 and the twenty-number reading is HK$390; both are stored as paid transactions in HKD. The number calculator remains HK$81 per result when the paywall is enabled. Configure a Stripe webhook at `https://<your-render-domain>/api/payments/stripe/webhook` for `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, and `checkout.session.expired` if the number calculator uses Checkout.

Stripe Checkout hosts card entry for that calculator; Vekai never receives or stores card details. Do not put credentials in the repository or browser code.

## Accounts and records

Users may register with either an email address or an international mobile number (`+` country code) and password. When verification providers are configured, email codes use Resend and SMS codes use Twilio. Passwords are stored as scrypt hashes and browser sessions use HttpOnly, SameSite cookies.

Display name and gender identity are optional profile fields. Paid readings and transaction records (amount, HKD, product, status, timestamps, user id) are tied to the account and can be reopened from My Results. Number-calculator inputs are used to calculate the result but the original sequence is omitted from saved result data.

## 管理後台

將管理員已驗證的 Vekai 帳戶電郵加入 `ADMIN_EMAILS`（多個地址以逗號分隔），並設定 `GITHUB_CLIENT_ID`、`GITHUB_CLIENT_SECRET` 及 `APP_URL`。在 GitHub 建立 OAuth App，將 callback URL 設為 `<APP_URL>/api/auth/github/callback`。登入時必須使用 GitHub 已驗證的主要電郵，並與管理員名單及已驗證的 Vekai 帳戶相符；否則不會建立登入工作階段。網站頁首的「管理後台登入」會開啟 GitHub 授權。儀表板只提供營運統計及近期帳戶、付款、解讀清單，不提供修改或刪除操作，也不傳回解讀內容。

## Services and languages

網站介面與新解讀目前僅提供繁體中文。五軸解讀請選擇五個標籤並輸入五個數字，伺服器回傳 relationship、Luck/career、health、wealthy、general 五軸分數。二十數解讀輸入二十個數字，分數由同一套數字測算得出。

## Validation

```sh
npm test
npm run check
```
