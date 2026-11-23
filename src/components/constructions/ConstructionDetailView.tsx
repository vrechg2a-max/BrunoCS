import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  FileText,
  ImagePlus,
  Link2,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  CONSTRUCTION_STATUS_LABELS,
  PHOTO_TYPE_LABELS,
  PHOTO_TYPE_OPTIONS,
  SCHEMA_LIMITS,
  type Construction,
  type ConstructionPhoto,
  type Expense,
  type PhotoType,
} from '../../types/domain';
import {
  addConstructionPhoto,
  deleteConstructionPhoto,
  subscribeConstructionPhotos,
  updateConstructionMedia,
} from '../../services/firestoreService';
import { uploadConstructionPhotoFile } from '../../services/storageService';
import { formatBRL, formatDateBR, formatNumberBR, toIsoDateString } from '../../utils/formatters';
import { SafeImage } from '../common/SafeImage';
import { Construction3DViewer } from '../three/Construction3DViewer';

interface ConstructionDetailViewProps {
  ownerId: string;
  construction: Construction;
  expenses: Expense[];
  onBack: () => void;
  onEditConstruction: (construction: Construction) => void;
  onNewExpense: (constructionId: string) => void;
  onEditExpense: (expense: Expense) => void;
}

export function ConstructionDetailView({
  ownerId,
  construction,
  expenses,
  onBack,
  onEditConstruction,
  onNewExpense,
  onEditExpense,
}: ConstructionDetailViewProps) {
  const photoFileRef = useRef<HTMLInputElement | null>(null);

  const [photos, setPhotos] = useState<ConstructionPhoto[]>([]);
  const [photoFilter, setPhotoFilter] = useState<PhotoType | 'all'>('all');

  // Photo Upload state
  const [uploadTipo, setUploadTipo] = useState<PhotoType>('fachada');
  const [uploadLegenda, setUploadLegenda] = useState('');
  const [uploadData, setUploadData] = useState(toIsoDateString(new Date()));
  const [uploadExternalUrl, setUploadExternalUrl] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [photoError, setPhotoError] = useState<string | null>(null);

  // Luma AI / 3D URL configuration panel
  const [show3dConfig, setShow3dConfig] = useState(false);
  const [ext3dUrl, setExt3dUrl] = useState(construction.model3dExteriorUrl || '');
  const [int3dUrl, setInt3dUrl] = useState(construction.model3dInteriorUrl || '');
  const [saving3d, setSaving3d] = useState(false);
  const [saved3dFeedback, setSaved3dFeedback] = useState(false);

  useEffect(() => {
    setExt3dUrl(construction.model3dExteriorUrl || '');
    setInt3dUrl(construction.model3dInteriorUrl || '');
  }, [construction.id, construction.model3dExteriorUrl, construction.model3dInteriorUrl]);

  useEffect(() => {
    const unsub = subscribeConstructionPhotos(construction.id, ownerId, setPhotos);
    return () => unsub();
  }, [construction.id, ownerId]);

  const siteExpenses = useMemo(
    () =>
      expenses
        .filter((e) => e.constructionId === construction.id)
        .sort((a, b) => (a.data < b.data ? 1 : -1)),
    [expenses, construction.id],
  );

  const totalSpent = useMemo(
    () => siteExpenses.reduce((sum, e) => sum + e.valor, 0),
    [siteExpenses],
  );

  const budgetRemaining = construction.orcamentoTotal - totalSpent;
  const pctExecuted =
    construction.orcamentoTotal > 0 ? (totalSpent / construction.orcamentoTotal) * 100 : 0;
  const costPerSqm =
    construction.areaConstruida > 0 ? totalSpent / construction.areaConstruida : 0;

  const filteredPhotos = useMemo(
    () =>
      photoFilter === 'all' ? photos : photos.filter((p) => p.tipo === photoFilter),
    [photos, photoFilter],
  );

  const handlePhotoFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setPhotoError(null);
    setUploadingPhoto(true);
    setUploadProgress(0);

    try {
      const uploaded = await uploadConstructionPhotoFile(
        file,
        ownerId,
        construction.id,
        uploadTipo,
        setUploadProgress,
      );
      await addConstructionPhoto(ownerId, construction.id, {
        tipo: uploadTipo,
        url: uploaded.url,
        legenda: uploadLegenda.trim() || `${PHOTO_TYPE_LABELS[uploadTipo]} — ${file.name}`,
        dataFoto: uploadData,
        storagePath: uploaded.storagePath,
      });

      // Optionally update cover/terrain photo pointer on parent construction (if not locked)
      if (construction.status !== 'concluida') {
        if (uploadTipo === 'terreno') {
          await updateConstructionMedia(construction.id, { terrainPhotoUrl: uploaded.url });
        } else if (uploadTipo === 'fachada') {
          await updateConstructionMedia(construction.id, { coverPhotoUrl: uploaded.url });
        }
      }

      setUploadLegenda('');
    } catch (err) {
      setPhotoError(
        err instanceof Error ? err.message : 'Erro ao enviar fotografia para o Firebase Storage.',
      );
    } finally {
      setUploadingPhoto(false);
      setUploadProgress(0);
      event.target.value = '';
    }
  };

  const handleAddPhotoByUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadExternalUrl.trim()) return;
    setPhotoError(null);
    setUploadingPhoto(true);
    try {
      await addConstructionPhoto(ownerId, construction.id, {
        tipo: uploadTipo,
        url: uploadExternalUrl.trim(),
        legenda: uploadLegenda.trim() || `Registro — ${PHOTO_TYPE_LABELS[uploadTipo]}`,
        dataFoto: uploadData,
      });
      setUploadExternalUrl('');
      setUploadLegenda('');
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Erro ao registrar link da imagem.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSave3dUrls = async (e: React.FormEvent) => {
    e.preventDefault();
    if (construction.status === 'concluida') return;
    setSaving3d(true);
    setSaved3dFeedback(false);
    try {
      await updateConstructionMedia(construction.id, {
        model3dExteriorUrl: ext3dUrl.trim(),
        model3dInteriorUrl: int3dUrl.trim(),
      });
      setSaved3dFeedback(true);
      window.setTimeout(() => setSaved3dFeedback(false), 3000);
    } finally {
      setSaving3d(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Contextual Actions */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Voltar para Construções
          </button>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
            {construction.nome}
          </h1>
          <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2">
            <span className="font-medium text-slate-700">
              {CONSTRUCTION_STATUS_LABELS[construction.status]}
            </span>
            <span aria-hidden="true">·</span>
            <span>Cliente: {construction.cliente}</span>
            <span aria-hidden="true">·</span>
            <span>{construction.endereco}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              Terreno {formatNumberBR(construction.areaTerreno, 0)}m² / Construída{' '}
              {formatNumberBR(construction.areaConstruida, 0)}m²
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => onEditConstruction(construction)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            <Pencil className="w-3.5 h-3.5" />
            Editar obra
          </button>
          <button
            type="button"
            onClick={() => onNewExpense(construction.id)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            Lançar despesa
          </button>
        </div>
      </div>

      {/* Engineering & Financial KPI Strip */}
      <section className="bg-white border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
        <div className="p-4 space-y-1">
          <div className="text-xs text-slate-500">Orçamento Previsto</div>
          <div className="text-xl font-semibold font-mono tabular-nums text-slate-900">
            {formatBRL(construction.orcamentoTotal)}
          </div>
          <div className="text-xs text-slate-500 font-mono tabular-nums">
            Início {formatDateBR(construction.dataInicio)}
          </div>
        </div>
        <div className="p-4 space-y-1">
          <div className="text-xs text-slate-500">Custo Acumulado</div>
          <div className="text-xl font-semibold font-mono tabular-nums text-slate-900">
            {formatBRL(totalSpent)}
          </div>
          <div className="text-xs text-slate-500 font-mono tabular-nums">
            {formatNumberBR(pctExecuted, 1)}% executado · {siteExpenses.length} lançamento(s)
          </div>
        </div>
        <div className="p-4 space-y-1">
          <div className="text-xs text-slate-500">Saldo Disponível</div>
          <div
            className={`text-xl font-semibold font-mono tabular-nums ${
              budgetRemaining < 0 ? 'text-red-700' : 'text-emerald-700'
            }`}
          >
            {formatBRL(budgetRemaining)}
          </div>
          <div className="text-xs text-slate-500">
            {budgetRemaining < 0 ? 'Acima do orçamento previsto' : 'Dentro do orçamento'}
          </div>
        </div>
        <div className="p-4 space-y-1">
          <div className="text-xs text-slate-500">Custo por m² Construído</div>
          <div className="text-xl font-semibold font-mono tabular-nums text-slate-900">
            {costPerSqm > 0 ? formatBRL(costPerSqm) : '—'}
          </div>
          <div className="text-xs text-slate-500 font-mono tabular-nums">
            Área construída: {formatNumberBR(construction.areaConstruida, 0)} m²
          </div>
        </div>
      </section>

      {/* Primary Focal Anchor: Interactive 3D Construction Viewer (Exterior + Interior + Luma AI URL) */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Visualizador 3D da Obra (Exterior e Interior)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Inspecione a maquete interativa ou vincule URLs de modelos 3D (.GLB/.GLTF) gerados via
              Luma AI / fotogrametria
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShow3dConfig((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            <Link2 className="w-3.5 h-3.5" />
            {show3dConfig ? 'Ocultar URLs 3D' : 'Configurar URLs Luma AI'}
          </button>
        </div>

        {show3dConfig && (
          <form
            onSubmit={handleSave3dUrls}
            className="bg-white border border-slate-200 rounded-xl p-4 space-y-3"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="detail-3d-ext"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  URL do Modelo 3D Exterior (.glb / .gltf — Luma AI)
                </label>
                <input
                  id="detail-3d-ext"
                  type="url"
                  maxLength={SCHEMA_LIMITS.construction.urlMax}
                  value={ext3dUrl}
                  onChange={(e) => setExt3dUrl(e.target.value)}
                  placeholder="https://cdn-luma.com/.../exterior.glb"
                  className="w-full h-9 px-3 text-xs font-mono bg-white border border-slate-200 rounded-lg text-slate-900"
                />
              </div>
              <div>
                <label
                  htmlFor="detail-3d-int"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  URL do Modelo 3D Interior (.glb / .gltf — Luma AI)
                </label>
                <input
                  id="detail-3d-int"
                  type="url"
                  maxLength={SCHEMA_LIMITS.construction.urlMax}
                  value={int3dUrl}
                  onChange={(e) => setInt3dUrl(e.target.value)}
                  placeholder="https://cdn-luma.com/.../interior.glb"
                  className="w-full h-9 px-3 text-xs font-mono bg-white border border-slate-200 rounded-lg text-slate-900"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] text-slate-500">
                Deixe em branco para utilizar a maquete arquitetônica BIM interativa nativa.
              </p>
              <div className="flex items-center gap-3">
                {saved3dFeedback && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    URLs salvas no Firestore
                  </span>
                )}
                <button
                  type="submit"
                  disabled={saving3d || construction.status === 'concluida'}
                  className="px-3.5 py-1.5 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap"
                >
                  {saving3d ? 'Salvando...' : 'Salvar URLs 3D'}
                </button>
              </div>
            </div>
          </form>
        )}

        <Construction3DViewer
          constructionName={construction.nome}
          exteriorModelUrl={construction.model3dExteriorUrl}
          interiorModelUrl={construction.model3dInteriorUrl}
          onConfigureUrls={() => setShow3dConfig(true)}
        />
      </section>

      {/* Photo Gallery & Storage Upload (Terreno e Casa) */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Diário Fotográfico — Terreno e Evolução da Casa
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {photos.length} fotografia(s) registrada(s) na subcoleção Firestore / Storage
            </p>
          </div>

          {/* Interactive Photo Category Filter */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
            <button
              type="button"
              onClick={() => setPhotoFilter('all')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                photoFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Todas
            </button>
            {PHOTO_TYPE_OPTIONS.map((tipo) => (
              <button
                key={tipo}
                type="button"
                onClick={() => setPhotoFilter(tipo)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  photoFilter === tipo
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {PHOTO_TYPE_LABELS[tipo]}
              </button>
            ))}
          </div>
        </div>

        {/* Upload Strip */}
        <div className="border-t border-b border-slate-200 py-4 space-y-3">
          {photoError && (
            <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{photoError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            <div className="md:col-span-2">
              <label
                htmlFor="photo-type"
                className="block text-xs font-medium text-slate-600 mb-1"
              >
                Etapa da foto
              </label>
              <select
                id="photo-type"
                value={uploadTipo}
                onChange={(e) => setUploadTipo(e.target.value as PhotoType)}
                className="w-full h-9 px-2.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-900"
              >
                {PHOTO_TYPE_OPTIONS.map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {PHOTO_TYPE_LABELS[tipo]}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label
                htmlFor="photo-date"
                className="block text-xs font-medium text-slate-600 mb-1"
              >
                Data
              </label>
              <input
                id="photo-date"
                type="date"
                value={uploadData}
                onChange={(e) => setUploadData(e.target.value)}
                className="w-full h-9 px-2.5 text-xs font-mono tabular-nums bg-white border border-slate-200 rounded-lg text-slate-900"
              />
            </div>

            <div className="md:col-span-5">
              <label
                htmlFor="photo-caption"
                className="block text-xs font-medium text-slate-600 mb-1"
              >
                Legenda da fotografia
              </label>
              <input
                id="photo-caption"
                type="text"
                maxLength={SCHEMA_LIMITS.photo.legendaMax}
                value={uploadLegenda}
                onChange={(e) => setUploadLegenda(e.target.value)}
                placeholder="Ex.: Terraplanagem concluída, concretagem da laje..."
                className="w-full h-9 px-3 text-xs bg-white border border-slate-200 rounded-lg text-slate-900"
              />
            </div>

            <div className="md:col-span-3 flex gap-2">
              <button
                type="button"
                disabled={uploadingPhoto}
                onClick={() => photoFileRef.current?.click()}
                className="flex-1 h-9 inline-flex items-center justify-center gap-1.5 px-3 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors disabled:opacity-60 cursor-pointer whitespace-nowrap"
              >
                <ImagePlus className="w-3.5 h-3.5" />
                {uploadingPhoto ? `Enviando ${uploadProgress}%` : 'Upload Storage'}
              </button>
              <input
                ref={photoFileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handlePhotoFileSelected}
                className="hidden"
              />
            </div>
          </div>

          <form
            onSubmit={handleAddPhotoByUrl}
            className="flex flex-wrap sm:flex-nowrap items-center gap-2 pt-1"
          >
            <input
              type="url"
              maxLength={SCHEMA_LIMITS.photo.urlMax}
              value={uploadExternalUrl}
              onChange={(e) => setUploadExternalUrl(e.target.value)}
              placeholder="Ou cole uma URL direta de imagem já hospedada (https://...) e salve na galeria"
              className="flex-1 h-8 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400"
            />
            <button
              type="submit"
              disabled={uploadingPhoto || !uploadExternalUrl.trim()}
              className="h-8 px-3 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg disabled:opacity-50 cursor-pointer whitespace-nowrap"
            >
              Adicionar por URL
            </button>
          </form>
        </div>

        {/* Photo Grid */}
        {filteredPhotos.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-500">
            Nenhuma fotografia cadastrada para esta etapa ainda.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPhotos.map((photo) => (
              <figure
                key={photo.id}
                className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50/40 flex flex-col"
              >
                <div className="aspect-[4/3] w-full overflow-hidden bg-slate-100">
                  <SafeImage
                    src={photo.url}
                    alt={photo.legenda}
                    fallbackLabel={PHOTO_TYPE_LABELS[photo.tipo]}
                    className="w-full h-full object-cover"
                  />
                </div>
                <figcaption className="p-3 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                      {PHOTO_TYPE_LABELS[photo.tipo]} · {formatDateBR(photo.dataFoto)}
                    </div>
                    <p className="text-xs font-medium text-slate-800 mt-0.5 line-clamp-2">
                      {photo.legenda}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void deleteConstructionPhoto(construction.id, photo.id)}
                    className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors cursor-pointer shrink-0"
                    title="Remover foto"
                    aria-label="Remover fotografia"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </section>

      {/* Construction Specific Expense Ledger */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Despesas Vinculadas a Esta Obra
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
              {siteExpenses.length} lançamento(s) · Total {formatBRL(totalSpent)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNewExpense(construction.id)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            Adicionar custo
          </button>
        </div>

        {siteExpenses.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-500">
            Nenhum custo lançado para esta construção até o momento.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-500">
                  <th className="py-2.5 pl-5 pr-3">Data</th>
                  <th className="py-2.5 px-3">Categoria</th>
                  <th className="py-2.5 px-3">Descrição</th>
                  <th className="py-2.5 px-3">Local / Empresa</th>
                  <th className="py-2.5 px-3">Pagamento</th>
                  <th className="py-2.5 px-3">Nota Fiscal</th>
                  <th className="py-2.5 pl-3 pr-5 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {siteExpenses.map((exp) => (
                  <tr
                    key={exp.id}
                    onClick={() => onEditExpense(exp)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="py-2.5 pl-5 pr-3 font-mono tabular-nums text-xs text-slate-600 whitespace-nowrap">
                      {formatDateBR(exp.data)}
                    </td>
                    <td className="py-2.5 px-3 text-xs font-medium text-slate-800 whitespace-nowrap">
                      {exp.categoria}
                    </td>
                    <td className="py-2.5 px-3 text-sm text-slate-800 max-w-xs truncate">
                      {exp.descricao}
                    </td>
                    <td className="py-2.5 px-3 text-xs text-slate-600 max-w-[160px] truncate">
                      {exp.fornecedor}
                    </td>
                    <td className="py-2.5 px-3 text-xs text-slate-600 whitespace-nowrap">
                      {exp.formaPagamento}
                    </td>
                    <td
                      className="py-2.5 px-3 text-xs whitespace-nowrap"
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
                          {exp.notaFiscalNumero || 'Abrir NF'}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : exp.notaFiscalNumero ? (
                        <span className="font-mono text-slate-600">{exp.notaFiscalNumero}</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-2.5 pl-3 pr-5 text-right font-mono tabular-nums font-medium text-slate-900 whitespace-nowrap">
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
