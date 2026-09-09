'use client'

import React, { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import {
  FolderGit2,
  Plus,
  ArrowRight,
  Compass,
  Clock,
  CircleDollarSign,
  Eye,
  EyeOff,
  AlertTriangle,
  CheckCircle2,
  Hourglass,
  Calendar,
  ExternalLink,
  Copy,
  Check,
  Search,
  Filter,
  Users,
  ChevronRight,
  TrendingUp,
  Sparkles,
  Layers,
  ArrowUpRight,
  Building2
} from 'lucide-react'
import { formatDateBR } from '@/lib/date-utils'
import ClientUpdateRequestsBanner from '@/components/clients/ClientUpdateRequestsBanner'

export interface DashboardStage {
  id: string
  name: string
  stage_order: number
  status: 'a_iniciar' | 'em_producao' | 'em_aprovacao' | 'concluido'
  progress_percent: number
  due_date: string | null
  is_client_approval_required: boolean
}

export interface DashboardProject {
  id: string
  code: string
  title: string
  client_name: string
  client_email?: string | null
  typology?: string | null
  status: 'ativo' | 'pausado' | 'concluido' | 'cancelado'
  area_sqm?: number | null
  deadline?: string | null
  created_at: string
  project_stages: DashboardStage[]
  portalToken?: string | null
}

export interface DashboardFinancialSummary {
  realizedIncome: number
  realizedExpense: number
  realizedBalance: number
  pendingIncome: number
  pendingExpense: number
  pendingBalance: number
  totalIncome: number
  totalExpense: number
  projectedBalance: number
  overdueExpense: number
  overdueIncome: number
  overdueCount: number
}

interface OverviewDashboardClientProps {
  officeName: string
  userDisplayName: string
  projects: DashboardProject[]
  financialSummary: DashboardFinancialSummary | null
  hasPrimaryOrg: boolean
}

export default function OverviewDashboardClient({
  officeName,
  userDisplayName,
  projects,
  financialSummary,
  hasPrimaryOrg,
}: OverviewDashboardClientProps) {
  // Estado de visibilidade dos valores financeiros (com persistência em localStorage)
  const [showFinancials, setShowFinancials] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('orgarq_dashboard_show_financials')
      return stored !== null ? stored === 'true' : true
    }
    return true
  })

  // Feedback de cópia do link do portal
  const [copiedProjectId, setCopiedProjectId] = useState<string | null>(null)

  // Filtro de status e busca de projetos
  const [filterTab, setFilterTab] = useState<'all' | 'in_progress' | 'awaiting_approval' | 'completed'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('orgarq_dashboard_show_financials', String(showFinancials))
    }
  }, [showFinancials])

  const toggleFinancials = () => {
    setShowFinancials((prev) => !prev)
  }

  const handleCopyPortalLink = (projectId: string, token?: string | null) => {
    if (!token) return
    const url = `${window.location.origin}/portal/${token}`
    navigator.clipboard.writeText(url)
    setCopiedProjectId(projectId)
    setTimeout(() => setCopiedProjectId(null), 2500)
  }

  // Formatador de moeda BRL
  const formatMoney = (value: number) => {
    if (!showFinancials) {
      return 'R$ ••••••'
    }
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value)
  }

  // Cálculos consolidados dos projetos
  const projectMetrics = useMemo(() => {
    const total = projects.length
    const active = projects.filter((p) => p.status === 'ativo' || !p.status).length
    const totalArea = projects.reduce((acc, p) => acc + (p.area_sqm || 0), 0)

    // Identifica etapas aguardando aprovação do cliente
    const stagesAwaitingApproval: Array<{
      projectId: string
      projectCode: string
      projectTitle: string
      clientName: string
      stageName: string
      stageId: string
      portalToken?: string | null
      dueDate?: string | null
    }> = []

    // Identifica prazos críticos (atrasados ou vencendo nos próximos 7 dias)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const in7Days = new Date(today)
    in7Days.setDate(in7Days.getDate() + 7)

    const criticalDeadlines: Array<{
      projectId: string
      projectCode: string
      projectTitle: string
      stageName: string
      dueDate: string
      isOverdue: boolean
      daysLeft: number
    }> = []

    projects.forEach((p) => {
      const stages = p.project_stages || []

      stages.forEach((s) => {
        if (s.status === 'em_aprovacao') {
          stagesAwaitingApproval.push({
            projectId: p.id,
            projectCode: p.code,
            projectTitle: p.title,
            clientName: p.client_name,
            stageName: s.name,
            stageId: s.id,
            portalToken: p.portalToken,
            dueDate: s.due_date,
          })
        }

        if (s.due_date && s.status !== 'concluido') {
          const due = new Date(s.due_date)
          // Normaliza dia
          due.setHours(0, 0, 0, 0)
          const diffTime = due.getTime() - today.getTime()
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

          if (diffDays < 0) {
            criticalDeadlines.push({
              projectId: p.id,
              projectCode: p.code,
              projectTitle: p.title,
              stageName: s.name,
              dueDate: s.due_date,
              isOverdue: true,
              daysLeft: diffDays,
            })
          } else if (diffDays <= 7) {
            criticalDeadlines.push({
              projectId: p.id,
              projectCode: p.code,
              projectTitle: p.title,
              stageName: s.name,
              dueDate: s.due_date,
              isOverdue: false,
              daysLeft: diffDays,
            })
          }
        }
      })
    })

    return {
      total,
      active,
      totalArea,
      stagesAwaitingApproval,
      criticalDeadlines,
    }
  }, [projects])

  // Filtragem dinâmica de projetos
  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      // Filtro de busca textual
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchesTitle = p.title?.toLowerCase().includes(q)
        const matchesCode = p.code?.toLowerCase().includes(q)
        const matchesClient = p.client_name?.toLowerCase().includes(q)
        const matchesTypology = p.typology?.toLowerCase().includes(q)
        if (!matchesTitle && !matchesCode && !matchesClient && !matchesTypology) {
          return false
        }
      }

      // Filtro de abas
      const stages = p.project_stages || []
      const hasStageInApproval = stages.some((s) => s.status === 'em_aprovacao')
      const allCompleted = stages.length > 0 && stages.every((s) => s.status === 'concluido')

      if (filterTab === 'awaiting_approval') {
        return hasStageInApproval
      }
      if (filterTab === 'completed') {
        return p.status === 'concluido' || allCompleted
      }
      if (filterTab === 'in_progress') {
        return (p.status === 'ativo' || !p.status) && !allCompleted
      }

      return true
    })
  }, [projects, filterTab, searchQuery])

  // Helper para dados calculados de cada projeto na tabela
  const getProjectStageInfo = (project: DashboardProject) => {
    const stages = [...(project.project_stages || [])].sort((a, b) => a.stage_order - b.stage_order)
    const totalStages = stages.length
    const completedStages = stages.filter((s) => s.status === 'concluido').length
    const hasStageInApproval = stages.some((s) => s.status === 'em_aprovacao')

    let percent = 0
    if (totalStages > 0) {
      percent = Math.round((completedStages / totalStages) * 100)
    }

    // Identifica a etapa atual em foco
    const currentStage = stages.find((s) => s.status !== 'concluido') || stages[stages.length - 1]
    const currentIndex = currentStage ? stages.findIndex((s) => s.id === currentStage.id) : 0

    return {
      totalStages,
      completedStages,
      percent,
      hasStageInApproval,
      currentStage,
      currentIndex,
    }
  }

  return (
    <div className="space-y-8 antialiased max-w-7xl mx-auto pb-12">
      {/* 1. Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/70 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Visão Geral
            </h1>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/70">
              {officeName}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Olá, <strong>{userDisplayName}</strong>. Acompanhe os projetos, aprovações de clientes e finanças em tempo real.
          </p>
        </div>
      </div>

      {/* 2. Banner de Solicitações Cadastrais de Clientes (se houver) */}
      <ClientUpdateRequestsBanner />

      {/* 3. Banner de Alertas Críticos (Aprovações Pendentes & Prazos) */}
      {(projectMetrics.stagesAwaitingApproval.length > 0 || projectMetrics.criticalDeadlines.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Card: Aprovações de Clientes Pendentes */}
          {projectMetrics.stagesAwaitingApproval.length > 0 && (
            <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200/90 shadow-xs flex flex-col justify-between gap-3">
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-2.5 w-2.5 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
                    </span>
                    <h3 className="text-xs font-extrabold text-amber-950 uppercase tracking-wider">
                      Aguardando Aprovação do Cliente ({projectMetrics.stagesAwaitingApproval.length})
                    </h3>
                  </div>
                  <span className="text-[11px] font-semibold text-amber-700">Ação requerida do cliente</span>
                </div>

                <div className="space-y-2 mt-2 max-h-48 overflow-y-auto pr-1">
                  {projectMetrics.stagesAwaitingApproval.slice(0, 3).map((item) => (
                    <div
                      key={item.stageId}
                      className="p-2.5 rounded-xl bg-white/90 border border-amber-200/60 flex items-center justify-between gap-3"
                    >
                      <div className="truncate">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 truncate">
                          <span className="font-mono text-slate-500 text-[11px]">[{item.projectCode}]</span>
                          <span className="truncate">{item.projectTitle}</span>
                        </div>
                        <p className="text-[11px] text-amber-800 truncate mt-0.5">
                          Etapa: <strong>{item.stageName}</strong> • Cliente: {item.clientName}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {item.portalToken && (
                          <button
                            onClick={() => handleCopyPortalLink(item.projectId, item.portalToken)}
                            title="Copiar Link do Portal do Cliente"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-amber-800 hover:bg-amber-100 transition-colors cursor-pointer"
                          >
                            {copiedProjectId === item.projectId ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                        <Link
                          href={`/app/projetos/${item.projectId}`}
                          className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 transition-colors inline-flex items-center gap-1 cursor-pointer"
                        >
                          Ver detalhes <ChevronRight className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>
                  ))}
                  {projectMetrics.stagesAwaitingApproval.length > 3 && (
                    <p className="text-[11px] text-amber-700 text-center font-medium pt-1">
                      + {projectMetrics.stagesAwaitingApproval.length - 3} outra(s) etapa(s) aguardando
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Card: Prazos Críticos / Entregas da Semana */}
          {projectMetrics.criticalDeadlines.length > 0 && (
            <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200/80 shadow-xs flex flex-col justify-between gap-3">
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <h3 className="text-xs font-extrabold text-rose-950 uppercase tracking-wider">
                      Atenção aos Prazos ({projectMetrics.criticalDeadlines.length})
                    </h3>
                  </div>
                  <span className="text-[11px] font-semibold text-rose-700">Entregas imediatas</span>
                </div>

                <div className="space-y-2 mt-2 max-h-48 overflow-y-auto pr-1">
                  {projectMetrics.criticalDeadlines.slice(0, 3).map((item, idx) => (
                    <div
                      key={`${item.projectId}-${idx}`}
                      className="p-2.5 rounded-xl bg-white/90 border border-rose-200/60 flex items-center justify-between gap-3"
                    >
                      <div className="truncate">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 truncate">
                          <span className="font-mono text-slate-500 text-[11px]">[{item.projectCode}]</span>
                          <span className="truncate">{item.projectTitle}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">
                          {item.stageName} • Prazo: {formatDateBR(item.dueDate)}
                        </p>
                      </div>

                      <div className="shrink-0">
                        {item.isOverdue ? (
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200">
                            Atrasado ({Math.abs(item.daysLeft)}d)
                          </span>
                        ) : item.daysLeft === 0 ? (
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                            Vence hoje!
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                            Em {item.daysLeft}d
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  {projectMetrics.criticalDeadlines.length > 3 && (
                    <p className="text-[11px] text-rose-700 text-center font-medium pt-1">
                      + {projectMetrics.criticalDeadlines.length - 3} outro(s) prazo(s) nesta semana
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. Cartões de KPIs Principais (ClickUp Clean) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Projetos Ativos */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-2 hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Projetos Ativos</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <FolderGit2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-slate-900 font-mono tracking-tight">
            {projectMetrics.active}
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
            <span>{projectMetrics.total} projetos no total</span>
            <Link href="/app/projetos" className="text-blue-600 hover:text-blue-700 font-bold inline-flex items-center">
              Ver lista <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* KPI 2: Área Projetada Total */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-2 hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Área projetada</span>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <Compass className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-slate-900 font-mono tracking-tight">
            {projectMetrics.totalArea > 0 ? `${projectMetrics.totalArea.toLocaleString('pt-BR')} m²` : '—'}
          </div>
          <p className="text-[11px] text-slate-500 pt-1">Somatório de metragem ativa</p>
        </div>

        {/* KPI 3: Aprovações Pendentes */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-2 hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Com os Clientes</span>
            <div className={`p-2 rounded-xl ${projectMetrics.stagesAwaitingApproval.length > 0 ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-500'}`}>
              <Hourglass className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-slate-900 font-mono tracking-tight flex items-center gap-2">
            {projectMetrics.stagesAwaitingApproval.length}
            {projectMetrics.stagesAwaitingApproval.length > 0 && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                Pendente
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 pt-1">
            {projectMetrics.stagesAwaitingApproval.length === 1 ? '1 etapa em análise externa' : `${projectMetrics.stagesAwaitingApproval.length} etapas em análise`}
          </p>
        </div>

        {/* KPI 4: Honorários Previstos / Mês */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-2 hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">A Receber no Mês</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono tracking-tight">
            {financialSummary ? formatMoney(financialSummary.pendingIncome) : 'R$ 0,00'}
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
            <span>Entradas a compensar</span>
            <button
              onClick={toggleFinancials}
              className="text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
              title={showFinancials ? 'Ocultar valores' : 'Mostrar valores'}
            >
              {showFinancials ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* 5. Widget de Resumo Financeiro com Toggle de Visibilidade (Opção A) */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
              <CircleDollarSign className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                Resumo do Fluxo Financeiro
                <button
                  onClick={toggleFinancials}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
                  title={showFinancials ? 'Ocultar valores da tela' : 'Mostrar valores'}
                >
                  {showFinancials ? (
                    <>
                      <EyeOff className="w-3 h-3" /> Ocultar
                    </>
                  ) : (
                    <>
                      <Eye className="w-3 h-3" /> Mostrar
                    </>
                  )}
                </button>
              </h2>
              <p className="text-xs text-slate-500">
                Honorários, faturamento e despesas operacionais do escritório.
              </p>
            </div>
          </div>

          <Link
            href="/app/financeiro"
            className="text-xs font-bold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1 group self-start sm:self-auto cursor-pointer"
          >
            Abrir Financeiro <ArrowUpRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
        </div>

        {financialSummary ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Receitas Realizadas */}
            <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/60 space-y-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Entradas Realizadas
              </span>
              <div className="text-lg font-black text-emerald-600 font-mono">
                {formatMoney(financialSummary.realizedIncome)}
              </div>
              <p className="text-[11px] text-slate-400">Recebidos no período</p>
            </div>

            {/* Honorários a Receber */}
            <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/60 space-y-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                A Receber (Honorários)
              </span>
              <div className="text-lg font-black text-blue-600 font-mono">
                {formatMoney(financialSummary.pendingIncome)}
              </div>
              <p className="text-[11px] text-slate-400">Parcelas futuras de clientes</p>
            </div>

            {/* Despesas a Pagar */}
            <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/60 space-y-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Contas a Pagar
              </span>
              <div className="text-lg font-black text-rose-600 font-mono">
                {formatMoney(financialSummary.pendingExpense)}
              </div>
              <p className="text-[11px] text-slate-400">Fornecedores e custos fixos</p>
            </div>

            {/* Saldo Líquido Realizado */}
            <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/60 space-y-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Saldo em Caixa
              </span>
              <div className={`text-lg font-black font-mono ${financialSummary.realizedBalance >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
                {formatMoney(financialSummary.realizedBalance)}
              </div>
              <p className="text-[11px] text-slate-400">Realizado até o momento</p>
            </div>
          </div>
        ) : (
          <div className="p-6 text-center text-slate-500 text-xs">
            Nenhum dado financeiro encontrado para esta organização.
          </div>
        )}

        {financialSummary && financialSummary.overdueCount > 0 && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200/70 flex items-center justify-between text-xs text-amber-900">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                Existem <strong>{financialSummary.overdueCount} lançamento(s) em atraso</strong> no valor de {formatMoney(financialSummary.overdueExpense + financialSummary.overdueIncome)}.
              </span>
            </div>
            <Link href="/app/financeiro" className="font-bold underline hover:text-amber-950 shrink-0">
              Verificar
            </Link>
          </div>
        )}
      </div>

      {/* 6. Tabela e Lista Rica de Projetos com Progresso e Status do Cliente (Opção A) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Header da Seção de Projetos */}
        <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              Projetos
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                {filteredProjects.length}
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Etapa ativa, progresso em percentual e status de aprovação de cada cliente.
            </p>
          </div>

          {/* Busca & Filtros Rápidos */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            {/* Input de Busca */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar projeto, código, cliente..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50/50"
              />
            </div>

            {/* Abas de Filtro */}
            <div className="flex items-center bg-slate-100/90 p-1 rounded-xl text-xs font-semibold text-slate-600">
              <button
                onClick={() => setFilterTab('all')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${filterTab === 'all'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'hover:text-slate-900'
                  }`}
              >
                Todos
              </button>
              <button
                onClick={() => setFilterTab('in_progress')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${filterTab === 'in_progress'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'hover:text-slate-900'
                  }`}
              >
                Em Andamento
              </button>
              <button
                onClick={() => setFilterTab('awaiting_approval')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${filterTab === 'awaiting_approval'
                  ? 'bg-white text-amber-900 shadow-xs font-bold'
                  : 'hover:text-slate-900'
                  }`}
              >
                Aguardando Cliente
                {projectMetrics.stagesAwaitingApproval.length > 0 && (
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                )}
              </button>
              <button
                onClick={() => setFilterTab('completed')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${filterTab === 'completed'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'hover:text-slate-900'
                  }`}
              >
                Concluídos
              </button>
            </div>
          </div>
        </div>

        {/* Listagem */}
        {filteredProjects.length === 0 ? (
          <div className="p-12 text-center space-y-4">
            <div className="h-12 w-12 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
              <FolderGit2 className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-800">
                {searchQuery || filterTab !== 'all'
                  ? 'Nenhum projeto encontrado com os filtros atuais'
                  : 'Nenhum projeto cadastrado ainda'}
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {searchQuery || filterTab !== 'all'
                  ? 'Tente ajustar os termos de busca ou mudar a aba selecionada.'
                  : 'Cadastre seu primeiro projeto para gerenciar etapas, prazos e portal do cliente de forma integrada.'}
              </p>
            </div>
            {!searchQuery && filterTab === 'all' && (
              <Link
                href="/app/projetos/novo"
                className="inline-flex items-center gap-1.5 py-2 px-4 rounded-xl bg-blue-600 text-white text-xs font-bold shadow-xs hover:bg-blue-700 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Cadastrar Primeiro Projeto
              </Link>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-100 overflow-x-auto">
            {filteredProjects.map((project) => {
              const info = getProjectStageInfo(project)

              return (
                <div
                  key={project.id}
                  className="p-4 hover:bg-slate-50/80 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  {/* Bloco 1: Identificação do Projeto */}
                  <div className="space-y-1 min-w-[280px] lg:max-w-[320px]">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono text-xs font-bold shrink-0">
                        {project.code}
                      </span>
                      <Link
                        href={`/app/projetos/${project.id}`}
                        className="text-sm font-extrabold text-slate-900 hover:text-blue-600 transition-colors cursor-pointer truncate"
                      >
                        {project.title}
                      </Link>
                    </div>

                    <p className="text-xs text-slate-500 truncate">
                      Cliente: <strong>{project.client_name}</strong> • {project.typology || 'Residencial'}
                      {project.area_sqm ? ` • ${project.area_sqm} m²` : ''}
                    </p>
                  </div>

                  {/* Bloco 2: Fase Atual & Barra de Progresso */}
                  <div className="space-y-1.5 min-w-[220px] lg:flex-1 max-w-sm">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700 truncate">
                        {info.currentStage ? info.currentStage.name : 'Sem etapas'}
                      </span>
                      <span className="font-mono text-[11px] font-bold text-slate-500">
                        {info.percent}%
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${info.hasStageInApproval
                          ? 'bg-amber-500'
                          : info.percent === 100
                            ? 'bg-emerald-500'
                            : 'bg-blue-600'
                          }`}
                        style={{ width: `${Math.max(info.percent, 4)}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span>
                        {info.completedStages} de {info.totalStages} etapas concluídas
                      </span>
                      {info.currentStage?.due_date && (
                        <span>Prazo: {formatDateBR(info.currentStage.due_date)}</span>
                      )}
                    </div>
                  </div>

                  {/* Bloco 3: Status com o Cliente */}
                  <div className="flex items-center gap-2 shrink-0">
                    {info.hasStageInApproval ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200/80 shadow-2xs">
                        <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                        Aguardando Cliente
                      </span>
                    ) : info.percent === 100 || project.status === 'concluido' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Concluído
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200/70">
                        <Layers className="w-3.5 h-3.5" /> Em Produção
                      </span>
                    )}
                  </div>

                  {/* Bloco 4: Ações Rápidas */}
                  <div className="flex items-center gap-2 shrink-0 justify-end">
                    {project.portalToken && (
                      <button
                        onClick={() => handleCopyPortalLink(project.id, project.portalToken)}
                        title="Copiar link do Portal do Cliente"
                        className="py-1.5 px-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200/70 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                      >
                        {copiedProjectId === project.id ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-700 text-[11px]">Copiado</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-slate-400" />
                            <span className="hidden sm:inline text-[11px]">Portal</span>
                          </>
                        )}
                      </button>
                    )}

                    <Link
                      href={`/app/projetos/${project.id}`}
                      className="py-1.5 px-3.5 rounded-xl bg-slate-100 hover:bg-blue-600 text-slate-700 hover:text-white text-xs font-bold transition-all shadow-2xs cursor-pointer inline-flex items-center gap-1"
                    >
                      Ver detalhes <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
