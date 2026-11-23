import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  FileText,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  EXPENSE_CATEGORIES,
  PAYMENT_METHODS,
  SCHEMA_LIMITS,
  type Construction,
  type Expense,
  type ExpenseCategory,
  type PaymentMethod,
} from '../../types/domain';
import {
  createExpense,
  deleteExpense,
  updateExpenseDetails,
  updateExpenseInvoice,
} from '../../services/firestoreService';
import { uploadInvoiceFile } from '../../services/storageService';
import { toIsoDateString } from '../../utils/formatters';

interface ExpenseFormModalProps {
  isOpen: boolean;
  ownerId: string;
  constructions: Construction[];
  initialConstructionId?: string;
  editingExpense?: Expense | null;
  onClose: () => void;
}

export function ExpenseFormModal({
  isOpen,
  ownerId,
  constructions,
  initialConstructionId,
  editingExpense,
  onClose,
}: ExpenseFormModalProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [constructionId, setConstructionId] = useState<string>('');
  const [categoria, setCategoria] = useState<ExpenseCategory>('Material');
  const [descricao, setDescricao] = useState<string>('');
  const [valorStr, setValorStr] = useState<string>('');
  const [data, setData] = useState<string>(toIsoDateString(new Date()));
  const [fornecedor, setFornecedor] = useState<string>('');
  const [formaPagamento, setFormaPagamento] = useState<PaymentMethod>('PIX');
  const [notaFiscalNumero, setNotaFiscalNumero] = useState<string>('');
  const [notaFiscalUrl, setNotaFiscalUrl] = useState<string>('');
  const [notaFiscalNome, setNotaFiscalNome] = useState<string>('');
  const [notaFiscalStoragePath, setNotaFiscalStoragePath] = useState<string>('');
  const [observacoes, setObservacoes] = useState<string>('');

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploading, setUploading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [deleting, setDeleting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setStorageWarning(null);
    setPendingFile(null);
    setUploadProgress(0);

    if (editingExpense) {
      setConstructionId(editingExpense.constructionId);
      setCategoria(editingExpense.categoria);
      setDescricao(editingExpense.descricao);
      setValorStr(editingExpense.valor.toFixed(2).replace('.', ','));
      setData(editingExpense.data);
      setFornecedor(editingExpense.fornecedor);
      setFormaPagamento(editingExpense.formaPagamento);
      setNotaFiscalNumero(editingExpense.notaFiscalNumero || '');
      setNotaFiscalUrl(editingExpense.notaFiscalUrl || '');
      setNotaFiscalNome(editingExpense.notaFiscalNome || '');
      setNotaFiscalStoragePath(editingExpense.notaFiscalStoragePath || '');
      setObservacoes(editingExpense.observacoes || '');
    } else {
      setConstructionId(initialConstructionId || constructions[0]?.id || '');
      setCategoria('Material');
      setDescricao('');
      setValorStr('');
      setData(toIsoDateString(new Date()));
      setFornecedor('');
      setFormaPagamento('PIX');
      setNotaFiscalNumero('');
      setNotaFiscalUrl('');
      setNotaFiscalNome('');
      setNotaFiscalStoragePath('');
      setObservacoes('');
    }
  }, [isOpen, editingExpense, initialConstructionId, constructions]);

  if (!isOpen) return null;

  const parseCurrencyInput = (raw: string): number => {
    const cleaned = raw.trim().replace(/\./g, '').replace(',', '.').replace(/[^0-9.]/g, '');
    return Number(cleaned);
  };

  const handleSelectFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setStorageWarning(null);
    setError(null);
    setPendingFile(file);
    setNotaFiscalNome(file.name.slice(0, SCHEMA_LIMITS.expense.notaFiscalNomeMax));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setStorageWarning(null);

    if (!constructionId) {
      setError('Selecione uma obra antes de registrar o custo.');
      return;
    }

    const numericValue = parseCurrencyInput(valorStr);
    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      setError('Informe um valor válido maior que R$ 0,00.');
      return;
    }

    if (descricao.trim().length < SCHEMA_LIMITS.expense.descricaoMin) {
      setError('Informe uma descrição com pelo menos 2 caracteres.');
      return;
    }

    if (fornecedor.trim().length < SCHEMA_LIMITS.expense.fornecedorMin) {
      setError('Informe o Local da Compra ou Empresa prestadora.');
      return;
    }

    if (!SCHEMA_LIMITS.datePattern.test(data)) {
      setError('Informe uma data válida no formato AAAA-MM-DD.');
      return;
    }

    setSaving(true);

    try {
      let resolvedUrl = notaFiscalUrl.trim();
      let resolvedName = notaFiscalNome.trim();
      let resolvedStoragePath = notaFiscalStoragePath.trim();

      // Upload attached Nota Fiscal file to Firebase Storage
      if (pendingFile) {
        setUploading(true);
        try {
          const uploaded = await uploadInvoiceFile(
            pendingFile,
            ownerId,
            constructionId,
            (pct) => setUploadProgress(pct),
          );
          resolvedUrl = uploaded.url;
          resolvedName = uploaded.fileName;
          resolvedStoragePath = uploaded.storagePath;
        } catch (uploadErr) {
          // Surface clear Firebase Storage notice but allow user to save or supply external link
          const msg =
            uploadErr instanceof Error
              ? uploadErr.message
              : 'Não foi possível enviar o arquivo ao Firebase Storage.';
          setStorageWarning(msg);
          setUploading(false);
          setSaving(false);
          return;
        }
        setUploading(false);
      }

      if (editingExpense) {
        // Respect strict Action-Based Firestore rules (Details action vs Invoice action)
        await updateExpenseDetails(editingExpense.id, {
          categoria,
          descricao,
          valor: numericValue,
          data,
          fornecedor,
          formaPagamento,
          observacoes,
        });

        const invoiceChanged =
          resolvedUrl !== (editingExpense.notaFiscalUrl || '') ||
          resolvedName !== (editingExpense.notaFiscalNome || '') ||
          notaFiscalNumero.trim() !== (editingExpense.notaFiscalNumero || '') ||
          resolvedStoragePath !== (editingExpense.notaFiscalStoragePath || '');

        if (invoiceChanged) {
          await updateExpenseInvoice(editingExpense.id, {
            notaFiscalUrl: resolvedUrl,
            notaFiscalNome: resolvedName,
            notaFiscalNumero: notaFiscalNumero.trim(),
            notaFiscalStoragePath: resolvedStoragePath,
          });
        }
      } else {
        await createExpense(ownerId, {
          constructionId,
          categoria,
          descricao,
          valor: numericValue,
          data,
          fornecedor,
          formaPagamento,
          notaFiscalUrl: resolvedUrl,
          notaFiscalNome: resolvedName,
          notaFiscalNumero: notaFiscalNumero.trim(),
          notaFiscalStoragePath: resolvedStoragePath,
          observacoes,
        });
      }

      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível salvar o lançamento no Firestore.',
      );
    } finally {
      setSaving(false);
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!editingExpense) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteExpense(editingExpense.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir lançamento.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="expense-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl overflow-hidden my-auto">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 id="expense-modal-title" className="text-base font-semibold text-slate-900">
              {editingExpense ? 'Editar Lançamento de Despesa' : 'Novo Lançamento de Custo / Despesa'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Registro contábil persistido no Firestore com anexo de Nota Fiscal via Storage
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Fechar formulário"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[82vh] overflow-y-auto">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {storageWarning && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{storageWarning}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPendingFile(null);
                  setStorageWarning(null);
                }}
                className="text-xs font-semibold underline cursor-pointer"
              >
                Remover arquivo pendente e salvar apenas os dados / link externo
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Construction */}
            <div>
              <label
                htmlFor="exp-construction"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Obra / Construção *
              </label>
              <select
                id="exp-construction"
                value={constructionId}
                disabled={Boolean(editingExpense)}
                onChange={(e) => setConstructionId(e.target.value)}
                required
                className="w-full h-10 px-3 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 disabled:bg-slate-100 disabled:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              >
                {constructions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>

            {/* Category */}
            <div>
              <label
                htmlFor="exp-category"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Categoria *
              </label>
              <select
                id="exp-category"
                value={categoria}
                onChange={(e) => setCategoria(e.target.value as ExpenseCategory)}
                required
                className="w-full h-10 px-3 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              >
                {EXPENSE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Value (R$) */}
            <div>
              <label
                htmlFor="exp-value"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Valor (R$) *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-500">
                  R$
                </span>
                <input
                  id="exp-value"
                  type="text"
                  inputMode="decimal"
                  required
                  value={valorStr}
                  onChange={(e) => setValorStr(e.target.value)}
                  placeholder="0,00"
                  className="w-full h-10 pl-9 pr-3 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                />
              </div>
            </div>

            {/* Date */}
            <div>
              <label
                htmlFor="exp-date"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Data do Pagamento / Emissão *
              </label>
              <input
                id="exp-date"
                type="date"
                required
                value={data}
                onChange={(e) => setData(e.target.value)}
                className="w-full h-10 px-3 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label
              htmlFor="exp-desc"
              className="block text-xs font-medium text-slate-700 mb-1"
            >
              Descrição do Item ou Serviço *
            </label>
            <input
              id="exp-desc"
              type="text"
              required
              maxLength={SCHEMA_LIMITS.expense.descricaoMax}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex.: Cimento CP-II 50kg (60 sacos) ou Medição Quinzenal Pedreiro"
              className="w-full h-10 px-3 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Supplier / Local da Compra */}
            <div>
              <label
                htmlFor="exp-supplier"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Local da Compra / Empresa *
              </label>
              <input
                id="exp-supplier"
                type="text"
                required
                maxLength={SCHEMA_LIMITS.expense.fornecedorMax}
                value={fornecedor}
                onChange={(e) => setFornecedor(e.target.value)}
                placeholder="Ex.: Leroy Merlin, Depósito Central, Mestre João"
                className="w-full h-10 px-3 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
            </div>

            {/* Payment Method */}
            <div>
              <label
                htmlFor="exp-payment"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Forma de Pagamento *
              </label>
              <select
                id="exp-payment"
                value={formaPagamento}
                onChange={(e) => setFormaPagamento(e.target.value as PaymentMethod)}
                required
                className="w-full h-10 px-3 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              >
                {PAYMENT_METHODS.map((pm) => (
                  <option key={pm} value={pm}>
                    {pm}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Nota Fiscal Attachment Section */}
          <div className="border-t border-slate-200 pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-900">
                Nota Fiscal / Comprovante (Firebase Storage)
              </span>
              {notaFiscalUrl && !pendingFile && (
                <a
                  href={notaFiscalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline"
                >
                  Visualizar anexo atual
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="exp-nf-num"
                  className="block text-xs font-medium text-slate-600 mb-1"
                >
                  Nº da Nota Fiscal / Recibo
                </label>
                <input
                  id="exp-nf-num"
                  type="text"
                  maxLength={SCHEMA_LIMITS.expense.notaFiscalNumeroMax}
                  value={notaFiscalNumero}
                  onChange={(e) => setNotaFiscalNumero(e.target.value)}
                  placeholder="Ex.: NF-e 88321 ou Recibo #14"
                  className="w-full h-9 px-3 text-sm font-mono bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                />
              </div>

              <div>
                <label
                  htmlFor="exp-nf-url"
                  className="block text-xs font-medium text-slate-600 mb-1"
                >
                  Link direto da NF (opcional)
                </label>
                <input
                  id="exp-nf-url"
                  type="url"
                  maxLength={SCHEMA_LIMITS.expense.urlMax}
                  value={notaFiscalUrl}
                  onChange={(e) => setNotaFiscalUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full h-9 px-3 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                />
              </div>
            </div>

            <div
              onClick={() => fileInputRef.current?.click()}
              className="border border-dashed border-slate-300 hover:border-blue-500 rounded-lg p-4 bg-slate-50/70 hover:bg-blue-50/30 transition-colors cursor-pointer flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 bg-white border border-slate-200 rounded-lg text-slate-600 shrink-0">
                  {pendingFile ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <FileText className="w-4 h-4" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-medium text-slate-800 truncate">
                    {pendingFile
                      ? `${pendingFile.name} (${(pendingFile.size / 1024).toFixed(0)} KB)`
                      : notaFiscalNome || 'Clique para anexar arquivo da Nota Fiscal'}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    PDF, JPG, PNG, WebP ou XML até 10 MB
                  </div>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg whitespace-nowrap shrink-0">
                <Upload className="w-3.5 h-3.5" />
                Selecionar arquivo
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp,.xml"
                onChange={handleSelectFile}
                className="hidden"
              />
            </div>

            {uploading && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-slate-600 font-mono tabular-nums">
                  <span>Enviando Nota Fiscal para o Storage...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 transition-all duration-150"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Observations */}
          <div>
            <label
              htmlFor="exp-obs"
              className="block text-xs font-medium text-slate-700 mb-1"
            >
              Observações (opcional)
            </label>
            <textarea
              id="exp-obs"
              rows={2}
              maxLength={SCHEMA_LIMITS.expense.observacoesMax}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Detalhes de medição, parcelas ou garantia..."
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div>
              {editingExpense && (
                <button
                  type="button"
                  onClick={() => void handleDelete()}
                  disabled={deleting || saving}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {deleting ? 'Excluindo...' : 'Excluir lançamento'}
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
              <button
                type="submit"
                disabled={saving || uploading}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors disabled:opacity-60 cursor-pointer whitespace-nowrap"
              >
                {uploading
                  ? `Enviando NF (${uploadProgress}%)...`
                  : saving
                    ? 'Salvando...'
                    : editingExpense
                      ? 'Salvar alterações'
                      : 'Registrar despesa'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
