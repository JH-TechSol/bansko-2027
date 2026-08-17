# Bansko 2027 — trip tracker

Static site. Payment data lives in a Zoho Sheet so you can update it from your
phone without touching any files. Everyone gets their own link, which greets them
by name and shows what they still owe.

```
index.html    the page everyone sees
config.js     every number, date and bit of text you'd want to change
app.js        fetches the roster, does the maths, renders the page
worker/       Cloudflare Worker that serves the Zoho CSV to the browser
links.html    mints one personal link per person — run locally, don't deploy
roster-template.csv   import this into the Zoho Sheet to start
```

## How the personal links work

Each person has a random 10-character key in the Sheet's `Key` column. Their link is
`https://your-site/?k=THEIRKEY`. Opening it once stores the key on that phone and
strips it from the address bar, so they never need the link again on that device.

**What this does:** keeps the page out of casual hands, and puts each person's own
balance at the top of their page. Because the Worker is origin-locked and holds the
Zoho URL as a secret, the roster is not reachable except through the site itself —
so someone who finds the bare site URL sees the "you need your own link" screen and
has nothing else to pull on.

**What this does not do:** stop one of the eight from sharing their own link, or from
opening dev tools and reading the roster the page already loaded. Everyone sees
everyone's figures by design, so that costs nothing here. It is still the reason
there is **no mobile number column, and there must never be one.** Names, statuses
and amounts only — no phone numbers, no addresses, no bank details.

If you ever want per-person data rather than shared visibility, the upgrade is to
move the key check into the Worker so it only ever returns the requesting person's
row. The Worker already exists, so that's a change rather than a rebuild.

---

## Setup — about 10 minutes

### 1. Fill in the Sheet
The workbook already exists in your WorkDrive private space:

**Bansko 2027 Payments** — <https://sheet.zoho.eu/sheet/open/bmutud5fb91ec26e640b6851e769a4869a38e>

It's empty. Open it and **File → Import → Upload** `roster-template.csv`, replacing
the current sheet.

Columns the site reads (header row must exist, order doesn't matter, case doesn't matter):

| Column | What goes in it |
|---|---|
| `Name` | Required. The row is ignored if this is blank. |
| `Key` | Leave blank — `links.html` fills these in at step 6. |
| `Status` | See below |
| `Deposit Paid` | £ actually received. `0` if nothing yet. |
| `Balance Paid` | £ actually received. |
| `Notes` | Free text, shows under their name |

`Status` values: `confirmed`, `pending`, `open`, `dropped`, `unknown`.

- `open` — the seat exists and is priced, but nobody's in it. Counts towards the 8
  for pricing, ignored for money owed. This is what the "8th place" row uses.
- `dropped` — out entirely. Drops out of the head count, so the chalet re-splits
  across whoever is left and the price per head goes up. The page spells the rise
  out in pounds, which is the conversation you want to be able to show people
  rather than argue about.

### 2. Publish it as CSV
In the sheet: **Share → Publish**, publish to the external world, and make sure
**Allow to export** stays ticked. The publish dialog gives you both a published URL
and a **downloadable link** — you want the downloadable one, set to CSV.

Publishing makes that CSV readable by anyone with the link. It does not make the
sheet editable and it doesn't expose the rest of your WorkDrive.

To unpublish later, the same dialog has the switch.

### 3. Deploy the CSV proxy

**Zoho's published CSV cannot be read by a browser.** Tested 17 Aug 2026: the
endpoint returns the CSV happily to a server, but sends no
`Access-Control-Allow-Origin` header, so the browser refuses it —

```
Access to fetch at 'https://sheet.zohopublic.eu/...' has been blocked by CORS
policy: No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

`worker/` solves it. It fetches the sheet server-side and re-serves it with CORS:

```
cd worker && npx wrangler deploy
```

That gives you `https://bansko-roster.<your-subdomain>.workers.dev`. Free tier
covers this many times over.

Two things it buys beyond fixing CORS:

- **The Zoho URL never reaches the browser.** It's held as a Worker secret
  (`SHEET_CSV`), so it is in neither the page source nor this repo. It was
  briefly hardcoded in `worker/index.js`, which would have exposed the whole
  roster — keys included — the moment this repo went public. Set or rotate it
  with `echo "<url>" | npx wrangler secret put SHEET_CSV`.
