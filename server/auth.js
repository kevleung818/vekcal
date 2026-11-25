import crypto from "node:crypto";
import { promisify } from "node:util";
import { pool, requireDatabase } from "./db.js";
import { isAdminEmail } from "./admin.js";

const scrypt = promisify(crypto.scrypt);
const SESSION_COOKIE = "vekai_session";
const GITHUB_STATE_COOKIE = "vekai_github_oauth_state";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const CODE_TTL_MS = 10 * 60 * 1000;
const GENDER_IDENTITIES = new Set([
  "woman",
  "man",
  "non-binary",
  "prefer-not-to-say",
]);

function httpError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function normalizeIdentifier(value) {
  const identifier = String(value ?? "").trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)) {
    return { type: "email", value: identifier.toLowerCase() };
  }
  if (/^\+[1-9]\d{7,14}$/.test(identifier)) {
    return { type: "phone", value: identifier };
  }
  throw httpError("請輸入有效的電子郵件或國際手機號碼（例如 +852...）。", 400);
}

function safeUser(row) {
  return {
    id: row.id,
    email: row.email,
    phone: row.phone,
    displayName: row.display_name,
    genderIdentity: row.gender_identity,
    createdAt: row.created_at,
  };
}

async function hashPassword(password) {
  if (typeof password !== "string" || password.length < 12 || password.length > 256) {
    throw httpError("密碼須介乎 12 至 256 個字元。", 400);
  }
  const salt = crypto.randomBytes(16);
  const derived = await scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `${salt.toString("hex")}:${derived.toString("hex")}`;
}

async function passwordMatches(password, storedHash) {
  const [saltHex, hashHex] = String(storedHash ?? "").split(":");
  if (!/^[\da-f]{32}$/i.test(saltHex) || !/^[\da-f]{128}$/i.test(hashHex)) return false;
  const derived = await scrypt(password, Buffer.from(saltHex, "hex"), 64, { N: 16384, r: 8, p: 1 });
  return crypto.timingSafeEqual(derived, Buffer.from(hashHex, "hex"));
}

function getCookie(request, name) {
  const cookie = request.headers.cookie?.split(";").map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : "";
}

