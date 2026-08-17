/* Bansko 2027 — renders the page from CONFIG + the Google Sheet. */

const $ = id => document.getElementById(id);
const money = n => "£" + n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money0 = n => "£" + Math.round(n).toLocaleString("en-GB");
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const fmtDate = iso => new Date(iso + "T12:00:00").toLocaleDateString("en-GB",
  { weekday: "short", day: "numeric", month: "short", year: "numeric" });
const fmtShort = iso => new Date(iso + "T12:00:00").toLocaleDateString("en-GB",
  { day: "numeric", month: "short", year: "numeric" });

let creditView = CONFIG.credit.mode === "both" ? CONFIG.credit.defaultView : CONFIG.credit.mode;
let people = [];
let me = null;        // the person whose link was used
let demoMode = false; // true when running off the built-in roster

/* ---------- who's looking ----------
   The key arrives as ?k=... once, then lives in localStorage so the
   link only has to be opened the first time. It is stripped from the
   address bar straight away so it doesn't end up in a screenshot. */

const STORE_KEY = "bansko2027.key";

// The demo roster skips the link check, but only when you're running it locally.
// On a real host the check always applies, so an unconfigured deploy is never open.
const isLocal = ["localhost", "127.0.0.1", "[::1]", ""].includes(location.hostname);

function readStoredKey() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return "";
    const { key, ts } = JSON.parse(raw);
    const age = (Date.now() - ts) / 86400000;
    if (age > CONFIG.access.rememberDays) { localStorage.removeItem(STORE_KEY); return ""; }
    return key || "";
  } catch { return ""; }
}

function storeKey(key) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify({ key, ts: Date.now() })); } catch { /* private mode */ }
}

function resolveMe() {
  const fromUrl = (new URLSearchParams(location.search).get("k") || "").trim();
  const key = fromUrl || readStoredKey();
  if (!key) return null;

  const match = people.find(p => p.key && p.key.toLowerCase() === key.toLowerCase());
  if (!match) return null;

  if (fromUrl) {
    storeKey(match.key);
    history.replaceState(null, "", location.pathname + location.hash);
  }
  return match;
}

function renderGate() {
  document.querySelector(".wrap").innerHTML =
    '<div class="card pad" style="margin-top:8px">' +
      "<h3 style='margin:0 0 8px'>You need your own link</h3>" +
      "<p style='margin:0 0 12px;color:var(--ink-soft)'>Everyone going to Bansko has their own link. " +
      "Yours came over WhatsApp — open that one and this page will remember you on this phone.</p>" +
      "<p style='margin:0;color:var(--ink-soft)'>Lost it? Give Jake a shout and he'll send it again.</p>" +
    "</div>";
  $("banner").innerHTML = "";
}

/* ---------- CSV ---------- */

// Minimal RFC4180 parser — handles quoted fields and embedded commas/newlines.
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(cell => cell.trim() !== ""));
}

const num = v => {
  const n = parseFloat(String(v ?? "").replace(/[£,\s]/g, ""));
  return isFinite(n) ? n : 0;
};

function rowsToPeople(rows) {
  if (!rows.length) return [];
  const key = s => s.trim().toLowerCase().replace(/[^a-z]/g, "");
  const head = rows[0].map(key);
  const col = (...names) => {
    for (const n of names) { const i = head.indexOf(n); if (i !== -1) return i; }
    return -1;
  };
  const iName = col("name");
  const iKey = col("key", "link", "code");
  const iStatus = col("status");
  const iDep = col("depositpaid", "deposit");
  const iBal = col("balancepaid", "balance");
  const iNotes = col("notes", "note");
  if (iName === -1) throw new Error('Sheet has no "Name" column');

  return rows.slice(1).map(r => ({
    name: (r[iName] || "").trim(),
    key: iKey === -1 ? "" : (r[iKey] || "").trim(),
    status: (iStatus === -1 ? "unknown" : (r[iStatus] || "unknown")).trim().toLowerCase(),
    depositPaid: iDep === -1 ? 0 : num(r[iDep]),
    balancePaid: iBal === -1 ? 0 : num(r[iBal]),
    notes: iNotes === -1 ? "" : (r[iNotes] || "").trim(),
  })).filter(p => p.name);
}

