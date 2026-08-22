/* Bansko 2027 — renders the page from CONFIG + the Zoho Sheet. */

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

// A page can opt out of the personal-link check by setting window.BANSKO_PUBLIC
// before this script loads. Such a page must show nothing personal — so it also
// never fetches the roster, rather than merely not displaying it. Loading it and
// hiding it would leave names, balances and keys sitting in memory for anyone
// who opened dev tools.
const isPublicPage = window.BANSKO_PUBLIC === true;

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
  if ($("banner")) $("banner").innerHTML = "";
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
  const iAirport = col("airport", "from", "flyingfrom");
  const iBackAirport = col("returnairport", "backairport", "returnto", "back");
  const iFlightsBy = col("flightsby", "flightsbookedby", "bookedby");
  if (iName === -1) throw new Error('Sheet has no "Name" column');

  return rows.slice(1).map(r => ({
    name: (r[iName] || "").trim(),
    key: iKey === -1 ? "" : (r[iKey] || "").trim(),
    status: (iStatus === -1 ? "unknown" : (r[iStatus] || "unknown")).trim().toLowerCase(),
    depositPaid: iDep === -1 ? 0 : num(r[iDep]),
    balancePaid: iBal === -1 ? 0 : num(r[iBal]),
    notes: iNotes === -1 ? "" : (r[iNotes] || "").trim(),
    airport: iAirport === -1 ? "" : (r[iAirport] || "").trim().toUpperCase(),
    backAirport: iBackAirport === -1 ? "" : (r[iBackAirport] || "").trim().toUpperCase(),
    flightsBy: iFlightsBy === -1 ? "" : (r[iFlightsBy] || "").trim().toLowerCase(),
  })).filter(p => p.name);
}

async function loadPeople() {
  if (!CONFIG.dataUrl) {
    demoMode = true;
    banner("info", "Running on the built-in roster, so payments all show £0. Connect the Zoho Sheet to go live — see README step 3." +
      (isLocal ? " The personal-link check is off because this is a local preview." : ""));
    return CONFIG.seedPeople.map(p => ({ ...p }));
  }
  try {
    const res = await fetch(CONFIG.dataUrl + (CONFIG.dataUrl.includes("?") ? "&" : "?") + "cb=" + Date.now());
    if (!res.ok) throw new Error("HTTP " + res.status);
    const list = rowsToPeople(parseCsv(await res.text()));
    if (!list.length) throw new Error("Sheet returned no rows");
    return list;
  } catch (err) {
    banner("warn", "Couldn't read the Zoho Sheet (" + esc(err.message) + "). Showing the built-in roster instead — payment figures below may be out of date.");
    return CONFIG.seedPeople.map(p => ({ ...p }));
  }
}

function banner(kind, html) {
  $("banner").innerHTML = '<div class="note ' + (kind === "info" ? "info" : "") + '" style="margin-bottom:20px">' + html + "</div>";
}

/* ---------- money ---------- */

// Everyone the chalet cost is split across. An open seat still counts — it's
// priced whether or not it's filled. Someone dropped does not.
const counted = () => people.filter(p => p.status !== "dropped");

// Everyone who actually owes money. An open seat has nobody to bill.
const payers = () => people.filter(p => p.status !== "dropped" && p.status !== "open");

const openSeats = () => people.filter(p => p.status === "open").length;

/* ---------- flights ----------
   Travel cost follows whichever airport is picked in flightOptions.chosen,
   so the breakdown can never drift from the option on show. */

// Everyone flies from wherever suits them; the Sofia times are what line up.
// Pass a person to get their flight, or nothing for the default.
const airportFor = (person, leg) => {
  const fo = CONFIG.flightOptions;
  if (leg === "back" && person && person.backAirport) return person.backAirport;
  return (person && person.airport) || fo.chosen;
};

const legFor = (person, leg) => {
  const fo = CONFIG.flightOptions;
  if (!fo) return null;
  const want = airportFor(person, leg);
  const c = fo.choices.find(x => x.iata === want) || fo.choices.find(x => x.iata === fo.chosen);
  return c ? { ...c[leg], airport: c.airport, iata: c.iata } : null;
};

