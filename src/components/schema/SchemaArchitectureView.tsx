import React, { useState } from 'react';
import { Check, Copy, Database, ShieldCheck } from 'lucide-react';
import blueprintSchema from '../../../firebase-blueprint.json';

export function SchemaArchitectureView() {
  const [copied, setCopied] = useState(false);

  const formattedJson = JSON.stringify(blueprintSchema, null, 2);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(formattedJson);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Schema NoSQL / Firestore & Arquitetura Edge
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Modelagem das coleções compatível com a planilha Contabilidade Construção WILSON e
            regras Zero-Trust implantadas no Firebase
          </p>
        </div>

        <button
          type="button"
          onClick={() => void handleCopy()}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              JSON copiado
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              Copiar Schema JSON
            </>
          )}
        </button>
      </div>

      {/* Collection Architecture Overview */}
      <section className="bg-white border border-slate-200 rounded-xl grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-200">
        <div className="p-5 space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Database className="w-4 h-4 text-blue-700" />
            <span className="font-mono text-xs">/constructions/{'{constructionId}'}</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Documento raiz de cada obra contendo orçamento, áreas, status, capas de terreno/casa e
            URLs dos modelos 3D (exterior e interior) para consumo via GLTFLoader / Luma AI.
          </p>
        </div>

        <div className="p-5 space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Database className="w-4 h-4 text-blue-700" />
            <span className="font-mono text-xs">
              /constructions/{'{id}'}/photos/{'{photoId}'}
            </span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Subcoleção escalável para o diário fotográfico (terreno, estrutura, fachada, interior),
            evitando arrays ilimitados no documento pai e garantindo validação relacional via Master
            Gate.
          </p>
        </div>

        <div className="p-5 space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <ShieldCheck className="w-4 h-4 text-emerald-700" />
            <span className="font-mono text-xs">/expenses/{'{expenseId}'}</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Coleção raiz indexada por <code className="font-mono">ownerId</code> para filtragem
            cruzada instantânea por período de datas e obra, com referência à Nota Fiscal no
            Firebase Storage.
          </p>
        </div>
      </section>

      {/* Raw JSON Blueprint Viewer */}
      <section className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-800 flex items-center justify-between text-xs text-slate-300">
          <span className="font-mono">firebase-blueprint.json</span>
          <span>JSON Schema (draft-07) · Sincronizado com firestore.rules</span>
        </div>
        <pre className="p-5 text-xs font-mono text-slate-200 overflow-x-auto max-h-[540px] leading-relaxed">
          {formattedJson}
        </pre>
      </section>
    </div>
  );
}
