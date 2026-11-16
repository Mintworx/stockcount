import "./style.css";
import "./invoice.js";
import { cloudReady, extractCount } from "./ai.js";
import { validateRows } from "./count.js";

const byId = (id) => document.getElementById(id);
const form = byId("count-form");
const notes = byId("notes");
const cloud = byId("cloud");
const status = byId("status");
const reviewPanel = byId("review-panel");
const reviewJump = byId("review-jump");
const sourceLabel = byId("source");
const saveStatus = byId("save-status");
const rowsBody = byId("rows");
const save = byId("save");
const storageKey = "stockcount.latest";
const sourceNames = { ON_DEVICE: "On-device Gemini", IN_CLOUD: "Cloud Gemini" };
let rows = [];
let source = null;
let busy = false;

function checkConnection() {
  const connection = byId("connection");
  connection.textContent = navigator.onLine ? "Online" : "Offline";
  connection.dataset.online = String(navigator.onLine);
  cloud.disabled = busy || !navigator.onLine || !cloudReady;
  byId("readiness").textContent = !cloudReady
    ? "Cloud setup pending. Try on-device Gemini or enter items manually."
    : navigator.onLine
      ? "If the local model is unavailable, opting in lets Google process these notes."
      : "Offline. Extraction uses Chrome’s local model when installed.";
}

function checkRows() {
  save.disabled = busy || !validateRows(rows);
  byId("add-row").disabled = busy;
}

function renderRows() {
  rowsBody.replaceChildren();
  byId("table-wrap").hidden = !rows.length;
  reviewJump.hidden = busy || !rows.length;
  byId("empty").hidden = Boolean(rows.length);
  sourceLabel.hidden = !source;
  sourceLabel.textContent = sourceNames[source] ?? "";
  byId("mode-summary").textContent = sourceNames[source] ?? "On-device first";
  byId("item-summary").textContent = String(rows.length);
  rows.forEach((row, index) => {
    const tr = rowsBody.insertRow();
    for (const [field, label] of [["item", "Item"], ["quantity", "Quantity"], ["unit", "Unit"]]) {
      const cell = tr.insertCell();
      const input = document.createElement("input");
      input.value = row[field];
      input.setAttribute("aria-label", `${label} for row ${index + 1}`);
      input.disabled = busy;
      if (field === "quantity") {
        input.type = "number";
        input.min = "0";
        input.step = "any";
      }
      input.addEventListener("input", () => {
        row[field] = input.value;
        saveStatus.textContent = "";
        checkRows();
      });
      cell.append(input);

      if (field === "item" && "evidence" in row) {
        const evidence = document.createElement("small");
        evidence.textContent = row.evidence || "Check against your notes";
        cell.append(evidence);
      }
    }
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "quiet";
    remove.textContent = "×";
    remove.disabled = busy;
    remove.setAttribute("aria-label", `Remove row ${index + 1}`);
    remove.addEventListener("click", () => {
      rows.splice(index, 1);
      if (!rows.length) source = null;
      saveStatus.textContent = "";
      renderRows();
    });
    tr.insertCell().append(remove);
  });
  checkRows();
}

function setBusy(value) {
  busy = value;
  form.dataset.working = String(value);
  notes.disabled = value;
  byId("extract").disabled = value;
  byId("sample").disabled = value;
  byId("extract").textContent = value ? "Extracting…" : "Extract count";
  checkConnection();
  renderRows();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const input = notes.value.trim();
  if (!input || busy) return;
  if (rows.length && !window.confirm("Replace the rows currently in review with this extraction?")) return;

  const allowCloud = cloud.checked && !cloud.disabled;
  cloud.checked = false;
  delete reviewPanel.dataset.fresh;
  delete status.dataset.tone;
  setBusy(true);
  status.textContent = "Reading your notes. The first on-device count can take a few minutes.";
  const started = performance.now();
  try {
    const result = await extractCount(input, allowCloud, (fraction) => {
      if (busy && !allowCloud) status.textContent = `Downloading Chrome’s Gemini model… ${Math.round(fraction * 100)}%`;
    });
    if (result.rows.length) {
      rows = result.rows;
      source = result.source;
      saveStatus.textContent = "";
      reviewPanel.dataset.fresh = "true";
      status.textContent = `Extracted ${rows.length} item${rows.length === 1 ? "" : "s"} in ${((performance.now() - started) / 1000).toFixed(1)}s. Review each quantity before saving.`;
    } else {
      status.textContent = `${sourceNames[result.source]} found no definite counts. Add rows manually or clarify your notes.`;
    }
  } catch (error) {
    const reason = error?.code || error?.name;
    const code = typeof reason === "string" ? ` (${reason})` : "";
    status.dataset.tone = "error";
    status.textContent = allowCloud
      ? `Extraction failed${code}. Check Firebase AI Logic and App Check setup, or add items manually.`
      : `On-device extraction failed${code}. Check that Chrome’s local Gemini model is installed, or add items manually.`;
  } finally {
    setBusy(false);
  }
});

function updateNoteLength() {
  byId("note-length").textContent = `${notes.value.length} / ${notes.maxLength}`;
}

notes.addEventListener("input", updateNoteLength);
reviewJump.addEventListener("click", () => byId("review-title").focus({ preventScroll: true }));
byId("sample").addEventListener("click", () => {
  notes.value = "Back shelf: 20 cartons of tomatoes and 8 bags of rice.\nCounter: 12 bottles of oil. Soap count pending.";
  updateNoteLength();
  notes.focus();
});

byId("add-row").addEventListener("click", () => {
  rows.push({ item: "", quantity: "", unit: "" });
  saveStatus.textContent = "";
  renderRows();
  rowsBody.lastElementChild.querySelector("input").focus();
});

save.addEventListener("click", () => {
  if (!validateRows(rows)) return;
  try {
    const count = { version: 1, savedAt: new Date().toISOString(), source, rows };
    localStorage.setItem(storageKey, JSON.stringify(count));
    showSavedTime(count.savedAt);
    saveStatus.textContent = "Count saved on this device.";
  } catch {
    saveStatus.textContent = "Browser storage is unavailable. This count is still open for review.";
  }
});

try {
  const saved = JSON.parse(localStorage.getItem(storageKey));
  if (saved?.version === 1 && Array.isArray(saved.rows) && validateRows(saved.rows)) {
    rows = saved.rows;
    source = Object.hasOwn(sourceNames, saved.source) ? saved.source : null;
    showSavedTime(saved.savedAt);
    saveStatus.textContent = "Last saved count restored from this device.";
  }
} catch {
  saveStatus.textContent = "Could not restore the last saved count.";
}

function showSavedTime(value) {
  const time = new Date(value);
  byId("saved-summary").textContent = Number.isFinite(time.valueOf())
    ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(time)
    : "Count available";
}

window.addEventListener("online", checkConnection);
window.addEventListener("offline", checkConnection);
checkConnection();
renderRows();

const offlineStatus = byId("offline-status");
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js")
    .then(() => navigator.serviceWorker.ready)
    .then(() => { offlineStatus.textContent = "Workspace cached for offline use on this device."; })
    .catch(() => { offlineStatus.textContent = "Workspace offline cache is unavailable."; });
} else {
  offlineStatus.textContent = "Use the production preview to test reloading without a connection.";
}