// Someone flying out of one airport and back into another has no single
// "their airport" — this is the outbound one, used where a single label is needed.
const flightFor = person => {
  const fo = CONFIG.flightOptions;
  if (!fo) return null;
  const want = airportFor(person, "out");
  return fo.choices.find(c => c.iata === want) || fo.choices.find(c => c.iata === fo.chosen);
};
const chosenFlight = () => flightFor(me);

// Who books the seat, and therefore who collects for it. Taken from the sheet's
// "Flights By" column where set — it's a fact about the arrangement, not something
// to infer from the airport. Matt flies out of Birmingham with everyone but books
// his own, so airport alone would get him wrong.
function flightViaJake(person) {
  const fo = CONFIG.flightOptions;
  if (person && person.flightsBy) return person.flightsBy === "jake";
  const f = flightFor(person);
  return !!(f && fo.bookedByJake && fo.bookedByJake.includes(f.iata));
}

const flightFare = c => c.out.fare + c.back.fare;
const flightAllIn = c => flightFare(c) + CONFIG.flightOptions.bagPerHead;

// Getting to the airport, per person, under the chosen transport mode.
// Two cars: fuel there and back for each car, plus parking, split across us.
function transferPerHead(c) {
  const t = CONFIG.transport;
  const heads = Math.max(CONFIG.trip.groupSize, 1);
  if (!t || t.chosen === "minibus") return c.transfer.minibusPerHead;
  const fuel = t.cars.count * c.transfer.miles * 2 * t.cars.poundsPerMile;
  const parking = t.cars.count * c.transfer.parkingPerCar;
  return (fuel + parking) / heads;
}

const countTransport = () => CONFIG.transport && CONFIG.transport.includeInTotal === true;
const optionTotal = c => flightAllIn(c) + (countTransport() ? transferPerHead(c) : 0);

// Roughly when you'd walk back through your own front door.
function homeBy(c) {
  const [h, m] = c.back.arrive.split(":").map(Number);
  const mins = h * 60 + m + Math.round((c.transfer.driveHours || 0) * 60);
  const d = Math.floor(mins / 60) % 24;
  return String(d).padStart(2, "0") + ":" + String(mins % 60).padStart(2, "0");
}

// Flights + airport run, as breakdown rows.
function travelRows(person) {
  const c = flightFor(person === undefined ? me : person);
  if (!c) return [];
  const t = CONFIG.transport;
  const cars = !t || t.chosen === "cars";
  const rows = [
    (() => {
      const who = person === undefined ? me : person;
      const o = legFor(who, "out"), b = legFor(who, "back");
      const openJaw = o && b && o.iata !== b.iata;
      return {
        label: "Flights",
        note: (openJaw ? "out of " + o.airport + ", back to " + b.airport
                       : o.airport + " return") + ", " + CONFIG.flightOptions.bagNote +
              (openJaw ? " — two one-ways, price them yourself" : ""),
        amount: (o ? o.fare : 0) + (b ? b.fare : 0) + CONFIG.flightOptions.bagPerHead,
        estimate: true,
        viaJake: flightViaJake(who),
      };
    })(),
  ];
  if (countTransport()) {
    rows.push({ viaJake: false, label: "Getting to " + c.airport,
      note: cars
        ? t.cars.count + " cars — " + t.cars.note + " " + CONFIG.trip.groupSize + " ways"
        : "minibus from York, split " + CONFIG.trip.groupSize + " ways",
      amount: transferPerHead(c), estimate: true });
  }
  return rows;
}

// Sum of everything that isn't the chalet.
const extrasTotal = person =>
  [...CONFIG.costs.extras, ...travelRows(person)].reduce((s, x) => s + x.amount, 0);

// Chalet cost per person. It's a flat per-person rate, so headcount doesn't
// change it — only how thinly the operator credit spreads.
function chaletShare() {
  const c = CONFIG.costs, cr = CONFIG.credit;
  const heads = Math.max(counted().length, 1);
  return creditView === "split"
    ? c.chaletPerHead - cr.amount / heads
    : c.chaletPerHead;
}

