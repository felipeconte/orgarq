'use client'

import { useState } from 'react'
import {
  ListTodo,
  Kanban as KanbanIcon,
  CalendarRange,
  CheckCircle2,
  Clock,
  Send,
  Lock,
  Unlock,
  Share2,
  ExternalLink,
  Copy,
  Check
} from 'lucide-react'
import {
  updateStageStatusAction,
  requestClientApprovalAction,
  unlockStageForEditAction
} from '@/lib/actions/stages'

interface Stage {
  id: string
  name: string
  description: string | null
  stage_order: number
  status: 'a_iniciar' | 'em_producao' | 'em_aprovacao' | 'concluido'
  progress_percent: number
  tag: string
  start_date: string | null
  due_date: string | null
  is_client_approval_required: boolean
  is_locked_for_client: boolean
}

export default function ProjectHubClient({
  projectId,
  stages,
  portalToken,
}: {
  projectId: string
  stages: Stage[]
  portalToken: string
}) {
  const [activeView, setActiveView] = useState<'lista' | 'kanban' | 'gantt'>('lista')
  const [copied, setCopied] = useState(false)
  const [loadingStageId, setLoadingStageId] = useState<string | null>(null)

  const portalUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/portal/${portalToken}`
    : `/portal/${portalToken}`

  const handleCopyLink = () => {
    navigator.clipboard.writeText(portalUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const handleStatusChange = async (stageId: string, newStatus: Stage['status']) => {
    setLoadingStageId(stageId)
    await updateStageStatusAction(projectId, stageId, newStatus)
    setLoadingStageId(null)
  }

  const handleRequestApproval = async (stageId: string) => {
    setLoadingStageId(stageId)
    await requestClientApprovalAction(projectId, stageId)
    setLoadingStageId(null)
  }

  const handleUnlockStage = async (stageId: string) => {
    setLoadingStageId(stageId)
    await unlockStageForEditAction(projectId, stageId)
    setLoadingStageId(null)
  }

  return (
    <div className="space-y-6">
      {/* Portal do Cliente Magic Link Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
            <Share2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-900 block">
              Portal do Cliente (Magic Link Ativo)
            </span>
            <span className="text-[11px] text-slate-600 block">
              O cliente acessa sem senha e pode aprovar etapas com registro de auditoria.
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyLink}
            className="inline-flex items-center gap-1.5 py-2 px-3.5 rounded-xl bg-white border border-blue-200 hover:border-blue-300 text-blue-700 text-xs font-bold transition-all shadow-2xs"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" /> Link Copiado!
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" /> Copiar Link do Cliente
              </>
            )}
          </button>

          <a
            href={portalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs"
          >
            Abrir Portal <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* View Switcher (ClickUp Style Tabs) */}
      <div className="flex items-center justify-between">
        <div className="inline-flex p-1 rounded-xl bg-slate-100/90 border border-slate-200/80">
          <button
            onClick={() => setActiveView('lista')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeView === 'lista'
              ? 'bg-white text-blue-600 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            <ListTodo className="w-4 h-4" />
            Lista
          </button>

          <button
            onClick={() => setActiveView('kanban')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeView === 'kanban'
              ? 'bg-white text-blue-600 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            <KanbanIcon className="w-4 h-4" />
            Kanban
          </button>

          <button
            onClick={() => setActiveView('gantt')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeView === 'gantt'
              ? 'bg-white text-blue-600 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            <CalendarRange className="w-4 h-4" />
            Gantt / Timeline
          </button>
        </div>
      </div>

      {/* VIEW 1: LISTA */}
      {activeView === 'lista' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3.5 px-4 w-12 text-center">#</th>
                  <th className="py-3.5 px-4">Nome da Etapa</th>
                  <th className="py-3.5 px-4">Tag</th>
                  <th className="py-3.5 px-4">Datas</th>
                  <th className="py-3.5 px-4">Progresso</th>
                  <th className="py-3.5 px-4">Status de Aprovação</th>
                  <th className="py-3.5 px-4 text-right">Ações Rápidas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {stages.map((st) => (
                  <tr key={st.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="py-3.5 px-4 text-center font-mono text-slate-400 font-bold">
                      {st.stage_order}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                        {st.name}
                        {st.is_locked_for_client && (
                          <span className="p-1 rounded bg-slate-100 text-slate-500" title="Aprovado e bloqueado para o cliente">
                            <Lock className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                      {st.description && (
                        <p className="text-[11px] text-slate-500 mt-0.5">{st.description}</p>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px] font-semibold">
                        {st.tag}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">
                      {st.start_date ? `${st.start_date} até ${st.due_date || '?'}` : 'Datas não definidas'}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-20 bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${st.status === 'concluido' ? 'bg-emerald-500' : 'bg-blue-600'
                              }`}
                            style={{ width: `${st.progress_percent}%` }}
                          />
                        </div>
                        <span className="font-mono text-[11px] text-slate-500">{st.progress_percent}%</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      {st.status === 'concluido' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Aprovada
                        </span>
                      )}
                      {st.status === 'em_aprovacao' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
                          <Clock className="w-3.5 h-3.5" /> Aguardando Cliente
                        </span>
                      )}
                      {st.status === 'em_producao' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                          <Clock className="w-3.5 h-3.5" /> Em Andamento
                        </span>
                      )}
                      {st.status === 'a_iniciar' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                          A Iniciar
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {st.status !== 'em_aprovacao' && st.status !== 'concluido' && (
                          <button
                            disabled={loadingStageId === st.id}
                            onClick={() => handleRequestApproval(st.id)}
                            className="inline-flex items-center gap-1 py-1.5 px-3 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-all shadow-2xs"
                          >
                            <Send className="w-3 h-3" /> Pedir Aprovação
                          </button>
                        )}

                        {st.status === 'concluido' && (
                          <button
                            disabled={loadingStageId === st.id}
                            onClick={() => handleUnlockStage(st.id)}
                            className="inline-flex items-center gap-1 py-1.5 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all"
                            title="Reabrir fase para novos ajustes"
                          >
                            <Unlock className="w-3 h-3" /> Reabrir
                          </button>
                        )}

                        {st.status === 'a_iniciar' && (
                          <button
                            disabled={loadingStageId === st.id}
                            onClick={() => handleStatusChange(st.id, 'em_producao')}
                            className="py-1.5 px-2.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold transition-all"
                          >
                            Iniciar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 2: KANBAN */}
      {activeView === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Coluna 1: A Iniciar */}
          <div className="bg-slate-100/80 p-4 rounded-2xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-slate-400" /> A Iniciar
              </span>
              <span className="text-[11px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded-full shadow-2xs">
                {stages.filter((s) => s.status === 'a_iniciar').length}
              </span>
            </div>

            <div className="space-y-2.5">
              {stages.filter((s) => s.status === 'a_iniciar').map((st) => (
                <div key={st.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600">{st.tag}</span>
                    <span className="text-[11px] font-mono text-slate-400">#{st.stage_order}</span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900">{st.name}</h4>
                  <button
                    onClick={() => handleStatusChange(st.id, 'em_producao')}
                    className="w-full mt-2 py-1.5 px-3 rounded-lg bg-blue-50 text-blue-700 text-xs font-bold hover:bg-blue-100 transition-all"
                  >
                    Mover para Andamento
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Coluna 2: Em Andamento */}
          <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-blue-200">
              <span className="text-xs font-bold text-blue-800 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-500" /> Em Andamento
              </span>
              <span className="text-[11px] font-bold text-blue-600 bg-white px-2 py-0.5 rounded-full shadow-2xs">
                {stages.filter((s) => s.status === 'em_producao').length}
              </span>
            </div>

            <div className="space-y-2.5">
              {stages.filter((s) => s.status === 'em_producao').map((st) => (
                <div key={st.id} className="bg-white p-4 rounded-xl border border-blue-200 shadow-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700">{st.tag}</span>
                    <span className="text-[11px] font-mono text-blue-600 font-bold">{st.progress_percent}%</span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900">{st.name}</h4>
                  <button
                    onClick={() => handleRequestApproval(st.id)}
                    className="w-full mt-2 py-1.5 px-3 rounded-lg bg-amber-500 text-white text-xs font-bold hover:bg-amber-600 transition-all flex items-center justify-center gap-1"
                  >
                    <Send className="w-3 h-3" /> Solicitar Aprovação
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Coluna 3: Em Aprovação do Cliente */}
          <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-100 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-amber-200">
              <span className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" /> Em Aprovação
              </span>
              <span className="text-[11px] font-bold text-amber-600 bg-white px-2 py-0.5 rounded-full shadow-2xs">
                {stages.filter((s) => s.status === 'em_aprovacao').length}
              </span>
            </div>

            <div className="space-y-2.5">
              {stages.filter((s) => s.status === 'em_aprovacao').map((st) => (
                <div key={st.id} className="bg-white p-4 rounded-xl border border-amber-200 shadow-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-700">{st.tag}</span>
                    <span className="text-[10px] font-bold text-amber-600">Aguardando</span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900">{st.name}</h4>
                  <p className="text-[11px] text-slate-500">Notificação enviada ao cliente.</p>
                  <button
                    onClick={() => handleStatusChange(st.id, 'concluido')}
                    className="w-full mt-2 py-1.5 px-3 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-all flex items-center justify-center gap-1"
                  >
                    <Check className="w-3 h-3" /> Aprovar Manualmente
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Coluna 4: Aprovado */}
          <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-emerald-200">
              <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> Aprovado (Auditado)
              </span>
              <span className="text-[11px] font-bold text-emerald-600 bg-white px-2 py-0.5 rounded-full shadow-2xs">
                {stages.filter((s) => s.status === 'concluido').length}
              </span>
            </div>

            <div className="space-y-2.5">
              {stages.filter((s) => s.status === 'concluido').map((st) => (
                <div key={st.id} className="bg-white p-4 rounded-xl border border-emerald-200 shadow-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700">{st.tag}</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  </div>
                  <h4 className="text-xs font-bold text-slate-900">{st.name}</h4>
                  <button
                    onClick={() => handleUnlockStage(st.id)}
                    className="w-full mt-1 py-1 px-2 rounded-lg bg-slate-100 text-slate-600 text-[11px] font-bold hover:bg-slate-200 transition-all flex items-center justify-center gap-1"
                  >
                    <Unlock className="w-3 h-3" /> Reabrir Fase
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* VIEW 3: GANTT */}
      {activeView === 'gantt' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <CalendarRange className="w-4 h-4 text-blue-600" /> Linha do Tempo das 10 Etapas
            </h3>
            <span className="text-xs text-slate-500 font-medium font-mono">Duração Proporcional</span>
          </div>

          <div className="space-y-3">
            {stages.map((st, index) => {
              const leftOffset = index * 9.5
              const barWidth = 14 + (index % 3) * 3

              return (
                <div key={st.id} className="grid grid-cols-12 items-center gap-4 py-2 border-b border-slate-50 text-xs">
                  <div className="col-span-4 font-semibold text-slate-800 truncate flex items-center gap-2">
                    <span className="font-mono text-slate-400">#{st.stage_order}</span>
                    <span className="truncate">{st.name}</span>
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
                      <span className="truncate">{st.tag}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
