import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Building2,
  Database,
  FileSpreadsheet,
  LogOut,
  Menu,
  Plus,
  X,
} from 'lucide-react';
import { useAuth } from './context/AuthContext';
import {
  seedWilsonSampleData,
  subscribeConstructions,
  subscribeExpenses,
} from './services/firestoreService';
import type { Construction, CrossFilterState, Expense } from './types/domain';
import { LoginGate } from './components/auth/LoginGate';
import { FinancialDashboard } from './components/dashboard/FinancialDashboard';
import { ConstructionsListView } from './components/constructions/ConstructionsListView';
import { ConstructionDetailView } from './components/constructions/ConstructionDetailView';
import { ConstructionFormModal } from './components/constructions/ConstructionFormModal';
import { ExpensesLedgerView } from './components/expenses/ExpensesLedgerView';
import { ExpenseFormModal } from './components/expenses/ExpenseFormModal';
import { SchemaArchitectureView } from './components/schema/SchemaArchitectureView';

type ActiveTab = 'dashboard' | 'constructions' | 'expenses' | 'schema';

export default function App() {
  const { user, loading: authLoading, signOut } = useAuth();

  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [selectedConstructionId, setSelectedConstructionId] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Live Firestore collections
  const [constructions, setConstructions] = useState<Construction[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  // Cross-filtering state shared between Dashboard & Ledger
  const [filter, setFilter] = useState<CrossFilterState>({
    constructionId: 'all',
    datePreset: 'all',
    startDate: '',
    endDate: '',
    category: 'all',
    searchQuery: '',
  });

  // Modals state
  const [constructionModalOpen, setConstructionModalOpen] = useState(false);
  const [editingConstruction, setEditingConstruction] = useState<Construction | null>(null);

  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [expenseDefaultConstructionId, setExpenseDefaultConstructionId] = useState<
    string | undefined
  >(undefined);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  // Attach Firestore real-time listeners only after auth is ready & user is authenticated
  useEffect(() => {
    if (!user) {
      setConstructions([]);
      setExpenses([]);
      setDataLoading(false);
      return;
    }

    setDataLoading(true);
    let constructionsReady = false;
    let expensesReady = false;

    const markReady = () => {
      if (constructionsReady && expensesReady) {
        setDataLoading(false);
      }
    };

    const unsubConstructions = subscribeConstructions(user.uid, (items) => {
      setConstructions(items);
      constructionsReady = true;
      markReady();
    });

    const unsubExpenses = subscribeExpenses(user.uid, (items) => {
      setExpenses(items);
      expensesReady = true;
      markReady();
    });

    return () => {
      unsubConstructions();
      unsubExpenses();
    };
  }, [user]);

  const selectedConstruction = useMemo(
    () => constructions.find((c) => c.id === selectedConstructionId) || null,
    [constructions, selectedConstructionId],
  );

  // Clear stale selection if a construction was deleted
  useEffect(() => {
    if (selectedConstructionId && !selectedConstruction && !dataLoading) {
      setSelectedConstructionId(null);
    }
  }, [selectedConstructionId, selectedConstruction, dataLoading]);

  const handleOpenConstruction = (constructionId: string) => {
    setSelectedConstructionId(constructionId);
    setActiveTab('constructions');
    setMobileMenuOpen(false);
  };

  const handleOpenNewConstruction = () => {
    setEditingConstruction(null);
    setConstructionModalOpen(true);
  };

  const handleOpenEditConstruction = (construction: Construction) => {
    setEditingConstruction(construction);
    setConstructionModalOpen(true);
  };

  const handleOpenNewExpense = (constructionId?: string) => {
    setEditingExpense(null);
    setExpenseDefaultConstructionId(constructionId || constructions[0]?.id);
    setExpenseModalOpen(true);
  };

  const handleOpenEditExpense = (expense: Expense) => {
    setEditingExpense(expense);
    setExpenseDefaultConstructionId(expense.constructionId);
    setExpenseModalOpen(true);
  };

  const handleSeedSampleData = async () => {
    if (!user || seeding) return;
    setSeeding(true);
    try {
      await seedWilsonSampleData(user.uid);
    } finally {
      setSeeding(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-sm text-slate-500 font-medium">Inicializando ObraControl...</div>
      </div>
    );
  }

  if (!user) {
    return <LoginGate />;
  }

  const navItems: { id: ActiveTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'dashboard', label: 'Dashboard Financeiro', icon: BarChart3 },
    { id: 'constructions', label: 'Construções & 3D', icon: Building2 },
    { id: 'expenses', label: 'Custos e Despesas', icon: FileSpreadsheet },
    { id: 'schema', label: 'Schema Firestore', icon: Database },
  ];

  const breadcrumbLabel = (() => {
    if (activeTab === 'constructions' && selectedConstruction) {
      return `Construções / ${selectedConstruction.nome}`;
    }
    const found = navItems.find((item) => item.id === activeTab);
    return found ? found.label : 'Dashboard Financeiro';
  })();

  const primaryAction =
    activeTab === 'constructions' && !selectedConstruction
      ? {
          label: 'Nova Construção',
          onClick: handleOpenNewConstruction,
          disabled: false,
        }
      : {
          label: 'Lançar Despesa',
          onClick: () =>
            handleOpenNewExpense(
              selectedConstruction?.id ||
                (filter.constructionId !== 'all' ? filter.constructionId : undefined),
            ),
          disabled: constructions.length === 0,
        };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop Sidebar (256px) */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-white border-r border-slate-200 z-30">
        <div className="h-16 px-5 flex items-center border-b border-slate-200">
          <button
            type="button"
            onClick={() => {
              setActiveTab('dashboard');
              setSelectedConstructionId(null);
            }}
            className="text-lg font-bold tracking-tight text-slate-900 font-display whitespace-nowrap cursor-pointer"
          >
            ObraControl
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveTab(item.id);
                  if (item.id !== 'constructions') setSelectedConstructionId(null);
                  else setSelectedConstructionId(null);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}

          {constructions.length > 0 && (
            <div className="pt-5 mt-5 border-t border-slate-200 space-y-1">
              <div className="px-3 pb-1 text-xs font-medium text-slate-400">
                Obras ativas ({constructions.length})
              </div>
              {constructions.map((obra) => {
                const isSelected =
                  activeTab === 'constructions' && selectedConstructionId === obra.id;
                return (
                  <button
                    key={obra.id}
                    type="button"
                    onClick={() => handleOpenConstruction(obra.id)}
                    className={`w-full text-left px-3 py-1.5 text-xs font-medium rounded-lg transition-colors truncate cursor-pointer ${
                      isSelected
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                    title={obra.nome}
                  >
                    {obra.nome}
                  </button>
                );
              })}
            </div>
          )}
        </nav>

        {/* User Footer */}
        <div className="p-3 border-t border-slate-200 space-y-2">
          <div className="px-2 py-1">
            <div className="text-xs font-semibold text-slate-900 truncate">
              {user.displayName || 'Usuário'}
            </div>
            <div className="text-[11px] text-slate-500 truncate">{user.email}</div>
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            className="w-full flex items-center gap-2 px-2.5 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sair da conta
          </button>
        </div>
      </aside>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-64 max-w-[80vw] bg-white border-r border-slate-200 flex flex-col z-50">
            <div className="h-14 px-4 flex items-center justify-between border-b border-slate-200">
              <span className="text-base font-bold text-slate-900 font-display">
                ObraControl
              </span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 text-slate-500 hover:text-slate-900"
                aria-label="Fechar menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.id);
                      setSelectedConstructionId(null);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-lg ${
                      activeTab === item.id
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="p-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => void signOut()}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sair ({user.email})
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Contextual Top Bar (Breadcrumb Left + 1 Primary CTA Right) */}
        <header className="sticky top-0 z-20 h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 rounded-lg"
              aria-label="Abrir navegação"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="text-sm text-slate-500 flex items-center gap-2 truncate">
              <span className="hidden sm:inline font-medium text-slate-400">ObraControl</span>
              <span className="hidden sm:inline text-slate-300">/</span>
              <span className="font-semibold text-slate-900 truncate">{breadcrumbLabel}</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={primaryAction.onClick}
              disabled={primaryAction.disabled}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              {primaryAction.label}
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-[1400px] w-full mx-auto">
          {dataLoading ? (
            <div className="space-y-4">
              <div className="h-24 bg-white border border-slate-200 rounded-xl animate-pulse" />
              <div className="h-32 bg-white border border-slate-200 rounded-xl animate-pulse" />
              <div className="h-80 bg-white border border-slate-200 rounded-xl animate-pulse" />
            </div>
          ) : (
            <>
              {activeTab === 'dashboard' && (
                <FinancialDashboard
                  constructions={constructions}
                  expenses={expenses}
                  filter={filter}
                  onChangeFilter={setFilter}
                  onOpenConstruction={handleOpenConstruction}
                  onNewExpense={handleOpenNewExpense}
                  onEditExpense={handleOpenEditExpense}
                  onSeedSampleData={handleSeedSampleData}
                  seeding={seeding}
                />
              )}

              {activeTab === 'constructions' && !selectedConstruction && (
                <ConstructionsListView
                  constructions={constructions}
                  expenses={expenses}
                  onOpenConstruction={handleOpenConstruction}
                  onNewConstruction={handleOpenNewConstruction}
                  onNewExpense={handleOpenNewExpense}
                />
              )}

              {activeTab === 'constructions' && selectedConstruction && (
                <ConstructionDetailView
                  ownerId={user.uid}
                  construction={selectedConstruction}
                  expenses={expenses}
                  onBack={() => setSelectedConstructionId(null)}
                  onEditConstruction={handleOpenEditConstruction}
                  onNewExpense={handleOpenNewExpense}
                  onEditExpense={handleOpenEditExpense}
                />
              )}

              {activeTab === 'expenses' && (
                <ExpensesLedgerView
                  constructions={constructions}
                  expenses={expenses}
                  filter={filter}
                  onChangeFilter={setFilter}
                  onNewExpense={handleOpenNewExpense}
                  onEditExpense={handleOpenEditExpense}
                />
              )}

              {activeTab === 'schema' && <SchemaArchitectureView />}
            </>
          )}
        </main>
      </div>

      {/* Modals */}
      <ConstructionFormModal
        isOpen={constructionModalOpen}
        ownerId={user.uid}
        editingConstruction={editingConstruction}
        onClose={() => setConstructionModalOpen(false)}
        onCreated={(id) => handleOpenConstruction(id)}
        onDeleted={() => setSelectedConstructionId(null)}
      />

      <ExpenseFormModal
        isOpen={expenseModalOpen}
        ownerId={user.uid}
        constructions={constructions}
        initialConstructionId={expenseDefaultConstructionId}
        editingExpense={editingExpense}
        onClose={() => setExpenseModalOpen(false)}
      />
    </div>
  );
}