// Pass a person to get their individual figure; pass nothing for the standard head.
function totalFor(person) {
  const cr = CONFIG.credit;
  const gross = chaletShare() + extrasTotal(person);
  // "jake" mode: the whole credit comes off the beneficiary's balance, not just
  // their chalet share, so a credit larger than £420 isn't thrown away.
  if (creditView === "jake" && person && person.name === cr.beneficiary) {
    return Math.max(gross - cr.amount, 0);
  }
  return gross;
}

// Everything for the trip, however it gets paid.
const allRows = person => [...CONFIG.costs.extras, ...travelRows(person)];

// What this person actually hands to Jake — the only thing the sheet tracks.
function owedToJake(person) {
  const cr = CONFIG.credit;
  let sum = chaletShare();
  if (creditView === "jake" && person && person.name === cr.beneficiary) {
    sum = Math.max(sum + 0 - cr.amount, 0);
  }
  return allRows(person).reduce((a, x) => a + (x.viaJake ? x.amount : 0), sum);
}

// What they pay for themselves — lift pass, and their own flights if they booked them.
const ownSpend = person =>
  allRows(person).reduce((a, x) => a + (x.viaJake ? 0 : x.amount), 0);

/* ---------- render ---------- */

function renderHeader() {
  const t = CONFIG.trip;
  if (!$("title")) return;
  $("title").textContent = t.name;
  $("subtitle").textContent = t.chalet + ", " + t.operator + " · " + fmtDate(t.startDate) + " – " + fmtDate(t.endDate);
  const days = Math.ceil((new Date(t.startDate + "T00:00:00") - new Date()) / 86400000);
  $("days").textContent = days > 0 ? days : "0";
  document.title = t.name;
}

function renderMe() {
  const el = $("me");
  if (!el) return;
  if (!me) { el.innerHTML = ""; return; }

  const s = CONFIG.schedule;
  const total = owedToJake(me);
  const paid = me.depositPaid + me.balancePaid;
  const owed = Math.max(total - paid, 0);
  const depOwed = Math.max(depositFor(me) - me.depositPaid, 0);

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
      '<div class="me-sum">Paid ' + money(paid) + " of " + money(total) + " to Jake" +
        " · about " + money0(ownSpend(me)) + " more you'll pay yourself</div>" +
    "</div>";
}

function renderStats() {
  if (!$("stats")) return;
  const inCount = people.filter(p => p.status === "confirmed").length;
  const paid = payers().reduce((s, p) => s + p.depositPaid + p.balancePaid, 0);
  const due = payers().reduce((s, p) => s + owedToJake(p), 0);
  const outstanding = Math.max(due - paid, 0);
  const open = openSeats();

  $("stats").innerHTML = [
    (() => {
      const totals = payers().map(owedToJake);
      const lo = totals.length ? Math.min(...totals) : totalFor(null);
      const hi = totals.length ? Math.max(...totals) : totalFor(null);
      return Math.round(hi - lo) < 1
        ? ["Owed to Jake", money0(lo), "each"]
        : ["Owed to Jake", money0(lo) + "–" + money0(hi), "differs — some book own flights"];
    })(),
    ["Confirmed", inCount + " of " + CONFIG.trip.groupSize,
      inCount >= CONFIG.trip.groupSize ? "full"
        : open ? open + (open === 1 ? " seat" : " seats") + " open"
        : (CONFIG.trip.groupSize - inCount) + " still to lock in"],
    ["Collected", money0(paid), "of " + money0(due) + " owed to Jake"],
    ["Outstanding", money0(outstanding), outstanding === 0 ? "all square" : "still to come in"],
  ].map(([k, v, n]) =>
    '<div class="stat"><div class="k">' + k + '</div><div class="v">' + v + '</div><div class="n">' + n + "</div></div>"
  ).join("");
}

