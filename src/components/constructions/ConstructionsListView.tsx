import React from 'react';
import { ArrowRight, Box, Plus } from 'lucide-react';
import {
  CONSTRUCTION_STATUS_LABELS,
  type Construction,
  type Expense,
} from '../../types/domain';
import { formatBRL, formatDateBR, formatNumberBR } from '../../utils/formatters';
import { SafeImage } from '../common/SafeImage';

interface ConstructionsListViewProps {
  constructions: Construction[];
  expenses: Expense[];
  onOpenConstruction: (constructionId: string) => void;
  onNewConstruction: () => void;
  onNewExpense: (constructionId: string) => void;
}

export function ConstructionsListView({
  constructions,
  expenses,
  onOpenConstruction,
  onNewConstruction,
  onNewExpense,
}: ConstructionsListViewProps) {
  if (constructions.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-10 text-center max-w-xl mx-auto my-8 space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">
          Nenhuma construção cadastrada
        </h2>
        <p className="text-sm text-slate-600">
          Adicione sua primeira obra para gerenciar o terreno, galeria de fotos, modelo 3D e
          controle de despesas.
        </p>
        <button
          type="button"
          onClick={onNewConstruction}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          Nova Construção
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Carteira de Obras e Construções
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {constructions.length} construção(ões) ativa(s) com rastreamento orçamentário e inspeção 3D
          </p>
        </div>
        <button
          type="button"
          onClick={onNewConstruction}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          Nova Construção
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {constructions.map((obra) => {
          const siteExpenses = expenses.filter((e) => e.constructionId === obra.id);
          const totalSpent = siteExpenses.reduce((sum, e) => sum + e.valor, 0);
          const remaining = obra.orcamentoTotal - totalSpent;
          const pct = obra.orcamentoTotal > 0 ? (totalSpent / obra.orcamentoTotal) * 100 : 0;

          return (
            <article
              key={obra.id}
              className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col justify-between"
            >
              <div>
                <div
                  onClick={() => onOpenConstruction(obra.id)}
                  className="aspect-[16/9] w-full overflow-hidden bg-slate-100 cursor-pointer relative group"
                >
                  <SafeImage
                    src={obra.coverPhotoUrl || obra.terrainPhotoUrl}
                    alt={`Fotografia da obra ${obra.nome}`}
                    fallbackLabel={obra.nome}
                    className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                  />
                </div>

                <div className="p-5 space-y-4">
                  <div>
                    <div className="text-xs text-slate-500 flex flex-wrap items-center gap-1.5">
                      <span className="font-medium text-slate-700">
                        {CONSTRUCTION_STATUS_LABELS[obra.status]}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{obra.cliente}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        {formatNumberBR(obra.areaConstruida, 0)} m² construídos
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 mt-1">
                      <button
                        type="button"
                        onClick={() => onOpenConstruction(obra.id)}
                        className="text-left hover:text-blue-700 transition-colors cursor-pointer"
                      >
                        {obra.nome}
                      </button>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">{obra.endereco}</p>
                  </div>

                  {/* Budget Progress Bar */}
                  <div className="space-y-1.5">
                    <div className="flex items-baseline justify-between text-xs">
                      <span className="text-slate-600">
                        Executado ({formatNumberBR(pct, 1)}%)
                      </span>
                      <span className="font-mono tabular-nums font-medium text-slate-900">
                        {formatBRL(totalSpent)}{' '}
                        <span className="text-slate-400 font-normal">
                          / {formatBRL(obra.orcamentoTotal)}
                        </span>
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          pct > 100
                            ? 'bg-red-600'
                            : pct > 85
                              ? 'bg-amber-600'
                              : 'bg-blue-700'
                        }`}
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-500 font-mono tabular-nums">
                      <span>Início: {formatDateBR(obra.dataInicio)}</span>
                      <span className={remaining < 0 ? 'text-red-700 font-medium' : ''}>
                        Saldo: {formatBRL(remaining)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50/50 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => onNewExpense(obra.id)}
                  className="text-xs font-medium text-slate-700 hover:text-slate-900 transition-colors cursor-pointer whitespace-nowrap"
                >
                  + Lançar custo
                </button>
                <button
                  type="button"
                  onClick={() => onOpenConstruction(obra.id)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-800 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Box className="w-3.5 h-3.5" />
                  Abrir Obra & Visualizador 3D
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
