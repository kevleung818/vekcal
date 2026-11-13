const portal = document.querySelector("#portal");
const calApp = document.querySelector("#app");
const copy = {
  "zh-TW": {
    navNumber: "數字測算",
    navCal: "易經觀卦",
    navResults: "我的結果",
    navProfile: "個人資料",
    navTransactions: "交易紀錄",
    account: "登入 / 註冊",
    numberEyebrow: "VEKAI / 測算服務",
    numberTitle: "易經數典智鑑",
    numberMotto: "見微知著 . 啟迪睿智生活",
    numberDescription: "先進行數字測算，再向下體驗易經觀卦。",
    numberLabel: "數字序列",
    numberHelp: "輸入 8 至 64 位數字。帳戶結果不會保存完整數字。",
    calculate: "開始測算",
    reading: "測算中…",
    result: "測算結果",
    empty: "測算結果會顯示於此。",
    inputError: "請輸入 8 至 64 位數字。",
    buy: "前往安全付款 · HKD 81",
    login: "登入",
    setup: "建立帳戶",
    identifier: "電子郵件或手機號碼（含國碼）",
    password: "密碼（至少 12 個字元）",
    displayName: "顯示名稱（選填）",
    gender: "性別認同（選填）",
    choose: "不願透露",
    submit: "繼續",
    verify: "驗證帳戶",
    code: "六位數驗證碼",
    resend: "重新發送驗證碼",
    switchLogin: "已有帳戶？登入",
    switchSignup: "首次使用 Vekai？建立帳戶",
    profileSaved: "個人資料已儲存。",
    transactions: "付款紀錄",
    results: "已保存的結果",
    loading: "載入中…",
    noRows: "暫無紀錄。",
    serviceName: { numerology: "數字測算", iching: "易經觀卦" },
    language: "解讀語言",
    signinRequired: "請先登入或建立帳戶，再購買解讀。",
    privacyNote: "前往付款時，測算資料會送至 Vekai。付款成功後結果和交易紀錄會保存於帳戶；未完成的結果會在付款頁面逾期後清除。信用卡資料由 Stripe 處理。",
  },
};

const state = {
  theme: document.documentElement.dataset.theme || localStorage.getItem("vekai-cal-theme") || "night",
  user: null,
  authMode: "login",
  authIdentifier: "",
  awaitingVerification: false,
  pendingCalculation: null,
  notice: "",
  config: { billingRequired: false, checkoutAvailable: false },
  records: [],
};

const t = () => copy["zh-TW"];

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...options,
    headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.headers || {}) },
  });
  const payload = response.status === 204 ? {} : await response.json();
  if (!response.ok) {
    const error = new Error(payload.error || payload.message || `操作未能完成（${response.status}）。`);
    error.status = response.status;
    error.verificationRequired = payload.verificationRequired;
    throw error;
  }
  return payload;
}

function resultMarkup(payload) {
  const result = payload.result;
  const labels = { base: "本卦", outcome: "結果", love: "愛情運勢", finance: "財政狀況", career: "職業 / 學業", health: "健康狀態" };
  const cards = [
    ["主卦", labels.base, result.primary.base],
    ["主卦", labels.outcome, result.primary.result],
    ["副卦", labels.base, result.secondary.base],
    ["副卦", labels.outcome, result.secondary.result],
  ];
  return `<div class="number-result__summary"><p>${escapeHtml(result.summary)}</p><p>${escapeHtml(result.insight)}</p></div>
    <div class="number-result__grid">${cards.map(([set, kind, hexagram]) => {
      const reading = hexagram.reading || {};
      return `<article class="number-result-card"><span class="eyebrow">${escapeHtml(set)} / ${escapeHtml(kind)}</span>
        <h3>${escapeHtml(reading.name || hexagram.meaning?.[1] || `#${hexagram.number}`)}</h3>
        <p>${escapeHtml(reading.title || "")}</p>
        <dl><div><dt>${labels.love}</dt><dd>${escapeHtml(reading.love || "")}</dd></div>
        <div><dt>${labels.finance}</dt><dd>${escapeHtml(reading.finance || "")}</dd></div>
        <div><dt>${labels.career}</dt><dd>${escapeHtml(reading.career || "")}</dd></div>
        <div><dt>${labels.health}</dt><dd>${escapeHtml(reading.health || "")}</dd></div></dl></article>`;
    }).join("")}</div>`;
}

