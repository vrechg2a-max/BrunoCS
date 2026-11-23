import {
  CATEGORY_COLORS,
  EXPENSE_CATEGORIES,
  type CategoryCostSummary,
  type Construction,
  type ConstructionCostSummary,
  type CrossFilterState,
  type DatePreset,
  type Expense,
  type FinancialAnalytics,
  type TimelinePoint,
} from '../types/domain';

const brlFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const compactBrlFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
});

export function formatBRL(value: number): string {
  return brlFormatter.format(Number.isFinite(value) ? value : 0);
}

export function formatCompactBRL(value: number): string {
  return compactBrlFormatter.format(Number.isFinite(value) ? value : 0);
}

export function formatNumberBR(value: number, decimals = 1): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Number.isFinite(value) ? value : 0);
}

export function toIsoDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDateBR(isoDate: string): string {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return '—';
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

export function formatShortDateBR(isoDate: string): string {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate;
  const [, m, d] = isoDate.split('-');
  return `${d}/${m}`;
}

export function daysAgoIso(days: number, reference = new Date()): string {
  const d = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate());
  d.setDate(d.getDate() - days);
  return toIsoDateString(d);
}

export function getPresetDateRange(
  preset: DatePreset,
  reference = new Date(),
): { startDate: string; endDate: string } {
  const today = toIsoDateString(reference);
  switch (preset) {
    case '7d':
      return { startDate: daysAgoIso(6, reference), endDate: today };
    case '30d':
      return { startDate: daysAgoIso(29, reference), endDate: today };
    case 'month': {
      const firstDay = new Date(reference.getFullYear(), reference.getMonth(), 1);
      return { startDate: toIsoDateString(firstDay), endDate: today };
    }
    case '90d':
      return { startDate: daysAgoIso(89, reference), endDate: today };
    case 'all':
    case 'custom':
    default:
      return { startDate: '', endDate: '' };
  }
}