async function loadPeople() {
  if (!CONFIG.sheetCsvUrl) {
    demoMode = true;
    banner("info", "Running on the built-in roster, so payments all show £0. Connect the Google Sheet to go live — see README step 3." +
      (isLocal ? " The personal-link check is off because this is a local preview." : ""));
    return CONFIG.seedPeople.map(p => ({ ...p }));
  }
  try {
    const res = await fetch(CONFIG.sheetCsvUrl + (CONFIG.sheetCsvUrl.includes("?") ? "&" : "?") + "cb=" + Date.now());
    if (!res.ok) throw new Error("HTTP " + res.status);
    const list = rowsToPeople(parseCsv(await res.text()));
    if (!list.length) throw new Error("Sheet returned no rows");
    return list;
  } catch (err) {
    banner("warn", "Couldn't read the Google Sheet (" + esc(err.message) + "). Showing the built-in roster instead — payment figures below may be out of date.");
    return CONFIG.seedPeople.map(p => ({ ...p }));
  }
}

function banner(kind, html) {
  $("banner").innerHTML = '<div class="note ' + (kind === "info" ? "info" : "") + '" style="margin-bottom:20px">' + html + "</div>";
}

/* ---------- money ---------- */

const counted = () => people.filter(p => p.status !== "dropped");

// Chalet share per person under the current credit view.
function chaletShare() {
  const c = CONFIG.costs, cr = CONFIG.credit;
  const heads = Math.max(counted().length, 1);
  return creditView === "split"
    ? (c.chaletTotal - cr.amount) / heads
    : c.chaletTotal / heads;
}

// Pass a person to get their individual figure; pass nothing for the standard head.
function totalFor(person) {
  const c = CONFIG.costs, cr = CONFIG.credit;
  const gross = chaletShare() + c.flightsPerHead + c.liftPassPerHead;
  // "jake" mode: the whole credit comes off the beneficiary's balance, not just
  // their chalet share, so a credit larger than £420 isn't thrown away.
  if (creditView === "jake" && person && person.name === cr.beneficiary) {
    return Math.max(gross - cr.amount, 0);
  }
  return gross;
}

/* ---------- render ---------- */

function renderHeader() {
  const t = CONFIG.trip;
  $("title").textContent = t.name;
  $("subtitle").textContent = t.chalet + ", " + t.operator + " · " + fmtDate(t.startDate) + " – " + fmtDate(t.endDate);
  const days = Math.ceil((new Date(t.startDate + "T00:00:00") - new Date()) / 86400000);
  $("days").textContent = days > 0 ? days : "0";
  document.title = t.name;
}

function renderMe() {
  const el = $("me");
  if (!me) { el.innerHTML = ""; return; }

  const s = CONFIG.schedule;
  const total = totalFor(me);
  const paid = me.depositPaid + me.balancePaid;
  const owed = Math.max(total - paid, 0);
  const depOwed = Math.max(s.depositPerHead - me.depositPaid, 0);

  // Next thing this person actually has to do.
  let action, due;
  if (owed === 0) { action = "You're all square"; due = "Nothing left to pay. See you at the airport."; }
  else if (depOwed > 0) { action = money(depOwed) + " deposit"; due = "due by " + fmtShort(s.depositDue); }
  else { action = money(owed) + " balance"; due = "due by " + fmtShort(s.balanceDue); }

  const pct = total > 0 ? Math.min((paid / total) * 100, 100) : 0;

  el.innerHTML =
    '<div class="mecard">' +
      '<div class="me-hi">' + esc(me.name.split(" ")[0]) + "</div>" +
      '<div class="me-act">' + action + "</div>" +
      '<div class="me-due">' + due + "</div>" +
      '<div class="bar" style="margin-top:12px"><i class="' + (pct >= 100 ? "" : "part") +
        '" style="width:' + pct.toFixed(1) + '%"></i></div>' +
      '<div class="me-sum">Paid ' + money(paid) + " of " + money(total) + "</div>" +
    "</div>";
}

