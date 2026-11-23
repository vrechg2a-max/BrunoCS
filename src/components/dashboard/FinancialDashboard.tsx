import React, { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  Download,
  ExternalLink,
  FileText,
  Filter,
  Plus,
  RotateCcw,
  Search,
} from 'lucide-react';
import {
  CONSTRUCTION_STATUS_LABELS,
  EXPENSE_CATEGORIES,
  type Construction,
  type CrossFilterState,
  type DatePreset,
  type Expense,
  type ExpenseCategory,
} from '../../types/domain';
import {
  computeFinancialAnalytics,
  exportExpensesToCsv,
  formatBRL,
  formatCompactBRL,
  formatDateBR,
  formatNumberBR,
  getPresetDateRange,
} from '../../utils/formatters';

interface FinancialDashboardProps {
  constructions: Construction[];
  expenses: Expense[];
  filter: CrossFilterState;
  onChangeFilter: (next: CrossFilterState) => void;
  onOpenConstruction: (constructionId: string) => void;
  onNewExpense: (defaultConstructionId?: string) => void;
  onEditExpense: (expense: Expense) => void;
  onSeedSampleData: () => Promise<void>;
  seeding: boolean;
}

const DATE_PRESETS: { id: DatePreset; label: string }[] = [
  { id: 'all', label: 'Todo período' },
  { id: '7d', label: '7 dias' },
  { id: '30d', label: '30 dias' },
  { id: 'month', label: 'Este mês' },
  { id: '90d', label: '90 dias' },
];