function renderPeople() {
  if (!$("people")) return;
  $("people").innerHTML = people.map(p => {
    const total = owedToJake(p);
    const paid = p.depositPaid + p.balancePaid;
    const owed = Math.max(total - paid, 0);
    const pct = total > 0 ? Math.min((paid / total) * 100, 100) : 0;
    const noMoney = p.status === "dropped" || p.status === "open";

    const bits = [];
    if (!noMoney) {
      bits.push("Paid " + money(paid) + " of " + money(total));
      bits.push(owed === 0 ? "settled up" : money(owed) + " to go");
    }
    if (p.airport && !noMoney) {
      const po = legFor(p, "out"), pb = legFor(p, "back");
      if (po && pb) {
        bits.push(po.iata === pb.iata
          ? "flying from " + esc(po.airport)
          : "out of " + esc(po.airport) + ", back to " + esc(pb.airport));
      }
    }
    if (p.notes) bits.push(esc(p.notes));

    const isMe = me && p.key && p.key === me.key;

    return '<div class="person' + (isMe ? " is-me" : "") +
      (p.status === "open" ? " open-seat" : "") + '">' +
      '<div class="nm">' + esc(p.name) + (isMe ? ' <span class="you">you</span>' : "") + "</div>" +
      '<span class="pill ' + esc(p.status) + '">' + esc(p.status) + "</span>" +
      '<div class="meta">' + bits.join(" · ") + "</div>" +
      (noMoney ? "" :
        '<div class="bar"><i class="' + (pct >= 100 ? "" : "part") + '" style="width:' + pct.toFixed(1) + '%"></i></div>') +
      "</div>";
  }).join("");

  renderSpotsNote();
}

// What an unfilled seat actually costs everyone else, in pounds.
function renderSpotsNote() {
  if (!$("spotsNote")) return;
  const c = CONFIG.costs;
  const open = openSeats();
  const filled = payers().length;

  // The chalet is a flat per-person rate with a hard minimum of 8. Being short
  // doesn't make it dearer for everyone else — it means there's no booking.
  const shortfall = CONFIG.trip.groupSize - filled;

  if (shortfall > 0) {
    // Martin charges for 8 whoever turns up. Anything not covered by a paying
    // head is money Jake is out of pocket, so say so in pounds.
    const owedToOperator = c.chaletTotal - CONFIG.credit.amount;
    const covered = filled * chaletShare();
    const gap = Math.max(owedToOperator - covered, 0);

    $("spotsNote").innerHTML = '<div class="note" style="margin-top:12px">' +
      "<strong>" + shortfall + " more " + (shortfall === 1 ? "person" : "people") +
      " needed.</strong> " + esc(CONFIG.trip.operator) + " charges for " +
      CONFIG.trip.groupSize + " however many of us go, and the price is " +
      money(c.chaletPerHead) + " each either way — so nobody else pays more. " +
      (gap > 0
        ? "But " + money(gap) + " of the chalet isn't covered by anyone, and Jake " +
          "is carrying it until the " + (shortfall === 1 ? "last seat is" : "seats are") +
          " filled. Split across the " + filled + " of us that's " +
          money(gap / filled) + " each."
        : "") +
      "</div>";
    return;
  }

  $("spotsNote").innerHTML = '<div class="note info" style="margin-top:12px">All ' +
    CONFIG.trip.groupSize + " places filled.</div>";
}

