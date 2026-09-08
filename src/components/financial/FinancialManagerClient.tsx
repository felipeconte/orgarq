'use client'

import { useState, useMemo, useTransition } from 'react'
import Link from 'next/link'
import {
  TrendingUp,
  TrendingDown,
  CircleDollarSign,
  Plus,
  Filter,
  Search,
  Calendar,
  Building2,
  FolderGit2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Repeat,
  Sparkles,
  PieChart,
  Layers,
  ChevronRight,
  Edit2,
  Trash2,
  ExternalLink,
  ChevronDown,
  Info,
  SlidersHorizontal,
  DollarSign,
  Briefcase,
  Users,
  Check,
  X,
  User
} from 'lucide-react'
import {
  FinancialTransaction,
  RecurringExpense,
  FinancialSummary,
  ProjectProfitabilityItem,
  MonthCashFlowProjection,
  FINANCIAL_CATEGORIES,
  TransactionType,
  TransactionStatus
} from '@/types/financial'
import {
  toggleTransactionStatusAction,
  getFinancialTransactionsAction,
  getFinancialSummaryAction,
  getRecurringExpensesAction,
  getProjectsProfitabilityAction,
  getFutureCashFlowProjectionAction
} from '@/lib/actions/financial'
import TransactionModal from './TransactionModal'

interface ProjectOption {
  id: string
  code: string
  title: string
  client_name?: string
}

interface CompanyOption {
  id: string
  name: string
  trade_name?: string | null
}

interface ClientOption {
  id: string
  name: string
}

interface FinancialManagerClientProps {
  organizationId: string
  initialTransactions: FinancialTransaction[]
  initialSummary: FinancialSummary
  initialRecurringExpenses: RecurringExpense[]
  initialProfitability: ProjectProfitabilityItem[]
  initialProjection: MonthCashFlowProjection[]
  projects: ProjectOption[]
  companies: CompanyOption[]
  clients?: ClientOption[]
}

type TabType = 'visao_geral' | 'extrato' | 'projetos' | 'projecao'