function renderStats() {
  const inCount = people.filter(p => p.status === "confirmed").length;
  const paid = people.reduce((s, p) => s + p.depositPaid + p.balancePaid, 0);
  const due = counted().reduce((s, p) => s + totalFor(p), 0);
  const outstanding = Math.max(due - paid, 0);

  $("stats").innerHTML = [
    ["Per head", money0(totalFor(null)), "all in, est."],
    ["Confirmed", inCount + " of " + CONFIG.trip.groupSize, inCount >= CONFIG.trip.groupSize ? "full" : (CONFIG.trip.groupSize - inCount) + " still to lock in"],
    ["Collected", money0(paid), "of " + money0(due)],
    ["Outstanding", money0(outstanding), outstanding === 0 ? "all square" : "still to come in"],
  ].map(([k, v, n]) =>
    '<div class="stat"><div class="k">' + k + '</div><div class="v">' + v + '</div><div class="n">' + n + "</div></div>"
  ).join("");
}

function renderPeople() {
  $("people").innerHTML = people.map(p => {
    const total = totalFor(p);
    const paid = p.depositPaid + p.balancePaid;
    const owed = Math.max(total - paid, 0);
    const pct = total > 0 ? Math.min((paid / total) * 100, 100) : 0;
    const dropped = p.status === "dropped";

    const bits = [];
    if (!dropped) {
      bits.push("Paid " + money(paid) + " of " + money(total));
      bits.push(owed === 0 ? "settled up" : money(owed) + " to go");
    }
    if (p.notes) bits.push(esc(p.notes));

    const isMe = me && p.key && p.key === me.key;

    return '<div class="person' + (isMe ? " is-me" : "") + '">' +
      '<div class="nm">' + esc(p.name) + (isMe ? ' <span class="you">you</span>' : "") + "</div>" +
      '<span class="pill ' + esc(p.status) + '">' + esc(p.status) + "</span>" +
      '<div class="meta">' + bits.join(" · ") + "</div>" +
      (dropped ? "" :
        '<div class="bar"><i class="' + (pct >= 100 ? "" : "part") + '" style="width:' + pct.toFixed(1) + '%"></i></div>') +
      "</div>";
  }).join("");

  const short = CONFIG.trip.groupSize - people.filter(p => p.status === "confirmed").length;
  $("spotsNote").innerHTML = short > 0
    ? '<div class="note" style="margin-top:12px">' + short + " more " + (short === 1 ? "person" : "people") +
      " needed. " + CONFIG.trip.operator + " won't run the chalet below " + CONFIG.trip.groupSize +
      " — if we drop under, the price per head goes up or the booking falls over.</div>"
    : '<div class="note info" style="margin-top:12px">All ' + CONFIG.trip.groupSize + " places confirmed.</div>";
}

function renderCreditToggle() {
  const cr = CONFIG.credit;
  if (cr.mode !== "both") { $("creditToggle").innerHTML = ""; return; }
  const opts = [
    ["split", "Credit split 8 ways"],
    ["jake", "Credit to " + cr.beneficiary.split(" ")[0] + " only"],
  ];
  $("creditToggle").innerHTML = opts.map(([v, label]) =>
    '<button data-view="' + v + '" aria-pressed="' + (creditView === v) + '">' + esc(label) + "</button>"
  ).join("");
  $("creditToggle").querySelectorAll("button").forEach(b =>
    b.addEventListener("click", () => { creditView = b.dataset.view; renderAll(); })
  );
}

