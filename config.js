/* ------------------------------------------------------------------
   BANSKO 2027 — CONFIG
   Everything you might need to change lives in this one file.
   Payment amounts live in the Google Sheet, not here.
   ------------------------------------------------------------------ */

const CONFIG = {

  /* --- Google Sheet data layer -----------------------------------
     Paste the "publish to web" CSV URL here. See README.md step 3.
     Leave empty and the site falls back to SEED_PEOPLE below.       */
  sheetCsvUrl: "",

  /* --- Access ------------------------------------------------------
     Each person gets their own link: <siteUrl>/?k=THEIRKEY
     Mint the keys with links.html, paste them into the Sheet's Key
     column, then WhatsApp each person their link.
     requireKey: false shows the page to anyone who has the URL.      */
  access: {
    requireKey: true,
    siteUrl: "https://bansko.jhtechnicalsolutions.co.uk",
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

  /* --- Money (all £ per person unless stated) --------------------- */
  costs: {
    chaletPerHead: 420,
    chaletTotal: 3360,
    flightsPerHead: 202.24,
    liftPassPerHead: 295,   // ESTIMATE — confirm before collecting balances
    liftPassIsEstimate: true,
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
    fare: "PLUS fare, 20kg hold bag included",
    out: {
      code: "FR6338", date: "2027-03-06",
      from: "Liverpool (LPL)", to: "Sofia (SOF)",
      depart: "08:05", arrive: "13:25",
    },
    back: {
      code: "FR6337", date: "2027-03-13",
      from: "Sofia (SOF)", to: "Liverpool (LPL)",
      depart: "06:00", arrive: "07:40",
      warning: "06:00 departure — chalet pickup around 01:00. Pack the night before.",
    },
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

  notIncluded: [
    { item: "Lift pass", note: "~£295pp, buy in resort" },
    { item: "Flights", note: "£202.24pp, booked separately" },
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

  /* --- Operator --------------------------------------------------- */
  contact: {
    names: "Martin / Milen",
    company: "Explore Bansko Chalets",
    email: "enquiries@explore-bansko.com",
    whatsapp: "+44 7753683704",
    website: "https://explorebansko-chalets.com/",
  },

  /* --- Fallback roster --------------------------------------------
     Used only until sheetCsvUrl is filled in. Same shape as the Sheet.
     status: confirmed | pending | dropped | unknown                  */
  seedPeople: [
    { name: "Jake Hodgson",   key: "demo-jake",  status: "confirmed", depositPaid: 0, balancePaid: 0, notes: "Organiser" },
    { name: "Jake Love",      key: "demo-love",  status: "confirmed", depositPaid: 0, balancePaid: 0, notes: "" },
    { name: "Steve",          key: "demo-steve", status: "confirmed", depositPaid: 0, balancePaid: 0, notes: "" },
    { name: "Matt",           key: "demo-matt",  status: "confirmed", depositPaid: 0, balancePaid: 0, notes: "" },
    { name: "Adam",           key: "demo-adam",  status: "confirmed", depositPaid: 0, balancePaid: 0, notes: "" },
    { name: "Jack",           key: "demo-jack",  status: "confirmed", depositPaid: 0, balancePaid: 0, notes: "" },
    { name: "James (Primmer)",key: "demo-james", status: "pending",   depositPaid: 0, balancePaid: 0, notes: "Awaiting wife's approval" },
    { name: "Luke",           key: "demo-luke",  status: "unknown",   depositPaid: 0, balancePaid: 0, notes: "Not responded — may need an 8th" },
  ],
};
