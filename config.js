/* ------------------------------------------------------------------
   BANSKO 2027 — CONFIG
   Everything you might need to change lives in this one file.
   Payment amounts live in the Zoho Sheet, not here.
   ------------------------------------------------------------------ */

const CONFIG = {

  /* --- Data layer --------------------------------------------------
     This must be the Cloudflare Worker URL, NOT the Zoho link.

     Zoho's published-sheet endpoint serves the CSV fine to a server but
     sends no Access-Control-Allow-Origin header, so a browser fetch is
     blocked outright. Tested and confirmed 17 Aug 2026. The Worker in
     ./worker fetches it server-side and re-serves it with CORS; the Zoho
     URL lives inside the Worker, so it never reaches the browser.

     Redeploy after any change: cd worker && npx wrangler deploy
     Lives in the JHTS Cloudflare account (pinned by account_id in
     worker/wrangler.toml), free tier.

     The sheet itself: Bansko 2027 Payments, in Jake's WorkDrive
     https://sheet.zoho.eu/sheet/open/bmutud5fb91ec26e640b6851e769a4869a38e

     Leave empty and the site runs on seedPeople below, with the
     personal-link check still enforced anywhere but localhost.        */
  dataUrl: "https://bansko-roster.bansko-roster-worker.workers.dev",

  /* --- Access ------------------------------------------------------
     Each person gets their own link: <siteUrl>/?k=THEIRKEY
     Mint the keys with links.html, paste them into the Sheet's Key
     column, then WhatsApp each person their link.
     requireKey: false shows the page to anyone who has the URL.      */
  access: {
    requireKey: true,
    siteUrl: "https://bansko.jh-tech.co.uk",
    rememberDays: 180,   // how long a device stays signed in
  },

  /* --- Trip ------------------------------------------------------ */
  trip: {
    name: "Bansko 2027",
    // Moved from River Pine to Ginchini on 14 Aug 2026 — River Pine and Snow
    // Pine both went to a returning 30+ group. Confirmed booked 17 Aug 2026.
    chalet: "Ginchini Chalet",
    operator: "Explore Bansko Chalets",
    chaletUrl: "https://explorebansko-chalets.com/ginchini-chalet",
    startDate: "2027-03-06",
    endDate: "2027-03-13",
    groupSize: 8,          // price is based on 8 — below this the deal changes
  },

  /* --- Money (all £ per person unless stated) ---------------------
     The chalet is handled separately because the operator credit comes
     off it. Everything else is a line in `extras` — add or remove rows
     freely (lessons, insurance, whatever) and the page keeps up.        */
  costs: {
    // £420 PER PERSON, not a fixed pot to be divided. Martin, 6 Oct 2025:
    // "prices go down and are calculated per person not a set amount. The
    // minimum required group size is 8." So more people does not make it
    // cheaper, and fewer than 8 isn't a price rise — it's no booking.
    chaletPerHead: 420,
    chaletTotal: 3360,   // display only: 420 x 8

    // Non-travel extras only. Flights and the airport run are derived from
    // whichever option is picked in `flightOptions` below, so the breakdown
    // always matches the chosen airport.
    extras: [
      { label: "Lift pass",
        note: "estimate, buy in resort",
        amount: 295, estimate: true },
    ],
  },

  /* --- Flight options ----------------------------------------------
     Nothing is booked. Fares below are real Ryanair prices for a party
     of 8, checked 17 Aug 2026, and they will move.

     Set `chosen` to an iata code and the whole page follows it — cost
     breakdown, per-head total, the lot.                                */
  flightOptions: {
    chosen: "LPL",
    // 20kg check-in bag, both ways. Ryanair publish £18.99–£59.99 per
    // flight depending on route and date; ~£37 each way fits this route.
    bagPerHead: 75,
    bagNote: "20kg hold bag, both ways",
    choices: [
      {
        iata: "LPL", airport: "Liverpool", drive: "1h 45m from York",
        out:  { code: "FR6338", depart: "08:05", arrive: "13:25", fare: 57.74 },
        back: { code: "FR6337", depart: "06:00", arrive: "07:40", fare: 69.99 },
        transferPerHead: 60,
        verdict: "Nearest airport, but the worst schedule. 01:00 chalet pickup on the way home.",
      },
      {
        iata: "BHX", airport: "Birmingham", drive: "2h 30m from York",
        out:  { code: "FR6336", depart: "06:15", arrive: "11:25", fare: 57.84 },
        back: { code: "FR6335", depart: "11:55", arrive: "13:25", fare: 57.84 },
        transferPerHead: 75,
        verdict: "Civilised trip home, but a 01:30 start from York on the way out.",
      },
      {
        iata: "STN", airport: "London Stansted", drive: "3h 30m from York",
        out:  { code: "FR8515", depart: "15:45", arrive: "20:50", fare: 43.89 },
        back: { code: "FR8516", depart: "21:15", arrive: "22:35", fare: 50.44 },
        transferPerHead: 110,
        verdict: "Best schedule by a mile — a lie-in on the way out and a full last day on the mountain. Longest drive.",
      },
    ],
  },

  /* --- Operator credit from the cancelled 2026 booking ------------
     creditAmount: set the £ figure once Martin/Milen confirm it.
     creditMode:   "split"  -> credit knocked off the chalet total,
                              everyone's chalet share drops equally
                   "jake"   -> credit comes off Jake's balance only
                   "both"   -> show a toggle on the page, decide later */
  credit: {
    amount: 600,           // confirmed by Martin, 7 Aug 2026
    mode: "both",
    defaultView: "split",  // which scenario shows first when mode = "both"
    beneficiary: "Jake Hodgson",
  },

  /* --- Payment schedule -------------------------------------------
     What the OPERATOR wants (confirmed by Martin, 17 Aug 2026):
       30% of £3,360 ≈ £1,000 deposit, less the £600 credit = £400 now.
       Final balance 2 weeks before arrival, i.e. by 20 Feb 2027.
       Paid in EUR by bank transfer. Bank details are deliberately NOT in
       this file — they must not end up on a public page. They're in
       Martin's email of 17 Aug 2026.

     What JAKE collects from everyone is set below, and is his own call. */
  schedule: {
    depositPerHead: 100,
    depositDue: "2026-09-30",
    balanceDue: "2027-02-20",   // operator's deadline: 2 weeks before arrival
    payTo: "Bank transfer to Jake — ask him for details",
  },

  /* --- Flights ---------------------------------------------------- */
  flights: {
    airline: "Ryanair",
    fare: "basic fare plus a 20kg hold bag",
    // Not booked as of 17 Aug 2026, and the airport isn't settled either —
    // see flightOptions. Times and codes below follow flightOptions.chosen.
    booked: false,
    notBookedWarning: "Not booked yet, and the airport isn't settled — see the " +
      "options below. Fares move, and eight seats going at once is what pushes " +
      "them into the next price band.",
  },

  /* --- What you get ----------------------------------------------- */
  // NOTE: this list came from the River Pine quote. Ginchini's own listing
  // mentions a sauna but no hot tub — confirm with Martin before promising one.
  included: [
    "Breakfast every morning",
    "3-course evening meal (one night off)",
    "Beer and wine with dinner",
    "Sofia airport transfers, both ways",
    "Full ski hire — skis, boots, poles, helmet",
    "Sauna",
    "Daily shuttle to and from the gondola station",
  ],

  // Flights and the airport run are added automatically from the chosen
  // flight option, so they can't go stale when the airport changes.
  notIncluded: [
    { item: "Lift pass", note: "~£295pp, buy in resort" },
    { item: "Lessons", note: "Only if anyone wants them" },
    { item: "Shuttle to mountain top", note: "€8pp/day — not needed in March" },
    { item: "Food on the night off", note: "One evening, eat in town" },
  ],

  packing: [
    { group: "Must have", items: [
      "Passport (check expiry — 3+ months beyond 13 Mar 2027)",
      "GHIC / travel insurance with winter sports cover",
      "Ski jacket and salopettes",
      "Goggles and sunglasses",
      "Gloves — two pairs, one will get soaked",
    ]},
    { group: "Bring", items: [
      "Thermals — two sets minimum",
      "Ski socks — one pair per day",
      "Neck warmer / buff",
      "Sun cream, factor 30+ (snow glare is brutal)",
      "Swim shorts for the sauna",
    ]},
    { group: "Don't bother", items: [
      "Skis, boots, poles, helmet — all included in the hire",
      "Bulky towels — chalet provides",
      "Lots of cash — card works nearly everywhere, some leva for the huts",
    ]},
  ],

  /* --- Operator ----------------------------------------------------
     Martin/Milen's email and phone number are deliberately NOT here.
     The lads don't need them, and this page shouldn't hand out a
     supplier's direct contact details. Jake deals with the operator.
     The only outward link is the chalet page in trip.chaletUrl.        */

  /* --- Fallback roster --------------------------------------------
     Used only until dataUrl is filled in. Same shape as the Sheet.
     status: confirmed | pending | open | dropped | unknown
       open   = the seat exists and is priced, but nobody's in it yet.
                Counts towards the 8 for pricing, ignored for money owed.
       dropped= out entirely. Drops out of the head count, so the chalet
                re-splits across whoever is left and the price goes up.  */
  seedPeople: [
    { name: "Jake Hodgson",   key: "demo-jake",  status: "confirmed", depositPaid: 0, balancePaid: 0, notes: "Organiser" },
    { name: "Jake Love",      key: "demo-love",  status: "confirmed", depositPaid: 0, balancePaid: 0, notes: "" },
    { name: "Steve Turnbill", key: "demo-steve", status: "confirmed", depositPaid: 0, balancePaid: 0, notes: "" },
    { name: "Matt Barker",    key: "demo-matt",  status: "confirmed", depositPaid: 0, balancePaid: 0, notes: "" },
    { name: "Adam Swan",      key: "demo-adam",  status: "confirmed", depositPaid: 0, balancePaid: 0, notes: "" },
    { name: "Jack Myhill",    key: "demo-jack",  status: "confirmed", depositPaid: 0, balancePaid: 0, notes: "" },
    { name: "James Primmer",  key: "demo-james", status: "pending",   depositPaid: 0, balancePaid: 0, notes: "Awaiting wife's approval" },
    { name: "8th place",      key: "",           status: "open",      depositPaid: 0, balancePaid: 0, notes: "Seat open — needs a name to hold the £420pp chalet price" },
  ],
};
