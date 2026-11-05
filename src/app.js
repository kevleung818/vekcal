import {
  castYao,
  describeFocus,
  getInterpretationFocus,
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

const app = document.querySelector("#app");
const state = {
  phase: "prepare",
  lines: [],
  question: "",
  breathActive: false,
  audioEnabled: false,
  archiveAvailable: false,
  archiveUnlocked: false,
  archiveDialogMode: "create",
  archiveItems: [],
  saved: false,
};

const lineNames = ["初爻", "二爻", "三爻", "四爻", "五爻", "上爻"];
const resultName = (lines) => resolveHexagrams(lines);

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

function currentResult() {
  const { original, changed } = resultName(state.lines);
  const focus = getInterpretationFocus(state.lines, original, changed);
  return { original, changed, focus, guidance: describeFocus(focus, original, changed) };
}

function phaseContent() {
  if (state.phase === "prepare") {
    return `<section class="ritual-state" aria-labelledby="phase-title">
      <div class="state-overline">01 / SETTLE</div>
      <h2 id="phase-title">先讓心安靜下來。</h2>
      <p class="muted-copy">放下急於求答的念頭。用一段呼吸，為真正重要的問題留白。</p>
      <div class="breath-wrap">
        <div class="breath-orbit" aria-hidden="true"><span>靜</span></div>
        <div class="breath-copy"><span class="eyebrow">A MOMENT FOR YOU</span><strong>${state.breathActive ? "吸氣 · 慢慢吐氣" : "一呼一吸，回到此刻"}</strong><span>${state.breathActive ? "跟隨圓環完成 10 秒靜心" : "準備好時，開始 10 秒靜心"}</span></div>
      </div>
      <div class="ritual-actions">${button(state.breathActive ? "正在靜心…" : "開始靜心", "breathe", "button button--primary", state.breathActive ? "disabled" : "")}
        <button class="text-button" data-action="skip-breath">略過，直接提問 ↗</button></div>
      <p class="micro-note">你的問題只會留在這部裝置上，不會傳送到伺服器。</p>
    </section>`;
  }
  if (state.phase === "intent") {
    return `<section class="ritual-state" aria-labelledby="phase-title">
      <div class="state-overline">02 / INTENTION</div>
      <h2 id="phase-title">此刻，你所問何事？</h2>
      <p class="muted-copy">用一句話記下心中的問題。這段文字只保存在目前的瀏覽器頁面；若選擇典藏，會以你的密語加密。</p>
      <label class="field-label" for="question">你的問題 <span>選填</span></label>
      <textarea id="question" maxlength="240" rows="3" placeholder="例如：面對眼前的轉變，我可以如何準備？">${escapeHtml(state.question)}</textarea>
      <div class="ritual-actions">${button("開始揲筮", "begin-casting", "button button--primary")}
        <span class="micro-note">大衍筮法 · 一爻由下而上，共六爻</span></div>
    </section>`;
  }
  if (state.phase === "casting") {
    const count = state.lines.length;
    return `<section class="ritual-state ritual-state--casting" aria-labelledby="phase-title">
      <div class="state-overline">03 / CAST THE LINES</div>
      <h2 id="phase-title">一爻一念，慢慢成卦。</h2>
      <p class="muted-copy">每次按下按鈕，完成一次蓍草分筮。由初爻起，六次自下而上。</p>
      <div class="casting-layout">
        <div class="casting-figure ${count < 6 ? "casting-figure--waiting" : ""}" aria-hidden="true">
          <div class="coin coin--back"><span>易</span></div><div class="coin coin--front"><span> vekai </span></div>
          <span class="casting-glow"></span>
        </div>
        <div class="line-ledger" aria-label="卦爻進度">
          ${[5, 4, 3, 2, 1, 0].map((index) => state.lines[index]
            ? `<div class="ledger-row"><span>${lineNames[index]}</span>${lineMarkup(state.lines[index], index + 1)}<small>${state.lines[index].changing ? "動" : "靜"}</small></div>`
            : `<div class="ledger-row ledger-row--empty"><span>${lineNames[index]}</span><span class="ledger-placeholder"></span><small>待占</small></div>`).join("")}
        </div>
      </div>
      <div class="casting-footer"><div class="progress-label"><span>第 ${Math.min(count + 1, 6)} / 6 爻</span><span>${count} 爻已成</span></div><div class="progress-track"><span style="width:${count / 6 * 100}%"></span></div>
        ${button(count < 6 ? (count === 0 ? "揲筮第一爻" : "揲筮下一爻") : "卦象已成", "cast-line", "button button--primary", count >= 6 ? "disabled" : "")}
        <button class="text-button sound-toggle" data-action="toggle-sound" aria-pressed="${state.audioEnabled}">♪ 音效與震動：${state.audioEnabled ? "開" : "關"}</button>
        <p class="micro-note">古法機率 · 老陰 1/16　少陽 5/16　少陰 7/16　老陽 3/16</p>
      </div>
    </section>`;
  }
  return resultContent();
}

function resultContent() {
  const { original, changed, focus, guidance } = currentResult();
  return `<section class="ritual-state result-state" aria-labelledby="phase-title">
    <div class="state-overline">YOUR READING / #${String(original.number).padStart(2, "0")}</div>
    <h2 id="phase-title">答案不替你決定，<br>它陪你看清方向。</h2>
    <p class="muted-copy">靜下來，觀察此刻正在發生的變化。</p>
    ${state.question ? `<div class="question-note"><span>你所問</span><p>${escapeHtml(state.question)}</p></div>` : ""}
    <div class="reading-pair">
      <article class="reading-hex"><span class="eyebrow">本卦 · HEXAGRAM ${String(original.number).padStart(2, "0")}</span>${hexagramMarkup(state.lines)}<h3>${original.name}</h3><span>${original.upper.symbol}上${original.lower.symbol}下</span></article>
      <span class="reading-arrow" aria-hidden="true">→</span>
      <article class="reading-hex"><span class="eyebrow">之卦 · TRANSFORMED</span>${hexagramMarkup(state.lines, true)}<h3>${changed.name}</h3><span>${changed.upper.symbol}上${changed.lower.symbol}下</span></article>
    </div>
    <div class="guidance-card"><span class="eyebrow">ZHU XI READING METHOD · ${focus.rule}</span><p>${guidance}</p><small>這是傳統研讀方向的提示，並非對未來的確定預言。</small></div>
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
    return `<article class="archive-row"><div><span class="eyebrow">${new Date(reading.createdAt).toLocaleDateString("zh-Hant", { year: "numeric", month: "short", day: "numeric" })}</span><h4>${escapeHtml(original.name)} <span>→</span> ${escapeHtml(changed.name)}</h4><p>${escapeHtml(reading.question || "靜心一問")}</p></div><button class="icon-button" data-action="delete-reading" data-id="${escapeHtml(reading.id)}" aria-label="刪除這筆典藏" title="刪除">×</button></article>`;
  }).join("")}</div>`;
}

function render() {
  app.innerHTML = `<header class="topbar"><a class="brand" href="#" aria-label="Vekai Cal 首頁"><span class="brand-mark">V</span><span>VEKAI<span class="brand-divider">/</span>CAL</span></a>
    <nav aria-label="主選單"><a href="#ritual">卜卦儀式</a><a href="#archive">私人典藏</a></nav>
    <button class="archive-control" data-action="${state.archiveUnlocked ? "lock-archive" : "open-archive"}">${state.archiveUnlocked ? "鎖定典藏" : state.archiveAvailable ? "解鎖典藏" : "建立典藏"}<span aria-hidden="true">↗</span></button></header>
    <main>
      <section class="hero"><div class="hero-kicker"><span class="kicker-line"></span> A QUIET SPACE FOR CLARITY <span class="kicker-line"></span></div>
        <h1>讓心，<em>看見</em><br>下一步。</h1><p>以古法揲筮，為當下留一點空間。<br>不預言命運，只陪你照見正在改變的事。</p>
        <div class="hero-seal" aria-hidden="true">易</div>
      </section>
      <section class="workspace" id="ritual"><div class="ritual-card"><div class="card-top"><span><i></i> THE I CHING RITUAL</span><span>蓍草古法 · 01 — 06</span></div>${phaseContent()}</div>
        <aside class="side-column"><section class="side-card"><div class="side-card__top"><span class="eyebrow">THE METHOD</span><span class="side-index">01</span></div><h3>大衍筮法</h3><p>古法的機率分布，不是均等的隨機。老陰、少陽、少陰、老陽，各有其數。</p><div class="probability-row"><span>6 · 老陰</span><span>1 / 16</span></div><div class="probability-row"><span>7 · 少陽</span><span>5 / 16</span></div><div class="probability-row"><span>8 · 少陰</span><span>7 / 16</span></div><div class="probability-row"><span>9 · 老陽</span><span>3 / 16</span></div></section>
        <section class="side-card side-card--archive" id="archive"><div class="side-card__top"><span class="eyebrow">YOUR PRIVATE ARCHIVE</span><span class="archive-status">${state.archiveUnlocked ? "已解鎖" : state.archiveAvailable ? "已加密" : "未啟用"}</span></div><h3>只屬於你的<br>卦象典藏。</h3><p>${archiveText()}</p>${renderArchiveItems()}<div class="archive-foot">${button(state.archiveUnlocked ? "鎖定典藏" : state.archiveAvailable ? "輸入密語解鎖" : "啟用加密典藏", state.archiveUnlocked ? "lock-archive" : "open-archive", "text-button")}</div></section></aside>
      </section>
      <section class="closing-note"><span>䷀</span><p>易，窮則變，變則通，通則久。</p><small>Pause. Reflect. Move with intention.</small></section>
    </main>
    <footer><span>VEKAI / CAL</span><span>卦象只作自我省思之用 · 一切決定，仍由你掌握。</span><span>LOCAL-FIRST · PRIVATE BY DESIGN</span></footer>
    <dialog id="archive-dialog" class="archive-dialog"><form method="dialog" id="archive-form"><button class="dialog-close" value="cancel" aria-label="關閉">×</button><span class="eyebrow">PRIVATE BY DESIGN</span><h2 id="archive-title">${state.archiveAvailable ? "解鎖私人典藏" : "為你的典藏設下密語"}</h2><p id="archive-description">${state.archiveAvailable ? "密語只在此刻用於解密，不會儲存或離開這部裝置。" : "選擇至少 10 個字元的密語。密語不會儲存；請務必自行保管。"}</p><label for="archive-passphrase">${state.archiveAvailable ? "典藏密語" : "新密語"}</label><input id="archive-passphrase" type="password" minlength="10" autocomplete="${state.archiveAvailable ? "current-password" : "new-password"}" required placeholder="至少 10 個字元">${state.archiveAvailable ? "" : '<label for="archive-confirm">再次輸入密語</label><input id="archive-confirm" type="password" minlength="10" autocomplete="new-password" required placeholder="確認密語">'}<p class="dialog-error" role="alert" hidden></p><button class="button button--primary" type="submit">${state.archiveAvailable ? "解鎖典藏" : "建立加密典藏"}</button><small>AES-GCM 256-bit · PBKDF2 SHA-256 · 僅儲存於此裝置</small></form></dialog>
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
  buttonEl.disabled = true;
  buttonEl.textContent = "蓍草分筮中…";
  document.querySelector(".casting-figure")?.classList.add("is-casting");
  await new Promise((resolve) => window.setTimeout(resolve, 750));
  state.lines.push(castYao());
  playTone();
  if (state.lines.length === 6) {
    state.phase = "result";
  }
  render();
}

async function saveCurrentReading() {
  try {
    const { original, changed } = currentResult();
    await saveReading({
      createdAt: new Date().toISOString(),
      question: state.question,
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
  state.question = "";
  state.saved = false;
  state.breathActive = false;
  render();
  document.querySelector("#ritual")?.scrollIntoView({ behavior: "smooth" });
}

app.addEventListener("click", async (event) => {
  const actionButton = event.target.closest("[data-action]");
  if (!actionButton) return;
  const action = actionButton.dataset.action;
  if (action === "breathe") startBreath();
  if (action === "skip-breath") { state.phase = "intent"; render(); }
  if (action === "begin-casting") {
    state.question = document.querySelector("#question").value.trim();
    state.phase = "casting";
    render();
  }
  if (action === "cast-line") await castLine();
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

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden" && state.archiveUnlocked) {
    lockArchive();
    state.archiveUnlocked = false;
    state.archiveItems = [];
    render();
  }
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
