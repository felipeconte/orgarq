'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Building2,
  LogOut,
  Calendar,
  CheckCircle2,
  Clock,
  ArrowRight,
  Sparkles,
  Layers,
  FileCheck,
  AlertCircle,
  Phone,
  Mail,
  User,
  ShieldCheck,
  Building,
  UserCheck,
  Settings,
} from 'lucide-react'
import {
  ClientPortalDashboardData,
  ClientPortalProjectCard,
  clientPortalLogoutAction,
} from '@/lib/actions/client-portal-auth'
import { maskCPF } from '@/lib/formatters-and-validators'
import { formatDateBR } from '@/lib/date-utils'
import ClientProfileModal from '@/components/portal/ClientProfileModal'

export default function ClientPortalDashboard({
  data,
}: {
  data: ClientPortalDashboardData
}) {
  const router = useRouter()
  const [loggingOut, setLoggingOut] = useState(false)
  const [selectedOfficeFilter, setSelectedOfficeFilter] = useState<string>('all')
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)

  const { client, projects, officesCount } = data

  const handleLogout = async () => {
    setLoggingOut(true)
    await clientPortalLogoutAction()
    router.push('/portal/login')
    router.refresh()
  }

  // Extrai lista única de escritórios para filtro se houver múltiplos
  const distinctOffices = Array.from(
    new Map(projects.map((p) => [p.office.id, p.office])).values()
  )

  const filteredProjects =
    selectedOfficeFilter === 'all'
      ? projects
      : projects.filter((p) => p.office.id === selectedOfficeFilter)

  const pendingApprovalCount = projects.filter((p) => p.is_pending_client_approval).length

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 antialiased font-sans flex flex-col justify-between">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-6 py-3.5 shadow-2xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-500/20 text-white font-bold shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold tracking-tight text-slate-900">Orgarq</span>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                  Portal do Cliente
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block">
                Acompanhamento e Aprovação de Projetos
              </p>
            </div>
          </div>

          {/* User Info & Actions */}
          <div className="flex items-center gap-2.5">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5 justify-end">
                <User className="w-3.5 h-3.5 text-blue-600" />
                {client.name}
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                CPF: {maskCPF(client.cpf)}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsProfileModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-blue-200 bg-blue-50/70 hover:bg-blue-100 text-blue-700 text-xs font-bold transition-all cursor-pointer shadow-2xs"
              title="Meu Perfil e Dados Cadastrais"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Meu Perfil</span>
            </button>

            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:text-rose-600 text-xs font-semibold transition-all cursor-pointer shadow-2xs disabled:opacity-50"
              title="Sair da conta"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8 w-full flex-1">
        {/* Welcome Hero Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
          <div className="relative z-10 max-w-2xl space-y-2.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-blue-300 text-xs font-semibold border border-white/10">
              <Sparkles className="w-3.5 h-3.5" /> Painel de Acompanhamento
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Olá, {client.name.split(' ')[0]}!
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Aqui você tem visão completa do andamento das suas obras e projetos, com relatórios de entregas, arquivos para download e módulo de aprovação rápida.
            </p>
          </div>

          {/* Stat Badges */}
          <div className="relative z-10 mt-6 pt-6 border-t border-white/10 flex flex-wrap items-center gap-4 text-xs font-medium">
            <div className="bg-white/10 px-3.5 py-1.5 rounded-xl backdrop-blur-xs flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-400" />
              <span>
                <strong>{projects.length}</strong> {projects.length === 1 ? 'projeto vinculado' : 'projetos vinculados'}
              </span>
            </div>

            {distinctOffices.length > 1 && (
              <div className="bg-white/10 px-3.5 py-1.5 rounded-xl backdrop-blur-xs flex items-center gap-2">
                <Building className="w-4 h-4 text-indigo-400" />
                <span>
                  <strong>{distinctOffices.length}</strong> escritórios de arquitetura
                </span>
              </div>
            )}

            {pendingApprovalCount > 0 && (
              <div className="bg-amber-500/20 border border-amber-400/30 text-amber-300 px-3.5 py-1.5 rounded-xl flex items-center gap-2 animate-pulse">
                <FileCheck className="w-4 h-4 text-amber-400" />
                <span>
                  <strong>{pendingApprovalCount}</strong> etapa aguardando sua aprovação!
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Office Filter (if multiple offices) */}
        {distinctOffices.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            <span className="text-xs font-bold text-slate-500 mr-1">Filtrar por Escritório:</span>
            <button
              type="button"
              onClick={() => setSelectedOfficeFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                selectedOfficeFilter === 'all'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              Todos ({projects.length})
            </button>
            {distinctOffices.map((office) => {
              const count = projects.filter((p) => p.office.id === office.id).length
              return (
                <button
                  key={office.id}
                  type="button"
                  onClick={() => setSelectedOfficeFilter(office.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    selectedOfficeFilter === office.id
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Building className="w-3.5 h-3.5" />
                  {office.name} ({count})
                </button>
              )
            })}
          </div>
        )}

        {/* Projects Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600" />
              Seus Projetos em Andamento
            </h2>
            <span className="text-xs text-slate-400 font-medium">
              {filteredProjects.length} {filteredProjects.length === 1 ? 'projeto listado' : 'projetos listados'}
            </span>
          </div>

          {filteredProjects.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
              <Building2 className="w-10 h-10 text-slate-300 mx-auto" />
              <h3 className="text-sm font-bold text-slate-700">Nenhum projeto encontrado</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Você ainda não possui projetos vinculados a este CPF ou a este escritório. Entre em contato com seu arquiteto responsável.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProjects.map((project) => (
                <div
                  key={project.id}
                  className="bg-white rounded-2xl border border-slate-200/80 hover:border-blue-400 transition-all shadow-xs hover:shadow-md flex flex-col justify-between overflow-hidden group"
                >
                  {/* Top Bar: Office Information */}
                  <div className="p-4 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="h-7 w-7 rounded-lg bg-white border border-slate-200 shadow-2xs flex items-center justify-center font-bold text-blue-600 text-xs shrink-0">
                        {project.office.logo_url ? (
                          <img
                            src={project.office.logo_url}
                            alt={project.office.name}
                            className="h-full w-full object-cover rounded-lg"
                          />
                        ) : (
                          <Building className="w-3.5 h-3.5 text-blue-600" />
                        )}
                      </div>
                      <span className="text-xs font-bold text-slate-700 truncate" title={project.office.name}>
                        {project.office.name}
                      </span>
                    </div>

                    {project.is_pending_client_approval ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 shrink-0 animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                        Aprovação Pendente
                      </span>
                    ) : project.status === 'concluido' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Concluído
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
                        <Clock className="w-3 h-3 text-blue-600" />
                        Em Produção
                      </span>
                    )}
                  </div>

                  {/* Body Content */}
                  <div className="p-5 space-y-4 flex-1">
                    <div>
                      <span className="text-[11px] font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100 inline-block mb-1.5">
                        {project.code}
                      </span>
                      <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-2">
                        {project.title}
                      </h3>
                      {project.typology && (
                        <p className="text-xs text-slate-500 mt-0.5">{project.typology}</p>
                      )}
                    </div>

                    {/* Stage & Progress */}
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500 font-medium">Etapa Atual:</span>
                        <span className="font-bold text-slate-800 truncate max-w-[170px]" title={project.current_stage_name}>
                          {project.current_stage_name || 'Início'}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600">
                          <span>Progresso Geral</span>
                          <span>{project.progress_percent}%</span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-500 rounded-full ${
                              project.progress_percent === 100
                                ? 'bg-emerald-500'
                                : 'bg-gradient-to-r from-blue-500 to-indigo-600'
                            }`}
                            style={{ width: `${project.progress_percent}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Footer Action */}
                  <div className="p-4 bg-slate-50/50 border-t border-slate-100">
                    <Link
                      href={`/portal/projeto/${project.id}`}
                      className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all shadow-xs group-hover:shadow-blue-500/20"
                    >
                      Acessar Linha do Tempo e Aprovações
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200/80 py-6 px-6 text-center text-xs text-slate-400 mt-12">
        <p>Orgarq Architecture OS — Plataforma Segura de Gestão e Aprovação de Projetos</p>
      </footer>

      {/* Modal de Perfil e Dados Pessoais */}
      <ClientProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        onProfileUpdated={() => router.refresh()}
      />
    </div>
  )
}
