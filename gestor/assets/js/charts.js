// Gráficos (Chart.js carregado só quando necessário)
let loader;
export const COLORS = { azul: '#1c8fd6', sol: '#f5b800', cereja: '#ee3b33', tinta: '#10224f', verde: '#1fa36b', roxo: '#7b5cd6', cinza: '#9aa6c2' };
export const PALETTE = [COLORS.azul, COLORS.sol, COLORS.cereja, COLORS.verde, COLORS.roxo, COLORS.tinta, '#4fc3f7', '#ff8a65', COLORS.cinza];

async function getChart() {
  loader ||= import('https://cdn.jsdelivr.net/npm/chart.js@4.4.4/auto/+esm').then((m) => {
    const Chart = m.default;
    Chart.defaults.font.family = "'DM Sans', system-ui, sans-serif";
    Chart.defaults.font.size = 12;
    Chart.defaults.color = '#5b6788';
    Chart.defaults.plugins.legend.labels.usePointStyle = true;
    Chart.defaults.plugins.legend.labels.boxWidth = 8;
    Chart.defaults.plugins.tooltip.backgroundColor = '#10224f';
    Chart.defaults.plugins.tooltip.padding = 10;
    Chart.defaults.plugins.tooltip.cornerRadius = 10;
    return Chart;
  });
  return loader;
}

const instances = new WeakMap();
export async function chart(canvas, config) {
  if (!canvas) return null;
  try {
    const Chart = await getChart();
    instances.get(canvas)?.destroy();
    const c = new Chart(canvas, { ...config, options: { responsive: true, maintainAspectRatio: false, animation: { duration: 500 }, ...config.options } });
    instances.set(canvas, c);
    return c;
  } catch (e) {
    canvas.replaceWith(Object.assign(document.createElement('p'), { className: 'muted', textContent: 'Não foi possível carregar o gráfico (verifique a internet).' }));
    return null;
  }
}

export const moneyAxis = { ticks: { callback: (v) => `R$ ${Number(v).toLocaleString('pt-BR', { notation: 'compact' })}` }, grid: { color: '#eef1f7' }, border: { display: false } };
export const plainAxis = { grid: { display: false }, border: { display: false } };
export const countAxis = { beginAtZero: true, ticks: { precision: 0 }, grid: { color: '#eef1f7' }, border: { display: false } };

// Últimos N meses como chaves AAAA-MM e rótulos "jan/26"
export function lastMonths(n = 12, from = new Date()) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(from.getFullYear(), from.getMonth() - i, 1);
    out.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('. de ', '/').replace('.', '') });
  }
  return out;
}
export const monthKey = (d) => (d ? String(d).slice(0, 7) : '');
