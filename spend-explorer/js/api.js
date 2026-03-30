// All USASpending API calls. Depends on: constants.js

// Award type codes by category type. null = no filter (all award types).
function awardTypes(type) {
  if (type === 'naics') return AWARD_TYPE_CONTRACTS;
  if (type === 'cfda')  return AWARD_TYPE_ASSISTANCE;
  return null; // agency, subagency, recipient: no award_type_codes filter
}

// Maps our internal type key to the spending_by_category endpoint segment.
const CATEGORY_ENDPOINT = {
  agency:    'awarding_agency',
  subagency: 'awarding_subagency',
  recipient: 'recipient_duns',
  naics:     'naics',
  cfda:      'cfda',
};
function categoryEndpoint(type) {
  return CATEGORY_ENDPOINT[type] ?? type;
}

async function post(path, body) {
  const resp = await fetch(API_BASE + path, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(body)
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`API ${resp.status} at ${path}: ${text.slice(0, 200)}`);
  }
  return resp.json();
}

function buildFilters(state, extra = {}) {
  const filters = {
    time_period: [{start_date: START_DATE, end_date: END_DATE}],
    ...extra
  };
  if (state) {
    filters.place_of_performance_locations = [{country: 'USA', state}];
  }
  return filters;
}

function fetchCategoryList(type, state) {
  const types = awardTypes(type);
  const extra = types ? {award_type_codes: types} : {};
  return post(`/search/spending_by_category/${categoryEndpoint(type)}/`, {
    filters: buildFilters(state, extra),
    limit: 100,
    page: 1
  });
}

function fetchAwardCount(state) {
  return post('/search/spending_by_award_count/', {
    filters: buildFilters(state)
  });
}

function fetchTotalPerYear(state) {
  return post('/search/spending_over_time/', {
    group: 'fiscal_year',
    filters: buildFilters(state)
  });
}

// Denominator B: total spending for the category's award type slice.
// For agency/subagency/recipient this equals total federal spending.
function fetchTypePerYear(type, state) {
  const types = awardTypes(type);
  const extra = types ? {award_type_codes: types} : {};
  return post('/search/spending_over_time/', {
    group: 'fiscal_year',
    filters: buildFilters(state, extra)
  });
}

// Look up a human-readable description for a single code from the references API.
// Only needed for naics and cfda; agency/subagency/recipient names come from category list.
async function fetchDescription(type, code) {
  if (type === 'naics') {
    const data = await fetch(`${API_BASE}/references/naics/?code=${encodeURIComponent(code)}`).then(r => r.json());
    return data.results?.[0]?.naics_description || null;
  }
  if (type === 'cfda') {
    const data = await fetch(`${API_BASE}/references/assistance_listing/?program_number=${encodeURIComponent(code)}`).then(r => r.json());
    const result = data.results?.[0];
    if (!result) return null;
    return result.popular_name ? `${result.program_title} (${result.popular_name})` : result.program_title;
  }
  return null;
}

// Fetch the recipient_id (UUID hash) for a recipient name via a minimal award search.
// Returns a string like "8b3a04d0-3e60-b87e-6725-ecdf8f2bae97-C", or null on failure.
async function fetchRecipientId(name) {
  const data = await post('/search/spending_by_award/', {
    filters: buildFilters('', {recipient_search_text: [name]}),
    fields: ['recipient_id'],
    limit: 1,
    page: 1,
    sort: 'Award Amount',
    order: 'desc'
  }).catch(() => null);
  return data?.results?.[0]?.recipient_id ?? null;
}

// cat must be the full category object with .code, .name, and .id fields.
function fetchSeriesTimeline(type, cat, state) {
  let codeFilter;
  if (type === 'naics') {
    codeFilter = {naics_codes: {require: [String(cat.code)]}};
  } else if (type === 'cfda') {
    codeFilter = {program_numbers: [String(cat.code)]};
  } else if (type === 'agency') {
    codeFilter = {agencies: [{type: 'awarding', tier: 'toptier', name: cat.name}]};
  } else if (type === 'subagency') {
    codeFilter = {agencies: [{type: 'awarding', tier: 'subtier', name: cat.name}]};
  } else if (type === 'recipient') {
    // cat.id from spending_by_category/recipient_duns is a recipient profile ID —
    // indexed lookup, much faster than recipient_search_text full-text search.
    codeFilter = {recipient_ids: [String(cat.id)]};
  }
  const types = awardTypes(type);
  const extra = types ? {...codeFilter, award_type_codes: types} : codeFilter;
  return post('/search/spending_over_time/', {
    group: 'fiscal_year',
    filters: buildFilters(state, extra)
  }).catch(() => ({results: []}));
}
