export type WorkflowStageColor =
  | 'slate'
  | 'blue'
  | 'amber'
  | 'emerald'
  | 'purple'
  | 'rose'
  | 'indigo'
  | 'cyan'
  | 'orange'
  | 'pink'

export interface WorkflowStage {
  id: string // Unique identifier / slug (e.g. 'a_iniciar', 'em_producao', 'em_aprovacao', 'concluido' or 'custom_123456')
  name: string
  color: WorkflowStageColor
  order_index: number
  is_system?: boolean
  is_client_approval_stage?: boolean // Etapa de Validação pelo Cliente
  is_revision_stage?: boolean        // Etapa de Revisão / Solicitação de Ajustes
  is_approved_stage?: boolean        // Etapa Aprovada
  is_final_stage?: boolean           // Etapa Conclusiva / Finalizada
}

export interface StageStyleConfig {
  name: string
  dot: string
  badge: string
  ganttBar: string
  ganttProgress: string
  kanbanHeader: string
  kanbanBg: string
  kanbanBorder: string
  border: string
  text: string
  bg: string
  previewHex: string
}

export const STAGE_COLOR_CONFIG: Record<WorkflowStageColor, StageStyleConfig> = {
  slate: {
    name: 'Cinza / Neutro',
    dot: 'bg-slate-400',
    badge: 'bg-slate-100 text-slate-700 border-slate-200',
    ganttBar: 'from-slate-600 to-slate-700 border-slate-500/30',
    ganttProgress: 'bg-slate-800',
    kanbanHeader: 'text-slate-700',
    kanbanBg: 'bg-slate-100/70',
    kanbanBorder: 'border-slate-200',
    border: 'border-slate-300',
    text: 'text-slate-700',
    bg: 'bg-slate-50',
    previewHex: '#64748b',
  },
  blue: {
    name: 'Azul',
    dot: 'bg-blue-500',
    badge: 'bg-blue-50 text-blue-700 border-blue-200',
    ganttBar: 'from-blue-600 to-blue-700 border-blue-500/30',
    ganttProgress: 'bg-blue-800',
    kanbanHeader: 'text-blue-900',
    kanbanBg: 'bg-blue-50/40',
    kanbanBorder: 'border-blue-200',
    border: 'border-blue-300',
    text: 'text-blue-700',
    bg: 'bg-blue-50',
    previewHex: '#3b82f6',
  },
  amber: {
    name: 'Âmbar / Amarelo',
    dot: 'bg-amber-500 animate-pulse',
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
    ganttBar: 'from-amber-500 to-amber-600 border-amber-400/30',
    ganttProgress: 'bg-amber-700',
    kanbanHeader: 'text-amber-900',
    kanbanBg: 'bg-amber-50/40',
    kanbanBorder: 'border-amber-200',
    border: 'border-amber-300',
    text: 'text-amber-700',
    bg: 'bg-amber-50',
    previewHex: '#f59e0b',
  },
  emerald: {
    name: 'Verde / Esmeralda',
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    ganttBar: 'from-emerald-600 to-emerald-700 border-emerald-500/30',
    ganttProgress: 'bg-emerald-800',
    kanbanHeader: 'text-emerald-900',
    kanbanBg: 'bg-emerald-50/40',
    kanbanBorder: 'border-emerald-200',
    border: 'border-emerald-300',
    text: 'text-emerald-700',
    bg: 'bg-emerald-50',
    previewHex: '#10b981',
  },
  purple: {
    name: 'Índigo Profundo',
    dot: 'bg-indigo-500',
    badge: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    ganttBar: 'from-indigo-600 to-indigo-700 border-indigo-500/30',
    ganttProgress: 'bg-indigo-800',
    kanbanHeader: 'text-indigo-900',
    kanbanBg: 'bg-indigo-50/40',
    kanbanBorder: 'border-indigo-200',
    border: 'border-indigo-300',
    text: 'text-indigo-700',
    bg: 'bg-indigo-50',
    previewHex: '#4f46e5',
  },
  rose: {
    name: 'Rosa / Carmim',
    dot: 'bg-rose-500',
    badge: 'bg-rose-50 text-rose-700 border-rose-200',
    ganttBar: 'from-rose-600 to-rose-700 border-rose-500/30',
    ganttProgress: 'bg-rose-800',
    kanbanHeader: 'text-rose-900',
    kanbanBg: 'bg-rose-50/40',
    kanbanBorder: 'border-rose-200',
    border: 'border-rose-300',
    text: 'text-rose-700',
    bg: 'bg-rose-50',
    previewHex: '#f43f5e',
  },
  indigo: {
    name: 'Índigo',
    dot: 'bg-indigo-500',
    badge: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    ganttBar: 'from-indigo-600 to-indigo-700 border-indigo-500/30',
    ganttProgress: 'bg-indigo-800',
    kanbanHeader: 'text-indigo-900',
    kanbanBg: 'bg-indigo-50/40',
    kanbanBorder: 'border-indigo-200',
    border: 'border-indigo-300',
    text: 'text-indigo-700',
    bg: 'bg-indigo-50',
    previewHex: '#6366f1',
  },
  cyan: {
    name: 'Ciano',
    dot: 'bg-cyan-500',
    badge: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    ganttBar: 'from-cyan-600 to-cyan-700 border-cyan-500/30',
    ganttProgress: 'bg-cyan-800',
    kanbanHeader: 'text-cyan-900',
    kanbanBg: 'bg-cyan-50/40',
    kanbanBorder: 'border-cyan-200',
    border: 'border-cyan-300',
    text: 'text-cyan-700',
    bg: 'bg-cyan-50',
    previewHex: '#06b6d4',
  },
  orange: {
    name: 'Laranja',
    dot: 'bg-orange-500',
    badge: 'bg-orange-50 text-orange-700 border-orange-200',
    ganttBar: 'from-orange-500 to-orange-600 border-orange-400/30',
    ganttProgress: 'bg-orange-700',
    kanbanHeader: 'text-orange-900',
    kanbanBg: 'bg-orange-50/40',
    kanbanBorder: 'border-orange-200',
    border: 'border-orange-300',
    text: 'text-orange-700',
    bg: 'bg-orange-50',
    previewHex: '#f97316',
  },
  pink: {
    name: 'Pink',
    dot: 'bg-pink-500',
    badge: 'bg-pink-50 text-pink-700 border-pink-200',
    ganttBar: 'from-pink-600 to-pink-700 border-pink-500/30',
    ganttProgress: 'bg-pink-800',
    kanbanHeader: 'text-pink-900',
    kanbanBg: 'bg-pink-50/40',
    kanbanBorder: 'border-pink-200',
    border: 'border-pink-300',
    text: 'text-pink-700',
    bg: 'bg-pink-50',
    previewHex: '#ec4899',
  },
}