export function computeFinancialAnalytics(
  constructions: Construction[],
  expenses: Expense[],
  filter: CrossFilterState,
  referenceDate = new Date(),
): FinancialAnalytics {
  // 1. Cross-filter by selected construction (used for weekly/monthly rolling balances too)
  const scopedByConstruction =
    filter.constructionId === 'all'
      ? expenses
      : expenses.filter((e) => e.constructionId === filter.constructionId);

  const queryNorm = filter.searchQuery.trim().toLowerCase();

  // 2. Full cross-filter (Construction + Date Range + Category + Search)
  const filteredExpenses = scopedByConstruction
    .filter((expense) => {
      if (filter.startDate && expense.data < filter.startDate) return false;
      if (filter.endDate && expense.data > filter.endDate) return false;
      if (filter.category !== 'all' && expense.categoria !== filter.category) return false;
      if (queryNorm) {
        const hay =
          `${expense.descricao} ${expense.fornecedor} ${expense.categoria} ${expense.formaPagamento} ${expense.notaFiscalNumero || ''}`.toLowerCase();
        if (!hay.includes(queryNorm)) return false;
      }
      return true;
    })
    .sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0));

  const totalFiltered = filteredExpenses.reduce((sum, item) => sum + item.valor, 0);
  const totalOverall = scopedByConstruction.reduce((sum, item) => sum + item.valor, 0);

  // 3. Rolling 7-day (Última Semana) and 30-day (Último Mês) balance calculations
  const todayIso = toIsoDateString(referenceDate);
  const start7d = daysAgoIso(6, referenceDate);
  const prev7dStart = daysAgoIso(13, referenceDate);
  const prev7dEnd = daysAgoIso(7, referenceDate);

  const start30d = daysAgoIso(29, referenceDate);
  const prev30dStart = daysAgoIso(59, referenceDate);
  const prev30dEnd = daysAgoIso(30, referenceDate);

  let last7DaysTotal = 0;
  let prev7DaysTotal = 0;
  let last30DaysTotal = 0;
  let prev30DaysTotal = 0;

  for (const exp of scopedByConstruction) {
    if (exp.data >= start7d && exp.data <= todayIso) {
      last7DaysTotal += exp.valor;
    } else if (exp.data >= prev7dStart && exp.data <= prev7dEnd) {
      prev7DaysTotal += exp.valor;
    }

    if (exp.data >= start30d && exp.data <= todayIso) {
      last30DaysTotal += exp.valor;
    } else if (exp.data >= prev30dStart && exp.data <= prev30dEnd) {
      prev30DaysTotal += exp.valor;
    }
  }

  const weeklyDeltaPct =
    prev7DaysTotal > 0 ? ((last7DaysTotal - prev7DaysTotal) / prev7DaysTotal) * 100 : null;
  const monthlyDeltaPct =
    prev30DaysTotal > 0 ? ((last30DaysTotal - prev30DaysTotal) / prev30DaysTotal) * 100 : null;

  // 4. Costs per Construction (scoped to selected construction if any, or all constructions)
  const relevantConstructions =
    filter.constructionId === 'all'
      ? constructions
      : constructions.filter((c) => c.id === filter.constructionId);

  const byConstruction: ConstructionCostSummary[] = relevantConstructions
    .map((construction) => {
      const allForSite = expenses.filter((e) => e.constructionId === construction.id);
      const filteredForSite = filteredExpenses.filter((e) => e.constructionId === construction.id);
      const gastoAcumulado = allForSite.reduce((sum, e) => sum + e.valor, 0);
      const gastoFiltrado = filteredForSite.reduce((sum, e) => sum + e.valor, 0);
      const saldoRestante = construction.orcamentoTotal - gastoAcumulado;
      const percentualExecutado =
        construction.orcamentoTotal > 0 ? (gastoAcumulado / construction.orcamentoTotal) * 100 : 0;
      const custoPorMetroQuadrado =
        construction.areaConstruida > 0 ? gastoAcumulado / construction.areaConstruida : 0;

      return {
        constructionId: construction.id,
        nome: construction.nome,
        cliente: construction.cliente,
        status: construction.status,
        orcamentoTotal: construction.orcamentoTotal,
        gastoFiltrado,
        gastoAcumulado,
        saldoRestante,
        percentualExecutado,
        qtdLancamentos: filteredForSite.length,
        areaConstruida: construction.areaConstruida,
        custoPorMetroQuadrado,
      };
    })
    .sort((a, b) => b.gastoFiltrado - a.gastoFiltrado);

  const totalBudget = relevantConstructions.reduce((sum, c) => sum + c.orcamentoTotal, 0);
  const budgetRemaining = totalBudget - totalOverall;
  const budgetUtilizationPct = totalBudget > 0 ? (totalOverall / totalBudget) * 100 : 0;

  // 5. Breakdown by Accounting Category
  const categoryMap = new Map<string, { total: number; count: number }>();
  for (const cat of EXPENSE_CATEGORIES) {
    categoryMap.set(cat, { total: 0, count: 0 });
  }
  for (const exp of filteredExpenses) {
    const entry = categoryMap.get(exp.categoria) || { total: 0, count: 0 };
    entry.total += exp.valor;
    entry.count += 1;
    categoryMap.set(exp.categoria, entry);
  }

  const byCategory: CategoryCostSummary[] = EXPENSE_CATEGORIES.map((categoria) => {
    const entry = categoryMap.get(categoria) || { total: 0, count: 0 };
    return {
      categoria,
      total: entry.total,
      count: entry.count,
      sharePct: totalFiltered > 0 ? (entry.total / totalFiltered) * 100 : 0,
      color: CATEGORY_COLORS[categoria],
    };
  }).sort((a, b) => b.total - a.total);

  // 6. Chronological timeline for cashflow chart
  const dateMap = new Map<string, { total: number; count: number }>();
  for (const exp of filteredExpenses) {
    const cur = dateMap.get(exp.data) || { total: 0, count: 0 };
    cur.total += exp.valor;
    cur.count += 1;
    dateMap.set(exp.data, cur);
  }

  const timeline: TimelinePoint[] = Array.from(dateMap.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, info]) => ({
      date,
      label: formatShortDateBR(date),
      total: info.total,
      count: info.count,
    }));

  return {
    filteredExpenses,
    totalFiltered,
    totalOverall,
    totalBudget,
    budgetRemaining,
    budgetUtilizationPct,
    last7DaysTotal,
    prev7DaysTotal,
    weeklyDeltaPct,
    last30DaysTotal,
    prev30DaysTotal,
    monthlyDeltaPct,
    byConstruction,
    byCategory,
    timeline,
  };
}

export function exportExpensesToCsv(
  expenses: Expense[],
  constructionNameById: Record<string, string>,
): void {
  const headers = [
    'Data',
    'Obra',
    'Categoria',
    'Descrição',
    'Local da Compra / Empresa',
    'Forma de Pagamento',
    'Valor (R$)',
    'Nº Nota Fiscal',
    'Link Nota Fiscal',
  ];

  const escapeCsv = (val: string) => `"${val.replace(/"/g, '""')}"`;

  const rows = expenses.map((e) => [
    formatDateBR(e.data),
    constructionNameById[e.constructionId] || e.constructionId,
    e.categoria,
    e.descricao,
    e.fornecedor,
    e.formaPagamento,
    e.valor.toFixed(2).replace('.', ','),
    e.notaFiscalNumero || '',
    e.notaFiscalUrl || '',
  ]);

  const csvContent =
    '\uFEFF' + [headers, ...rows].map((row) => row.map(escapeCsv).join(';')).join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `contabilidade-obras-${toIsoDateString(new Date())}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