function renderCreditToggle() {
  if (!$("creditToggle")) return;
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
  if (!$("breakdown")) return;
  const c = CONFIG.costs, cr = CONFIG.credit;
  const heads = Math.max(counted().length, 1);
  const rows = [];

  rows.push(["Chalet <span class='est'>per person, min 8</span>", money(c.chaletPerHead)]);
  if (creditView === "split" && cr.amount > 0) {
    rows.push(["Operator credit, split " + heads + " ways", "&minus;" + money(cr.amount / heads)]);
  }
  allRows(me).filter(x => x.viaJake).forEach(x => {
    rows.push([esc(x.label) + (x.note ? " <span class='est'>" + esc(x.note) + "</span>" : ""), money(x.amount)]);
  });

  const own = allRows(me).filter(x => !x.viaJake);
  const totalRow =
    '<tr class="total"><td>' + (me ? "You pay Jake" : "Paid to Jake") +
      '</td><td class="num">' + money(owedToJake(me)) + "</td></tr>" +
    (own.length
      ? '<tr><td colspan="2" style="padding-top:14px;font-size:11px;text-transform:uppercase;' +
        'letter-spacing:.07em;color:var(--ink-faint);font-weight:700">You sort yourself</td></tr>' +
        own.map(x => "<tr><td>" + esc(x.label) +
          (x.note ? " <span class='est'>" + esc(x.note) + "</span>" : "") +
          '</td><td class="num">' + money(x.amount) + "</td></tr>").join("") +
        '<tr class="total"><td>Whole trip, roughly</td><td class="num">' +
          money(owedToJake(me) + ownSpend(me)) + "</td></tr>"
      : "");

  $("breakdown").innerHTML =
    "<thead><tr><th>Item</th><th class='num'>Per person</th></tr></thead><tbody>" +
    rows.map(([k, v]) => "<tr><td>" + k + '</td><td class="num">' + v + "</td></tr>").join("") +
    totalRow + "</tbody>";

  const notes = [];
  if (cr.amount === 0) {
    notes.push("The operator credit from the cancelled 2026 booking isn't in these numbers yet — the amount is still to be confirmed.");
  } else if (creditView === "jake") {
    notes.push("The " + money(cr.amount) + " credit comes off " + esc(cr.beneficiary) +
      "'s balance only, taking it to " + money(totalFor({ name: cr.beneficiary })) +
      ". Everyone else pays the figure above.");
  }
  const guesses = [...c.extras, ...travelRows()].filter(x => x.estimate).map(x => esc(x.label));
  if (guesses.length) {
    const list = guesses.length === 1 ? guesses[0]
      : guesses.slice(0, -1).join(", ") + " and " + guesses.slice(-1);
    notes.push(list + " " + (guesses.length === 1 ? "is an estimate" : "are estimates") +
      " rather than a firm quote, so treat the total as close but not final.");
  }
  const c2 = chosenFlight();
  if (c2 && !countTransport()) {
    notes.push("Not counted above: getting to " + esc(c2.airport) + ", roughly " +
      money0(transferPerHead(c2)) + " each " +
      (CONFIG.transport.chosen === "cars" ? "sharing two cars" : "on a minibus") +
      ". We'll settle that nearer the time.");
  }

  $("creditNote").innerHTML = notes.length
    ? '<div class="note info" style="margin-top:12px">' + notes.join(" ") + "</div>" : "";
}

// The deposit covers what Jake is out of pocket up front: his share of Martin's
// chalet deposit, plus the flight for anyone whose seat Jake is booking.
function depositFor(person) {
  const s = CONFIG.schedule;
  let d = s.depositPerHead;
  if (s.depositFlights && flightViaJake(person)) {
    const row = travelRows(person).find(x => x.label === "Flights");
    if (row) d += row.amount;
  }
  return d;
}

function renderSchedule() {
  if (!$("schedule")) return;
  const s = CONFIG.schedule;
  const dep = depositFor(me);
  const balance = Math.max(owedToJake(me) - dep, 0);
  $("schedule").innerHTML = [
    ["Deposit", money(dep) + " by " + fmtShort(s.depositDue) +
      (flightViaJake(me) ? " — covers your flight" : "")],
    ["Balance", money(balance) + " by " + fmtShort(s.balanceDue)],
    ["How", esc(s.payTo)],
  ].map(([k, v]) => '<div class="kv"><span>' + k + "</span><span>" + v + "</span></div>").join("");
}

function renderTransportToggle() {
  if (!$("transportToggle")) return;
  const t = CONFIG.transport;
  if (!t) { $("transportToggle").innerHTML = ""; return; }

  const opts = [
    ["cars", t.cars.count + " cars, parked"],
    ["minibus", "Minibus"],
  ];
  $("transportToggle").innerHTML = opts.map(([v, label]) =>
    '<button data-mode="' + v + '" aria-pressed="' + (t.chosen === v) + '">' +
    esc(label) + "</button>").join("");
  $("transportToggle").querySelectorAll("button").forEach(b =>
    b.addEventListener("click", () => { CONFIG.transport.chosen = b.dataset.mode; renderAll(); }));
}

