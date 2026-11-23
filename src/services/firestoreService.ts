import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  SCHEMA_LIMITS,
  type Construction,
  type ConstructionCreateInput,
  type ConstructionPhoto,
  type ConstructionStatus,
  type Expense,
  type ExpenseCategory,
  type ExpenseCreateInput,
  type PaymentMethod,
  type PhotoType,
} from '../types/domain';
import { daysAgoIso } from '../utils/formatters';

const CONSTRUCTIONS_COL = 'constructions';
const EXPENSES_COL = 'expenses';

// Generated architectural site photography assets
export const SAMPLE_SITE_IMAGES = {
  terreno: '/src/assets/images/obra_wilson_terreno_1795457000529.jpg',
  fachada: '/src/assets/images/obra_wilson_fachada_1795457000138.jpg',
  interior: '/src/assets/images/obra_wilson_interior_1795456999063.jpg',
  estrutura: '/src/assets/images/obra_palmeiras_estrutura_1795456999814.jpg',
} as const;

function trimClamp(value: string | undefined, max: number): string {
  return (value ?? '').trim().slice(0, max);
}

function clampNumber(value: number, min: number, max: number): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return min;
  return Math.min(max, Math.max(min, num));
}

function sanitizeOptionalDate(value: string | undefined): string {
  const trimmed = (value ?? '').trim().slice(0, 10);
  if (!trimmed) return '';
  return SCHEMA_LIMITS.datePattern.test(trimmed) ? trimmed : '';
}

// =============================================================================
// Real-time Subscriptions (Strictly Owner-Scoped Queries)
// =============================================================================

export function subscribeConstructions(
  ownerId: string,
  onData: (items: Construction[]) => void,
  onError?: (err: unknown) => void,
): Unsubscribe {
  const q = query(collection(db, CONSTRUCTIONS_COL), where('ownerId', '==', ownerId));
  return onSnapshot(
    q,
    (snapshot) => {
      const list: Construction[] = snapshot.docs
        .map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<Construction, 'id'>),
        }))
        .sort((a, b) => (a.dataInicio < b.dataInicio ? 1 : -1));
      onData(list);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, CONSTRUCTIONS_COL);
    },
  );
}

export function subscribeExpenses(
  ownerId: string,
  onData: (items: Expense[]) => void,
  onError?: (err: unknown) => void,
): Unsubscribe {
  const q = query(collection(db, EXPENSES_COL), where('ownerId', '==', ownerId));
  return onSnapshot(
    q,
    (snapshot) => {
      const list: Expense[] = snapshot.docs
        .map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<Expense, 'id'>),
        }))
        .sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0));
      onData(list);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, EXPENSES_COL);
    },
  );
}

export function subscribeConstructionPhotos(
  constructionId: string,
  ownerId: string,
  onData: (items: ConstructionPhoto[]) => void,
  onError?: (err: unknown) => void,
): Unsubscribe {
  const path = `${CONSTRUCTIONS_COL}/${constructionId}/photos`;
  const q = query(
    collection(db, CONSTRUCTIONS_COL, constructionId, 'photos'),
    where('ownerId', '==', ownerId),
    where('constructionId', '==', constructionId),
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const list: ConstructionPhoto[] = snapshot.docs
        .map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<ConstructionPhoto, 'id'>),
        }))
        .sort((a, b) => (a.dataFoto < b.dataFoto ? 1 : -1));
      onData(list);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, path);
    },
  );
}

// =============================================================================
// Constructions CRUD
// =============================================================================

