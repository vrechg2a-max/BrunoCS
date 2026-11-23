import type { Timestamp } from 'firebase/firestore';

export type ConstructionStatus =
  | 'planejamento'
  | 'em_andamento'
  | 'acabamento'
  | 'pausada'
  | 'concluida';

export const CONSTRUCTION_STATUS_LABELS: Record<ConstructionStatus, string> = {
  planejamento: 'Planejamento',
  em_andamento: 'Em Andamento',
  acabamento: 'Acabamento',
  pausada: 'Pausada',
  concluida: 'Concluída',
};

export const CONSTRUCTION_STATUS_OPTIONS: ConstructionStatus[] = [
  'planejamento',
  'em_andamento',
  'acabamento',
  'pausada',
  'concluida',
];

export type PhotoType = 'terreno' | 'estrutura' | 'fachada' | 'interior' | 'acabamento';

export const PHOTO_TYPE_LABELS: Record<PhotoType, string> = {
  terreno: 'Terreno',
  estrutura: 'Estrutura',
  fachada: 'Fachada',
  interior: 'Interior',
  acabamento: 'Acabamento',
};

export const PHOTO_TYPE_OPTIONS: PhotoType[] = [
  'terreno',
  'estrutura',
  'fachada',
  'interior',
  'acabamento',
];

export type ExpenseCategory =
  | 'Despesas Iniciais'
  | 'Material'
  | 'Mão de Obra - Pedreiro'
  | 'Mão de Obra - Encanador'
  | 'Mão de Obra - Eletricista'
  | 'Mão de Obra - Ar Condicionado'
  | 'Mão de Obra - Pisos';

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Despesas Iniciais',
  'Material',
  'Mão de Obra - Pedreiro',
  'Mão de Obra - Encanador',
  'Mão de Obra - Eletricista',
  'Mão de Obra - Ar Condicionado',
  'Mão de Obra - Pisos',
];

export const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  'Despesas Iniciais': '#475569',
  Material: '#1D4ED8',
  'Mão de Obra - Pedreiro': '#0F766E',
  'Mão de Obra - Encanador': '#0284C7',
  'Mão de Obra - Eletricista': '#D97706',
  'Mão de Obra - Ar Condicionado': '#4F46E5',
  'Mão de Obra - Pisos': '#7C3AED',
};

export type PaymentMethod =
  | 'PIX'
  | 'Cartão de Crédito'
  | 'Cartão de Débito'
  | 'Boleto'
  | 'Transferência/TED'
  | 'Dinheiro'
  | 'Cheque';

export const PAYMENT_METHODS: PaymentMethod[] = [
  'PIX',
  'Cartão de Crédito',
  'Cartão de Débito',
  'Boleto',
  'Transferência/TED',
  'Dinheiro',
  'Cheque',
];

/**
 * Verbatim validation constants synchronized with firebase-blueprint.json and firestore.rules.
 */
export const SCHEMA_LIMITS = {
  idPattern: /^[a-zA-Z0-9_-]+$/,
  datePattern: /^\d{4}-\d{2}-\d{2}$/,
  construction: {
    nomeMin: 2,
    nomeMax: 120,
    enderecoMin: 3,
    enderecoMax: 200,
    clienteMin: 2,
    clienteMax: 100,
    orcamentoMax: 1_000_000_000,
    areaMax: 1_000_000,
    urlMax: 2048,
    observacoesMax: 1000,
  },
  photo: {
    urlMax: 2048,
    legendaMax: 200,
    storagePathMax: 512,
  },
  expense: {
    descricaoMin: 2,
    descricaoMax: 240,
    fornecedorMin: 2,
    fornecedorMax: 160,
    valorMax: 100_000_000,
    urlMax: 2048,
    notaFiscalNomeMax: 200,
    notaFiscalNumeroMax: 60,
    storagePathMax: 512,
    observacoesMax: 500,
  },
} as const;

export interface Construction {
  id: string;
  nome: string;
  endereco: string;
  cliente: string;
  status: ConstructionStatus;
  orcamentoTotal: number;
  areaTerreno: number;
  areaConstruida: number;
  dataInicio: string;
  previsaoTermino?: string;
  coverPhotoUrl?: string;
  terrainPhotoUrl?: string;
  model3dExteriorUrl?: string;
  model3dInteriorUrl?: string;
  observacoes?: string;
  ownerId: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface ConstructionCreateInput {
  nome: string;
  endereco: string;
  cliente: string;
  status: ConstructionStatus;
  orcamentoTotal: number;
  areaTerreno: number;
  areaConstruida: number;
  dataInicio: string;
  previsaoTermino?: string;
  coverPhotoUrl?: string;
  terrainPhotoUrl?: string;
  model3dExteriorUrl?: string;
  model3dInteriorUrl?: string;
  observacoes?: string;
}

export interface ConstructionPhoto {
  id: string;
  constructionId: string;
  tipo: PhotoType;
  url: string;
  legenda: string;
  dataFoto: string;
  storagePath?: string;
  ownerId: string;
  createdAt?: Timestamp | null;
}

export interface Expense {
  id: string;
  constructionId: string;
  categoria: ExpenseCategory;
  descricao: string;
  valor: number;
  data: string;
  fornecedor: string;
  formaPagamento: PaymentMethod;
  notaFiscalUrl?: string;
  notaFiscalNome?: string;
  notaFiscalNumero?: string;
  notaFiscalStoragePath?: string;
  observacoes?: string;
  ownerId: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface ExpenseCreateInput {
  constructionId: string;
  categoria: ExpenseCategory;
  descricao: string;
  valor: number;
  data: string;
  fornecedor: string;
  formaPagamento: PaymentMethod;
  notaFiscalUrl?: string;
  notaFiscalNome?: string;
  notaFiscalNumero?: string;
  notaFiscalStoragePath?: string;
  observacoes?: string;
}

export type DatePreset = 'all' | '7d' | '30d' | 'month' | '90d' | 'custom';

export interface CrossFilterState {
  constructionId: string; // 'all' or specific construction ID
  datePreset: DatePreset;
  startDate: string; // YYYY-MM-DD or ''
  endDate: string; // YYYY-MM-DD or ''
  category: ExpenseCategory | 'all';
  searchQuery: string;
}

export interface ConstructionCostSummary {
  constructionId: string;
  nome: string;
  cliente: string;
  status: ConstructionStatus;
  orcamentoTotal: number;
  gastoFiltrado: number;
  gastoAcumulado: number;
  saldoRestante: number;
  percentualExecutado: number;
  qtdLancamentos: number;
  areaConstruida: number;
  custoPorMetroQuadrado: number;
}

export interface CategoryCostSummary {
  categoria: ExpenseCategory;
  total: number;
  count: number;
  sharePct: number;
  color: string;
}

export interface TimelinePoint {
  date: string;
  label: string;
  total: number;
  count: number;
}

export interface FinancialAnalytics {
  filteredExpenses: Expense[];
  totalFiltered: number;
  totalOverall: number;
  totalBudget: number;
  budgetRemaining: number;
  budgetUtilizationPct: number;
  last7DaysTotal: number;
  prev7DaysTotal: number;
  weeklyDeltaPct: number | null;
  last30DaysTotal: number;
  prev30DaysTotal: number;
  monthlyDeltaPct: number | null;
  byConstruction: ConstructionCostSummary[];
  byCategory: CategoryCostSummary[];
  timeline: TimelinePoint[];
}
