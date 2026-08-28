'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Building2,
  CheckCircle2,
  ShieldCheck,
  ListTodo,
  Kanban as KanbanIcon,
  CalendarRange,
  Sparkles,
  UserCheck,
  FileText,
  ArrowRight,
  Zap,
  Globe
} from 'lucide-react'

export default function Home() {
  const [activeView, setActiveView] = useState<'lista' | 'kanban' | 'gantt'>('lista')

  const stages = [
    { id: 1, name: '01. Contrato', status: 'concluido', responsavel: 'Beatriz L.', inicio: '01/08', fim: '05/08', progress: 100, duracao: '5 dias' },
    { id: 2, name: '02. Briefing', status: 'concluido', responsavel: 'Lucas M.', inicio: '06/08', fim: '12/08', progress: 100, duracao: '7 dias' },
    { id: 3, name: '03. Estudo Preliminar', status: 'concluido', responsavel: 'Carlos E.', inicio: '13/08', fim: '25/08', progress: 100, duracao: '13 dias' },
    { id: 4, name: '04. Projeto 3D', status: 'em_aprovacao', responsavel: 'Mariana S.', inicio: '01/09', fim: '15/09', progress: 85, duracao: '15 dias' },
    { id: 5, name: '05. Projeto Executivo', status: 'em_producao', responsavel: 'Carlos E.', inicio: '16/09', fim: '10/10', progress: 30, duracao: '25 dias' },
    { id: 6, name: '06. Entrega Final', status: 'a_iniciar', responsavel: 'Beatriz L.', inicio: '11/10', fim: '15/10', progress: 0, duracao: '5 dias' },
    { id: 7, name: '07. Suporte', status: 'a_iniciar', responsavel: 'Lucas M.', inicio: '16/10', fim: '31/10', progress: 0, duracao: '15 dias' },
  ]

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'concluido':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Aprovado
          </span>
        )
      case 'em_aprovacao':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/80">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span> Aguardando Cliente
          </span>
        )
      case 'em_producao':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/80">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> Em Andamento
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span> A Iniciar
          </span>
        )
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 antialiased font-sans flex flex-col justify-between">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-6 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-500/20 text-white font-bold">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold tracking-tight text-slate-900">Orgarq</span>
                <span className="text-[11px] font-semibold uppercase px-2 py-0.5 rounded-full bg-blue-100/70 text-blue-700 border border-blue-200">
                  Architecture OS
                </span>
              </div>
              <p className="text-xs text-slate-500">Gestão de Projetos e Portal de Aprovação de Clientes</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 hover:text-blue-600 hover:bg-slate-100 transition-all"
            >
              Entrar
            </Link>
            <Link
              href="/cadastro"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-all shadow-sm shadow-blue-500/25"
            >
              Criar Escritório <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-10 space-y-12 w-full">
        {/* Hero Section */}
        <section className="text-center max-w-3xl mx-auto space-y-4 pt-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200/80 text-blue-700 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>A plataforma oficial de produtividade para arquitetos</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
            Gestão técnica e aprovação de clientes com <span className="text-blue-600">precisão cirúrgica</span>.
          </h1>
          <p className="text-base text-slate-600 leading-relaxed">
            Elimine ruídos de comunicação, gerencie suas 10 etapas da arquitetura em <strong>Lista</strong>, <strong>Kanban</strong> e <strong>Gantt</strong>, e colete aprovações com auditoria no Portal do Cliente sem senha.
          </p>
        </section>

        {/* Interactive Preview Hub */}
        <section className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 text-xs font-mono font-bold bg-slate-100 text-slate-700 rounded-lg">ARQ-2026-01</span>
                  <h2 className="text-xl font-bold text-slate-900 tracking-tight">Residência Alphaville</h2>
                </div>
                <p className="text-sm text-slate-500">Cliente: <strong>Carlos Eduardo Mendes</strong> • Área: <strong>480 m²</strong> • Prazo Final: <strong>10/11/2026</strong></p>
              </div>

              {/* Overall Progress Meter */}
              <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div className="text-right">
                  <p className="text-xs text-slate-500 font-medium">Progresso Geral</p>
                  <p className="text-xl font-extrabold text-blue-600 font-mono">48%</p>
                </div>
                <div className="w-28 bg-slate-200 h-2.5 rounded-full overflow-hidden">
                  <div className="bg-gradient-to-r from-blue-500 to-indigo-600 h-full rounded-full w-[48%]" />
                </div>
              </div>
            </div>

            {/* Navigation Views Switcher (ClickUp Style) */}
            <div className="flex flex-wrap items-center justify-between pt-2 border-t border-slate-100 gap-3">
              <div className="inline-flex p-1 rounded-xl bg-slate-100/80 border border-slate-200/70">
                <button
                  onClick={() => setActiveView('lista')}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${activeView === 'lista'
                    ? 'bg-white text-blue-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                  <ListTodo className="w-4 h-4" />
                  Lista
                </button>
                <button
                  onClick={() => setActiveView('kanban')}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${activeView === 'kanban'
                    ? 'bg-white text-blue-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                  <KanbanIcon className="w-4 h-4" />
                  Kanban
                </button>
                <button
                  onClick={() => setActiveView('gantt')}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${activeView === 'gantt'
                    ? 'bg-white text-blue-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                  <CalendarRange className="w-4 h-4" />
                  Gantt / Timeline
                </button>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="flex items-center gap-1 font-medium bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200/60">
                  <FileText className="w-3.5 h-3.5 text-blue-600" /> 10 Etapas Padrão
                </span>
                <span className="flex items-center gap-1 font-medium bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200/60">
                  <UserCheck className="w-3.5 h-3.5 text-emerald-600" /> Portal do Cliente Ativo
                </span>
              </div>
            </div>
          </div>

          {/* View Dynamic Render */}
          {activeView === 'lista' && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <ListTodo className="w-4 h-4 text-blue-600" /> Cronograma de Etapas do Projeto
                </h3>
                <span className="text-xs text-slate-500 font-medium">10 Fases Mapeadas</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200/80 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3 px-4">#</th>
                      <th className="py-3 px-4">Nome da Etapa</th>
                      <th className="py-3 px-4">Responsável</th>
                      <th className="py-3 px-4">Início</th>
                      <th className="py-3 px-4">Fim</th>
                      <th className="py-3 px-4">Progresso</th>
                      <th className="py-3 px-4">Status de Aprovação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                    {stages.map((st) => (
                      <tr key={st.id} className="hover:bg-blue-50/40 transition-colors">
                        <td className="py-3 px-4 text-slate-400 font-mono text-xs">{st.id}</td>
                        <td className="py-3 px-4 font-bold text-slate-900 flex items-center gap-2">
                          {st.name}
                        </td>
                        <td className="py-3 px-4 text-slate-600">{st.responsavel}</td>
                        <td className="py-3 px-4 font-mono text-slate-500">{st.inicio}</td>
                        <td className="py-3 px-4 font-mono text-slate-500">{st.fim}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-slate-100 h-2 rounded-full overflow-hidden">
                              <div className="bg-blue-600 h-full rounded-full" style={{ width: `${st.progress}%` }} />
                            </div>
                            <span className="font-mono text-[11px] text-slate-500">{st.progress}%</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">{getStatusBadge(st.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeView === 'kanban' && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Coluna A Iniciar */}
              <div className="bg-slate-100/70 p-4 rounded-2xl border border-slate-200/70 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-slate-400" /> A Iniciar
                  </span>
                  <span className="text-[11px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded-full shadow-2xs">4</span>
                </div>
                <div className="space-y-2.5">
                  {stages.filter(s => s.status === 'a_iniciar').map(st => (
                    <div key={st.id} className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs space-y-2 hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-mono text-slate-400">#{st.id}</span>
                        <span className="text-[11px] font-mono text-slate-400">{st.duracao}</span>
                      </div>
                      <h4 className="text-xs font-bold text-slate-900">{st.name}</h4>
                      <p className="text-[11px] text-slate-500">Resp: {st.responsavel} • Previsão: {st.fim}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Coluna Em Andamento */}
              <div className="bg-blue-50/40 p-4 rounded-2xl border border-blue-100 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-blue-200">
                  <span className="text-xs font-bold text-blue-800 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-500" /> Em Andamento
                  </span>
                  <span className="text-[11px] font-bold text-blue-600 bg-white px-2 py-0.5 rounded-full shadow-2xs">1</span>
                </div>
                <div className="space-y-2.5">
                  {stages.filter(s => s.status === 'em_producao').map(st => (
                    <div key={st.id} className="bg-white p-3.5 rounded-xl border border-blue-200 shadow-xs space-y-2 hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-mono text-blue-600">#{st.id}</span>
                        <span className="text-[11px] font-mono text-blue-600">{st.progress}%</span>
                      </div>
                      <h4 className="text-xs font-bold text-slate-900">{st.name}</h4>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-blue-600 h-full rounded-full" style={{ width: `${st.progress}%` }} />
                      </div>
                      <p className="text-[11px] text-slate-500">Resp: {st.responsavel} • Entrega: {st.fim}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Coluna Em Aprovação do Cliente */}
              <div className="bg-amber-50/40 p-4 rounded-2xl border border-amber-100 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-amber-200">
                  <span className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" /> Em Aprovação
                  </span>
                  <span className="text-[11px] font-bold text-amber-600 bg-white px-2 py-0.5 rounded-full shadow-2xs">1</span>
                </div>
                <div className="space-y-2.5">
                  {stages.filter(s => s.status === 'em_aprovacao').map(st => (
                    <div key={st.id} className="bg-white p-3.5 rounded-xl border border-amber-200 shadow-xs space-y-2 hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-mono text-amber-600">#{st.id}</span>
                        <span className="text-[10px] font-bold text-amber-600 uppercase">Magic Link Enviado</span>
                      </div>
                      <h4 className="text-xs font-bold text-slate-900">{st.name}</h4>
                      <p className="text-[11px] text-slate-600">Cliente visualizou há 2h. Aguardando validação final.</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Coluna Aprovado */}
              <div className="bg-emerald-50/40 p-4 rounded-2xl border border-emerald-100 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-emerald-200">
                  <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" /> Aprovado (Auditado)
                  </span>
                  <span className="text-[11px] font-bold text-emerald-600 bg-white px-2 py-0.5 rounded-full shadow-2xs">4</span>
                </div>
                <div className="space-y-2.5">
                  {stages.filter(s => s.status === 'concluido').map(st => (
                    <div key={st.id} className="bg-white p-3.5 rounded-xl border border-emerald-200/80 shadow-xs space-y-2 hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-mono text-emerald-700">#{st.id}</span>
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      </div>
                      <h4 className="text-xs font-bold text-slate-900">{st.name}</h4>
                      <p className="text-[11px] text-emerald-600 font-medium">Aprovado pelo cliente via Portal</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeView === 'gantt' && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <CalendarRange className="w-4 h-4 text-blue-600" /> Linha do Tempo & Gantt das Etapas
                </h3>
                <span className="text-xs text-slate-500 font-medium">Agosto 2026 — Novembro 2026</span>
              </div>

              <div className="space-y-3">
                {stages.map((st, index) => {
                  const leftOffset = index * 9.5
                  const barWidth = 14 + (index % 3) * 4

                  return (
                    <div key={st.id} className="grid grid-cols-12 items-center gap-4 py-1.5 border-b border-slate-50 text-xs">
                      <div className="col-span-4 font-semibold text-slate-800 truncate">
                        {st.name}
                      </div>

                      <div className="col-span-8 relative h-7 bg-slate-50 rounded-lg p-1 flex items-center">
                        <div
                          className={`absolute h-5 rounded-md flex items-center px-2 text-[10px] font-bold text-white transition-all shadow-xs ${st.status === 'concluido'
                            ? 'bg-emerald-500'
                            : st.status === 'em_aprovacao'
                              ? 'bg-amber-500'
                              : st.status === 'em_producao'
                                ? 'bg-blue-600'
                                : 'bg-slate-300 text-slate-700'
                            }`}
                          style={{
                            left: `${leftOffset}%`,
                            width: `${barWidth}%`,
                          }}
                        >
                          <span className="truncate">{st.inicio} - {st.fim}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </section>

        {/* Security & Core Pillars */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-3">
            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 w-fit">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Segurança & RLS Blindado</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Políticas rigorosas de Row Level Security e guards anti-IDOR garantem isolamento absoluto entre escritórios e projetos.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-3">
            <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 w-fit">
              <Zap className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Regras no Servidor</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Transições de status, cálculos e validações executados exclusivamente no backend (Server Actions / RPCs), eliminando brechas no cliente.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-3">
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 w-fit">
              <Globe className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Portal do Cliente sem Senha</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Magic Link criptográfico de uso simples para o cliente aprovar pranchas com registro de IP, data e hora em segundos.
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200/80 py-8 px-6 mt-12">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-600" />
            <span className="font-bold text-slate-800">Orgarq SaaS</span> • Todos os direitos reservados.
          </div>
          <div className="flex items-center gap-6 font-medium">
            <Link href="/login" className="hover:text-blue-600">Login Escritório</Link>
            <Link href="/cadastro" className="hover:text-blue-600">Criar Conta</Link>
            <Link href="/sitemap.xml" className="hover:text-blue-600">Sitemap</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
