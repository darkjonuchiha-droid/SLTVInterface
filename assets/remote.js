import { parseRelayConfig } from "./relay.js";

const cfg = parseRelayConfig(window.location.search);

function showTab(name) {
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === name));
  document.querySelectorAll(".panel").forEach((p) => p.classList.toggle("active", p.id === `panel-${name}`));
}

function initTabs() {
  document.querySelectorAll(".tab").forEach((t) => {
    if (t.disabled) return;
    t.addEventListener("click", () => showTab(t.dataset.tab));
  });
}

function initDebug() {
  if (!cfg.isDev) return;
  const el = document.getElementById("debug");
  if (!el) return;
  el.classList.add("show");
  logDebug(`dev mode — role=${cfg.role}; commands are logged, not sent.`);
}

export function logDebug(msg) {
  const el = document.getElementById("debug");
  if (!el) return;
  const line = document.createElement("div");
  line.textContent = `» ${msg}`;
  el.appendChild(line);
  el.scrollTop = el.scrollHeight;
}

initTabs();
initDebug();
// Radio + favorites wiring added in Task 6.
export { cfg, showTab };