function renderFlightOptions() {
  if (!$("flightOptions")) return;
  const fo = CONFIG.flightOptions;
  if (!fo || !fo.choices.length) { $("flightOptions").innerHTML = ""; return; }

  const t = CONFIG.transport;
  const cars = !t || t.chosen === "cars";
  const cheapest = Math.min(...fo.choices.map(optionTotal));

  const cards = fo.choices.map(c => {
    const picked = c.iata === fo.chosen;
    const total = optionTotal(c);
    const diff = total - cheapest;
    const back = parseInt(homeBy(c).split(":")[0], 10);
    const lateHome = back >= 23 || back < 6;

    return '<div class="opt' + (picked ? " picked" : "") + '">' +
      '<div class="opt-head">' +
        "<div><strong>" + esc(c.airport) + "</strong>" +
          (picked ? ' <span class="you">current plan</span>' : "") +
          '<div class="opt-drive">' + esc(c.transfer.drive) + " from York</div></div>" +
        '<div class="opt-price">' + money0(total) +
          '<div class="opt-sub">' +
          (countTransport() ? "flights + bag + " + (cars ? "cars" : "minibus") : "flights + bag") +
          (diff === 0 ? "" : " · +" + money0(diff)) + "</div></div>" +
      "</div>" +
      '<div class="opt-legs">' +
        '<div><span class="lbl">Out</span> ' + esc(c.out.depart) + " &rarr; " + esc(c.out.arrive) +
          ' <span class="est">' + esc(c.out.code) + " · " + money(c.out.fare) + "</span></div>" +
        '<div><span class="lbl">Back</span> ' + esc(c.back.depart) + " &rarr; " + esc(c.back.arrive) +
          ' <span class="est">' + esc(c.back.code) + " · " + money(c.back.fare) + "</span></div>" +
        (countTransport() ? "" :
          '<div><span class="lbl">Airport</span> ~' + money0(transferPerHead(c)) +
          ' <span class="est">each, ' + (cars ? "sharing two cars" : "minibus") +
          " — not in the price above</span></div>") +
        '<div><span class="lbl">Home</span> <span' + (lateHome ? ' style="color:var(--warn)"' : "") +
          ">~" + homeBy(c) + "</span>" +
          ' <span class="est">' + (cars ? "after driving yourselves" : "minibus drops you off") + "</span></div>" +
      "</div>" +
      '<div class="opt-verdict">' + esc(c.verdict) + "</div>" +
    "</div>";
  }).join("");

  $("flightOptions").innerHTML = cards;
}

function renderFlights() {
  if (!$("flights")) return;
  const f = CONFIG.flights, t = CONFIG.trip;
  const o = legFor(me, "out"), b = legFor(me, "back");
  if (!o || !b) { $("flights").innerHTML = ""; return; }
  const c = flightFor(me);

  const leg = (l, label, date, from, to) =>
    '<div class="flight">' +
      '<div><div class="code">' + esc(l.code) + '</div><div class="time">' + esc(l.depart) +
        '</div><div class="apt">' + esc(from) + "</div></div>" +
      '<div class="mid">' + label + " &rarr;</div>" +
      '<div style="text-align:right"><div class="code">&nbsp;</div><div class="time">' + esc(l.arrive) +
        '</div><div class="apt">' + esc(to) + "</div></div>" +
      '<div class="when">' + fmtDate(date) + " · " + esc(f.airline) + ", " + esc(f.fare) + "</div>" +
    "</div>";

  const there = "Sofia (SOF)";
  const outFrom = o.airport + " (" + o.iata + ")";
  const backTo  = b.airport + " (" + b.iata + ")";

  const warnings = [];
  if (f.booked === false && f.notBookedWarning) warnings.push(f.notBookedWarning);

  // A pre-09:00 flight home means leaving the chalet in the middle of the night.
  const backHour = parseInt(b.depart.split(":")[0], 10);
  if (backHour < 9) {
    warnings.push(c.back.depart + " departure — chalet pickup around " +
      String((backHour + 19) % 24).padStart(2, "0") + ":00. Pack the night before.");
  }

  if (o.iata !== b.iata) {
    warnings.unshift("Out of " + o.airport + " with everyone, back into " + b.airport +
      ". That's two one-way tickets rather than a return, so price it before booking — " +
      "Ryanair one-ways aren't always half a return.");
  }

  $("flights").innerHTML =
    leg(o, "Out", t.startDate, outFrom, there) +
    leg(b, "Back", t.endDate, there, backTo) +
    (warnings.length
      ? '<div class="pad">' + warnings.map(w => '<div class="note" style="margin-bottom:8px">' +
          esc(w) + "</div>").join("") + "</div>"
      : "");
}

