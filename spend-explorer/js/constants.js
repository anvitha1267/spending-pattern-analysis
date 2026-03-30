const API_BASE   = 'https://api.usaspending.gov/api/v2';
const START_DATE = '2007-10-01';
const END_DATE   = '2024-09-30';
const FISCAL_YEARS = Array.from({length: 17}, (_, i) => String(2008 + i)); // '2008'–'2024'

const AWARD_TYPE_CONTRACTS  = ['A','B','C','D','E','F'];
const AWARD_TYPE_ASSISTANCE = ['02','03','04','05','06','07','08','09','10','11'];

const EXPLAINERS = {
  agency:    '<strong>Top-Level Agency</strong> — the top-tier federal awarding agencies (e.g. Dept. of Defense, HHS). Covers all award types.',
  subagency: '<strong>Sub-Agency / Department</strong> — component offices within top-level agencies (e.g. Army, Navy, NIH, FDA). Covers all award types.',
  recipient: '<strong>Contractor / Recipient</strong> — organizations that receive federal awards (companies, universities, nonprofits, state agencies). Matched by name; covers all award types.',
  naics:     '<strong>NAICS</strong> (North American Industry Classification System) — classifies the <em>industry</em> of federal procurement contracts (e.g. aerospace, IT services, construction).',
  cfda:      '<strong>CFDA</strong> (Catalog of Federal Domestic Assistance) — program numbers for federal grants, loans, and direct payments to states, localities, and organizations.'
};

// First entry (code '') = no state filter → all awards regardless of place of performance.
// This is a national aggregate, not a "federal-only" view; individual states can be selected below.
const STATES = [
  {code:'',   name:'All (no state filter)'},
  {code:'AL', name:'Alabama'},       {code:'AK', name:'Alaska'},
  {code:'AZ', name:'Arizona'},       {code:'AR', name:'Arkansas'},
  {code:'CA', name:'California'},    {code:'CO', name:'Colorado'},
  {code:'CT', name:'Connecticut'},   {code:'DE', name:'Delaware'},
  {code:'FL', name:'Florida'},       {code:'GA', name:'Georgia'},
  {code:'HI', name:'Hawaii'},        {code:'ID', name:'Idaho'},
  {code:'IL', name:'Illinois'},      {code:'IN', name:'Indiana'},
  {code:'IA', name:'Iowa'},          {code:'KS', name:'Kansas'},
  {code:'KY', name:'Kentucky'},      {code:'LA', name:'Louisiana'},
  {code:'ME', name:'Maine'},         {code:'MD', name:'Maryland'},
  {code:'MA', name:'Massachusetts'}, {code:'MI', name:'Michigan'},
  {code:'MN', name:'Minnesota'},     {code:'MS', name:'Mississippi'},
  {code:'MO', name:'Missouri'},      {code:'MT', name:'Montana'},
  {code:'NE', name:'Nebraska'},      {code:'NV', name:'Nevada'},
  {code:'NH', name:'New Hampshire'}, {code:'NJ', name:'New Jersey'},
  {code:'NM', name:'New Mexico'},    {code:'NY', name:'New York'},
  {code:'NC', name:'North Carolina'},{code:'ND', name:'North Dakota'},
  {code:'OH', name:'Ohio'},          {code:'OK', name:'Oklahoma'},
  {code:'OR', name:'Oregon'},        {code:'PA', name:'Pennsylvania'},
  {code:'RI', name:'Rhode Island'},  {code:'SC', name:'South Carolina'},
  {code:'SD', name:'South Dakota'},  {code:'TN', name:'Tennessee'},
  {code:'TX', name:'Texas'},         {code:'UT', name:'Utah'},
  {code:'VT', name:'Vermont'},       {code:'VA', name:'Virginia'},
  {code:'WA', name:'Washington'},    {code:'WV', name:'West Virginia'},
  {code:'WI', name:'Wisconsin'},     {code:'WY', name:'Wyoming'},
  {code:'DC', name:'District of Columbia'},
  {code:'PR', name:'Puerto Rico'},
];