function renderBreakdown() {
  const c = CONFIG.costs, cr = CONFIG.credit;
  const heads = Math.max(counted().length, 1);
  const rows = [];

  rows.push(["Chalet", money(c.chaletTotal / heads)]);
  if (creditView === "split" && cr.amount > 0) {
    rows.push(["Operator credit, split " + heads + " ways", "&minus;" + money(cr.amount / heads)]);
  }
  rows.push(["Flights <span class='est'>Ryanair PLUS, 20kg</span>", money(c.flightsPerHead)]);
  rows.push(["Lift pass" + (c.liftPassIsEstimate ? " <span class='est'>estimate</span>" : ""), money(c.liftPassPerHead)]);

  const totalRow = '<tr class="total"><td>Total per head</td><td class="num">' + money(totalFor(null)) + "</td></tr>";

  $("breakdown").innerHTML =
    "<thead><tr><th>Item</th><th class='num'>Per person</th></tr></thead><tbody>" +
    rows.map(([k, v]) => "<tr><td>" + k + '</td><td class="num">' + v + "</td></tr>").join("") +
    totalRow + "</tbody>";

  const notes = [];
  if (cr.amount === 0) {
    notes.push("The operator credit from the cancelled 2026 booking isn't in these numbers yet — the amount is still to be confirmed with " + esc(CONFIG.contact.names) + ".");
  } else if (creditView === "jake") {
    notes.push("The " + money(cr.amount) + " credit comes off " + esc(cr.beneficiary) +
      "'s balance only, taking it to " + money(totalFor({ name: cr.beneficiary })) +
      ". Everyone else pays the figure above.");
  }
  if (c.liftPassIsEstimate) notes.push("Lift pass is an estimate — buy in resort, confirm the 2027 price nearer the time.");
  $("creditNote").innerHTML = notes.length
    ? '<div class="note info" style="margin-top:12px">' + notes.join(" ") + "</div>" : "";
}

function renderSchedule() {
  const s = CONFIG.schedule;
  const balance = Math.max(totalFor(null) - s.depositPerHead, 0);
  $("schedule").innerHTML = [
    ["Deposit", money(s.depositPerHead) + " by " + fmtShort(s.depositDue)],
    ["Balance", money(balance) + " by " + fmtShort(s.balanceDue)],
    ["How", esc(s.payTo)],
  ].map(([k, v]) => '<div class="kv"><span>' + k + "</span><span>" + v + "</span></div>").join("");
}

function renderFlights() {
  const f = CONFIG.flights;
  const leg = (l, label) =>
    '<div class="flight">' +
      '<div><div class="code">' + esc(l.code) + '</div><div class="time">' + esc(l.depart) + '</div><div class="apt">' + esc(l.from) + "</div></div>" +
      '<div class="mid">' + label + " &rarr;</div>" +
      '<div style="text-align:right"><div class="code">&nbsp;</div><div class="time">' + esc(l.arrive) + '</div><div class="apt">' + esc(l.to) + "</div></div>" +
      '<div class="when">' + fmtDate(l.date) + " · " + esc(f.airline) + ", " + esc(f.fare) + "</div>" +
    "</div>";
  $("flights").innerHTML = leg(f.out, "Out") + leg(f.back, "Back") +
    (f.back.warning ? '<div class="pad"><div class="note">' + esc(f.back.warning) + "</div></div>" : "");
}

function renderInfo() {
  $("included").innerHTML = CONFIG.included.map(i => "<li>" + esc(i) + "</li>").join("");
  $("notIncluded").innerHTML = CONFIG.notIncluded.map(i =>
    "<li>" + esc(i.item) + ' <span class="est">' + esc(i.note) + "</span></li>").join("");

  $("packing").innerHTML = CONFIG.packing.map(g =>
    '<div class="card pad"><strong>' + esc(g.group) + "</strong><ul class='plain'>" +
    g.items.map(i => "<li>" + esc(i) + "</li>").join("") + "</ul></div>").join("");

  const c = CONFIG.contact;
  $("contact").innerHTML = [
    ["Who", esc(c.names) + ", " + esc(c.company)],
    ["Email", '<a href="mailto:' + esc(c.email) + '">' + esc(c.email) + "</a>"],
    ["WhatsApp", '<a href="https://wa.me/' + c.whatsapp.replace(/[^0-9]/g, "") + '">' + esc(c.whatsapp) + "</a>"],
    ["Site", '<a href="' + esc(c.website) + '" target="_blank" rel="noopener">explorebansko-chalets.com</a>'],
  ].map(([k, v]) => '<div class="kv"><span>' + k + "</span><span>" + v + "</span></div>").join("");

  $("footer").textContent = "Updated " + new Date().toLocaleString("en-GB",
    { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function renderAll() {
  renderHeader();
  renderMe();
  renderStats();
  renderPeople();
  renderCreditToggle();
  renderBreakdown();
  renderSchedule();
  renderFlights();
  renderInfo();
}

(async function init() {
  people = await loadPeople();
  me = resolveMe();
  if (CONFIG.access.requireKey && !(demoMode && isLocal) && !me) { renderHeader(); renderGate(); return; }
  renderAll();
})();