function renderNumberResult(payload) {
  const output = document.querySelector("#number-result");
  output.innerHTML = resultMarkup(payload);
  output.hidden = false;
  output.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderShell() {
  const text = t();
  const activeSection = location.hash === "#cal" || location.hash === "#iching" ? "cal" : "number";
  const themeIsNight = state.theme !== "day";
  portal.innerHTML = `<header class="portal-topbar">
    <a class="portal-brand" href="#home" aria-label="Vekai 首頁"><span class="brand-mark">V</span><span>VEKAI</span></a>
    <nav class="portal-app-switch" aria-label="Vekai 服務">
      <a href="#numerology" ${activeSection === "number" ? 'aria-current="page"' : ""}>${text.navNumber}</a>
      <a href="#cal" ${activeSection === "cal" ? 'aria-current="page"' : ""}>${text.navCal}</a>
    </nav>
    <div class="portal-controls">
      ${state.user ? `<nav class="portal-account-links" aria-label="帳戶功能">
        <a href="#profile">${text.navProfile}</a><a href="#transactions">${text.navTransactions}</a><a href="#results">${text.navResults}</a>
      </nav>` : `<a class="portal-account" href="#account">${text.account}</a>`}
      <a class="portal-admin-link" href="#admin">管理後台登入</a>
      <button class="theme-toggle portal-theme-toggle" type="button" data-action="toggle-theme"
        aria-label="切換至${themeIsNight ? "日間" : "夜間"}模式" aria-pressed="${!themeIsNight}">
        <span aria-hidden="true">${themeIsNight ? "☀" : "☾"}</span><span>${themeIsNight ? "日間" : "夜間"}</span>
      </button>
    </div>
  </header>
  ${state.notice ? `<p class="portal-notice" role="status">${escapeHtml(state.notice)}</p>` : ""}
  <main class="portal-main">
    <section class="number-product" id="number-product">
      <p class="eyebrow">${text.numberEyebrow}</p>
      <h1>${text.numberTitle}</h1>
      ${text.numberMotto ? `<p class="number-motto">${text.numberMotto}</p>` : ""}
      <p class="portal-lede">${text.numberDescription}</p>
      <div class="number-product__layout">
        <form class="portal-panel" id="number-form">
          <label class="field-label" for="number-input">${text.numberLabel}</label>
          <input id="number-input" name="input" type="text" inputmode="numeric" autocomplete="off" minlength="8" maxlength="64" required>
          <small>${text.numberHelp}</small>
          <button class="button button--primary" type="submit">${text.calculate}</button>
          <p class="portal-error" id="number-error" role="alert" hidden></p>
          <p class="portal-note">${text.privacyNote}</p>
        </form>
        <section class="portal-panel number-output" aria-live="polite">
          <h2>${text.result}</h2><p id="number-empty">${text.empty}</p>
          <div id="number-result" hidden></div>
        </section>
      </div>
      <a class="cal-followup" href="#cal"><span class="eyebrow">下一步 / 易經觀卦</span><strong>向下，繼續易經觀卦 ↘</strong></a>
    </section>
    <section id="portal-page" hidden></section>
  </main>`;
}

function renderAuth() {
  const text = t();
  const mode = state.awaitingVerification ? "verify" : state.authMode;
  const isSignup = mode === "signup";
  const identifier = state.authIdentifier;
  document.querySelector("#portal-page").innerHTML = `<section class="portal-page-card">
    <p class="eyebrow">VEKAI / ${mode === "verify" ? "帳戶驗證" : isSignup ? "建立帳戶" : "帳戶登入"}</p>
    <h1>${mode === "verify" ? text.verify : isSignup ? text.setup : text.login}</h1>
    <form id="auth-form" data-mode="${mode}">
      ${mode !== "verify" ? `<label class="field-label" for="auth-identifier">${text.identifier}</label>
        <input id="auth-identifier" name="identifier" type="text" autocomplete="username" value="${escapeHtml(identifier)}" required>
        <label class="field-label" for="auth-password">${text.password}</label>
        <input id="auth-password" name="password" type="password" autocomplete="${isSignup ? "new-password" : "current-password"}" minlength="12" maxlength="256" required>
        ${isSignup ? `<label class="field-label" for="auth-display-name">${text.displayName}</label><input id="auth-display-name" name="displayName" maxlength="80">
          <label class="field-label" for="auth-gender">${text.gender}</label><select id="auth-gender" name="genderIdentity">
            <option value="">${text.choose}</option><option value="woman">女性</option><option value="man">男性</option>
            <option value="non-binary">非二元</option>
            <option value="prefer-not-to-say">${text.choose}</option></select>` : ""}`
        : `<p>驗證碼已發送至 ${escapeHtml(identifier)}。</p><input type="hidden" name="identifier" value="${escapeHtml(identifier)}">
          <label class="field-label" for="auth-code">${text.code}</label><input id="auth-code" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required>`}
      <button class="button button--primary" type="submit">${mode === "verify" ? text.verify : text.submit}</button>
      ${isSignup ? `<label class="portal-consent"><input type="checkbox" name="consent" value="yes" required>
        <span>我同意 Vekai 保存帳戶資料、已付款的解讀結果及交易紀錄；性別認同為選填。</span></label>` : ""}
      <p class="portal-error" id="auth-error" role="alert" hidden></p>
    </form>
    <button class="text-button portal-switch" data-action="${mode === "verify" ? "resend-code" : isSignup ? "login-mode" : "signup-mode"}" type="button">${mode === "verify" ? text.resend : isSignup ? text.switchLogin : text.switchSignup}</button>
  </section>`;
}

async function renderProfile() {
  const text = t();
  document.querySelector("#portal-page").innerHTML = `<section class="portal-page-card"><p class="eyebrow">VEKAI / 個人資料</p>
    <h1>${text.navProfile}</h1><p>${escapeHtml(state.user.email || state.user.phone || "")}</p>
    <a class="portal-profile-results" href="#results">${text.results} ↗</a>
    <form id="profile-form"><label class="field-label" for="profile-name">${text.displayName}</label>
      <input id="profile-name" name="displayName" maxlength="80" value="${escapeHtml(state.user.displayName)}">
      <label class="field-label" for="profile-gender">${text.gender}</label>
      <select id="profile-gender" name="genderIdentity">
        <option value="">${text.choose}</option>
        <option value="woman" ${state.user.genderIdentity === "woman" ? "selected" : ""}>女性</option>
        <option value="man" ${state.user.genderIdentity === "man" ? "selected" : ""}>男性</option>
        <option value="non-binary" ${state.user.genderIdentity === "non-binary" ? "selected" : ""}>非二元</option>
        <option value="prefer-not-to-say" ${state.user.genderIdentity === "prefer-not-to-say" ? "selected" : ""}>${text.choose}</option>
      </select>
      <button class="button button--primary" type="submit">${text.submit}</button><p class="portal-error" id="profile-message" role="status" hidden></p>
    </form><button class="text-button" data-action="sign-out" type="button">登出</button></section>`;
}

async function renderResults() {
  const text = t();
  const page = document.querySelector("#portal-page");
  page.innerHTML = `<section class="portal-page-card portal-page-card--wide"><p class="eyebrow">VEKAI / 典藏</p><h1>${text.results}</h1><p>${text.loading}</p></section>`;
  const { records } = await api("/api/records");
  page.innerHTML = `<section class="portal-page-card portal-page-card--wide"><p class="eyebrow">VEKAI / 典藏</p><h1>${text.results}</h1>
    ${records.length ? `<div class="portal-record-list">${records.map((record) => `<button class="portal-record" data-record-id="${escapeHtml(record.id)}">
      <span>${escapeHtml(text.serviceName[record.service] || record.service)}</span>
      <strong>${new Date(record.createdAt).toLocaleString("zh-TW")}</strong></button>`).join("")}</div>` : `<p>${text.noRows}</p>`}
  </section>`;
}

async function renderTransactions() {
  const text = t();
  const page = document.querySelector("#portal-page");
  page.innerHTML = `<section class="portal-page-card portal-page-card--wide"><p class="eyebrow">VEKAI / 付款紀錄</p><h1>${text.transactions}</h1><p>${text.loading}</p></section>`;
  const { records } = await api("/api/transactions");
  page.innerHTML = `<section class="portal-page-card portal-page-card--wide"><p class="eyebrow">VEKAI / 付款紀錄</p><h1>${text.transactions}</h1>
    ${records.length ? `<div class="portal-table-wrap"><table><thead><tr><th>服務</th><th>金額</th><th>狀態</th><th>日期</th></tr></thead><tbody>${records.map((record) => `<tr>
      <td>${escapeHtml(text.serviceName[record.service] || record.service)}</td>
      <td>${(record.amount / 100).toFixed(2)} ${escapeHtml(record.currency)}</td>
      <td>${escapeHtml(paymentStatus(record.status))}</td><td>${new Date(record.createdAt).toLocaleString("zh-TW")}</td></tr>`).join("")}</tbody></table></div>` : `<p>${text.noRows}</p>`}
  </section>`;
}

function paymentStatus(status) {
  return ({ pending: "處理中", paid: "已付款", failed: "失敗", expired: "已逾期" })[status] || status;
}

function serviceName(service) {
  return ({ numerology: "數字測算", iching: "易經觀卦" })[service] || service;
}

function adminPerson(row) {
  return escapeHtml(row.displayName || row.email || row.phone || "未提供");
}

function adminContact(row) {
  return escapeHtml(row.email || row.phone || "—");
}

async function renderAdminDashboard() {
  const page = document.querySelector("#portal-page");
  page.innerHTML = `<section class="portal-page-card portal-page-card--wide"><p class="eyebrow">VEKAI / 管理後台</p><h1>營運概覽</h1><p>載入中…</p></section>`;
  let dashboard;
  try {
    dashboard = await api("/api/admin/dashboard");
  } catch (error) {
    const message = error.status === 403
      ? "此帳戶沒有管理員權限。"
      : error.status === 401
        ? "登入已逾期，請重新登入。"
        : error.message;
    page.innerHTML = `<section class="portal-page-card"><p class="eyebrow">VEKAI / 管理後台</p><h1>無法載入管理資料</h1><p role="alert">${escapeHtml(message)}</p><a class="button button--primary" href="/api/auth/github">使用 GitHub 管理員登入</a></section>`;
    return;
  }
  const { metrics } = dashboard;
  const metricCards = [
    ["帳戶總數", metrics.totalUsers],
    ["解讀總數", metrics.totalReadings],
    ["已付款解讀", metrics.paidReadings],
    ["待處理付款", metrics.pendingPayments],
    ["已收款總額", `${(metrics.paidAmount / 100).toFixed(2)} HKD`],
  ];
  const table = (title, headings, rows) => `<section class="admin-table-section"><h2>${title}</h2>
    ${rows.length ? `<div class="portal-table-wrap"><table><thead><tr>${headings.map((heading) => `<th>${heading}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div>` : `<p>暫無紀錄。</p>`}
  </section>`;
  const date = (value) => value ? new Date(value).toLocaleString("zh-TW") : "—";
  page.innerHTML = `<section class="portal-page-card portal-page-card--wide">
    <div class="admin-dashboard-heading"><div><p class="eyebrow">VEKAI / 管理後台</p><h1>營運概覽</h1></div><button class="text-button" type="button" data-action="refresh-admin">重新整理</button></div>
    <div class="admin-metrics">${metricCards.map(([label, value]) => `<article class="admin-metric"><span>${label}</span><strong>${escapeHtml(value)}</strong></article>`).join("")}</div>
    ${table("近期帳戶", ["名稱", "帳戶", "建立日期"], dashboard.users.map((row) => `<tr><td>${adminPerson(row)}</td><td>${adminContact(row)}</td><td>${date(row.createdAt)}</td></tr>`).join(""))}
    ${table("近期付款", ["帳戶", "服務", "金額", "狀態", "日期"], dashboard.payments.map((row) => `<tr><td>${adminPerson(row)}<small>${adminContact(row)}</small></td><td>${serviceName(row.service)}</td><td>${(row.amount / 100).toFixed(2)} ${escapeHtml(row.currency)}</td><td>${paymentStatus(row.status)}</td><td>${date(row.createdAt)}</td></tr>`).join(""))}
    ${table("近期解讀", ["帳戶", "服務", "狀態", "日期"], dashboard.readings.map((row) => `<tr><td>${adminPerson(row)}<small>${adminContact(row)}</small></td><td>${serviceName(row.service)}</td><td>${paymentStatus(row.status)}</td><td>${date(row.createdAt)}</td></tr>`).join(""))}
  </section>`;
}

function renderAdminLogin() {
  document.querySelector("#portal-page").innerHTML = `<section class="portal-page-card">
    <p class="eyebrow">VEKAI / 管理後台</p><h1>管理員登入</h1>
    <p>使用已驗證電郵列於管理員名單的 GitHub 帳戶繼續。</p>
    <a class="button button--primary" href="/api/auth/github">使用 GitHub 管理員登入</a>
  </section>`;
}

async function renderRecord(id) {
  const page = document.querySelector("#portal-page");
  page.innerHTML = `<section class="portal-page-card"><p>${t().loading}</p></section>`;
  let record;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const response = await api(`/api/records/${encodeURIComponent(id)}`);
    record = response.record;
    if (record.status !== "pending") break;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  if (record?.status !== "paid") {
    page.innerHTML = `<section class="portal-page-card"><h1>付款尚未確認</h1><p>Stripe 正在確認交易，請稍後到「我的結果」重新查看。</p><a href="#transactions">查看交易紀錄</a></section>`;
    return;
  }
  if (record.service === "iching") {
    window.dispatchEvent(new CustomEvent("vekai:paid-record", { detail: { record } }));
    location.hash = "#cal";
    return;
  }
  const payload = record.result;
  page.innerHTML = `<section class="portal-page-card portal-page-card--wide"><p class="eyebrow">${escapeHtml(t().serviceName.numerology)} / ${new Date(record.createdAt).toLocaleString("zh-TW")}</p>
    <h1>${t().result}</h1>${resultMarkup(payload)}</section>`;
}

async function routePage() {
  const hash = location.hash.replace(/^#\/?/, "");
  const numberProduct = document.querySelector("#number-product");
  const page = document.querySelector("#portal-page");
  const showApp = hash === "home" || hash === "" || hash === "cal" || hash === "iching";
  const showNumber = hash === "home" || hash === "" || hash === "numerology";
  const activeSection = hash === "cal" || hash === "iching" ? "cal" : "number";
  document.body.dataset.portalView = activeSection;
  document.querySelectorAll(".portal-app-switch a").forEach((link) => {
    if (link.getAttribute("href") === (activeSection === "cal" ? "#cal" : "#numerology")) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });
  numberProduct.hidden = !showNumber;
  calApp.hidden = hash !== "home" && hash !== "" && hash !== "cal" && hash !== "iching";
  page.hidden = showApp;
  if (showNumber && hash === "numerology") numberProduct.scrollIntoView({ behavior: "smooth" });
  if (hash === "cal" || hash === "iching") calApp.scrollIntoView({ behavior: "smooth" });
  if (showApp) return;
  if (hash === "numerology") {
    numberProduct.scrollIntoView({ behavior: "smooth" });
    return;
  }
  if (hash === "account") return renderAuth();
  if (hash === "admin") {
    return state.user ? renderAdminDashboard() : renderAdminLogin();
  }
  if (!state.user) {
    state.authMode = "login";
    return renderAuth();
  }
  if (hash === "profile") return renderProfile();
  if (hash === "results") return renderResults();
  if (hash === "transactions") return renderTransactions();
  if (hash === "admin") return renderAdminDashboard();
  if (hash.startsWith("result/")) return renderRecord(hash.slice("result/".length));
  page.innerHTML = `<section class="portal-page-card"><h1>Vekai</h1><p>${t().signinRequired}</p></section>`;
}

async function safeRoutePage() {
  try {
    await routePage();
  } catch (error) {
    console.error("Vekai page could not be loaded.", error);
    const page = document.querySelector("#portal-page");
    page.hidden = false;
    page.innerHTML = `<section class="portal-page-card"><h1>無法載入頁面</h1><p>${escapeHtml(error.message)}</p></section>`;
  }
}

async function startCheckout(service, input, locale) {
  if (!state.user) {
    state.pendingCalculation = { service, input, locale };
    location.hash = "#account";
    return;
  }
  if (!state.config.checkoutAvailable) {
    throw new Error("付款服務尚未完成設定，請稍後再試。");
  }
  const { checkoutUrl } = await api("/api/billing/checkout", {
    method: "POST",
    body: JSON.stringify({ service, input, locale }),
  });
  location.assign(checkoutUrl);
}

async function completeSignIn(user) {
  state.user = user;
  state.awaitingVerification = false;
  if (state.pendingCalculation) {
    const pending = state.pendingCalculation;
    state.pendingCalculation = null;
    if (state.config.checkoutAvailable) {
      try {
        await startCheckout(pending.service, pending.input, pending.locale);
        return;
      } catch (error) {
        state.notice = error.message;
      }
    } else {
      state.notice = "Payment setup is incomplete. Your calculation has not been charged.";
    }
    location.hash = pending.service === "iching" ? "#cal" : "#numerology";
  } else if (location.hash !== "#admin") {
    location.hash = "#profile";
  }
  renderShell();
  if (location.hash === "#admin") await safeRoutePage();
}

async function loadAccount() {
  const params = new URLSearchParams(location.search);
  const loginError = params.get("adminLogin");
  if (loginError) {
    const messages = {
      "not-configured": "GitHub 管理員登入尚未設定，請稍後再試。",
      "invalid-state": "GitHub 登入驗證失敗，請重新嘗試。",
      "github-error": "GitHub 登入未能完成，請稍後再試。",
      "email-unverified": "請先在 GitHub 驗證你的電子郵件地址。",
      "not-admin": "此 GitHub 帳戶不在管理員名單中。",
      "account-required": "請先以此電郵建立並驗證 Vekai 帳戶。",
    };
    state.notice = messages[loginError] || "GitHub 登入未能完成，請稍後再試。";
    history.replaceState(null, "", `${location.pathname}#admin`);
  }
  try {
    state.config = await api("/api/config");
  } catch (error) {
    console.error("Vekai configuration could not be loaded.", error);
  }
  try {
    state.user = (await api("/api/me")).user;
  } catch (error) {
    if (error.status !== 401 && error.status !== 503) console.error("Vekai account could not be loaded.", error);
  }
  renderShell();
  await safeRoutePage();
  await handleCheckoutReturn();
}

async function handleCheckoutReturn() {
  const params = new URLSearchParams(location.search);
  const checkout = params.get("checkout");
  const readingId = params.get("readingId");
  if (checkout === "cancel") {
    alert("付款已取消，尚未收取費用。");
    history.replaceState(null, "", `${location.pathname}#cal`);
  } else if (checkout === "success" && readingId) {
    history.replaceState(null, "", `${location.pathname}#result/${encodeURIComponent(readingId)}`);
    await safeRoutePage();
  }
}

portal.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.target;
  if (form.id === "number-form") {
    const error = document.querySelector("#number-error");
    error.hidden = true;
    const input = form.elements.input.value.replace(/\D/g, "");
    if (input.length < 8 || input.length > 64) {
      error.textContent = t().inputError;
      error.hidden = false;
      return;
    }
    const locale = "zh-TW";
    const submit = form.querySelector("button[type=submit]");
    submit.disabled = true;
    submit.textContent = t().reading;
    try {
      if (state.config.billingRequired) {
        await startCheckout("numerology", { input }, locale);
      } else {
        const payload = await api("/api/calculations", {
          method: "POST",
          body: JSON.stringify({ input, locale }),
        });
        document.querySelector("#number-empty").hidden = true;
        renderNumberResult(payload);
      }
    } catch (requestError) {
      if (requestError.status === 401) location.hash = "#account";
      else {
        error.textContent = requestError.message;
        error.hidden = false;
      }
    } finally {
      submit.disabled = false;
      submit.textContent = t().calculate;
    }
  } else if (form.id === "auth-form") {
    const error = document.querySelector("#auth-error");
    error.hidden = true;
    const data = Object.fromEntries(new FormData(form));
    try {
      if (form.dataset.mode === "verify") {
        const result = await api("/api/auth/verify", { method: "POST", body: JSON.stringify(data) });
        await completeSignIn(result.user);
      } else if (form.dataset.mode === "signup") {
        state.authIdentifier = data.identifier;
        await api("/api/auth/signup", { method: "POST", body: JSON.stringify(data) });
        state.awaitingVerification = true;
        await safeRoutePage();
      } else {
        const result = await api("/api/auth/login", { method: "POST", body: JSON.stringify(data) });
        await completeSignIn(result.user);
      }
    } catch (requestError) {
      if (requestError.verificationRequired) {
        state.authIdentifier = data.identifier;
        state.awaitingVerification = true;
        await safeRoutePage();
      } else {
        error.textContent = requestError.message;
        error.hidden = false;
      }
    }
  } else if (form.id === "profile-form") {
    const message = document.querySelector("#profile-message");
    message.hidden = true;
    try {
      state.user = (await api("/api/profile", {
        method: "PATCH",
        body: JSON.stringify(Object.fromEntries(new FormData(form))),
      })).user;
      message.textContent = t().profileSaved;
      message.hidden = false;
    } catch (requestError) {
      message.textContent = requestError.message;
      message.hidden = false;
    }
  }
});