function setSessionCookie(response, token, maxAge) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  response.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`,
  );
}

function setGithubStateCookie(response, state, maxAge) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  response.append(
    "Set-Cookie",
    `${GITHUB_STATE_COOKIE}=${encodeURIComponent(state)}; HttpOnly; SameSite=Lax; Path=/api/auth/github; Max-Age=${maxAge}${secure}`,
  );
}

function adminLoginRedirect(response, code) {
  const appUrl = new URL("/", process.env.APP_URL || "http://localhost:4173");
  appUrl.searchParams.set("adminLogin", code);
  appUrl.hash = "admin";
  response.redirect(303, appUrl.toString());
}

export function startGithubAdminLogin(_request, response) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId || !process.env.GITHUB_CLIENT_SECRET || !process.env.APP_URL) {
    return adminLoginRedirect(response, "not-configured");
  }
  if (!process.env.ADMIN_EMAILS?.trim()) return adminLoginRedirect(response, "not-configured");

  const state = crypto.randomBytes(32).toString("base64url");
  setGithubStateCookie(response, state, 600);
  const redirectUri = new URL("/api/auth/github/callback", process.env.APP_URL).toString();
  const authorizationUrl = new URL("https://github.com/login/oauth/authorize");
  authorizationUrl.searchParams.set("client_id", clientId);
  authorizationUrl.searchParams.set("redirect_uri", redirectUri);
  authorizationUrl.searchParams.set("scope", "read:user user:email");
  authorizationUrl.searchParams.set("state", state);
  return response.redirect(302, authorizationUrl.toString());
}

export async function finishGithubAdminLogin(request, response) {
  const cookieState = getCookie(request, GITHUB_STATE_COOKIE);
  setGithubStateCookie(response, "", 0);
  const requestState = String(request.query.state || "");
  if (
    !/^[\w-]{43}$/.test(requestState)
    || !cookieState
    || requestState.length !== cookieState.length
    || !crypto.timingSafeEqual(Buffer.from(requestState), Buffer.from(cookieState))
    || !request.query.code
  ) {
    return adminLoginRedirect(response, "invalid-state");
  }
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  const appUrl = process.env.APP_URL;
  if (!clientId || !clientSecret || !appUrl || !process.env.ADMIN_EMAILS?.trim()) {
    return adminLoginRedirect(response, "not-configured");
  }

  const redirectUri = new URL("/api/auth/github/callback", appUrl).toString();
  const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code: String(request.query.code),
      redirect_uri: redirectUri,
      state: requestState,
    }),
  });
  if (!tokenResponse.ok) return adminLoginRedirect(response, "github-error");
  const tokenPayload = await tokenResponse.json();
  if (typeof tokenPayload.access_token !== "string" || !tokenPayload.access_token) {
    return adminLoginRedirect(response, "github-error");
  }

  const emailResponse = await fetch("https://api.github.com/user/emails", {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${tokenPayload.access_token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "Vekai",
    },
  });
  if (!emailResponse.ok) return adminLoginRedirect(response, "github-error");
  const emails = await emailResponse.json();
  const primaryEmail = Array.isArray(emails)
    ? emails.find((entry) => entry.primary && entry.verified)?.email
    : null;
  const revokeResponse = await fetch(`https://api.github.com/applications/${encodeURIComponent(clientId)}/token`, {
    method: "DELETE",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "Vekai",
    },
    body: JSON.stringify({ access_token: tokenPayload.access_token }),
  });
  if (!revokeResponse.ok) return adminLoginRedirect(response, "github-error");
  if (typeof primaryEmail !== "string" || !primaryEmail.trim()) {
    return adminLoginRedirect(response, "email-unverified");
  }
  const email = primaryEmail.trim().toLowerCase();
  if (!isAdminEmail(email)) return adminLoginRedirect(response, "not-admin");

  const userResult = await requireDatabase().query(
    "select id from users where lower(email) = $1 and email_verified = true",
    [email],
  );
  const user = userResult.rows[0];
  if (!user) return adminLoginRedirect(response, "account-required");
  await createSession(user.id, response);
  const appRedirect = new URL("/", appUrl);
  appRedirect.hash = "admin";
  return response.redirect(303, appRedirect.toString());
}

async function createSession(userId, response) {
  const db = requireDatabase();
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.query(
    "insert into sessions (token_hash, user_id, expires_at) values ($1, $2, $3)",
    [crypto.createHash("sha256").update(token).digest("hex"), userId, expiresAt],
  );
  setSessionCookie(response, token, SESSION_TTL_MS / 1000);
}

async function sendCode(user, purpose) {
  const db = requireDatabase();
  const contactType = user.email ? "email" : "phone";
  const contact = user.email || user.phone;
  const recent = await db.query(
    "select created_at from verification_challenges where user_id = $1 and purpose = $2 order by created_at desc limit 1",
    [user.id, purpose],
  );
  if (recent.rows[0] && Date.now() - new Date(recent.rows[0].created_at).getTime() < 60_000) {
    throw httpError("請稍等一分鐘再要求驗證碼。", 429);
  }

  const code = String(crypto.randomInt(100000, 1000000));
  const challengeId = crypto.randomUUID();
  const codeHash = crypto.createHash("sha256").update(`${challengeId}:${code}`).digest("hex");
  await db.query(
    `insert into verification_challenges (id, user_id, purpose, code_hash, expires_at)
     values ($1, $2, $3, $4, $5)`,
    [challengeId, user.id, purpose, codeHash, new Date(Date.now() + CODE_TTL_MS)],
  );

  try {
    if (contactType === "email") await sendEmailCode(contact, code);
    else await sendSmsCode(contact, code);
  } catch (error) {
    await db.query("delete from verification_challenges where id = $1", [challengeId]);
    throw error;
  }
}

