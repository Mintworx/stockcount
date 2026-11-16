import { cloudReady, extractInvoice } from "./ai.js";
import { validateRows } from "./count.js";
import { reconcile } from "./reconcile.js";

const id = (name) => document.getElementById(name);
const form = id("invoice-form");
const status = id("invoice-status");
const submit = id("compare-invoice");
const input = id("invoice-file");
const consent = id("invoice-consent");
const tbody = id("invoice-rows");
const drop = id("invoice-drop");
const choose = id("choose-invoice");
const remove = id("remove-invoice");
const selected = id("invoice-selected");
const fileState = id("invoice-file-state");
const result = id("invoice-result");
const quantityFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 6 });
let busy = false;
let file = null;
let selection = 0;

function updateAvailability() {
  const canProcess = cloudReady && navigator.onLine;
  choose.disabled = remove.disabled = busy;
  consent.disabled = busy || !file || !canProcess;
  submit.disabled = consent.disabled || !consent.checked;
  id("invoice-readiness").textContent = !cloudReady ? "Cloud invoice processing needs Firebase App Check."
    : !navigator.onLine ? "Reconnect to compare a PDF. Your count stays saved on this device."
    : "Google receives the selected PDF when you compare. Your saved count stays on this device.";
}

async function selectFile(next) {
  if (busy) return;
  const request = ++selection;
  file = null;
  consent.checked = false;
  selected.hidden = true;
  result.hidden = true;
  status.textContent = "";
  updateAvailability();
  if (!next) return;

  let valid = false;
  try {
    valid = next.name.toLowerCase().endsWith(".pdf") && next.size > 0 && next.size <= 5 * 1024 * 1024
      && await next.slice(0, 5).text() === "%PDF-";
  } catch {
    // The file can disappear from disk between selection and validation.
  }
  if (request !== selection) return;
  if (!valid) {
    status.textContent = "Choose a valid PDF up to 5 MB.";
    return;
  }

  file = next;
  id("invoice-name").textContent = file.name;
  fileState.textContent = `${Math.max(1, Math.round(file.size / 1024)).toLocaleString()} KB · Ready to compare`;
  selected.dataset.state = "ready";
  selected.hidden = false;
  updateAvailability();
}

choose.addEventListener("click", () => input.click());
input.addEventListener("change", () => {
  const next = input.files[0];
  input.value = "";
  void selectFile(next);
});
remove.addEventListener("click", () => {
  void selectFile(null);
  choose.focus();
});
consent.addEventListener("change", updateAvailability);
drop.addEventListener("dragover", event => {
  if (!event.dataTransfer.types.includes("Files")) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = busy ? "none" : "copy";
  if (!busy) drop.dataset.dragging = "true";
});
drop.addEventListener("dragleave", event => {
  if (!drop.contains(event.relatedTarget)) delete drop.dataset.dragging;
});
drop.addEventListener("drop", event => {
  event.preventDefault();
  delete drop.dataset.dragging;
  if (busy) return;
  if (event.dataTransfer.files.length !== 1) {
    status.textContent = "Drop one invoice PDF at a time.";
    return;
  }
  void selectFile(event.dataTransfer.files[0]);
});

form.addEventListener("submit", async event => {
  event.preventDefault();
  if (submit.disabled || !file) return;
  let count;
  try {
    count = JSON.parse(localStorage.getItem("stockcount.latest"));
    if (count?.version !== 1 || !Array.isArray(count.rows) || !validateRows(count.rows)) throw new Error();
  } catch {
    status.textContent = "Save a reviewed stock count before comparing an invoice.";
    return;
  }
  busy = true;
  consent.checked = false;
  tbody.replaceChildren();
  result.hidden = true;
  selected.dataset.state = "working";
  fileState.textContent = "Reading with cloud Gemini…";
  status.textContent = "Extracting billed quantities from this PDF.";
  updateAvailability();
  try {
    const invoice = await extractInvoice(file);
    if (!invoice.length) {
      selected.dataset.state = "ready";
      fileState.textContent = "No quantities found";
      status.textContent = "Gemini found no invoice lines with definite quantities. Try a clearer PDF.";
      return;
    }
    const rows = reconcile(count.rows, invoice).sort(
      (a, b) => Number(a.status === "Matched") - Number(b.status === "Matched")
    );
    for (const row of rows) {
      const tr = tbody.insertRow();
      const outcome = row.gap ? `${row.status} · ${quantityFormat.format(Math.abs(row.gap))}` : row.status;
      for (const value of [row.item, row.billed ?? "—", row.counted ?? "—", outcome]) {
        tr.insertCell().textContent = value;
      }
      if (row.unit) {
        const unit = document.createElement("small");
        unit.textContent = row.unit;
        tr.cells[0].append(unit);
      }
      tr.dataset.status = row.status === "Matched" ? "match" : "review";
      const badge = document.createElement("strong");
      badge.className = "outcome";
      badge.textContent = outcome;
      tr.cells[3].replaceChildren(badge);
      const lines = row.invoice.map(line => line.evidence).filter(Boolean);
      if (lines.length) {
        const details = document.createElement("details");
        const label = document.createElement("summary");
        label.textContent = "View invoice excerpt";
        const quote = document.createElement("p");
        quote.textContent = lines.join(" · ");
        details.append(label, quote);
        tr.cells[3].append(details);
      }
    }
    const matched = rows.filter(row => row.status === "Matched").length;
    id("invoice-match-total").textContent = `${matched} matched`;
    id("invoice-review-total").textContent = `${rows.length - matched} to review`;
    status.textContent = "Comparison ready. Check the excerpts against the PDF.";
    selected.dataset.state = "done";
    fileState.textContent = "Compared with the saved count";
    result.hidden = false;
  } catch {
    selected.dataset.state = "ready";
    fileState.textContent = "Ready to retry";
    status.textContent = "Invoice extraction failed. Check the connection and Firebase App Check, then retry.";
  } finally {
    busy = false;
    updateAvailability();
  }
});

window.addEventListener("online", updateAvailability);
window.addEventListener("offline", updateAvailability);
updateAvailability();
