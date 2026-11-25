import crypto from "node:crypto";
import Stripe from "stripe";
import { requireDatabase } from "./db.js";
import { calculateNumerology } from "./calculation-service.js";
import { buildPentagonReading, buildSequenceReading, PRODUCT_PRICES } from "./reading-products.js";

const VALID_LOCALES = new Set(["en", "zh", "zh-TW", "zh-Hant", "zh-HK"]);

function httpError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function stripeClient() {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET || !process.env.APP_URL) {
    throw httpError("付款服務尚未設定，請確認 Stripe 金鑰及 APP_URL。", 503);
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

function cleanNumerologyResult(result) {
  const safe = structuredClone(result);
  delete safe.groups;
  delete safe.primary.split;
  delete safe.secondary.split;
  return safe;
}

export function buildReadingResult(service, input, locale) {
  if (!VALID_LOCALES.has(locale)) throw httpError("請選擇有效的解讀語言。", 400);
  if (service === "numerology") {
    const calculationLocale = locale === "zh-Hant" || locale === "zh-HK" ? "zh-TW" : locale;
    const result = calculateNumerology(input?.input, { locale: calculationLocale });
    return { service, locale, result: cleanNumerologyResult(result) };
  }
  if (service === "pentagon") return { locale, ...buildPentagonReading(input) };
  if (service === "sequence") return { locale, ...buildSequenceReading(input, locale) };
  throw httpError("請選擇有效的測算服務。", 400);
}

async function saveReading({ userId, service, locale, result, status, amount, paymentStatus }) {
  const db = requireDatabase();
  const readingId = crypto.randomUUID();
  const paymentId = crypto.randomUUID();
  const client = await db.connect();
  try {
    await client.query("begin");
    await client.query(
      "insert into readings (id, user_id, service, locale, status, result) values ($1, $2, $3, $4, $5, $6)",
      [readingId, userId, service, locale, status, result],
    );
    await client.query(
      `insert into payments (id, user_id, reading_id, amount, currency, product, status, paid_at)
       values ($1, $2, $3, $4, 'hkd', $5, $6, $7)`,
      [paymentId, userId, readingId, amount, service, paymentStatus, paymentStatus === "paid" ? new Date() : null],
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
  return { readingId, paymentId };
}

export async function createCheckout(request, response) {
  const db = requireDatabase();
  const service = request.body?.service;
  const price = PRODUCT_PRICES[service];
  if (!price) throw httpError("請選擇有效的測算服務。", 400);
  const locale = String(request.body?.locale ?? "zh-TW");
  const result = buildReadingResult(service, request.body?.input, locale);
  if (service === "pentagon" || service === "sequence") {
    const { readingId } = await saveReading({
      userId: request.user.id,
      service,
      locale,
      result,
      status: "paid",
      amount: price.amount,
      paymentStatus: "paid",
    });
    response.status(201).json({
      readingId,
      amount: price.amount,
      currency: "HKD",
      status: "paid",
      result,
    });
    return;
  }
  const stripe = stripeClient();
  const { readingId, paymentId } = await saveReading({
    userId: request.user.id,
    service,
    locale,
    result,
    status: "pending",
    amount: price.amount,
    paymentStatus: "pending",
  });

  try {
    const baseUrl = process.env.APP_URL.replace(/\/$/, "");
    const checkout = await stripe.checkout.sessions.create({
      mode: "payment",
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
      client_reference_id: request.user.id,
      customer_email: request.user.email || undefined,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: "hkd",
          unit_amount: price.amount,
          product_data: { name: `Vekai ${price.label}` },
        },
      }],
      metadata: { reading_id: readingId, payment_id: paymentId, user_id: request.user.id, service },
      success_url: `${baseUrl}/?checkout=success&readingId=${readingId}&session_id={CHECKOUT_SESSION_ID}#results`,
      cancel_url: `${baseUrl}/?checkout=cancel&readingId=${readingId}#${service}`,
    });
    await db.query("update payments set stripe_checkout_session_id = $1 where id = $2", [checkout.id, paymentId]);
    response.status(201).json({ checkoutUrl: checkout.url, readingId, amount: price.amount, currency: "HKD" });
  } catch (error) {
    await db.query("update payments set status = 'failed' where id = $1", [paymentId]);
    await db.query("update readings set status = 'failed', result = '{}'::jsonb where id = $1", [readingId]);
    throw error;
  }
}