function renderRooms() {
  if (!$("rooms")) return;
  const r = CONFIG.rooms;
  if (!r || !r.list.length) { $("rooms").innerHTML = ""; return; }

  const doubles = r.list.reduce((a, x) => a + x.doubles, 0);
  const singles = r.list.reduce((a, x) => a + x.singles, 0);
  const ownBed = doubles + singles;          // nobody shares a double
  const shared = doubles * 2 + singles;      // couples in the doubles
  const heads = payers().length;
  const spareRooms = r.list.length - heads;

  const beds = x => {
    const bits = [];
    if (x.doubles) bits.push(x.doubles + " double" + (x.doubles > 1 ? "s" : ""));
    if (x.singles) bits.push(x.singles + " single" + (x.singles > 1 ? "s" : ""));
    return bits.join(" + ");
  };

  const stat = (k, v, n) =>
    '<div class="stat"><div class="k">' + k + '</div><div class="v">' + v +
    '</div><div class="n">' + n + "</div></div>";

  $("rooms").innerHTML =
    '<div class="stats" style="margin-bottom:12px">' +
      stat("Bedrooms", r.list.length, doubles + " doubles, " + singles + " singles") +
      stat("Own bed each", ownBed, "nobody sharing a double") +
      stat("Absolute max", shared, "if doubles are shared") +
      stat("Us", heads, spareRooms > 0
        ? spareRooms + " spare room" + (spareRooms === 1 ? "" : "s")
        : "every room used") +
    "</div>" +
    '<div class="card">' +
      r.list.map(x => '<div class="kv"><span>' + esc(x.name) + "</span><span>" +
        esc(beds(x)) + "</span></div>").join("") +
    "</div>" +
    (spareRooms > 0
      ? '<div class="note info" style="margin-top:12px">We have the whole chalet, and ' +
        "there are more bedrooms than there are of us — so everyone can have their own " +
        "room, let alone their own bed. Room for " + (ownBed - heads) +
        " more before anyone would have to share a double." +
        (r.useLounge === false ? " The lounge sofabed is spare on top of all this." : "") +
        "</div>"
      : "");
}

function renderInfo() {
  if (!$("included")) return;
  const t = CONFIG.trip;
  $("chaletLink").innerHTML =
    '<div class="card pad" style="margin-bottom:12px">' +
      "<strong>" + esc(t.chalet) + "</strong>" +
      '<p style="margin:4px 0 10px;color:var(--ink-soft);font-size:14px">' +
        "Have a look round before we go — photos, rooms, the lot." + "</p>" +
      '<a href="' + esc(t.chaletUrl) + '" target="_blank" rel="noopener">See the chalet &rarr;</a>' +
    "</div>";

  $("included").innerHTML = CONFIG.included.map(i => "<li>" + esc(i) + "</li>").join("");
  const travel = travelRows().map(r => ({
    item: r.label, note: "~" + money0(r.amount) + "pp, " + r.note.replace(/^estimate — /, ""),
  }));
  $("notIncluded").innerHTML = [...travel, ...CONFIG.notIncluded].map(i =>
    "<li>" + esc(i.item) + ' <span class="est">' + esc(i.note) + "</span></li>").join("");

  $("packing").innerHTML = CONFIG.packing.map(g =>
    '<div class="card pad"><strong>' + esc(g.group) + "</strong><ul class='plain'>" +
    g.items.map(i => "<li>" + esc(i) + "</li>").join("") + "</ul></div>").join("");

  if ($("footer")) $("footer").textContent = "Updated " + new Date().toLocaleString("en-GB",
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
  renderTransportToggle();
  renderFlightOptions();
  renderRooms();
  renderInfo();
}

(async function init() {
  if (isPublicPage) {
    people = [];               // deliberately never loaded — see isPublicPage
    renderAll();
    return;
  }

  people = await loadPeople();
  me = resolveMe();
  if (CONFIG.access.requireKey && !(demoMode && isLocal) && !me) { renderHeader(); renderGate(); return; }
  renderAll();
})();
