import "dotenv/config";
import express from "express";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { calculateNumerology } from "./server/calculation-service.js";
import { getAdminDashboard, requireAdmin } from "./server/admin.js";
import {
  getReading,
  handleStripeWebhook,
  listReadings,
  listTransactions,
  createCheckout,
} from "./server/payments.js";
import {
  login,
  logout,
  finishGithubAdminLogin,
  optionalUser,
  requireUser,
  resendVerification,
  signup,
  startGithubAdminLogin,
  updateProfile,
  verifyAccount,
} from "./server/auth.js";
import { initializeDatabase, pool } from "./server/db.js";

const app = express();
const root = resolve(fileURLToPath(new URL(".", import.meta.url)));
const port = Number(process.env.PORT ?? 4173);
const production = process.env.NODE_ENV === "production";

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use((_request, response, next) => {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (production) response.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  next();
});

function route(handler) {
  return (request, response, next) => Promise.resolve(handler(request, response)).catch(next);
}

app.get("/health", route(async (_request, response) => {
  if (pool) await pool.query("select 1");
  response.json({ status: "ok", database: pool ? "connected" : "not-configured" });
}));

app.use("/api", (_request, response, next) => {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Vary", "Cookie");
  next();
});

app.get("/api/config", (_request, response) => {
  const billingRequired = production && process.env.PAYWALL_ENABLED !== "false";
  response.json({
    billingRequired,
    checkoutAvailable: Boolean(pool && process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET && process.env.APP_URL),
    price: { amount: 81, currency: "HKD", perCalculation: true },
    products: [
      { id: "pentagon", name: "五軸解讀", amount: 89, currency: "HKD" },
      { id: "sequence", name: "二十數解讀", amount: 390, currency: "HKD" },
    ],
    supportedLocales: ["zh-TW"],
  });
});

app.post("/api/payments/stripe/webhook", express.raw({ type: "application/json", limit: "256kb" }), route(handleStripeWebhook));
app.use(express.json({ limit: "32kb", strict: true }));

app.post("/api/auth/signup", route(signup));
app.post("/api/auth/verify", route(verifyAccount));
app.post("/api/auth/resend-verification", route(resendVerification));
app.post("/api/auth/login", route(login));
app.post("/api/auth/logout", route(logout));
app.get("/api/auth/github", startGithubAdminLogin);
app.get("/api/auth/github/callback", route(finishGithubAdminLogin));
app.get("/api/me", optionalUser, (request, response) => response.json({ user: request.user }));
app.patch("/api/profile", requireUser, route(updateProfile));
app.post("/api/billing/checkout", requireUser, route(createCheckout));
app.get("/api/records", requireUser, route(listReadings));
app.get("/api/records/:id", requireUser, route(getReading));
app.get("/api/transactions", requireUser, route(listTransactions));
app.get("/api/admin/dashboard", requireUser, requireAdmin, route(getAdminDashboard));

app.post("/api/calculations", route(async (request, response) => {
  if (production && process.env.PAYWALL_ENABLED !== "false") {
    return response.status(402).json({ error: "請登入並完成付款，以取得測算結果。" });
  }
  const { input, locale = "zh-TW" } = request.body || {};
  const calculationLocale = locale === "zh-Hant" || locale === "zh-HK" ? "zh-TW" : locale;
  const result = calculateNumerology(input, { locale: calculationLocale });
  response.json({ locale, result });
}));

app.use("/api", (_request, response) => response.status(404).json({ error: "找不到此 API 端點。" }));
app.use("/src", express.static(resolve(root, "src"), { dotfiles: "deny" }));
app.get(["/styles.css", "/manifest.webmanifest", "/favicon.svg", "/service-worker.js"], (request, response, next) => {
  if (request.path === "/service-worker.js") response.setHeader("Cache-Control", "no-cache");
  response.sendFile(resolve(root, `.${request.path}`), (error) => {
    if (error) next(error);
  });
});
app.get(["/", "/index.html"], (_request, response) => response.sendFile(resolve(root, "index.html")));
app.get("*", (request, response, next) => {
  response.sendFile(resolve(root, "index.html"), (error) => {
    if (error) next(error);
  });
});

app.use((error, _request, response, _next) => {
  if (response.headersSent) return;
  const status = Number.isInteger(error.status) ? error.status : 500;
  if (status >= 500) console.error("Request failed:", error);
  response.status(status).json({
    error: status >= 500 && production ? "目前無法完成此操作，請稍後再試。" : error.message,
  });
});

await initializeDatabase();
const server = app.listen(port, "0.0.0.0", () => {
  console.log(`Vekai is ready on port ${port}`);
});

function shutdown() {
  server.close(async () => {
    await pool?.end();
    process.exit(0);
  });
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
