'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import {
  ListTodo,
  Kanban as KanbanIcon,
  CalendarRange,
  CheckCircle2,
  Lock,
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
  Calendar,
  GripVertical,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  MoveHorizontal,
  Edit2,
  ShieldCheck,
  Eye,
  EyeOff,
  Flag,
  AlertTriangle
} from 'lucide-react'
import {
  updateStageStatusAction,
  createStageAction,
  deleteStageAction,
  reorderStagesAction,
  toggleStageClientApprovalAction
} from '@/lib/actions/stages'
import {
  formatDateBR,
  formatDateRangeBR,
  formatDayMonthBR,
  parseLocalDate,
  SHORT_MONTH_NAMES_BR,
  FULL_MONTH_NAMES_BR,
  formatDayOfWeekShortBR,
  startOfDay,
  endOfDay,
  startOfWeekBR,
  endOfWeekBR,
  startOfMonthBR,
  endOfMonthBR,
  startOfYearBR,
  endOfYearBR,
  calculateDueDateFromDuration,
  calculateDurationDays,
  getTaskTimelineStatus,
  TaskTimelineStatusInfo
} from '@/lib/date-utils'
import TaskDetailDrawer, {
  TaskDetailData,
  MemberOption
} from '@/components/projects/TaskDetailDrawer'
import { useConfirm, useAlert } from '@/components/ui/ConfirmDialog'
import {
  WorkflowStage,
  WorkflowStageColor,
  DEFAULT_WORKFLOW_STAGES,
  STAGE_COLOR_CONFIG,
  getStageConfig,
  canMoveToFinalStage,
  getFinalStage
} from '@/lib/workflow-stages'
import {
  createWorkflowStageAction,
  renameWorkflowStageAction,
  deleteWorkflowStageAction
} from '@/lib/actions/workflow-stages'
import DeleteWorkflowStageModal from '@/components/workflow/DeleteWorkflowStageModal'

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

export interface ProjectHubClientProps {
  projectId: string
  organizationId?: string
  stages: TaskDetailData[]
  portalToken: string
  members?: MemberOption[]
  initialWorkflowStages?: WorkflowStage[]
  initialView?: 'lista' | 'kanban' | 'gantt'
}