portal.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action]");
  if (button) {
    if (button.dataset.action === "toggle-theme") {
      window.dispatchEvent(new CustomEvent("vekai:toggle-theme"));
      return;
    }
    if (button.dataset.action === "refresh-admin") {
      await renderAdminDashboard();
      return;
    }
    if (button.dataset.action === "signup-mode") state.authMode = "signup";
    if (button.dataset.action === "login-mode") state.authMode = "login";
    if (button.dataset.action === "resend-code") {
      try {
        await api("/api/auth/resend-verification", {
          method: "POST",
          body: JSON.stringify({ identifier: state.authIdentifier }),
        });
      } catch (error) {
        const target = document.querySelector("#auth-error");
        target.textContent = error.message;
        target.hidden = false;
      }
    }
    if (button.dataset.action === "sign-out") {
      await api("/api/auth/logout", { method: "POST" });
      state.user = null;
      renderShell();
      location.hash = "#home";
    }
    if (button.dataset.action !== "sign-out") {
      renderShell();
      await safeRoutePage();
    }
    return;
  }
  const recordButton = event.target.closest("[data-record-id]");
  if (recordButton) location.hash = `#result/${encodeURIComponent(recordButton.dataset.recordId)}`;
});

window.addEventListener("hashchange", () => { void safeRoutePage(); });
window.addEventListener("vekai:theme-change", (event) => {
  state.theme = event.detail.theme;
  const button = document.querySelector(".portal-theme-toggle");
  const themeIsNight = state.theme !== "day";
  if (!button) return;
  button.setAttribute("aria-label", `切換至${themeIsNight ? "日間" : "夜間"}模式`);
  button.setAttribute("aria-pressed", String(!themeIsNight));
  button.innerHTML = `<span aria-hidden="true">${themeIsNight ? "☀" : "☾"}</span><span>${themeIsNight ? "日間" : "夜間"}</span>`;
});
window.addEventListener("vekai:login-required", () => { location.hash = "#account"; });
window.addEventListener("vekai:request-iching-checkout", async (event) => {
  try {
    await startCheckout("iching", event.detail, "zh-TW");
  } catch (error) {
    window.dispatchEvent(new CustomEvent("vekai:checkout-error", { detail: { message: error.message } }));
  }
});

window.addEventListener("vekai:paid-record", (event) => {
  const result = event.detail?.record?.result;
  if (result) {
    window.dispatchEvent(new CustomEvent("vekai:load-iching-result", { detail: { result } }));
  }
});

document.addEventListener("DOMContentLoaded", () => { void loadAccount(); });
