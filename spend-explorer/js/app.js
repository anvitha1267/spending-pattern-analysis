// Application state, orchestration, rendering, and event wiring.
// Depends on: constants.js, api.js, charts.js

// ─── App State ───────────────────────────────────────────────────────────────

let allCategories  = [];
let totalByYear    = {};  // fiscal_year → total federal obligations
let typeByYear     = {};  // fiscal_year → total contract or assistance obligations
let sampledIndices = new Set();
let currentType    = 'naics';
let currentState   = '';
let cardCounter    = 0;

// ─── Labels by Category Type ────────────────────────────────────────────────

const TYPE_LABELS    = {agency: 'Agency',   subagency: 'Sub-Agency', recipient: 'Recipient', naics: 'NAICS',       cfda: 'CFDA'};
const TYPE_SPEND_LBL = {agency: 'Federal',  subagency: 'Federal',    recipient: 'Federal',   naics: 'Contract',    cfda: 'Assistance'};
const STATS_LABELS   = {agency: 'agencies', subagency: 'sub-agencies', recipient: 'recipients', naics: 'NAICS codes', cfda: 'CFDA programs'};

// ─── Data Helpers ────────────────────────────────────────────────────────────

function toYearMap(results) {
  const map = {};
  for (const record of (results || [])) {
    const fy = record.time_period?.fiscal_year;
    if (fy) map[fy] = record.aggregated_amount || 0;
  }
  return map;
}

function buildChartData(seriesMap) {
  const raw = [], sharePct = [], typePct = [];
  for (const year of FISCAL_YEARS) {
    const val        = seriesMap[year] || 0;
    const total      = totalByYear[year];
    const typeTotal  = typeByYear[year];
    raw.push(val);
    sharePct.push((total     > 0) ? val / total     * 100 : 0);
    typePct.push( (typeTotal > 0) ? val / typeTotal * 100 : 0);
  }
  return {years: FISCAL_YEARS, raw, sharePct, typePct};
}

// ─── Info Tooltip ────────────────────────────────────────────────────────────

function buildInfoTooltip(category, type) {
  let spentBy, toWhom, url, urlText;

  if (type === 'agency') {
    spentBy = `<strong>${category.name}</strong>`;
    toWhom  = 'contractors, grantees, and assistance recipients';
    url     = category.agency_slug ? `https://www.usaspending.gov/agency/${category.agency_slug}` : null;
    urlText = 'View agency profile';
  } else if (type === 'subagency') {
    spentBy = `<strong>${category.name}</strong>${category.agency_name ? ` (within ${category.agency_name})` : ''}`;
    toWhom  = 'contractors and award recipients';
    url     = (category.agency_slug && category.subagency_slug)
      ? `https://www.usaspending.gov/agency/${category.agency_slug}/${category.subagency_slug}`
      : null;
    urlText = 'View sub-agency profile';
  } else if (type === 'recipient') {
    spentBy = 'Various federal awarding agencies';
    toWhom  = `<strong>${category.name}</strong>${category.code ? `<br><span class="recipient-duns">DUNS: ${category.code}</span>` : ''}`;
    // Profile URL requires a UUID hash not in the category list; fetched lazily on first open.
    url     = null;
    urlText = null;
  } else if (type === 'naics') {
    spentBy = 'Federal agencies (contracts only)';
    toWhom  = `companies in the <strong>${category.name || category.code}</strong> industry (NAICS ${category.code})`;
    url     = null;
    urlText = null;
  } else if (type === 'cfda') {
    spentBy = 'Federal agencies administering assistance';
    toWhom  = `recipients of the <strong>${category.name || category.code}</strong> program (CFDA ${category.code})`;
    url     = `https://www.usaspending.gov/assistance-listing/${category.code}`;
    urlText = 'View assistance listing';
  }

  const linkHtml = (url && urlText)
    ? `<a href="${url}" target="_blank" rel="noopener">${urlText} &rarr;</a>`
    : '';

  // Recipients get a lazy-loaded link placeholder instead of a static href.
  const recipientLinkHtml = (type === 'recipient')
    ? `<a class="recipient-link" href="" target="_blank" rel="noopener" hidden>View recipient profile &rarr;</a>
       <span class="recipient-link-loading">Fetching profile link…</span>`
    : '';

  return `<div class="info-tooltip-inner">
            <p><strong>Spent by:</strong> ${spentBy}</p>
            <p><strong>To:</strong> ${toWhom}</p>
            ${linkHtml}${recipientLinkHtml}
          </div>`;
}

// ─── Rendering ───────────────────────────────────────────────────────────────

