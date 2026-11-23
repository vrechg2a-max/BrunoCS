/**
 * Phase 0 — Payload-First Security TDD Test Specification
 * Verifies that all "Dirty Dozen" adversarial payloads are rejected with PERMISSION_DENIED
 * against firestore.rules when executed in a Firebase Rules Unit Testing environment.
 */

export interface AdversarialCase {
  id: number;
  name: string;
  collectionPath: string;
  operation: 'create' | 'update' | 'get' | 'list' | 'delete';
  auth: {
    uid: string;
    email?: string;
    email_verified?: boolean;
  } | null;
  payload?: Record<string, unknown>;
  expectedOutcome: 'PERMISSION_DENIED';
  mitigatingRule: string;
}

export const DIRTY_DOZEN_CASES: AdversarialCase[] = [
  {
    id: 1,
    name: 'Identity Spoofing on Construction Create',
    collectionPath: 'constructions/obra-spoof-01',
    operation: 'create',
    auth: { uid: 'attacker_uid', email: 'attacker@example.com', email_verified: true },
    payload: {
      nome: 'Obra Falsa',
      endereco: 'Rua Teste, 100',
      cliente: 'Vitima',
      status: 'planejamento',
      orcamentoTotal: 350000,
      areaTerreno: 300,
      areaConstruida: 180,
      dataInicio: '2026-01-10',
      ownerId: 'victim_uid',
    },
    expectedOutcome: 'PERMISSION_DENIED',
    mitigatingRule: 'isValidConstruction() enforces data.ownerId == request.auth.uid',
  },
  {
    id: 2,
    name: 'Shadow Field Injection on Construction Create',
    collectionPath: 'constructions/obra-shadow-02',
    operation: 'create',
    auth: { uid: 'user_a', email: 'a@example.com', email_verified: true },
    payload: {
      nome: 'Obra Valida',
      endereco: 'Av Brasil, 50',
      cliente: 'Wilson',
      status: 'em_andamento',
      orcamentoTotal: 400000,
      areaTerreno: 360,
      areaConstruida: 210,
      dataInicio: '2026-02-01',
      ownerId: 'user_a',
      isAdmin: true,
    },
    expectedOutcome: 'PERMISSION_DENIED',
    mitigatingRule: 'isValidConstruction() enforces data.keys().hasOnly([...])',
  },
  {
    id: 3,
    name: 'Shadow Field Injection on Expense Update',
    collectionPath: 'expenses/exp-shadow-03',
    operation: 'update',
    auth: { uid: 'user_a', email: 'a@example.com', email_verified: true },
    payload: {
      valor: 1500,
      ghostAuditFlag: true,
    },
    expectedOutcome: 'PERMISSION_DENIED',
    mitigatingRule: 'affectedKeys().hasOnly(...) and isValidExpense(incoming()) reject unknown keys',
  },
  {
    id: 4,
    name: 'Document ID Poisoning (>128 chars / path traversal chars)',
    collectionPath: `constructions/${'x'.repeat(140)}$$`,
    operation: 'create',
    auth: { uid: 'user_a', email: 'a@example.com', email_verified: true },
    payload: {
      nome: 'Obra ID Invalido',
      endereco: 'Rua A, 1',
      cliente: 'Wilson',
      status: 'planejamento',
      orcamentoTotal: 250000,
      areaTerreno: 250,
      areaConstruida: 120,
      dataInicio: '2026-02-15',
      ownerId: 'user_a',
    },
    expectedOutcome: 'PERMISSION_DENIED',
    mitigatingRule: 'isValidId(constructionId) enforces <= 128 chars and ^[a-zA-Z0-9_\\-]+$',
  },
  {
    id: 5,
    name: 'Orphaned Expense Referencing Non-Existent Construction',
    collectionPath: 'expenses/exp-orphan-05',
    operation: 'create',
    auth: { uid: 'user_a', email: 'a@example.com', email_verified: true },
    payload: {
      constructionId: 'non-existent-obra-id',
      categoria: 'Material',
      descricao: 'Cimento CP-II 50kg',
      valor: 2450,
      data: '2026-03-01',
      fornecedor: 'Casa do Construtor',
      formaPagamento: 'PIX',
      ownerId: 'user_a',
    },
    expectedOutcome: 'PERMISSION_DENIED',
    mitigatingRule: 'ownsConstruction(incoming().constructionId) checks exists() and parent ownerId',
  },
  {
    id: 6,
    name: 'Cross-Tenant Expense Attachment to Another Users Construction',
    collectionPath: 'expenses/exp-xtenant-06',
    operation: 'create',
    auth: { uid: 'attacker_uid', email: 'attacker@example.com', email_verified: true },
    payload: {
      constructionId: 'victim-obra-01',
      categoria: 'Despesas Iniciais',
      descricao: 'Taxa falsa',
      valor: 900,
      data: '2026-03-02',
      fornecedor: 'Empresa X',
      formaPagamento: 'Boleto',
      ownerId: 'attacker_uid',
    },
    expectedOutcome: 'PERMISSION_DENIED',
    mitigatingRule: 'get(/constructions/$(constructionId)).data.ownerId == request.auth.uid',
  },
  {
    id: 7,
    name: 'Client-Forged Timestamp Injection',
    collectionPath: 'expenses/exp-time-07',
    operation: 'create',
    auth: { uid: 'user_a', email: 'a@example.com', email_verified: true },
    payload: {
      constructionId: 'obra-user-a',
      categoria: 'Material',
      descricao: 'Areia Media 6m3',
      valor: 840,
      data: '2026-03-05',
      fornecedor: 'Deposito Central',
      formaPagamento: 'PIX',
      ownerId: 'user_a',
      createdAt: '2020-01-01T00:00:00.000Z',
      updatedAt: '2020-01-01T00:00:00.000Z',
    },
    expectedOutcome: 'PERMISSION_DENIED',
    mitigatingRule: 'incoming().createdAt == request.time && incoming().updatedAt == request.time',
  },
  {
    id: 8,
    name: 'Immutable Field Tampering (Reassigning constructionId)',
    collectionPath: 'expenses/exp-immut-08',
    operation: 'update',
    auth: { uid: 'user_a', email: 'a@example.com', email_verified: true },
    payload: {
      constructionId: 'obra-user-a-2',
    },
    expectedOutcome: 'PERMISSION_DENIED',
    mitigatingRule: 'incoming().constructionId == existing().constructionId and affectedKeys allowlist',
  },
  {
    id: 9,
    name: 'Terminal State Modification After Concluida',
    collectionPath: 'constructions/obra-concluida-09',
    operation: 'update',
    auth: { uid: 'user_a', email: 'a@example.com', email_verified: true },
    payload: {
      orcamentoTotal: 999999,
    },
    expectedOutcome: 'PERMISSION_DENIED',
    mitigatingRule: "existing().status != 'concluida' terminal lock prevents edits on closed works",
  },
  {
    id: 10,
    name: 'Value Poisoning (Negative Amount / Invalid Enum)',
    collectionPath: 'expenses/exp-poison-10',
    operation: 'update',
    auth: { uid: 'user_a', email: 'a@example.com', email_verified: true },
    payload: {
      valor: -5000,
      categoria: 'Categoria Inventada',
    },
    expectedOutcome: 'PERMISSION_DENIED',
    mitigatingRule: 'isValidExpense(incoming()) enforces valor > 0 and strict category enum allowlist',
  },
  {
    id: 11,
    name: 'Unverified Email Write Attempt',
    collectionPath: 'constructions/obra-unverified-11',
    operation: 'create',
    auth: { uid: 'unverified_uid', email: 'spoof@example.com', email_verified: false },
    payload: {
      nome: 'Obra Nao Verificada',
      endereco: 'Rua B, 20',
      cliente: 'Teste',
      status: 'planejamento',
      orcamentoTotal: 150000,
      areaTerreno: 200,
      areaConstruida: 90,
      dataInicio: '2026-03-10',
      ownerId: 'unverified_uid',
    },
    expectedOutcome: 'PERMISSION_DENIED',
    mitigatingRule: 'isVerifiedUser() enforces request.auth.token.email_verified == true',
  },
  {
    id: 12,
    name: 'Blanket Collection Scrape Without Owner Filter',
    collectionPath: 'expenses',
    operation: 'list',
    auth: { uid: 'attacker_uid', email: 'attacker@example.com', email_verified: true },
    expectedOutcome: 'PERMISSION_DENIED',
    mitigatingRule: 'allow list enforces resource.data.ownerId == request.auth.uid',
  },
];
