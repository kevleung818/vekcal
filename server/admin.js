import { requireDatabase } from "./db.js";

function httpError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export function isAdminEmail(email) {
  const allowedEmails = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  return Boolean(email && allowedEmails.includes(String(email).trim().toLowerCase()));
}

export function requireAdmin(request, _response, next) {
  if (!process.env.ADMIN_EMAILS?.trim()) {
    return next(httpError("管理後台尚未設定管理員名單，請在伺服器設定 ADMIN_EMAILS。", 503));
  }
  if (!isAdminEmail(request.user?.email)) return next(httpError("此帳戶沒有管理員權限。", 403));
  return next();
}

export async function getAdminDashboard(_request, response) {
  const db = requireDatabase();
  const [metrics, users, payments, readings] = await Promise.all([
    db.query(
      `select
         (select count(*)::int from users) as total_users,
         (select count(*)::int from readings) as total_readings,
         (select count(*)::int from readings where status = 'paid') as paid_readings,
         (select count(*)::int from payments where status = 'pending') as pending_payments,
         (select coalesce(sum(amount), 0)::bigint from payments where status = 'paid') as paid_amount`,
    ),
    db.query(
      `select id, display_name, email, phone, created_at
       from users order by created_at desc limit 10`,
    ),
    db.query(
      `select p.id, p.amount, p.currency, p.status, p.created_at, p.paid_at,
              u.display_name, u.email, u.phone, r.service
       from payments p
       join users u on u.id = p.user_id
       join readings r on r.id = p.reading_id
       order by p.created_at desc limit 10`,
    ),
    db.query(
      `select r.id, r.service, r.status, r.created_at,
              u.display_name, u.email, u.phone
       from readings r
       join users u on u.id = r.user_id
       order by r.created_at desc limit 10`,
    ),
  ]);
  const summary = metrics.rows[0];
  response.json({
    metrics: {
      totalUsers: Number(summary.total_users),
      totalReadings: Number(summary.total_readings),
      paidReadings: Number(summary.paid_readings),
      pendingPayments: Number(summary.pending_payments),
      paidAmount: Number(summary.paid_amount),
    },
    users: users.rows.map((row) => ({
      id: row.id,
      displayName: row.display_name,
      email: row.email,
      phone: row.phone,
      createdAt: row.created_at,
    })),
    payments: payments.rows.map((row) => ({
      id: row.id,
      amount: row.amount,
      currency: row.currency.toUpperCase(),
      status: row.status,
      service: row.service,
      displayName: row.display_name,
      email: row.email,
      phone: row.phone,
      createdAt: row.created_at,
      paidAt: row.paid_at,
    })),
    readings: readings.rows.map((row) => ({
      id: row.id,
      service: row.service,
      status: row.status,
      displayName: row.display_name,
      email: row.email,
      phone: row.phone,
      createdAt: row.created_at,
    })),
  });
}