function renderSeriesCard(category, chartData) {
  const idx          = cardCounter++;
  const id           = `c${idx}`;
  const typeLabel    = TYPE_LABELS[currentType]    ?? currentType;
  const typeSpendLbl = TYPE_SPEND_LBL[currentType] ?? 'Federal';
  const totalObl     = chartData.raw.reduce((a, b) => a + b, 0);

  const card = document.createElement('div');
  card.className = 'series-card';
  const parentLine = (currentType === 'subagency' && category.agency_name)
    ? `<span class="series-parent">${category.agency_abbreviation || ''} &mdash; ${category.agency_name}</span>`
    : '';

  card.innerHTML = `
    <div class="series-header">
      <div class="series-title">
        <span class="series-code">${typeLabel} ${category.code || ''}</span>
        <span class="series-name" id="${id}-name">${category.name || category.description || ''}</span>
        ${parentLine}
      </div>
      <div class="series-meta">
        <span class="series-total">${fmtDollars(totalObl)} total FY08–24</span>
        <div class="info-wrap" ${currentType === 'recipient' ? `data-recipient-name="${category.name.replace(/"/g, '&quot;')}"` : ''}>
          <button class="info-btn" aria-label="More info">&#9432;</button>
          <div class="info-tooltip">${buildInfoTooltip(category, currentType)}</div>
        </div>
      </div>
    </div>
    <div class="charts-stack">
      <div class="chart-item">
        <span class="chart-label">Obligations ($)</span>
        <div class="chart-canvas-wrap"><canvas id="${id}-r"></canvas></div>
      </div>
      <div class="chart-item">
        <span class="chart-label">% of All Federal Spending</span>
        <div class="chart-canvas-wrap"><canvas id="${id}-a"></canvas></div>
      </div>
      <div class="chart-item chart-item--bottom">
        <span class="chart-label">% of ${typeSpendLbl} Spending</span>
        <div class="chart-canvas-wrap chart-canvas-wrap--bottom"><canvas id="${id}-t"></canvas></div>
      </div>
    </div>`;

  document.getElementById('series-grid').appendChild(card);

  // Defer chart creation until canvases are in the DOM
  requestAnimationFrame(() => {
    makeChart(`${id}-r`, chartData.years, chartData.raw,      '#3b82f6', fmtDollars, false);
    makeChart(`${id}-a`, chartData.years, chartData.sharePct, '#10b981', fmtPct,     false);
    makeChart(`${id}-t`, chartData.years, chartData.typePct,  '#f59e0b', fmtPct,     true);
  });

  return id;  // caller uses this to target the name span for async enrichment
}

// For categories whose name wasn't in the spending_by_category response, look up
// descriptions from the references API and fill them in once they arrive.
function enrichDescriptions(lookups) {
  lookups.forEach(async ({nameId, code}) => {
    const el = document.getElementById(nameId);
    if (!el || el.textContent) return;  // already has a name
    el.textContent = '…';
    try {
      const desc = await fetchDescription(currentType, code);
      el.textContent = desc || code;
    } catch {
      el.textContent = code;
    }
  });
}

function renderStats(awardCounts, categoryCount, shownCount) {
  const counts    = awardCounts || {};
  const total     = Object.values(counts).reduce((sum, n) => sum + n, 0);
  const typeLabel = STATS_LABELS[currentType] ?? currentType;
  const scopeLabel = currentState
    ? (STATES.find(s => s.code === currentState)?.name ?? currentState)
    : 'all states — national aggregate';

  document.getElementById('stats-bar').innerHTML = `
    <span class="stat-item"><strong>${total.toLocaleString()}</strong> total awards (${scopeLabel})</span>
    <span class="stat-item"><strong>${(counts.contracts || 0).toLocaleString()}</strong> contracts</span>
    <span class="stat-item"><strong>${(counts.grants || 0).toLocaleString()}</strong> grants</span>
    <span class="stat-item"><strong>${categoryCount.toLocaleString()}</strong> ${typeLabel} with spending</span>
    <span class="stat-note">Showing ${shownCount} of ${Math.min(allCategories.length, 100)} loaded</span>`;
}

// ─── Sampling ────────────────────────────────────────────────────────────────

function sampleNext(n = 10) {
  const remaining = [];
  for (let i = 0; i < allCategories.length; i++) {
    if (!sampledIndices.has(i)) remaining.push(i);
  }
  if (remaining.length === 0) return null;
  const picked = remaining.sort(() => Math.random() - 0.5).slice(0, n);
  picked.forEach(i => sampledIndices.add(i));
  return picked.map(i => allCategories[i]);
}

// ─── Fetch Helpers ───────────────────────────────────────────────────────────

// Run fetchFn on items in sequential batches of batchSize, collecting all results.
// Reduces simultaneous open requests, which helps with slow/expensive queries.
async function fetchInBatches(items, batchSize, fetchFn) {
  const results = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(fetchFn));
    results.push(...batchResults);
  }
  return results;
}

// ─── Load / Resample ─────────────────────────────────────────────────────────

async function loadSample() {
  const sample = sampleNext(10);
  if (!sample) {
    setResampleNote('All loaded categories shown — reload to start over.');
    document.getElementById('resample-btn').disabled = true;
    return;
  }

  setLoadingState(true);
  destroyAllCharts();
  document.getElementById('series-grid').innerHTML = '';
  cardCounter = 0;

  // Skeleton placeholders while fetching
  sample.forEach(cat => {
    const div = document.createElement('div');
    div.className = 'loading-card';
    div.textContent = `Loading ${cat.code}…`;
    document.getElementById('series-grid').appendChild(div);
  });

  const timelines = await fetchInBatches(
    sample,
    3,  // 3 concurrent requests per batch; reduces server-side queuing for expensive queries
    cat => fetchSeriesTimeline(currentType, cat, currentState)
  );

  document.getElementById('series-grid').innerHTML = '';

  const needsLookup = [];
  for (let i = 0; i < sample.length; i++) {
    const chartData = buildChartData(toYearMap(timelines[i].results));
    const cardId    = renderSeriesCard(sample[i], chartData);
    if (!sample[i].name && !sample[i].description) {
      needsLookup.push({nameId: `${cardId}-name`, code: sample[i].code});
    }
  }

  if (needsLookup.length > 0) enrichDescriptions(needsLookup);

  const shown = sampledIndices.size;
  setResampleNote(`${shown} of ${allCategories.length} shown so far`);
  document.getElementById('resample-btn').hidden = false;
  document.getElementById('resample-btn').disabled = (shown >= allCategories.length);
  setLoadingState(false);
}

async function loadData() {
  currentType  = document.getElementById('type-select').value;
  currentState = document.getElementById('state-select').value;
  allCategories  = [];
  sampledIndices = new Set();

  setLoadingState(true);
  document.getElementById('stats-bar').innerHTML = '<span class="stat-note">Loading…</span>';
  document.getElementById('resample-btn').hidden = true;
  destroyAllCharts();
  document.getElementById('series-grid').innerHTML = '';

  try {
    const [catData, awardCount, totalData, typeData] = await Promise.all([
      fetchCategoryList(currentType, currentState),
      fetchAwardCount(currentState),
      fetchTotalPerYear(currentState),
      fetchTypePerYear(currentType, currentState)
    ]);

    allCategories = catData.results || [];
    totalByYear   = toYearMap(totalData.results);
    typeByYear    = toYearMap(typeData.results);

    const catCount = catData.page_metadata?.count ?? allCategories.length;
    renderStats(awardCount.results, catCount, 0);

    await loadSample();

    renderStats(awardCount.results, catCount, sampledIndices.size);

  } catch (e) {
    document.getElementById('stats-bar').innerHTML = '';
    document.getElementById('series-grid').innerHTML = '';
    const err = document.createElement('div');
    err.className = 'error-msg';
    err.style.margin = '1.5rem 2rem';
    err.textContent = 'Error loading data: ' + e.message;
    document.getElementById('series-grid').appendChild(err);
    console.error(e);
  } finally {
    setLoadingState(false);
  }
}

// ─── UI Helpers ──────────────────────────────────────────────────────────────

function setLoadingState(loading) {
  document.getElementById('load-btn').disabled = loading;
  document.getElementById('load-btn').textContent = loading ? 'Loading…' : 'Load Data';
  const rb = document.getElementById('resample-btn');
  if (rb) rb.disabled = loading;
}

function setResampleNote(msg) {
  const el = document.getElementById('resample-note');
  el.textContent = msg;
  el.hidden = !msg;
}

// ─── Event Wiring ────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  const sel = document.getElementById('state-select');
  STATES.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.code;
    opt.textContent = s.name;
    sel.appendChild(opt);
  });

  const typeSelect = document.getElementById('type-select');
  const updateExplainer = () => {
    document.getElementById('type-explainer').innerHTML = EXPLAINERS[typeSelect.value] ?? '';
  };
  typeSelect.addEventListener('change', () => {
    currentType = typeSelect.value;
    updateExplainer();
  });
  updateExplainer(); // set initial explainer text

  document.getElementById('load-btn').addEventListener('click', loadData);
  document.getElementById('resample-btn').addEventListener('click', () => loadSample());

  // Info tooltip: click to open, click outside to close.
  // Using event delegation so dynamically-added cards are covered.
  document.getElementById('series-grid').addEventListener('click', async e => {
    const btn = e.target.closest('.info-btn');
    if (!btn) return;
    e.stopPropagation();
    const wrap = btn.closest('.info-wrap');
    const wasOpen = wrap.classList.contains('open');
    document.querySelectorAll('.info-wrap.open').forEach(w => w.classList.remove('open'));
    if (!wasOpen) {
      wrap.classList.add('open');

      // Lazy-fetch recipient profile UUID on first open; result cached via data-recipient-fetched.
      const recipientName = wrap.dataset.recipientName;
      if (recipientName && !wrap.dataset.recipientFetched) {
        wrap.dataset.recipientFetched = 'true';
        const loadingEl = wrap.querySelector('.recipient-link-loading');
        const linkEl    = wrap.querySelector('.recipient-link');
        try {
          const recipientId = await fetchRecipientId(recipientName);
          if (recipientId && linkEl) {
            linkEl.href   = `https://www.usaspending.gov/recipient/${recipientId}`;
            linkEl.hidden = false;
          }
        } catch {}
        if (loadingEl) loadingEl.remove();
      }
    }
  });

  document.addEventListener('click', () => {
    document.querySelectorAll('.info-wrap.open').forEach(w => w.classList.remove('open'));
  });
});
