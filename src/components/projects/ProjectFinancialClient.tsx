'use client'

import { useState, useTransition, useMemo } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  CircleDollarSign,
  TrendingUp,
  TrendingDown,
  Plus,
  Edit2,
  Trash2,
  ExternalLink,
  CheckCircle2,
  Clock,
  Briefcase,
  Gift,
  Car,
  Layers,
  MapPin,
  Building,
  Printer,
  Sparkles,
  PieChart,
  FileText
} from 'lucide-react'
import {
  FinancialTransaction,
  FinancialSummary,
  ProjectProfitabilityItem,
  FINANCIAL_CATEGORIES,
  TransactionType,
  TransactionStatus
} from '@/types/financial'
import {
  toggleTransactionStatusAction,
  getFinancialTransactionsAction,
  getFinancialSummaryAction
} from '@/lib/actions/financial'
import TransactionModal from '@/components/financial/TransactionModal'
import BackButton from '@/components/ui/BackButton'

interface ProjectFinancialClientProps {
  project: {
    id: string
    code: string
    title: string
    client_name: string
    organization_id: string
    typology?: string | null
    area_sqm?: number | null
    estimated_budget?: number | null
  }
  initialTransactions: FinancialTransaction[]
  initialProfitability?: ProjectProfitabilityItem | null
  companies: { id: string; name: string; trade_name?: string | null }[]
  projectCompaniesSummary?: {
    totalContractValue: number
    totalExpectedCommission: number
    totalReceivedCommission: number
    totalPendingCommission: number
  } | null
}

