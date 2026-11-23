import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, ImagePlus, Trash2, X } from 'lucide-react';
import {
  CONSTRUCTION_STATUS_LABELS,
  CONSTRUCTION_STATUS_OPTIONS,
  SCHEMA_LIMITS,
  type Construction,
  type ConstructionStatus,
} from '../../types/domain';
import {
  createConstruction,
  deleteConstruction,
  SAMPLE_SITE_IMAGES,
  updateConstructionDetails,
} from '../../services/firestoreService';
import { uploadConstructionPhotoFile } from '../../services/storageService';
import { toIsoDateString } from '../../utils/formatters';

interface ConstructionFormModalProps {
  isOpen: boolean;
  ownerId: string;
  editingConstruction?: Construction | null;
  onClose: () => void;
  onCreated?: (constructionId: string) => void;
  onDeleted?: () => void;
}

export function ConstructionFormModal({
  isOpen,
  ownerId,
  editingConstruction,
  onClose,
  onCreated,
  onDeleted,
}: ConstructionFormModalProps) {
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const terrainInputRef = useRef<HTMLInputElement | null>(null);

  const [nome, setNome] = useState('');
  const [endereco, setEndereco] = useState('');
  const [cliente, setCliente] = useState('');
  const [status, setStatus] = useState<ConstructionStatus>('em_andamento');
  const [orcamentoStr, setOrcamentoStr] = useState('450000');
  const [areaTerrenoStr, setAreaTerrenoStr] = useState('360');
  const [areaConstruidaStr, setAreaConstruidaStr] = useState('200');
  const [dataInicio, setDataInicio] = useState(toIsoDateString(new Date()));
  const [previsaoTermino, setPrevisaoTermino] = useState('');
  const [model3dExteriorUrl, setModel3dExteriorUrl] = useState('');
  const [model3dInteriorUrl, setModel3dInteriorUrl] = useState('');
  const [observacoes, setObservacoes] = useState('');

  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [terrainFile, setTerrainFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isLockedTerminal = editingConstruction?.status === 'concluida';

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setCoverFile(null);
    setTerrainFile(null);

    if (editingConstruction) {
      setNome(editingConstruction.nome);
      setEndereco(editingConstruction.endereco);
      setCliente(editingConstruction.cliente);
      setStatus(editingConstruction.status);
      setOrcamentoStr(String(editingConstruction.orcamentoTotal));
      setAreaTerrenoStr(String(editingConstruction.areaTerreno));
      setAreaConstruidaStr(String(editingConstruction.areaConstruida));
      setDataInicio(editingConstruction.dataInicio);
      setPrevisaoTermino(editingConstruction.previsaoTermino || '');
      setModel3dExteriorUrl(editingConstruction.model3dExteriorUrl || '');
      setModel3dInteriorUrl(editingConstruction.model3dInteriorUrl || '');
      setObservacoes(editingConstruction.observacoes || '');
    } else {
      setNome('');
      setEndereco('');
      setCliente('');
      setStatus('em_andamento');
      setOrcamentoStr('450000');
      setAreaTerrenoStr('360');
      setAreaConstruidaStr('200');
      setDataInicio(toIsoDateString(new Date()));
      setPrevisaoTermino('');
      setModel3dExteriorUrl('');
      setModel3dInteriorUrl('');
      setObservacoes('');
    }
  }, [isOpen, editingConstruction]);

  if (!isOpen) return null;

  const parseNum = (val: string): number => {
    const cleaned = val.trim().replace(/\./g, '').replace(',', '.').replace(/[^0-9.]/g, '');
    return Number(cleaned);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const orcamentoTotal = parseNum(orcamentoStr);
    const areaTerreno = parseNum(areaTerrenoStr) || 0;
    const areaConstruida = parseNum(areaConstruidaStr) || 0;

    if (nome.trim().length < SCHEMA_LIMITS.construction.nomeMin) {
      setError('Informe o nome da construção (mínimo 2 caracteres).');
      return;
    }
    if (endereco.trim().length < SCHEMA_LIMITS.construction.enderecoMin) {
      setError('Informe o endereço do terreno/obra.');
      return;
    }
    if (cliente.trim().length < SCHEMA_LIMITS.construction.clienteMin) {
      setError('Informe o nome do cliente/proprietário.');
      return;
    }
    if (!Number.isFinite(orcamentoTotal) || orcamentoTotal <= 0) {
      setError('Informe um orçamento total previsto maior que zero.');
      return;
    }
    if (!SCHEMA_LIMITS.datePattern.test(dataInicio)) {
      setError('Informe uma data de início válida.');
      return;
    }

    setSaving(true);
    try {
      if (editingConstruction) {
        await updateConstructionDetails(editingConstruction.id, {
          nome,
          endereco,
          cliente,
          status,
          orcamentoTotal,
          areaTerreno,
          areaConstruida,
          dataInicio,
          previsaoTermino,
          observacoes,
        });
        onClose();
      } else {
        let coverPhotoUrl: string = SAMPLE_SITE_IMAGES.fachada;
        let terrainPhotoUrl: string = SAMPLE_SITE_IMAGES.terreno;

        const tempScope = `new_${Date.now()}`;
        if (coverFile) {
          const uploaded = await uploadConstructionPhotoFile(
            coverFile,
            ownerId,
            tempScope,
            'fachada',
          );
          coverPhotoUrl = uploaded.url;
        }
        if (terrainFile) {
          const uploaded = await uploadConstructionPhotoFile(
            terrainFile,
            ownerId,
            tempScope,
            'terreno',
          );
          terrainPhotoUrl = uploaded.url;
        }

        const createdId = await createConstruction(ownerId, {
          nome,
          endereco,
          cliente,
          status,
          orcamentoTotal,
          areaTerreno,
          areaConstruida,
          dataInicio,
          previsaoTermino,
          coverPhotoUrl,
          terrainPhotoUrl,
          model3dExteriorUrl,
          model3dInteriorUrl,
          observacoes,
        });
        onCreated?.(createdId);
        onClose();
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Erro ao salvar os dados da construção.',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingConstruction) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteConstruction(editingConstruction.id);
      onDeleted?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir construção.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="construction-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl overflow-hidden my-auto">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2
              id="construction-modal-title"
              className="text-base font-semibold text-slate-900"
            >
              {editingConstruction ? 'Editar Dados da Construção' : 'Nova Construção'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Cadastro técnico, orçamento base, fotos iniciais e links de fotogrametria 3D
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Fechar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {isLockedTerminal && (
            <div className="p-3 rounded-lg bg-slate-100 border border-slate-200 text-xs text-slate-700">
              Esta obra está marcada como <strong>Concluída</strong>. Por integridade contábil nas
              regras do Firestore, alterações cadastrais estão bloqueadas.
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label
                htmlFor="obra-nome"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Nome da Obra / Construção *
              </label>
              <input
                id="obra-nome"
                type="text"
                required
                disabled={isLockedTerminal}
                maxLength={SCHEMA_LIMITS.construction.nomeMax}
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex.: Residência Wilson — Lote 14"
                className="w-full h-10 px-3 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 disabled:bg-slate-100"
              />
            </div>

            <div>
              <label
                htmlFor="obra-cliente"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Cliente / Proprietário *
              </label>
              <input
                id="obra-cliente"
                type="text"
                required
                disabled={isLockedTerminal}
                maxLength={SCHEMA_LIMITS.construction.clienteMax}
                value={cliente}
                onChange={(e) => setCliente(e.target.value)}
                placeholder="Ex.: Wilson Mendes"
                className="w-full h-10 px-3 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 disabled:bg-slate-100"
              />
            </div>

            <div>
              <label
                htmlFor="obra-status"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Etapa / Status *
              </label>
              <select
                id="obra-status"
                value={status}
                disabled={isLockedTerminal}
                onChange={(e) => setStatus(e.target.value as ConstructionStatus)}
                className="w-full h-10 px-3 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 disabled:bg-slate-100"
              >
                {CONSTRUCTION_STATUS_OPTIONS.map((st) => (
                  <option key={st} value={st}>
                    {CONSTRUCTION_STATUS_LABELS[st]}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label
                htmlFor="obra-endereco"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Endereço Completo do Terreno *
              </label>
              <input
                id="obra-endereco"
                type="text"
                required
                disabled={isLockedTerminal}
                maxLength={SCHEMA_LIMITS.construction.enderecoMax}
                value={endereco}
                onChange={(e) => setEndereco(e.target.value)}
                placeholder="Rua, número, lote/quadra, bairro e cidade"
                className="w-full h-10 px-3 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 disabled:bg-slate-100"
              />
            </div>

            <div>
              <label
                htmlFor="obra-orcamento"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Orçamento Total Previsto (R$) *
              </label>
              <input
                id="obra-orcamento"
                type="text"
                inputMode="decimal"
                required
                disabled={isLockedTerminal}
                value={orcamentoStr}
                onChange={(e) => setOrcamentoStr(e.target.value)}
                className="w-full h-10 px-3 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-lg text-slate-900 disabled:bg-slate-100"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label
                  htmlFor="obra-area-terreno"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Terreno (m²)
                </label>
                <input
                  id="obra-area-terreno"
                  type="number"
                  min={0}
                  step="0.5"
                  disabled={isLockedTerminal}
                  value={areaTerrenoStr}
                  onChange={(e) => setAreaTerrenoStr(e.target.value)}
                  className="w-full h-10 px-3 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-lg text-slate-900 disabled:bg-slate-100"
                />
              </div>
              <div>
                <label
                  htmlFor="obra-area-const"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Construída (m²)
                </label>
                <input
                  id="obra-area-const"
                  type="number"
                  min={0}
                  step="0.5"
                  disabled={isLockedTerminal}
                  value={areaConstruidaStr}
                  onChange={(e) => setAreaConstruidaStr(e.target.value)}
                  className="w-full h-10 px-3 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-lg text-slate-900 disabled:bg-slate-100"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="obra-inicio"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Data de Início *
              </label>
              <input
                id="obra-inicio"
                type="date"
                required
                disabled={isLockedTerminal}
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="w-full h-10 px-3 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-lg text-slate-900 disabled:bg-slate-100"
              />
            </div>

            <div>
              <label
                htmlFor="obra-previsao"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Previsão de Entrega
              </label>
              <input
                id="obra-previsao"
                type="date"
                disabled={isLockedTerminal}
                value={previsaoTermino}
                onChange={(e) => setPrevisaoTermino(e.target.value)}
                className="w-full h-10 px-3 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-lg text-slate-900 disabled:bg-slate-100"
              />
            </div>
          </div>

          {/* Initial Photos & 3D URLs on Create */}
          {!editingConstruction && (
            <div className="border-t border-slate-200 pt-4 space-y-3">
              <div className="text-xs font-semibold text-slate-900">
                Fotos Iniciais (Firebase Storage) & Fotogrametria 3D (Opcional)
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => terrainInputRef.current?.click()}
                  className="p-3 border border-dashed border-slate-300 hover:border-blue-500 rounded-lg text-left flex items-center gap-2.5 bg-slate-50/70 cursor-pointer"
                >
                  {terrainFile ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <ImagePlus className="w-4 h-4 text-slate-500 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-slate-800 truncate">
                      {terrainFile ? terrainFile.name : 'Foto do Terreno'}
                    </div>
                    <div className="text-[11px] text-slate-500">JPG, PNG ou WebP</div>
                  </div>
                </button>
                <input
                  ref={terrainInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => setTerrainFile(e.target.files?.[0] || null)}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => coverInputRef.current?.click()}
                  className="p-3 border border-dashed border-slate-300 hover:border-blue-500 rounded-lg text-left flex items-center gap-2.5 bg-slate-50/70 cursor-pointer"
                >
                  {coverFile ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <ImagePlus className="w-4 h-4 text-slate-500 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-slate-800 truncate">
                      {coverFile ? coverFile.name : 'Foto Principal da Casa'}
                    </div>
                    <div className="text-[11px] text-slate-500">JPG, PNG ou WebP</div>
                  </div>
                </button>
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="obra-3d-ext"
                    className="block text-xs font-medium text-slate-600 mb-1"
                  >
                    URL Modelo 3D Exterior (.glb — Luma AI)
                  </label>
                  <input
                    id="obra-3d-ext"
                    type="url"
                    maxLength={SCHEMA_LIMITS.construction.urlMax}
                    value={model3dExteriorUrl}
                    onChange={(e) => setModel3dExteriorUrl(e.target.value)}
                    placeholder="https://cdn-luma.com/.../exterior.glb"
                    className="w-full h-9 px-3 text-xs bg-white border border-slate-200 rounded-lg text-slate-900"
                  />
                </div>
                <div>
                  <label
                    htmlFor="obra-3d-int"
                    className="block text-xs font-medium text-slate-600 mb-1"
                  >
                    URL Modelo 3D Interior (.glb — Luma AI)
                  </label>
                  <input
                    id="obra-3d-int"
                    type="url"
                    maxLength={SCHEMA_LIMITS.construction.urlMax}
                    value={model3dInteriorUrl}
                    onChange={(e) => setModel3dInteriorUrl(e.target.value)}
                    placeholder="https://cdn-luma.com/.../interior.glb"
                    className="w-full h-9 px-3 text-xs bg-white border border-slate-200 rounded-lg text-slate-900"
                  />
                </div>
              </div>
            </div>
          )}

          <div>
            <label
              htmlFor="obra-obs"
              className="block text-xs font-medium text-slate-700 mb-1"
            >
              Observações Técnicas
            </label>
            <textarea
              id="obra-obs"
              rows={2}
              disabled={isLockedTerminal}
              maxLength={SCHEMA_LIMITS.construction.observacoesMax}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Informações estruturais, empreiteiro responsável, cronograma..."
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 disabled:bg-slate-100"
            />
          </div>

          <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div>
              {editingConstruction && (
                <button
                  type="button"
                  onClick={() => void handleDelete()}
                  disabled={deleting || saving}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {deleting ? 'Excluindo...' : 'Excluir obra'}
                </button>
              )}
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                Cancelar
              </button>
              {!isLockedTerminal && (
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors disabled:opacity-60 cursor-pointer whitespace-nowrap"
                >
                  {saving
                    ? 'Salvando...'
                    : editingConstruction
                      ? 'Salvar alterações'
                      : 'Criar construção'}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
