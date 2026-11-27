import crypto from "node:crypto";
import Stripe from "stripe";
import { resolveHexagrams } from "../src/core.js";
import { describeFocus, getInterpretationFocus } from "./focus.js";
import { getCategoryInterpretation, INTERPRETATION_CATEGORIES } from "./interpretations.js";
import { getHexagramDetails } from "./hexagram-details.js";
import { requireDatabase } from "./db.js";
import { calculateNumerology } from "./calculation-service.js";

const PRICE_HKD_MINOR = 8100;
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

function buildIChingResult(input, locale) {
  const lines = input?.lines;
  const question = String(input?.question ?? "").trim().slice(0, 240);
  const method = input?.method === "coins" ? "coins" : input?.method === "yarrow" ? "yarrow" : "";
  const language = input?.language === "zh-HK" ? "zh-HK" : input?.language === "zh-Hant" ? "zh-Hant" : "";
  const category = input?.category || "";
  if (!method || !language) throw httpError("請選擇有效的易經起卦方法及解讀語言。", 400);
  if (category && !INTERPRETATION_CATEGORIES.includes(category)) throw httpError("請選擇有效的解讀分類。", 400);
  let result;
  try {
    const { original, changed } = resolveHexagrams(lines);
    const focus = getInterpretationFocus(lines, original, changed);
    result = {
      service: "iching",
      locale,
      question,
      method,
      category,
      language,
      lines,
      original: {
        number: original.number,
        name: original.name,
        lower: original.lower.symbol,
        upper: original.upper.symbol,
        details: getHexagramDetails(original.number, language),
      },
      changed: {
        number: changed.number,
        name: changed.name,
        lower: changed.lower.symbol,
        upper: changed.upper.symbol,
        details: getHexagramDetails(changed.number, language),
      },
      guidance: describeFocus(focus, original, changed),
      categoryReading: category ? getCategoryInterpretation(original.number, category, language) : "",
    };
  } catch (error) {
    if (error instanceof TypeError || error instanceof RangeError) throw httpError("卦象資料格式不正確。", 400);
    throw error;
  }
  return result;
}

export function buildReadingResult(service, input, locale) {
  if (!VALID_LOCALES.has(locale)) throw httpError("請選擇有效的解讀語言。", 400);
  if (service === "numerology") {
    const calculationLocale = locale === "zh-Hant" || locale === "zh-HK" ? "zh-TW" : locale;
    const result = calculateNumerology(input?.input, { locale: calculationLocale });
    return { service, locale, result: cleanNumerologyResult(result) };
  }
  if (service === "iching") return buildIChingResult(input, locale);
  throw httpError("請選擇有效的測算服務。", 400);
}

export async function createCheckout(request, response) {
  const db = requireDatabase();
  const stripe = stripeClient();
  const service = request.body?.service;
  const locale = String(request.body?.locale ?? "zh-TW");
  const result = buildReadingResult(service, request.body?.input, locale);
  const readingId = crypto.randomUUID();
  const paymentId = crypto.randomUUID();
  const client = await db.connect();
  try {
    await client.query("begin");
    await client.query(
      "insert into readings (id, user_id, service, locale, status, result) values ($1, $2, $3, $4, 'pending', $5)",
      [readingId, request.user.id, service, locale, result],
    );
    await client.query(
      `insert into payments (id, user_id, reading_id, amount, currency, status)
       values ($1, $2, $3, $4, 'hkd', 'pending')`,
      [paymentId, request.user.id, readingId, PRICE_HKD_MINOR],
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }

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
          unit_amount: PRICE_HKD_MINOR,
          product_data: { name: `Vekai ${service === "iching" ? "Cal" : "Calculation"} reading` },
        },
      }],
      metadata: { reading_id: readingId, payment_id: paymentId, user_id: request.user.id, service },
      success_url: `${baseUrl}/?checkout=success&readingId=${readingId}&session_id={CHECKOUT_SESSION_ID}#results`,
      cancel_url: `${baseUrl}/?checkout=cancel&readingId=${readingId}#${service}`,
    });
    await db.query("update payments set stripe_checkout_session_id = $1 where id = $2", [checkout.id, paymentId]);
    response.status(201).json({ checkoutUrl: checkout.url, readingId, amount: PRICE_HKD_MINOR, currency: "HKD" });
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