export default function ProjectFinancialClient({
  project,
  initialTransactions,
  initialProfitability,
  companies,
  projectCompaniesSummary
}: ProjectFinancialClientProps) {
  const [transactions, setTransactions] = useState<FinancialTransaction[]>(initialTransactions)
  const [isTxModalOpen, setIsTxModalOpen] = useState(false)
  const [selectedTx, setSelectedTx] = useState<FinancialTransaction | null>(null)
  const [modalDefaultType, setModalDefaultType] = useState<TransactionType>('expense')
  const [isPending, startTransition] = useTransition()

  const formatBRL = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(val || 0)
  }

  const formatDateBR = (dateStr?: string | null) => {
    if (!dateStr) return '-'
    const parts = dateStr.split('T')[0].split('-')
    if (parts.length !== 3) return dateStr
    return `${parts[2]}/${parts[1]}/${parts[0]}`
  }

  // Cálculos dinâmicos com base nas transações do projeto
  const stats = useMemo(() => {
    let directRevenue = 0
    let commissionsRevenue = 0
    let pendingIncome = 0
    let expensesTotal = 0
    let pendingExpense = 0

    const breakdown = {
      visitas: 0,
      brindes: 0,
      locacao: 0,
      plotagens: 0,
      maquetes: 0,
      taxas: 0,
      outros: 0
    }

    transactions.forEach((tx) => {
      const amt = Number(tx.amount || 0)
      const isPaid = tx.status === 'paid'

      if (tx.type === 'income') {
        if (isPaid) {
          if (tx.category === 'comissao_rt') {
            commissionsRevenue += amt
          } else {
            directRevenue += amt
          }
        } else {
          pendingIncome += amt
        }
      } else if (tx.type === 'expense') {
        if (isPaid) {
          expensesTotal += amt
          if (tx.category === 'visitas_deslocamento') breakdown.visitas += amt
          else if (tx.category === 'brindes_mimos') breakdown.brindes += amt
          else if (tx.category === 'locacao_espaco') breakdown.locacao += amt
          else if (tx.category === 'impressao_plotagem') breakdown.plotagens += amt
          else if (tx.category === 'maquete_render') breakdown.maquetes += amt
          else if (tx.category === 'taxas_art_rrt') breakdown.taxas += amt
          else breakdown.outros += amt
        } else {
          pendingExpense += amt
        }
      }
    })

    // Adiciona comissões registradas no módulo de empresas/parceiros do projeto
    if (projectCompaniesSummary) {
      const receivedFromCompanies = Number(projectCompaniesSummary.totalReceivedCommission || 0)
      const pendingFromCompanies = Number(projectCompaniesSummary.totalPendingCommission || 0)

      if (receivedFromCompanies > 0 && commissionsRevenue === 0) {
        commissionsRevenue += receivedFromCompanies
      }
      if (pendingFromCompanies > 0) {
        pendingIncome += pendingFromCompanies
      }
    } else if (initialProfitability) {
      if (initialProfitability.commissionsIncome > commissionsRevenue) {
        commissionsRevenue = initialProfitability.commissionsIncome
      }
      if (initialProfitability.pendingRevenue > 0) {
        pendingIncome += initialProfitability.pendingRevenue
      }
    }

    const totalRevenue = directRevenue + commissionsRevenue
    const netProfit = totalRevenue - expensesTotal
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0

    return {
      directRevenue,
      commissionsRevenue,
      pendingIncome,
      totalRevenue,
      expensesTotal,
      pendingExpense,
      netProfit,
      profitMargin,
      breakdown
    }
  }, [transactions, initialProfitability, projectCompaniesSummary])

  const handleOpenModal = (type: TransactionType) => {
    setSelectedTx(null)
    setModalDefaultType(type)
    setIsTxModalOpen(true)
  }

  const handleOpenEdit = (tx: FinancialTransaction) => {
    setSelectedTx(tx)
    setIsTxModalOpen(true)
  }

  const handleTxSuccess = (savedTx: FinancialTransaction, isDeleted?: boolean) => {
    if (isDeleted) {
      setTransactions(transactions.filter((t) => t.id !== savedTx.id))
    } else {
      const exists = transactions.some((t) => t.id === savedTx.id)
      if (exists) {
        setTransactions(transactions.map((t) => (t.id === savedTx.id ? savedTx : t)))
      } else {
        setTransactions([savedTx, ...transactions])
      }
    }
  }

  const handleToggleStatus = async (tx: FinancialTransaction) => {
    const newStatus: TransactionStatus = tx.status === 'paid' ? 'pending' : 'paid'

    // Otimista
    setTransactions(
      transactions.map((t) =>
        t.id === tx.id
          ? {
              ...t,
              status: newStatus,
              payment_date: newStatus === 'paid' ? new Date().toISOString().split('T')[0] : null
            }
          : t
      )
    )

    startTransition(async () => {
      await toggleTransactionStatusAction({
        id: tx.id,
        organizationId: project.organization_id,
        status: newStatus
      })
    })
  }

  return (
    <div className="space-y-6 antialiased">
      {/* Breadcrumbs & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <BackButton fallbackHref={`/app/projetos/${project.id}`} />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                Financeiro do Projeto: {project.title}
              </h1>
              <span className="px-2.5 py-0.5 text-xs font-mono font-bold bg-slate-100 text-slate-700 rounded-lg">
                {project.code}
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Cliente: <strong className="text-slate-700">{project.client_name}</strong> • Controle de entradas, comissões de parceiros e despesas alocadas
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href={`/app/projetos/${project.id}/fornecedores`}
            className="inline-flex items-center gap-1.5 py-2 px-3.5 rounded-xl bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50/50 text-xs font-bold transition-all shadow-xs"
          >
            <Briefcase className="w-3.5 h-3.5 text-indigo-600" />
            Comissões & Parceiros
          </Link>

          <button
            onClick={() => handleOpenModal('expense')}
            className="inline-flex items-center gap-1.5 py-2 px-3.5 rounded-xl bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
            + Nova Despesa
          </button>

          <button
            onClick={() => handleOpenModal('income')}
            className="inline-flex items-center gap-1.5 py-2 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs shadow-emerald-600/20 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            + Nova Receita
          </button>
        </div>
      </div>

      {/* Main KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Faturado */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total Faturado
            </span>
            <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-extrabold text-slate-900 tracking-tight">
              {formatBRL(stats.totalRevenue)}
            </span>
            <div className="text-[11px] text-slate-500 mt-1 font-medium">
              <span>Honorários: <strong>{formatBRL(stats.directRevenue)}</strong> • RT: <strong>{formatBRL(stats.commissionsRevenue)}</strong></span>
              {stats.pendingIncome > 0 && (
                <span className="block text-emerald-600 font-bold mt-0.5">
                  + {formatBRL(stats.pendingIncome)} a receber
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Custos Diretos */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Gastos do Projeto
            </span>
            <div className="w-9 h-9 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <TrendingDown className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-extrabold text-slate-900 tracking-tight">
              {formatBRL(stats.expensesTotal)}
            </span>
            <div className="text-[11px] text-slate-400 mt-1 font-medium">
              <span>Visitas, brindes, salas, plotagens e taxas</span>
              {stats.pendingExpense > 0 && (
                <span className="block text-rose-600 font-bold mt-0.5">
                  + {formatBRL(stats.pendingExpense)} a pagar
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Lucro Líquido Realizado */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Lucro Líquido
            </span>
            <div
              className={`w-9 h-9 rounded-2xl flex items-center justify-center ${
                stats.netProfit >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
              }`}
            >
              <CircleDollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span
              className={`text-2xl font-extrabold tracking-tight ${
                stats.netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'
              }`}
            >
              {formatBRL(stats.netProfit)}
            </span>
            <p className="text-[11px] text-slate-400 mt-1 font-medium">
              Faturamento líquido após despesas diretas
            </p>
          </div>
        </div>

        {/* Margem de Lucro (%) */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Margem de Lucro
            </span>
            <span
              className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                stats.profitMargin >= 50
                  ? 'bg-emerald-100 text-emerald-800'
                  : stats.profitMargin > 0
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-rose-100 text-rose-800'
              }`}
            >
              {stats.profitMargin.toFixed(1)}%
            </span>
          </div>
          <div className="mt-4">
            <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  stats.profitMargin >= 50 ? 'bg-emerald-500' : stats.profitMargin > 0 ? 'bg-blue-500' : 'bg-rose-500'
                }`}
                style={{ width: `${Math.max(0, Math.min(stats.profitMargin, 100))}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-2 font-medium">
              Eficiência operacional e rentabilidade
            </p>
          </div>
        </div>
      </div>

      {/* Custos por Categoria (Brindes, Visitas, Salas, Plotagens, Maquetes) */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
        <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <PieChart className="w-4 h-4 text-slate-500" />
          Detalhamento de Custos Diretos da Obra / Projeto
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Visitas */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-bold">
              <Car className="w-3.5 h-3.5 text-amber-500" />
              <span>Visitas & Deslocamento</span>
            </div>
            <span className="text-sm font-bold text-slate-900 block mt-2 font-mono">
              {formatBRL(stats.breakdown.visitas)}
            </span>
          </div>

          {/* Brindes */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-bold">
              <Gift className="w-3.5 h-3.5 text-pink-500" />
              <span>Brindes & Mimos</span>
            </div>
            <span className="text-sm font-bold text-slate-900 block mt-2 font-mono">
              {formatBRL(stats.breakdown.brindes)}
            </span>
          </div>

          {/* Locação de Sala */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-bold">
              <Building className="w-3.5 h-3.5 text-orange-500" />
              <span>Aluguel de Reunião</span>
            </div>
            <span className="text-sm font-bold text-slate-900 block mt-2 font-mono">
              {formatBRL(stats.breakdown.locacao)}
            </span>
          </div>

          {/* Plotagens & Impressões */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-bold">
              <Printer className="w-3.5 h-3.5 text-purple-500" />
              <span>Plotagens & Pranchas</span>
            </div>
            <span className="text-sm font-bold text-slate-900 block mt-2 font-mono">
              {formatBRL(stats.breakdown.plotagens)}
            </span>
          </div>

          {/* Maquetes & Renders */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-bold">
              <Sparkles className="w-3.5 h-3.5 text-rose-500" />
              <span>Render 3D / Maquetes</span>
            </div>
            <span className="text-sm font-bold text-slate-900 block mt-2 font-mono">
              {formatBRL(stats.breakdown.maquetes)}
            </span>
          </div>

          {/* Outros / Taxas */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-bold">
              <Layers className="w-3.5 h-3.5 text-slate-500" />
              <span>Taxas RRT & Outros</span>
            </div>
            <span className="text-sm font-bold text-slate-900 block mt-2 font-mono">
              {formatBRL(stats.breakdown.taxas + stats.breakdown.outros)}
            </span>
          </div>
        </div>
      </div>

      {/* Transactions Extrato do Projeto */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden space-y-4 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Extrato Financeiro do Projeto</h2>
            <p className="text-xs text-slate-500">Histórico de todas as entradas e saídas associadas a este contrato.</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleOpenModal('expense')}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
            >
              + Despesa
            </button>
            <button
              onClick={() => handleOpenModal('income')}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors shadow-xs cursor-pointer"
            >
              + Receita
            </button>
          </div>
        </div>

        {transactions.length === 0 ? (
          <div className="p-10 text-center text-slate-400 border border-dashed border-slate-200 rounded-2xl">
            <CircleDollarSign className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            <h3 className="text-xs font-bold text-slate-700">Nenhum lançamento vinculado ainda</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Adicione os honorários do contrato ou os gastos de visitas, reuniões e brindes.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-200/80 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Descrição</th>
                  <th className="py-3 px-3">Categoria</th>
                  <th className="py-3 px-3">Vencimento</th>
                  <th className="py-3 px-3">Forma</th>
                  <th className="py-3 px-3 text-right">Valor</th>
                  <th className="py-3 px-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.map((tx) => {
                  const isIncome = tx.type === 'income'
                  const isPaid = tx.status === 'paid'
                  const catDef = FINANCIAL_CATEGORIES.find((c) => c.id === tx.category)

                  return (
                    <tr key={tx.id} className="hover:bg-slate-50/70 transition-colors group">
                      {/* Status Toggle */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <button
                          onClick={() => handleToggleStatus(tx)}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg font-bold text-[10px] transition-all cursor-pointer ${
                            isPaid
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                              : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                          }`}
                        >
                          {isPaid ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Pago</span>
                            </>
                          ) : (
                            <>
                              <Clock className="w-3 h-3 text-amber-600" />
                              <span>Pendente</span>
                            </>
                          )}
                        </button>
                      </td>

                      {/* Title */}
                      <td className="py-3 px-3 font-bold text-slate-800">
                        {tx.title}
                        {tx.companies && (
                          <span className="text-[10px] text-slate-400 block font-normal">
                            Parceiro: {tx.companies.name}
                          </span>
                        )}
                      </td>

                      {/* Category */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-600">
                          {catDef?.label || tx.category}
                        </span>
                      </td>

                      {/* Due Date */}
                      <td className="py-3 px-3 whitespace-nowrap font-medium text-slate-600">
                        {formatDateBR(tx.due_date)}
                      </td>

                      {/* Payment Method */}
                      <td className="py-3 px-3 whitespace-nowrap text-slate-500 font-medium">
                        {tx.payment_method || '-'}
                      </td>

                      {/* Amount */}
                      <td className="py-3 px-3 whitespace-nowrap text-right font-mono font-extrabold">
                        <span className={isIncome ? 'text-emerald-600' : 'text-rose-600'}>
                          {isIncome ? '+' : '-'} {formatBRL(tx.amount)}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 whitespace-nowrap text-right">
                        <button
                          onClick={() => handleOpenEdit(tx)}
                          className="p-1 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
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

      {/* Transaction Modal */}
      <TransactionModal
        isOpen={isTxModalOpen}
        onClose={() => setIsTxModalOpen(false)}
        onSuccess={handleTxSuccess}
        organizationId={project.organization_id}
        projects={[
          {
            id: project.id,
            code: project.code,
            title: project.title,
            client_name: project.client_name
          }
        ]}
        companies={companies}
        initialTransaction={selectedTx}
        defaultProjectId={project.id}
        defaultType={modalDefaultType}
      />
    </div>
  )
}