export const DEFAULT_WORKFLOW_STAGES: WorkflowStage[] = [
  {
    id: 'a_iniciar',
    name: 'A Iniciar',
    color: 'slate',
    order_index: 0,
    is_system: true,
    is_client_approval_stage: false,
    is_revision_stage: false,
    is_approved_stage: false,
    is_final_stage: false,
  },
  {
    id: 'em_producao',
    name: 'Em Andamento',
    color: 'blue',
    order_index: 1,
    is_system: true,
    is_client_approval_stage: false,
    is_revision_stage: true,
    is_approved_stage: false,
    is_final_stage: false,
  },
  {
    id: 'em_aprovacao',
    name: 'Em Aprovação',
    color: 'amber',
    order_index: 2,
    is_system: true,
    is_client_approval_stage: true,
    is_revision_stage: false,
    is_approved_stage: false,
    is_final_stage: false,
  },
  {
    id: 'concluido',
    name: 'Aprovado',
    color: 'emerald',
    order_index: 3,
    is_system: true,
    is_client_approval_stage: false,
    is_revision_stage: false,
    is_approved_stage: true,
    is_final_stage: true,
  },
]

export function normalizeWorkflowStages(stages?: WorkflowStage[] | null): WorkflowStage[] {
  if (!stages || !Array.isArray(stages) || stages.length === 0) {
    return DEFAULT_WORKFLOW_STAGES
  }

  const hasAnyExplicitApprovalConfig = stages.some((s) => typeof s.is_client_approval_stage === 'boolean')
  const hasAnyExplicitRevisionConfig = stages.some((s) => typeof s.is_revision_stage === 'boolean')
  const hasAnyExplicitApprovedConfig = stages.some((s) => typeof s.is_approved_stage === 'boolean')
  const hasAnyExplicitFinalConfig = stages.some((s) => typeof s.is_final_stage === 'boolean')

  return [...stages]
    .map((s) => ({
      ...s,
      is_client_approval_stage: hasAnyExplicitApprovalConfig
        ? Boolean(s.is_client_approval_stage)
        : s.id === 'em_aprovacao',
      is_revision_stage: hasAnyExplicitRevisionConfig
        ? Boolean(s.is_revision_stage)
        : s.id === 'em_producao',
      is_approved_stage: hasAnyExplicitApprovedConfig
        ? Boolean(s.is_approved_stage)
        : s.id === 'concluido',
      is_final_stage: hasAnyExplicitFinalConfig
        ? Boolean(s.is_final_stage)
        : s.id === 'concluido',
    }))
    .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
}