- **Origin-locked.** Only `bansko.jh-tech.co.uk` and the local preview
  can read it. Anything else gets a 403.

If you ever change the published link, update the `SHEET_CSV` secret and redeploy —
no change to the site itself.

### 4. Wire it up
Open `config.js` and paste the **Worker** URL into `dataUrl` — not the Zoho link.
That's the only edit needed.

If the sheet is ever unpublished or the link changes, the page falls back to the
built-in roster and shows a warning banner rather than breaking.

### 5. Host it
Any static host works — no build step, no server.

- **Cloudflare Pages** (fits your existing setup): create a project, connect the repo
  or drag the folder in, add `bansko.jh-tech.co.uk` as a custom domain.
- **GitHub Pages**: push to a repo under JH-TechSol, Settings → Pages → deploy from
  `main`, then point a CNAME at it. Same as the MEC demo.

Published sheets are cached for a few minutes, so a payment you enter now shows up on
the site shortly afterwards rather than instantly.

**Don't upload `links.html`** — or delete it from the host once you've sent the links.
It lists everyone's key on one screen.

### 6. Mint the links and send them
Open `links.html` by double-clicking it (it works straight off your Mac, no server).
Paste in the **Worker** URL and your site URL, hit **Load roster and mint keys**, then:

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

Confirmed from Martin's email of 17 Aug 2026 and already in `config.js`: the chalet
is **Ginchini** (River Pine went to a bigger group), the credit is **£600**, the
deposit is 30% less that credit = **£400 payable now**, and the balance is due
**2 weeks before arrival, 20 Feb 2027**. Per head is **£902.24**.

Open items:

1. `credit.mode` — set to `"both"`, which puts a toggle on the page: credit split 8
   ways vs. all against Jake's own share. Once decided, change it to `"split"` or
   `"jake"` and the toggle disappears.
2. `schedule.depositPerHead` — currently £100, which covers Martin's £400 with a bit
   spare. If the flights are already paid for out of pocket, this wants to be nearer
   £300 so the money comes back in.
3. `costs.extras` — the lift pass (£295) and the York→Liverpool minibus (£60) are
   both marked `estimate: true` and labelled as estimates on the page. Drop the flag
   once either is firm.
4. **Ginchini's hot tub.** The included list came from the River Pine quote; the
   Ginchini listing mentions a sauna only, so the hot tub has been removed. Worth
   confirming with Martin.
5. **Group size.** You get sole use of the chalet, which sleeps 23 across 10
   bedrooms, so there is a lot of room to grow. But the rate is per person, so
   extra people cost the existing group money rather than saving it — see
   "Adding people" below.

---

## Privacy

The page carries `noindex, nofollow` so search engines skip it, and the personal-link
check keeps out anyone who wanders onto the bare URL. See "How the personal links
work" above for the honest limits of that — the short version is: names, statuses and
amounts are fine to put in the Sheet; phone numbers, addresses and bank details are not.

---

## Adding people

You get **sole use** of Ginchini — 10 bedrooms, 23 beds — so space isn't the
constraint. Money is, and it works the opposite way to how group trips usually do.

The chalet is **£420 per person**, not a fixed pot. So an extra person doesn't
split the cost further; they just add £420 to the total. And because the £600
operator credit is shared out, every extra head makes it slightly *worse* for
everyone already in:

| People | Chalet after credit | All-in per head |
|---|---|---|
| 8 | £345.00 | £902.24 |
| 10 | £360.00 | £917.24 |
| 12 | £370.00 | £927.24 |
| 15 | £380.00 | £937.24 |

Beds, if nobody wants to share a double: five doubles (rooms 1, 2, 7, 8, 9) used
as singles, two confirmed twin rooms (3 and 5), and three sleeps-3 rooms (4, 6,
10). That's roughly 15–18 people each with their own bed.

**Before offering anyone a price**, get Martin to confirm £420pp still holds
above 8 — his October 2025 list was explicitly "based on 8 person". Worth asking
for a flat rate if you go large: the 2026 half-term quote was £8,000 for up to 20
guests, so somewhere around 19 people the per-person rate stops making sense.
