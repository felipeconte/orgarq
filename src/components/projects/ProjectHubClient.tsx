'use client'

import { useState } from 'react'
import {
  ListTodo,
  Kanban as KanbanIcon,
  CalendarRange,
  CheckCircle2,
  Lock,
  Unlock,
  Send,
  ExternalLink,
  Copy,
  Check,
  User,
  Paperclip,
  MessageSquare,
  Sparkles,
  Plus,
  Trash2,
  Loader2,
  X,
  Calendar
} from 'lucide-react'
import {
  updateStageStatusAction,
  requestClientApprovalAction,
  unlockStageForEditAction,
  createStageAction,
  deleteStageAction
} from '@/lib/actions/stages'
import TaskDetailDrawer, {
  TaskDetailData,
  MemberOption
} from '@/components/projects/TaskDetailDrawer'

export interface ProjectHubClientProps {
  projectId: string
  stages: TaskDetailData[]
  portalToken: string
  members?: MemberOption[]
}

export default function ProjectHubClient({
  projectId,
  stages: initialStages,
  portalToken,
  members = [],
}: ProjectHubClientProps) {
  const [stages, setStages] = useState<TaskDetailData[]>(initialStages)
  const [activeView, setActiveView] = useState<'lista' | 'kanban' | 'gantt'>('lista')
  const [copied, setCopied] = useState(false)
  const [loadingStageId, setLoadingStageId] = useState<string | null>(null)

  // Estado do Drawer de Tarefa
  const [selectedTask, setSelectedTask] = useState<TaskDetailData | null>(null)

  // Estado de Criação de Tarefa
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [creatingTask, setCreatingTask] = useState(false)
  const [newTaskData, setNewTaskData] = useState<{
    name: string
    description: string
    assigned_to: string
    start_date: string
    due_date: string
    status: TaskDetailData['status']
    is_client_approval_required: boolean
  }>({
    name: '',
    description: '',
    assigned_to: '',
    start_date: '',
    due_date: '',
    status: 'a_iniciar',
    is_client_approval_required: true,
  })

  // Drag and drop states
  const [draggingStageId, setDraggingStageId] = useState<string | null>(null)
  const [activeDropCol, setActiveDropCol] = useState<string | null>(null)

  const portalUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/portal/${portalToken}`
    : `/portal/${portalToken}`

  const handleCopyLink = () => {
    navigator.clipboard.writeText(portalUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const handleStatusChange = async (stageId: string, newStatus: TaskDetailData['status']) => {
    // Atualização otimista
    setStages((prev) =>
      prev.map((s) => (s.id === stageId ? { ...s, status: newStatus } : s))
    )
    setLoadingStageId(stageId)
    await updateStageStatusAction(projectId, stageId, newStatus)
    setLoadingStageId(null)
  }

  const handleRequestApproval = async (stageId: string) => {
    setStages((prev) =>
      prev.map((s) => (s.id === stageId ? { ...s, status: 'em_aprovacao' } : s))
    )
    setLoadingStageId(stageId)
    await requestClientApprovalAction(projectId, stageId)
    setLoadingStageId(null)
  }

  const handleUnlockStage = async (stageId: string) => {
    setStages((prev) =>
      prev.map((s) => (s.id === stageId ? { ...s, status: 'em_producao' } : s))
    )
    setLoadingStageId(stageId)
    await unlockStageForEditAction(projectId, stageId)
    setLoadingStageId(null)
  }

  const handleStageUpdatedFromDrawer = (updated: TaskDetailData) => {
    setStages((prev) =>
      prev.map((s) => (s.id === updated.id ? { ...s, ...updated } : s))
    )
    setSelectedTask(updated)
  }

  // Exclusão de Tarefa
  const handleDeleteStage = async (stageId: string, stageName?: string) => {
    const name = stageName || stages.find((s) => s.id === stageId)?.name || 'esta tarefa'
    if (confirm(`Tem certeza que deseja excluir permanentemente a tarefa "${name}"?`)) {
      setLoadingStageId(stageId)
      const res = await deleteStageAction(projectId, stageId)
      setLoadingStageId(null)
      if (res.success) {
        setStages((prev) => prev.filter((s) => s.id !== stageId))
        if (selectedTask?.id === stageId) {
          setSelectedTask(null)
        }
      } else {
        alert(res.error || 'Erro ao excluir tarefa.')
      }
    }
  }

  // Abertura do Modal de Criação
  const handleOpenCreateModal = (initialStatus: TaskDetailData['status'] = 'a_iniciar') => {
    setNewTaskData({
      name: '',
      description: '',
      assigned_to: '',
      start_date: '',
      due_date: '',
      status: initialStatus,
      is_client_approval_required: true,
    })
    setIsCreateModalOpen(true)
  }

  const handleCreateTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTaskData.name.trim()) return
    setCreatingTask(true)

    const res = await createStageAction(projectId, {
      name: newTaskData.name.trim(),
      description: newTaskData.description.trim() || null,
      assigned_to: newTaskData.assigned_to || null,
      start_date: newTaskData.start_date || null,
      due_date: newTaskData.due_date || null,
      status: newTaskData.status,
      is_client_approval_required: newTaskData.is_client_approval_required,
    })

    setCreatingTask(false)

    if (res.success && res.stage) {
      const created = res.stage as TaskDetailData
      setStages((prev) => [...prev, created])
      setIsCreateModalOpen(false)
      setSelectedTask(created) // Abre o drawer da nova tarefa imediatamente
    } else {
      alert(res.error || 'Erro ao criar nova tarefa.')
    }
  }

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, stageId: string) => {
    e.dataTransfer.setData('text/plain', stageId)
    setDraggingStageId(stageId)
  }

  const handleDragOver = (e: React.DragEvent, colStatus: string) => {
    e.preventDefault()
    if (activeDropCol !== colStatus) {
      setActiveDropCol(colStatus)
    }
  }

  const handleDragLeave = () => {
    setActiveDropCol(null)
  }

  const handleDrop = async (e: React.DragEvent, targetStatus: TaskDetailData['status']) => {
    e.preventDefault()
    setActiveDropCol(null)
    const stageId = e.dataTransfer.getData('text/plain') || draggingStageId
    if (!stageId) return

    const currentStage = stages.find((s) => s.id === stageId)
    if (currentStage && currentStage.status !== targetStatus) {
      await handleStatusChange(stageId, targetStatus)
    }
    setDraggingStageId(null)
  }

  const getStatusBadge = (status: TaskDetailData['status']) => {
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
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> Em Produção
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
    <div className="space-y-6 antialiased">
      {/* Portal Bar Banner */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 p-4 rounded-2xl text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-0.5">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-200 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" /> Portal do Cliente (Magic Link)
          </span>
          <p className="text-sm font-semibold text-white">
            O cliente acessa este link sem senha para aprovar pranchas e acompanhar o cronograma.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyLink}
            className="inline-flex items-center gap-1.5 py-2 px-3.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold transition-all border border-white/20 cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-300" /> Link Copiado!
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" /> Copiar Magic Link
              </>
            )}
          </button>

          <a
            href={portalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 py-2 px-3.5 rounded-xl bg-white text-blue-600 hover:bg-blue-50 text-xs font-extrabold transition-all shadow-xs cursor-pointer"
          >
            Visualizar Portal <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Navigation Views Switcher + Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex p-1 rounded-xl bg-slate-100 border border-slate-200">
          <button
            onClick={() => setActiveView('lista')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeView === 'lista'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ListTodo className="w-4 h-4" />
            Lista
          </button>
          <button
            onClick={() => setActiveView('kanban')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeView === 'kanban'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <KanbanIcon className="w-4 h-4" />
            Kanban (Drag & Drop)
          </button>
          <button
            onClick={() => setActiveView('gantt')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeView === 'gantt'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CalendarRange className="w-4 h-4" />
            Gantt / Linha do Tempo
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden md:flex text-xs text-slate-500 font-medium items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" /> Clique na tarefa para ver detalhes
          </span>

          <button
            onClick={() => handleOpenCreateModal()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-sm cursor-pointer hover:shadow-md"
          >
            <Plus className="w-4 h-4" /> Nova Tarefa
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
                  <th className="py-3.5 px-4">Nome da Tarefa</th>
                  <th className="py-3.5 px-4">Responsável</th>
                  <th className="py-3.5 px-4">Datas</th>
                  <th className="py-3.5 px-4">Checklist / Anexos</th>
                  <th className="py-3.5 px-4">Status de Aprovação</th>
                  <th className="py-3.5 px-4 text-right">Ações Rápidas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {stages.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-400">
                      <p className="text-sm font-semibold text-slate-600">Nenhuma tarefa neste projeto.</p>
                      <p className="text-xs text-slate-400 mt-1">Clique em &quot;Nova Tarefa&quot; acima para adicionar a primeira etapa.</p>
                    </td>
                  </tr>
                )}

                {stages.map((st) => {
                  const checklistCount = Array.isArray(st.checklist) ? st.checklist.length : 0
                  const commentsCount = Array.isArray(st.comments) ? st.comments.length : 0
                  const attachmentsCount = Array.isArray(st.attachments) ? st.attachments.length : 0
                  const assignedMember = members.find((m) => m.id === st.assigned_to)

                  return (
                    <tr
                      key={st.id}
                      onClick={() => setSelectedTask(st)}
                      className="hover:bg-blue-50/40 transition-colors cursor-pointer group"
                    >
                      <td className="py-3.5 px-4 text-center font-mono text-slate-400 font-bold">
                        {st.stage_order}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 text-sm flex items-center gap-2 group-hover:text-blue-600 transition-colors">
                          {st.name}
                          {st.is_locked_for_client && (
                            <span className="p-1 rounded bg-slate-100 text-slate-500" title="Aprovado e bloqueado para o cliente">
                              <Lock className="w-3 h-3" />
                            </span>
                          )}
                        </div>
                        {st.description && (
                          <p className="text-[11px] text-slate-500 mt-0.5 truncate max-w-xs">{st.description}</p>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-slate-600">
                        {assignedMember ? (
                          <span className="inline-flex items-center gap-1.5 font-semibold text-slate-800">
                            {assignedMember.avatarUrl ? (
                              <img
                                src={assignedMember.avatarUrl}
                                alt={assignedMember.name}
                                className="w-5 h-5 rounded-full object-cover border border-slate-200"
                              />
                            ) : (
                              <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold text-[10px] flex items-center justify-center">
                                {assignedMember.name.slice(0, 1).toUpperCase()}
                              </div>
                            )}
                            <span className="truncate max-w-[150px]">{assignedMember.name}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Não atribuído</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">
                        {st.start_date ? `${st.start_date} até ${st.due_date || '?'}` : 'Datas não definidas'}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3 text-slate-400 text-xs">
                          {checklistCount > 0 && (
                            <span className="flex items-center gap-1 text-slate-600">
                              <ListTodo className="w-3.5 h-3.5 text-blue-500" /> {checklistCount}
                            </span>
                          )}
                          {attachmentsCount > 0 && (
                            <span className="flex items-center gap-1 text-slate-600">
                              <Paperclip className="w-3.5 h-3.5 text-indigo-500" /> {attachmentsCount}
                            </span>
                          )}
                          {commentsCount > 0 && (
                            <span className="flex items-center gap-1 text-slate-600">
                              <MessageSquare className="w-3.5 h-3.5 text-emerald-500" /> {commentsCount}
                            </span>
                          )}
                          {checklistCount === 0 && attachmentsCount === 0 && commentsCount === 0 && (
                            <span className="text-slate-300">-</span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">{getStatusBadge(st.status)}</td>

                      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {st.status === 'a_iniciar' && (
                            <button
                              disabled={loadingStageId === st.id}
                              onClick={() => handleStatusChange(st.id, 'em_producao')}
                              className="py-1 px-2.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                            >
                              Iniciar
                            </button>
                          )}

                          {st.status === 'em_producao' && (
                            <button
                              disabled={loadingStageId === st.id}
                              onClick={() => handleRequestApproval(st.id)}
                              className="py-1 px-2.5 rounded-lg bg-amber-500 text-white hover:bg-amber-600 text-xs font-bold transition-all shadow-xs flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                            >
                              <Send className="w-3 h-3" /> Pedir Aprovação
                            </button>
                          )}

                          {st.status === 'em_aprovacao' && (
                            <button
                              disabled={loadingStageId === st.id}
                              onClick={() => handleStatusChange(st.id, 'concluido')}
                              className="py-1 px-2.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-bold transition-all shadow-xs flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                            >
                              <Check className="w-3 h-3" /> Aprovar
                            </button>
                          )}

                          {st.status === 'concluido' && (
                            <button
                              disabled={loadingStageId === st.id}
                              onClick={() => handleUnlockStage(st.id)}
                              className="py-1 px-2.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 text-xs font-bold transition-all flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                            >
                              <Unlock className="w-3 h-3" /> Reabrir
                            </button>
                          )}

                          {/* Delete Task Button */}
                          <button
                            type="button"
                            disabled={loadingStageId === st.id}
                            onClick={() => handleDeleteStage(st.id, st.name)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100 cursor-pointer ml-1"
                            title="Excluir tarefa"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}

                {/* Quick Add Row at Bottom */}
                <tr>
                  <td colSpan={7} className="p-3 bg-slate-50/50 hover:bg-blue-50/30 transition-colors text-center border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => handleOpenCreateModal()}
                      className="inline-flex items-center gap-2 py-1 px-4 text-xs font-bold text-blue-600 hover:text-blue-700 rounded-xl hover:bg-blue-100/50 transition-all cursor-pointer"
                    >
                      <Plus className="w-4 h-4" /> Adicionar Nova Tarefa à Lista
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 2: KANBAN COM DRAG & DROP */}
      {activeView === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Coluna 1: A Iniciar */}
          <div
            onDragOver={(e) => handleDragOver(e, 'a_iniciar')}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, 'a_iniciar')}
            className={`p-4 rounded-2xl border transition-all flex flex-col justify-between space-y-3 ${
              activeDropCol === 'a_iniciar'
                ? 'bg-blue-50/90 border-blue-400 ring-2 ring-blue-500/20'
                : 'bg-slate-100/70 border-slate-200'
            }`}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-slate-400" /> A Iniciar
                </span>
                <span className="text-[11px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded-full shadow-2xs">
                  {stages.filter((s) => s.status === 'a_iniciar').length}
                </span>
              </div>

              <div className="space-y-2.5 min-h-[140px]">
                {stages.filter((s) => s.status === 'a_iniciar').map((st) => {
                  const assignedMember = members.find((m) => m.id === st.assigned_to)
                  return (
                    <div
                      key={st.id}
                      draggable={true}
                      onDragStart={(e) => handleDragStart(e, st.id)}
                      onClick={() => setSelectedTask(st)}
                      className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2.5 hover:shadow-md hover:border-blue-300 transition-all cursor-grab active:cursor-grabbing group relative"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-mono font-bold text-slate-500">#{st.stage_order}</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteStage(st.id, st.name)
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                            title="Excluir tarefa"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <h4 className="text-xs font-bold text-slate-900 leading-snug">{st.name}</h4>
                      {st.description && <p className="text-[11px] text-slate-500 line-clamp-2">{st.description}</p>}

                      {assignedMember && (
                        <div className="flex items-center gap-1.5 pt-1.5 border-t border-slate-100 text-[11px] font-semibold text-slate-700">
                          {assignedMember.avatarUrl ? (
                            <img
                              src={assignedMember.avatarUrl}
                              alt={assignedMember.name}
                              className="w-4 h-4 rounded-full object-cover border border-slate-200"
                            />
                          ) : (
                            <div className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 font-bold text-[9px] flex items-center justify-center">
                              {assignedMember.name.slice(0, 1).toUpperCase()}
                            </div>
                          )}
                          <span className="truncate">{assignedMember.name}</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleOpenCreateModal('a_iniciar')}
              className="w-full py-2 px-3 rounded-xl border border-dashed border-slate-300 text-slate-500 hover:text-blue-600 hover:border-blue-400 hover:bg-blue-50/50 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer mt-2"
            >
              <Plus className="w-3.5 h-3.5" /> Adicionar Tarefa
            </button>
          </div>

          {/* Coluna 2: Em Produção */}
          <div
            onDragOver={(e) => handleDragOver(e, 'em_producao')}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, 'em_producao')}
            className={`p-4 rounded-2xl border transition-all flex flex-col justify-between space-y-3 ${
              activeDropCol === 'em_producao'
                ? 'bg-blue-50/90 border-blue-400 ring-2 ring-blue-500/20'
                : 'bg-slate-100/70 border-slate-200'
            }`}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="text-xs font-bold text-blue-700 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500" /> Em Produção
                </span>
                <span className="text-[11px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full shadow-2xs">
                  {stages.filter((s) => s.status === 'em_producao').length}
                </span>
              </div>

              <div className="space-y-2.5 min-h-[140px]">
                {stages.filter((s) => s.status === 'em_producao').map((st) => {
                  const assignedMember = members.find((m) => m.id === st.assigned_to)
                  return (
                    <div
                      key={st.id}
                      draggable={true}
                      onDragStart={(e) => handleDragStart(e, st.id)}
                      onClick={() => setSelectedTask(st)}
                      className="bg-white p-4 rounded-xl border border-blue-200/80 shadow-xs space-y-2.5 hover:shadow-md hover:border-blue-400 transition-all cursor-grab active:cursor-grabbing group relative"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-mono font-bold text-blue-600">#{st.stage_order}</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteStage(st.id, st.name)
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                            title="Excluir tarefa"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <h4 className="text-xs font-bold text-slate-900 leading-snug">{st.name}</h4>
                      {st.description && <p className="text-[11px] text-slate-500 line-clamp-2">{st.description}</p>}

                      {assignedMember && (
                        <div className="flex items-center gap-1.5 pt-1.5 border-t border-slate-100 text-[11px] font-semibold text-slate-700">
                          {assignedMember.avatarUrl ? (
                            <img
                              src={assignedMember.avatarUrl}
                              alt={assignedMember.name}
                              className="w-4 h-4 rounded-full object-cover border border-slate-200"
                            />
                          ) : (
                            <div className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 font-bold text-[9px] flex items-center justify-center">
                              {assignedMember.name.slice(0, 1).toUpperCase()}
                            </div>
                          )}
                          <span className="truncate">{assignedMember.name}</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleOpenCreateModal('em_producao')}
              className="w-full py-2 px-3 rounded-xl border border-dashed border-slate-300 text-slate-500 hover:text-blue-600 hover:border-blue-400 hover:bg-blue-50/50 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer mt-2"
            >
              <Plus className="w-3.5 h-3.5" /> Adicionar Tarefa
            </button>
          </div>

          {/* Coluna 3: Em Aprovação */}
          <div
            onDragOver={(e) => handleDragOver(e, 'em_aprovacao')}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, 'em_aprovacao')}
            className={`p-4 rounded-2xl border transition-all flex flex-col justify-between space-y-3 ${
              activeDropCol === 'em_aprovacao'
                ? 'bg-amber-50/90 border-amber-400 ring-2 ring-amber-500/20'
                : 'bg-slate-100/70 border-slate-200'
            }`}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="text-xs font-bold text-amber-700 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" /> Em Aprovação
                </span>
                <span className="text-[11px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full shadow-2xs">
                  {stages.filter((s) => s.status === 'em_aprovacao').length}
                </span>
              </div>

              <div className="space-y-2.5 min-h-[140px]">
                {stages.filter((s) => s.status === 'em_aprovacao').map((st) => {
                  const assignedMember = members.find((m) => m.id === st.assigned_to)
                  return (
                    <div
                      key={st.id}
                      draggable={true}
                      onDragStart={(e) => handleDragStart(e, st.id)}
                      onClick={() => setSelectedTask(st)}
                      className="bg-white p-4 rounded-xl border border-amber-200 shadow-xs space-y-2.5 hover:shadow-md hover:border-amber-400 transition-all cursor-grab active:cursor-grabbing group relative"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-mono font-bold text-amber-700">#{st.stage_order}</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteStage(st.id, st.name)
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                            title="Excluir tarefa"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <h4 className="text-xs font-bold text-slate-900 leading-snug">{st.name}</h4>
                      <p className="text-[11px] text-amber-700 font-medium">No portal do cliente</p>

                      {assignedMember && (
                        <div className="flex items-center gap-1.5 pt-1.5 border-t border-slate-100 text-[11px] font-semibold text-slate-700">
                          {assignedMember.avatarUrl ? (
                            <img
                              src={assignedMember.avatarUrl}
                              alt={assignedMember.name}
                              className="w-4 h-4 rounded-full object-cover border border-slate-200"
                            />
                          ) : (
                            <div className="w-4 h-4 rounded-full bg-amber-100 text-amber-700 font-bold text-[9px] flex items-center justify-center">
                              {assignedMember.name.slice(0, 1).toUpperCase()}
                            </div>
                          )}
                          <span className="truncate">{assignedMember.name}</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleOpenCreateModal('em_aprovacao')}
              className="w-full py-2 px-3 rounded-xl border border-dashed border-slate-300 text-slate-500 hover:text-blue-600 hover:border-blue-400 hover:bg-blue-50/50 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer mt-2"
            >
              <Plus className="w-3.5 h-3.5" /> Adicionar Tarefa
            </button>
          </div>

          {/* Coluna 4: Concluído */}
          <div
            onDragOver={(e) => handleDragOver(e, 'concluido')}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, 'concluido')}
            className={`p-4 rounded-2xl border transition-all flex flex-col justify-between space-y-3 ${
              activeDropCol === 'concluido'
                ? 'bg-emerald-50/90 border-emerald-400 ring-2 ring-emerald-500/20'
                : 'bg-slate-100/70 border-slate-200'
            }`}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="text-xs font-bold text-emerald-700 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" /> Aprovado / Concluído
                </span>
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full shadow-2xs">
                  {stages.filter((s) => s.status === 'concluido').length}
                </span>
              </div>

              <div className="space-y-2.5 min-h-[140px]">
                {stages.filter((s) => s.status === 'concluido').map((st) => {
                  const assignedMember = members.find((m) => m.id === st.assigned_to)
                  return (
                    <div
                      key={st.id}
                      draggable={true}
                      onDragStart={(e) => handleDragStart(e, st.id)}
                      onClick={() => setSelectedTask(st)}
                      className="bg-white p-4 rounded-xl border border-emerald-200 shadow-xs space-y-2.5 hover:shadow-md hover:border-emerald-400 transition-all cursor-grab active:cursor-grabbing group relative"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-mono font-bold text-emerald-700">#{st.stage_order}</span>
                        <div className="flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteStage(st.id, st.name)
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                            title="Excluir tarefa"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <h4 className="text-xs font-bold text-slate-900 leading-snug">{st.name}</h4>
                      <p className="text-[11px] text-emerald-600 font-medium">Aprovado pelo cliente via Portal</p>

                      {assignedMember && (
                        <div className="flex items-center gap-1.5 pt-1.5 border-t border-slate-100 text-[11px] font-semibold text-slate-700">
                          {assignedMember.avatarUrl ? (
                            <img
                              src={assignedMember.avatarUrl}
                              alt={assignedMember.name}
                              className="w-4 h-4 rounded-full object-cover border border-slate-200"
                            />
                          ) : (
                            <div className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 font-bold text-[9px] flex items-center justify-center">
                              {assignedMember.name.slice(0, 1).toUpperCase()}
                            </div>
                          )}
                          <span className="truncate">{assignedMember.name}</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleOpenCreateModal('concluido')}
              className="w-full py-2 px-3 rounded-xl border border-dashed border-slate-300 text-slate-500 hover:text-blue-600 hover:border-blue-400 hover:bg-blue-50/50 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer mt-2"
            >
              <Plus className="w-3.5 h-3.5" /> Adicionar Tarefa
            </button>
          </div>
        </div>
      )}

      {/* VIEW 3: GANTT */}
      {activeView === 'gantt' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <CalendarRange className="w-4 h-4 text-blue-600" /> Linha do Tempo das Tarefas
            </h3>
            <span className="text-xs text-slate-500 font-medium font-mono">Duração Proporcional</span>
          </div>

          <div className="space-y-3">
            {stages.map((st, index) => {
              const leftOffset = index * 9.5
              const barWidth = 14 + (index % 3) * 3

              return (
                <div
                  key={st.id}
                  onClick={() => setSelectedTask(st)}
                  className="grid grid-cols-12 items-center gap-4 py-2 border-b border-slate-50 text-xs hover:bg-slate-50/80 rounded-xl px-2 transition-colors cursor-pointer group"
                >
                  <div className="col-span-4 font-semibold text-slate-800 truncate flex items-center gap-2">
                    <span className="font-mono text-slate-400">#{st.stage_order}</span>
                    <span className="truncate group-hover:text-blue-600 transition-colors">{st.name}</span>
                  </div>

                  <div className="col-span-8 relative h-7 bg-slate-50 rounded-lg p-1 flex items-center">
                    <div
                      className={`absolute h-5 rounded-md flex items-center px-2 text-[10px] font-bold text-white transition-all shadow-xs ${
                        st.status === 'concluido'
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
                      <span className="truncate">{st.name}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* MODAL DE CRIAÇÃO DE NOVA TAREFA */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center p-4">
          <div
            onClick={() => !creatingTask && setIsCreateModalOpen(false)}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity animate-in fade-in"
          />

          <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-5 z-10 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Nova Tarefa / Etapa</h3>
                  <p className="text-[11px] text-slate-500">Adicione uma tarefa avulsa a este projeto</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                disabled={creatingTask}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTaskSubmit} className="space-y-4">
              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                  Título da Tarefa *
                </label>
                <input
                  type="text"
                  required
                  value={newTaskData.name}
                  onChange={(e) => setNewTaskData({ ...newTaskData, name: e.target.value })}
                  placeholder="Ex: Estudo Preliminar, Render 3D, Detalhamento..."
                  className="w-full text-xs font-semibold border border-slate-200 rounded-xl p-3 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50/50 hover:bg-white transition-all"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                  Escopo e Instruções (Opcional)
                </label>
                <textarea
                  rows={2}
                  value={newTaskData.description}
                  onChange={(e) => setNewTaskData({ ...newTaskData, description: e.target.value })}
                  placeholder="Detalhes ou diretrizes operacionais para a equipe..."
                  className="w-full text-xs border border-slate-200 rounded-xl p-3 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50/50 hover:bg-white transition-all resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                    Responsável
                  </label>
                  <div className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2 bg-slate-50/50 focus-within:bg-white focus-within:border-blue-500">
                    <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <select
                      value={newTaskData.assigned_to}
                      onChange={(e) => setNewTaskData({ ...newTaskData, assigned_to: e.target.value })}
                      className="w-full text-xs font-semibold text-slate-700 bg-transparent outline-hidden cursor-pointer"
                    >
                      <option value="">Não atribuído</option>
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                    Status Inicial
                  </label>
                  <select
                    value={newTaskData.status}
                    onChange={(e) =>
                      setNewTaskData({
                        ...newTaskData,
                        status: e.target.value as TaskDetailData['status'],
                      })
                    }
                    className="w-full text-xs font-semibold border border-slate-200 rounded-xl p-2.5 bg-slate-50/50 hover:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
                  >
                    <option value="a_iniciar">⏳ A Iniciar</option>
                    <option value="em_producao">⚡ Em Produção</option>
                    <option value="em_aprovacao">🟡 Em Aprovação</option>
                    <option value="concluido">✅ Concluído</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                    Data de Início
                  </label>
                  <div className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2 bg-slate-50/50 focus-within:bg-white focus-within:border-blue-500">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <input
                      type="date"
                      value={newTaskData.start_date}
                      onChange={(e) => setNewTaskData({ ...newTaskData, start_date: e.target.value })}
                      className="w-full text-xs font-mono text-slate-700 bg-transparent outline-hidden cursor-pointer"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                    Prazo de Entrega
                  </label>
                  <div className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2 bg-slate-50/50 focus-within:bg-white focus-within:border-blue-500">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <input
                      type="date"
                      value={newTaskData.due_date}
                      onChange={(e) => setNewTaskData({ ...newTaskData, due_date: e.target.value })}
                      className="w-full text-xs font-mono text-slate-700 bg-transparent outline-hidden cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={newTaskData.is_client_approval_required}
                    onChange={(e) =>
                      setNewTaskData({
                        ...newTaskData,
                        is_client_approval_required: e.target.checked,
                      })
                    }
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                  />
                  <span className="text-xs text-slate-700 font-medium">Exige aprovação no Portal</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={creatingTask}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={creatingTask || !newTaskData.name.trim()}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {creatingTask ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Criando...
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" /> Criar Tarefa
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Slide-Over Drawer da Tarefa */}
      <TaskDetailDrawer
        stage={selectedTask}
        projectId={projectId}
        members={members}
        onClose={() => setSelectedTask(null)}
        onUpdateStage={handleStageUpdatedFromDrawer}
        onDeleteStage={handleDeleteStage}
      />
    </div>
  )
}
