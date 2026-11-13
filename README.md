# Vekai

Vekai brings the number-based calculation service and Vekai Cal together under one site. The number calculator appears first; the I Ching Cal ritual follows. Visitors can preview both locally. In production, each delivered result is a separate HKD 81 Stripe Checkout purchase and is saved to the signed-in account.

## Run locally

Requires Node.js 18 or newer.

```sh
npm install
cp .env.example .env
npm run dev
```

Open [http://localhost:4173](http://localhost:4173). The calculation previews work without a database. Account creation, cloud records, and checkout require a PostgreSQL `DATABASE_URL`, verification-provider credentials, and Stripe credentials. Set `PAYWALL_ENABLED=true` only when Stripe is ready; production defaults to requiring checkout.

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

The database schema is applied on server startup. Configure a Stripe webhook at `https://<your-render-domain>/api/payments/stripe/webhook` for `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, and `checkout.session.expired`.

The current price is server-controlled at HKD 81 per result for either service. Stripe Checkout hosts card entry; Vekai never receives or stores card details. Do not put credentials in the repository or browser code.

## Accounts and records

Users may register with either a verified email address or an international mobile number (`+` country code) and password. Email codes use Resend; SMS codes use Twilio. Passwords are stored as scrypt hashes and browser sessions use HttpOnly, SameSite cookies. If provider credentials are absent, sign-up reports that verification is not configured.

Display name and gender identity are optional profile fields. Paid calculation results and associated transaction records are tied to the account and can be reopened from My Results. Number inputs are used to calculate the result but the original sequence is omitted from saved result data. The existing optional device-only encrypted I Ching archive remains available for local readings.

## 管理後台

將管理員已驗證的 Vekai 帳戶電郵加入 `ADMIN_EMAILS`（多個地址以逗號分隔），並設定 `GITHUB_CLIENT_ID`、`GITHUB_CLIENT_SECRET` 及 `APP_URL`。在 GitHub 建立 OAuth App，將 callback URL 設為 `<APP_URL>/api/auth/github/callback`。登入時必須使用 GitHub 已驗證的主要電郵，並與管理員名單及已驗證的 Vekai 帳戶相符；否則不會建立登入工作階段。網站頁首的「管理後台登入」會開啟 GitHub 授權。儀表板只提供營運統計及近期帳戶、付款、解讀清單，不提供修改或刪除操作，也不傳回解讀內容。

## Services and languages

網站介面與新解讀目前僅提供繁體中文。舊版多語系解讀仍保留相容性；健康相關卦象內容僅供文化參考，並非醫療建議。

## Validation

```sh
npm test
npm run check
```
