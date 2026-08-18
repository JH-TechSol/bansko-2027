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

     The sheet itself: "Bansko 2027 Payments (live)", in Jake's WorkDrive.
     The original was binned 18 Aug 2026 after its published URL leaked via
     this repo; that URL is dead and the file ID here is a fresh one.
     https://sheet.zoho.eu/sheet/open/pwyueff75bba5b3934854b04be7d522211658

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
     Nothing is booked. Fares are real Ryanair prices for a party of 8,
     checked 17 Aug 2026, and they will move.

     Set `chosen` to an iata code and the whole page follows it — cost
     breakdown, per-head total, the lot.

     Ruled out and not shown:
       Stansted — cheapest at £204pp and a full last day skiing, but it
         lands 22:35 and puts someone on a 3h20 drive home to ~02:00.
         Dropped on Jake's call, 18 Aug 2026.
       Luton — Google Flights advertises a Wizz Air nonstop LTN-SOF, but
         Wizz's own booking engine has no such service on any date tried.
       Manchester, Leeds Bradford, Newcastle — no direct Sofia service.  */
  flightOptions: {
    chosen: "BHX",
    // 20kg check-in bag, both ways. Ryanair publish £18.99–£59.99 per
    // flight depending on route and date; ~£37 each way fits this route.
    bagPerHead: 75,
    bagNote: "20kg hold bag, both ways",
    choices: [
      {
        iata: "LPL", airport: "Liverpool",
        out:  { code: "FR6338", depart: "08:05", arrive: "13:25", fare: 57.74 },
        back: { code: "FR6337", depart: "06:00", arrive: "07:40", fare: 69.99 },
        transfer: { miles: 105, drive: "2h 00m", driveHours: 2.0,
                    parkingPerCar: 60, minibusPerHead: 60 },
        verdict: "Nearest airport, but the worst of both ends: 01:00 chalet pickup, then a drive home on no sleep.",
      },
      {
        iata: "BHX", airport: "Birmingham",
        out:  { code: "FR6336", depart: "06:15", arrive: "11:25", fare: 57.84 },
        back: { code: "FR6335", depart: "11:55", arrive: "13:25", fare: 57.84 },
        transfer: { miles: 130, drive: "2h 20m", driveHours: 2.33,
                    parkingPerCar: 75, minibusPerHead: 75 },
        verdict: "The only one where both ends work. Early start out, but home in daylight and not wrecked.",
      },
    ],
  },

  /* --- Getting to the airport --------------------------------------
     Two cars works out much cheaper than a minibus, but it puts someone
     behind the wheel after the flight — which matters more at Stansted
     (lands 22:35) than at Birmingham (lands 13:25).

     Fuel figure is ~45mpg at ~£1.35/litre. Parking is 8 days official
     long stay booked ahead. Both are estimates and parking moves most.  */
  transport: {
    chosen: "cars",          // "cars" | "minibus"
    cars: {
      count: 2,
      poundsPerMile: 0.14,
      note: "fuel + parking, split",
      caveat: "Eight of us and eight bags needs two big estates. Only works because ski hire is included, so no ski bags.",
    },
    minibus: {
      note: "private hire, door to door",
      caveat: "Dearer, but nobody drives and nobody worries about the last night.",
    },
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

  /* --- Beds ---------------------------------------------------------
     Confirmed by Jake from the operator's room photos, 18 Aug 2026.
     We get sole use of the chalet, so all of this is ours.

     Two rooms differ from the operator's own "sleeps" labels: they list
     Bedroom 3 as sleeps 2 (plus a foldout) and Bedroom 6 as sleeps 3.
     The errors cancel out, and the total still comes to their 23.

     The lounge sofabed would add 2 more. We're not using it.           */
  rooms: {
    useLounge: false,
    list: [
      { name: "Bedroom 1",  doubles: 1, singles: 0 },
      { name: "Bedroom 2",  doubles: 1, singles: 0 },
      { name: "Bedroom 3",  doubles: 0, singles: 3 },
      { name: "Bedroom 4",  doubles: 0, singles: 3 },
      { name: "Bedroom 5",  doubles: 0, singles: 2 },
      { name: "Bedroom 6",  doubles: 0, singles: 2 },
      { name: "Bedroom 7",  doubles: 1, singles: 0 },
      { name: "Bedroom 8",  doubles: 1, singles: 0 },
      { name: "Bedroom 9",  doubles: 1, singles: 0 },
      { name: "Bedroom 10", doubles: 1, singles: 1 },
    ],
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