export default function ProjectHubClient({
  projectId,
  organizationId,
  stages: initialStages,
  portalToken,
  members = [],
  initialWorkflowStages,
  initialView = 'lista',
}: ProjectHubClientProps) {
  const confirm = useConfirm()
  const showAlert = useAlert()

  const [stages, setStages] = useState<TaskDetailData[]>(initialStages)
  const [workflowStages, setWorkflowStages] = useState<WorkflowStage[]>(
    initialWorkflowStages && initialWorkflowStages.length > 0 ? initialWorkflowStages : DEFAULT_WORKFLOW_STAGES
  )

  // Estados para edição inline e criação de colunas no Kanban
  const [editingColId, setEditingColId] = useState<string | null>(null)
  const [editingColName, setEditingColName] = useState('')
  const [editingColColor, setEditingColColor] = useState<WorkflowStageColor>('blue')

  const [isAddingCol, setIsAddingCol] = useState(false)
  const [newColName, setNewColName] = useState('')
  const [newColColor, setNewColColor] = useState<WorkflowStageColor>('blue')

  // Estados para exclusão de etapa/coluna no Kanban com migração de tarefas
  const [colToDelete, setColToDelete] = useState<WorkflowStage | null>(null)
  const [isDeletingCol, setIsDeletingCol] = useState(false)

  // Inicializa diretamente na visão escolhida sem piscar ou transicionar por 'lista'
  const [activeView, setActiveView] = useState<'lista' | 'kanban' | 'gantt'>(initialView)

  // Panorama Geral de Cronograma e Progresso Global do Projeto
  const timelinePanorama = useMemo(() => {
    const total = stages.length
    if (total === 0) {
      return {
        totalStages: 0,
        completedStages: 0,
        progressPercent: 0,
        overdueCount: 0,
        urgentCount: 0,
        onTimeCount: 0,
        healthStatus: 'em_dia' as 'em_dia' | 'atencao' | 'atrasado' | 'concluido',
      }
    }

    let progressSum = 0
    let completed = 0
    let overdue = 0
    let urgent = 0
    let onTime = 0

    stages.forEach((st) => {
      const isFinal = Boolean(
        st.status === 'concluido' ||
        workflowStages.find((ws) => ws.id === st.status)?.is_final_stage
      )

      // Cálculo do progresso individual da tarefa
      let taskProg = st.progress_percent || 0
      if (isFinal) {
        taskProg = 100
        completed++
      } else if (Array.isArray(st.checklist) && st.checklist.length > 0) {
        const doneCount = st.checklist.filter((c) => c.completed).length
        taskProg = Math.round((doneCount / st.checklist.length) * 100)
      } else if (st.status === 'em_producao' || st.status === 'em_andamento') {
        taskProg = Math.max(taskProg, 50)
      }
      progressSum += taskProg

      // Status do cronograma
      const statusInfo = getTaskTimelineStatus(st.start_date, st.due_date, isFinal)
      if (statusInfo.type === 'extrapolou') {
        overdue++
      } else if (
        statusInfo.type === 'hoje' ||
        statusInfo.type === 'amanha' ||
        statusInfo.type === 'curto'
      ) {
        urgent++
      } else if (statusInfo.type === 'longo') {
        onTime++
      }
    })

    const overallProgress = Math.round(progressSum / total)

    let healthStatus: 'em_dia' | 'atencao' | 'atrasado' | 'concluido' = 'em_dia'
    if (completed === total) {
      healthStatus = 'concluido'
    } else if (overdue > 0) {
      healthStatus = 'atrasado'
    } else if (urgent > 0) {
      healthStatus = 'atencao'
    }

    return {
      totalStages: total,
      completedStages: completed,
      progressPercent: overallProgress,
      overdueCount: overdue,
      urgentCount: urgent,
      onTimeCount: onTime,
      healthStatus,
    }
  }, [stages, workflowStages])

  const handleSelectView = (view: 'lista' | 'kanban' | 'gantt') => {
    setActiveView(view)
    try {
      localStorage.setItem(`orgarq_project_view_${projectId}`, view)
      document.cookie = `orgarq_project_view_${projectId}=${view}; path=/; max-age=31536000; SameSite=Lax`
      document.cookie = `orgarq_last_view=${view}; path=/; max-age=31536000; SameSite=Lax`
      const url = new URL(window.location.href)
      url.searchParams.set('view', view)
      window.history.replaceState(null, '', url.toString())
    } catch {
      // safe fallback
    }
  }

  // Sincroniza cookies e escuta histórico de navegação (Back/Forward)
  useEffect(() => {
    try {
      localStorage.setItem(`orgarq_project_view_${projectId}`, activeView)
      document.cookie = `orgarq_project_view_${projectId}=${activeView}; path=/; max-age=31536000; SameSite=Lax`
      document.cookie = `orgarq_last_view=${activeView}; path=/; max-age=31536000; SameSite=Lax`
      const searchParams = new URLSearchParams(window.location.search)
      if (!searchParams.has('view')) {
        const url = new URL(window.location.href)
        url.searchParams.set('view', activeView)
        window.history.replaceState(null, '', url.toString())
      }
    } catch {
      // safe fallback
    }

    const handlePopState = () => {
      try {
        const searchParams = new URLSearchParams(window.location.search)
        const viewParam = searchParams.get('view') as 'lista' | 'kanban' | 'gantt' | null
        if (viewParam && ['lista', 'kanban', 'gantt'].includes(viewParam)) {
          setActiveView(viewParam)
        }
      } catch {
        // ignore
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [projectId, activeView])
  const [ganttViewMode, setGanttViewMode] = useState<'days' | 'weeks' | 'months'>('days')
  const [copied, setCopied] = useState(false)
  const [loadingStageId, setLoadingStageId] = useState<string | null>(null)
  const [togglingApprovalStageId, setTogglingApprovalStageId] = useState<string | null>(null)

  // Drag-to-scroll e navegação para a linha do tempo do Gantt
  const timelineScrollRef = useRef<HTMLDivElement | null>(null)
  const isDraggingTimelineRef = useRef(false)
  const hasDraggedTimelineRef = useRef(false)
  const dragStartXRef = useRef(0)
  const dragScrollLeftRef = useRef(0)
  const [isTimelineDraggingState, setIsTimelineDraggingState] = useState(false)

  // Drag-to-scroll e navegação para o quadro Kanban
  const kanbanScrollRef = useRef<HTMLDivElement | null>(null)
  const isDraggingKanbanBoardRef = useRef(false)
  const hasDraggedKanbanBoardRef = useRef(false)
  const dragKanbanStartXRef = useRef(0)
  const dragKanbanScrollLeftRef = useRef(0)
  const [isKanbanDraggingState, setIsKanbanDraggingState] = useState(false)

  const handleTimelineMouseDown = (e: React.MouseEvent) => {
    if (!timelineScrollRef.current) return
    if (e.button !== 0) return
    isDraggingTimelineRef.current = true
    hasDraggedTimelineRef.current = false
    setIsTimelineDraggingState(true)
    dragStartXRef.current = e.pageX - timelineScrollRef.current.offsetLeft
    dragScrollLeftRef.current = timelineScrollRef.current.scrollLeft
  }

  const handleTimelineMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingTimelineRef.current || !timelineScrollRef.current) return
    const x = e.pageX - timelineScrollRef.current.offsetLeft
    const walk = x - dragStartXRef.current
    if (Math.abs(walk) > 3) {
      hasDraggedTimelineRef.current = true
    }
    timelineScrollRef.current.scrollLeft = dragScrollLeftRef.current - walk
  }

  const handleTimelineMouseUp = () => {
    if (isDraggingTimelineRef.current) {
      isDraggingTimelineRef.current = false
      setIsTimelineDraggingState(false)
      setTimeout(() => {
        hasDraggedTimelineRef.current = false
      }, 50)
    }
  }

  const handleScrollLeft = () => {
    if (!timelineScrollRef.current) return
    const amount = timelineScrollRef.current.clientWidth * 0.75
    timelineScrollRef.current.scrollBy({ left: -amount, behavior: 'smooth' })
  }

  const handleScrollRight = () => {
    if (!timelineScrollRef.current) return
    const amount = timelineScrollRef.current.clientWidth * 0.75
    timelineScrollRef.current.scrollBy({ left: amount, behavior: 'smooth' })
  }

  // Handlers de Drag-to-Scroll do Kanban
  const handleKanbanMouseDown = (e: React.MouseEvent) => {
    if (!kanbanScrollRef.current) return
    if (e.button !== 0) return

    // Não inicia drag-to-scroll se o clique foi em inputs, botões, selects ou card sendo arrastado
    const target = e.target as HTMLElement
    if (
      target.closest('input') ||
      target.closest('button') ||
      target.closest('select') ||
      target.closest('textarea') ||
      target.closest('[draggable="true"]')
    ) {
      return
    }

    isDraggingKanbanBoardRef.current = true
    hasDraggedKanbanBoardRef.current = false
    setIsKanbanDraggingState(true)
    dragKanbanStartXRef.current = e.pageX - kanbanScrollRef.current.offsetLeft
    dragKanbanScrollLeftRef.current = kanbanScrollRef.current.scrollLeft
  }

  const handleKanbanMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingKanbanBoardRef.current || !kanbanScrollRef.current) return
    const x = e.pageX - kanbanScrollRef.current.offsetLeft
    const walk = x - dragKanbanStartXRef.current
    if (Math.abs(walk) > 4) {
      hasDraggedKanbanBoardRef.current = true
    }
    kanbanScrollRef.current.scrollLeft = dragKanbanScrollLeftRef.current - walk
  }

  const handleKanbanMouseUp = () => {
    if (isDraggingKanbanBoardRef.current) {
      isDraggingKanbanBoardRef.current = false
      setIsKanbanDraggingState(false)
      setTimeout(() => {
        hasDraggedKanbanBoardRef.current = false
      }, 60)
    }
  }

  const handleKanbanScrollLeft = () => {
    if (!kanbanScrollRef.current) return
    kanbanScrollRef.current.scrollBy({ left: -320, behavior: 'smooth' })
  }

  const handleKanbanScrollRight = () => {
    if (!kanbanScrollRef.current) return
    kanbanScrollRef.current.scrollBy({ left: 320, behavior: 'smooth' })
  }

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
    duration_days: number | ''
    status: TaskDetailData['status']
    is_client_approval_required: boolean
  }>({
    name: '',
    description: '',
    assigned_to: '',
    start_date: '',
    due_date: '',
    duration_days: '',
    status: 'a_iniciar',
    is_client_approval_required: true,
  })

  const handleNewTaskStartDateChange = (newStart: string) => {
    let newDue = newTaskData.due_date
    if (newStart && newTaskData.duration_days !== '' && Number(newTaskData.duration_days) > 0) {
      newDue = calculateDueDateFromDuration(newStart, Number(newTaskData.duration_days))
    } else if (newStart && newDue) {
      const calculatedDays = calculateDurationDays(newStart, newDue)
      if (calculatedDays) {
        setNewTaskData((prev) => ({
          ...prev,
          start_date: newStart,
          due_date: newDue,
          duration_days: calculatedDays,
        }))
        return
      }
    }
    setNewTaskData((prev) => ({ ...prev, start_date: newStart, due_date: newDue }))
  }

  const handleNewTaskDurationChange = (val: string) => {
    const parsed = val === '' ? '' : Math.max(1, parseInt(val) || 1)
    let newDue = newTaskData.due_date
    if (newTaskData.start_date && parsed !== '') {
      newDue = calculateDueDateFromDuration(newTaskData.start_date, Number(parsed))
    }
    setNewTaskData((prev) => ({ ...prev, duration_days: parsed, due_date: newDue }))
  }

  const handleNewTaskDueDateChange = (newDue: string) => {
    let newDuration: number | '' = newTaskData.duration_days
    if (newTaskData.start_date && newDue) {
      const calculatedDays = calculateDurationDays(newTaskData.start_date, newDue)
      if (calculatedDays) {
        newDuration = calculatedDays
      }
    }
    setNewTaskData((prev) => ({ ...prev, due_date: newDue, duration_days: newDuration }))
  }

  // Drag and Drop State - LISTA
  const [draggedListId, setDraggedListId] = useState<string | null>(null)
  const [dragOverListId, setDragOverListId] = useState<string | null>(null)
  const [dropListPosition, setDropListPosition] = useState<'before' | 'after' | null>(null)

  // Drag and Drop State - KANBAN
  const [draggingKanbanId, setDraggingKanbanId] = useState<string | null>(null)
  const [activeDropCol, setActiveDropCol] = useState<string | null>(null)

  const handleCopyLink = () => {
    const fullUrl = typeof window !== 'undefined'
      ? `${window.location.origin}/portal/${portalToken}`
      : `/portal/${portalToken}`
    navigator.clipboard.writeText(fullUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  // Persistência Central de Reordenação
  const persistReorderedStages = async (newOrderedList: TaskDetailData[]) => {
    // Reatribui stage_order sequencial (1, 2, 3, ...)
    const updatedStages = newOrderedList.map((st, idx) => ({
      ...st,
      stage_order: idx + 1,
    }))
    setStages(updatedStages)

    // Atualiza no backend Supabase
    const res = await reorderStagesAction(
      projectId,
      updatedStages.map((s) => ({
        id: s.id,
        stage_order: s.stage_order,
        status: s.status,
      }))
    )

    if (res?.error) {
      console.error('Erro ao salvar reordenação:', res.error)
    }
  }

  const handleStatusChange = async (stageId: string, newStatus: string) => {
    const targetStageCfg = workflowStages.find((s) => s.id === newStatus)
    const currentTask = stages.find((s) => s.id === stageId)

    if (targetStageCfg?.is_final_stage && currentTask) {
      const check = canMoveToFinalStage(currentTask, workflowStages)
      if (!check.allowed) {
        await showAlert({
          title: 'Etapa Conclusiva Bloqueada',
          message: 'Esta tarefa não pode ser movida para a etapa finalizada:',
          description: check.reasons.join('\n'),
          variant: 'warning',
        })
        return
      }
    }

    // Modal de confirmação ao mover para uma etapa de "aprovada"
    const isApprovedStage = Boolean(
      targetStageCfg?.is_approved_stage ||
      targetStageCfg?.name?.toLowerCase().includes('aprovad') ||
      newStatus === 'concluido'
    )

    if (isApprovedStage && currentTask && currentTask.status !== newStatus) {
      const stageName = currentTask.name || 'esta tarefa'
      const targetStageName = targetStageCfg?.name || 'Aprovado'

      const confirmed = await confirm({
        title: 'Confirmar Aprovação da Tarefa',
        message: `Deseja marcar a tarefa "${stageName}" como "${targetStageName}"?`,
        description:
          'Atenção: Ao realizar esta ação manualmente, você será registrado como o responsável pela aprovação no histórico de auditoria do projeto.',
        confirmText: 'Confirmar e Aprovar',
        cancelText: 'Cancelar',
        variant: 'primary',
      })

      if (!confirmed) {
        return
      }
    }

    setStages((prev) =>
      prev.map((s) => (s.id === stageId ? { ...s, status: newStatus } : s))
    )
    if (selectedTask && selectedTask.id === stageId) {
      setSelectedTask((prev) => (prev ? { ...prev, status: newStatus } : null))
    }
    setLoadingStageId(stageId)
    const res = await updateStageStatusAction(projectId, stageId, newStatus)
    setLoadingStageId(null)

    if (res?.error) {
      await showAlert({
        title: 'Não foi possível alterar a etapa',
        message: res.error,
        variant: 'error',
      })
      if (currentTask) {
        setStages((prev) =>
          prev.map((s) => (s.id === stageId ? currentTask : s))
        )
        if (selectedTask && selectedTask.id === stageId) {
          setSelectedTask(currentTask)
        }
      }
    } else if (res?.comments) {
      setStages((prev) =>
        prev.map((s) => (s.id === stageId ? { ...s, comments: res.comments } : s))
      )
      if (selectedTask && selectedTask.id === stageId) {
        setSelectedTask((prev) => (prev ? { ...prev, comments: res.comments } : null))
      }
    }
  }

  // Toggle rápido de exigência de aprovação do cliente no portal
  const handleToggleClientApproval = async (stageId: string, newState: boolean) => {
    const stage = stages.find((s) => s.id === stageId)
    const stageName = stage?.name || 'esta etapa'

    const confirmed = await confirm({
      title: newState ? 'Exigir Aprovação do Cliente' : 'Desativar Aprovação do Cliente',
      message: newState
        ? `Deseja ativar a exigência de aprovação do cliente para "${stageName}"?`
        : `Deseja remover a exigência de aprovação do cliente para "${stageName}"?`,
      description: newState
        ? 'Esta etapa passará a exigir aprovação formal do cliente no portal para poder ser concluída.'
        : 'Esta etapa será tratada como interna e não exigirá o aceite do cliente no portal.',
      confirmText: newState ? 'Ativar Exigência' : 'Remover Exigência',
      cancelText: 'Cancelar',
      variant: newState ? 'primary' : 'warning',
    })

    if (!confirmed) return

    setStages((prev) =>
      prev.map((s) => (s.id === stageId ? { ...s, is_client_approval_required: newState } : s))
    )
    if (selectedTask && selectedTask.id === stageId) {
      setSelectedTask((prev) => (prev ? { ...prev, is_client_approval_required: newState } : null))
    }
    setTogglingApprovalStageId(stageId)
    const res = await toggleStageClientApprovalAction(projectId, stageId, newState)
    setTogglingApprovalStageId(null)

    if (res?.error) {
      setStages((prev) =>
        prev.map((s) => (s.id === stageId ? { ...s, is_client_approval_required: !newState } : s))
      )
      if (selectedTask && selectedTask.id === stageId) {
        setSelectedTask((prev) => (prev ? { ...prev, is_client_approval_required: !newState } : null))
      }
      await showAlert({
        title: 'Erro ao alterar aprovação',
        message: res.error,
        variant: 'error',
      })
    }
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
    const confirmed = await confirm({
      title: 'Excluir Tarefa',
      message: `Tem certeza que deseja excluir permanentemente a tarefa "${name}"?`,
      description: 'Esta ação não poderá ser desfeita e removerá todos os checklists, comentários e anexos vinculados.',
      confirmText: 'Excluir Tarefa',
      cancelText: 'Cancelar',
      variant: 'danger',
    })

    if (confirmed) {
      setLoadingStageId(stageId)
      const res = await deleteStageAction(projectId, stageId)
      setLoadingStageId(null)
      if (res.success) {
        const filtered = stages.filter((s) => s.id !== stageId)
        const resequenced = filtered.map((s, idx) => ({ ...s, stage_order: idx + 1 }))
        setStages(resequenced)
        if (selectedTask?.id === stageId) {
          setSelectedTask(null)
        }
      } else {
        await showAlert({
          title: 'Erro ao excluir',
          message: res.error || 'Não foi possível excluir a tarefa.',
          variant: 'error',
        })
      }
    }
  }

  // Abertura do Modal de Criação
  const handleOpenCreateModal = (initialStatus: string = 'a_iniciar') => {
    setNewTaskData({
      name: '',
      description: '',
      assigned_to: '',
      start_date: '',
      due_date: '',
      duration_days: '',
      status: initialStatus,
      is_client_approval_required: true,
    })
    setIsCreateModalOpen(true)
  }

  // Renomear Etapa do Kanban diretamente
  const handleSaveRenameCol = async (colId: string) => {
    const trimmed = editingColName.trim()
    if (!trimmed) {
      setEditingColId(null)
      return
    }

    const updated = workflowStages.map((s) =>
      s.id === colId ? { ...s, name: trimmed, color: editingColColor } : s
    )
    setWorkflowStages(updated)
    setEditingColId(null)

    const res = await renameWorkflowStageAction(colId, trimmed, editingColColor, organizationId)
    if (!res.success) {
      await showAlert({
        title: 'Erro ao renomear etapa',
        message: res.error || 'Não foi possível salvar o novo nome da etapa.',
        variant: 'error',
      })
    }
  }

  // Criar Nova Etapa no Kanban diretamente
  const handleCreateKanbanCol = async () => {
    const trimmed = newColName.trim()
    if (!trimmed) return

    const res = await createWorkflowStageAction(trimmed, newColColor, organizationId)
    if (res.success && res.stages) {
      setWorkflowStages(res.stages)
      setIsAddingCol(false)
      setNewColName('')
      setNewColColor('blue')
    } else {
      await showAlert({
        title: 'Erro ao criar etapa',
        message: res.error || 'Não foi possível criar a nova etapa.',
        variant: 'error',
      })
    }
  }

  // Exclusão de Etapa do Kanban com Migração de Tarefas
  const handleDeleteColClick = (col: WorkflowStage) => {
    if (workflowStages.length <= 1) {
      showAlert({
        title: 'Operação não permitida',
        message: 'O projeto deve conter no mínimo 1 etapa de fluxo de trabalho.',
        variant: 'warning',
      })
      return
    }
    setColToDelete(col)
  }

  const handleConfirmDeleteCol = async (stageId: string, fallbackStageId: string) => {
    setIsDeletingCol(true)
    const res = await deleteWorkflowStageAction(stageId, fallbackStageId, organizationId)
    setIsDeletingCol(false)

    if (res.success && res.stages) {
      setWorkflowStages(res.stages)
      // Atualiza localmente o status de todas as tarefas da etapa excluída para a etapa de fallback
      setStages((prev) =>
        prev.map((s) => (s.status === stageId ? { ...s, status: fallbackStageId } : s))
      )
      setColToDelete(null)
    } else {
      await showAlert({
        title: 'Erro ao excluir etapa',
        message: res.error || 'Não foi possível excluir a etapa.',
        variant: 'error',
      })
    }
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
      setSelectedTask(created)
    } else {
      await showAlert({
        title: 'Erro ao criar tarefa',
        message: res.error || 'Não foi possível criar a nova tarefa.',
        variant: 'error',
      })
    }
  }

  // ==========================================
  // HANDLERS: REORDENAÇÃO NA LISTA
  // ==========================================
  const handleListDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id)
    e.dataTransfer.effectAllowed = 'move'
    setDraggedListId(id)
  }

  const handleListDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    e.stopPropagation()
    if (!draggedListId || draggedListId === targetId) return

    const rect = e.currentTarget.getBoundingClientRect()
    const offset = e.clientY - rect.top
    const position = offset < rect.height / 2 ? 'before' : 'after'

    setDragOverListId(targetId)
    setDropListPosition(position)
  }

  const handleListDragLeave = () => {
    setDragOverListId(null)
    setDropListPosition(null)
  }

  const handleListDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    e.stopPropagation()

    if (!draggedListId || draggedListId === targetId) {
      setDraggedListId(null)
      setDragOverListId(null)
      setDropListPosition(null)
      return
    }

    const currentList = [...stages]
    const fromIndex = currentList.findIndex((s) => s.id === draggedListId)
    const toIndex = currentList.findIndex((s) => s.id === targetId)

    if (fromIndex === -1 || toIndex === -1) return

    const [movedItem] = currentList.splice(fromIndex, 1)
    let insertionIndex = toIndex
    if (dropListPosition === 'after') {
      insertionIndex = fromIndex < toIndex ? toIndex : toIndex + 1
    } else {
      insertionIndex = fromIndex < toIndex ? toIndex - 1 : toIndex
    }

    const targetPos = Math.max(0, Math.min(currentList.length, insertionIndex))
    currentList.splice(targetPos, 0, movedItem)

    setDraggedListId(null)
    setDragOverListId(null)
    setDropListPosition(null)

    await persistReorderedStages(currentList)
  }

  const handleMoveStage = async (stageId: string, direction: 'up' | 'down') => {
    const currentList = [...stages]
    const index = currentList.findIndex((s) => s.id === stageId)
    if (index === -1) return

    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= currentList.length) return

    const [movedItem] = currentList.splice(index, 1)
    currentList.splice(targetIndex, 0, movedItem)

    await persistReorderedStages(currentList)
  }

  // ==========================================
  // HANDLERS: MOVIMENTAÇÃO DE ETAPAS NO KANBAN
  // ==========================================
  const handleKanbanCardDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id)
    e.dataTransfer.effectAllowed = 'move'
    setDraggingKanbanId(id)
  }

  const handleKanbanCardDrop = async (
    e: React.DragEvent,
    targetStage: TaskDetailData,
    targetColStatus: string
  ) => {
    e.preventDefault()
    e.stopPropagation()

    if (!draggingKanbanId) return
    const stageId = draggingKanbanId

    setDraggingKanbanId(null)
    setActiveDropCol(null)

    const stage = stages.find((s) => s.id === stageId)
    if (!stage || stage.status === targetColStatus) return

    // Mantém a ordenação definida na lista e apenas altera a etapa
    await handleStatusChange(stageId, targetColStatus)
  }

  const handleKanbanColumnDragOver = (e: React.DragEvent, colStatus: string) => {
    e.preventDefault()
    if (activeDropCol !== colStatus) {
      setActiveDropCol(colStatus)
    }
  }

  const handleKanbanColumnDragLeave = () => {
    setActiveDropCol(null)
  }

  const handleKanbanColumnDrop = async (
    e: React.DragEvent,
    targetStatus: string
  ) => {
    e.preventDefault()
    if (!draggingKanbanId) return

    const stageId = draggingKanbanId
    setDraggingKanbanId(null)
    setActiveDropCol(null)

    const stage = stages.find((s) => s.id === stageId)
    if (!stage || stage.status === targetStatus) return

    // Mantém a ordenação definida na lista e apenas altera a etapa
    await handleStatusChange(stageId, targetStatus)
  }

  // ==========================================
  // GANTT: CÁLCULOS DINÂMICOS DA LINHA DO TEMPO
  // ==========================================
  const stagesWithDates = stages.filter(
    (s) => parseLocalDate(s.start_date) || parseLocalDate(s.due_date)
  )

  const dateTimestamps: number[] = []
  stagesWithDates.forEach((s) => {
    const start = parseLocalDate(s.start_date)
    const due = parseLocalDate(s.due_date)
    if (start) dateTimestamps.push(start.getTime())
    if (due) dateTimestamps.push(due.getTime())
  })

  const hasAnyDates = dateTimestamps.length > 0
  const today = new Date()

  let rawStart: Date
  let rawEnd: Date

  if (hasAnyDates) {
    // A partir da data de início da primeira tarefa até a data final mais longa da última tarefa
    rawStart = new Date(Math.min(...dateTimestamps))
    rawEnd = new Date(Math.max(...dateTimestamps))
  } else {
    // Nenhuma data definida: Inicia a partir da data atual que o usuário está
    rawStart = new Date(today)
    rawEnd = new Date(today)
  }

  let timelineStart: Date
  let timelineEnd: Date

  interface GanttColumn {
    id: string
    label: string
    subLabel?: string
    isWeekend?: boolean
    isToday?: boolean
    startDate: Date
    endDate: Date
    leftPct: number
    widthPct: number
  }

  const ganttColumns: GanttColumn[] = []

  if (ganttViewMode === 'days') {
    timelineStart = startOfDay(rawStart)
    const rawEndTime = endOfDay(rawEnd).getTime()
    // Exibe no mínimo 12 dias
    const minEndTime = timelineStart.getTime() + (12 - 1) * 24 * 60 * 60 * 1000
    const finalEndTime = Math.max(rawEndTime, minEndTime)
    timelineEnd = endOfDay(new Date(finalEndTime))

    const totalDurationMs = Math.max(1, timelineEnd.getTime() - timelineStart.getTime() + 1)
    let curr = new Date(timelineStart)

    while (curr.getTime() <= timelineEnd.getTime()) {
      const colStart = startOfDay(curr)
      const colEnd = endOfDay(curr)
      const isWeekend = colStart.getDay() === 0 || colStart.getDay() === 6
      const isCurrentDay =
        colStart.getDate() === today.getDate() &&
        colStart.getMonth() === today.getMonth() &&
        colStart.getFullYear() === today.getFullYear()

      const leftPct = ((colStart.getTime() - timelineStart.getTime()) / totalDurationMs) * 100
      const widthPct = ((colEnd.getTime() - colStart.getTime() + 1) / totalDurationMs) * 100

      ganttColumns.push({
        id: `day-${colStart.toISOString().split('T')[0]}`,
        label: formatDayMonthBR(colStart),
        subLabel: formatDayOfWeekShortBR(colStart),
        isWeekend,
        isToday: isCurrentDay,
        startDate: colStart,
        endDate: colEnd,
        leftPct,
        widthPct,
      })

      curr.setDate(curr.getDate() + 1)
    }
  } else if (ganttViewMode === 'weeks') {
    // Separa os dias de 7 em 7 dias a partir da primeira data
    timelineStart = startOfDay(rawStart)
    const rawEndTime = endOfDay(rawEnd).getTime()
    const minWeeksCount = hasAnyDates ? 1 : 12

    let curr = new Date(timelineStart)
    let weekIndex = 1

    while (curr.getTime() <= rawEndTime || weekIndex <= minWeeksCount) {
      const colStart = startOfDay(curr)
      const colEnd = endOfDay(new Date(colStart.getTime() + 6 * 24 * 60 * 60 * 1000))
      const isCurrentWeek = today.getTime() >= colStart.getTime() && today.getTime() <= colEnd.getTime()

      ganttColumns.push({
        id: `week-${colStart.toISOString().split('T')[0]}`,
        label: `Semana ${weekIndex}`,
        subLabel: `${formatDayMonthBR(colStart)} a ${formatDayMonthBR(colEnd)}`,
        isToday: isCurrentWeek,
        startDate: colStart,
        endDate: colEnd,
        leftPct: 0,
        widthPct: 0,
      })

      weekIndex++
      curr.setDate(curr.getDate() + 7)
    }

    timelineEnd = ganttColumns[ganttColumns.length - 1].endDate
    const totalDurationMs = Math.max(1, timelineEnd.getTime() - timelineStart.getTime() + 1)

    ganttColumns.forEach((col) => {
      col.leftPct = ((col.startDate.getTime() - timelineStart.getTime()) / totalDurationMs) * 100
      col.widthPct = ((col.endDate.getTime() - col.startDate.getTime() + 1) / totalDurationMs) * 100
    })
  } else {
    // months: Mês a mês
    timelineStart = startOfMonthBR(rawStart)
    timelineEnd = endOfMonthBR(rawEnd)
    const monthDiff =
      (timelineEnd.getFullYear() - timelineStart.getFullYear()) * 12 +
      (timelineEnd.getMonth() - timelineStart.getMonth()) +
      1
    if (monthDiff < 3) {
      timelineEnd = endOfMonthBR(new Date(timelineStart.getFullYear(), timelineStart.getMonth() + 2, 1))
    }

    const totalDurationMs = Math.max(1, timelineEnd.getTime() - timelineStart.getTime() + 1)
    let curr = new Date(timelineStart)

    while (curr.getTime() <= timelineEnd.getTime()) {
      const colStart = startOfMonthBR(curr)
      const colEnd = endOfMonthBR(curr)
      const isCurrentMonth =
        today.getMonth() === colStart.getMonth() && today.getFullYear() === colStart.getFullYear()

      const leftPct = ((colStart.getTime() - timelineStart.getTime()) / totalDurationMs) * 100
      const widthPct = ((colEnd.getTime() - colStart.getTime() + 1) / totalDurationMs) * 100

      ganttColumns.push({
        id: `month-${colStart.getFullYear()}-${colStart.getMonth()}`,
        label: `${SHORT_MONTH_NAMES_BR[colStart.getMonth()]}/${String(colStart.getFullYear()).slice(-2)}`,
        subLabel: FULL_MONTH_NAMES_BR[colStart.getMonth()],
        isToday: isCurrentMonth,
        startDate: colStart,
        endDate: colEnd,
        leftPct,
        widthPct,
      })

      curr = new Date(curr.getFullYear(), curr.getMonth() + 1, 1)
    }
  }

  const totalTimelineDurationMs = Math.max(1, timelineEnd.getTime() - timelineStart.getTime() + 1)
  const totalDays = Math.max(1, Math.round(totalTimelineDurationMs / (1000 * 60 * 60 * 24)))

  // Posição de "Hoje"
  const todayOffsetPct = ((today.getTime() - timelineStart.getTime()) / totalTimelineDurationMs) * 100
  const isTodayVisible = todayOffsetPct >= 0 && todayOffsetPct <= 100

  // Resumo do período
  const periodSummaryText = useMemo(() => {
    if (ganttViewMode === 'days') return `${totalDays} dias`
    if (ganttViewMode === 'weeks') return `${ganttColumns.length} semanas (${totalDays} dias)`
    return `${ganttColumns.length} meses (${totalDays} dias)`
  }, [ganttViewMode, totalDays, ganttColumns.length])

  // Largura interna do quadro Gantt para garantir exatamente 12 dias por página no modo 'days'
  const innerTimelineWidthStyle = useMemo(() => {
    if (ganttViewMode === 'days') {
      const daysCount = ganttColumns.length
      if (daysCount <= 12) return '100%'
      // Exatamente 12 dias por página visível
      return `${(daysCount / 12) * 100}%`
    }
    if (ganttViewMode === 'weeks') {
      const weeksCount = ganttColumns.length
      if (weeksCount <= 6) return '100%'
      return `${(weeksCount / 6) * 100}%`
    }
    // months
    const monthsCount = ganttColumns.length
    if (monthsCount <= 6) return '100%'
    return `${(monthsCount / 6) * 100}%`
  }, [ganttViewMode, ganttColumns.length])

  // Largura mínima adaptativa da régua da linha do tempo para garantir conforto na visualização
  const timelineMinWidth = useMemo(() => {
    if (ganttViewMode === 'days') {
      return Math.max(720, ganttColumns.length * 75)
    }
    if (ganttViewMode === 'weeks') {
      return Math.max(720, ganttColumns.length * 130)
    }
    return Math.max(720, ganttColumns.length * 140)
  }, [ganttViewMode, ganttColumns.length])

  const clientApprovalStage = useMemo(() => {
    return workflowStages.find((s) => s.is_client_approval_stage === true) || null
  }, [workflowStages])

  const getStatusBadge = (st: TaskDetailData) => {
    const isValidationStage = clientApprovalStage && st.status === clientApprovalStage.id
    const isAwaitingClient = Boolean(isValidationStage && st.is_client_approval_required)

    if (isAwaitingClient) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/80 shadow-2xs">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" /> Aguardando Cliente
        </span>
      )
    }

    const stageConfig = getStageConfig(st.status, workflowStages)
    const colStyle = STAGE_COLOR_CONFIG[stageConfig.color] || STAGE_COLOR_CONFIG.blue
    const isFinalStage = Boolean(stageConfig.is_final_stage)

    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${colStyle.badge}`}>
        {isFinalStage ? (
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
        ) : (
          <span className={`w-1.5 h-1.5 rounded-full ${colStyle.dot}`} />
        )}
        {stageConfig.name}
      </span>
    )
  }

  return (
    <div className="space-y-6 antialiased">
      {/* Portal Bar Banner */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 p-4 rounded-2xl text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-0.5">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-200 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" /> Portal do Cliente
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
            href={`/portal/${portalToken}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 py-2 px-3.5 rounded-xl bg-white text-blue-600 hover:bg-blue-50 text-xs font-extrabold transition-all shadow-xs cursor-pointer"
          >
            Visualizar Portal <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* PANORAMA GERAL DO PROJETO & CRONOGRAMA */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5 flex-1">
            <div className="flex items-center justify-between gap-4 max-w-md">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" /> Progresso Geral do Projeto
              </span>
              <span className="font-mono text-sm font-extrabold text-blue-600">
                {timelinePanorama.progressPercent}%
              </span>
            </div>
            {/* Progress Bar */}
            <div className="max-w-md bg-slate-100 h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-blue-500 to-indigo-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${timelinePanorama.progressPercent}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-500">
              Média ponderada do avanço individual de todas as {timelinePanorama.totalStages} tarefas do projeto
            </p>
          </div>

          {/* Quick Metrics Badges */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Concluídas */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-xs font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                {timelinePanorama.completedStages} de {timelinePanorama.totalStages} concluídas
              </span>
            </div>

            {/* No Prazo */}
            {timelinePanorama.onTimeCount > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200/80 text-blue-800 text-xs font-bold" title="Tarefas com prazo confortável">
                <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span>{timelinePanorama.onTimeCount} no prazo</span>
              </div>
            )}

            {/* Prazo Curto / Atenção */}
            {timelinePanorama.urgentCount > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-900 text-xs font-bold" title="Tarefas que vencem hoje, amanhã ou em até 3 dias">
                <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>{timelinePanorama.urgentCount} prazo curto</span>
              </div>
            )}

            {/* Extrapolou / Atrasadas */}
            {timelinePanorama.overdueCount > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold animate-pulse" title="Tarefas não concluídas após a data limite">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                <span>{timelinePanorama.overdueCount} atrasada(s)</span>
              </div>
            )}

            {/* Saúde Geral do Cronograma */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold">
              {timelinePanorama.healthStatus === 'concluido' && (
                <span className="text-emerald-700 flex items-center gap-1">🏆 100% Concluído</span>
              )}
              {timelinePanorama.healthStatus === 'atrasado' && (
                <span className="text-rose-700 flex items-center gap-1">🚨 Prazos Críticos</span>
              )}
              {timelinePanorama.healthStatus === 'atencao' && (
                <span className="text-amber-700 flex items-center gap-1">⚠️ Atenção aos Prazos</span>
              )}
              {timelinePanorama.healthStatus === 'em_dia' && (
                <span className="text-blue-700 flex items-center gap-1">✨ Cronograma em Dia</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Views Switcher + Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex p-1 rounded-xl bg-slate-100 border border-slate-200">
          <button
            onClick={() => handleSelectView('lista')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeView === 'lista'
              ? 'bg-white text-blue-600 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            <ListTodo className="w-4 h-4" />
            Lista
          </button>
          <button
            onClick={() => handleSelectView('kanban')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeView === 'kanban'
              ? 'bg-white text-blue-600 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            <KanbanIcon className="w-4 h-4" />
            Kanban
          </button>
          <button
            onClick={() => handleSelectView('gantt')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeView === 'gantt'
              ? 'bg-white text-blue-600 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            <CalendarRange className="w-4 h-4" />
            Gantt
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden md:flex text-xs text-slate-500 font-medium items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" /> Arraste para reordenar a qualquer momento
          </span>

          <button
            onClick={() => handleOpenCreateModal()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-sm cursor-pointer hover:shadow-md"
          >
            <Plus className="w-4 h-4" /> Nova Tarefa
          </button>
        </div>
      </div>

      {/* VIEW 1: LISTA COM REORDENAÇÃO LIVRE E PADRÃO DE DATAS BR */}
      {activeView === 'lista' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3.5 px-3 w-16 text-center">Ordem</th>
                  <th className="py-3.5 px-4">Nome da Tarefa</th>
                  <th className="py-3.5 px-4">Responsável</th>
                  <th className="py-3.5 px-4">Datas (DD/MM/AAAA)</th>
                  <th className="py-3.5 px-4">Tempo / Prazo</th>
                  <th className="py-3.5 px-4">Checklist / Anexos</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {stages.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-400">
                      <p className="text-sm font-semibold text-slate-600">Nenhuma tarefa neste projeto.</p>
                      <p className="text-xs text-slate-400 mt-1">Clique em &quot;Nova Tarefa&quot; acima para adicionar a primeira etapa.</p>
                    </td>
                  </tr>
                )}

                {stages.map((st, index) => {
                  const checklistCount = Array.isArray(st.checklist) ? st.checklist.length : 0
                  const commentsCount = Array.isArray(st.comments) ? st.comments.length : 0
                  const attachmentsCount = Array.isArray(st.attachments) ? st.attachments.length : 0
                  const assignedMember = members.find((m) => m.id === st.assigned_to)

                  const isDragging = draggedListId === st.id
                  const isOver = dragOverListId === st.id

                  const isFinal = Boolean(
                    st.status === 'concluido' ||
                    workflowStages.find((ws) => ws.id === st.status)?.is_final_stage
                  )
                  const taskTimeline = getTaskTimelineStatus(st.start_date, st.due_date, isFinal)

                  return (
                    <tr
                      key={st.id}
                      draggable={true}
                      onDragStart={(e) => handleListDragStart(e, st.id)}
                      onDragOver={(e) => handleListDragOver(e, st.id)}
                      onDragLeave={handleListDragLeave}
                      onDrop={(e) => handleListDrop(e, st.id)}
                      onClick={() => setSelectedTask(st)}
                      className={`hover:bg-blue-50/40 transition-all cursor-pointer group select-none relative ${isDragging ? 'opacity-30 bg-slate-100' : ''
                        } ${isOver && dropListPosition === 'before' ? 'border-t-2 border-t-blue-500' : ''
                        } ${isOver && dropListPosition === 'after' ? 'border-b-2 border-b-blue-500' : ''
                        }`}
                    >
                      {/* Drag Handle & Order */}
                      <td className="py-3.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5 text-slate-400">
                          <span title="Arraste para reordenar" className="inline-flex items-center">
                            <GripVertical className="w-4 h-4 cursor-grab active:cursor-grabbing text-slate-300 group-hover:text-blue-500 transition-colors" />
                          </span>
                          <span className="font-mono text-xs font-bold text-slate-600 min-w-[18px]">
                            #{st.stage_order}
                          </span>
                          <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity ml-0.5">
                            <button
                              type="button"
                              disabled={index === 0}
                              onClick={() => handleMoveStage(st.id, 'up')}
                              className="text-slate-400 hover:text-blue-600 disabled:opacity-20 cursor-pointer"
                              title="Subir posição"
                            >
                              <ChevronUp className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              disabled={index === stages.length - 1}
                              onClick={() => handleMoveStage(st.id, 'down')}
                              className="text-slate-400 hover:text-blue-600 disabled:opacity-20 cursor-pointer"
                              title="Descer posição"
                            >
                              <ChevronDown className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
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

                      {/* Datas Formatadas no Padrão Brasileiro DD/MM/AAAA */}
                      <td className="py-3.5 px-4 font-mono text-[11px]">
                        {st.start_date || st.due_date ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 font-medium">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            {formatDateRangeBR(st.start_date, st.due_date)}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Sem datas</span>
                        )}
                      </td>

                      {/* Coluna Tempo / Prazo */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-1">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold border ${taskTimeline.badgeBg} ${taskTimeline.badgeColor} ${taskTimeline.badgeBorder} w-fit`}
                          >
                            {taskTimeline.type === 'extrapolou' && <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />}
                            {taskTimeline.type === 'hoje' && <Clock className="w-3 h-3 text-amber-600 shrink-0" />}
                            {taskTimeline.type === 'amanha' && <Clock className="w-3 h-3 text-amber-600 shrink-0" />}
                            {taskTimeline.type === 'curto' && <Clock className="w-3 h-3 text-amber-600 shrink-0" />}
                            {taskTimeline.type === 'longo' && <Calendar className="w-3 h-3 text-blue-600 shrink-0" />}
                            {taskTimeline.type === 'concluido' && <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />}
                            {taskTimeline.shortLabel}
                          </span>
                          {taskTimeline.durationDays != null && (
                            <span className="text-[10px] text-slate-500 font-medium">
                              ⏱️ {taskTimeline.durationDays} {taskTimeline.durationDays === 1 ? 'dia' : 'dias'}
                            </span>
                          )}
                        </div>
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

                      <td className="py-3.5 px-4">{getStatusBadge(st)}</td>

                      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Indicador interativo de Exigência de Aprovação do Cliente no Portal */}
                          <button
                            type="button"
                            onClick={() =>
                              handleToggleClientApproval(st.id, !st.is_client_approval_required)
                            }
                            disabled={togglingApprovalStageId === st.id}
                            className={`py-1 px-2 rounded-lg border transition-all cursor-pointer inline-flex items-center gap-1 text-[11px] font-bold ${
                              st.is_client_approval_required
                                ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 shadow-2xs'
                                : 'bg-slate-50 text-slate-400 border-slate-200 hover:text-slate-600 hover:bg-slate-100 opacity-60 hover:opacity-100'
                            }`}
                            title={
                              st.is_client_approval_required
                                ? 'Exige aprovação do cliente no Portal (Ativo - clique para desativar)'
                                : 'Não exige aprovação do cliente no Portal (Inativo - clique para ativar)'
                            }
                          >
                            <ShieldCheck
                              className={`w-3.5 h-3.5 ${
                                st.is_client_approval_required
                                  ? 'text-blue-600'
                                  : 'text-slate-400'
                              }`}
                            />
                            <span className="hidden xl:inline text-[10px]">
                              {st.is_client_approval_required ? 'Aprovação Cliente' : 'Interno'}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setSelectedTask(st)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="Editar / Ver detalhes da tarefa"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            disabled={loadingStageId === st.id}
                            onClick={() => handleDeleteStage(st.id, st.name)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
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
                  <td colSpan={8} className="p-3 bg-slate-50/50 hover:bg-blue-50/30 transition-colors text-center border-t border-slate-100">
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

      {/* VIEW 2: KANBAN COM ETAPAS PERSONALIZADAS, EDIÇÃO DE NOME E CRIAÇÃO DIRETA */}
      {activeView === 'kanban' && (
        <div className="space-y-3">
          {/* Barra de Controles Rápidos de Rolagem do Kanban */}
          <div className="flex items-center justify-between pb-1 text-xs text-slate-500">
            <span className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 font-medium">
              <MoveHorizontal className="w-3.5 h-3.5 text-slate-400" /> Arraste o quadro para navegar entre as colunas
            </span>
            <div className="flex items-center gap-1 ml-auto">
              <button
                type="button"
                onClick={handleKanbanScrollLeft}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 transition-colors shadow-2xs cursor-pointer"
                title="Rolar colunas para a esquerda"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleKanbanScrollRight}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 transition-colors shadow-2xs cursor-pointer"
                title="Rolar colunas para a direita"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div
            ref={kanbanScrollRef}
            onMouseDown={handleKanbanMouseDown}
            onMouseMove={handleKanbanMouseMove}
            onMouseUp={handleKanbanMouseUp}
            onMouseLeave={handleKanbanMouseUp}
            className={`flex items-start gap-4 overflow-x-auto pb-4 select-none ${
              isKanbanDraggingState ? 'cursor-grabbing' : ''
            }`}
          >
            {workflowStages.map((col) => {
              const columnStages = stages
                .filter((s) => s.status === col.id)
                .sort((a, b) => a.stage_order - b.stage_order)
              const isColActive = activeDropCol === col.id
              const colStyle = STAGE_COLOR_CONFIG[col.color] || STAGE_COLOR_CONFIG.blue
              const isEditingThisCol = editingColId === col.id

              return (
                <div
                  key={col.id}
                  onDragOver={(e) => handleKanbanColumnDragOver(e, col.id)}
                  onDragLeave={handleKanbanColumnDragLeave}
                  onDrop={(e) => handleKanbanColumnDrop(e, col.id)}
                  className={`w-72 sm:w-80 shrink-0 p-4 rounded-2xl border transition-all flex flex-col justify-between space-y-3 ${
                    isColActive
                      ? 'bg-blue-50/90 border-blue-400 ring-2 ring-blue-500/20 shadow-sm'
                      : `${colStyle.kanbanBg} ${colStyle.kanbanBorder}`
                  }`}
                >
                  <div className="space-y-3">
                    {/* Column Header */}
                    <div className="pb-2 border-b border-slate-200/80">
                      {isEditingThisCol ? (
                        <div className="space-y-2 animate-in fade-in" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            autoFocus
                            value={editingColName}
                            onChange={(e) => setEditingColName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveRenameCol(col.id)
                              if (e.key === 'Escape') setEditingColId(null)
                            }}
                            className="w-full text-xs font-bold px-2.5 py-1.5 bg-white border border-blue-500 rounded-lg text-slate-900 outline-none shadow-2xs"
                          />
                          <div className="flex items-center justify-between gap-1">
                            <div className="flex flex-wrap gap-1">
                              {COLOR_OPTIONS.map((c) => {
                                const cCfg = STAGE_COLOR_CONFIG[c]
                                const isSel = editingColColor === c
                                return (
                                  <button
                                    key={c}
                                    type="button"
                                    onClick={() => setEditingColColor(c)}
                                    title={cCfg.name}
                                    className={`w-4 h-4 rounded-md flex items-center justify-center cursor-pointer transition-all ${
                                      isSel ? 'ring-2 ring-blue-600 scale-110' : 'opacity-70 hover:opacity-100'
                                    }`}
                                    style={{ backgroundColor: cCfg.previewHex }}
                                  />
                                );
                              })}
                            </div>
                            <div className="flex items-center gap-1">
                              {workflowStages.length > 1 && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleDeleteColClick(col)
                                  }}
                                  className="p-1 text-rose-500 hover:text-rose-700 rounded hover:bg-rose-50 cursor-pointer transition-colors"
                                  title="Excluir esta etapa"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setEditingColId(null)}
                                className="p-1 text-slate-400 hover:text-slate-600 rounded hover:bg-slate-100 cursor-pointer"
                                title="Cancelar"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveRenameCol(col.id)}
                                className="p-1 text-emerald-600 hover:text-emerald-700 rounded hover:bg-emerald-50 cursor-pointer"
                                title="Salvar"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between group/col-header">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${colStyle.dot}`} />
                            <span
                              onClick={() => {
                                setEditingColId(col.id)
                                setEditingColName(col.name)
                                setEditingColColor(col.color)
                              }}
                              className={`text-xs font-bold ${colStyle.kanbanHeader} truncate cursor-pointer hover:underline`}
                              title="Clique para renomear ou editar etapa"
                            >
                              {col.name}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingColId(col.id)
                                setEditingColName(col.name)
                                setEditingColColor(col.color)
                              }}
                              className="opacity-50 hover:opacity-100 group-hover/col-header:opacity-100 p-0.5 text-slate-400 hover:text-blue-600 rounded transition-opacity cursor-pointer shrink-0"
                              title="Renomear etapa"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          </div>
                          <div className="flex items-center gap-1 shrink-0 ml-1.5">
                            <span className="text-[11px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded-full shadow-2xs">
                              {columnStages.length}
                            </span>
                            {workflowStages.length > 1 && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDeleteColClick(col)
                                }}
                                className="opacity-50 hover:opacity-100 group-hover/col-header:opacity-100 p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-all cursor-pointer"
                                title={`Excluir etapa "${col.name}"`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Column Task Cards */}
                    <div className="space-y-2.5 min-h-[140px]">
                      {columnStages.map((st) => {
                        const assignedMember = members.find((m) => m.id === st.assigned_to)
                        const isDragging = draggingKanbanId === st.id

                        return (
                          <div
                            key={st.id}
                            draggable={true}
                            onDragStart={(e) => handleKanbanCardDragStart(e, st.id)}
                            onDragOver={(e) => handleKanbanColumnDragOver(e, col.id)}
                            onDrop={(e) => handleKanbanCardDrop(e, st, col.id)}
                            onClick={() => {
                              if (!hasDraggedKanbanBoardRef.current) {
                                setSelectedTask(st)
                              }
                            }}
                            className={`bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2.5 hover:shadow-md hover:border-blue-300 transition-all cursor-grab active:cursor-grabbing group relative ${
                              isDragging ? 'opacity-30 border-dashed border-blue-400' : ''
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1 text-slate-400">
                                <GripVertical className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-500" />
                                <span className="text-[11px] font-mono font-bold text-slate-500">
                                  #{st.stage_order}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleToggleClientApproval(st.id, !st.is_client_approval_required)
                                  }}
                                  disabled={togglingApprovalStageId === st.id}
                                  className={`p-1 rounded-md transition-all cursor-pointer ${
                                    st.is_client_approval_required
                                      ? 'text-blue-600 bg-blue-50 hover:bg-blue-100'
                                      : 'text-slate-300 hover:text-slate-500 hover:bg-slate-100 opacity-60 hover:opacity-100'
                                  }`}
                                  title={
                                    st.is_client_approval_required
                                      ? 'Exige aprovação do cliente no Portal (Ativo - clique para desativar)'
                                      : 'Não exige aprovação do cliente (Inativo - clique para ativar)'
                                  }
                                >
                                  <ShieldCheck className="w-3.5 h-3.5" />
                                </button>
                                {col.id === 'concluido' && (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                )}
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
                            {st.description && (
                              <p className="text-[11px] text-slate-500 line-clamp-2">{st.description}</p>
                            )}

                            {/* Badge de Datas em padrão BR */}
                            {(st.start_date || st.due_date) && (
                              <div className="flex items-center gap-1 text-[10px] font-mono text-slate-500 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                                <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                                <span className="truncate">{formatDateRangeBR(st.start_date, st.due_date)}</span>
                              </div>
                            )}

                            {/* Duração & Status do Prazo no Kanban */}
                            {(() => {
                              const isTaskFinal = Boolean(
                                col.id === 'concluido' ||
                                workflowStages.find((ws) => ws.id === col.id)?.is_final_stage
                              )
                              const taskTimeline = getTaskTimelineStatus(st.start_date, st.due_date, isTaskFinal)
                              let taskProgress = st.progress_percent || 0
                              if (isTaskFinal) {
                                taskProgress = 100
                              } else if (Array.isArray(st.checklist) && st.checklist.length > 0) {
                                const done = st.checklist.filter((c) => c.completed).length
                                taskProgress = Math.round((done / st.checklist.length) * 100)
                              }

                              return (
                                <div className="space-y-1.5 pt-1">
                                  <div className="flex flex-wrap items-center justify-between gap-1 text-[10px]">
                                    <span
                                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md font-bold border ${taskTimeline.badgeBg} ${taskTimeline.badgeColor} ${taskTimeline.badgeBorder}`}
                                    >
                                      {taskTimeline.type === 'extrapolou' && <AlertTriangle className="w-2.5 h-2.5 text-rose-600 shrink-0" />}
                                      {taskTimeline.type === 'hoje' && <Clock className="w-2.5 h-2.5 text-amber-600 shrink-0" />}
                                      {taskTimeline.type === 'amanha' && <Clock className="w-2.5 h-2.5 text-amber-600 shrink-0" />}
                                      {taskTimeline.type === 'curto' && <Clock className="w-2.5 h-2.5 text-amber-600 shrink-0" />}
                                      {taskTimeline.type === 'longo' && <Calendar className="w-2.5 h-2.5 text-blue-600 shrink-0" />}
                                      {taskTimeline.type === 'concluido' && <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600 shrink-0" />}
                                      {taskTimeline.shortLabel}
                                    </span>

                                    {taskTimeline.durationDays != null && (
                                      <span className="text-slate-500 font-medium">
                                        ⏱️ {taskTimeline.durationDays}d
                                      </span>
                                    )}
                                  </div>

                                  {/* Mini Barra de Progresso da Tarefa */}
                                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full transition-all duration-300 ${
                                        taskProgress === 100
                                          ? 'bg-emerald-500'
                                          : taskProgress > 0
                                          ? 'bg-blue-600'
                                          : 'bg-transparent'
                                      }`}
                                      style={{ width: `${taskProgress}%` }}
                                    />
                                  </div>
                                </div>
                              )
                            })()}

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
                  onClick={() => handleOpenCreateModal(col.id)}
                  className="w-full py-2 px-3 rounded-xl border border-dashed border-slate-300 text-slate-500 hover:text-blue-600 hover:border-blue-400 hover:bg-blue-50/50 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer mt-2"
                >
                  <Plus className="w-3.5 h-3.5" /> Adicionar Tarefa
                </button>
              </div>
            )
          })}

          {/* Card / Botão de Adicionar Nova Etapa ao Kanban */}
          <div className="w-72 sm:w-80 shrink-0">
            {isAddingCol ? (
              <div className="p-4 rounded-2xl bg-white border-2 border-blue-500/30 shadow-md space-y-3 animate-in fade-in zoom-in-95">
                <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5 text-blue-600" /> Nova Etapa de Fluxo
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsAddingCol(false)}
                    className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <input
                  type="text"
                  autoFocus
                  placeholder="Nome da etapa..."
                  value={newColName}
                  onChange={(e) => setNewColName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateKanbanCol()
                    if (e.key === 'Escape') setIsAddingCol(false)
                  }}
                  className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none"
                />
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Cor da Etapa
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {COLOR_OPTIONS.map((c) => {
                      const cfg = STAGE_COLOR_CONFIG[c]
                      const isSel = newColColor === c
                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setNewColColor(c)}
                          title={cfg.name}
                          className={`w-6 h-6 rounded-lg flex items-center justify-center cursor-pointer transition-all ${
                            isSel ? 'ring-2 ring-blue-600 scale-110 shadow-xs' : 'opacity-70 hover:opacity-100'
                          }`}
                          style={{ backgroundColor: cfg.previewHex }}
                        >
                          {isSel && <Check className="w-3 h-3 text-white stroke-[3]" />}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsAddingCol(false)}
                    className="px-2.5 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100 rounded-lg cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateKanbanCol}
                    disabled={!newColName.trim()}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 disabled:opacity-50 cursor-pointer shadow-xs"
                  >
                    Criar Etapa
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setIsAddingCol(true)
                  setNewColName('')
                  setNewColColor('blue')
                }}
                className="w-full py-4 px-4 rounded-2xl border-2 border-dashed border-slate-200 hover:border-blue-400 bg-white/60 hover:bg-blue-50/50 text-slate-500 hover:text-blue-600 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
              >
                <Plus className="w-4 h-4" /> Adicionar Nova Etapa
              </button>
            )}
          </div>
        </div>
      </div>
      )}

      {/* VIEW 3: GANTT DINÂMICO BASEADO EM DATAS REAIS */}
      {activeView === 'gantt' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-5">
          {/* Header do Gantt: Título, Informações, Navegação e Controles de Visão */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <CalendarRange className="w-4 h-4 text-blue-600" /> Linha do Tempo das Tarefas (Gantt)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Período: <strong>{formatDateBR(timelineStart.toISOString().split('T')[0])}</strong> até{' '}
                <strong>{formatDateBR(timelineEnd.toISOString().split('T')[0])}</strong> ({periodSummaryText})
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Dica de arraste e Botões de navegação lateral rápida */}
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 font-medium px-2.5 py-1 bg-slate-50 rounded-lg border border-slate-200/60">
                <MoveHorizontal className="w-3.5 h-3.5 text-slate-400" /> Arraste para navegar
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleScrollLeft}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 transition-colors shadow-2xs cursor-pointer"
                  title="Rolar para a esquerda"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleScrollRight}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 transition-colors shadow-2xs cursor-pointer"
                  title="Rolar para a direita"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Botões de Alternância de Visão: Dias, Semanas, Meses */}
              <div className="flex items-center bg-slate-100/90 p-1 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600">
                {(['days', 'weeks', 'months'] as const).map((mode) => {
                  const labels = {
                    days: 'Dias (12 por pág)',
                    weeks: 'Semanas (7d)',
                    months: 'Meses',
                  }
                  const isActive = ganttViewMode === mode
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setGanttViewMode(mode)}
                      className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${isActive
                          ? 'bg-white text-blue-600 shadow-2xs font-bold'
                          : 'hover:text-slate-900'
                        }`}
                    >
                      {labels[mode]}
                    </button>
                  )
                })}
              </div>

              {/* Legenda de Status Dinâmica */}
              <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-500 font-medium pl-1">
                {workflowStages.map((ws) => {
                  const cfg = getStageConfig(ws.id, workflowStages).style
                  return (
                    <span key={ws.id} className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded shadow-2xs" style={{ backgroundColor: cfg.previewHex }} /> {ws.name}
                    </span>
                  )
                })}
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-slate-100 border border-dashed border-slate-400" /> Sem Data
                </span>
              </div>
            </div>
          </div>

          {/* Container Integrado do Gantt (Coluna Fixa + Linha do Tempo com Drag/Scroll) */}
          <div className="flex items-stretch rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
            {/* Coluna Esquerda Fixa: Etapa e Responsável */}
            <div className="w-60 sm:w-68 md:w-76 shrink-0 border-r border-slate-200 bg-slate-50/50 flex flex-col z-20 select-none">
              {/* Header da Coluna Esquerda */}
              <div className="h-14 border-b border-slate-200 flex items-center px-4 font-mono text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-50">
                Etapa & Responsável
              </div>

              {/* Linhas das Tarefas na Coluna Esquerda */}
              <div className="flex flex-col">
                {stages.map((st) => {
                  const assignedMember = members.find((m) => m.id === st.assigned_to)
                  return (
                    <div
                      key={st.id}
                      onClick={() => {
                        if (!hasDraggedTimelineRef.current) {
                          setSelectedTask(st)
                        }
                      }}
                      className="h-14 border-b border-slate-100 flex items-center justify-between gap-3 px-4 hover:bg-blue-50/40 transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-2.5 truncate min-w-0">
                        <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100/90 border border-slate-200/60 px-2 py-0.5 rounded-md shrink-0">
                          #{st.stage_order}
                        </span>
                        <span className="font-bold text-slate-800 text-xs sm:text-sm truncate group-hover:text-blue-600 transition-colors">
                          {st.name}
                        </span>
                      </div>
                      {assignedMember && (
                        <span
                          className="shrink-0 text-xs font-semibold text-slate-600 bg-white border border-slate-200/80 shadow-2xs px-2.5 py-1 rounded-lg"
                          title={`Responsável: ${assignedMember.name}`}
                        >
                          {assignedMember.name.split(' ')[0]}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Coluna Direita: Linha do Tempo Scrollável com Drag Manual / Gesto */}
            <div
              ref={timelineScrollRef}
              onMouseDown={handleTimelineMouseDown}
              onMouseMove={handleTimelineMouseMove}
              onMouseUp={handleTimelineMouseUp}
              onMouseLeave={handleTimelineMouseUp}
              className={`flex-1 overflow-x-auto select-none relative ${isTimelineDraggingState ? 'cursor-grabbing' : 'cursor-grab'
                }`}
            >
              <div
                style={{ width: innerTimelineWidthStyle, minWidth: `${timelineMinWidth}px` }}
                className="flex flex-col"
              >
                {/* Header Ruler (Colunas da Linha do Tempo) */}
                <div className="h-14 border-b border-slate-200 flex bg-slate-50 relative">
                  {ganttColumns.map((col) => (
                    <div
                      key={col.id}
                      style={{ width: `${col.widthPct}%` }}
                      className={`flex flex-col items-center justify-center py-2 px-1 text-center border-r border-slate-200/80 shrink-0 ${col.isToday
                          ? 'bg-blue-50/90 font-bold text-blue-700'
                          : col.isWeekend
                            ? 'bg-slate-100/60 text-slate-400'
                            : 'text-slate-600'
                        }`}
                    >
                      <span className="font-mono text-xs font-bold truncate leading-tight">{col.label}</span>
                      {col.subLabel && (
                        <span className="text-[10px] text-slate-400 font-medium truncate leading-tight mt-0.5">
                          {col.subLabel}
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Linhas das Tarefas no Gantt com Linhas Verticais Discretas */}
                <div className="flex flex-col relative">
                  {stages.map((st) => {
                    const startObj = parseLocalDate(st.start_date)
                    const dueObj = parseLocalDate(st.due_date)
                    const hasDates = Boolean(startObj || dueObj)

                    let leftPct = 0
                    let widthPct = 0

                    if (hasDates) {
                      const validStart = startObj || dueObj!
                      const validDue = dueObj || startObj!
                      const sDate = startOfDay(validStart < validDue ? validStart : validDue)
                      const dDate = endOfDay(validStart < validDue ? validDue : validStart)

                      const sTime = sDate.getTime()
                      const dTime = dDate.getTime()

                      leftPct = Math.max(
                        0,
                        Math.min(98, ((sTime - timelineStart.getTime()) / totalTimelineDurationMs) * 100)
                      )

                      const rawWidthPct = ((dTime - sTime + 1) / totalTimelineDurationMs) * 100
                      const minWidthPct = ganttViewMode === 'days' ? 1.2 : ganttViewMode === 'weeks' ? 2 : 2.5
                      widthPct = Math.max(minWidthPct, Math.min(100 - leftPct, rawWidthPct))
                    }

                    const stageStyle = getStageConfig(st.status, workflowStages).style

                    return (
                      <div
                        key={st.id}
                        onClick={() => {
                          if (!hasDraggedTimelineRef.current) {
                            setSelectedTask(st)
                          }
                        }}
                        className="h-14 border-b border-slate-100 relative flex items-center hover:bg-blue-50/40 transition-colors group cursor-pointer"
                      >
                        {/* Linhas Verticais Discretas de Grade */}
                        <div className="absolute inset-0 pointer-events-none flex">
                          {ganttColumns.map((col) => (
                            <div
                              key={col.id}
                              style={{ width: `${col.widthPct}%` }}
                              className={`h-full border-r border-slate-200/50 ${col.isToday
                                  ? 'bg-blue-500/5'
                                  : col.isWeekend
                                    ? 'bg-slate-100/30'
                                    : ''
                                }`}
                            />
                          ))}
                        </div>

                        {/* Marcador Vertical de "Hoje" */}
                        {isTodayVisible && (
                          <div
                            className="absolute top-0 bottom-0 z-20 pointer-events-none flex flex-col items-center"
                            style={{ left: `${todayOffsetPct}%` }}
                          >
                            <div className="w-px h-full border-l-2 border-dashed border-rose-500/80" />
                          </div>
                        )}

                        {/* Barra do Gantt com Cores Dinâmicas da Etapa */}
                        {hasDates ? (
                          <div
                            className={`absolute z-10 h-8.5 rounded-xl flex items-center justify-between px-3 text-xs font-bold text-white transition-all shadow-xs overflow-hidden bg-gradient-to-r ${stageStyle.ganttBar} ring-1 ring-white/20 hover:brightness-105`}
                            style={{
                              left: `${leftPct}%`,
                              width: `${widthPct}%`,
                            }}
                            title={`${st.name} (${formatDateRangeBR(st.start_date, st.due_date)})`}
                          >
                            <span className="truncate">{st.name}</span>
                            {st.progress_percent !== undefined && (
                              <span className="text-[10px] font-mono font-bold bg-white/20 px-1.5 py-0.5 rounded-md shrink-0 ml-1.5">
                                {st.progress_percent}%
                              </span>
                            )}
                          </div>
                        ) : (
                          // TAREFA SEM DATA: Fixada à esquerda com estilo tracejado
                          <div
                            className="absolute left-3 z-10 h-8 rounded-xl flex items-center gap-1.5 px-3 text-xs font-medium bg-slate-100/90 hover:bg-slate-200/90 text-slate-600 border border-dashed border-slate-300 transition-all cursor-pointer shadow-2xs"
                            style={{ width: '145px' }}
                            title="Clique para definir as datas desta tarefa no painel lateral"
                          >
                            <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">Sem data definida</span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
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
                        status: e.target.value,
                      })
                    }
                    className="w-full text-xs font-semibold border border-slate-200 rounded-xl p-2.5 bg-slate-50/50 hover:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
                  >
                    {workflowStages.map((ws) => (
                      <option key={ws.id} value={ws.id}>
                        {ws.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                    Data de Início
                  </label>
                  <div className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2 bg-slate-50/50 focus-within:bg-white focus-within:border-blue-500">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <input
                      type="date"
                      value={newTaskData.start_date}
                      onChange={(e) => handleNewTaskStartDateChange(e.target.value)}
                      className="w-full text-xs font-semibold text-slate-700 bg-transparent outline-hidden cursor-pointer"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                    Duração Sugerida
                  </label>
                  <div className="relative border border-slate-200 rounded-xl px-3 py-2 bg-slate-50/50 focus-within:bg-white focus-within:border-blue-500">
                    <input
                      type="number"
                      min={1}
                      value={newTaskData.duration_days}
                      onChange={(e) => handleNewTaskDurationChange(e.target.value)}
                      placeholder="Ex: 5"
                      className="w-full text-xs font-bold text-slate-700 bg-transparent outline-hidden pr-8 font-mono"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400 font-medium pointer-events-none">
                      dias
                    </span>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                    Prazo Final
                  </label>
                  <div className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2 bg-slate-50/50 focus-within:bg-white focus-within:border-blue-500">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <input
                      type="date"
                      value={newTaskData.due_date}
                      onChange={(e) => handleNewTaskDueDateChange(e.target.value)}
                      className="w-full text-xs font-semibold text-slate-700 bg-transparent outline-hidden cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer pt-1">
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
        portalToken={portalToken}
        members={members}
        workflowStages={workflowStages}
        onClose={() => setSelectedTask(null)}
        onUpdateStage={handleStageUpdatedFromDrawer}
        onDeleteStage={handleDeleteStage}
      />

      {/* Modal de Exclusão de Etapa do Kanban com Seleção de Destino de Migração */}
      <DeleteWorkflowStageModal
        isOpen={Boolean(colToDelete)}
        stageToDelete={colToDelete}
        allStages={workflowStages}
        tasksCount={colToDelete ? stages.filter((s) => s.status === colToDelete.id).length : 0}
        isPending={isDeletingCol}
        onClose={() => setColToDelete(null)}
        onConfirm={handleConfirmDeleteCol}
      />
    </div>
  )
}
