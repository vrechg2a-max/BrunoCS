import React, { useMemo } from 'react';
import {
  Download,
  ExternalLink,
  FileText,
  Pencil,
  Plus,
  Search,
} from 'lucide-react';
import {
  EXPENSE_CATEGORIES,
  type Construction,
  type CrossFilterState,
  type Expense,
  type ExpenseCategory,
} from '../../types/domain';
import {
  computeFinancialAnalytics,
  exportExpensesToCsv,
  formatBRL,
  formatDateBR,
} from '../../utils/formatters';

interface ExpensesLedgerViewProps {
  constructions: Construction[];
  expenses: Expense[];
  filter: CrossFilterState;
  onChangeFilter: (next: CrossFilterState) => void;
  onNewExpense: (constructionId?: string) => void;
  onEditExpense: (expense: Expense) => void;
}

export function ExpensesLedgerView({
  constructions,
  expenses,
  filter,
  onChangeFilter,
  onNewExpense,
  onEditExpense,
}: ExpensesLedgerViewProps) {
  const analytics = useMemo(
    () => computeFinancialAnalytics(constructions, expenses, filter),
    [constructions, expenses, filter],
  );

  const constructionNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of constructions) map[c.id] = c.nome;
    return map;
  }, [constructions]);

  return (
    <div className="space-y-5">
      {/* Filter Controls */}
      <section className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label
              htmlFor="ledger-construction"
              className="block text-xs font-medium text-slate-600 mb-1"
            >
              Obra
            </label>
            <select
              id="ledger-construction"
              value={filter.constructionId}
              onChange={(e) =>
                onChangeFilter({ ...filter, constructionId: e.target.value })
              }
              className="w-full h-9 px-3 text-sm bg-white border border-slate-200 rounded-lg text-slate-900"
            >
              <option value="all">Todas as construções</option>
              {constructions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="ledger-category"
              className="block text-xs font-medium text-slate-600 mb-1"
            >
              Categoria
            </label>
            <select
              id="ledger-category"
              value={filter.category}
              onChange={(e) =>
                onChangeFilter({
                  ...filter,
                  category: e.target.value as ExpenseCategory | 'all',
                })
              }
              className="w-full h-9 px-3 text-sm bg-white border border-slate-200 rounded-lg text-slate-900"
            >
              <option value="all">Todas as categorias</option>
              {EXPENSE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="ledger-start"
              className="block text-xs font-medium text-slate-600 mb-1"
            >
              De
            </label>
            <input
              id="ledger-start"
              type="date"
              value={filter.startDate}
              onChange={(e) =>
                onChangeFilter({
                  ...filter,
                  datePreset: 'custom',
                  startDate: e.target.value,
                })
              }
              className="w-full h-9 px-3 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-lg text-slate-900"
            />
          </div>

          <div>
            <label
              htmlFor="ledger-end"
              className="block text-xs font-medium text-slate-600 mb-1"
            >
              Até
            </label>
            <input
              id="ledger-end"
              type="date"
              value={filter.endDate}
              onChange={(e) =>
                onChangeFilter({
                  ...filter,
                  datePreset: 'custom',
                  endDate: e.target.value,
                })
              }
              className="w-full h-9 px-3 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-lg text-slate-900"
            />
          </div>

          <div>
            <label
              htmlFor="ledger-search"
              className="block text-xs font-medium text-slate-600 mb-1"
            >
              Pesquisar
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="ledger-search"
                type="text"
                value={filter.searchQuery}
                onChange={(e) =>
                  onChangeFilter({ ...filter, searchQuery: e.target.value })
                }
                placeholder="Fornecedor, item, NF..."
                className="w-full h-9 pl-8 pr-3 text-sm bg-white border border-slate-200 rounded-lg text-slate-900"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Ledger Table */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Livro Razão de Custos e Despesas
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
              {analytics.filteredExpenses.length} registro(s) · Total no recorte:{' '}
              <strong className="text-slate-900">{formatBRL(analytics.totalFiltered)}</strong>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => exportExpensesToCsv(analytics.filteredExpenses, constructionNameById)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Exportar planilha CSV
            </button>
            <button
              type="button"
              onClick={() =>
                onNewExpense(filter.constructionId !== 'all' ? filter.constructionId : undefined)
              }
              disabled={constructions.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Novo lançamento
            </button>
          </div>
        </div>

        {analytics.filteredExpenses.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <p className="text-sm font-medium text-slate-700">
              Nenhum lançamento financeiro encontrado.
            </p>
            <p className="text-xs text-slate-500">
              {constructions.length === 0
                ? 'Cadastre uma construção primeiro para iniciar os lançamentos de despesas.'
                : 'Registre a primeira despesa ou ajuste os filtros acima.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-500">
                  <th className="py-2.5 pl-5 pr-3">Data</th>
                  <th className="py-2.5 px-3">Construção</th>
                  <th className="py-2.5 px-3">Categoria</th>
                  <th className="py-2.5 px-3">Descrição</th>
                  <th className="py-2.5 px-3">Local / Empresa</th>
                  <th className="py-2.5 px-3">Pagamento</th>
                  <th className="py-2.5 px-3">Nota Fiscal</th>
                  <th className="py-2.5 px-3 text-right">Valor (R$)</th>
                  <th className="py-2.5 pl-2 pr-5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {analytics.filteredExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50/90 transition-colors">
                    <td className="py-3 pl-5 pr-3 font-mono tabular-nums text-xs text-slate-600 whitespace-nowrap">
                      {formatDateBR(exp.data)}
                    </td>
                    <td className="py-3 px-3 text-xs font-medium text-slate-800 whitespace-nowrap">
                      {constructionNameById[exp.constructionId] || '—'}
                    </td>
                    <td className="py-3 px-3 text-xs text-slate-700 whitespace-nowrap">
                      {exp.categoria}
                    </td>
                    <td className="py-3 px-3 text-sm text-slate-900 max-w-xs truncate">
                      {exp.descricao}
                    </td>
                    <td className="py-3 px-3 text-xs text-slate-600 max-w-[180px] truncate">
                      {exp.fornecedor}
                    </td>
                    <td className="py-3 px-3 text-xs text-slate-600 whitespace-nowrap">
                      {exp.formaPagamento}
                    </td>
                    <td className="py-3 px-3 text-xs whitespace-nowrap">
                      {exp.notaFiscalUrl ? (
                        <a
                          href={exp.notaFiscalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-blue-700 hover:underline font-medium"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          {exp.notaFiscalNumero || exp.notaFiscalNome || 'Ver NF'}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : exp.notaFiscalNumero ? (
                        <span className="font-mono text-slate-600">
                          {exp.notaFiscalNumero}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums font-medium text-slate-900 whitespace-nowrap">
                      {formatBRL(exp.valor)}
                    </td>
                    <td className="py-3 pl-2 pr-5 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onEditExpense(exp)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                        title="Editar lançamento"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Editar
                      </button>
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
