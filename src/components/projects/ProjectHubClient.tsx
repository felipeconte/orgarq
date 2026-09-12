'use client'

import { useState, useMemo, useRef, useEffect, Fragment } from 'react'
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
  AlertTriangle,
  GitFork,
  ListTree,
  Unlink,
  Search,
  RotateCcw,
  History
} from 'lucide-react'
import {
  updateStageStatusAction,
  createStageAction,
  deleteStageAction,
  reorderStagesAction,
  toggleStageClientApprovalAction,
  DeletedStageInfo,
  restoreStageAction
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
  initialDeletedStages?: DeletedStageInfo[]
}

export default function ProjectHubClient({
  projectId,
  organizationId,
  stages: initialStages,
  portalToken,
  members = [],
  initialWorkflowStages,
  initialView = 'lista',
  initialDeletedStages = [],
}: ProjectHubClientProps) {
  const confirm = useConfirm()
  const showAlert = useAlert()

  const [stages, setStages] = useState<TaskDetailData[]>(initialStages)
  const [deletedStages, setDeletedStages] = useState<DeletedStageInfo[]>(initialDeletedStages)
  const [searchQuery, setSearchQuery] = useState('')
  const [isDeletedModalOpen, setIsDeletedModalOpen] = useState(false)
  const [restoringStageId, setRestoringStageId] = useState<string | null>(null)

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

  // Estados para exclusão de tarefas com subtarefas (modal inteligente de confirmação)
  const [subtaskDeleteTarget, setSubtaskDeleteTarget] = useState<{
    stage: TaskDetailData
    subtasks: TaskDetailData[]
  } | null>(null)
  const [isDeletingWithSubtasks, setIsDeletingWithSubtasks] = useState(false)

  // Inicializa diretamente na visão escolhida sem piscar ou transicionar por 'lista'
  const [activeView, setActiveView] = useState<'lista' | 'kanban' | 'gantt'>(initialView)

  // Estado para controle de nós expandidos/recolhidos na árvore hierárquica (Lista e Gantt)
  // Por padrão, inicia vazio (recolhido por padrão conforme Decisão 1 do usuário)
  const [expandedStageIds, setExpandedStageIds] = useState<Set<string>>(new Set<string>())

  // Alterna o estado de expansão de uma etapa específica
  const toggleExpandStage = (stageId: string) => {
    setExpandedStageIds((prev) => {
      const next = new Set(prev)
      if (next.has(stageId)) {
        next.delete(stageId)
      } else {
        next.add(stageId)
      }
      return next
    })
  }

  // Verifica se há alguma subtarefa cadastrada no projeto
  const hasAnySubtasks = useMemo(() => {
    return stages.some((s) => Boolean(s.parent_stage_id))
  }, [stages])

  // IDs de todas as tarefas que possuem subtarefas filhas
  const allParentStageIds = useMemo(() => {
    const ids = new Set<string>()
    stages.forEach((s) => {
      if (s.parent_stage_id) {
        ids.add(s.parent_stage_id)
      }
    })
    return Array.from(ids)
  }, [stages])

  const areAllExpanded = useMemo(() => {
    return (
      allParentStageIds.length > 0 &&
      allParentStageIds.every((id) => expandedStageIds.has(id))
    )
  }, [allParentStageIds, expandedStageIds])

  const toggleExpandAll = () => {
    if (areAllExpanded) {
      setExpandedStageIds(new Set<string>())
    } else {
      setExpandedStageIds(new Set<string>(allParentStageIds))
    }
  }

  // Helper para buscar todos os descendentes em múltiplos níveis de uma tarefa
  const getStageDescendants = (parentId: string): TaskDetailData[] => {
    const result: TaskDetailData[] = []
    const queue = [parentId]
    const visited = new Set<string>([parentId])

    while (queue.length > 0) {
      const currId = queue.shift()!
      const children = stages.filter((s) => s.parent_stage_id === currId)
      for (const child of children) {
        if (!visited.has(child.id)) {
          visited.add(child.id)
          result.push(child)
          queue.push(child.id)
        }
      }
    }
    return result
  }

  // Achatamento da árvore de tarefas para renderização hierárquica na Lista e no Gantt (com suporte a busca e auto-expansão)
  const visibleTreeStages = useMemo(() => {
    const stageMap = new Map<string, TaskDetailData>()
    stages.forEach((s) => stageMap.set(s.id, s))

    const childrenMap = new Map<string, TaskDetailData[]>()
    stages.forEach((s) => {
      if (s.parent_stage_id && stageMap.has(s.parent_stage_id)) {
        const list = childrenMap.get(s.parent_stage_id) || []
        list.push(s)
        childrenMap.set(s.parent_stage_id, list)
      }
    })

    const searchLower = searchQuery.trim().toLowerCase()

    const hasMatchingDescendant = (stageId: string, visitedDesc = new Set<string>()): boolean => {
      if (!searchLower) return false
      if (visitedDesc.has(stageId)) return false
      visitedDesc.add(stageId)
      const children = childrenMap.get(stageId) || []
      for (const child of children) {
        const codeMatch = child.code ? child.code.toLowerCase().includes(searchLower) : false
        const nameMatch = child.name.toLowerCase().includes(searchLower)
        if (codeMatch || nameMatch || hasMatchingDescendant(child.id, visitedDesc)) {
          return true
        }
      }
      return false
    }

    const matchesSearch = (st: TaskDetailData): boolean => {
      if (!searchLower) return true
      const codeMatch = st.code ? st.code.toLowerCase().includes(searchLower) : false
      const nameMatch = st.name.toLowerCase().includes(searchLower)
      return codeMatch || nameMatch || hasMatchingDescendant(st.id)
    }

    // Tarefas raiz: não possuem parent_stage_id OU o parent_stage_id não existe no projeto
    const rootStages = stages.filter(
      (s) => (!s.parent_stage_id || !stageMap.has(s.parent_stage_id)) && matchesSearch(s)
    )

    interface TreeStageItemInternal {
      stage: TaskDetailData
      level: number
      hasChildren: boolean
      isExpanded: boolean
      childrenCount: number
      completedChildrenCount: number
      isLastChild: boolean
      ancestors: TaskDetailData[]
    }

    const result: TreeStageItemInternal[] = []
    const visited = new Set<string>()

    function traverse(
      st: TaskDetailData,
      level: number,
      isLast: boolean,
      ancestors: TaskDetailData[]
    ) {
      if (visited.has(st.id)) return // Proteção contra ciclos
      visited.add(st.id)

      if (!matchesSearch(st)) return

      const directChildren = childrenMap.get(st.id) || []
      const hasChildren = directChildren.length > 0
      const isExpanded = expandedStageIds.has(st.id) || (Boolean(searchLower) && hasMatchingDescendant(st.id))

      const completedChildrenCount = directChildren.filter((c) => {
        const cfg = workflowStages.find((ws) => ws.id === c.status)
        return c.status === 'concluido' || Boolean(cfg?.is_final_stage)
      }).length

      result.push({
        stage: st,
        level,
        hasChildren,
        isExpanded,
        childrenCount: directChildren.length,
        completedChildrenCount,
        isLastChild: isLast,
        ancestors,
      })

      if (hasChildren && isExpanded) {
        const visibleChildren = directChildren.filter(matchesSearch)
        visibleChildren.forEach((child, idx) => {
          traverse(child, level + 1, idx === visibleChildren.length - 1, [...ancestors, st])
        })
      }
    }

    rootStages.forEach((root, idx) => {
      traverse(root, 0, idx === rootStages.length - 1, [])
    })

    return result
  }, [stages, workflowStages, expandedStageIds, searchQuery])

  // Tarefas excluídas que correspondem à busca
  const searchLower = searchQuery.trim().toLowerCase()
  const matchedDeletedTasks = useMemo(() => {
    if (!searchLower) return []
    return deletedStages.filter((dt) => {
      const codeMatch = dt.code ? dt.code.toLowerCase().includes(searchLower) : false
      const nameMatch = dt.name.toLowerCase().includes(searchLower)
      return codeMatch || nameMatch
    })
  }, [deletedStages, searchLower])

  const formatDeletedAt = (dateStr: string) => {
    try {
      const d = new Date(dateStr)
      return d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return dateStr
    }
  }

  const handleRestoreDeletedStage = async (stageId: string) => {
    setRestoringStageId(stageId)
    const res = await restoreStageAction(projectId, stageId)
    setRestoringStageId(null)

    if (res.success) {
      const restored = deletedStages.find((d) => d.id === stageId)
      setDeletedStages((prev) => prev.filter((d) => d.id !== stageId))
      await showAlert({
        title: 'Tarefa Restaurada',
        message: `A tarefa "${restored?.name || ''}" (${restored?.code || ''}) foi restaurada com sucesso. A página será atualizada.`,
        variant: 'success',
      })
      window.location.reload()
    } else {
      await showAlert({
        title: 'Erro ao restaurar tarefa',
        message: res.error || 'Não foi possível restaurar a tarefa.',
        variant: 'error',
      })
    }
  }


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
    parent_stage_id: string | null
  }>({
    name: '',
    description: '',
    assigned_to: '',
    start_date: '',
    due_date: '',
    duration_days: '',
    status: 'a_iniciar',
    is_client_approval_required: true,
    parent_stage_id: null,
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

  // Sincronização local após exclusão de etapa/tarefa (chamada após deleteStageAction ter sucesso)
  const handleLocalStageDeleted = (
    stageId: string,
    subtaskMode: 'cascade' | 'unlink' = 'cascade'
  ) => {
    const targetStage = stages.find((s) => s.id === stageId)

    setStages((prev) => {
      let nextStages = prev
      if (subtaskMode === 'unlink') {
        nextStages = nextStages.map((s) =>
          s.parent_stage_id === stageId ? { ...s, parent_stage_id: null } : s
        )
      } else {
        const idsToRemove = new Set<string>([stageId])
        let foundMore = true
        while (foundMore) {
          foundMore = false
          nextStages.forEach((s) => {
            if (s.parent_stage_id && idsToRemove.has(s.parent_stage_id) && !idsToRemove.has(s.id)) {
              idsToRemove.add(s.id)
              foundMore = true
            }
          })
        }
        nextStages = nextStages.filter((s) => !idsToRemove.has(s.id))
      }
      const filtered = nextStages.filter((s) => s.id !== stageId)
      return filtered.map((s, idx) => ({ ...s, stage_order: idx + 1 }))
    })

    if (targetStage) {
      const newlyDeleted: DeletedStageInfo[] = [
        {
          id: targetStage.id,
          name: targetStage.name,
          code: targetStage.code || null,
          deleted_at: new Date().toISOString(),
          deleted_by: null,
          deleted_by_name: 'Você',
          created_at: targetStage.created_at || new Date().toISOString(),
          status: targetStage.status,
        },
      ]
      if (subtaskMode === 'cascade') {
        const removedChildren = stages.filter((s) => s.parent_stage_id === stageId)
        removedChildren.forEach((child) => {
          newlyDeleted.push({
            id: child.id,
            name: child.name,
            code: child.code || null,
            deleted_at: new Date().toISOString(),
            deleted_by: null,
            deleted_by_name: 'Você',
            created_at: child.created_at || new Date().toISOString(),
            status: child.status,
          })
        })
      }
      setDeletedStages((prev) => [
        ...newlyDeleted,
        ...prev.filter((d) => !newlyDeleted.some((nd) => nd.id === d.id)),
      ])
    }

    if (selectedTask?.id === stageId) {
      setSelectedTask(null)
    }
  }

  // Execução da exclusão no servidor com feedback visual
  const executeDeleteStage = async (
    stageId: string,
    subtaskMode: 'cascade' | 'unlink' = 'cascade'
  ) => {
    setLoadingStageId(stageId)
    const res = await deleteStageAction(projectId, stageId, subtaskMode)
    setLoadingStageId(null)

    if (res.success) {
      handleLocalStageDeleted(stageId, subtaskMode)
      return true
    } else {
      await showAlert({
        title: 'Erro ao excluir',
        message: res.error || 'Não foi possível excluir a tarefa.',
        variant: 'error',
      })
      return false
    }
  }

  // Ponto de entrada para exclusão disparada pelo usuário na interface (Lista ou Kanban)
  // Exige sempre modal de confirmação antes de executar
  const onRequestDeleteStage = async (stage: TaskDetailData) => {
    const childSubtasks = stages.filter((s) => s.parent_stage_id === stage.id)

    // Se possui subtarefas vinculadas, abre modal inteligente de escolha (excluir tudo vs desvincular)
    if (childSubtasks.length > 0) {
      setSubtaskDeleteTarget({ stage, subtasks: childSubtasks })
      return
    }

    // Se é tarefa simples ou subtarefa sem filhas, abre o modal de confirmação padrão
    const isSubtask = Boolean(stage.parent_stage_id)
    const codeDisplay = stage.code ? `[${stage.code}] ` : ''
    const confirmed = await confirm({
      title: isSubtask ? 'Excluir Subtarefa' : 'Excluir Tarefa',
      message: `Tem certeza que deseja excluir ${isSubtask ? 'a subtarefa' : 'a tarefa'} ${codeDisplay}"${stage.name}"?`,
      description:
        'A tarefa será movida para o histórico de tarefas excluídas e poderá ser restaurada a qualquer momento.',
      confirmText: isSubtask ? 'Excluir Subtarefa' : 'Excluir Tarefa',
      cancelText: 'Cancelar',
      variant: 'danger',
    })

    if (!confirmed) return

    await executeDeleteStage(stage.id, 'cascade')
  }

  // Confirmação do modal de exclusão de tarefa com subtarefas
  const handleConfirmSubtaskModalDelete = async (mode: 'cascade' | 'unlink') => {
    if (!subtaskDeleteTarget) return
    setIsDeletingWithSubtasks(true)
    const success = await executeDeleteStage(subtaskDeleteTarget.stage.id, mode)
    setIsDeletingWithSubtasks(false)
    if (success) {
      setSubtaskDeleteTarget(null)
    }
  }

  const handleUnlinkSubtask = (stageId: string) => {
    setStages((prev) =>
      prev.map((s) => (s.id === stageId ? { ...s, parent_stage_id: null } : s))
    )
    if (selectedTask?.id === stageId) {
      setSelectedTask((prev) => (prev ? { ...prev, parent_stage_id: null } : null))
    }
  }

  // Abertura do Modal de Criação
  const handleOpenCreateModal = (
    initialStatus: string = 'a_iniciar',
    parentStageId: string | null = null
  ) => {
    setNewTaskData({
      name: '',
      description: '',
      assigned_to: '',
      start_date: '',
      due_date: '',
      duration_days: '',
      status: initialStatus,
      is_client_approval_required: !parentStageId,
      parent_stage_id: parentStageId,
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
      parent_stage_id: newTaskData.parent_stage_id || null,
    })

    setCreatingTask(false)

    if (res.success && res.stage) {
      const created = res.stage as TaskDetailData
      setStages((prev) => [...prev, created])
      if (newTaskData.parent_stage_id) {
        setExpandedStageIds((prev) => new Set([...prev, newTaskData.parent_stage_id!]))
      }
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
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 p-5 rounded-2xl text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
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
            className="inline-flex items-center gap-1.5 py-2.5 px-4 rounded-xl bg-white/15 hover:bg-white/25 text-white text-sm font-semibold transition-all border border-white/20 cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-300" /> Link Copiado!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" /> Copiar Magic Link
              </>
            )}
          </button>

          <a
            href={`/portal/${portalToken}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 py-2.5 px-4 rounded-xl bg-white text-blue-600 hover:bg-blue-50 text-sm font-bold transition-all shadow-xs cursor-pointer"
          >
            Visualizar Portal <ExternalLink className="w-4 h-4" />
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
            <p className="text-xs text-slate-500">
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
      {/* Navigation Views Switcher + Search + Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Seletor de Visões */}
          <div className="inline-flex p-1 rounded-xl bg-slate-100 border border-slate-200">
            <button
              onClick={() => handleSelectView('lista')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${activeView === 'lista'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              <ListTodo className="w-4 h-4" />
              Lista
            </button>
            <button
              onClick={() => handleSelectView('kanban')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${activeView === 'kanban'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              <KanbanIcon className="w-4 h-4" />
              Kanban
            </button>
            <button
              onClick={() => handleSelectView('gantt')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${activeView === 'gantt'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              <CalendarRange className="w-4 h-4" />
              Gantt
            </button>
          </div>

          {/* Campo de Busca Rápida por Código ou Nome */}
          <div className="relative w-full sm:w-64 md:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar código ou nome (ex: 1/2026)..."
              className="w-full pl-9 pr-8 py-2 bg-white border border-slate-200 hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 transition-all outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 cursor-pointer"
                title="Limpar busca"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Botão de Histórico de Tarefas Excluídas */}
          <button
            type="button"
            onClick={() => setIsDeletedModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-all shadow-2xs cursor-pointer"
            title="Ver histórico de tarefas excluídas deste projeto"
          >
            <History className="w-3.5 h-3.5 text-slate-500" />
            <span>Excluídas</span>
            {deletedStages.length > 0 && (
              <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-amber-100 text-amber-800 border border-amber-200">
                {deletedStages.length}
              </span>
            )}
          </button>

          {hasAnySubtasks && (activeView === 'lista' || activeView === 'gantt') && (
            <button
              type="button"
              onClick={toggleExpandAll}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-all shadow-2xs cursor-pointer"
              title={areAllExpanded ? 'Recolher todas as subtarefas' : 'Expandir todas as subtarefas'}
            >
              <ListTree className="w-3.5 h-3.5 text-indigo-600" />
              <span>{areAllExpanded ? 'Recolher Todas' : 'Expandir Todas'}</span>
              {areAllExpanded ? (
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              )}
            </button>
          )}

          <span className="hidden xl:flex text-xs text-slate-500 font-medium items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" /> Arraste para reordenar
          </span>

          <button
            onClick={() => handleOpenCreateModal()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-all shadow-sm cursor-pointer hover:shadow-md"
          >
            <Plus className="w-4 h-4" /> Nova Tarefa
          </button>
        </div>
      </div>

      {/* Alerta de Busca: Tarefas Excluídas Encontradas */}
      {searchQuery.trim() && matchedDeletedTasks.length > 0 && (
        <div className="bg-amber-50/90 border border-amber-200/90 rounded-2xl p-4 text-amber-950 shadow-xs space-y-2.5 animate-in fade-in duration-200">
          <div className="flex items-center gap-2 font-bold text-sm text-amber-900">
            <AlertTriangle className="w-4.5 h-4.5 text-amber-600 shrink-0" />
            <span>
              {matchedDeletedTasks.length === 1
                ? 'Aviso: Foi encontrada 1 tarefa excluída com esta pesquisa'
                : `Aviso: Foram encontradas ${matchedDeletedTasks.length} tarefas excluídas com esta pesquisa`}
            </span>
          </div>
          <div className="space-y-2 pt-0.5">
            {matchedDeletedTasks.map((dt) => (
              <div
                key={dt.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white/90 p-3 rounded-xl border border-amber-200 text-xs shadow-2xs"
              >
                <div className="flex items-center gap-2.5 flex-wrap min-w-0">
                  <span className="font-mono font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 shrink-0">
                    {dt.code || 'Sem código'}
                  </span>
                  <span className="font-bold text-slate-800 text-sm truncate">
                    &quot;{dt.name}&quot;
                  </span>
                  <span className="text-slate-500">
                    — Excluída em <strong>{formatDeletedAt(dt.deleted_at)}</strong> por <strong className="text-slate-700">{dt.deleted_by_name || 'Usuário'}</strong>
                  </span>
                </div>
                <button
                  type="button"
                  disabled={restoringStageId === dt.id}
                  onClick={() => handleRestoreDeletedStage(dt.id)}
                  className="inline-flex items-center gap-1 text-xs font-bold text-amber-800 hover:text-amber-950 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg border border-amber-300 transition-colors cursor-pointer shrink-0 self-start sm:self-auto"
                >
                  {restoringStageId === dt.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RotateCcw className="w-3.5 h-3.5" />
                  )}
                  Restaurar Tarefa
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW 1: LISTA COM REORDENAÇÃO LIVRE E PADRÃO DE DATAS BR */}
      {activeView === 'lista' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider text-xs">
                <tr>
                  <th className="py-4 px-3 w-28 text-left pl-3.5">Código</th>
                  <th className="py-4 px-4">Nome da Tarefa</th>
                  <th className="py-4 px-4">Responsável</th>
                  <th className="py-4 px-4">Datas (DD/MM/AAAA)</th>
                  <th className="py-4 px-4">Tempo / Prazo</th>
                  <th className="py-4 px-4">Checklist / Anexos</th>
                  <th className="py-4 px-4">Status</th>
                  <th className="py-4 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium text-sm">
                {stages.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      <p className="text-sm font-semibold text-slate-600">Nenhuma tarefa neste projeto.</p>
                      <p className="text-xs text-slate-400 mt-1">Clique em &quot;Nova Tarefa&quot; acima para adicionar a primeira etapa.</p>
                    </td>
                  </tr>
                )}

                {visibleTreeStages.map((item, index) => {
                  const st = item.stage
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
                    <Fragment key={st.id}>
                      <tr
                        draggable={item.level === 0}
                        onDragStart={(e) => item.level === 0 && handleListDragStart(e, st.id)}
                        onDragOver={(e) => item.level === 0 && handleListDragOver(e, st.id)}
                        onDragLeave={handleListDragLeave}
                        onDrop={(e) => item.level === 0 && handleListDrop(e, st.id)}
                        onClick={() => setSelectedTask(st)}
                        className={`transition-all cursor-pointer group select-none relative ${
                          item.level > 0
                            ? 'bg-slate-50/50 hover:bg-blue-50/50 border-l-3 border-l-indigo-400'
                            : 'hover:bg-blue-50/40'
                        } ${isDragging ? 'opacity-30 bg-slate-100' : ''
                        } ${isOver && dropListPosition === 'before' ? 'border-t-2 border-t-blue-500' : ''
                        } ${isOver && dropListPosition === 'after' ? 'border-b-2 border-b-blue-500' : ''
                        }`}
                      >
                      {/* Drag Handle & Código */}
                      <td className="py-4 px-3 text-left pl-3.5" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5 text-slate-400">
                          {/* Reordenar via Drag só para tarefas raiz */}
                          {item.level === 0 ? (
                            <span title="Arraste para reordenar" className="inline-flex items-center shrink-0">
                              <GripVertical className="w-4 h-4 cursor-grab active:cursor-grabbing text-slate-300 group-hover:text-blue-500 transition-colors" />
                            </span>
                          ) : (
                            <span className="w-4 shrink-0" />
                          )}

                          {/* Botão de Expandir / Recolher Subtarefas */}
                          {item.hasChildren ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleExpandStage(st.id)
                              }}
                              className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors cursor-pointer shrink-0"
                              title={item.isExpanded ? 'Recolher subtarefas' : 'Expandir subtarefas'}
                            >
                              {item.isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-blue-600" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-slate-500" />
                              )}
                            </button>
                          ) : (
                            <span className="w-4 shrink-0" />
                          )}

                          <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50/80 border border-blue-200/80 px-2 py-0.5 rounded-md shadow-2xs shrink-0 whitespace-nowrap">
                            {st.code || `#${st.stage_order}`}
                          </span>

                          {item.level === 0 && (
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
                          )}
                        </div>
                      </td>


                      {/* Nome da Tarefa com recuo hierárquico e guias visuais */}
                      <td
                        className="py-4 px-4"
                        style={{ paddingLeft: item.level > 0 ? `${16 + item.level * 28}px` : '16px' }}
                      >
                        {item.level > 0 && (
                          <div className="flex items-center gap-1.5 text-indigo-600 mb-1 font-medium text-[11px]">
                            <span className="font-mono text-indigo-300 select-none">└──</span>
                            <GitFork className="w-3 h-3 rotate-180 text-indigo-500 shrink-0" />
                            <span className="text-slate-500 font-normal">subtarefa de</span>
                            <span className="font-semibold text-slate-700 max-w-[160px] truncate">
                              {item.ancestors[item.ancestors.length - 1]?.name}
                            </span>
                          </div>
                        )}

                        <div className={`text-sm flex items-center gap-2 group-hover:text-blue-600 transition-colors ${
                          item.level === 0 ? 'font-bold text-slate-900' : 'font-semibold text-slate-800'
                        }`}>
                          {st.name}
                          {st.is_locked_for_client && (
                            <span className="p-1 rounded bg-slate-100 text-slate-500" title="Aprovado e bloqueado para o cliente">
                              <Lock className="w-3 h-3" />
                            </span>
                          )}
                        </div>

                        {/* Badges de Subtarefas */}
                        {item.hasChildren && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleExpandStage(st.id)
                            }}
                            className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-md border mt-1 transition-colors cursor-pointer ${
                              item.isExpanded
                                ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                                : 'bg-slate-100 text-slate-700 border-slate-200/80 hover:bg-slate-200/70'
                            }`}
                            title={item.isExpanded ? 'Clique para recolher subtarefas' : 'Clique para ver subtarefas'}
                          >
                            <ListTree className="w-3 h-3 text-blue-600 shrink-0" />
                            <span>↳ {item.completedChildrenCount}/{item.childrenCount} subtarefas</span>
                            {item.isExpanded ? (
                              <ChevronDown className="w-3 h-3 text-blue-500" />
                            ) : (
                              <ChevronRight className="w-3 h-3 text-slate-400" />
                            )}
                          </button>
                        )}

                        {st.description && (
                          <p className="text-xs text-slate-500 mt-0.5 truncate max-w-xs">{st.description}</p>
                        )}
                      </td>

                      <td className="py-4 px-4 text-slate-600">
                        {assignedMember ? (
                          <span className="inline-flex items-center gap-2 font-semibold text-slate-800 text-sm">
                            {assignedMember.avatarUrl ? (
                              <img
                                src={assignedMember.avatarUrl}
                                alt={assignedMember.name}
                                className="w-6 h-6 rounded-full object-cover border border-slate-200"
                              />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center">
                                {assignedMember.name.slice(0, 1).toUpperCase()}
                              </div>
                            )}
                            <span className="truncate max-w-[150px]">{assignedMember.name}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 italic text-sm">Não atribuído</span>
                        )}
                      </td>

                      {/* Datas Formatadas no Padrão Brasileiro DD/MM/AAAA */}
                      <td className="py-4 px-4 font-mono text-xs">
                        {st.start_date || st.due_date ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-medium">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            {formatDateRangeBR(st.start_date, st.due_date)}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Sem datas</span>
                        )}
                      </td>

                      {/* Coluna Tempo / Prazo */}
                      <td className="py-4 px-4">
                        <div className="flex flex-col gap-1">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-bold border ${taskTimeline.badgeBg} ${taskTimeline.badgeColor} ${taskTimeline.badgeBorder} w-fit`}
                          >
                            {taskTimeline.type === 'extrapolou' && <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />}
                            {taskTimeline.type === 'hoje' && <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />}
                            {taskTimeline.type === 'amanha' && <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />}
                            {taskTimeline.type === 'curto' && <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />}
                            {taskTimeline.type === 'longo' && <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                            {taskTimeline.type === 'concluido' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                            {taskTimeline.shortLabel}
                          </span>
                          {taskTimeline.durationDays != null && (
                            <span className="text-xs text-slate-500 font-medium">
                              ⏱️ {taskTimeline.durationDays} {taskTimeline.durationDays === 1 ? 'dia' : 'dias'}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3 text-slate-500 text-sm">
                          {checklistCount > 0 && (
                            <span className="flex items-center gap-1 text-slate-700 font-medium">
                              <ListTodo className="w-4 h-4 text-blue-500" /> {checklistCount}
                            </span>
                          )}
                          {attachmentsCount > 0 && (
                            <span className="flex items-center gap-1 text-slate-700 font-medium">
                              <Paperclip className="w-4 h-4 text-indigo-500" /> {attachmentsCount}
                            </span>
                          )}
                          {commentsCount > 0 && (
                            <span className="flex items-center gap-1 text-slate-700 font-medium">
                              <MessageSquare className="w-4 h-4 text-emerald-500" /> {commentsCount}
                            </span>
                          )}
                          {checklistCount === 0 && attachmentsCount === 0 && commentsCount === 0 && (
                            <span className="text-slate-300">-</span>
                          )}
                        </div>
                      </td>

                      <td className="py-4 px-4">{getStatusBadge(st)}</td>

                      <td className="py-4 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Criar Subtarefa Rápida para esta Tarefa */}
                          <button
                            type="button"
                            onClick={() => handleOpenCreateModal(undefined, st.id)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                            title={`Adicionar subtarefa a "${st.name}"`}
                          >
                            <GitFork className="w-4 h-4 rotate-180" />
                          </button>

                          {/* Indicador interativo de Exigência de Aprovação do Cliente no Portal */}
                          <button
                            type="button"
                            onClick={() =>
                              handleToggleClientApproval(st.id, !st.is_client_approval_required)
                            }
                            disabled={togglingApprovalStageId === st.id}
                            className={`py-1.5 px-2.5 rounded-lg border transition-all cursor-pointer inline-flex items-center gap-1.5 text-xs font-bold ${
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
                              className={`w-4 h-4 ${
                                st.is_client_approval_required
                                  ? 'text-blue-600'
                                  : 'text-slate-400'
                              }`}
                            />
                            <span className="hidden xl:inline text-xs">
                              {st.is_client_approval_required ? 'Aprovação Cliente' : 'Interno'}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setSelectedTask(st)}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="Editar / Ver detalhes da tarefa"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            disabled={loadingStageId === st.id}
                            onClick={() => onRequestDeleteStage(st)}
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Excluir tarefa"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>

                      {/* Decisão 2: Linha rápida para adicionar mais uma subtarefa ao final deste grupo expandido */}
                      {item.level > 0 && item.isLastChild && (
                        <tr key={`add-subtask-${st.id}`} className="bg-slate-50/40 border-b border-slate-100/80">
                          <td
                            colSpan={8}
                            style={{ paddingLeft: `${16 + item.level * 28}px` }}
                            className="py-2.5 pr-4"
                          >
                            <button
                              type="button"
                              onClick={() =>
                                handleOpenCreateModal(
                                  undefined,
                                  item.ancestors[item.ancestors.length - 1]?.id
                                )
                              }
                              className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50/80 px-3 py-1.5 rounded-lg transition-colors cursor-pointer border border-dashed border-indigo-200 hover:border-indigo-400"
                            >
                              <Plus className="w-3.5 h-3.5" /> Adicionar subtarefa a &quot;{item.ancestors[item.ancestors.length - 1]?.name}&quot;
                            </button>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}

                {/* Quick Add Row at Bottom */}
                <tr>
                  <td colSpan={8} className="p-3.5 bg-slate-50/50 hover:bg-blue-50/30 transition-colors text-center border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => handleOpenCreateModal()}
                      className="inline-flex items-center gap-2 py-1.5 px-4 text-sm font-semibold text-blue-600 hover:text-blue-700 rounded-xl hover:bg-blue-100/50 transition-all cursor-pointer"
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
                .filter((s) => {
                  if (s.status !== col.id) return false
                  if (!searchLower) return true
                  const codeMatch = s.code ? s.code.toLowerCase().includes(searchLower) : false
                  const nameMatch = s.name.toLowerCase().includes(searchLower)
                  return codeMatch || nameMatch
                })
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
                              className={`text-sm font-bold ${colStyle.kanbanHeader} truncate cursor-pointer hover:underline`}
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
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 ml-1.5">
                            <span className="text-xs font-bold text-slate-500 bg-white px-2 py-0.5 rounded-full shadow-2xs">
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
                                <GripVertical className="w-4 h-4 text-slate-300 group-hover:text-blue-500" />
                                <span className="text-xs font-mono font-bold text-blue-700 bg-blue-50 border border-blue-200/80 px-1.5 py-0.5 rounded-md">
                                  {st.code || `#${st.stage_order}`}
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
                                  <ShieldCheck className="w-4 h-4" />
                                </button>
                                {col.id === 'concluido' && (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                )}
                                <button
                                  type="button"
                                  disabled={loadingStageId === st.id}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    onRequestDeleteStage(st)
                                  }}
                                  className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                                  title="Excluir tarefa"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>

                            {/* Badges de Hierarquia no Kanban */}
                            {(() => {
                              const parentTask = st.parent_stage_id ? stages.find((p) => p.id === st.parent_stage_id) : null
                              const subtasksOfTask = stages.filter((s) => s.parent_stage_id === st.id)
                              const doneSubtasks = subtasksOfTask.filter(
                                (s) => s.status === 'concluido' || workflowStages.find((ws) => ws.id === s.status)?.is_final_stage
                              )

                              return (
                                <div className="space-y-1">
                                  {parentTask && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setSelectedTask(parentTask)
                                      }}
                                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 rounded-md hover:bg-indigo-100 transition-colors max-w-full truncate cursor-pointer"
                                      title={`Abrir tarefa principal: ${parentTask.name}`}
                                    >
                                      <GitFork className="w-3 h-3 rotate-180 text-indigo-500 shrink-0" />
                                      <span className="truncate">Subtarefa de: <strong>{parentTask.name}</strong></span>
                                    </button>
                                  )}

                                  <h4 className="text-sm font-bold text-slate-900 leading-snug">{st.name}</h4>

                                  {subtasksOfTask.length > 0 && (
                                    <div>
                                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded-md">
                                        <ListTree className="w-3 h-3 text-slate-500 shrink-0" />
                                        <span>↳ {doneSubtasks.length}/{subtasksOfTask.length} subtarefas</span>
                                      </span>
                                    </div>
                                  )}
                                </div>
                              )
                            })()}
                            {st.description && (
                              <p className="text-xs text-slate-500 line-clamp-2">{st.description}</p>
                            )}

                            {/* Badge de Datas em padrão BR */}
                            {(st.start_date || st.due_date) && (
                              <div className="flex items-center gap-1.5 text-xs font-mono text-slate-600 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-100">
                                <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
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
                                  <div className="flex flex-wrap items-center justify-between gap-1 text-xs">
                                    <span
                                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold border ${taskTimeline.badgeBg} ${taskTimeline.badgeColor} ${taskTimeline.badgeBorder}`}
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
                              <div className="flex items-center gap-1.5 pt-1.5 border-t border-slate-100 text-xs font-semibold text-slate-700">
                                {assignedMember.avatarUrl ? (
                                  <img
                                    src={assignedMember.avatarUrl}
                                    alt={assignedMember.name}
                                    className="w-5 h-5 rounded-full object-cover border border-slate-200"
                                  />
                                ) : (
                                  <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center">
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
                  className="w-full py-2.5 px-3 rounded-xl border border-dashed border-slate-300 text-slate-500 hover:text-blue-600 hover:border-blue-400 hover:bg-blue-50/50 text-sm font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer mt-2"
                >
                  <Plus className="w-4 h-4" /> Adicionar Tarefa
                </button>
              </div>
            )
          })}

          {/* Card / Botão de Adicionar Nova Etapa ao Kanban */}
          <div className="w-72 sm:w-80 shrink-0">
            {isAddingCol ? (
              <div className="p-4 rounded-2xl bg-white border-2 border-blue-500/30 shadow-md space-y-3 animate-in fade-in zoom-in-95">
                <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                  <span className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <Plus className="w-4 h-4 text-blue-600" /> Nova Etapa de Fluxo
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsAddingCol(false)}
                    className="text-slate-400 hover:text-slate-600 p-1 rounded cursor-pointer"
                  >
                    <X className="w-4 h-4" />
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
                  className="w-full text-sm font-semibold px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none"
                />
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
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
                          {isSel && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsAddingCol(false)}
                    className="px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100 rounded-lg cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateKanbanCol}
                    disabled={!newColName.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 cursor-pointer shadow-xs"
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
                className="w-full py-4 px-4 rounded-2xl border-2 border-dashed border-slate-200 hover:border-blue-400 bg-white/60 hover:bg-blue-50/50 text-slate-500 hover:text-blue-600 text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
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
                {visibleTreeStages.map((item) => {
                  const st = item.stage
                  const assignedMember = members.find((m) => m.id === st.assigned_to)
                  return (
                    <div
                      key={st.id}
                      onClick={() => {
                        if (!hasDraggedTimelineRef.current) {
                          setSelectedTask(st)
                        }
                      }}
                      style={{ paddingLeft: item.level > 0 ? `${12 + item.level * 20}px` : '16px' }}
                      className={`h-14 border-b border-slate-100 flex items-center justify-between gap-2.5 pr-4 transition-colors cursor-pointer group ${
                        item.level > 0
                          ? 'bg-slate-50/50 hover:bg-blue-50/50 border-l-3 border-l-indigo-400'
                          : 'hover:bg-blue-50/40'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate min-w-0">
                        {/* Toggle chevron se possui subtarefas */}
                        {item.hasChildren ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleExpandStage(st.id)
                            }}
                            className="p-1 -ml-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors cursor-pointer shrink-0"
                            title={item.isExpanded ? 'Recolher subtarefas' : 'Expandir subtarefas'}
                          >
                            {item.isExpanded ? (
                              <ChevronDown className="w-3.5 h-3.5 text-blue-600" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                            )}
                          </button>
                        ) : item.level > 0 ? (
                          <span className="font-mono text-xs text-indigo-400 shrink-0">↳</span>
                        ) : (
                          <span className="w-3.5 shrink-0" />
                        )}

                        <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200/80 px-1.5 py-0.5 rounded-md shrink-0">
                          {st.code || `#${st.stage_order}`}
                        </span>
                        <div className="flex flex-col truncate min-w-0">
                          <span className={`text-xs sm:text-sm truncate group-hover:text-blue-600 transition-colors flex items-center gap-1 ${
                            item.level === 0 ? 'font-bold text-slate-800' : 'font-medium text-slate-700'
                          }`}>
                            {st.name}
                          </span>
                          {item.hasChildren && (
                            <span className="text-[10px] text-slate-400 font-semibold truncate">
                              ↳ {item.completedChildrenCount}/{item.childrenCount} subtarefas
                            </span>
                          )}
                        </div>
                      </div>
                      {assignedMember && (
                        <span
                          className="shrink-0 text-[11px] font-semibold text-slate-600 bg-white border border-slate-200/80 shadow-2xs px-2 py-0.5 rounded-lg"
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
                  {visibleTreeStages.map((item) => {
                    const st = item.stage
                    let startObj = parseLocalDate(st.start_date)
                    let dueObj = parseLocalDate(st.due_date)
                    let isSummaryBar = false

                    // Decisão 3: Se a tarefa mãe não tiver datas manuais preenchidas, calcula a barra como resumo do período das subtarefas
                    if (!startObj && !dueObj && item.hasChildren) {
                      const descendants = getStageDescendants(st.id)
                      const descendantDates: Date[] = []
                      descendants.forEach((d) => {
                        const s = parseLocalDate(d.start_date)
                        const du = parseLocalDate(d.due_date)
                        if (s) descendantDates.push(s)
                        if (du) descendantDates.push(du)
                      })
                      if (descendantDates.length > 0) {
                        const minTime = Math.min(...descendantDates.map((d) => d.getTime()))
                        const maxTime = Math.max(...descendantDates.map((d) => d.getTime()))
                        startObj = new Date(minTime)
                        dueObj = new Date(maxTime)
                        isSummaryBar = true
                      }
                    }

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
                        className={`h-14 border-b border-slate-100 relative flex items-center hover:bg-blue-50/40 transition-colors group cursor-pointer ${
                          item.level > 0 ? 'bg-slate-50/40' : ''
                        }`}
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

                        {/* Barra do Gantt com Cores Dinâmicas da Etapa ou Resumo de Subtarefas */}
                        {hasDates ? (
                          isSummaryBar ? (
                            // Barra de Resumo da Tarefa Pai (Agrupamento)
                            <div
                              className="absolute z-10 h-7 rounded-lg flex items-center justify-between px-2.5 text-xs font-bold text-slate-900 transition-all shadow-xs overflow-hidden bg-slate-200 border-2 border-slate-600 ring-1 ring-slate-400/50 hover:brightness-105"
                              style={{
                                left: `${leftPct}%`,
                                width: `${widthPct}%`,
                              }}
                              title={`[Resumo Subtarefas] ${st.name}: ${formatDateRangeBR(startObj?.toISOString().split('T')[0], dueObj?.toISOString().split('T')[0])}`}
                            >
                              <span className="truncate flex items-center gap-1.5 font-bold text-slate-800">
                                <ListTree className="w-3.5 h-3.5 text-slate-700 shrink-0" />
                                <span className="truncate">{st.name}</span>
                              </span>
                              <span className="text-[10px] font-mono font-bold bg-slate-700 text-white px-1.5 py-0.5 rounded-md shrink-0 ml-1.5">
                                {item.childrenCount} subtarefas
                              </span>
                            </div>
                          ) : (
                            // Barra Normal de Tarefa ou Subtarefa
                            <div
                              className={`absolute z-10 rounded-xl flex items-center justify-between px-3 text-xs font-bold text-white transition-all shadow-xs overflow-hidden bg-gradient-to-r ${stageStyle.ganttBar} ring-1 ring-white/20 hover:brightness-105 ${
                                item.level > 0 ? 'h-7 rounded-lg text-[11px]' : 'h-8.5'
                              }`}
                              style={{
                                left: `${leftPct}%`,
                                width: `${widthPct}%`,
                              }}
                              title={`${st.parent_stage_id ? '[Subtarefa] ' : ''}${st.name} (${formatDateRangeBR(st.start_date, st.due_date)})`}
                            >
                              <span className="truncate flex items-center gap-1">
                                {st.parent_stage_id && <GitFork className="w-3 h-3 rotate-180 shrink-0" />}
                                <span className="truncate">{st.name}</span>
                              </span>
                              {st.progress_percent !== undefined && (
                                <span className="text-[10px] font-mono font-bold bg-white/20 px-1.5 py-0.5 rounded-md shrink-0 ml-1.5">
                                  {st.progress_percent}%
                                </span>
                              )}
                            </div>
                          )
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
                  <h3 className="text-base font-bold text-slate-900">Nova Tarefa / Etapa</h3>
                  <p className="text-xs text-slate-500">Adicione uma tarefa avulsa a este projeto</p>
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

            {newTaskData.parent_stage_id && (
              <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200/80 text-xs text-indigo-950 flex items-center justify-between gap-2 shadow-2xs">
                <div className="flex items-center gap-2 truncate min-w-0">
                  <GitFork className="w-4 h-4 rotate-180 text-indigo-600 shrink-0" />
                  <span className="truncate">
                    Criando como subtarefa de:{' '}
                    <strong className="font-bold">
                      {stages.find((s) => s.id === newTaskData.parent_stage_id)?.name}
                    </strong>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setNewTaskData((prev) => ({ ...prev, parent_stage_id: null }))}
                  className="text-indigo-600 hover:text-rose-600 text-[11px] font-semibold underline shrink-0 cursor-pointer"
                  title="Remover vínculo e criar como tarefa avulsa de primeiro nível"
                >
                  Tornar avulsa
                </button>
              </div>
            )}

            <form onSubmit={handleCreateTaskSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                  Título da Tarefa *
                </label>
                <input
                  type="text"
                  required
                  value={newTaskData.name}
                  onChange={(e) => setNewTaskData({ ...newTaskData, name: e.target.value })}
                  placeholder="Ex: Estudo Preliminar, Render 3D, Detalhamento..."
                  className="w-full text-sm font-semibold border border-slate-200 rounded-xl p-3 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50/50 hover:bg-white transition-all text-slate-900"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                  Escopo e Instruções (Opcional)
                </label>
                <textarea
                  rows={2}
                  value={newTaskData.description}
                  onChange={(e) => setNewTaskData({ ...newTaskData, description: e.target.value })}
                  placeholder="Detalhes ou diretrizes operacionais para a equipe..."
                  className="w-full text-sm text-slate-800 border border-slate-200 rounded-xl p-3 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50/50 hover:bg-white transition-all resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                    Responsável
                  </label>
                  <div className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50/50 focus-within:bg-white focus-within:border-blue-500">
                    <User className="w-4 h-4 text-slate-400 shrink-0" />
                    <select
                      value={newTaskData.assigned_to}
                      onChange={(e) => setNewTaskData({ ...newTaskData, assigned_to: e.target.value })}
                      className="w-full text-sm font-semibold text-slate-800 bg-transparent outline-hidden cursor-pointer"
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
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
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
                    className="w-full text-sm font-semibold border border-slate-200 rounded-xl p-2.5 bg-slate-50/50 hover:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer text-slate-800"
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
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                    Data de Início
                  </label>
                  <div className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50/50 focus-within:bg-white focus-within:border-blue-500">
                    <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                    <input
                      type="date"
                      value={newTaskData.start_date}
                      onChange={(e) => handleNewTaskStartDateChange(e.target.value)}
                      className="w-full text-sm font-semibold text-slate-800 bg-transparent outline-hidden cursor-pointer"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                    Duração Sugerida
                  </label>
                  <div className="relative border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50/50 focus-within:bg-white focus-within:border-blue-500">
                    <input
                      type="number"
                      min={1}
                      value={newTaskData.duration_days}
                      onChange={(e) => handleNewTaskDurationChange(e.target.value)}
                      placeholder="Ex: 5"
                      className="w-full text-sm font-bold text-slate-800 bg-transparent outline-hidden pr-8 font-mono"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium pointer-events-none">
                      dias
                    </span>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                    Prazo Final
                  </label>
                  <div className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50/50 focus-within:bg-white focus-within:border-blue-500">
                    <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                    <input
                      type="date"
                      value={newTaskData.due_date}
                      onChange={(e) => handleNewTaskDueDateChange(e.target.value)}
                      className="w-full text-sm font-semibold text-slate-800 bg-transparent outline-hidden cursor-pointer"
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
                  <span className="text-sm text-slate-700 font-medium">Exige aprovação no Portal</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={creatingTask}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={creatingTask || !newTaskData.name.trim()}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {creatingTask ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Criando...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" /> Criar Tarefa
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
        allStages={stages}
        onClose={() => setSelectedTask(null)}
        onUpdateStage={handleStageUpdatedFromDrawer}
        onDeleteStage={(stageId, subtaskMode) => handleLocalStageDeleted(stageId, subtaskMode)}
        onSelectStage={(stage) => setSelectedTask(stage)}
        onCreateSubtask={(newSubtask) => {
          setStages((prev) => [...prev, newSubtask])
          if (newSubtask.parent_stage_id) {
            setExpandedStageIds((prev) => new Set([...prev, newSubtask.parent_stage_id!]))
          }
        }}
        onUnlinkSubtask={handleUnlinkSubtask}
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

      {/* Modal de Confirmação para Excluir Tarefa com Subtarefas */}
      {subtaskDeleteTarget && (
        <div className="fixed inset-0 z-60 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-rose-100 text-rose-600 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Excluir Tarefa com Subtarefas
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  A tarefa {subtaskDeleteTarget.stage.code ? `[${subtaskDeleteTarget.stage.code}] ` : ''}<strong>&quot;{subtaskDeleteTarget.stage.name}&quot;</strong> possui <strong>{subtaskDeleteTarget.subtasks.length} subtarefa(s) vinculada(s)</strong>. Como deseja prosseguir?
                </p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80 max-h-36 overflow-y-auto space-y-1.5 text-xs text-slate-600">
              <span className="font-bold text-slate-700 block mb-1">Subtarefas vinculadas:</span>
              {subtaskDeleteTarget.subtasks.map((s) => (
                <div key={s.id} className="flex items-center gap-1.5 truncate">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
                  {s.code && <span className="font-mono text-[10px] text-slate-400 font-semibold">{s.code}</span>}
                  <span className="truncate font-medium text-slate-800">{s.name}</span>
                </div>
              ))}
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => handleConfirmSubtaskModalDelete('cascade')}
                disabled={isDeletingWithSubtasks}
                className="w-full p-3 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-left transition-colors cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-rose-700 flex items-center gap-1.5">
                    <Trash2 className="w-4 h-4 text-rose-600" /> Excluir Tudo (Tarefa e {subtaskDeleteTarget.subtasks.length} Subtarefas)
                  </span>
                  {isDeletingWithSubtasks && <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-600" />}
                </div>
                <p className="text-[11px] text-rose-600/80 mt-1">
                  Move a tarefa principal e todas as suas subtarefas filhas para o histórico de tarefas excluídas.
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleConfirmSubtaskModalDelete('unlink')}
                disabled={isDeletingWithSubtasks}
                className="w-full p-3 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-left transition-colors cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-700 flex items-center gap-1.5">
                    <Unlink className="w-4 h-4 text-blue-600" /> Desvincular e Manter Subtarefas
                  </span>
                  {isDeletingWithSubtasks && <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />}
                </div>
                <p className="text-[11px] text-blue-600/80 mt-1">
                  Exclui apenas a tarefa principal. As subtarefas tornam-se tarefas independentes de primeiro nível no projeto.
                </p>
              </button>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSubtaskDeleteTarget(null)}
                disabled={isDeletingWithSubtasks}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE HISTÓRICO DE TAREFAS EXCLUÍDAS */}
      {isDeletedModalOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center p-4">
          <div
            onClick={() => setIsDeletedModalOpen(false)}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity animate-in fade-in"
          />
          <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full p-6 space-y-4 z-10 animate-in zoom-in-95 duration-200 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                  <History className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Histórico de Tarefas Excluídas</h3>
                  <p className="text-xs text-slate-500">
                    Tarefas excluídas deste projeto ({deletedStages.length})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDeletedModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
              {deletedStages.length === 0 ? (
                <div className="py-12 text-center text-slate-400 space-y-1">
                  <p className="text-sm font-semibold text-slate-600">Nenhuma tarefa foi excluída</p>
                  <p className="text-xs">Todas as tarefas criadas neste projeto continuam ativas.</p>
                </div>
              ) : (
                deletedStages.map((dt) => (
                  <div
                    key={dt.id}
                    className="p-3.5 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200 flex items-center justify-between gap-3 transition-colors text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="font-mono font-bold px-2 py-0.5 rounded-md bg-white text-slate-700 border border-slate-200/80 shrink-0">
                        {dt.code || 'Sem código'}
                      </span>
                      <div className="truncate">
                        <span className="font-bold text-slate-800 text-sm block truncate">
                          {dt.name}
                        </span>
                        <span className="text-slate-500 text-[11px] block mt-0.5">
                          Excluída em {formatDeletedAt(dt.deleted_at)} por <strong className="text-slate-700">{dt.deleted_by_name || 'Usuário'}</strong>
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={restoringStageId === dt.id}
                      onClick={() => handleRestoreDeletedStage(dt.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-blue-400 text-slate-700 hover:text-blue-600 font-semibold shadow-2xs transition-colors cursor-pointer shrink-0"
                    >
                      {restoringStageId === dt.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RotateCcw className="w-3.5 h-3.5" />
                      )}
                      Restaurar
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setIsDeletedModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-xs transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