export function getClientApprovalStage(customStages?: WorkflowStage[] | null): WorkflowStage | null {
  const stages = normalizeWorkflowStages(customStages)
  return stages.find((s) => s.is_client_approval_stage === true) || null
}

export function getRevisionStage(customStages?: WorkflowStage[] | null): WorkflowStage | null {
  const stages = normalizeWorkflowStages(customStages)
  return stages.find((s) => s.is_revision_stage === true) || stages.find((s) => s.id === 'em_producao') || stages[0] || null
}

export function getApprovedStage(customStages?: WorkflowStage[] | null): WorkflowStage | null {
  const stages = normalizeWorkflowStages(customStages)
  return stages.find((s) => s.is_approved_stage === true) || stages.find((s) => s.id === 'concluido') || stages[stages.length - 1] || null
}

export function getFinalStage(customStages?: WorkflowStage[] | null): WorkflowStage | null {
  const stages = normalizeWorkflowStages(customStages)
  return stages.find((s) => s.is_final_stage === true) || null
}

export function canMoveToFinalStage(
  stage: {
    checklist?: Array<{ completed?: boolean }> | null
    is_client_approval_required?: boolean
    status?: string
  },
  customStages?: WorkflowStage[] | null
): { allowed: boolean; reasons: string[] } {
  const reasons: string[] = []

  // 1. Verifica itens pendentes de checklist
  if (Array.isArray(stage.checklist) && stage.checklist.length > 0) {
    const pendingCount = stage.checklist.filter((item) => !item.completed).length
    if (pendingCount > 0) {
      reasons.push(`Existem ${pendingCount} item(ns) de checklist ainda não concluído(s).`)
    }
  }

  // 2. Verifica validação do cliente se exigida
  if (stage.is_client_approval_required) {
    const approvalStage = getClientApprovalStage(customStages)
    if (approvalStage && stage.status === approvalStage.id) {
      reasons.push('A tarefa está aguardando validação do cliente e ainda não foi aprovada.')
    }
  }

  return {
    allowed: reasons.length === 0,
    reasons,
  }
}

export function getStageConfig(
  stageId: string,
  customStages?: WorkflowStage[] | null
): WorkflowStage & { style: StageStyleConfig } {
  const stages = normalizeWorkflowStages(customStages)
  const found = stages.find((s) => s.id === stageId)
  if (found) {
    const style = STAGE_COLOR_CONFIG[found.color] || STAGE_COLOR_CONFIG.blue
    return { ...found, style }
  }

  // Fallbacks para slugs legados caso o ID seja diferente
  if (stageId === 'a_iniciar') {
    const def = stages[0] || DEFAULT_WORKFLOW_STAGES[0]
    return { ...def, style: STAGE_COLOR_CONFIG[def.color] || STAGE_COLOR_CONFIG.slate }
  }
  if (stageId === 'em_producao') {
    const def = stages.find((s) => s.id === 'em_producao') || DEFAULT_WORKFLOW_STAGES[1]
    return { ...def, style: STAGE_COLOR_CONFIG[def.color] || STAGE_COLOR_CONFIG.blue }
  }
  if (stageId === 'em_aprovacao') {
    const def = stages.find((s) => s.id === 'em_aprovacao') || DEFAULT_WORKFLOW_STAGES[2]
    return { ...def, style: STAGE_COLOR_CONFIG[def.color] || STAGE_COLOR_CONFIG.amber }
  }
  if (stageId === 'concluido') {
    const def = stages.find((s) => s.id === 'concluido') || DEFAULT_WORKFLOW_STAGES[3]
    return { ...def, style: STAGE_COLOR_CONFIG[def.color] || STAGE_COLOR_CONFIG.emerald }
  }

  return {
    id: stageId,
    name: stageId,
    color: 'blue',
    order_index: 99,
    is_system: false,
    is_client_approval_stage: false,
    is_revision_stage: false,
    is_approved_stage: false,
    is_final_stage: false,
    style: STAGE_COLOR_CONFIG.blue,
  }
}