export function FinancialDashboard({
  constructions,
  expenses,
  filter,
  onChangeFilter,
  onOpenConstruction,
  onNewExpense,
  onEditExpense,
  onSeedSampleData,
  seeding,
}: FinancialDashboardProps) {
  const analytics = useMemo(
    () => computeFinancialAnalytics(constructions, expenses, filter),
    [constructions, expenses, filter],
  );

  const constructionNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of constructions) map[c.id] = c.nome;
    return map;
  }, [constructions]);

  const handlePresetClick = (preset: DatePreset) => {
    const range = getPresetDateRange(preset);
    onChangeFilter({
      ...filter,
      datePreset: preset,
      startDate: range.startDate,
      endDate: range.endDate,
    });
  };

  const handleResetFilters = () => {
    onChangeFilter({
      constructionId: 'all',
      datePreset: 'all',
      startDate: '',
      endDate: '',
      category: 'all',
      searchQuery: '',
    });
  };

  const hasActiveFilter =
    filter.constructionId !== 'all' ||
    filter.startDate !== '' ||
    filter.endDate !== '' ||
    filter.category !== 'all' ||
    filter.searchQuery.trim() !== '';

  const constructionChartData = useMemo(
    () =>
      analytics.byConstruction.map((item) => ({
        name: item.nome.length > 22 ? `${item.nome.slice(0, 20)}…` : item.nome,
        fullName: item.nome,
        Orçado: item.orcamentoTotal,
        Realizado: item.gastoAcumulado,
        NoPeríodo: item.gastoFiltrado,
      })),
    [analytics.byConstruction],
  );

  if (constructions.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-10 text-center max-w-2xl mx-auto my-8 space-y-4">
        <h2 className="text-xl font-semibold text-slate-900">
          Nenhuma obra cadastrada ainda
        </h2>
        <p className="text-sm text-slate-600 leading-relaxed max-w-lg mx-auto">
          Cadastre sua primeira construção ou importe os dados de referência da planilha
          Contabilidade Construção Wilson para explorar o dashboard financeiro, filtros
          cruzados por período e o visualizador 3D.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => void onSeedSampleData()}
            disabled={seeding}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors disabled:opacity-60 cursor-pointer whitespace-nowrap"
          >
            {seeding ? 'Importando dados...' : 'Carregar dados exemplo (Planilha Wilson)'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cross-Filter Bar (Construction + Date Period + Category + Search) */}
      <section
        aria-label="Filtros cruzados do painel financeiro"
        className="bg-white border border-slate-200 rounded-xl p-4 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Filter className="w-4 h-4 text-slate-500" />
            <span>Filtros Cruzados</span>
            {hasActiveFilter && (
              <span className="text-xs font-normal text-slate-500">
                · {analytics.filteredExpenses.length} lançamento(s) no recorte
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Segmented Date Range Presets */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
              {DATE_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handlePresetClick(preset.id)}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    filter.datePreset === preset.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {hasActiveFilter && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Limpar filtros
              </button>
            )}

            <button
              type="button"
              onClick={() => exportExpensesToCsv(analytics.filteredExpenses, constructionNameById)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Exportar CSV
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Construction filter */}
          <div>
            <label
              htmlFor="filter-construction"
              className="block text-xs font-medium text-slate-600 mb-1"
            >
              Construção específica
            </label>
            <select
              id="filter-construction"
              value={filter.constructionId}
              onChange={(e) =>
                onChangeFilter({ ...filter, constructionId: e.target.value })
              }
              className="w-full h-9 px-3 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
            >
              <option value="all">Todas as construções ({constructions.length})</option>
              {constructions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>

          {/* Start Date */}
          <div>
            <label
              htmlFor="filter-start-date"
              className="block text-xs font-medium text-slate-600 mb-1"
            >
              Data inicial
            </label>
            <div className="relative">
              <input
                id="filter-start-date"
                type="date"
                value={filter.startDate}
                onChange={(e) =>
                  onChangeFilter({
                    ...filter,
                    datePreset: 'custom',
                    startDate: e.target.value,
                  })
                }
                className="w-full h-9 px-3 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
            </div>
          </div>

          {/* End Date */}
          <div>
            <label
              htmlFor="filter-end-date"
              className="block text-xs font-medium text-slate-600 mb-1"
            >
              Data final
            </label>
            <input
              id="filter-end-date"
              type="date"
              value={filter.endDate}
              onChange={(e) =>
                onChangeFilter({
                  ...filter,
                  datePreset: 'custom',
                  endDate: e.target.value,
                })
              }
              className="w-full h-9 px-3 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
            />
          </div>

          {/* Category filter */}
          <div>
            <label
              htmlFor="filter-category"
              className="block text-xs font-medium text-slate-600 mb-1"
            >
              Categoria contábil
            </label>
            <select
              id="filter-category"
              value={filter.category}
              onChange={(e) =>
                onChangeFilter({
                  ...filter,
                  category: e.target.value as ExpenseCategory | 'all',
                })
              }
              className="w-full h-9 px-3 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
            >
              <option value="all">Todas as categorias</option>
              {EXPENSE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Search */}
          <div>
            <label
              htmlFor="filter-search"
              className="block text-xs font-medium text-slate-600 mb-1"
            >
              Buscar fornecedor ou item
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="filter-search"
                type="text"
                value={filter.searchQuery}
                onChange={(e) =>
                  onChangeFilter({ ...filter, searchQuery: e.target.value })
                }
                placeholder="Ex.: cimento, NF, pedreiro..."
                className="w-full h-9 pl-8 pr-3 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Primary KPI Strip (Single-Elevation Band with Hairline Dividers) */}
      <section
        aria-label="Indicadores financeiros principais"
        className="bg-white border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200"
      >
        {/* KPI 1: Total Filtered Costs */}
        <div className="p-5 space-y-1.5">
          <div className="text-xs font-medium text-slate-500">
            Custos Totais {filter.startDate || filter.endDate ? '(Período)' : '(Acumulado)'}
          </div>
          <div className="text-2xl font-semibold font-mono tabular-nums text-slate-900 tracking-tight">
            {formatBRL(analytics.totalFiltered)}
          </div>
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <span className="font-mono tabular-nums">
              {analytics.filteredExpenses.length}
            </span>
            <span>lançamento(s)</span>
            <span aria-hidden="true">·</span>
            <span>
              Acumulado {formatCompactBRL(analytics.totalOverall)}
            </span>
          </div>
        </div>

        {/* KPI 2: Last 7 Days Balance */}
        <div className="p-5 space-y-1.5">
          <div className="text-xs font-medium text-slate-500">
            Balanço da Última Semana (7d)
          </div>
          <div className="text-2xl font-semibold font-mono tabular-nums text-slate-900 tracking-tight">
            {formatBRL(analytics.last7DaysTotal)}
          </div>
          <div className="text-xs flex items-center gap-1.5">
            {analytics.weeklyDeltaPct !== null ? (
              <span
                className={`inline-flex items-center gap-0.5 font-mono tabular-nums font-medium ${
                  analytics.weeklyDeltaPct > 0 ? 'text-amber-700' : 'text-emerald-700'
                }`}
              >
                {analytics.weeklyDeltaPct > 0 ? (
                  <ArrowUpRight className="w-3.5 h-3.5" />
                ) : (
                  <ArrowDownRight className="w-3.5 h-3.5" />
                )}
                {analytics.weeklyDeltaPct > 0 ? '+' : ''}
                {formatNumberBR(analytics.weeklyDeltaPct, 1)}%
              </span>
            ) : (
              <span className="text-slate-500">Sem base anterior</span>
            )}
            <span className="text-slate-400" aria-hidden="true">
              ·
            </span>
            <span className="text-slate-500 font-mono tabular-nums">
              Ant. {formatCompactBRL(analytics.prev7DaysTotal)}
            </span>
          </div>
        </div>

        {/* KPI 3: Last 30 Days Balance */}
        <div className="p-5 space-y-1.5">
          <div className="text-xs font-medium text-slate-500">
            Balanço do Último Mês (30d)
          </div>
          <div className="text-2xl font-semibold font-mono tabular-nums text-slate-900 tracking-tight">
            {formatBRL(analytics.last30DaysTotal)}
          </div>
          <div className="text-xs flex items-center gap-1.5">
            {analytics.monthlyDeltaPct !== null ? (
              <span
                className={`inline-flex items-center gap-0.5 font-mono tabular-nums font-medium ${
                  analytics.monthlyDeltaPct > 0 ? 'text-amber-700' : 'text-emerald-700'
                }`}
              >
                {analytics.monthlyDeltaPct > 0 ? (
                  <ArrowUpRight className="w-3.5 h-3.5" />
                ) : (
                  <ArrowDownRight className="w-3.5 h-3.5" />
                )}
                {analytics.monthlyDeltaPct > 0 ? '+' : ''}
                {formatNumberBR(analytics.monthlyDeltaPct, 1)}%
              </span>
            ) : (
              <span className="text-slate-500">Sem base anterior</span>
            )}
            <span className="text-slate-400" aria-hidden="true">
              ·
            </span>
            <span className="text-slate-500 font-mono tabular-nums">
              Ant. {formatCompactBRL(analytics.prev30DaysTotal)}
            </span>
          </div>
        </div>

        {/* KPI 4: Budget Balance */}
        <div className="p-5 space-y-1.5">
          <div className="text-xs font-medium text-slate-500">
            Saldo Orçamentário Disponível
          </div>
          <div
            className={`text-2xl font-semibold font-mono tabular-nums tracking-tight ${
              analytics.budgetRemaining < 0 ? 'text-red-700' : 'text-slate-900'
            }`}
          >
            {formatBRL(analytics.budgetRemaining)}
          </div>
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <span className="font-mono tabular-nums">
              {formatNumberBR(analytics.budgetUtilizationPct, 1)}% executado
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              Prev. {formatCompactBRL(analytics.totalBudget)}
            </span>
          </div>
        </div>
      </section>

      {/* Main Analytics Grid: Costs per Construction + Category Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Costs per Construction Chart & Table */}
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Custos por Construção
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Comparativo entre orçamento total previsto, realizado acumulado e recorte de datas
              </p>
            </div>
            <span className="text-xs font-mono tabular-nums text-slate-500 whitespace-nowrap">
              {analytics.byConstruction.length} obra(s)
            </span>
          </div>

          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={constructionChartData}
                margin={{ top: 8, right: 12, left: 4, bottom: 0 }}
                barGap={6}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#475569', fontSize: 12 }}
                  axisLine={{ stroke: '#CBD5E1' }}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(v) => formatCompactBRL(Number(v))}
                  tick={{ fill: '#64748B', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={74}
                />
                <Tooltip
                  formatter={(value: unknown) => formatBRL(Number(value))}
                  labelFormatter={(_, payload) =>
                    payload?.[0]?.payload?.fullName || ''
                  }
                  contentStyle={{
                    backgroundColor: '#0F172A',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#F8FAFC',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="Orçado" fill="#CBD5E1" radius={[4, 4, 0, 0]} maxBarSize={38} />
                <Bar dataKey="Realizado" fill="#1D4ED8" radius={[4, 4, 0, 0]} maxBarSize={38} />
                {(filter.startDate || filter.endDate) && (
                  <Bar
                    dataKey="NoPeríodo"
                    name="No Período"
                    fill="#0F766E"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={38}
                  />
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Dense Construction Financial Summary Table */}
          <div className="overflow-x-auto border-t border-slate-200 pt-4">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                  <th className="pb-2 pr-3">Obra</th>
                  <th className="pb-2 px-3 text-right">No Período</th>
                  <th className="pb-2 px-3 text-right">Acumulado</th>
                  <th className="pb-2 px-3 text-right">Saldo</th>
                  <th className="pb-2 pl-3 text-right">R$/m²</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {analytics.byConstruction.map((row) => (
                  <tr
                    key={row.constructionId}
                    onClick={() => onOpenConstruction(row.constructionId)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="py-2.5 pr-3">
                      <div className="font-medium text-slate-900">{row.nome}</div>
                      <div className="text-xs text-slate-500">
                        {CONSTRUCTION_STATUS_LABELS[row.status]} ·{' '}
                        <span className="font-mono tabular-nums">
                          {formatNumberBR(row.percentualExecutado, 1)}% do orçamento
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-900">
                      {formatBRL(row.gastoFiltrado)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700">
                      {formatBRL(row.gastoAcumulado)}
                    </td>
                    <td
                      className={`py-2.5 px-3 text-right font-mono tabular-nums font-medium ${
                        row.saldoRestante < 0 ? 'text-red-700' : 'text-emerald-700'
                      }`}
                    >
                      {formatBRL(row.saldoRestante)}
                    </td>
                    <td className="py-2.5 pl-3 text-right font-mono tabular-nums text-slate-600">
                      {row.custoPorMetroQuadrado > 0
                        ? formatBRL(row.custoPorMetroQuadrado)
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Category Accounting Breakdown */}
        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between space-y-5">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Composição por Categoria Contábil
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Estrutura compatível com a planilha de custos (Iniciais, Material e Mão de Obra)
            </p>
          </div>

          <div className="space-y-3.5 flex-1">
            {analytics.byCategory.map((cat) => (
              <div key={cat.categoria} className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="font-medium text-slate-800 truncate">
                    {cat.categoria}
                  </span>
                  <div className="flex items-baseline gap-2 shrink-0 font-mono tabular-nums">
                    <span className="text-slate-900 font-medium">
                      {formatBRL(cat.total)}
                    </span>
                    <span className="text-xs text-slate-500 w-11 text-right">
                      {formatNumberBR(cat.sharePct, 1)}%
                    </span>
                  </div>
                </div>
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(100, cat.sharePct)}%`,
                      backgroundColor: cat.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Chronological Cashflow Mini Bar Chart */}
          <div className="border-t border-slate-200 pt-4">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
              <span className="font-medium text-slate-700 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                Evolução dos desembolsos no recorte
              </span>
              <span className="font-mono tabular-nums">
                {analytics.timeline.length} dia(s) com lançamento
              </span>
            </div>
            {analytics.timeline.length > 0 ? (
              <div className="h-32 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={analytics.timeline}
                    margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
                  >
                    <XAxis
                      dataKey="label"
                      tick={{ fill: '#64748B', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(val: unknown) => [formatBRL(Number(val)), 'Desembolso']}
                      labelFormatter={(label) => `Data: ${label}`}
                      contentStyle={{
                        backgroundColor: '#0F172A',
                        border: 'none',
                        borderRadius: '8px',
                        color: '#F8FAFC',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="total" fill="#1D4ED8" radius={[3, 3, 0, 0]} maxBarSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-xs text-slate-400 py-6 text-center">
                Sem movimentações financeiras para o intervalo selecionado.
              </p>
            )}
          </div>
        </section>
      </div>

      {/* Filtered Recent Expenses Preview Table */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Extrato de Despesas Filtradas
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Exibindo {Math.min(10, analytics.filteredExpenses.length)} de{' '}
              {analytics.filteredExpenses.length} lançamento(s)
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              onNewExpense(filter.constructionId !== 'all' ? filter.constructionId : undefined)
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Lançar despesa
          </button>
        </div>

        {analytics.filteredExpenses.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <p className="text-sm font-medium text-slate-700">
              Nenhum lançamento encontrado com os filtros atuais.
            </p>
            <p className="text-xs text-slate-500">
              Ajuste o período de datas ou selecione outra obra para visualizar os custos.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-500">
                  <th className="py-2.5 pl-5 pr-3">Data</th>
                  <th className="py-2.5 px-3">Obra / Categoria</th>
                  <th className="py-2.5 px-3">Descrição & Fornecedor</th>
                  <th className="py-2.5 px-3">Pagamento</th>
                  <th className="py-2.5 px-3">Nota Fiscal</th>
                  <th className="py-2.5 pl-3 pr-5 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {analytics.filteredExpenses.slice(0, 10).map((exp) => (
                  <tr
                    key={exp.id}
                    onClick={() => onEditExpense(exp)}
                    className="hover:bg-slate-50/90 cursor-pointer transition-colors"
                  >
                    <td className="py-3 pl-5 pr-3 font-mono tabular-nums text-xs text-slate-600 whitespace-nowrap">
                      {formatDateBR(exp.data)}
                    </td>
                    <td className="py-3 px-3">
                      <div className="text-sm font-medium text-slate-900">
                        {exp.categoria}
                      </div>
                      <div className="text-xs text-slate-500">
                        {constructionNameById[exp.constructionId] || 'Obra'}
                      </div>
                    </td>
                    <td className="py-3 px-3 max-w-xs">
                      <div className="text-sm text-slate-800 truncate">
                        {exp.descricao}
                      </div>
                      <div className="text-xs text-slate-500 truncate">
                        {exp.fornecedor}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-xs text-slate-600 whitespace-nowrap">
                      {exp.formaPagamento}
                    </td>
                    <td
                      className="py-3 px-3 text-xs whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {exp.notaFiscalUrl ? (
                        <a
                          href={exp.notaFiscalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-blue-700 hover:underline font-medium"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          {exp.notaFiscalNumero || exp.notaFiscalNome || 'Abrir NF'}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : exp.notaFiscalNumero ? (
                        <span className="font-mono text-slate-600">
                          {exp.notaFiscalNumero}
                        </span>
                      ) : (
                        <span className="text-slate-400">Sem anexo</span>
                      )}
                    </td>
                    <td className="py-3 pl-3 pr-5 text-right font-mono tabular-nums font-medium text-slate-900 whitespace-nowrap">
                      {formatBRL(exp.valor)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
