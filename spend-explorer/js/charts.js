// Chart creation and number formatting. Depends on: constants.js (FISCAL_YEARS)

const chartInstances = new Map(); // canvas-id → Chart instance

// Y-axis width is normalized so stacked charts visually align their plot areas.
const Y_AXIS_WIDTH = 58;

function fmtDollars(v) {
  const absVal = Math.abs(v);
  if (absVal >= 1e12) return '$' + (v / 1e12).toFixed(2) + 'T';
  if (absVal >= 1e9)  return '$' + (v / 1e9).toFixed(2)  + 'B';
  if (absVal >= 1e6)  return '$' + (v / 1e6).toFixed(1)  + 'M';
  if (absVal >= 1e3)  return '$' + (v / 1e3).toFixed(1)  + 'K';
  return '$' + v.toFixed(0);
}

function fmtPct(v) {
  if (v === 0)   return '0%';
  if (v < 0.001) return v.toFixed(4) + '%';
  if (v < 0.01)  return v.toFixed(3) + '%';
  if (v < 1)     return v.toFixed(2) + '%';
  return v.toFixed(1) + '%';
}

// Create (or replace) a Chart.js line chart on the given canvas.
// showXAxis controls whether year labels appear below the chart (only the bottom panel uses true).
function makeChart(canvasId, labels, data, color, yFormatter, showXAxis) {
  if (chartInstances.has(canvasId)) {
    chartInstances.get(canvasId).destroy();
    chartInstances.delete(canvasId);
  }
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const chart = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data,
        borderColor: color,
        backgroundColor: color + '18',
        fill: true,
        tension: 0.35,
        pointRadius: 2,
        pointHoverRadius: 4,
        borderWidth: 1.5
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      layout: {
        padding: {top: 4, bottom: showXAxis ? 2 : 0, left: 0, right: 4}
      },
      plugins: {
        legend: {display: false},
        tooltip: {
          callbacks: {
            label: ctx => ' ' + yFormatter(ctx.raw),
            title: ctx => 'FY' + ctx[0].label
          }
        }
      },
      scales: {
        x: {
          grid: {display: false},
          border: {display: false},
          ticks: showXAxis
            ? {font: {size: 9}, maxRotation: 0, callback: (_, idx) => FISCAL_YEARS[idx].slice(2)}
            : {display: false}
        },
        y: {
          min: 0,
          grid: {color: '#f1f5f9'},
          border: {display: false},
          ticks: {
            font: {size: 9},
            maxTicksLimit: 3,
            callback: val => yFormatter(val)
          },
          afterFit: axis => { axis.width = Y_AXIS_WIDTH; }
        }
      }
    }
  });

  chartInstances.set(canvasId, chart);
}

function destroyAllCharts() {
  for (const chart of chartInstances.values()) chart.destroy();
  chartInstances.clear();
}
