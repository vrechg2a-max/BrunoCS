import React from 'react';
import { AlertCircle, Building2, FileSpreadsheet, Layers, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { SAMPLE_SITE_IMAGES } from '../../services/firestoreService';
import { SafeImage } from '../common/SafeImage';

export function LoginGate() {
  const { signInWithGoogle, authError } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Clean 3-zone Top Bar Contract */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between gap-8">
        <span className="text-lg font-bold tracking-tight text-slate-900 font-display whitespace-nowrap shrink-0">
          ObraControl
        </span>
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          <a href="#recursos" className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0">
            Módulos
          </a>
          <a href="#arquitetura" className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0">
            Firestore & 3D
          </a>
        </nav>
        <div className="shrink-0">
          <button
            type="button"
            onClick={() => void signInWithGoogle()}
            className="px-4 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Entrar com Google
          </button>
        </div>
      </header>

      {/* Balanced 2-Column Split Hero */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-12 flex flex-col justify-center gap-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-8 flex flex-col justify-between space-y-8">
            <div className="space-y-4">
              <div className="text-xs font-medium text-slate-500">
                Gestão de Obras · Contabilidade Residencial · Visualização 3D
              </div>
              <h1
                className="text-3xl sm:text-4xl font-semibold text-slate-900 tracking-tight leading-tight"
                style={{ textWrap: 'balance' }}
              >
                Controle financeiro de obras e inspeção 3D em tempo real
              </h1>
              <p className="text-sm text-slate-600 leading-relaxed max-w-xl">
                Estruture o orçamento de cada construção, lance custos por categoria e fornecedor
                com anexo de Nota Fiscal no Firebase Storage e navegue pelos modelos 3D exterior e
                interior compatíveis com fotogrametria Luma AI.
              </p>
            </div>

            <div className="space-y-4">
              {authError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{authError}</span>
                </div>
              )}

              <button
                type="button"
                onClick={() => void signInWithGoogle()}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-6 py-3 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M21.35 11.1h-9.18v2.92h5.27c-.23 1.24-.92 2.29-1.96 2.99v2.48h3.17c1.86-1.71 2.93-4.23 2.93-7.21 0-.4-.04-.79-.23-1.18z"
                  />
                  <path
                    fill="currentColor"
                    d="M12.17 22c2.65 0 4.88-.88 6.51-2.38l-3.17-2.48c-.88.59-2 .94-3.34.94-2.57 0-4.74-1.73-5.52-4.06H3.38v2.55C5 19.79 8.33 22 12.17 22z"
                  />
                  <path
                    fill="currentColor"
                    d="M6.65 14.02c-.2-.59-.31-1.22-.31-1.88s.11-1.29.31-1.88V7.71H3.38A9.82 9.82 0 0 0 2.34 12.14c0 1.59.38 3.1 1.04 4.43l3.27-2.55z"
                  />
                  <path
                    fill="currentColor"
                    d="M12.17 6.2c1.44 0 2.74.5 3.76 1.47l2.82-2.82C17.04 3.26 14.82 2.28 12.17 2.28 8.33 2.28 5 4.49 3.38 7.71l3.27 2.55c.78-2.33 2.95-4.06 5.52-4.06z"
                  />
                </svg>
                Acessar painel com conta Google
              </button>

              <p className="text-xs text-slate-500">
                Seus registros contábeis, fotos e notas fiscais ficam isolados na sua conta via
                regras de segurança Firestore por proprietário.
              </p>
            </div>
          </div>

          <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
            <div className="flex-1 min-h-[300px] lg:h-full relative">
              <SafeImage
                src={SAMPLE_SITE_IMAGES.fachada}
                alt="Fachada de obra residencial contemporânea monitorada no ObraControl"
                fallbackLabel="ObraControl"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>

        {/* Full-width 4-column Architectural Capabilities Row */}
        <section
          id="recursos"
          className="bg-white border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200"
        >
          <div id="arquitetura" className="p-5 space-y-1.5">
            <Building2 className="w-4 h-4 text-blue-700" />
            <h2 className="text-sm font-semibold text-slate-900">CRUD de Construções</h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Cadastro completo de obras, orçamento previsto, metragem e galeria fotográfica de
              terreno e casa.
            </p>
          </div>
          <div className="p-5 space-y-1.5">
            <Layers className="w-4 h-4 text-blue-700" />
            <h2 className="text-sm font-semibold text-slate-900">Visualizador 3D & Luma AI</h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Maquete BIM interativa (exterior/interior) pronta para consumir modelos .GLB/.GLTF de
              fotogrametria.
            </p>
          </div>
          <div className="p-5 space-y-1.5">
            <FileSpreadsheet className="w-4 h-4 text-blue-700" />
            <h2 className="text-sm font-semibold text-slate-900">Contabilidade & Notas Fiscais</h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Lançamentos categorizados (Iniciais, Material, Mão de Obra) com anexo de NF e
              exportação CSV.
            </p>
          </div>
          <div className="p-5 space-y-1.5">
            <ShieldCheck className="w-4 h-4 text-blue-700" />
            <h2 className="text-sm font-semibold text-slate-900">Analytics & Filtros Cruzados</h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Balanço semanal e mensal com filtragem simultânea por período de datas e obra
              específica.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