export default function FinancialManagerClient({
  organizationId,
  initialTransactions,
  initialSummary,
  initialRecurringExpenses,
  initialProfitability,
  initialProjection,
  projects,
  companies,
  clients = []
}: FinancialManagerClientProps) {
  const [activeTab, setActiveTab] = useState<TabType>('visao_geral')

  // Estado dos dados
  const [transactions, setTransactions] = useState<FinancialTransaction[]>(initialTransactions)
  const [summary, setSummary] = useState<FinancialSummary>(initialSummary)
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>(initialRecurringExpenses)
  const [profitability, setProfitability] = useState<ProjectProfitabilityItem[]>(initialProfitability)
  const [projection, setProjection] = useState<MonthCashFlowProjection[]>(initialProjection)

  // Filtros de listagem de transações
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedType, setSelectedType] = useState<TransactionType | 'all'>('all')
  const [selectedStatus, setSelectedStatus] = useState<TransactionStatus | 'all'>('all')
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedRecurrence, setSelectedRecurrence] = useState<'all' | 'recurring_only' | 'single_only'>('all')
  const [dateRangeMode, setDateRangeMode] = useState<'current_month' | 'last_month' | 'next_month' | 'year' | 'all'>('current_month')

  // Modais
  const [isTxModalOpen, setIsTxModalOpen] = useState(false)
  const [selectedTx, setSelectedTx] = useState<FinancialTransaction | null>(null)
  const [modalDefaultType, setModalDefaultType] = useState<TransactionType>('income')

  const [isPendingStatus, startTransition] = useTransition()

  // Formatador de Moeda BRL
  const formatBRL = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(val || 0)
  }

  // Formatador de Data BR
  const formatDateBR = (dateStr?: string | null) => {
    if (!dateStr) return '-'
    const parts = dateStr.split('T')[0].split('-')
    if (parts.length !== 3) return dateStr
    return `${parts[2]}/${parts[1]}/${parts[0]}`
  }

  // Abre modal para criar transação
  const handleOpenNewTransaction = (type: TransactionType = 'income') => {
    setSelectedTx(null)
    setModalDefaultType(type)
    setIsTxModalOpen(true)
  }

  // Abre modal para editar transação
  const handleOpenEditTransaction = (tx: FinancialTransaction) => {
    setSelectedTx(tx)
    setIsTxModalOpen(true)
  }

  // Recarrega todos os cálculos consolidados
  const refreshFinancialData = async () => {
    const [sumRes, txsRes, recRes, profRes, projRes] = await Promise.all([
      getFinancialSummaryAction({ organizationId }),
      getFinancialTransactionsAction({ organizationId }),
      getRecurringExpensesAction(organizationId),
      getProjectsProfitabilityAction(organizationId),
      getFutureCashFlowProjectionAction({ organizationId, monthsAhead: 6 })
    ])

    if (sumRes.success && sumRes.summary) {
      setSummary(sumRes.summary)
    }
    if (txsRes.success && txsRes.transactions) {
      setTransactions(txsRes.transactions)
    }
    if (recRes.success && recRes.expenses) {
      setRecurringExpenses(recRes.expenses)
    }
    if (profRes.success && profRes.projects) {
      setProfitability(profRes.projects)
    }
    if (projRes.success && projRes.timeline) {
      setProjection(projRes.timeline)
    }
  }

  // Callback de sucesso ao salvar/editar/excluir lançamento
  const handleTxSuccess = (savedTx: FinancialTransaction, isDeleted?: boolean) => {
    let updated: FinancialTransaction[]
    if (isDeleted) {
      if (savedTx.recurring_expense_id) {
        updated = transactions.filter(
          (t) => t.id !== savedTx.id && (!t.recurring_expense_id || t.recurring_expense_id !== savedTx.recurring_expense_id)
        )
      } else {
        updated = transactions.filter((t) => t.id !== savedTx.id)
      }
    } else {
      const exists = transactions.some((t) => t.id === savedTx.id)
      if (exists) {
        updated = transactions.map((t) => (t.id === savedTx.id ? savedTx : t))
      } else {
        updated = [savedTx, ...transactions]
      }
    }
    setTransactions(updated)
    refreshFinancialData()
  }

  // Alterna status pago/pendente com 1 clique
  const handleToggleStatus = async (tx: FinancialTransaction) => {
    const newStatus: TransactionStatus = tx.status === 'paid' ? 'pending' : 'paid'

    // Atualização otimista
    const optimistic = transactions.map((t) =>
      t.id === tx.id
        ? {
            ...t,
            status: newStatus,
            payment_date: newStatus === 'paid' ? new Date().toISOString().split('T')[0] : null
          }
        : t
    )
    setTransactions(optimistic)

    startTransition(async () => {
      await toggleTransactionStatusAction({
        id: tx.id,
        organizationId,
        status: newStatus
      })
      refreshFinancialData()
    })
  }

  // Filtro dos lançamentos exibidos na aba Extrato
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      // Busca
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase()
        const matchTitle = tx.title?.toLowerCase().includes(term)
        const matchDesc = tx.description?.toLowerCase().includes(term)
        const matchProj = tx.projects?.title?.toLowerCase().includes(term) || tx.projects?.code?.toLowerCase().includes(term)
        const matchComp = tx.companies?.name?.toLowerCase().includes(term)
        const matchRec = (term === 'recorrente' || term === 'recorrência' || term === 'recorrencia') && Boolean(tx.recurring_expense_id)
        if (!matchTitle && !matchDesc && !matchProj && !matchComp && !matchRec) return false
      }

      // Tipo
      if (selectedType !== 'all' && tx.type !== selectedType) return false

      // Status
      if (selectedStatus !== 'all' && tx.status !== selectedStatus) return false

      // Recorrência
      if (selectedRecurrence === 'recurring_only' && !tx.recurring_expense_id) return false
      if (selectedRecurrence === 'single_only' && tx.recurring_expense_id) return false

      // Projeto
      if (selectedProjectId !== 'all' && tx.project_id !== selectedProjectId) return false

      // Categoria
      if (selectedCategory !== 'all' && tx.category !== selectedCategory) return false

      // Período
      if (dateRangeMode !== 'all') {
        const now = new Date()
        const currentYear = now.getFullYear()
        const currentMonth = now.getMonth() + 1
        const currentMonthKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}`

        const txDate = tx.due_date || tx.payment_date || ''

        if (dateRangeMode === 'current_month') {
          if (!txDate.startsWith(currentMonthKey)) return false
        } else if (dateRangeMode === 'last_month') {
          const lastMonthDate = new Date(currentYear, now.getMonth() - 1, 1)
          const lastMonthKey = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`
          if (!txDate.startsWith(lastMonthKey)) return false
        } else if (dateRangeMode === 'next_month') {
          const nextMonthDate = new Date(currentYear, now.getMonth() + 1, 1)
          const nextMonthKey = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}`
          if (!txDate.startsWith(nextMonthKey)) return false
        } else if (dateRangeMode === 'year') {
          if (!txDate.startsWith(String(currentYear))) return false
        }
      }

      return true
    })
  }, [transactions, searchTerm, selectedType, selectedStatus, selectedRecurrence, selectedProjectId, selectedCategory, dateRangeMode])

  // Contas vencidas ou a vencer nos próximos 7 dias
  const urgentBills = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0]
    const next7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    return transactions
      .filter((tx) => tx.type === 'expense' && tx.status !== 'paid' && tx.due_date <= next7Days)
      .sort((a, b) => a.due_date.localeCompare(b.due_date))
      .slice(0, 5)
  }, [transactions])

  return (
    <div className="space-y-6 antialiased">
      {/* Top Header & Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Gestão Financeira do Escritório
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
              Fluxo & Lucro
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Acompanhe receitas, despesas, recorrências e a rentabilidade individual de cada projeto.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <button
            onClick={() => handleOpenNewTransaction('expense')}
            className="inline-flex items-center gap-1.5 py-2.5 px-4 rounded-xl bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            <TrendingDown className="w-4 h-4 text-rose-600" />
            Nova Despesa
          </button>

          <button
            onClick={() => handleOpenNewTransaction('income')}
            className="inline-flex items-center gap-1.5 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs shadow-emerald-600/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Nova Receita
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-1.5 border-b border-slate-200 overflow-x-auto pb-px">
        <button
          onClick={() => setActiveTab('visao_geral')}
          className={`px-4 py-3 text-xs font-bold border-b-2 flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'visao_geral'
              ? 'border-emerald-600 text-emerald-700 bg-emerald-50/40 rounded-t-xl'
              : 'border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300'
          }`}
        >
          <PieChart className="w-4 h-4" />
          Visão Geral & Indicadores
        </button>

        <button
          onClick={() => setActiveTab('extrato')}
          className={`px-4 py-3 text-xs font-bold border-b-2 flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'extrato'
              ? 'border-emerald-600 text-emerald-700 bg-emerald-50/40 rounded-t-xl'
              : 'border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300'
          }`}
        >
          <CircleDollarSign className="w-4 h-4" />
          Lançamentos & Extrato
          <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-slate-100 text-slate-600">
            {transactions.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('projetos')}
          className={`px-4 py-3 text-xs font-bold border-b-2 flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'projetos'
              ? 'border-emerald-600 text-emerald-700 bg-emerald-50/40 rounded-t-xl'
              : 'border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300'
          }`}
        >
          <FolderGit2 className="w-4 h-4" />
          Lucratividade por Projeto
          <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-blue-100 text-blue-700 font-bold">
            {profitability.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('projecao')}
          className={`px-4 py-3 text-xs font-bold border-b-2 flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'projecao'
              ? 'border-emerald-600 text-emerald-700 bg-emerald-50/40 rounded-t-xl'
              : 'border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300'
          }`}
        >
          <Sparkles className="w-4 h-4 text-amber-500" />
          Passado, Presente e Futuro
        </button>
      </div>

      {/* ========================================================================= */}
      {/* ABA 1: VISÃO GERAL (DASHBOARD) */}
      {/* ========================================================================= */}
      {activeTab === 'visao_geral' && (
        <div className="space-y-6">
          {/* Main KPI Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Saldo Realizado */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Saldo Realizado
                </span>
                <div
                  className={`w-9 h-9 rounded-2xl flex items-center justify-center ${
                    summary.realizedBalance >= 0
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-rose-100 text-rose-700'
                  }`}
                >
                  <CircleDollarSign className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3">
                <span
                  className={`text-2xl font-extrabold tracking-tight ${
                    summary.realizedBalance >= 0 ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {formatBRL(summary.realizedBalance)}
                </span>
                <p className="text-[11px] text-slate-400 mt-1 font-medium">
                  Total recebido menos total pago até o momento
                </p>
              </div>
            </div>

            {/* Total Recebido (Entradas) */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Receitas Realizadas
                </span>
                <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <ArrowUpRight className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-extrabold text-slate-900 tracking-tight">
                  {formatBRL(summary.realizedIncome)}
                </span>
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 font-bold mt-1">
                  <span>+ {formatBRL(summary.pendingIncome)} a receber</span>
                </div>
              </div>
            </div>

            {/* Total Pago (Saídas) */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Despesas Pagas
                </span>
                <div className="w-9 h-9 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
                  <ArrowDownRight className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-extrabold text-slate-900 tracking-tight">
                  {formatBRL(summary.realizedExpense)}
                </span>
                <div className="flex items-center gap-1.5 text-[11px] text-rose-600 font-bold mt-1">
                  <span>+ {formatBRL(summary.pendingExpense)} a pagar</span>
                </div>
              </div>
            </div>

            {/* Recorrências & Custo Fixo */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Recorrências / Mês
                </span>
                <div className="w-9 h-9 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Repeat className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-extrabold text-indigo-600 tracking-tight">
                  {formatBRL(summary.totalMonthlyFixedExpenses)}
                </span>
                <div className="flex items-center justify-between text-[11px] font-medium text-slate-500 mt-1">
                  <span>+ {formatBRL(summary.totalMonthlyRecurringIncome || 0)} rec.</span>
                  <span className="text-indigo-700 font-bold">
                    {recurringExpenses.filter((r) => r.is_active).length} ativas
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Section: Alertas e Categorias Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Contas a Vencer & Alertas */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  Próximos Vencimentos
                </h2>
                <span className="text-[11px] font-bold text-slate-400">7 dias</span>
              </div>

              {urgentBills.length === 0 ? (
                <div className="p-6 text-center text-slate-400 border border-dashed border-slate-200 rounded-2xl">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                  <p className="text-xs font-semibold text-slate-600">Nenhuma conta pendente para os próximos 7 dias!</p>
                  <p className="text-[11px] text-slate-400">Seu fluxo de curto prazo está em dia.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {urgentBills.map((bill) => (
                    <div
                      key={bill.id}
                      className="p-3 rounded-2xl border border-slate-100 bg-slate-50/70 hover:bg-slate-50 transition-colors flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800 truncate block">{bill.title}</span>
                          {bill.recurring_expense_id && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-700 shrink-0">
                              Recorrente
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400 block">
                          Vence em {formatDateBR(bill.due_date)} • {bill.payment_method || 'Boleto'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono font-bold text-rose-600">
                          {formatBRL(bill.amount)}
                        </span>
                        <button
                          onClick={() => handleToggleStatus(bill)}
                          className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-colors cursor-pointer"
                          title="Marcar como Pago"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Origem das Receitas por Categoria */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                Origem das Receitas
              </h2>

              {summary.incomesByCategory.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">Nenhuma receita registrada no período.</p>
              ) : (
                <div className="space-y-3">
                  {summary.incomesByCategory.slice(0, 5).map((item) => (
                    <div key={item.category} className="space-y-1 text-xs">
                      <div className="flex justify-between font-semibold">
                        <span className="text-slate-700">{item.label}</span>
                        <span className="text-slate-900 font-mono">{formatBRL(item.amount)}</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, item.percentage)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Destino das Despesas por Categoria */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ArrowDownRight className="w-4 h-4 text-rose-600" />
                Destino das Despesas
              </h2>

              {summary.expensesByCategory.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">Nenhuma despesa registrada no período.</p>
              ) : (
                <div className="space-y-3">
                  {summary.expensesByCategory.slice(0, 5).map((item) => (
                    <div key={item.category} className="space-y-1 text-xs">
                      <div className="flex justify-between font-semibold">
                        <span className="text-slate-700">{item.label}</span>
                        <span className="text-slate-900 font-mono">{formatBRL(item.amount)}</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-rose-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, item.percentage)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 2: LANÇAMENTOS & EXTRATO */}
      {/* ========================================================================= */}
      {activeTab === 'extrato' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por descrição, projeto, fornecedor, recorrente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-xs"
              />
            </div>

            {/* Quick Filters */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 flex-wrap">
              {/* Período */}
              <select
                value={dateRangeMode}
                onChange={(e: any) => setDateRangeMode(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold focus:outline-none"
              >
                <option value="current_month">Mês Atual</option>
                <option value="last_month">Mês Passado</option>
                <option value="next_month">Próximo Mês</option>
                <option value="year">Ano Atual</option>
                <option value="all">Todo o Período</option>
              </select>

              {/* Tipo */}
              <select
                value={selectedType}
                onChange={(e: any) => setSelectedType(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold focus:outline-none"
              >
                <option value="all">Tipo: Todos</option>
                <option value="income">Receitas (+)</option>
                <option value="expense">Despesas (-)</option>
              </select>

              {/* Filtro de Recorrência */}
              <select
                value={selectedRecurrence}
                onChange={(e: any) => setSelectedRecurrence(e.target.value)}
                className={`px-3 py-1.5 rounded-xl border font-semibold focus:outline-none transition-colors ${
                  selectedRecurrence !== 'all'
                    ? 'border-indigo-300 bg-indigo-50/70 text-indigo-800 ring-1 ring-indigo-300'
                    : 'border-slate-200 bg-white text-slate-700'
                }`}
              >
                <option value="all">Recorrência: Todas</option>
                <option value="recurring_only">🔁 Apenas Recorrentes ({transactions.filter(t => t.recurring_expense_id).length})</option>
                <option value="single_only">📄 Apenas Avulsos ({transactions.filter(t => !t.recurring_expense_id).length})</option>
              </select>

              {/* Status */}
              <select
                value={selectedStatus}
                onChange={(e: any) => setSelectedStatus(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold focus:outline-none"
              >
                <option value="all">Status: Todos</option>
                <option value="paid">Pago / Liquidado</option>
                <option value="pending">Pendente</option>
                <option value="overdue">Vencido</option>
              </select>

              {/* Projeto */}
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold focus:outline-none max-w-[160px] truncate"
              >
                <option value="all">Projetos: Todos</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} - {p.title}
                  </option>
                ))}
              </select>

              {/* Categoria */}
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold focus:outline-none"
              >
                <option value="all">Categorias: Todas</option>
                {FINANCIAL_CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Transactions Table / List */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
            {filteredTransactions.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <CircleDollarSign className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <h3 className="text-sm font-bold text-slate-700">Nenhum lançamento encontrado</h3>
                
                {selectedRecurrence === 'recurring_only' && transactions.some((t) => t.recurring_expense_id) && dateRangeMode !== 'all' ? (
                  <div className="mt-3 max-w-md mx-auto p-4 rounded-2xl bg-indigo-50/80 border border-indigo-100 text-indigo-950 text-xs shadow-2xs">
                    <p className="font-bold flex items-center justify-center gap-1.5 text-indigo-800">
                      <Repeat className="w-4 h-4 text-indigo-600" />
                      Existem {transactions.filter((t) => t.recurring_expense_id).length} lançamentos recorrentes cadastrados em outros períodos.
                    </p>
                    <p className="text-[11px] text-slate-600 mt-1">
                      O filtro de período atual ({dateRangeMode === 'current_month' ? 'Mês Atual' : dateRangeMode}) está ocultando registros com vencimento em outros meses.
                    </p>
                    <div className="mt-3 flex items-center justify-center gap-2">
                      <button
                        onClick={() => setDateRangeMode('all')}
                        className="px-3.5 py-1.5 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 shadow-xs cursor-pointer"
                      >
                        Ver em Todo o Período
                      </button>
                      <button
                        onClick={() => setDateRangeMode('next_month')}
                        className="px-3.5 py-1.5 rounded-xl bg-white border border-indigo-200 text-indigo-800 font-bold text-xs hover:bg-indigo-50 cursor-pointer"
                      >
                        Ver no Próximo Mês
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                    Ajuste os filtros de busca ou cadastre novas receitas e despesas para alimentar o extrato.
                  </p>
                )}

                <div className="mt-4 flex items-center justify-center gap-2">
                  <button
                    onClick={() => handleOpenNewTransaction('income')}
                    className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors shadow-xs cursor-pointer"
                  >
                    + Nova Receita
                  </button>
                  <button
                    onClick={() => handleOpenNewTransaction('expense')}
                    className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition-colors shadow-xs cursor-pointer"
                  >
                    + Nova Despesa
                  </button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/70 border-b border-slate-200/80 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4">Descrição / Categoria</th>
                      <th className="py-3.5 px-4">Projeto / Parceiro</th>
                      <th className="py-3.5 px-4">Vencimento</th>
                      <th className="py-3.5 px-4">Forma</th>
                      <th className="py-3.5 px-4 text-right">Valor</th>
                      <th className="py-3.5 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredTransactions.map((tx) => {
                      const isIncome = tx.type === 'income'
                      const isPaid = tx.status === 'paid'
                      const catDef = FINANCIAL_CATEGORIES.find((c) => c.id === tx.category)

                      return (
                        <tr
                          key={tx.id}
                          className="hover:bg-slate-50/70 transition-colors group"
                        >
                          {/* Status Toggle */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <button
                              onClick={() => handleToggleStatus(tx)}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                                isPaid
                                  ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                  : tx.status === 'overdue'
                                  ? 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                                  : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                              }`}
                              title="Clique para alternar entre Pago e Pendente"
                            >
                              {isPaid ? (
                                <>
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>Pago</span>
                                </>
                              ) : (
                                <>
                                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                                  <span>Pendente</span>
                                </>
                              )}
                            </button>
                          </td>

                          {/* Title & Category & Recurrence Badge */}
                          <td className="py-3.5 px-4 max-w-xs">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-slate-800 truncate group-hover:text-blue-600">
                                {tx.title}
                              </span>
                              {tx.recurring_expense_id && (
                                <span
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200/80 shrink-0 shadow-2xs"
                                  title="Lançamento gerado automaticamente por regra recorrente"
                                >
                                  <Repeat className="w-3 h-3 text-indigo-600" /> Recorrente
                                </span>
                              )}
                            </div>
                            <span className="inline-block mt-0.5 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-600">
                              {catDef?.label || tx.category}
                            </span>
                          </td>

                          {/* Project & Company */}
                          <td className="py-3.5 px-4 max-w-xs">
                            {tx.projects ? (
                              <Link
                                href={`/app/projetos/${tx.projects.id}/financeiro`}
                                className="font-bold text-blue-600 hover:underline block truncate"
                              >
                                [{tx.projects.code}] {tx.projects.title}
                              </Link>
                            ) : (
                              <span className="text-slate-400 font-medium text-[11px]">
                                Geral do Escritório
                              </span>
                            )}

                            {tx.companies && (
                              <span className="text-[10px] text-slate-500 block truncate mt-0.5">
                                Parceiro: {tx.companies.name}
                              </span>
                            )}
                          </td>

                          {/* Due Date & Payment Date */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className="font-bold text-slate-700 block">
                              {formatDateBR(tx.due_date)}
                            </span>
                            {isPaid && tx.payment_date && (
                              <span className="text-[10px] text-emerald-600 font-medium block">
                                Pago em: {formatDateBR(tx.payment_date)}
                              </span>
                            )}
                          </td>

                          {/* Payment Method */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className="text-[11px] font-semibold text-slate-600">
                              {tx.payment_method || '-'}
                            </span>
                          </td>

                          {/* Amount */}
                          <td className="py-3.5 px-4 whitespace-nowrap text-right">
                            <span
                              className={`text-sm font-mono font-extrabold ${
                                isIncome ? 'text-emerald-600' : 'text-rose-600'
                              }`}
                            >
                              {isIncome ? '+' : '-'} {formatBRL(tx.amount)}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 whitespace-nowrap text-right">
                            <button
                              onClick={() => handleOpenEditTransaction(tx)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                              title="Editar Lançamento"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 3: LUCRATIVIDADE POR PROJETO */}
      {/* ========================================================================= */}
      {activeTab === 'projetos' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-blue-900 to-indigo-900 rounded-3xl p-6 text-white shadow-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-blue-200 uppercase tracking-wider">
                  Inteligência de Projetos
                </span>
                <h2 className="text-xl font-extrabold mt-0.5">
                  Lucro Realizado e Margem Líquida por Obra
                </h2>
                <p className="text-xs text-blue-100/80 mt-1 max-w-xl">
                  Calculamos o faturamento real (Honorários + Comissões RT recebidas) deduzindo todos os gastos
                  específicos como visitas, brindes, aluguel de sala de reunião e plotagens.
                </p>
              </div>

              <div className="flex items-center gap-6 bg-white/10 backdrop-blur-md px-5 py-3.5 rounded-2xl border border-white/10 shrink-0">
                <div>
                  <span className="text-[10px] text-blue-200 font-bold block">Faturamento Realizado</span>
                  <span className="text-lg font-mono font-extrabold">
                    {formatBRL(profitability.reduce((acc, p) => acc + p.totalRevenue, 0))}
                  </span>
                </div>
                {profitability.some((p) => (p.pendingCommissions || 0) > 0) && (
                  <div className="border-l border-white/20 pl-5">
                    <span className="text-[10px] text-amber-200 font-bold block">RT a Receber</span>
                    <span className="text-sm font-mono font-bold text-amber-200">
                      {formatBRL(profitability.reduce((acc, p) => acc + (p.pendingCommissions || 0), 0))}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Profitability Table */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-200/80 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3.5 px-4">Projeto / Cliente</th>
                    <th className="py-3.5 px-4 text-right">Honorários</th>
                    <th className="py-3.5 px-4 text-right">Comissões RT</th>
                    <th className="py-3.5 px-4 text-right">Faturamento Total</th>
                    <th className="py-3.5 px-4 text-right">Custos Diretos</th>
                    <th className="py-3.5 px-4 text-right">Lucro Líquido</th>
                    <th className="py-3.5 px-4 text-center">Margem %</th>
                    <th className="py-3.5 px-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {profitability.map((p) => (
                    <tr key={p.projectId} className="hover:bg-slate-50/70 transition-colors">
                      {/* Project & Client */}
                      <td className="py-3.5 px-4">
                        <Link
                          href={`/app/projetos/${p.projectId}/financeiro`}
                          className="font-bold text-slate-900 hover:text-blue-600 block"
                        >
                          [{p.projectCode}] {p.projectTitle}
                        </Link>
                        <span className="text-[11px] text-slate-500 block">{p.clientName}</span>
                      </td>

                      {/* Direct Contract Income */}
                      <td className="py-3.5 px-4 text-right font-mono font-semibold text-slate-700">
                        {formatBRL(p.directContractIncome)}
                      </td>

                      {/* Commissions RT */}
                      <td className="py-3.5 px-4 text-right font-mono font-semibold text-blue-600">
                        <div>{formatBRL(p.commissionsIncome)}</div>
                        {p.pendingCommissions !== undefined && p.pendingCommissions > 0 ? (
                          <span className="text-[10px] text-amber-600 font-normal block mt-0.5">
                            + {formatBRL(p.pendingCommissions)} a receber
                          </span>
                        ) : null}
                      </td>

                      {/* Total Revenue */}
                      <td className="py-3.5 px-4 text-right font-mono font-extrabold text-emerald-600">
                        <div>{formatBRL(p.totalRevenue)}</div>
                        {p.pendingRevenue > 0 ? (
                          <span className="text-[10px] text-slate-400 font-normal block mt-0.5">
                            + {formatBRL(p.pendingRevenue)} prev.
                          </span>
                        ) : null}
                      </td>

                      {/* Expenses Total */}
                      <td className="py-3.5 px-4 text-right font-mono font-semibold text-rose-600">
                        {formatBRL(p.expensesTotal)}
                      </td>

                      {/* Net Profit */}
                      <td className="py-3.5 px-4 text-right font-mono font-extrabold">
                        <span
                          className={`px-2 py-1 rounded-lg ${
                            p.netProfit >= 0
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-rose-50 text-rose-700'
                          }`}
                        >
                          {formatBRL(p.netProfit)}
                        </span>
                      </td>

                      {/* Margem % */}
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-block font-bold text-[11px] px-2 py-0.5 rounded-full ${
                            p.profitMarginPercent >= 50
                              ? 'bg-emerald-100 text-emerald-800'
                              : p.profitMarginPercent > 0
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {p.profitMarginPercent.toFixed(1)}%
                        </span>
                      </td>

                      {/* Ação */}
                      <td className="py-3.5 px-4 text-center">
                        <Link
                          href={`/app/projetos/${p.projectId}/financeiro`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs transition-colors"
                        >
                          Detalhes <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 4: PASSADO, PRESENTE E FUTURO (PROJEÇÃO DE FLUXO DE CAIXA) */}
      {/* ========================================================================= */}
      {activeTab === 'projecao' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-2">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              Linha do Tempo: Histórico e Projeção Futura
            </h2>
            <p className="text-xs text-slate-500">
              Acompanhe o fechamento real dos meses passados, a posição do mês corrente e a projeção
              automática dos próximos meses considerando parcelas agendadas, receitas recorrentes e custos fixos estruturais.
            </p>
          </div>

          {/* Timeline Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {projection.map((item) => (
              <div
                key={item.monthKey}
                className={`p-5 rounded-3xl border transition-all flex flex-col justify-between ${
                  item.isCurrent
                    ? 'bg-blue-50/50 border-blue-300 ring-2 ring-blue-500/20 shadow-md'
                    : item.isPast
                    ? 'bg-white border-slate-200/80 opacity-90'
                    : 'bg-white border-slate-200/80 shadow-xs'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold font-mono text-slate-900">{item.monthLabel}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        item.isCurrent
                          ? 'bg-blue-600 text-white'
                          : item.isPast
                          ? 'bg-slate-100 text-slate-600'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {item.isCurrent ? '📍 Mês Atual' : item.isPast ? 'Histórico Fechado' : '🔮 Projeção'}
                    </span>
                  </div>

                  {/* Numbers Breakdown */}
                  <div className="mt-4 space-y-2 text-xs">
                    <div className="flex items-center justify-between text-slate-600">
                      <span>Receitas Previstas:</span>
                      <span className="font-bold text-emerald-600 font-mono">
                        {formatBRL(item.projectedIncome)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-slate-600">
                      <span>Despesas Estimadas:</span>
                      <span className="font-bold text-rose-600 font-mono">
                        {formatBRL(item.projectedExpense)}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between font-bold">
                      <span className="text-slate-700">Resultado do Mês:</span>
                      <span
                        className={`font-mono ${
                          item.projectedBalance >= 0 ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {formatBRL(item.projectedBalance)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Accumulated Balance */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-medium">Saldo Acumulado:</span>
                  <span
                    className={`font-mono font-extrabold ${
                      item.accumulatedBalance >= 0 ? 'text-slate-900' : 'text-rose-600'
                    }`}
                  >
                    {formatBRL(item.accumulatedBalance)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal de Lançamentos */}
      <TransactionModal
        isOpen={isTxModalOpen}
        onClose={() => setIsTxModalOpen(false)}
        onSuccess={handleTxSuccess}
        organizationId={organizationId}
        projects={projects}
        companies={companies}
        initialTransaction={selectedTx}
        defaultType={modalDefaultType}
      />
    </div>
  )
}