export async function createConstruction(
  ownerId: string,
  input: ConstructionCreateInput,
): Promise<string> {
  const newRef = doc(collection(db, CONSTRUCTIONS_COL));
  const path = `${CONSTRUCTIONS_COL}/${newRef.id}`;

  const payload = {
    nome: trimClamp(input.nome, SCHEMA_LIMITS.construction.nomeMax),
    endereco: trimClamp(input.endereco, SCHEMA_LIMITS.construction.enderecoMax),
    cliente: trimClamp(input.cliente, SCHEMA_LIMITS.construction.clienteMax),
    status: input.status,
    orcamentoTotal: clampNumber(input.orcamentoTotal, 1, SCHEMA_LIMITS.construction.orcamentoMax),
    areaTerreno: clampNumber(input.areaTerreno, 0, SCHEMA_LIMITS.construction.areaMax),
    areaConstruida: clampNumber(input.areaConstruida, 0, SCHEMA_LIMITS.construction.areaMax),
    dataInicio: trimClamp(input.dataInicio, 10),
    previsaoTermino: sanitizeOptionalDate(input.previsaoTermino),
    coverPhotoUrl: trimClamp(input.coverPhotoUrl, SCHEMA_LIMITS.construction.urlMax),
    terrainPhotoUrl: trimClamp(input.terrainPhotoUrl, SCHEMA_LIMITS.construction.urlMax),
    model3dExteriorUrl: trimClamp(input.model3dExteriorUrl, SCHEMA_LIMITS.construction.urlMax),
    model3dInteriorUrl: trimClamp(input.model3dInteriorUrl, SCHEMA_LIMITS.construction.urlMax),
    observacoes: trimClamp(input.observacoes, SCHEMA_LIMITS.construction.observacoesMax),
    ownerId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(newRef, payload);
    return newRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateConstructionDetails(
  constructionId: string,
  input: {
    nome: string;
    endereco: string;
    cliente: string;
    status: ConstructionStatus;
    orcamentoTotal: number;
    areaTerreno: number;
    areaConstruida: number;
    dataInicio: string;
    previsaoTermino?: string;
    observacoes?: string;
  },
): Promise<void> {
  const path = `${CONSTRUCTIONS_COL}/${constructionId}`;
  const docRef = doc(db, CONSTRUCTIONS_COL, constructionId);

  const payload = {
    nome: trimClamp(input.nome, SCHEMA_LIMITS.construction.nomeMax),
    endereco: trimClamp(input.endereco, SCHEMA_LIMITS.construction.enderecoMax),
    cliente: trimClamp(input.cliente, SCHEMA_LIMITS.construction.clienteMax),
    status: input.status,
    orcamentoTotal: clampNumber(input.orcamentoTotal, 1, SCHEMA_LIMITS.construction.orcamentoMax),
    areaTerreno: clampNumber(input.areaTerreno, 0, SCHEMA_LIMITS.construction.areaMax),
    areaConstruida: clampNumber(input.areaConstruida, 0, SCHEMA_LIMITS.construction.areaMax),
    dataInicio: trimClamp(input.dataInicio, 10),
    previsaoTermino: sanitizeOptionalDate(input.previsaoTermino),
    observacoes: trimClamp(input.observacoes, SCHEMA_LIMITS.construction.observacoesMax),
    updatedAt: serverTimestamp(),
  };

  try {
    await updateDoc(docRef, payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateConstructionMedia(
  constructionId: string,
  input: {
    coverPhotoUrl?: string;
    terrainPhotoUrl?: string;
    model3dExteriorUrl?: string;
    model3dInteriorUrl?: string;
  },
): Promise<void> {
  const path = `${CONSTRUCTIONS_COL}/${constructionId}`;
  const docRef = doc(db, CONSTRUCTIONS_COL, constructionId);

  const payload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };

  if (input.coverPhotoUrl !== undefined) {
    payload.coverPhotoUrl = trimClamp(input.coverPhotoUrl, SCHEMA_LIMITS.construction.urlMax);
  }
  if (input.terrainPhotoUrl !== undefined) {
    payload.terrainPhotoUrl = trimClamp(input.terrainPhotoUrl, SCHEMA_LIMITS.construction.urlMax);
  }
  if (input.model3dExteriorUrl !== undefined) {
    payload.model3dExteriorUrl = trimClamp(
      input.model3dExteriorUrl,
      SCHEMA_LIMITS.construction.urlMax,
    );
  }
  if (input.model3dInteriorUrl !== undefined) {
    payload.model3dInteriorUrl = trimClamp(
      input.model3dInteriorUrl,
      SCHEMA_LIMITS.construction.urlMax,
    );
  }

  try {
    await updateDoc(docRef, payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteConstruction(constructionId: string): Promise<void> {
  const path = `${CONSTRUCTIONS_COL}/${constructionId}`;
  try {
    await deleteDoc(doc(db, CONSTRUCTIONS_COL, constructionId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// =============================================================================
// Construction Photos Subcollection CRUD
// =============================================================================

export async function addConstructionPhoto(
  ownerId: string,
  constructionId: string,
  input: {
    tipo: PhotoType;
    url: string;
    legenda: string;
    dataFoto: string;
    storagePath?: string;
  },
): Promise<string> {
  const colRef = collection(db, CONSTRUCTIONS_COL, constructionId, 'photos');
  const photoRef = doc(colRef);
  const path = `${CONSTRUCTIONS_COL}/${constructionId}/photos/${photoRef.id}`;

  const payload = {
    constructionId,
    tipo: input.tipo,
    url: trimClamp(input.url, SCHEMA_LIMITS.photo.urlMax),
    legenda: trimClamp(input.legenda, SCHEMA_LIMITS.photo.legendaMax),
    dataFoto: trimClamp(input.dataFoto, 10),
    storagePath: trimClamp(input.storagePath, SCHEMA_LIMITS.photo.storagePathMax),
    ownerId,
    createdAt: serverTimestamp(),
  };

  try {
    await setDoc(photoRef, payload);
    return photoRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteConstructionPhoto(
  constructionId: string,
  photoId: string,
): Promise<void> {
  const path = `${CONSTRUCTIONS_COL}/${constructionId}/photos/${photoId}`;
  try {
    await deleteDoc(doc(db, CONSTRUCTIONS_COL, constructionId, 'photos', photoId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// =============================================================================
// Expenses CRUD
// =============================================================================

export async function createExpense(
  ownerId: string,
  input: ExpenseCreateInput,
): Promise<string> {
  const newRef = doc(collection(db, EXPENSES_COL));
  const path = `${EXPENSES_COL}/${newRef.id}`;

  const payload = {
    constructionId: input.constructionId,
    categoria: input.categoria,
    descricao: trimClamp(input.descricao, SCHEMA_LIMITS.expense.descricaoMax),
    valor: clampNumber(input.valor, 0.01, SCHEMA_LIMITS.expense.valorMax),
    data: trimClamp(input.data, 10),
    fornecedor: trimClamp(input.fornecedor, SCHEMA_LIMITS.expense.fornecedorMax),
    formaPagamento: input.formaPagamento,
    notaFiscalUrl: trimClamp(input.notaFiscalUrl, SCHEMA_LIMITS.expense.urlMax),
    notaFiscalNome: trimClamp(input.notaFiscalNome, SCHEMA_LIMITS.expense.notaFiscalNomeMax),
    notaFiscalNumero: trimClamp(input.notaFiscalNumero, SCHEMA_LIMITS.expense.notaFiscalNumeroMax),
    notaFiscalStoragePath: trimClamp(
      input.notaFiscalStoragePath,
      SCHEMA_LIMITS.expense.storagePathMax,
    ),
    observacoes: trimClamp(input.observacoes, SCHEMA_LIMITS.expense.observacoesMax),
    ownerId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(newRef, payload);
    return newRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateExpenseDetails(
  expenseId: string,
  input: {
    categoria: ExpenseCategory;
    descricao: string;
    valor: number;
    data: string;
    fornecedor: string;
    formaPagamento: PaymentMethod;
    observacoes?: string;
  },
): Promise<void> {
  const path = `${EXPENSES_COL}/${expenseId}`;
  const docRef = doc(db, EXPENSES_COL, expenseId);

  const payload = {
    categoria: input.categoria,
    descricao: trimClamp(input.descricao, SCHEMA_LIMITS.expense.descricaoMax),
    valor: clampNumber(input.valor, 0.01, SCHEMA_LIMITS.expense.valorMax),
    data: trimClamp(input.data, 10),
    fornecedor: trimClamp(input.fornecedor, SCHEMA_LIMITS.expense.fornecedorMax),
    formaPagamento: input.formaPagamento,
    observacoes: trimClamp(input.observacoes, SCHEMA_LIMITS.expense.observacoesMax),
    updatedAt: serverTimestamp(),
  };

  try {
    await updateDoc(docRef, payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateExpenseInvoice(
  expenseId: string,
  input: {
    notaFiscalUrl: string;
    notaFiscalNome: string;
    notaFiscalNumero?: string;
    notaFiscalStoragePath?: string;
  },
): Promise<void> {
  const path = `${EXPENSES_COL}/${expenseId}`;
  const docRef = doc(db, EXPENSES_COL, expenseId);

  const payload = {
    notaFiscalUrl: trimClamp(input.notaFiscalUrl, SCHEMA_LIMITS.expense.urlMax),
    notaFiscalNome: trimClamp(input.notaFiscalNome, SCHEMA_LIMITS.expense.notaFiscalNomeMax),
    notaFiscalNumero: trimClamp(input.notaFiscalNumero, SCHEMA_LIMITS.expense.notaFiscalNumeroMax),
    notaFiscalStoragePath: trimClamp(
      input.notaFiscalStoragePath,
      SCHEMA_LIMITS.expense.storagePathMax,
    ),
    updatedAt: serverTimestamp(),
  };

  try {
    await updateDoc(docRef, payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteExpense(expenseId: string): Promise<void> {
  const path = `${EXPENSES_COL}/${expenseId}`;
  try {
    await deleteDoc(doc(db, EXPENSES_COL, expenseId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// =============================================================================
// Seed Realistic "Contabilidade Construção WILSON" Sample Dataset
// =============================================================================

export async function seedWilsonSampleData(ownerId: string): Promise<void> {
  const today = new Date();

  const wilsonId = await createConstruction(ownerId, {
    nome: 'Residência Wilson — Lote 14',
    endereco: 'Rua das Araucárias, 420 — Cond. Bela Vista',
    cliente: 'Wilson Mendes',
    status: 'acabamento',
    orcamentoTotal: 480000,
    areaTerreno: 360,
    areaConstruida: 215,
    dataInicio: daysAgoIso(115, today),
    previsaoTermino: daysAgoIso(-45, today),
    coverPhotoUrl: SAMPLE_SITE_IMAGES.fachada,
    terrainPhotoUrl: SAMPLE_SITE_IMAGES.terreno,
    model3dExteriorUrl: '',
    model3dInteriorUrl: '',
    observacoes:
      'Projeto residencial térreo de alto padrão. Planilha base Contabilidade Construção WILSON com acompanhamento semanal de medições e notas fiscais.',
  });

  const palmeirasId = await createConstruction(ownerId, {
    nome: 'Sobrado Jardim das Palmeiras',
    endereco: 'Av. dos Ipês, 118 — Quadra C, Lote 08',
    cliente: 'Wilson Mendes (Investimento)',
    status: 'em_andamento',
    orcamentoTotal: 620000,
    areaTerreno: 420,
    areaConstruida: 285,
    dataInicio: daysAgoIso(68, today),
    previsaoTermino: daysAgoIso(-120, today),
    coverPhotoUrl: SAMPLE_SITE_IMAGES.estrutura,
    terrainPhotoUrl: SAMPLE_SITE_IMAGES.terreno,
    model3dExteriorUrl: '',
    model3dInteriorUrl: '',
    observacoes:
      'Obra em fase de alvenaria estrutural e concretagem do pavimento superior. Controle integrado de fornecedores e equipes terceirizadas.',
  });

  // Add site photos to subcollections
  await Promise.all([
    addConstructionPhoto(ownerId, wilsonId, {
      tipo: 'terreno',
      url: SAMPLE_SITE_IMAGES.terreno,
      legenda: 'Limpeza do lote, terraplanagem e gabarito de fundação',
      dataFoto: daysAgoIso(112, today),
    }),
    addConstructionPhoto(ownerId, wilsonId, {
      tipo: 'fachada',
      url: SAMPLE_SITE_IMAGES.fachada,
      legenda: 'Fachada frontal em concreto aparente e esquadrias de alumínio',
      dataFoto: daysAgoIso(5, today),
    }),
    addConstructionPhoto(ownerId, wilsonId, {
      tipo: 'interior',
      url: SAMPLE_SITE_IMAGES.interior,
      legenda: 'Sala integrada e cozinha com porcelanato 90x90 instalado',
      dataFoto: daysAgoIso(2, today),
    }),
    addConstructionPhoto(ownerId, palmeirasId, {
      tipo: 'estrutura',
      url: SAMPLE_SITE_IMAGES.estrutura,
      legenda: 'Alvenaria do pavimento superior e vigas de cintamento',
      dataFoto: daysAgoIso(4, today),
    }),
  ]);

  // Realistic accounting ledger rows mirroring "Contabilidade Construção WILSON"
  const sampleExpenses: ExpenseCreateInput[] = [
    // Last 7 days (Weekly balance)
    {
      constructionId: wilsonId,
      categoria: 'Mão de Obra - Pisos',
      descricao: 'Assentamento de porcelanato retificado 90x90 — Sala e Cozinha (110m²)',
      valor: 8800,
      data: daysAgoIso(1, today),
      fornecedor: 'Equipe Ricardo Acabamentos ME',
      formaPagamento: 'PIX',
      notaFiscalNumero: 'NFS-e 2026/0418',
      observacoes: 'Medição final com argamassa AC-III inclusa',
    },
    {
      constructionId: wilsonId,
      categoria: 'Mão de Obra - Ar Condicionado',
      descricao: 'Infraestrutura frigorígena e instalação 4 pontos Inverter (cobre + dreno)',
      valor: 6450,
      data: daysAgoIso(3, today),
      fornecedor: 'ClimaSul Climatização Ltda',
      formaPagamento: 'Transferência/TED',
      notaFiscalNumero: 'NF-e 88321',
    },
    {
      constructionId: palmeirasId,
      categoria: 'Material',
      descricao: 'Concreto usinado FCK 30 MPa (18m³) + serviço de bomba lança',
      valor: 11340,
      data: daysAgoIso(4, today),
      fornecedor: 'Concremix Engenharia e Concreto',
      formaPagamento: 'Boleto',
      notaFiscalNumero: 'NF-e 45092',
    },
    {
      constructionId: wilsonId,
      categoria: 'Material',
      descricao: 'Tintas acrílicas fosca premium 18L (8 latas), massa corrida e selador',
      valor: 4280.5,
      data: daysAgoIso(5, today),
      fornecedor: 'Casa das Tintas Bandeirantes',
      formaPagamento: 'Cartão de Crédito',
      notaFiscalNumero: 'NFC-e 19402',
    },
    // Days 8 to 30 (Monthly balance)
    {
      constructionId: wilsonId,
      categoria: 'Mão de Obra - Eletricista',
      descricao: 'Cabeamento completo, quadro QDC 36 disjuntores DR/DPS e iluminação LED',
      valor: 9600,
      data: daysAgoIso(11, today),
      fornecedor: 'VoltPro Instalações Elétricas',
      formaPagamento: 'PIX',
      notaFiscalNumero: 'NFS-e 2026/0389',
    },
    {
      constructionId: palmeirasId,
      categoria: 'Mão de Obra - Pedreiro',
      descricao: 'Quinzena equipe de alvenaria estrutural e pilares pavimento superior',
      valor: 14500,
      data: daysAgoIso(13, today),
      fornecedor: 'Construtora Silva & Irmãos Empreiteira',
      formaPagamento: 'Transferência/TED',
      notaFiscalNumero: 'Recibo #14',
    },
    {
      constructionId: wilsonId,
      categoria: 'Material',
      descricao: 'Porcelanato acetinado 90x90 (135m²) + rodapés e niveladores',
      valor: 18950,
      data: daysAgoIso(18, today),
      fornecedor: 'Leroy Merlin — Unidade Sul',
      formaPagamento: 'Cartão de Crédito',
      notaFiscalNumero: 'NF-e 771029',
    },
    {
      constructionId: wilsonId,
      categoria: 'Mão de Obra - Encanador',
      descricao: 'Instalação de louças, metais, pressurizador e água quente PPR',
      valor: 5400,
      data: daysAgoIso(22, today),
      fornecedor: 'HidroMaster Instalações Hidráulicas',
      formaPagamento: 'PIX',
      notaFiscalNumero: 'NFS-e 2026/0312',
    },
    {
      constructionId: palmeirasId,
      categoria: 'Material',
      descricao: 'Aço CA-50 10mm e 12.5mm (2.400 kg) + arame recozido e estribos',
      valor: 16890,
      data: daysAgoIso(26, today),
      fornecedor: 'Gerdau Comercial / Aço Forte',
      formaPagamento: 'Boleto',
      notaFiscalNumero: 'NF-e 610284',
    },
    // Previous 31-90 days (Historical accounting)
    {
      constructionId: wilsonId,
      categoria: 'Material',
      descricao: 'Esquadrias de alumínio linha Suprema preto fosco com vidros temperados',
      valor: 46200,
      data: daysAgoIso(36, today),
      fornecedor: 'Alumínios & Vidros Horizonte',
      formaPagamento: 'Transferência/TED',
      notaFiscalNumero: 'NF-e 33091',
    },
    {
      constructionId: wilsonId,
      categoria: 'Mão de Obra - Pedreiro',
      descricao: 'Reboco interno/externo, contrapiso nivelado e platibanda',
      valor: 28500,
      data: daysAgoIso(44, today),
      fornecedor: 'Mestre João Carlos — Empreitada',
      formaPagamento: 'PIX',
      notaFiscalNumero: 'Medição #06',
    },
    {
      constructionId: palmeirasId,
      categoria: 'Material',
      descricao: 'Blocos cerâmicos estruturais 14x19x29 (6.500 un) + cimento CP-II (140 sacos)',
      valor: 21450,
      data: daysAgoIso(49, today),
      fornecedor: 'Depósito São Jorge Materiais',
      formaPagamento: 'Boleto',
      notaFiscalNumero: 'NF-e 90412',
    },
    {
      constructionId: palmeirasId,
      categoria: 'Despesas Iniciais',
      descricao: 'Projeto estrutural, sondagem SPT, alvará de construção e ART CREA',
      valor: 19800,
      data: daysAgoIso(62, today),
      fornecedor: 'Escritório Eng. Rafael Moura',
      formaPagamento: 'Transferência/TED',
      notaFiscalNumero: 'NFS-e 2026/0104',
    },
    {
      constructionId: wilsonId,
      categoria: 'Material',
      descricao: 'Cimento, areia lavada, brita 1, ferragem de radier e impermeabilizante',
      valor: 38700,
      data: daysAgoIso(76, today),
      fornecedor: 'Constrular Materiais de Construção',
      formaPagamento: 'Boleto',
      notaFiscalNumero: 'NF-e 28910',
    },
    {
      constructionId: wilsonId,
      categoria: 'Mão de Obra - Pedreiro',
      descricao: 'Execução de fundação, baldrames, alvenaria e laje treliçada',
      valor: 42000,
      data: daysAgoIso(85, today),
      fornecedor: 'Mestre João Carlos — Empreitada',
      formaPagamento: 'Transferência/TED',
      notaFiscalNumero: 'Medição #03',
    },
    {
      constructionId: wilsonId,
      categoria: 'Despesas Iniciais',
      descricao: 'Terraplanagem, levantamento topográfico, muro de divisa e padrão de energia',
      valor: 24900,
      data: daysAgoIso(108, today),
      fornecedor: 'TerraPlan Engenharia e Locações',
      formaPagamento: 'PIX',
      notaFiscalNumero: 'NF-e 11204',
    },
  ];

  for (const exp of sampleExpenses) {
    await createExpense(ownerId, exp);
  }
}
