import {
  castThreeCoins,
  castYao,
  formatHexagramOrdinal,
  resolveHexagrams,
} from "./core.js";
import {
  archiveExists,
  createArchive,
  deleteReading,
  listReadings,
  lockArchive,
  saveReading,
  unlockArchive,
} from "./archive.js";

const INTERPRETATION_CATEGORIES = ["運勢", "愛情", "疾病", "失物", "訴訟"];
const HEXAGRAM_DETAIL_FIELDS = [
  ["shape", "卦形"],
  ["omen", "卦象"],
  ["fortune", "吉凶"],
  ["interpretation", "解讀"],
  ["guaCi", "卦辭"],
  ["inference", "推斷"],
  ["bigImage", "大象"],
];

const app = document.querySelector("#app");
function loadTheme() {
  try {
    return localStorage.getItem("vekai-cal-theme") === "day" ? "day" : "night";
  } catch (error) {
    console.error("Saved color theme could not be loaded.", error);
    return "night";
  }
}

const state = {
  theme: loadTheme(),
  phase: "prepare",
  lines: [],
  method: "yarrow",
  category: "",
  language: "zh-Hant",
  pendingCoins: null,
  isCasting: false,
  question: "",
  breathActive: false,
  audioEnabled: false,
  archiveAvailable: false,
  archiveUnlocked: false,
  archiveDialogMode: "create",
  archiveItems: [],
  saved: false,
  reading: null,
};

const lineNames = ["初爻", "二爻", "三爻", "四爻", "五爻", "上爻"];
const resultName = (lines) => resolveHexagrams(lines);

function applyTheme() {
  document.documentElement.dataset.theme = state.theme;
  document.querySelector('meta[name="theme-color"]').content = state.theme === "day" ? "#f3efe6" : "#11110f";
}

applyTheme();

