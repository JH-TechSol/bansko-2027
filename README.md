# Bansko 2027 — trip tracker

Static site. Payment data lives in a Google Sheet so you can update it from your
phone without touching any files. Everyone gets their own link, which greets them
by name and shows what they still owe.

```
index.html    the page everyone sees
config.js     every number, date and bit of text you'd want to change
app.js        fetches the Sheet, does the maths, renders the page
links.html    mints one personal link per person — run locally, don't deploy
roster-template.csv   import this into Google Sheets to start
```

## How the personal links work

Each person has a random 10-character key in the Sheet's `Key` column. Their link is
`https://your-site/?k=THEIRKEY`. Opening it once stores the key on that phone and
strips it from the address bar, so they never need the link again on that device.

**What this does:** keeps the page out of casual hands, and puts each person's own
balance at the top of their page.

**What this does not do:** protect the data cryptographically. The Sheet is published
as CSV, so anyone holding any link could read the whole sheet if they went looking.
That is fine for eight mates who all see each other's figures anyway — but it is the
reason there is **no mobile number column, and there must never be one.** Names,
statuses and amounts only.

If you ever need real protection, the upgrade is a Cloudflare Worker sitting in front
of the Sheet with SMS or email verification. That is a rebuild, not a setting.

---

## Setup — about 10 minutes

### 1. Make the Sheet
Go to <https://sheets.new>, then **File → Import → Upload** `roster-template.csv`,
choosing "Replace spreadsheet". Name it `Bansko 2027 Payments`.

Columns the site reads (header row must exist, order doesn't matter, case doesn't matter):

| Column | What goes in it |
|---|---|
| `Name` | Required. The row is ignored if this is blank. |
| `Key` | Leave blank — `links.html` fills these in at step 5. |
| `Status` | `confirmed`, `pending`, `dropped` or `unknown` |
| `Deposit Paid` | £ actually received. `0` if nothing yet. |
| `Balance Paid` | £ actually received. |
| `Notes` | Free text, shows under their name |

Anyone marked `dropped` drops out of the head count, and the chalet cost re-splits
across whoever is left. Mark Luke as `dropped` and the per-head figure jumps from
£420 to £480 for the chalet — which is exactly the conversation you want to be able
to show people rather than argue about.

### 2. Publish it
**File → Share → Publish to web** → pick the sheet tab → format **Comma-separated
values (.csv)** → **Publish**. Copy the URL it gives you. It looks like:

```
https://docs.google.com/spreadsheets/d/e/2PACX-1vT.../pub?gid=0&single=true&output=csv
```

Publishing makes that CSV readable by anyone with the link. It does **not** make the
sheet editable, and it does not expose your Drive.

### 3. Wire it up
Open `config.js` and paste the URL into `sheetCsvUrl`. That's the only edit needed.

### 4. Host it
Any static host works — no build step, no server.

- **Cloudflare Pages** (fits your existing setup): create a project, connect the repo
  or drag the folder in, add `bansko.jhtechnicalsolutions.co.uk` as a custom domain.
- **GitHub Pages**: push to a repo under JH-TechSol, Settings → Pages → deploy from
  `main`, then point a CNAME at it. Same as the MEC demo.

Google's published-CSV endpoint caches for a few minutes, so a payment you enter now
shows up on the site within roughly 5 minutes, not instantly.

**Don't upload `links.html`** — or delete it from the host once you've sent the links.
It lists everyone's key on one screen.

### 5. Mint the links and send them
Open `links.html` by double-clicking it (it works straight off your Mac, no server).
Paste in the same CSV URL and your site URL, hit **Load roster and mint keys**, then:

1. **Copy the key column** and paste it into the Sheet's `Key` column, from row 2 down
2. Hit **Copy message** next to each person and paste it into WhatsApp

Keys must match the Sheet exactly. If someone's link stops working, that's the first
thing to check.

---

## Day-to-day use

Someone pays you → open the Sheet on your phone → type the number → done. The site
picks it up on the next page load. No deploys, no code, nothing to break.

Adding a ninth person later: add a row, re-run `links.html` (it only mints keys for
rows that don't have one, so existing links keep working), paste the column back,
send them their link.

---

## Still to confirm

These are placeholders in `config.js`. Replace them when you know:

1. `credit.amount` — the £ credit from the cancelled 2026 booking. Currently `0`,
   so the page shows a note saying it isn't included yet.
2. `credit.mode` — set to `"both"`, which puts a toggle on the page so you can see
   the credit split 8 ways vs. all against your own share. Once you've decided,
   change it to `"split"` or `"jake"` and the toggle disappears.
3. `schedule.depositPerHead`, `depositDue`, `balanceDue` — guessed at £200 by
   30 Sep 2026 and the balance by 31 Jan 2027. Martin/Milen will dictate the real ones.
4. `costs.liftPassPerHead` — £295 is an estimate and is labelled as such on the page.
   Set `liftPassIsEstimate: false` once it's firm.

---

## Privacy

The page carries `noindex, nofollow` so search engines skip it, and the personal-link
check keeps out anyone who wanders onto the bare URL. See "How the personal links
work" above for the honest limits of that — the short version is: names, statuses and
amounts are fine to put in the Sheet; phone numbers, addresses and bank details are not.