export async function handleStripeWebhook(request, response) {
  const stripe = stripeClient();
  let event;
  try {
    event = stripe.webhooks.constructEvent(
      request.body,
      request.headers["stripe-signature"],
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch {
    throw httpError("付款通知驗證失敗。", 400);
  }

  const session = event.data?.object;
  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    if (session?.payment_status === "paid") {
      const db = requireDatabase();
      const client = await db.connect();
      try {
        await client.query("begin");
        const payment = await client.query(
          "select * from payments where stripe_checkout_session_id = $1 for update",
          [session.id],
        );
        const row = payment.rows[0];
        if (!row) throw httpError("付款紀錄尚未準備完成，請重新傳送通知。", 503);
        if (
          session.metadata?.payment_id !== row.id
          || session.metadata?.user_id !== row.user_id
          || session.amount_total !== row.amount
          || session.currency?.toLowerCase() !== row.currency
        ) {
          throw httpError("付款工作階段與付款紀錄不符。", 400);
        }
        if (row.status !== "paid") {
          await client.query(
            `update payments set status = 'paid', stripe_payment_intent_id = $1, paid_at = coalesce(paid_at, now())
             where id = $2 and status <> 'paid'`,
            [typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null, row.id],
          );
          await client.query("update readings set status = 'paid' where id = $1", [row.reading_id]);
        }
        await client.query("commit");
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
    }
  } else if (event.type === "checkout.session.expired" || event.type === "checkout.session.async_payment_failed") {
    await requireDatabase().query(
      `update payments set status = $1 where stripe_checkout_session_id = $2 and status = 'pending'`,
      [event.type === "checkout.session.expired" ? "expired" : "failed", session?.id],
    );
    await requireDatabase().query(
      `update readings set status = 'failed', result = '{}'::jsonb where id = (
        select reading_id from payments where stripe_checkout_session_id = $1
      ) and status = 'pending'`,
      [session?.id],
    );
  }
  response.json({ received: true });
}

export async function listReadings(request, response) {
  const result = await requireDatabase().query(
    `select id, service, locale, status, created_at from readings
     where user_id = $1 and status = 'paid' order by created_at desc limit 100`,
    [request.user.id],
  );
  response.json({ records: result.rows.map((row) => ({
    id: row.id,
    service: row.service,
    locale: row.locale,
    status: row.status,
    createdAt: row.created_at,
  })) });
}

export async function getReading(request, response) {
  const result = await requireDatabase().query(
    `select r.id, r.service, r.locale, r.status, r.result, r.created_at,
            p.amount, p.currency, p.status as payment_status
     from readings r join payments p on p.reading_id = r.id
     where r.id = $1 and r.user_id = $2`,
    [request.params.id, request.user.id],
  );
  const row = result.rows[0];
  if (!row) throw httpError("找不到解讀紀錄。", 404);
  response.json({
    record: {
      id: row.id,
      service: row.service,
      locale: row.locale,
      status: row.status,
      createdAt: row.created_at,
      amount: row.amount,
      currency: row.currency.toUpperCase(),
      result: row.status === "paid" ? row.result : null,
    },
  });
}

export async function listTransactions(request, response) {
  const result = await requireDatabase().query(
    `select p.id, p.reading_id, r.service, p.amount, p.currency, p.status, p.created_at, p.paid_at
     from payments p join readings r on r.id = p.reading_id
     where p.user_id = $1 order by p.created_at desc limit 100`,
    [request.user.id],
  );
  response.json({ records: result.rows.map((row) => ({
    id: row.id,
    readingId: row.reading_id,
    service: row.service,
    amount: row.amount,
    currency: row.currency.toUpperCase(),
    status: row.status,
    createdAt: row.created_at,
    paidAt: row.paid_at,
  })) });
}
