const app = document.querySelector("#app");
const TAGS = ["感情", "事業", "家庭", "學業", "健康", "財富", "遷移", "合作", "時機", "心境"];

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
  tags: [],
  notice: "",
};

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function applyTheme() {
  document.documentElement.dataset.theme = state.theme;
  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) themeColor.content = state.theme === "day" ? "#f3efe6" : "#11110f";
}

applyTheme();

function toggleTheme() {
  state.theme = state.theme === "night" ? "day" : "night";
  applyTheme();
  try {
    localStorage.setItem("vekai-cal-theme", state.theme);
  } catch (error) {
    console.error("Color theme preference could not be saved.", error);
  }
  window.dispatchEvent(new CustomEvent("vekai:theme-change", { detail: { theme: state.theme } }));
}

function numberFields(name, count) {
  return Array.from({ length: count }, (_, index) => `<label class="number-cell"><span>${index + 1}</span><input name="${name}" type="number" inputmode="numeric" min="0" max="${count === 20 ? 99 : 999}" required></label>`).join("");
}

function render() {
  app.innerHTML = `<section class="paid-products" id="paid-products">
    <p class="eyebrow">VEKAI / 付費解讀</p>
    <h2>登入後選購解讀</h2>
    <p class="muted-copy">付款在本機直接入帳，無須信用卡金鑰。結果只在登入後保存。</p>
    ${state.notice ? `<p class="portal-error" role="alert">${escapeHtml(state.notice)}</p>` : ""}
    <div class="paid-products__grid">
      <form class="portal-panel" id="pentagon-form">
        <p class="eyebrow">產品 A · HK$89</p>
        <h3>五軸解讀</h3>
        <p>先選剛好五個標籤，再輸入五個數字。</p>
        <fieldset class="choice-group">
          <legend class="field-label">標籤 <span>${state.tags.length} / 5</span></legend>
          <div class="choice-tags" role="group" aria-label="解讀標籤">
            ${TAGS.map((tag) => `<button type="button" class="choice-tag" data-action="toggle-tag" data-tag="${tag}" aria-pressed="${state.tags.includes(tag)}">${tag}</button>`).join("")}
          </div>
        </fieldset>
        <div class="number-grid" aria-label="五個數字">${numberFields("pentagon-number", 5)}</div>
        <button class="button button--primary" type="submit">取得五軸圖 · HK$89</button>
      </form>
      <form class="portal-panel" id="sequence-form">
        <p class="eyebrow">產品 B · HK$390</p>
        <h3>二十數解讀</h3>
        <p>輸入二十個 0 至 99 的整數。</p>
        <div class="number-grid number-grid--twenty" aria-label="二十個數字">${numberFields("sequence-number", 20)}</div>
        <button class="button button--primary" type="submit">取得二十數解讀 · HK$390</button>
      </form>
    </div>
  </section>`;
}

function readNumbers(form, name) {
  return [...form.querySelectorAll(`[name="${name}"]`)].map((input) => input.value.trim());
}

app.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action='toggle-tag']");
  if (!button) return;
  const tag = button.dataset.tag;
  if (state.tags.includes(tag)) state.tags = state.tags.filter((item) => item !== tag);
  else if (state.tags.length < 5) state.tags = [...state.tags, tag];
  else state.notice = "只能選擇五個標籤。";
  const values = Object.fromEntries([...document.querySelectorAll("#pentagon-form input, #sequence-form input")].map((input, index) => [index, input.value]));
  render();
  document.querySelectorAll("#pentagon-form input, #sequence-form input").forEach((input, index) => {
    input.value = values[index] || "";
  });
});

app.addEventListener("submit", (event) => {
  event.preventDefault();
  state.notice = "";
  if (event.target.id === "pentagon-form") {
    if (state.tags.length !== 5) {
      state.notice = "請選擇剛好五個標籤。";
      render();
      return;
    }
    window.dispatchEvent(new CustomEvent("vekai:request-checkout", {
      detail: {
        service: "pentagon",
        input: { tags: state.tags, numbers: readNumbers(event.target, "pentagon-number") },
        locale: "zh-TW",
      },
    }));
    return;
  }
  if (event.target.id === "sequence-form") {
    window.dispatchEvent(new CustomEvent("vekai:request-checkout", {
      detail: {
        service: "sequence",
        input: { numbers: readNumbers(event.target, "sequence-number") },
        locale: "zh-TW",
      },
    }));
  }
});

window.addEventListener("vekai:checkout-error", (event) => {
  state.notice = event.detail?.message || "無法完成解讀。";
  render();
});

window.addEventListener("vekai:toggle-theme", toggleTheme);

document.addEventListener("DOMContentLoaded", () => {
  render();
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("./service-worker.js").catch((error) => {
      console.error("Offline support could not be enabled.", error);
    });
  }
});