async function sendEmailCode(email, code) {
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
    throw httpError("電郵驗證尚未設定，請在部署環境設定 RESEND_API_KEY 及 EMAIL_FROM。", 503);
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: [email],
      subject: "Vekai 帳戶驗證碼",
      text: `Vekai 帳戶驗證碼：${code}。此驗證碼將於 10 分鐘後失效。`,
    }),
  });
  if (!response.ok) throw httpError("無法發送驗證電郵，請稍後再試。", 502);
}

async function sendSmsCode(phone, code) {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) {
    throw httpError("手機驗證尚未設定，請在部署環境設定 Twilio 憑證。", 503);
  }
  const body = new URLSearchParams({
    To: phone,
    From: TWILIO_FROM_NUMBER,
    Body: `Vekai 帳戶驗證碼：${code}。此驗證碼將於 10 分鐘後失效。`,
  });
  const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64");
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(TWILIO_ACCOUNT_SID)}/Messages.json`,
    { method: "POST", headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" }, body },
  );
  if (!response.ok) throw httpError("無法發送手機驗證碼，請稍後再試。", 502);
}

export async function requireUser(request, _response, next) {
  try {
    const token = getCookie(request, SESSION_COOKIE);
    if (!token) throw httpError("請先登入以繼續。", 401);
    request.user = await sessionUser(token);
    next();
  } catch (error) {
    next(error);
  }
}

export async function optionalUser(request, _response, next) {
  try {
    const token = getCookie(request, SESSION_COOKIE);
    request.user = token ? await sessionUser(token) : null;
    next();
  } catch (error) {
    next(error);
  }
}

async function sessionUser(token) {
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const result = await requireDatabase().query(
    `select u.* from sessions s join users u on u.id = s.user_id
     where s.token_hash = $1 and s.expires_at > now()`,
    [tokenHash],
  );
  if (!result.rows[0]) throw httpError("登入狀態已逾期，請重新登入。", 401);
  return safeUser(result.rows[0]);
}

export async function signup(request, response) {
  const db = requireDatabase();
  if (request.body?.consent !== "yes") {
    throw httpError("請確認同意 Vekai 保存帳戶資料、已付款的解讀結果及交易紀錄。", 400);
  }
  const identifier = normalizeIdentifier(request.body?.identifier);
  const displayName = String(request.body?.displayName ?? "").trim().slice(0, 80);
  const genderIdentity = request.body?.genderIdentity || null;
  if (genderIdentity && !GENDER_IDENTITIES.has(genderIdentity)) {
    throw httpError("請選擇有效的性別認同選項。", 400);
  }
  const passwordHash = await hashPassword(request.body?.password);
  const id = crypto.randomUUID();
  try {
    await db.query(
      `insert into users (id, email, phone, password_hash, display_name, gender_identity, privacy_consented_at)
       values ($1, $2, $3, $4, $5, $6, now())`,
      [id, identifier.type === "email" ? identifier.value : null, identifier.type === "phone" ? identifier.value : null, passwordHash, displayName, genderIdentity],
    );
  } catch (error) {
    if (error.code === "23505") throw httpError("此電子郵件或手機號碼已建立帳戶。", 409);
    throw error;
  }
  const user = { id, email: identifier.type === "email" ? identifier.value : null, phone: identifier.type === "phone" ? identifier.value : null };
  const providersReady = identifier.type === "email"
    ? Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM)
    : Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER);
  if (process.env.NODE_ENV !== "production" && !providersReady) {
    await db.query(
      "update users set email_verified = true, phone_verified = true where id = $1",
      [id],
    );
    await createSession(id, response);
    const stored = await db.query("select * from users where id = $1", [id]);
    response.status(201).json({ verificationRequired: false, user: safeUser(stored.rows[0]) });
    return;
  }
  await sendCode(user, "signup");
  response.status(201).json({ verificationRequired: true, message: "驗證碼已發送至你的帳戶聯絡方式。" });
}

export async function resendVerification(request, response) {
  const db = requireDatabase();
  const identifier = normalizeIdentifier(request.body?.identifier);
  const column = identifier.type === "email" ? "email" : "phone";
  const userResult = await db.query(`select * from users where ${column} = $1`, [identifier.value]);
  const user = userResult.rows[0];
  if (!user) throw httpError("找不到相符的帳戶。", 404);
  const verified = identifier.type === "email" ? user.email_verified : user.phone_verified;
  if (verified) throw httpError("此帳戶已完成驗證，請直接登入。", 409);
  await sendCode(user, "signup");
  response.json({ verificationRequired: true, message: "新的驗證碼已發送。" });
}

export async function verifyAccount(request, response) {
  const db = requireDatabase();
  const identifier = normalizeIdentifier(request.body?.identifier);
  const code = String(request.body?.code ?? "").trim();
  if (!/^\d{6}$/.test(code)) throw httpError("請輸入六位數驗證碼。", 400);
  const column = identifier.type === "email" ? "email" : "phone";
  const userResult = await db.query(`select * from users where ${column} = $1`, [identifier.value]);
  const user = userResult.rows[0];
  if (!user) throw httpError("驗證碼無效或已逾期。", 400);
  const challengeResult = await db.query(
    `select * from verification_challenges where user_id = $1 and purpose = 'signup'
     and expires_at > now() order by created_at desc limit 1`,
    [user.id],
  );
  const challenge = challengeResult.rows[0];
  if (!challenge || challenge.attempts >= 5) throw httpError("驗證碼無效或已逾期。", 400);
  const codeHash = crypto.createHash("sha256").update(`${challenge.id}:${code}`).digest("hex");
  if (!crypto.timingSafeEqual(Buffer.from(codeHash), Buffer.from(challenge.code_hash))) {
    await db.query("update verification_challenges set attempts = attempts + 1 where id = $1", [challenge.id]);
    throw httpError("驗證碼無效或已逾期。", 400);
  }
  await db.query(
    `update users set ${identifier.type === "email" ? "email_verified" : "phone_verified"} = true where id = $1`,
    [user.id],
  );
  await db.query("delete from verification_challenges where user_id = $1", [user.id]);
  await createSession(user.id, response);
  response.json({ user: safeUser({ ...user, [identifier.type === "email" ? "email_verified" : "phone_verified"]: true }) });
}

export async function login(request, response) {
  const db = requireDatabase();
  const identifier = normalizeIdentifier(request.body?.identifier);
  const column = identifier.type === "email" ? "email" : "phone";
  const result = await db.query(`select * from users where ${column} = $1`, [identifier.value]);
  const user = result.rows[0];
  const matches = await passwordMatches(String(request.body?.password ?? ""), user?.password_hash);
  if (!user || !matches) throw httpError("電子郵件、手機號碼或密碼不正確。", 401);
  const verified = identifier.type === "email" ? user.email_verified : user.phone_verified;
  if (!verified) {
    await sendCode(user, "signup");
    return response.status(403).json({ verificationRequired: true, message: "請先完成帳戶驗證，再登入。" });
  }
  await createSession(user.id, response);
  response.json({ user: safeUser(user) });
}

export async function logout(request, response) {
  const token = getCookie(request, SESSION_COOKIE);
  if (token && pool) {
    const hash = crypto.createHash("sha256").update(token).digest("hex");
    await pool.query("delete from sessions where token_hash = $1", [hash]);
  }
  setSessionCookie(response, "", 0);
  response.status(204).end();
}

export async function updateProfile(request, response) {
  const displayName = String(request.body?.displayName ?? "").trim().slice(0, 80);
  const genderIdentity = request.body?.genderIdentity || null;
  if (genderIdentity && !GENDER_IDENTITIES.has(genderIdentity)) {
    throw httpError("請選擇有效的性別認同選項。", 400);
  }
  const result = await requireDatabase().query(
    "update users set display_name = $1, gender_identity = $2 where id = $3 returning *",
    [displayName, genderIdentity, request.user.id],
  );
  response.json({ user: safeUser(result.rows[0]) });
}