function toggleTheme() {
  state.theme = state.theme === "night" ? "day" : "night";
  applyTheme();
  let preferenceSaveFailed = false;
  try {
    localStorage.setItem("vekai-cal-theme", state.theme);
  } catch (error) {
    console.error("Color theme preference could not be saved.", error);
    preferenceSaveFailed = true;
  }
  render();
  window.dispatchEvent(new CustomEvent("vekai:theme-change", { detail: { theme: state.theme } }));
  if (preferenceSaveFailed) notify("主題已切換，但無法儲存偏好設定。", "error");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function notify(message, type = "info") {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.dataset.type = type;
  toast.hidden = false;
  window.clearTimeout(notify.timeout);
  notify.timeout = window.setTimeout(() => { toast.hidden = true; }, 3600);
}

function button(label, action, className = "button button--primary", attrs = "") {
  return `<button class="${className}" data-action="${action}" ${attrs}>${label}</button>`;
}

function lineMarkup(line, position, changed = false) {
  const yang = changed ? (line.value === 6 || line.value === 7) : (line.value === 7 || line.value === 9);
  const changing = !changed && line.changing;
  return `<div class="hex-line ${yang ? "is-yang" : "is-yin"} ${changing ? "is-changing" : ""}" aria-label="${lineNames[position - 1]} ${yang ? "陽" : "陰"}${changing ? "變爻" : ""}">
    <span class="hex-line__bar"></span>${yang ? "" : '<span class="hex-line__gap"></span>'}<span class="hex-line__bar"></span>
    ${changing ? '<span class="hex-line__mark">變</span>' : ""}
  </div>`;
}

function hexagramMarkup(lines, changed = false) {
  return `<div class="hexagram" aria-label="${changed ? "之卦" : "本卦"}">${[5, 4, 3, 2, 1, 0]
    .map((index) => lineMarkup(lines[index], index + 1, changed)).join("")}</div>`;
}

function hexagramDetailCard(hexagram, title) {
  const details = hexagram.details || {};
  const rows = HEXAGRAM_DETAIL_FIELDS
    .map(([key, label]) => `<div class="detail-row"><dt>${label}</dt><dd>${details[key] ? escapeHtml(details[key]) : '<span class="detail-unavailable">原典未提供此欄內容</span>'}</dd></div>`)
    .join("");
  return `<article class="hexagram-detail">
    <div class="hexagram-detail__heading"><span class="eyebrow">${title}</span><h3>${escapeHtml(hexagram.name)} <span>${formatHexagramOrdinal(hexagram.number)}</span></h3></div>
    <dl class="detail-list">${rows}</dl>
  </article>`;
}

function methodCard() {
  if (state.method === "coins") {
    return `<section class="side-card"><div class="side-card__top"><span class="eyebrow">起卦方法</span><span class="side-index">02</span></div><h3>三錢法</h3><p>每爻擲三枚銅錢一次，由初爻往上共六次。字面為正、花面為反；三正為老陽、三反為老陰，皆為變爻。</p><div class="probability-row"><span>三正 · 9 老陽</span><span>1 / 8</span></div><div class="probability-row"><span>二正 · 7 少陽</span><span>3 / 8</span></div><div class="probability-row"><span>一正 · 8 少陰</span><span>3 / 8</span></div><div class="probability-row"><span>三反 · 6 老陰</span><span>1 / 8</span></div></section>`;
  }
  return `<section class="side-card"><div class="side-card__top"><span class="eyebrow">起卦方法</span><span class="side-index">01</span></div><h3>大衍筮法</h3><p>古法的機率分布，不是均等的隨機。老陰、少陽、少陰、老陽，各有其數。</p><div class="probability-row"><span>6 · 老陰</span><span>1 / 16</span></div><div class="probability-row"><span>7 · 少陽</span><span>5 / 16</span></div><div class="probability-row"><span>8 · 少陰</span><span>7 / 16</span></div><div class="probability-row"><span>9 · 老陽</span><span>3 / 16</span></div></section>`;
}

function castingVisual() {
  if (state.method !== "coins") {
    return `<div class="casting-figure ${state.lines.length < 6 ? "casting-figure--waiting" : ""}" aria-hidden="true">
      <div class="coin coin--back"><span>易</span></div><div class="coin coin--front"><span> vekai </span></div>
      <span class="casting-glow"></span>
    </div>`;
  }
  const coins = state.pendingCoins ?? state.lines.at(-1)?.coins ?? null;
  const faces = coins?.map((face) => face ? "字" : "花") ?? ["擲", "三", "錢"];
  const label = coins ? `三枚銅錢結果：${faces.join("、")}` : "三枚銅錢，準備擲出";
  return `<div class="casting-figure coin-figure ${state.isCasting ? "is-casting" : state.lines.length < 6 ? "casting-figure--waiting" : ""}">
    <div class="coin-tray" role="img" aria-label="${label}">
      ${faces.map((face, index) => `<span class="coin coin--toss coin--toss-${index + 1}">${face}</span>`).join("")}
    </div>
    <span class="casting-glow" aria-hidden="true"></span>
  </div>`;
}

function phaseContent() {
  if (state.phase === "prepare") {
    return `<section class="ritual-state" aria-labelledby="phase-title">
      <div class="state-overline">01 / 靜心</div>
      <h2 id="phase-title">先讓心安靜下來。</h2>
      <p class="muted-copy">放下急於求答的念頭。用一段呼吸，為真正重要的問題留白。</p>
      <div class="breath-wrap">
        <div class="breath-orbit" aria-hidden="true"><span>靜</span></div>
        <div class="breath-copy"><span class="eyebrow">靜心片刻</span><strong>${state.breathActive ? "吸氣 · 慢慢吐氣" : "一呼一吸，回到此刻"}</strong><span>${state.breathActive ? "跟隨圓環完成 10 秒靜心" : "準備好時，開始 10 秒靜心"}</span></div>
      </div>
      <div class="ritual-actions">${button(state.breathActive ? "正在靜心…" : "開始靜心", "breathe", "button button--primary", state.breathActive ? "disabled" : "")}
        <button class="text-button" data-action="skip-breath">略過，直接提問 ↗</button></div>
      <p class="micro-note">未付款前，問題只保存在此頁面。完成付款後，問題與結果會保存到你的 Vekai 帳戶。</p>
    </section>`;
  }
  if (state.phase === "intent") {
    return `<section class="ritual-state" aria-labelledby="phase-title">
      <div class="state-overline">02 / 起念</div>
      <h2 id="phase-title">此刻，你所問何事？</h2>
      <p class="muted-copy">用一句話記下心中的問題。開始付款時會送到 Vekai 暫存解讀；完成付款後保存到帳戶，未完成付款的解讀會於付款頁面逾期後清除。亦可選擇加密典藏於此裝置。</p>
      <label class="field-label" for="question">你的問題 <span>選填</span></label>
      <textarea id="question" maxlength="240" rows="3" placeholder="例如：面對眼前的轉變，我可以如何準備？">${escapeHtml(state.question)}</textarea>
      <label class="field-label" for="casting-method">起卦方法</label>
      <select id="casting-method">
        <option value="yarrow" ${state.method === "yarrow" ? "selected" : ""}>大衍筮法（蓍草機率）</option>
        <option value="coins" ${state.method === "coins" ? "selected" : ""}>三錢法（每爻擲三枚銅錢）</option>
      </select>
      <fieldset class="choice-group">
        <legend class="field-label">占問分類 <span>選填，可選一個方向</span></legend>
        <div class="choice-tags" role="group" aria-label="占問分類">
          ${INTERPRETATION_CATEGORIES.map((category) => `<button type="button" class="choice-tag" data-action="select-category" data-category="${category}" aria-pressed="${state.category === category}">${category}</button>`).join("")}
        </div>
        <small class="choice-note">選擇後，完成起卦會顯示該分類的卦象參考。</small>
      </fieldset>
      <div class="ritual-actions">${button("開始揲筮", "begin-casting", "button button--primary")}
        <span class="micro-note">${state.method === "coins" ? "三錢法 · 每爻擲三枚，由下而上共六次" : "大衍筮法 · 一爻由下而上，共六爻"}</span></div>
    </section>`;
  }
  if (state.phase === "casting") {
    const count = state.lines.length;
    const coinLabel = (line) => {
      const heads = line.coins.filter(Boolean).length;
      return heads === 0 ? "三反" : `${heads}正`;
    };
    return `<section class="ritual-state ritual-state--casting" aria-labelledby="phase-title">
      <div class="state-overline">03 / 起卦</div>
      <h2 id="phase-title">一爻一念，慢慢成卦。</h2>
      <p class="muted-copy">${state.method === "coins" ? "每次擲出三枚銅錢，記下正反面。由初爻起，六次自下而上。" : "每次按下按鈕，完成一次蓍草分筮。由初爻起，六次自下而上。"}</p>
      <div class="casting-layout">
        ${castingVisual()}
        <div class="line-ledger" aria-label="卦爻進度">
          ${[5, 4, 3, 2, 1, 0].map((index) => state.lines[index]
            ? `<div class="ledger-row"><span>${lineNames[index]}</span>${lineMarkup(state.lines[index], index + 1)}<small>${state.method === "coins" ? coinLabel(state.lines[index]) : state.lines[index].changing ? "動" : "靜"}</small></div>`
            : `<div class="ledger-row ledger-row--empty"><span>${lineNames[index]}</span><span class="ledger-placeholder"></span><small>待占</small></div>`).join("")}
        </div>
      </div>
      <div class="casting-footer"><div class="progress-label"><span>第 ${Math.min(count + 1, 6)} / 6 爻</span><span>${count} 爻已成</span></div><div class="progress-track"><span style="width:${count / 6 * 100}%"></span></div>
        ${button(state.isCasting ? (state.method === "coins" ? "擲銅錢中…" : "蓍草分筮中…") : count < 6 ? (count === 0 ? (state.method === "coins" ? "擲出第一爻" : "揲筮第一爻") : (state.method === "coins" ? "擲出下一爻" : "揲筮下一爻")) : "卦象已成", "cast-line", "button button--primary", count >= 6 || state.isCasting ? "disabled" : "")}
        <button class="text-button sound-toggle" data-action="toggle-sound" aria-pressed="${state.audioEnabled}">♪ 音效與震動：${state.audioEnabled ? "開" : "關"}</button>
        <p class="micro-note">${state.method === "coins" ? "字面為正 · 三正老陽　兩正少陽　一正少陰　三反老陰" : "古法機率 · 老陰 1/16　少陽 5/16　少陰 7/16　老陽 3/16"}</p>
      </div>
    </section>`;
  }
  if (state.phase === "checkout") {
    return `<section class="ritual-state" aria-labelledby="phase-title">
      <div class="state-overline">04 / 安全付款</div>
      <h2 id="phase-title">卦象已成，準備查看結果。</h2>
      <p class="muted-copy">每次易經解讀收費 HKD 81。完成付款後，結果會保存到你的 Vekai 帳戶，方便日後查閱。</p>
      <div class="ritual-actions">${button("登入並付款 · HKD 81", "start-iching-checkout", "button button--primary")}
        <button class="text-button" data-action="new-reading">重新開始 ↗</button></div>
      <p class="micro-note">信用卡資料由 Stripe 安全處理；Vekai 不會接收或保存卡號。</p>
    </section>`;
  }
  return resultContent();
}

function resultContent() {
  const reading = state.reading;
  if (!reading?.original?.details || !reading?.changed?.details || !reading.guidance) {
    return `<section class="ritual-state" aria-labelledby="phase-title">
      <div class="state-overline">04 / 安全付款</div>
      <h2 id="phase-title">卦象解讀尚未開放。</h2>
      <p class="muted-copy">完整解讀只在付款完成後，由伺服器送出。此頁不會保存未付款的卦辭。</p>
      <div class="ritual-actions">${button("登入並付款 · HKD 81", "start-iching-checkout", "button button--primary")}
        <button class="text-button" data-action="new-reading">重新開始 ↗</button></div>
    </section>`;
  }
  const { original, changed } = reading;
  const categoryReading = reading.categoryReading || "";
  const languageLabel = "繁體中文";
  return `<section class="ritual-state result-state" aria-labelledby="phase-title">
    <div class="state-overline">${state.method === "coins" ? "三錢法" : "大衍筮法"} · 卦象解讀 / #${String(original.number).padStart(2, "0")}</div>
    <h2 id="phase-title">答案不替你決定，<br>它陪你看清方向。</h2>
    <p class="muted-copy">靜下來，觀察此刻正在發生的變化。</p>
    ${state.question ? `<div class="question-note"><span>你所問</span><p>${escapeHtml(state.question)}</p></div>` : ""}
    <div class="reading-pair">
      <article class="reading-hex"><span class="eyebrow">本卦 · ${String(original.number).padStart(2, "0")}</span>${hexagramMarkup(state.lines)}<h3>${escapeHtml(original.name)}</h3><span>${escapeHtml(original.upper?.symbol)}上${escapeHtml(original.lower?.symbol)}下</span></article>
      <span class="reading-arrow" aria-hidden="true">→</span>
      <article class="reading-hex"><span class="eyebrow">之卦 · 變化</span>${hexagramMarkup(state.lines, true)}<h3>${escapeHtml(changed.name)} <span class="hexagram-ordinal">${escapeHtml(formatHexagramOrdinal(changed.number))}</span></h3><span>${escapeHtml(changed.upper?.symbol)}上${escapeHtml(changed.lower?.symbol)}下</span></article>
    </div>
    <section class="hexagram-details" aria-label="本卦與之卦詳解">
      ${hexagramDetailCard(original, "本卦詳解")}
      ${hexagramDetailCard(changed, "之卦詳解")}
    </section>
    ${state.language === "zh-Hant" ? '<p class="detail-source-note">繁體中文參考表未提供獨立的「解讀」與「卦辭」欄位；以上僅列出原表欄目。</p>' : ""}
    <div class="guidance-card"><span class="eyebrow">朱熹解卦法</span><p>${escapeHtml(reading.guidance)}</p><small>這是傳統研讀方向的提示，並非對未來的確定預言。</small></div>
    ${categoryReading ? `<section class="category-reading" aria-labelledby="category-reading-title">
      <div class="category-reading__top"><span class="eyebrow" id="category-reading-title">${escapeHtml(state.category)} · 分類解讀</span><span>${languageLabel}</span></div>
      ${state.category === "疾病" ? '<p class="health-disclaimer">疾病分類內容僅供傳統文化參考，並非醫療診斷或治療建議，也不能用來預測病情。若有身體不適，請諮詢醫療專業人員；如有急症請立即求助。</p>' : ""}
      <p class="category-reading__text">${escapeHtml(categoryReading)}</p>
    </section>` : ""}
    <div class="ritual-actions">${button(state.saved ? "已典藏" : "加密典藏此卦", "save-reading", "button button--primary", state.saved ? "disabled" : "")}
      <button class="text-button" data-action="new-reading">重新開始 ↗</button></div>
    <p class="micro-note">${state.archiveUnlocked ? "典藏以 AES-GCM 加密，密語不會儲存；忘記密語便無法還原。" : "私人典藏可選擇啟用；加密密語只由你保管。"}</p>
  </section>`;
}

function archiveText() {
  if (!state.archiveAvailable) return "建立密語後，卦象才會加密儲存。";
  if (!state.archiveUnlocked) return "典藏已加密鎖定；只有你能解鎖。";
  return `${state.archiveItems.length} 筆加密卦象 · 僅此裝置可讀`;
}

function renderArchiveItems() {
  if (!state.archiveUnlocked) {
    return `<div class="archive-empty"><span class="archive-lock" aria-hidden="true">⌑</span><p>${state.archiveAvailable ? "私人典藏已鎖定。" : "尚未建立私人典藏。"}</p><span>${state.archiveAvailable ? "輸入密語即可在此裝置解鎖。" : "建立密語，啟用 AES-GCM 加密典藏。"}</span></div>`;
  }
  if (!state.archiveItems.length) {
    return `<div class="archive-empty"><span class="archive-lock" aria-hidden="true">⌑</span><p>此處只收藏值得回望的時刻。</p><span>完成一卦後，將它加密典藏。</span></div>`;
  }
  return `<div class="archive-list">${state.archiveItems.map((reading) => {
    const { original, changed } = resultName(reading.lines);
    const category = reading.category ? `<span class="archive-category">${escapeHtml(reading.category)} · 繁體中文</span>` : "";
    return `<article class="archive-row"><div><span class="eyebrow">${new Date(reading.createdAt).toLocaleDateString("zh-Hant", { year: "numeric", month: "short", day: "numeric" })}</span><h4>${escapeHtml(original.name)} <span>→</span> ${escapeHtml(changed.name)}</h4>${category}<p>${escapeHtml(reading.question || "靜心一問")}</p></div><button class="icon-button" data-action="delete-reading" data-id="${escapeHtml(reading.id)}" aria-label="刪除這筆典藏" title="刪除">×</button></article>`;
  }).join("")}</div>`;
}

function render() {
  app.innerHTML = `<main>
      <section class="hero"><a class="hero-admin-link" href="#admin">管理後台登入</a>
        <div class="hero-kicker"><span class="kicker-line"></span> 靜心觀卦，照見當下 <span class="kicker-line"></span></div>
        <h1>靜心冥想<br><em>易經起卦 卦象解讀</em></h1><p>以古法揲筮，為當下留一點空間。<br>不預言命運，只陪你照見正在改變的事。</p>
        <div class="hero-seal" aria-hidden="true">易</div>
      </section>
      <section class="workspace" id="ritual"><div class="ritual-card">      <div class="card-top"><span><i></i> 易經起卦儀式</span><span>${state.method === "coins" ? "三錢法" : "蓍草古法"} · 01 — 06</span></div>${phaseContent()}</div>
        <aside class="side-column">${methodCard()}
        <section class="side-card side-card--archive" id="archive"><div class="side-card__top"><span class="eyebrow">私人卦象典藏</span><span class="archive-status">${state.archiveUnlocked ? "已解鎖" : state.archiveAvailable ? "已加密" : "未啟用"}</span></div><h3>只屬於你的<br>卦象典藏。</h3><p>${archiveText()}</p>${renderArchiveItems()}<div class="archive-foot">${button(state.archiveUnlocked ? "鎖定典藏" : state.archiveAvailable ? "輸入密語解鎖" : "啟用加密典藏", state.archiveUnlocked ? "lock-archive" : "open-archive", "text-button")}</div></section></aside>
      </section>
      <section class="closing-note"><span>䷀</span><p>易，窮則變，變則通，通則久。</p><small>靜心 · 觀照 · 知行合一</small></section>
    </main>
    <footer><span>VEKAI / 易經觀卦</span><span>卦象只作自我省思之用 · 一切決定，仍由你掌握。</span><span>私人帳戶紀錄 · 僅此裝置加密典藏</span></footer>
    <dialog id="archive-dialog" class="archive-dialog"><form method="dialog" id="archive-form"><button class="dialog-close" value="cancel" aria-label="關閉">×</button><span class="eyebrow">私密加密典藏</span><h2 id="archive-title">${state.archiveAvailable ? "解鎖私人典藏" : "為你的典藏設下密語"}</h2><p id="archive-description">${state.archiveAvailable ? "密語只在此刻用於解密，不會儲存或離開這部裝置。" : "選擇至少 10 個字元的密語。密語不會儲存；請務必自行保管。"}</p><label for="archive-passphrase">${state.archiveAvailable ? "典藏密語" : "新密語"}</label><input id="archive-passphrase" type="password" minlength="10" autocomplete="${state.archiveAvailable ? "current-password" : "new-password"}" required placeholder="至少 10 個字元">${state.archiveAvailable ? "" : '<label for="archive-confirm">再次輸入密語</label><input id="archive-confirm" type="password" minlength="10" autocomplete="new-password" required placeholder="確認密語">'}<p class="dialog-error" role="alert" hidden></p><button class="button button--primary" type="submit">${state.archiveAvailable ? "解鎖典藏" : "建立加密典藏"}</button><small>AES-GCM 256-bit · PBKDF2 SHA-256 · 僅儲存於此裝置</small></form></dialog>
    <div id="toast" class="toast" role="status" hidden></div>`;
}

function refreshArchive() {
  if (!state.archiveUnlocked) return;
  listReadings().then((items) => {
    state.archiveItems = items;
    render();
  }).catch((error) => notify(`無法讀取典藏：${error.message}`, "error"));
}

async function submitArchive(event) {
  event.preventDefault();
  const dialog = document.querySelector("#archive-dialog");
  const passphrase = document.querySelector("#archive-passphrase").value;
  const errorEl = dialog.querySelector(".dialog-error");
  try {
    const wasAvailable = state.archiveAvailable;
    if (state.archiveAvailable) {
      await unlockArchive(passphrase);
    } else {
      if (passphrase !== document.querySelector("#archive-confirm").value) {
        throw new Error("兩次輸入的密語不一致。");
      }
      await createArchive(passphrase);
      state.archiveAvailable = true;
    }
    state.archiveUnlocked = true;
    state.archiveItems = await listReadings();
    dialog.close();
    render();
    notify(wasAvailable ? "私人典藏已解鎖。" : "加密典藏已建立。", "success");
  } catch (error) {
    errorEl.textContent = error.message;
    errorEl.hidden = false;
  }
}

function openArchiveDialog() {
  const dialog = document.querySelector("#archive-dialog");
  dialog.showModal();
  dialog.querySelector("#archive-passphrase").focus();
}

function startBreath() {
  state.breathActive = true;
  render();
  let remaining = 10;
  const buttonEl = document.querySelector('[data-action="breathe"]');
  if (buttonEl) buttonEl.textContent = "吸氣  ·  5";
  const timer = window.setInterval(() => {
    remaining -= 1;
    const currentButton = document.querySelector('[data-action="breathe"]');
    const ring = document.querySelector(".breath-orbit");
    if (ring) ring.classList.toggle("is-exhaling");
    if (currentButton) currentButton.textContent = remaining > 5 ? `呼氣  ·  ${remaining - 5}` : `吸氣  ·  ${remaining}`;
    if (remaining <= 0) {
      window.clearInterval(timer);
      state.breathActive = false;
      state.phase = "intent";
      render();
    }
  }, 1000);
}

function playTone() {
  if (!state.audioEnabled) return;
  const AudioContext = window.AudioContext ?? window.webkitAudioContext;
  if (!AudioContext) {
    notify("此瀏覽器不支援音效。", "error");
    return;
  }
  const context = new AudioContext();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(432, context.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(108, context.currentTime + 0.65);
  gain.gain.setValueAtTime(0.08, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.65);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.65);
  oscillator.onended = () => { void context.close(); };
  if (navigator.vibrate) navigator.vibrate([15, 30, 15]);
}

async function castLine() {
  const buttonEl = document.querySelector('[data-action="cast-line"]');
  if (!buttonEl || buttonEl.disabled) return;
  const line = state.method === "coins" ? castThreeCoins() : castYao();
  state.isCasting = true;
  state.pendingCoins = line.coins ?? null;
  render();
  document.querySelector(".casting-figure")?.classList.add("is-casting");
  await new Promise((resolve) => window.setTimeout(resolve, 750));
  state.lines.push(line);
  state.isCasting = false;
  state.pendingCoins = null;
  playTone();
  if (state.lines.length === 6) {
    state.reading = null;
    state.phase = "checkout";
  }
  render();
  if (state.phase === "result") {
    requestAnimationFrame(() => {
      document.querySelector(".hexagram-details")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }
  if (state.phase === "checkout") document.querySelector("#ritual")?.scrollIntoView({ behavior: "smooth" });
}

async function saveCurrentReading() {
  try {
    const { original, changed } = resultName(state.lines);
    await saveReading({
      createdAt: new Date().toISOString(),
      question: state.question,
      method: state.method,
      category: state.category,
      language: state.language,
      lines: state.lines,
      original: original.name,
      changed: changed.name,
    });
    state.saved = true;
    state.archiveItems = await listReadings();
    render();
    notify("卦象已加密典藏於此裝置。", "success");
  } catch (error) {
    notify(`無法典藏：${error.message}`, "error");
  }
}

function resetReading() {
  state.phase = "prepare";
  state.lines = [];
  state.method = "yarrow";
  state.category = "";
  state.language = "zh-Hant";
  state.pendingCoins = null;
  state.isCasting = false;
  state.question = "";
  state.saved = false;
  state.reading = null;
  state.breathActive = false;
  render();
  document.querySelector("#ritual")?.scrollIntoView({ behavior: "smooth" });
}

app.addEventListener("click", async (event) => {
  const actionButton = event.target.closest("[data-action]");
  if (!actionButton) return;
  const action = actionButton.dataset.action;
  if (action === "toggle-theme") toggleTheme();
  if (action === "select-category") {
    const category = actionButton.dataset.category;
    state.category = state.category === category ? "" : category;
    render();
    document.querySelector(`[data-action="select-category"][data-category="${state.category || category}"]`)?.focus();
  }
  if (action === "breathe") startBreath();
  if (action === "skip-breath") { state.phase = "intent"; render(); }
  if (action === "begin-casting") {
    state.question = document.querySelector("#question").value.trim();
    state.method = document.querySelector("#casting-method").value;
    state.phase = "casting";
    render();
  }
  if (action === "cast-line") await castLine();
  if (action === "start-iching-checkout") {
    window.dispatchEvent(new CustomEvent("vekai:request-iching-checkout", {
      detail: {
        lines: state.lines,
        question: state.question,
        method: state.method,
        category: state.category,
        language: state.language,
      },
    }));
  }
  if (action === "toggle-sound") {
    state.audioEnabled = !state.audioEnabled;
    actionButton.setAttribute("aria-pressed", String(state.audioEnabled));
    actionButton.textContent = `♪ 音效與震動：${state.audioEnabled ? "開" : "關"}`;
  }
  if (action === "save-reading") await saveCurrentReading();
  if (action === "new-reading") resetReading();
  if (action === "open-archive") openArchiveDialog();
  if (action === "lock-archive") {
    lockArchive();
    state.archiveUnlocked = false;
    state.archiveItems = [];
    render();
    notify("私人典藏已鎖定。");
  }
  if (action === "delete-reading") {
    try {
      await deleteReading(actionButton.dataset.id);
      state.archiveItems = await listReadings();
      render();
      notify("典藏紀錄已刪除。");
    } catch (error) {
      notify(`無法刪除：${error.message}`, "error");
    }
  }
});

app.addEventListener("submit", async (event) => {
  if (event.target.id !== "archive-form") return;
  await submitArchive(event);
});

app.addEventListener("input", (event) => {
  if (event.target.id === "question") state.question = event.target.value;
});

app.addEventListener("change", (event) => {
  if (event.target.id !== "casting-method") return;
  state.method = event.target.value;
  render();
  document.querySelector("#casting-method").focus();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden" && state.archiveUnlocked) {
    lockArchive();
    state.archiveUnlocked = false;
    state.archiveItems = [];
    render();
  }
});

window.addEventListener("vekai:checkout-error", (event) => {
  notify(event.detail?.message || "無法開始安全付款。", "error");
});

window.addEventListener("vekai:toggle-theme", toggleTheme);

window.addEventListener("vekai:load-iching-result", (event) => {
  const result = event.detail?.result;
  if (!result || result.service !== "iching") return;
  state.lines = result.lines;
  state.question = result.question;
  state.method = result.method;
  state.category = result.category;
  state.language = "zh-Hant";
  state.saved = true;
  state.reading = result;
  state.phase = "result";
  render();
  requestAnimationFrame(() => document.querySelector(".hexagram-details")?.scrollIntoView({ behavior: "smooth", block: "start" }));
});

document.addEventListener("DOMContentLoaded", async () => {
  render();
  try {
    state.archiveAvailable = await archiveExists();
    render();
  } catch (error) {
    notify(`私人典藏無法使用：${error.message}`, "error");
  }
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("./service-worker.js").catch((error) => {
      console.error("Offline support could not be enabled.", error);
    });
  }
});
