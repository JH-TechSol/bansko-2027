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
     One link for everyone: <siteUrl>. First visit shows a "Who are
     you?" picker built from the Sheet's Name/Key columns; the pick is
     stashed in localStorage so it isn't asked again on that device.
     A direct <siteUrl>/?k=THEIRKEY link still works too (skips the
     picker, e.g. for testing as a specific person) but nobody needs
     minting or WhatsApping keys any more — links.html is legacy.
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
    // £ PER PERSON, not a fixed pot to be divided. Martin, 6 Oct 2025:
    // "prices go down and are calculated per person not a set amount. The
    // minimum required group size is 8."
    //
    // And 21 Aug 2026: "You can add more guests at any point in time. Up to 15
    // guests, price per person doesn't change, however if you get at least 12
    // guests we can knock down £20.00 pp and make the price £400.00 pp."
    //
    // So the rate is tiered. Note the credit is a fixed £600 however many go,
    // so it thins with every extra head — which is why 9 to 11 people is worse
    // for everyone than either 8 or 12. See chaletRateFor() in app.js.
    chaletPerHead: 420,          // the rate below the discount threshold
    chaletTiers: [
      { minPeople: 12, perHead: 400 },
    ],
    maxPeople: 15,               // Martin's ceiling
    chaletTotal: 3360,           // display only: 420 x 8

    // Non-travel extras only. Flights and the airport run are derived from
    // whichever option is picked in `flightOptions` below, so the breakdown
    // always matches the chosen airport.
    extras: [
      { label: "Lift pass",
        note: "estimate, buy in resort",
        amount: 295, estimate: true, viaJake: false },
      { label: "Chalet tip",
        note: "customary for chalet staff, collected nearer the time",
        amount: 30, estimate: true, viaJake: false },
    ],
  },

  /* --- The flights ---------------------------------------------------
     Not "which airport do we all use" any more — people are flying from
     wherever suits them. What matters is the SOFIA end, because the
     chalet transfer is shared:

       lands Sofia   BHX 11:25 · EDI 11:30 · STN 12:10   (45 min spread)
       leaves Sofia  BHX 11:55 · EDI 11:55 · STN 12:35   (40 min spread)

     Each person's airport is the `Airport` column in the Zoho Sheet.
     `chosen` is only the default for anyone without one set.

     Ruled out for not fitting the Sofia times: Gatwick (lands 13:50,
     returns 14:40), Heathrow (returns 10:40, an hour before everyone),
     and the cheap Stansted evening flights (land 20:50 / 23:10).
     Luton looks ideal on Google but Wizz's booking engine denies the
     route exists. Manchester, Leeds Bradford, Newcastle: no direct.

     Fares are basic, checked 17-18 Aug 2026, and will move.            */
  flightOptions: {
    chosen: "BHX",
    // Airport / Return Airport columns in the sheet. Leave Return Airport blank
    // for a normal return; set it to fly home somewhere else (Matt: out of BHX
    // with the group, back to EDI).
    // Jake books the Birmingham seats and collects for them. Matt (EDI) and
    // Jack (STN) book their own, so their flights are their own spend and must
    // not appear in what they owe Jake.
    bookedByJake: ["BHX"],
    // Birmingham is a real Ryanair quote from the checkout screen, 21 Aug 2026:
    // 6 x Adult Plus, £592.98 out + £607.98 back less a £13.02 Plus discount =
    // £1,187.94, i.e. £197.99 each. Plus includes the 20kg check-in bag and a
    // small bag, so there is nothing to add — hence bagPerHead 0.
    // Edinburgh and Stansted are still basic fares and DO need a bag adding;
    // they're kept for reference only, nobody is on them.
    // Only applies to fares that DON'T already include a bag. Birmingham is a
    // Plus fare with the 20kg bag in it (quoted: true), so it's skipped there.
    bagPerHead: 75,
    bagNote: "20kg hold bag, both ways",
    bagNoteQuoted: "20kg bag included in the Plus fare",
    choices: [
      {
        iata: "BHX", airport: "Birmingham",
        out:  { code: "FR6336", depart: "06:15", arrive: "11:25", fare: 98.83 },
        back: { code: "FR6335", depart: "11:55", arrive: "13:25", fare: 99.16 },
        quoted: true,   // real checkout price, not an estimate
        transfer: { miles: 130, drive: "2h 20m", driveHours: 2.33,
                    parkingPerCar: 75, minibusPerHead: 75 },
        verdict: "The plan — everyone except Jack flies from here.",
      },
      {
        iata: "EDI", airport: "Edinburgh",
        out:  { code: "FR5160", depart: "06:00", arrive: "11:30", fare: 79.99 },
        back: { code: "FR5161", depart: "11:55", arrive: "13:45", fare: 100.99 },
        transfer: { miles: 0, drive: "local", driveHours: 0,
                    parkingPerCar: 0, minibusPerHead: 0 },
        // Matt flies OUT of Birmingham with everyone and only comes back here.
        // FR5161 leaves Sofia at 11:55, the same minute as the Birmingham flight.
        // Matt reverted to flying both ways with the group, 21 Aug 2026, so
        // nobody is on this now. Kept because it's the only Sofia-Edinburgh
        // flight that day and it leaves at 11:55, same as Birmingham.
        verdict: "Not being used — kept here for reference only.",
      },
      {
        iata: "STN", airport: "London Stansted",
        out:  { code: "FR2690", depart: "07:05", arrive: "12:10", fare: 88.04 },
        back: { code: "FR2691", depart: "12:35", arrive: "13:55", fare: 77.54 },
        transfer: { miles: 0, drive: "local", driveHours: 0,
                    parkingPerCar: 0, minibusPerHead: 0 },
        verdict: "Jack's own route, booked separately.",
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
    // Deliberately kept OUT of the headline totals for now — how we get to the
    // airport isn't decided and the parking figures are soft. It's still worked
    // out and shown separately so nobody's surprised by it later. Flip this to
    // true once the plan is settled and it folds into the per-head total.
    includeInTotal: false,
    chosen: "cars",          // "cars" | "minibus"
    cars: {
      count: 2,
      poundsPerMile: 0.14,
      note: "fuel + parking, split",
      // Worth remembering, though no longer shown on the page: eight people and
      // eight bags needs two big estates, and only fits because ski hire is
      // included so nobody carries ski bags.
    },
    minibus: {
      note: "private hire, door to door",
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

  /* --- Payment schedule -----------------------------------------------
     Staged so Jake is never far out of pocket, and worked backwards from
     Martin's hard deadline — the chalet balance 2 weeks before arrival,
     20 Feb 2027 — with slack, because chasing seven people takes weeks.

     Stage 1 recovers what Jake is out of pocket RIGHT NOW: his own share
     of Martin's £400 chalet deposit (already fronted), plus the seat for
     anyone whose flight Jake is booking. Jack books his own, so his
     stage 1 is deposit-share only.

     A null amount means "computed": the last stage is whatever remains,
     so the stages always sum to the total even if a fare moves.           */
  schedule: {
    // £400 / 8 — Jake's own slice of the chalet deposit he's already paid.
    depositPerHead: 50,
    depositFlights: true,
    // The precise ask for anyone whose flight Jake books is £247.99 (£50
    // deposit share + £197.99 fare). £250 is easier to remember and transfer.
    // The ~£2 difference isn't lost — stagesFor() always nets against the
    // true total owed, so it just comes off their next instalment.
    depositRoundedViaJake: 250,
    depositDue: "2026-09-30",

    stages: [
      { label: "Deposit",
        due: "2026-09-30",
        amount: null,
        why: "Covers your share of the £400 chalet deposit Jake's already paid Martin, plus your seat if Jake's booking your flight." },
      { label: "Chalet, first half",
        due: "2026-11-30",
        amount: 175,
        why: "" },
      { label: "Chalet, balance",
        due: "2027-01-31",
        amount: null,
        why: "" },
    ],

    operatorDeadline: "2027-02-20",
    payTo: "Bank transfer to Jake — ask him for details",
  },

  /* --- Flights ---------------------------------------------------- */
  flights: {
    airline: "Ryanair",
    fare: "basic fare plus a 20kg hold bag",
    // Airport decided (Birmingham) — not yet ticketed as of 2 Sep 2026.
    // Times and codes below follow flightOptions.chosen.
    booked: false,
    notBookedWarning: "Not booked yet — fares move, and eight seats going at " +
      "once is what pushes them into the next price band.",
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
    { name: "Steve Turbill",  key: "demo-steve", status: "confirmed", depositPaid: 0, balancePaid: 0, notes: "" },
    { name: "Matt Barker",    key: "demo-matt",  status: "confirmed", depositPaid: 0, balancePaid: 0, notes: "" },
    { name: "Adam Swan",      key: "demo-adam",  status: "confirmed", depositPaid: 0, balancePaid: 0, notes: "" },
    { name: "Jack Myhill",    key: "demo-jack",  status: "confirmed", depositPaid: 0, balancePaid: 0, notes: "" },
    { name: "James Primmer",  key: "demo-james", status: "confirmed", depositPaid: 0, balancePaid: 0, notes: "" },
    { name: "8th place",      key: "",           status: "open",      depositPaid: 0, balancePaid: 0, notes: "Seat open — needs a name to hold the £420pp chalet price" },
  ],
};
