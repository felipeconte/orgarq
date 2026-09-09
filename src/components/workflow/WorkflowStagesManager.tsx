'use client'

import { useState, useTransition } from 'react'
import {
  Layers,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Sparkles,
  Loader2,
  GripVertical,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Shield,
  Flag
} from 'lucide-react'
import BackButton from '@/components/ui/BackButton'
import {
  WorkflowStage,
  WorkflowStageColor,
  STAGE_COLOR_CONFIG,
  DEFAULT_WORKFLOW_STAGES
} from '@/lib/workflow-stages'
import {
  saveWorkflowStagesAction,
  resetWorkflowStagesAction,
  deleteWorkflowStageAction
} from '@/lib/actions/workflow-stages'
import { useConfirm, useAlert } from '@/components/ui/ConfirmDialog'
import DeleteWorkflowStageModal from '@/components/workflow/DeleteWorkflowStageModal'

interface WorkflowStagesManagerProps {
  organizationId: string
  initialStages: WorkflowStage[]
  children?: React.ReactNode
}

const COLOR_OPTIONS: WorkflowStageColor[] = [
  'slate',
  'blue',
  'amber',
  'emerald',
  'purple',
  'rose',
  'indigo',
  'cyan',
  'orange',
  'pink',
]

export default function WorkflowStagesManager({
  organizationId,
  initialStages,
  children,
}: WorkflowStagesManagerProps) {
  const confirm = useConfirm()
  const showAlert = useAlert()
  const [stages, setStages] = useState<WorkflowStage[]>(
    initialStages && initialStages.length > 0 ? initialStages : DEFAULT_WORKFLOW_STAGES
  )
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<string | null>(null)

  // New stage form state
  const [isAdding, setIsAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState<WorkflowStageColor>('blue')
  const [newIsApproval, setNewIsApproval] = useState(false)
  const [newIsRevision, setNewIsRevision] = useState(false)
  const [newIsApproved, setNewIsApproved] = useState(false)
  const [newIsFinal, setNewIsFinal] = useState(false)

  // Edit stage form state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState<WorkflowStageColor>('blue')
  const [editIsApproval, setEditIsApproval] = useState(false)
  const [editIsRevision, setEditIsRevision] = useState(false)
  const [editIsApproved, setEditIsApproved] = useState(false)
  const [editIsFinal, setEditIsFinal] = useState(false)

  // Stage to delete state for modal
  const [stageToDelete, setStageToDelete] = useState<WorkflowStage | null>(null)

  const showToast = (msg: string) => {
    setFeedback(msg)
    setTimeout(() => setFeedback(null), 3000)
  }

  // Handle Add Stage
  const handleAddStage = () => {
    const trimmed = newName.trim()
    if (!trimmed) return

    const baseSlug = trimmed
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .slice(0, 20)

    const uniqueId = `${baseSlug || 'etapa'}_${Date.now().toString(36)}`

    const newStageItem: WorkflowStage = {
      id: uniqueId,
      name: trimmed,
      color: newColor,
      order_index: stages.length,
      is_system: false,
      is_client_approval_stage: newIsApproval,
      is_revision_stage: newIsRevision,
      is_approved_stage: newIsApproved,
      is_final_stage: newIsFinal,
    }

    const updated: WorkflowStage[] = stages.map((s) => ({
      ...s,
      is_client_approval_stage: newIsApproval ? false : Boolean(s.is_client_approval_stage),
      is_revision_stage: newIsRevision ? false : Boolean(s.is_revision_stage),
      is_approved_stage: newIsApproved ? false : Boolean(s.is_approved_stage),
      is_final_stage: newIsFinal ? false : Boolean(s.is_final_stage),
    }))
    updated.push(newStageItem)

    setStages(updated)
    setNewName('')
    setNewColor('blue')
    setNewIsApproval(false)
    setNewIsRevision(false)
    setNewIsApproved(false)
    setNewIsFinal(false)
    setIsAdding(false)

    // Save changes
    startTransition(async () => {
      const res = await saveWorkflowStagesAction(updated, organizationId)
      if (res.success) {
        showToast('Nova etapa adicionada e salva com sucesso!')
      } else {
        await showAlert({
          title: 'Erro ao salvar etapa',
          message: res.error || 'Não foi possível salvar a nova etapa.',
          variant: 'error',
        })
      }
    })
  }

  // Handle Start Edit
  const handleStartEdit = (stage: WorkflowStage) => {
    setEditingId(stage.id)
    setEditName(stage.name)
    setEditColor(stage.color)
    setEditIsApproval(Boolean(stage.is_client_approval_stage))
    setEditIsRevision(Boolean(stage.is_revision_stage))
    setEditIsApproved(Boolean(stage.is_approved_stage))
    setEditIsFinal(Boolean(stage.is_final_stage))
  }

  // Handle Save Edit
  const handleSaveEdit = (stageId: string) => {
    const trimmed = editName.trim()
    if (!trimmed) return

    const updated: WorkflowStage[] = stages.map((s) => {
      if (s.id === stageId) {
        return {
          ...s,
          name: trimmed,
          color: editColor,
          is_client_approval_stage: editIsApproval,
          is_revision_stage: editIsRevision,
          is_approved_stage: editIsApproved,
          is_final_stage: editIsFinal,
        }
      }
      return {
        ...s,
        is_client_approval_stage: editIsApproval ? false : Boolean(s.is_client_approval_stage),
        is_revision_stage: editIsRevision ? false : Boolean(s.is_revision_stage),
        is_approved_stage: editIsApproved ? false : Boolean(s.is_approved_stage),
        is_final_stage: editIsFinal ? false : Boolean(s.is_final_stage),
      }
    })

    setStages(updated)
    setEditingId(null)

    startTransition(async () => {
      const res = await saveWorkflowStagesAction(updated, organizationId)
      if (res.success) {
        showToast('Etapa atualizada com sucesso!')
      } else {
        await showAlert({
          title: 'Erro ao salvar alterações',
          message: res.error || 'Falha ao atualizar a etapa.',
          variant: 'error',
        })
      }
    })
  }

  // Handle Move Up / Down
  const handleMove = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === stages.length - 1) return

    const newIndex = direction === 'up' ? index - 1 : index + 1
    const copy = [...stages]
    const [moved] = copy.splice(index, 1)
    copy.splice(newIndex, 0, moved)

    const reindexed = copy.map((item, idx) => ({
      ...item,
      order_index: idx,
    }))

    setStages(reindexed)

    startTransition(async () => {
      const res = await saveWorkflowStagesAction(reindexed, organizationId)
      if (res.success) {
        showToast('Ordem das etapas atualizada!')
      }
    })
  }

  // Handle Delete Click
  const handleDeleteClick = (stage: WorkflowStage) => {
    if (stages.length <= 1) {
      showAlert({
        title: 'Operação não permitida',
        message: 'O projeto deve conter no mínimo 1 etapa de fluxo de trabalho.',
        variant: 'warning',
      })
      return
    }
    setStageToDelete(stage)
  }

  const handleConfirmDelete = (stageId: string, fallbackStageId: string) => {
    startTransition(async () => {
      const res = await deleteWorkflowStageAction(stageId, fallbackStageId, organizationId)
      if (res.success && res.stages) {
        setStages(res.stages)
        setStageToDelete(null)
        showToast('Etapa excluída e tarefas transferidas com sucesso!')
      } else {
        await showAlert({
          title: 'Erro ao excluir etapa',
          message: res.error || 'Falha ao excluir a etapa.',
          variant: 'error',
        })
      }
    })
  }

  // Handle Reset to Default
  const handleReset = async () => {
    const isConfirmed = await confirm({
      title: 'Restaurar Etapas Padrão do Sistema?',
      message:
        'Esta ação irá redefinir o fluxo para as 4 etapas padrão ("A Iniciar", "Em Andamento", "Em Aprovação" e "Aprovado"). Todas as tarefas vinculadas aos projetos serão automaticamente movidas para a etapa "A Iniciar". Deseja continuar?',
      confirmText: 'Restaurar e Mover Tarefas',
      cancelText: 'Cancelar',
      variant: 'warning',
    })

    if (!isConfirmed) return

    startTransition(async () => {
      const res = await resetWorkflowStagesAction(organizationId)
      if (res.success && res.stages) {
        setStages(res.stages)
        showToast('Etapas restauradas e todas as tarefas movidas para "A Iniciar"!')
      } else {
        await showAlert({
          title: 'Erro ao restaurar etapas',
          message: res.error || 'Falha ao restaurar padrão.',
          variant: 'error',
        })
      }
    })
  }

  return (
    <div className="space-y-6 antialiased">
      {/* Toast Feedback */}
      {feedback && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-semibold animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          {feedback}
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {children || (
          <div className="flex items-center gap-3">
            <BackButton fallbackHref="/app" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                  Etapas do Projeto
                </h1>
              </div>
              <p className="text-sm text-slate-500">
                Gerencie as colunas do Kanban e legendas do Gantt compartilhadas pelo escritório.
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2.5 self-start sm:self-auto shrink-0">
          <button
            type="button"
            onClick={handleReset}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 text-xs font-bold transition-all shadow-2xs cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Restaurar Padrão
          </button>

          {!isAdding && (
            <button
              type="button"
              onClick={() => setIsAdding(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs shadow-blue-500/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Nova Etapa
            </button>
          )}
        </div>
      </div>

      {/* Information Banner for Workflow Roles */}
      <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-slate-50 via-blue-50/30 to-amber-50/30 border border-slate-200/90 shadow-2xs space-y-3 text-xs text-slate-800">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-blue-100 text-blue-700 shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="space-y-1">
            <p className="font-bold text-slate-900 text-sm">Etapas especiais do fluxo de trabalho</p>
            <p className="text-slate-600 leading-relaxed">
              Você pode atribuir funções inteligentes para etapas específicas do seu fluxo. Essas regras automatizam a comunicação com o Portal do Cliente e garantem a integridade das entregas:
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          <div className="p-3 rounded-xl bg-white border border-amber-200/80 shadow-2xs space-y-1">
            <span className="font-bold text-amber-900 flex items-center gap-1.5 text-xs">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-600" /> Validação do Cliente
            </span>
            <p className="text-[11px] text-slate-500 leading-normal">
              Aciona a solicitação de aprovação no <strong>Portal do Cliente</strong> quando a tarefa chega nesta etapa.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-white border border-rose-200/80 shadow-2xs space-y-1">
            <span className="font-bold text-rose-900 flex items-center gap-1.5 text-xs">
              <RotateCcw className="w-3.5 h-3.5 text-rose-600" /> Revisão / Ajustes
            </span>
            <p className="text-[11px] text-slate-500 leading-normal">
              Destino automático da tarefa quando o cliente <strong>solicita ajustes</strong> no portal.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-white border border-emerald-200/80 shadow-2xs space-y-1">
            <span className="font-bold text-emerald-900 flex items-center gap-1.5 text-xs">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Etapa Aprovada
            </span>
            <p className="text-[11px] text-slate-500 leading-normal">
              Destino automático da tarefa quando o cliente <strong>aprova</strong> a entrega no portal.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-white border border-indigo-200/80 shadow-2xs space-y-1">
            <span className="font-bold text-indigo-900 flex items-center gap-1.5 text-xs">
              <Flag className="w-3.5 h-3.5 text-indigo-600" /> Conclusiva / Final
            </span>
            <p className="text-[11px] text-slate-500 leading-normal">
              Finaliza e fecha a tarefa (só permite movimentação com <strong>100% do checklist concluído</strong> e sem pendências).
            </p>
          </div>
        </div>
      </div>

      {/* Add Stage Inline Card */}
      {isAdding && (
        <div className="bg-white p-6 rounded-2xl border-2 border-blue-500/30 shadow-md space-y-4 animate-in fade-in zoom-in-95">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Plus className="w-4 h-4 text-blue-600" /> Adicionar Nova Etapa de Fluxo
            </h3>
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Nome da Etapa *
              </label>
              <input
                type="text"
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddStage()
                  if (e.key === 'Escape') setIsAdding(false)
                }}
                placeholder="Ex: Em Revisão Técnica, Em Orçamento, 3D Render..."
                className="w-full text-xs font-semibold px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Tema de Cor / Badge
              </label>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {COLOR_OPTIONS.map((c) => {
                  const cfg = STAGE_COLOR_CONFIG[c]
                  const isSelected = newColor === c
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewColor(c)}
                      title={cfg.name}
                      className={`w-7 h-7 rounded-xl flex items-center justify-center transition-all cursor-pointer ${isSelected ? 'ring-2 ring-offset-2 ring-blue-600 scale-110 shadow-xs' : 'opacity-80 hover:opacity-100'
                        }`}
                      style={{ backgroundColor: cfg.previewHex }}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Opções de Papéis da Nova Etapa */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <span className="block text-xs font-bold text-slate-700">Funções Especiais desta Etapa (Opcional):</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <label className={`p-2.5 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${newIsApproval ? 'bg-amber-50/80 border-amber-300 text-amber-950 shadow-2xs' : 'bg-slate-50/60 border-slate-200 text-slate-700 hover:bg-slate-100/70'}`}>
                <input
                  type="checkbox"
                  checked={newIsApproval}
                  onChange={(e) => setNewIsApproval(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-slate-300 cursor-pointer"
                />
                <div className="space-y-0.5">
                  <span className="flex items-center gap-1.5 font-bold text-xs">
                    <ShieldCheck className="w-4 h-4 text-amber-600" /> Validação do Cliente
                  </span>
                  <p className="text-[11px] text-slate-500 leading-tight">Solicita aprovação no portal quando a tarefa entra nesta etapa.</p>
                </div>
              </label>

              <label className={`p-2.5 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${newIsRevision ? 'bg-rose-50/80 border-rose-300 text-rose-950 shadow-2xs' : 'bg-slate-50/60 border-slate-200 text-slate-700 hover:bg-slate-100/70'}`}>
                <input
                  type="checkbox"
                  checked={newIsRevision}
                  onChange={(e) => setNewIsRevision(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-slate-300 cursor-pointer"
                />
                <div className="space-y-0.5">
                  <span className="flex items-center gap-1.5 font-bold text-xs">
                    <RotateCcw className="w-4 h-4 text-rose-600" /> Revisão / Ajustes
                  </span>
                  <p className="text-[11px] text-slate-500 leading-tight">Destino automático se o cliente solicitar ajustes no portal.</p>
                </div>
              </label>

              <label className={`p-2.5 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${newIsApproved ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950 shadow-2xs' : 'bg-slate-50/60 border-slate-200 text-slate-700 hover:bg-slate-100/70'}`}>
                <input
                  type="checkbox"
                  checked={newIsApproved}
                  onChange={(e) => setNewIsApproved(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer"
                />
                <div className="space-y-0.5">
                  <span className="flex items-center gap-1.5 font-bold text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Etapa Aprovada
                  </span>
                  <p className="text-[11px] text-slate-500 leading-tight">Destino automático quando o cliente aprova a tarefa no portal.</p>
                </div>
              </label>

              <label className={`p-2.5 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${newIsFinal ? 'bg-indigo-50/80 border-indigo-300 text-indigo-950 shadow-2xs' : 'bg-slate-50/60 border-slate-200 text-slate-700 hover:bg-slate-100/70'}`}>
                <input
                  type="checkbox"
                  checked={newIsFinal}
                  onChange={(e) => setNewIsFinal(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
                />
                <div className="space-y-0.5">
                  <span className="flex items-center gap-1.5 font-bold text-xs">
                    <Flag className="w-4 h-4 text-indigo-600" /> Conclusiva / Final
                  </span>
                  <p className="text-[11px] text-slate-500 leading-tight">Fecha a tarefa (exige 100% de checklists e sem pendências).</p>
                </div>
              </label>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleAddStage}
              disabled={!newName.trim() || isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Salvar Nova Etapa
            </button>
          </div>
        </div>
      )}

      {/* Stages List */}
      <div className="space-y-3">
        {stages.map((stage, index) => {
          const cfg = STAGE_COLOR_CONFIG[stage.color] || STAGE_COLOR_CONFIG.blue
          const isEditing = editingId === stage.id

          return (
            <div
              key={stage.id}
              className={`p-4 sm:p-5 rounded-2xl bg-white border transition-all shadow-2xs ${isEditing
                  ? 'border-blue-500 ring-2 ring-blue-500/10 shadow-md'
                  : 'border-slate-200/80 hover:border-slate-300'
                }`}
            >
              {isEditing ? (
                /* Edit Mode */
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Nome da Etapa
                      </label>
                      <input
                        type="text"
                        autoFocus
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveEdit(stage.id)
                          if (e.key === 'Escape') setEditingId(null)
                        }}
                        className="w-full text-xs font-semibold px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Cor da Etapa
                      </label>
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {COLOR_OPTIONS.map((c) => {
                          const optCfg = STAGE_COLOR_CONFIG[c]
                          const isSelected = editColor === c
                          return (
                            <button
                              key={c}
                              type="button"
                              onClick={() => setEditColor(c)}
                              title={optCfg.name}
                              className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all cursor-pointer ${isSelected ? 'ring-2 ring-offset-2 ring-blue-600 scale-110' : 'opacity-70 hover:opacity-100'
                                }`}
                              style={{ backgroundColor: optCfg.previewHex }}
                            >
                              {isSelected && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Opções de Papéis na Edição da Etapa */}
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <span className="block text-xs font-bold text-slate-700">Funções Especiais desta Etapa:</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <label className={`p-2.5 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${editIsApproval ? 'bg-amber-50/80 border-amber-300 text-amber-950 shadow-2xs' : 'bg-slate-50/60 border-slate-200 text-slate-700 hover:bg-slate-100/70'}`}>
                        <input
                          type="checkbox"
                          checked={editIsApproval}
                          onChange={(e) => setEditIsApproval(e.target.checked)}
                          className="mt-0.5 w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-slate-300 cursor-pointer"
                        />
                        <div className="space-y-0.5">
                          <span className="flex items-center gap-1.5 font-bold text-xs">
                            <ShieldCheck className="w-4 h-4 text-amber-600" /> Validação do Cliente
                          </span>
                          <p className="text-[11px] text-slate-500 leading-tight">Solicita aprovação no portal ao entrar nesta etapa.</p>
                        </div>
                      </label>

                      <label className={`p-2.5 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${editIsRevision ? 'bg-rose-50/80 border-rose-300 text-rose-950 shadow-2xs' : 'bg-slate-50/60 border-slate-200 text-slate-700 hover:bg-slate-100/70'}`}>
                        <input
                          type="checkbox"
                          checked={editIsRevision}
                          onChange={(e) => setEditIsRevision(e.target.checked)}
                          className="mt-0.5 w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-slate-300 cursor-pointer"
                        />
                        <div className="space-y-0.5">
                          <span className="flex items-center gap-1.5 font-bold text-xs">
                            <RotateCcw className="w-4 h-4 text-rose-600" /> Revisão / Ajustes
                          </span>
                          <p className="text-[11px] text-slate-500 leading-tight">Destino automático se o cliente pedir ajustes no portal.</p>
                        </div>
                      </label>

                      <label className={`p-2.5 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${editIsApproved ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950 shadow-2xs' : 'bg-slate-50/60 border-slate-200 text-slate-700 hover:bg-slate-100/70'}`}>
                        <input
                          type="checkbox"
                          checked={editIsApproved}
                          onChange={(e) => setEditIsApproved(e.target.checked)}
                          className="mt-0.5 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer"
                        />
                        <div className="space-y-0.5">
                          <span className="flex items-center gap-1.5 font-bold text-xs">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Etapa Aprovada
                          </span>
                          <p className="text-[11px] text-slate-500 leading-tight">Destino automático quando o cliente aprova no portal.</p>
                        </div>
                      </label>

                      <label className={`p-2.5 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${editIsFinal ? 'bg-indigo-50/80 border-indigo-300 text-indigo-950 shadow-2xs' : 'bg-slate-50/60 border-slate-200 text-slate-700 hover:bg-slate-100/70'}`}>
                        <input
                          type="checkbox"
                          checked={editIsFinal}
                          onChange={(e) => setEditIsFinal(e.target.checked)}
                          className="mt-0.5 w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
                        />
                        <div className="space-y-0.5">
                          <span className="flex items-center gap-1.5 font-bold text-xs">
                            <Flag className="w-4 h-4 text-indigo-600" /> Conclusiva / Final
                          </span>
                          <p className="text-[11px] text-slate-500 leading-tight">Fecha a tarefa (exige 100% de checklists e sem pendências).</p>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100 rounded-xl cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveEdit(stage.id)}
                      disabled={!editName.trim() || isPending}
                      className="px-4 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      {isPending && <Loader2 className="w-3 h-3 animate-spin" />}
                      Salvar Alteração
                    </button>
                  </div>
                </div>
              ) : (
                /* View Mode */
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3.5 flex-wrap">
                    <div className="flex flex-col gap-0.5">
                      <button
                        type="button"
                        onClick={() => handleMove(index, 'up')}
                        disabled={index === 0 || isPending}
                        className="p-1 text-slate-400 hover:text-blue-600 disabled:opacity-20 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                        title="Mover para Cima"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMove(index, 'down')}
                        disabled={index === stages.length - 1 || isPending}
                        className="p-1 text-slate-400 hover:text-blue-600 disabled:opacity-20 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                        title="Mover para Baixo"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-600 font-mono text-[11px] font-bold flex items-center justify-center">
                        {index + 1}
                      </span>

                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${cfg.badge}`}>
                          <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                          {stage.name}
                        </span>

                        {stage.is_client_approval_stage && (
                          <span
                            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-900 border border-amber-300 shadow-2xs select-none"
                            title="Esta é a etapa configurada para validação do cliente no Portal."
                          >
                            <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                            Validação do Cliente
                          </span>
                        )}

                        {stage.is_revision_stage && (
                          <span
                            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-200 shadow-2xs select-none"
                            title="Destino automático quando o cliente solicita ajustes no Portal."
                          >
                            <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
                            Revisão / Ajustes
                          </span>
                        )}

                        {stage.is_approved_stage && (
                          <span
                            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs select-none"
                            title="Destino automático quando o cliente aprova no Portal."
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            Aprovada
                          </span>
                        )}

                        {stage.is_final_stage && (
                          <span
                            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200 shadow-2xs select-none"
                            title="Etapa Conclusiva / Serviço Concluído (tarefa é finalizada e fechada)."
                          >
                            <Flag className="w-3.5 h-3.5 text-indigo-600" />
                            Conclusiva / Final
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 self-end sm:self-auto">
                    <button
                      type="button"
                      onClick={() => handleStartEdit(stage)}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors cursor-pointer"
                      title="Editar Nome e Cor"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteClick(stage)}
                      disabled={stages.length <= 1 || isPending}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors disabled:opacity-20 cursor-pointer"
                      title="Excluir Etapa"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Live Preview Section */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-600" /> Pré-visualização do Kanban & Gantt
            </h3>
            <p className="text-xs text-slate-500">
              Veja como as colunas e as barras de tarefa aparecerão dentro dos projetos.
            </p>
          </div>
        </div>

        {/* Mini Kanban Preview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2">
          {stages.map((st) => {
            const cfg = STAGE_COLOR_CONFIG[st.color] || STAGE_COLOR_CONFIG.blue
            return (
              <div
                key={st.id}
                className={`p-3.5 rounded-xl border ${cfg.kanbanBg} ${cfg.kanbanBorder} space-y-2`}
              >
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/60">
                  <span className={`text-xs font-bold flex items-center gap-1.5 ${cfg.kanbanHeader}`}>
                    <span className={`w-2 h-2 rounded-full ${cfg.dot}`} /> {st.name}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 bg-white px-1.5 py-0.5 rounded shadow-2xs">
                    0
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-white border border-slate-200/80 shadow-2xs space-y-1">
                  <div className="h-2 w-3/4 bg-slate-200 rounded animate-pulse" />
                  <div className="h-1.5 w-1/2 bg-slate-100 rounded" />
                </div>
              </div>
            )
          })}
        </div>

        {/* Mini Gantt Legend Preview */}
        <div className="pt-4 border-t border-slate-100 flex items-center gap-2 flex-wrap text-xs text-slate-600">
          <span className="font-bold text-slate-700 text-xs">Legenda no Gantt:</span>
          {stages.map((st) => {
            const cfg = STAGE_COLOR_CONFIG[st.color] || STAGE_COLOR_CONFIG.blue
            return (
              <span key={st.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs font-semibold">
                <span className="w-2.5 h-2.5 rounded shadow-2xs" style={{ backgroundColor: cfg.previewHex }} />
                {st.name}
              </span>
            )
          })}
        </div>
      </div>

      {/* Modal de Exclusão com Seleção de Destino de Migração */}
      <DeleteWorkflowStageModal
        isOpen={Boolean(stageToDelete)}
        stageToDelete={stageToDelete}
        allStages={stages}
        isPending={isPending}
        onClose={() => setStageToDelete(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  )
}
