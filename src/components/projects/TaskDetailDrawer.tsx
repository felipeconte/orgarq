'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import {
  X,
  CheckCircle2,
  Clock,
  Send,
  Unlock,
  Check,
  Calendar,
  User,
  ListTodo,
  Paperclip,
  MessageSquare,
  Plus,
  Trash2,
  ExternalLink,
  Save,
  Loader2,
  FileCheck,
  ShieldCheck,
  AlertCircle,
  UploadCloud,
  FileText,
  Image as ImageIcon,
  File,
  Link2,
  Download,
  AlertTriangle,
  Pencil,
  Flag,
  Eye,
  EyeOff,
  Globe,
  GitFork,
  ChevronRight,
  Unlink,
  ListTree
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  updateStageFullDetailsAction,
  toggleStageChecklistItemAction,
  addStageChecklistItemAction,
  editStageChecklistItemAction,
  deleteStageChecklistItemAction,
  addStageCommentAction,
  editStageCommentAction,
  deleteStageCommentAction,
  addStageAttachmentAction,
  uploadStageAttachmentFileAction,
  editStageAttachmentAction,
  toggleStageAttachmentVisibilityAction,
  deleteStageAttachmentAction,
  deleteStageAction,
  createStageAction,
  unlinkSubtaskAction,
  ChecklistItem,
  StageComment,
  StageAttachment
} from '@/lib/actions/stages'
import {
  formatDateBR,
  formatDateTimeBR,
  calculateDueDateFromDuration,
  calculateDurationDays,
  getTaskTimelineStatus
} from '@/lib/date-utils'
import { useConfirm, useAlert, usePromptSaveOrDiscard } from '@/components/ui/ConfirmDialog'
import {
  WorkflowStage,
  DEFAULT_WORKFLOW_STAGES,
  getStageConfig,
  canMoveToFinalStage,
  getFinalStage
} from '@/lib/workflow-stages'

export interface MemberOption {
  id: string
  name: string
  email?: string | null
  role?: string
  avatarUrl?: string | null
}

export interface TaskDetailData {
  id: string
  project_id: string
  name: string
  description: string | null
  stage_order: number
  status: string
  progress_percent: number
  assigned_to: string | null
  start_date: string | null
  due_date: string | null
  duration_days?: number | null
  is_client_approval_required: boolean
  is_locked_for_client: boolean
  checklist?: ChecklistItem[]
  comments?: StageComment[]
  attachments?: StageAttachment[]
  parent_stage_id?: string | null
  code?: string | null
  deleted_at?: string | null
  deleted_by?: string | null
  created_at?: string
}

export interface TaskDetailDrawerProps {
  stage: TaskDetailData | null
  projectId: string
  portalToken?: string
  members?: MemberOption[]
  workflowStages?: WorkflowStage[]
  allStages?: TaskDetailData[]
  onClose: () => void
  onUpdateStage: (updated: TaskDetailData) => void
  onDeleteStage?: (stageId: string, subtaskMode?: 'cascade' | 'unlink') => void
  onSelectStage?: (stage: TaskDetailData) => void
  onCreateSubtask?: (newSubtask: TaskDetailData) => void
  onUnlinkSubtask?: (stageId: string) => void
}

export default function TaskDetailDrawer({
  stage,
  projectId,
  portalToken,
  members = [],
  workflowStages = [],
  allStages = [],
  onClose,
  onUpdateStage,
  onDeleteStage,
  onSelectStage,
  onCreateSubtask,
  onUnlinkSubtask,
}: TaskDetailDrawerProps) {
  const confirm = useConfirm()
  const showAlert = useAlert()
  const promptSaveOrDiscard = usePromptSaveOrDiscard()

  const [deletingStage, setDeletingStage] = useState(false)
  const [formData, setFormData] = useState<{
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

  // Baseline to track unsaved changes in general fields
  const [initialFormData, setInitialFormData] = useState<{
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

  const [checklist, setChecklist] = useState<ChecklistItem[]>([])
  const [comments, setComments] = useState<StageComment[]>([])
  const [attachments, setAttachments] = useState<StageAttachment[]>([])

  const [newChecklistText, setNewChecklistText] = useState('')
  const [newChecklistDueDate, setNewChecklistDueDate] = useState('')
  const [newChecklistAssignedTo, setNewChecklistAssignedTo] = useState('')
  const [editingChecklistItemId, setEditingChecklistItemId] = useState<string | null>(null)
  const [editingChecklistText, setEditingChecklistText] = useState('')
  const [editingChecklistDueDate, setEditingChecklistDueDate] = useState('')
  const [editingChecklistAssignedTo, setEditingChecklistAssignedTo] = useState('')
  const [savingChecklistItemId, setSavingChecklistItemId] = useState<string | null>(null)

  const [newCommentText, setNewCommentText] = useState('')
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [editingCommentText, setEditingCommentText] = useState('')
  const [savingCommentId, setSavingCommentId] = useState<string | null>(null)

  // Attachments State
  const [showAddAttachment, setShowAddAttachment] = useState(false)
  const [attachmentMode, setAttachmentMode] = useState<'file' | 'link'>('file')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [newAttachmentName, setNewAttachmentName] = useState('')
  const [newAttachmentUrl, setNewAttachmentUrl] = useState('')
  const [newAttachmentVisibleToClient, setNewAttachmentVisibleToClient] = useState(false)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [togglingVisibilityId, setTogglingVisibilityId] = useState<string | null>(null)
  const [attachmentError, setAttachmentError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Edit Attachment Name State
  const [editingAttachmentId, setEditingAttachmentId] = useState<string | null>(null)
  const [editingAttachmentName, setEditingAttachmentName] = useState('')
  const [savingAttachmentId, setSavingAttachmentId] = useState<string | null>(null)

  // Subtasks State
  const [showAddSubtask, setShowAddSubtask] = useState(false)
  const [newSubtaskName, setNewSubtaskName] = useState('')
  const [newSubtaskAssignedTo, setNewSubtaskAssignedTo] = useState('')
  const [newSubtaskDueDate, setNewSubtaskDueDate] = useState('')
  const [creatingSubtask, setCreatingSubtask] = useState(false)
  const [subtaskDeleteModalOpen, setSubtaskDeleteModalOpen] = useState(false)
  const [unlinkingSubtaskId, setUnlinkingSubtaskId] = useState<string | null>(null)

  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  // Sincroniza estado quando o stage selecionado mudar
  useEffect(() => {
    if (stage) {
      const initialDur: number | '' =
        stage.duration_days != null
          ? Number(stage.duration_days)
          : (calculateDurationDays(stage.start_date, stage.due_date) ?? '')

      const initial: {
        name: string
        description: string
        assigned_to: string
        start_date: string
        due_date: string
        duration_days: number | ''
        status: string
        is_client_approval_required: boolean
      } = {
        name: stage.name || '',
        description: stage.description || '',
        assigned_to: stage.assigned_to || '',
        start_date: stage.start_date || '',
        due_date: stage.due_date || '',
        duration_days: initialDur,
        status: stage.status,
        is_client_approval_required: stage.is_client_approval_required ?? true,
      }
      setFormData(initial)
      setInitialFormData(initial)
      setChecklist(Array.isArray(stage.checklist) ? stage.checklist : [])
      setComments(Array.isArray(stage.comments) ? stage.comments : [])
      setAttachments(Array.isArray(stage.attachments) ? stage.attachments : [])
      setShowAddAttachment(false)
      setSelectedFile(null)
      setNewAttachmentName('')
      setNewAttachmentUrl('')
      setAttachmentError(null)
      setEditingChecklistItemId(null)
      setEditingCommentId(null)
      setEditingAttachmentId(null)
      setEditingAttachmentName('')
    }
  }, [stage])

  // Handlers para cálculo bidirecional de Datas e Duração
  const handleStartDateChange = (newStart: string) => {
    let newDue = formData.due_date
    if (newStart && formData.duration_days !== '' && Number(formData.duration_days) > 0) {
      newDue = calculateDueDateFromDuration(newStart, Number(formData.duration_days))
    } else if (newStart && newDue) {
      const calculatedDays = calculateDurationDays(newStart, newDue)
      if (calculatedDays) {
        setFormData((prev) => ({
          ...prev,
          start_date: newStart,
          due_date: newDue,
          duration_days: calculatedDays,
        }))
        return
      }
    }
    setFormData((prev) => ({ ...prev, start_date: newStart, due_date: newDue }))
  }

  const handleDurationChange = (val: string) => {
    const parsed = val === '' ? '' : Math.max(1, parseInt(val) || 1)
    let newDue = formData.due_date
    if (formData.start_date && parsed !== '') {
      newDue = calculateDueDateFromDuration(formData.start_date, Number(parsed))
    }
    setFormData((prev) => ({ ...prev, duration_days: parsed, due_date: newDue }))
  }

  const handleDueDateChange = (newDue: string) => {
    let newDuration: number | '' = formData.duration_days
    if (formData.start_date && newDue) {
      const calculatedDays = calculateDurationDays(formData.start_date, newDue)
      if (calculatedDays) {
        newDuration = calculatedDays
      }
    }
    setFormData((prev) => ({ ...prev, due_date: newDue, duration_days: newDuration }))
  }

  // Trava a rolagem da página de fundo (background) enquanto a gaveta de tarefa estiver aberta
  useEffect(() => {
    if (stage) {
      const originalOverflow = document.body.style.overflow
      const originalPaddingRight = document.body.style.paddingRight

      // Previne shift de layout se houver scrollbar visível
      const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth
      if (scrollBarWidth > 0) {
        document.body.style.paddingRight = `${scrollBarWidth}px`
      }
      document.body.style.overflow = 'hidden'

      return () => {
        document.body.style.overflow = originalOverflow
        document.body.style.paddingRight = originalPaddingRight
      }
    }
  }, [stage])

  // Identifica se há alterações não salvas nos campos principais da tarefa
  const isDirty = useMemo(() => {
    return (
      (formData.name ?? '') !== (initialFormData.name ?? '') ||
      (formData.description ?? '') !== (initialFormData.description ?? '') ||
      (formData.assigned_to ?? '') !== (initialFormData.assigned_to ?? '') ||
      (formData.start_date ?? '') !== (initialFormData.start_date ?? '') ||
      (formData.due_date ?? '') !== (initialFormData.due_date ?? '') ||
      formData.status !== initialFormData.status ||
      Boolean(formData.is_client_approval_required) !== Boolean(initialFormData.is_client_approval_required)
    )
  }, [formData, initialFormData])

  // Helper para montar objeto TaskDetailData tipado
  const getUpdatedTaskData = useCallback(
    (overrides?: Partial<TaskDetailData>): TaskDetailData => ({
      ...(stage || ({} as TaskDetailData)),
      name: formData.name,
      description: formData.description,
      assigned_to: formData.assigned_to || null,
      start_date: formData.start_date || null,
      due_date: formData.due_date || null,
      duration_days: typeof formData.duration_days === 'number' ? formData.duration_days : null,
      status: formData.status,
      is_client_approval_required: formData.is_client_approval_required,
      checklist,
      comments,
      attachments,
      ...overrides,
    }),
    [stage, formData, checklist, comments, attachments]
  )

  // Save Full Details (Campos Principais)
  const handleSaveDetails = useCallback(async (): Promise<boolean> => {
    if (!stage) return false
    setSaving(true)
    const res = await updateStageFullDetailsAction(projectId, stage.id, {
      name: formData.name,
      description: formData.description,
      assigned_to: formData.assigned_to || null,
      start_date: formData.start_date || null,
      due_date: formData.due_date || null,
      status: formData.status,
      is_client_approval_required: formData.is_client_approval_required,
    })
    setSaving(false)

    if (res.success) {
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 2000)
      setInitialFormData({ ...formData })
      const nextComments = res.comments || comments
      if (res.comments) {
        setComments(res.comments)
      }
      onUpdateStage(
        getUpdatedTaskData({
          comments: nextComments,
        })
      )
      return true
    } else {
      await showAlert({
        title: 'Erro ao salvar',
        message: res.error || 'Erro ao salvar alterações da tarefa.',
        variant: 'error',
      })
      return false
    }
  }, [projectId, stage, formData, comments, onUpdateStage, showAlert, getUpdatedTaskData])

  // Intercepta o fechamento se houver alterações não salvas
  const handleAttemptClose = useCallback(async () => {
    if (isDirty) {
      const choice = await promptSaveOrDiscard({
        title: 'Salvar alterações da tarefa?',
        message: 'Você realizou alterações nos campos desta tarefa que ainda não foram salvas.',
        description: 'Deseja salvar as alterações antes de fechar?',
        saveText: 'Salvar e Sair',
        discardText: 'Sair sem Salvar',
        cancelText: 'Continuar Editando',
      })

      if (choice === 'save') {
        const saved = await handleSaveDetails()
        if (saved) {
          onClose()
        }
      } else if (choice === 'discard') {
        onClose()
      }
      // Se 'cancel', não faz nada e permanece na edição da tarefa
    } else {
      onClose()
    }
  }, [isDirty, promptSaveOrDiscard, handleSaveDetails, onClose])

  // Listener para fechar com tecla Escape respeitando alterações não salvas
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleAttemptClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleAttemptClose])

  // Subtarefas diretas desta etapa
  const subtasks = useMemo(() => {
    if (!stage?.id || !allStages) return []
    return allStages.filter((s) => s.parent_stage_id === stage.id)
  }, [stage?.id, allStages])

  // Subtarefas concluídas
  const completedSubtasksCount = useMemo(() => {
    return subtasks.filter((s) => {
      const cfg = (workflowStages || DEFAULT_WORKFLOW_STAGES).find((ws) => ws.id === s.status)
      return s.status === 'concluido' || Boolean(cfg?.is_final_stage)
    }).length
  }, [subtasks, workflowStages])

  const subtaskProgressPercent = subtasks.length > 0
    ? Math.round((completedSubtasksCount / subtasks.length) * 100)
    : 0

  // Cadeia de tarefas ancestrais (para navegação em múltiplos níveis)
  const ancestors = useMemo(() => {
    if (!stage?.parent_stage_id || !allStages) return []
    const list: TaskDetailData[] = []
    let currId: string | null = stage.parent_stage_id
    const visited = new Set<string>()
    while (currId && !visited.has(currId)) {
      visited.add(currId)
      const p = allStages.find((s) => s.id === currId)
      if (p) {
        list.unshift(p)
        currId = p.parent_stage_id || null
      } else {
        break
      }
    }
    return list
  }, [stage?.parent_stage_id, allStages])

  const handleNavigateToTask = useCallback(
    async (targetTask: TaskDetailData) => {
      if (isDirty) {
        const choice = await promptSaveOrDiscard({
          title: 'Salvar alterações da tarefa atual?',
          message: 'Você possui alterações não salvas nesta tarefa.',
          description: 'Deseja salvar antes de navegar para a outra tarefa?',
          saveText: 'Salvar e Abrir',
          discardText: 'Abrir sem Salvar',
          cancelText: 'Continuar Aqui',
        })

        if (choice === 'save') {
          const saved = await handleSaveDetails()
          if (saved) {
            onSelectStage?.(targetTask)
          }
        } else if (choice === 'discard') {
          onSelectStage?.(targetTask)
        }
        return
      }
      onSelectStage?.(targetTask)
    },
    [isDirty, promptSaveOrDiscard, handleSaveDetails, onSelectStage]
  )

  const handleCreateSubtaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = newSubtaskName.trim()
    if (!trimmed || !stage) return

    setCreatingSubtask(true)
    const res = await createStageAction(projectId, {
      name: trimmed,
      assigned_to: newSubtaskAssignedTo || null,
      due_date: newSubtaskDueDate || null,
      parent_stage_id: stage.id,
      status: 'a_iniciar',
      is_client_approval_required: false,
    })
    setCreatingSubtask(false)

    if (res.success && res.stage) {
      const created = res.stage as TaskDetailData
      if (onCreateSubtask) {
        onCreateSubtask(created)
      }
      setNewSubtaskName('')
      setNewSubtaskAssignedTo('')
      setNewSubtaskDueDate('')
      setShowAddSubtask(false)
    } else {
      await showAlert({
        title: 'Erro ao criar subtarefa',
        message: res.error || 'Não foi possível criar a subtarefa.',
        variant: 'error',
      })
    }
  }

  const handleUnlinkCurrentFromParent = async () => {
    if (!stage?.parent_stage_id) return
    const confirmed = await confirm({
      title: 'Desvincular da Tarefa Principal',
      message: `Deseja transformar a subtarefa "${stage.name}" em uma tarefa principal independente?`,
      description: 'Ela deixará de ser listada como subtarefa e passará a ser uma tarefa normal no projeto.',
      confirmText: 'Desvincular',
      cancelText: 'Cancelar',
      variant: 'info',
    })

    if (!confirmed) return

    const res = await unlinkSubtaskAction(projectId, stage.id)
    if (res.success) {
      const updated = { ...stage, parent_stage_id: null }
      onUpdateStage(updated)
      if (onUnlinkSubtask) {
        onUnlinkSubtask(stage.id)
      }
    } else {
      await showAlert({
        title: 'Erro ao desvincular',
        message: res.error || 'Não foi possível desvincular a subtarefa.',
        variant: 'error',
      })
    }
  }

  const handleUnlinkChildSubtask = async (child: TaskDetailData) => {
    const confirmed = await confirm({
      title: 'Desvincular Subtarefa',
      message: `Deseja desvincular "${child.name}" desta tarefa?`,
      description: 'Ela se tornará uma tarefa independente de primeiro nível no projeto.',
      confirmText: 'Desvincular',
      cancelText: 'Cancelar',
      variant: 'info',
    })

    if (!confirmed) return

    setUnlinkingSubtaskId(child.id)
    const res = await unlinkSubtaskAction(projectId, child.id)
    setUnlinkingSubtaskId(null)

    if (res.success) {
      const updated = { ...child, parent_stage_id: null }
      onUpdateStage(updated)
      if (onUnlinkSubtask) {
        onUnlinkSubtask(child.id)
      }
    } else {
      await showAlert({
        title: 'Erro ao desvincular',
        message: res.error || 'Não foi possível desvincular a subtarefa.',
        variant: 'error',
      })
    }
  }

  const handleDeleteChildSubtask = async (child: TaskDetailData) => {
    const codeDisplay = child.code ? `[${child.code}] ` : ''
    const confirmed = await confirm({
      title: 'Excluir Subtarefa',
      message: `Tem certeza que deseja excluir a subtarefa ${codeDisplay}"${child.name}"?`,
      description: 'A subtarefa será movida para o histórico de tarefas excluídas e poderá ser restaurada posteriormente.',
      confirmText: 'Excluir Subtarefa',
      cancelText: 'Cancelar',
      variant: 'danger',
    })

    if (!confirmed) return

    const res = await deleteStageAction(projectId, child.id, 'cascade')
    if (res.success) {
      if (onDeleteStage) {
        onDeleteStage(child.id, 'cascade')
      }
    } else {
      await showAlert({
        title: 'Erro ao excluir subtarefa',
        message: res.error || 'Não foi possível excluir a subtarefa.',
        variant: 'error',
      })
    }
  }

  const handleConfirmDeleteWithSubtasks = async (mode: 'cascade' | 'unlink') => {
    if (!stage) return
    setDeletingStage(true)
    const res = await deleteStageAction(projectId, stage.id, mode)
    setDeletingStage(false)
    setSubtaskDeleteModalOpen(false)

    if (res.success) {
      if (onDeleteStage) {
        onDeleteStage(stage.id, mode)
      }
      onClose()
    } else {
      await showAlert({
        title: 'Erro ao excluir tarefa',
        message: res.error || 'Não foi possível excluir a tarefa.',
        variant: 'error',
      })
    }
  }

  const currentStageConfig = (workflowStages || DEFAULT_WORKFLOW_STAGES).find((s) => s.id === formData.status)
  const isTaskFinalized = Boolean(currentStageConfig?.is_final_stage || formData.status === 'concluido')
  const timelineStatus = getTaskTimelineStatus(formData.start_date, formData.due_date, isTaskFinalized)

  const handleStatusSelectChange = async (newStatus: string) => {
    if (!stage) return
    const targetCfg = (workflowStages || DEFAULT_WORKFLOW_STAGES).find((s) => s.id === newStatus)
    if (targetCfg?.is_final_stage && newStatus !== stage.status) {
      const check = canMoveToFinalStage(getUpdatedTaskData({ status: newStatus }), workflowStages)
      if (!check.allowed) {
        await showAlert({
          title: 'Etapa Conclusiva Bloqueada',
          message: 'Esta tarefa não pode ser colocada na etapa finalizada:',
          description: check.reasons.join('\n'),
          variant: 'warning',
        })
        return
      }
    }

    const isApprovedStage = Boolean(
      targetCfg?.is_approved_stage ||
      targetCfg?.name?.toLowerCase().includes('aprovad') ||
      newStatus === 'concluido'
    )

    if (isApprovedStage && newStatus !== stage?.status) {
      const stageName = stage?.name || 'esta tarefa'
      const targetStageName = targetCfg?.name || 'Aprovado'

      const confirmed = await confirm({
        title: 'Confirmar Aprovação da Tarefa',
        message: `Deseja marcar a tarefa "${stageName}" como "${targetStageName}"?`,
        description:
          'Atenção: Ao realizar esta ação manualmente, seu usuário será registrado como o responsável pela aprovação no histórico de auditoria do projeto.',
        confirmText: 'Confirmar e Aprovar',
        cancelText: 'Cancelar',
        variant: 'primary',
      })

      if (!confirmed) {
        return
      }
    }

    setFormData({ ...formData, status: newStatus })
  }

  // Delete Stage Action
  const handleDeleteCurrentStage = async () => {
    if (!stage) return

    // Se possui subtarefas vinculadas, exibe modal inteligente com escolhas (P2: A)
    if (subtasks.length > 0) {
      setSubtaskDeleteModalOpen(true)
      return
    }

    const codeDisplay = stage.code ? `[${stage.code}] ` : ''
    const confirmed = await confirm({
      title: 'Excluir Tarefa',
      message: `Tem certeza que deseja excluir a tarefa ${codeDisplay}"${stage.name}"?`,
      description: 'A tarefa será movida para o histórico de tarefas excluídas e poderá ser restaurada a qualquer momento.',
      confirmText: 'Excluir Tarefa',
      cancelText: 'Cancelar',
      variant: 'danger',
    })

    if (confirmed) {
      setDeletingStage(true)
      const res = await deleteStageAction(projectId, stage.id, 'cascade')
      setDeletingStage(false)
      if (res.success) {
        if (onDeleteStage) {
          onDeleteStage(stage.id, 'cascade')
        }
        onClose()
      } else {
        await showAlert({
          title: 'Erro ao excluir',
          message: res.error || 'Erro ao excluir tarefa.',
          variant: 'error',
        })
      }
    }
  }

  // Checklist Actions
  const handleToggleChecklist = async (itemId: string, currentCompleted: boolean) => {
    if (!stage) return
    const updated = checklist.map((item) =>
      item.id === itemId ? { ...item, completed: !currentCompleted } : item
    )
    setChecklist(updated)
    onUpdateStage(getUpdatedTaskData({ checklist: updated }))
    await toggleStageChecklistItemAction(projectId, stage.id, itemId, !currentCompleted)
  }

  const handleAddChecklistItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newChecklistText.trim() || !stage) return

    const res = await addStageChecklistItemAction(
      projectId,
      stage.id,
      newChecklistText,
      newChecklistDueDate || null,
      newChecklistAssignedTo || null
    )
    if (res.success && res.item) {
      const updated = [...checklist, res.item]
      setChecklist(updated)
      onUpdateStage(getUpdatedTaskData({ checklist: updated }))
      setNewChecklistText('')
      setNewChecklistDueDate('')
      setNewChecklistAssignedTo('')
    }
  }

  const handleStartEditChecklist = (item: ChecklistItem) => {
    setEditingChecklistItemId(item.id)
    setEditingChecklistText(item.text)
    setEditingChecklistDueDate(item.due_date || '')
    setEditingChecklistAssignedTo(item.assigned_to || '')
  }

  const handleCancelEditChecklist = () => {
    setEditingChecklistItemId(null)
    setEditingChecklistText('')
    setEditingChecklistDueDate('')
    setEditingChecklistAssignedTo('')
  }

  const handleSaveEditChecklist = async (itemId: string) => {
    if (!editingChecklistText.trim() || !stage) return
    setSavingChecklistItemId(itemId)

    const res = await editStageChecklistItemAction(
      projectId,
      stage.id,
      itemId,
      editingChecklistText,
      editingChecklistDueDate || null,
      editingChecklistAssignedTo || null
    )
    setSavingChecklistItemId(null)

    if (res.success && res.item) {
      const updated = checklist.map((item) => (item.id === itemId ? res.item! : item))
      setChecklist(updated)
      onUpdateStage(getUpdatedTaskData({ checklist: updated }))
      setEditingChecklistItemId(null)
      setEditingChecklistText('')
      setEditingChecklistDueDate('')
      setEditingChecklistAssignedTo('')
    } else {
      await showAlert({
        title: 'Erro ao editar checklist',
        message: res.error || 'Erro ao salvar alterações no item do checklist.',
        variant: 'error',
      })
    }
  }

  const handleDeleteChecklistItem = async (itemId: string) => {
    if (!stage) return
    const updated = checklist.filter((item) => item.id !== itemId)
    setChecklist(updated)
    onUpdateStage(getUpdatedTaskData({ checklist: updated }))
    await deleteStageChecklistItemAction(projectId, stage.id, itemId)
  }

  // Helper para buscar nome do membro
  const getMemberName = (userId?: string | null) => {
    if (!userId) return null
    const member = members.find((m) => m.id === userId)
    return member ? member.name : null
  }

  // Formata data prevista (YYYY-MM-DD -> DD/MM/AAAA)
  const formatDueDate = (dateStr?: string | null) => {
    return formatDateBR(dateStr) || null
  }

  // Comments Actions (Persistência Imediata)
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCommentText.trim() || !stage) return

    const res = await addStageCommentAction(projectId, stage.id, newCommentText)
    if (res.success && res.comment) {
      const updated = [res.comment, ...comments]
      setComments(updated)
      onUpdateStage(getUpdatedTaskData({ comments: updated }))
      setNewCommentText('')
    }
  }

  const handleStartEditComment = (comment: StageComment) => {
    setEditingCommentId(comment.id)
    setEditingCommentText(comment.text)
  }

  const handleCancelEditComment = () => {
    setEditingCommentId(null)
    setEditingCommentText('')
  }

  const handleSaveEditComment = async (commentId: string) => {
    if (!editingCommentText.trim() || !stage) return
    setSavingCommentId(commentId)

    const res = await editStageCommentAction(projectId, stage.id, commentId, editingCommentText)
    setSavingCommentId(null)

    if (res.success && res.comment) {
      const updated = comments.map((c) => (c.id === commentId ? res.comment! : c))
      setComments(updated)
      onUpdateStage(getUpdatedTaskData({ comments: updated }))
      setEditingCommentId(null)
      setEditingCommentText('')
    } else {
      await showAlert({
        title: 'Erro ao editar comentário',
        message: res.error || 'Erro ao editar comentário.',
        variant: 'error',
      })
    }
  }

  const handleDeleteComment = async (commentId: string) => {
    if (!stage) return
    const confirmed = await confirm({
      title: 'Excluir Comentário',
      message: 'Tem certeza que deseja excluir este comentário permanentemente?',
      confirmText: 'Excluir',
      cancelText: 'Cancelar',
      variant: 'danger',
    })

    if (confirmed) {
      const updated = comments.filter((c) => c.id !== commentId)
      setComments(updated)
      onUpdateStage(getUpdatedTaskData({ comments: updated }))
      await deleteStageCommentAction(projectId, stage.id, commentId)
    }
  }

  // Upload File to Supabase Storage (Persistência Imediata)
  const handleUploadFileSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setAttachmentError(null)

    if (!selectedFile || !stage) {
      setAttachmentError('Por favor, selecione um arquivo no seu dispositivo.')
      return
    }

    setUploadingFile(true)
    const displayName = newAttachmentName.trim() || selectedFile.name
    const sanitizedFileName = displayName.replace(/[^a-zA-Z0-9._-]/g, '_')
    const storagePath = `${projectId}/${stage.id}/${Date.now()}_${sanitizedFileName}`

    const formatSize = (bytes: number) => {
      if (bytes < 1024) return `${bytes} B`
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    }

    // 1. Tenta upload direto pelo cliente do navegador (streaming rápido, sem limite de 1MB do Next.js)
    try {
      const supabase = createClient()
      const { error: storageError } = await supabase.storage
        .from('task-attachments')
        .upload(storagePath, selectedFile, {
          cacheControl: '3600',
          upsert: true,
        })

      if (!storageError) {
        let fileUrl = ''
        const { data: signedData } = await supabase.storage
          .from('task-attachments')
          .createSignedUrl(storagePath, 60 * 60 * 24 * 365)

        if (signedData?.signedUrl) {
          fileUrl = signedData.signedUrl
        } else {
          const { data: publicData } = supabase.storage
            .from('task-attachments')
            .getPublicUrl(storagePath)
          fileUrl = publicData.publicUrl
        }

        const res = await addStageAttachmentAction(projectId, stage.id, {
          name: displayName,
          url: fileUrl,
          size: formatSize(selectedFile.size),
          is_visible_to_client: newAttachmentVisibleToClient,
        })

        if (res.success && res.attachment) {
          const updated = [...attachments, res.attachment]
          setAttachments(updated)
          onUpdateStage(getUpdatedTaskData({ attachments: updated }))
          setSelectedFile(null)
          setNewAttachmentName('')
          setNewAttachmentVisibleToClient(false)
          setShowAddAttachment(false)
          setUploadingFile(false)
          return
        }
      }
    } catch (clientErr) {
      console.warn('Client upload fallback:', clientErr)
    }

    // 2. Fallback via Server Action
    try {
      const uploadData = new FormData()
      uploadData.append('file', selectedFile)
      if (newAttachmentName.trim()) {
        uploadData.append('name', newAttachmentName.trim())
      }
      uploadData.append('isVisibleToClient', String(newAttachmentVisibleToClient))

      const res = await uploadStageAttachmentFileAction(projectId, stage.id, uploadData)
      if (res.success && res.attachment) {
        const updated = [...attachments, res.attachment]
        setAttachments(updated)
        onUpdateStage(getUpdatedTaskData({ attachments: updated }))
        setSelectedFile(null)
        setNewAttachmentName('')
        setNewAttachmentVisibleToClient(false)
        setShowAddAttachment(false)
      } else {
        setAttachmentError(
          res.error || 'Erro ao enviar arquivo para o Supabase Storage. Verifique se o bucket foi criado.'
        )
      }
    } catch (err: any) {
      setAttachmentError(err?.message || 'Erro no envio do arquivo.')
    } finally {
      setUploadingFile(false)
    }
  }


  // Attach External Link (Persistência Imediata)
  const handleAddLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setAttachmentError(null)

    if (!stage || !newAttachmentName.trim() || !newAttachmentUrl.trim()) {
      setAttachmentError('Nome e URL do link são obrigatórios.')
      return
    }

    const res = await addStageAttachmentAction(projectId, stage.id, {
      name: newAttachmentName.trim(),
      url: newAttachmentUrl.trim(),
      size: 'Link Externo',
      is_visible_to_client: newAttachmentVisibleToClient,
    })

    if (res.success && res.attachment) {
      const updated = [...attachments, res.attachment]
      setAttachments(updated)
      onUpdateStage(getUpdatedTaskData({ attachments: updated }))
      setNewAttachmentName('')
      setNewAttachmentUrl('')
      setNewAttachmentVisibleToClient(false)
      setShowAddAttachment(false)
    } else {
      setAttachmentError(res.error || 'Erro ao anexar link.')
    }
  }

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!stage) return
    const confirmed = await confirm({
      title: 'Remover Anexo',
      message: 'Tem certeza que deseja remover este anexo?',
      confirmText: 'Remover',
      cancelText: 'Cancelar',
      variant: 'danger',
    })

    if (confirmed) {
      const updated = attachments.filter((att) => att.id !== attachmentId)
      setAttachments(updated)
      onUpdateStage(getUpdatedTaskData({ attachments: updated }))
      await deleteStageAttachmentAction(projectId, stage.id, attachmentId)
    }
  }

  const handleStartEditAttachment = (attachment: StageAttachment) => {
    setEditingAttachmentId(attachment.id)
    setEditingAttachmentName(attachment.name)
  }

  const handleCancelEditAttachment = () => {
    setEditingAttachmentId(null)
    setEditingAttachmentName('')
  }

  const handleSaveEditAttachment = async (attachmentId: string) => {
    const trimmed = editingAttachmentName.trim()
    if (!trimmed || !stage) return
    setSavingAttachmentId(attachmentId)

    const res = await editStageAttachmentAction(projectId, stage.id, attachmentId, trimmed)
    setSavingAttachmentId(null)

    if (res.success && res.attachment) {
      const updated = attachments.map((att) => (att.id === attachmentId ? res.attachment! : att))
      setAttachments(updated)
      onUpdateStage(getUpdatedTaskData({ attachments: updated }))
      setEditingAttachmentId(null)
      setEditingAttachmentName('')
    } else {
      await showAlert({
        title: 'Erro ao editar anexo',
        message: res.error || 'Erro ao atualizar o nome do anexo.',
        variant: 'error',
      })
    }
  }

  const handleToggleAttachmentVisibility = async (attachment: StageAttachment) => {
    if (!stage) return
    const current = attachment.is_visible_to_client !== false
    const nextVal = !current

    const confirmed = await confirm({
      title: nextVal ? 'Exibir Anexo no Portal' : 'Ocultar Anexo do Portal',
      message: nextVal
        ? `Deseja liberar o anexo "${attachment.name}" para visualização no portal do cliente?`
        : `Deseja ocultar o anexo "${attachment.name}" do portal do cliente?`,
      description: nextVal
        ? 'O cliente poderá visualizar e baixar este arquivo durante a etapa de aprovação.'
        : 'Este arquivo passará a ser de uso interno e não ficará visível para o cliente no portal.',
      confirmText: nextVal ? 'Liberar no Portal' : 'Ocultar Anexo',
      cancelText: 'Cancelar',
      variant: nextVal ? 'primary' : 'warning',
    })

    if (!confirmed) return

    setTogglingVisibilityId(attachment.id)

    const res = await toggleStageAttachmentVisibilityAction(projectId, stage.id, attachment.id, nextVal)
    setTogglingVisibilityId(null)

    if (res.success && res.attachment) {
      const updated = attachments.map((att) => (att.id === attachment.id ? res.attachment! : att))
      setAttachments(updated)
      onUpdateStage(getUpdatedTaskData({ attachments: updated }))
    } else {
      await showAlert({
        title: 'Erro ao alterar visibilidade',
        message: res.error || 'Não foi possível alterar a visibilidade do anexo no portal.',
        variant: 'error',
      })
    }
  }

  // Helper para ícones de arquivos
  const getFileIcon = (fileName: string, url: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase() || ''
    if (['pdf'].includes(ext)) return <FileText className="w-4 h-4 text-rose-600 shrink-0" />
    if (['jpg', 'jpeg', 'png', 'webp', 'svg', 'gif'].includes(ext))
      return <ImageIcon className="w-4 h-4 text-blue-600 shrink-0" />
    if (['dwg', 'dxf', 'rvt', 'ifc', 'skp'].includes(ext))
      return <File className="w-4 h-4 text-indigo-600 shrink-0" />
    if (url.startsWith('http') && !url.includes('supabase.co'))
      return <Link2 className="w-4 h-4 text-emerald-600 shrink-0" />
    return <Paperclip className="w-4 h-4 text-slate-500 shrink-0" />
  }

  if (!stage) return null

  return (
    <div className="fixed inset-0 z-50 overflow-hidden antialiased overscroll-contain">
      {/* Backdrop */}
      <div
        onClick={handleAttemptClose}
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex overscroll-contain">
        {/* Slide-over Container (60% da tela) */}
        <div className="w-full md:w-[70vw] max-w-[70vw] bg-white shadow-2xl border-l border-slate-200 flex flex-col animate-in slide-in-from-right duration-300">
          {/* Header */}
          <div className="p-5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-blue-100 text-blue-800 border border-blue-200">
                {stage.code ? `Tarefa ${stage.code}` : `Tarefa #${stage.stage_order}`}
              </span>
              {stage.parent_stage_id && (
                <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-indigo-100 text-indigo-800 border border-indigo-200 flex items-center gap-1">
                  <GitFork className="w-3 h-3 rotate-180" /> Subtarefa
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDeleteCurrentStage}
                disabled={deletingStage}
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                title="Excluir permanentemente esta tarefa"
              >
                {deletingStage ? (
                  <Loader2 className="w-4 h-4 animate-spin text-rose-600" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </button>

              <button
                type="button"
                onClick={handleSaveDetails}
                disabled={saving}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-semibold transition-all shadow-xs disabled:opacity-50 cursor-pointer ${isDirty ? 'bg-blue-600 hover:bg-blue-700 ring-2 ring-blue-500/20' : 'bg-slate-700 hover:bg-slate-800'
                  }`}
              >
                {saving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : saveSuccess ? (
                  <Check className="w-3.5 h-3.5 text-emerald-300" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                {saveSuccess ? 'Salvo!' : isDirty ? 'Salvar' : 'Salvar'}
              </button>

              <button
                type="button"
                onClick={handleAttemptClose}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                title="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Drawer Body Scrollable */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 overscroll-contain">

            {/* Hierarquia / Ancestrais Breadcrumb */}
            {ancestors.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-200/80 text-indigo-950 flex flex-wrap items-center justify-between gap-2 text-xs shadow-2xs">
                <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                  <span className="font-bold text-indigo-700 flex items-center gap-1">
                    <GitFork className="w-3.5 h-3.5 rotate-180 text-indigo-600 shrink-0" />
                    Subtarefa de:
                  </span>
                  {ancestors.map((anc, idx) => (
                    <div key={anc.id} className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleNavigateToTask(anc)}
                        className="font-bold text-indigo-800 hover:text-indigo-950 hover:underline max-w-[220px] truncate cursor-pointer"
                        title={`Abrir tarefa pai: ${anc.code ? `${anc.code} - ` : ''}${anc.name}`}
                      >
                        {anc.code ? `${anc.code} - ${anc.name}` : anc.name}
                      </button>
                      {idx < ancestors.length - 1 && (
                        <ChevronRight className="w-3 h-3 text-indigo-400 shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={handleUnlinkCurrentFromParent}
                  className="text-xs font-semibold text-indigo-600 hover:text-rose-600 hover:bg-white/80 px-2.5 py-1 rounded-lg border border-indigo-200/60 transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
                  title="Desvincular da tarefa principal e transformar em tarefa avulsa independente"
                >
                  <Unlink className="w-3.5 h-3.5" />
                  Desvincular da Principal
                </button>
              </div>
            )}

            {/* Finalized / Concluded Banner */}
            {isTaskFinalized && (
              <div className="p-3.5 rounded-2xl bg-indigo-50/80 border border-indigo-200/80 text-indigo-900 flex items-center gap-2.5 text-sm font-semibold shadow-2xs">
                <Flag className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>Esta tarefa está na <strong>Etapa Finalizada (Serviço Concluído)</strong> com todos os requisitos atendidos.</span>
              </div>
            )}

            {/* Title & Description Form */}
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                  Título da Tarefa
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full text-base font-extrabold text-slate-900 border border-slate-200/80 rounded-xl p-3 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-slate-50/50 hover:bg-white"
                  placeholder="Nome da etapa..."
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                  Instruções e Escopo de Trabalho
                </label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full text-sm text-slate-800 border border-slate-200/80 rounded-xl p-3 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none bg-slate-50/50 hover:bg-white leading-relaxed"
                  placeholder="Detalhe o que deve ser produzido e aprovado nesta fase..."
                />
              </div>
            </div>

            {/* Quick Metadata Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4 rounded-2xl bg-slate-50/80 border border-slate-100">
              {/* Status / Etapa */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" /> Status da Tarefa
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => handleStatusSelectChange(e.target.value)}
                  className="w-full text-sm font-semibold bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 outline-hidden focus:border-blue-500 cursor-pointer"
                >
                  {(workflowStages && workflowStages.length > 0 ? workflowStages : DEFAULT_WORKFLOW_STAGES).map((ws) => (
                    <option key={ws.id} value={ws.id}>
                      {ws.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Assignee */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                  <User className="w-3.5 h-3.5 text-blue-600" /> Responsável Interno
                </label>
                <select
                  value={formData.assigned_to}
                  onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                  className="w-full text-sm font-semibold bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 outline-hidden focus:border-blue-500 cursor-pointer"
                >
                  <option value="">Não atribuído</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Client Approval Flag */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Aprovação do Cliente
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setFormData({
                      ...formData,
                      is_client_approval_required: !formData.is_client_approval_required,
                    })
                  }
                  className={`w-full text-sm font-semibold px-3 py-2 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${formData.is_client_approval_required
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                >
                  <span>{formData.is_client_approval_required ? 'Exige Aprovação' : 'Interno (Sem Aprovação)'}</span>
                  {formData.is_client_approval_required ? (
                    <Check className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <X className="w-4 h-4 text-slate-400" />
                  )}
                </button>
              </div>

              {/* Data de Início */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                  <Calendar className="w-3.5 h-3.5 text-blue-600" /> Data de Início
                </label>
                <input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  className="w-full text-sm bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 outline-hidden focus:border-blue-500 font-medium"
                />
              </div>

              {/* Prazo de Entrega */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                  <Calendar className="w-3.5 h-3.5 text-amber-600" /> Prazo de Entrega
                </label>
                <input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => handleDueDateChange(e.target.value)}
                  className="w-full text-sm bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 outline-hidden focus:border-blue-500 font-medium"
                />
              </div>

              {/* Duração Sugerida (dias) */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                  <Clock className="w-3.5 h-3.5 text-indigo-600" /> Duração Sugerida (dias)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    value={formData.duration_days}
                    onChange={(e) => handleDurationChange(e.target.value)}
                    placeholder="Ex: 5"
                    className="w-full text-sm bg-white border border-slate-200 rounded-xl pl-3 pr-11 py-2 text-slate-800 outline-hidden focus:border-blue-500 font-mono font-bold"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium pointer-events-none">
                    dias
                  </span>
                </div>
              </div>

              {/* Status do Cronograma Banner */}
              <div className="sm:col-span-2 lg:col-span-3 pt-2.5 border-t border-slate-200/70 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500">Status do Prazo:</span>
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${timelineStatus.badgeBg} ${timelineStatus.badgeColor} ${timelineStatus.badgeBorder}`}
                  >
                    {timelineStatus.type === 'extrapolou' && <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />}
                    {timelineStatus.type === 'hoje' && <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />}
                    {timelineStatus.type === 'amanha' && <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />}
                    {timelineStatus.type === 'curto' && <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />}
                    {timelineStatus.type === 'longo' && <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                    {timelineStatus.type === 'concluido' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                    {timelineStatus.label}
                  </span>
                </div>
                {formData.duration_days && Number(formData.duration_days) > 0 && (
                  <span className="text-xs text-slate-500 font-medium">
                    Intervalo total: <strong className="text-slate-700 font-mono">{formData.duration_days} dias corridos</strong>
                  </span>
                )}
              </div>
            </div>

            {/* Subtarefas Vinculadas Section */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <GitFork className="w-4 h-4 text-indigo-600" />
                  <h4 className="text-sm font-bold text-slate-900">Subtarefas Vinculadas</h4>
                  <span className="text-xs text-slate-400 font-mono">({subtasks.length})</span>
                </div>

                <div className="flex items-center gap-3">
                  {subtasks.length > 0 && (
                    <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                      <span>
                        <strong className="text-slate-800">{completedSubtasksCount}</strong> de{' '}
                        <strong className="text-slate-800">{subtasks.length}</strong> concluídas
                      </span>
                      <div className="w-20 bg-slate-200 h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            subtaskProgressPercent === 100 ? 'bg-emerald-500' : 'bg-blue-600'
                          }`}
                          style={{ width: `${subtaskProgressPercent}%` }}
                        />
                      </div>
                      <span className="font-mono text-xs font-bold text-slate-600">{subtaskProgressPercent}%</span>
                    </div>
                  )}

                  {!showAddSubtask && (
                    <button
                      type="button"
                      onClick={() => setShowAddSubtask(true)}
                      className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Adicionar Subtarefa
                    </button>
                  )}
                </div>
              </div>

              {/* Formulário de Criação Rápida de Subtarefa */}
              {showAddSubtask && (
                <form onSubmit={handleCreateSubtaskSubmit} className="p-3.5 bg-indigo-50/50 rounded-2xl border border-indigo-200/80 space-y-3 animate-in fade-in">
                  <div className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5 text-indigo-600" /> Nova Subtarefa
                  </div>
                  <input
                    type="text"
                    value={newSubtaskName}
                    onChange={(e) => setNewSubtaskName(e.target.value)}
                    placeholder="Título da subtarefa..."
                    className="w-full text-sm font-semibold bg-white border border-indigo-200 rounded-xl px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    autoFocus
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5">
                      <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <select
                        value={newSubtaskAssignedTo}
                        onChange={(e) => setNewSubtaskAssignedTo(e.target.value)}
                        className="text-xs font-semibold text-slate-700 outline-hidden bg-transparent cursor-pointer max-w-[160px]"
                      >
                        <option value="">Sem responsável</option>
                        {members.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <input
                        type="date"
                        value={newSubtaskDueDate}
                        onChange={(e) => setNewSubtaskDueDate(e.target.value)}
                        className="text-xs text-slate-700 outline-hidden bg-transparent cursor-pointer"
                        title="Prazo de entrega da subtarefa"
                      />
                    </div>

                    <div className="ml-auto flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddSubtask(false)
                          setNewSubtaskName('')
                          setNewSubtaskAssignedTo('')
                          setNewSubtaskDueDate('')
                        }}
                        className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={creatingSubtask || !newSubtaskName.trim()}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                      >
                        {creatingSubtask && <Loader2 className="w-3 h-3 animate-spin" />}
                        Criar Subtarefa
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {/* Lista de Subtarefas */}
              <div className="space-y-2">
                {subtasks.length === 0 && !showAddSubtask && (
                  <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center bg-slate-50/50">
                    <p className="text-xs font-medium text-slate-400">
                      Nenhuma subtarefa vinculada a esta tarefa principal.
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowAddSubtask(true)}
                      className="mt-1 text-xs font-bold text-blue-600 hover:underline cursor-pointer"
                    >
                      + Adicionar a primeira subtarefa
                    </button>
                  </div>
                )}

                {subtasks.map((child) => {
                  const childMember = members.find((m) => m.id === child.assigned_to)
                  const childStageCfg = (workflowStages || DEFAULT_WORKFLOW_STAGES).find((ws) => ws.id === child.status)
                  const childIsFinal = Boolean(child.status === 'concluido' || childStageCfg?.is_final_stage)
                  const childChecklistDone = Array.isArray(child.checklist) ? child.checklist.filter((c) => c.completed).length : 0
                  const childChecklistTotal = Array.isArray(child.checklist) ? child.checklist.length : 0
                  const grandChildrenCount = (allStages || []).filter((s) => s.parent_stage_id === child.id).length

                  return (
                    <div
                      key={child.id}
                      onClick={() => handleNavigateToTask(child)}
                      className="p-3 bg-slate-50/70 hover:bg-blue-50/40 rounded-xl border border-slate-200/80 hover:border-blue-300 transition-all flex items-center justify-between gap-3 group cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {childIsFinal ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
                        )}
                        <div className="truncate">
                          <div className="flex items-center gap-1.5 truncate">
                            {child.code && (
                              <span className="font-mono text-[11px] font-bold text-slate-500 bg-white border border-slate-200/80 px-1.5 py-0.5 rounded shrink-0">
                                {child.code}
                              </span>
                            )}
                            <span className="text-sm font-bold text-slate-800 group-hover:text-blue-600 transition-colors truncate">
                              {child.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5 flex-wrap">
                            <span className="font-semibold text-slate-600">
                              {childStageCfg?.name || child.status}
                            </span>
                            {childChecklistTotal > 0 && (
                              <>
                                <span>•</span>
                                <span className="font-mono">
                                  Checklist: {childChecklistDone}/{childChecklistTotal}
                                </span>
                              </>
                            )}
                            {grandChildrenCount > 0 && (
                              <>
                                <span>•</span>
                                <span className="text-indigo-600 font-semibold flex items-center gap-0.5">
                                  <GitFork className="w-3 h-3" /> {grandChildrenCount} subtarefas
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {child.due_date && (
                          <span className="text-xs font-mono text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            {formatDateBR(child.due_date)}
                          </span>
                        )}

                        {childMember && (
                          <span
                            className="text-xs font-semibold text-slate-700 bg-white border border-slate-200 px-2 py-0.5 rounded-md"
                            title={`Responsável: ${childMember.name}`}
                          >
                            {childMember.name.split(' ')[0]}
                          </span>
                        )}

                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleUnlinkChildSubtask(child)
                            }}
                            disabled={unlinkingSubtaskId === child.id}
                            className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors cursor-pointer"
                            title="Desvincular da tarefa principal"
                          >
                            <Unlink className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteChildSubtask(child)
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                            title="Excluir subtarefa"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Checklist Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ListTodo className="w-4 h-4 text-blue-600" />
                  <h4 className="text-sm font-bold text-slate-900">Checklist Operacional</h4>
                  <span className="text-xs text-slate-400 font-mono">
                    ({checklist.filter((c) => c.completed).length}/{checklist.length})
                  </span>
                </div>
              </div>

              {/* Checklist items list */}
              <div className="space-y-1.5">
                {checklist.length === 0 && (
                  <p className="text-sm text-slate-400 italic py-2">Nenhum item no checklist desta tarefa.</p>
                )}

                {checklist.map((item) => {
                  const isEditing = editingChecklistItemId === item.id
                  const assignedName = getMemberName(item.assigned_to)

                  return (
                    <div key={item.id}>
                      {isEditing ? (
                        <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-200 space-y-2.5 animate-in fade-in">
                          <div className="flex flex-col sm:flex-row gap-2">
                            <input
                              type="text"
                              value={editingChecklistText}
                              onChange={(e) => setEditingChecklistText(e.target.value)}
                              className="flex-1 text-sm border border-blue-400 rounded-lg p-2.5 bg-white outline-hidden focus:ring-2 focus:ring-blue-500/20"
                              placeholder="Descrição do item..."
                              autoFocus
                            />

                            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5">
                              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <input
                                type="date"
                                value={editingChecklistDueDate}
                                onChange={(e) => setEditingChecklistDueDate(e.target.value)}
                                className="text-sm text-slate-700 outline-hidden bg-transparent cursor-pointer"
                                title="Data prevista de conclusão"
                              />
                            </div>

                            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5">
                              <User className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                              <select
                                value={editingChecklistAssignedTo}
                                onChange={(e) => setEditingChecklistAssignedTo(e.target.value)}
                                className="text-sm font-semibold text-slate-700 outline-hidden bg-transparent cursor-pointer max-w-[160px]"
                                title="Responsável pelo item"
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

                          <div className="flex justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={handleCancelEditChecklist}
                              className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg cursor-pointer"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveEditChecklist(item.id)}
                              disabled={savingChecklistItemId === item.id || !editingChecklistText.trim()}
                              className="inline-flex items-center gap-1 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-2xs disabled:opacity-50 cursor-pointer"
                            >
                              {savingChecklistItemId === item.id && <Loader2 className="w-3 h-3 animate-spin" />}
                              Salvar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all group">
                          <label className="flex items-center gap-2.5 flex-1 cursor-pointer select-none min-w-0">
                            <input
                              type="checkbox"
                              checked={item.completed}
                              onChange={() => handleToggleChecklist(item.id, item.completed)}
                              className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer shrink-0"
                            />
                            <span
                              className={`text-sm truncate ${item.completed ? 'line-through text-slate-400' : 'text-slate-800 font-medium'
                                }`}
                            >
                              {item.text}
                            </span>
                          </label>

                          <div className="flex items-center gap-2 shrink-0 ml-2">
                            {/* Responsável Badge */}
                            {assignedName && (
                              <span
                                className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md border ${item.completed
                                  ? 'bg-slate-100 text-slate-400 border-slate-200'
                                  : 'bg-indigo-50 text-indigo-700 border-indigo-200/70'
                                  }`}
                                title={`Responsável: ${assignedName}`}
                              >
                                <User className="w-3 h-3 text-indigo-500" />
                                <span className="max-w-[120px] truncate">{assignedName}</span>
                              </span>
                            )}

                            {/* Data Prevista Badge */}
                            {item.due_date && (
                              <span
                                className={`inline-flex items-center gap-1 text-xs font-mono font-medium px-2 py-0.5 rounded-md border ${item.completed
                                  ? 'bg-slate-100 text-slate-400 border-slate-200'
                                  : 'bg-blue-50 text-blue-700 border-blue-200/70'
                                  }`}
                                title="Data prevista de conclusão"
                              >
                                <Calendar className="w-3 h-3 text-blue-500" />
                                {formatDueDate(item.due_date)}
                              </span>
                            )}

                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                type="button"
                                onClick={() => handleStartEditChecklist(item)}
                                className="p-1 text-slate-400 hover:text-blue-600 rounded-md hover:bg-blue-50 transition-colors cursor-pointer"
                                title="Editar item"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteChecklistItem(item.id)}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition-colors cursor-pointer"
                                title="Excluir item"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Add checklist item */}
              <form onSubmit={handleAddChecklistItem} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                <input
                  type="text"
                  value={newChecklistText}
                  onChange={(e) => setNewChecklistText(e.target.value)}
                  placeholder="Adicionar novo item ao checklist..."
                  className="flex-1 text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-hidden focus:border-blue-500 transition-all bg-slate-50/50 focus:bg-white"
                />

                <div className="flex items-center gap-1.5 bg-slate-50/50 focus-within:bg-white border border-slate-200 rounded-xl px-2.5 py-2 transition-all">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <input
                    type="date"
                    value={newChecklistDueDate}
                    onChange={(e) => setNewChecklistDueDate(e.target.value)}
                    className="text-sm text-slate-700 outline-hidden bg-transparent cursor-pointer"
                    title="Data prevista de conclusão (Opcional)"
                  />
                </div>

                <div className="flex items-center gap-1.5 bg-slate-50/50 focus-within:bg-white border border-slate-200 rounded-xl px-2.5 py-2 transition-all">
                  <User className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                  <select
                    value={newChecklistAssignedTo}
                    onChange={(e) => setNewChecklistAssignedTo(e.target.value)}
                    className="text-sm font-semibold text-slate-700 outline-hidden bg-transparent cursor-pointer max-w-[140px]"
                    title="Atribuir a um membro (Opcional)"
                  >
                    <option value="">Responsável</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={!newChecklistText.trim()}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-all disabled:opacity-40 shadow-2xs cursor-pointer shrink-0"
                >
                  <Plus className="w-4 h-4" /> Adicionar
                </button>
              </form>
            </div>

            {/* Attachments Section */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Paperclip className="w-4 h-4 text-indigo-600" />
                  <h4 className="text-sm font-bold text-slate-900">Arquivos e Pranchas Anexadas</h4>
                  <span className="text-xs text-slate-400 font-mono">({attachments.length})</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddAttachment(!showAddAttachment)
                    setAttachmentError(null)
                  }}
                  className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:underline cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Anexar Arquivo/Prancha
                </button>
              </div>

              {/* ADD ATTACHMENT FORM MODAL / DRAWER ACCORDION */}
              {showAddAttachment && (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/90 space-y-3 animate-in fade-in">
                  {/* Mode Tabs */}
                  <div className="flex items-center gap-2 p-1 bg-slate-200/70 rounded-xl text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => {
                        setAttachmentMode('file')
                        setAttachmentError(null)
                      }}
                      className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${attachmentMode === 'file'
                        ? 'bg-white text-blue-600 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                      <UploadCloud className="w-4 h-4" /> Enviar do Dispositivo (Storage)
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setAttachmentMode('link')
                        setAttachmentError(null)
                      }}
                      className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${attachmentMode === 'link'
                        ? 'bg-white text-blue-600 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                      <Link2 className="w-4 h-4" /> Link Externo (URL)
                    </button>
                  </div>

                  {/* Error display */}
                  {attachmentError && (
                    <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-xs text-rose-700">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <span>{attachmentError}</span>
                    </div>
                  )}

                  {/* MODE 1: FILE UPLOAD (SUPABASE STORAGE) */}
                  {attachmentMode === 'file' && (
                    <form onSubmit={handleUploadFileSubmit} className="space-y-3 text-sm">
                      <input
                        ref={fileInputRef}
                        type="file"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) {
                            setSelectedFile(file)
                            if (!newAttachmentName) {
                              setNewAttachmentName(file.name)
                            }
                          }
                        }}
                        className="hidden"
                      />

                      {/* Drag and Drop Zone */}
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="p-5 border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl bg-white hover:bg-blue-50/30 transition-all cursor-pointer text-center space-y-1.5"
                      >
                        <UploadCloud className="w-6 h-6 text-blue-600 mx-auto" />
                        {selectedFile ? (
                          <div className="space-y-0.5">
                            <span className="font-bold text-slate-800 block truncate max-w-xs mx-auto text-sm">
                              {selectedFile.name}
                            </span>
                            <span className="text-xs text-slate-500 font-mono block">
                              {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Clique para trocar arquivo
                            </span>
                          </div>
                        ) : (
                          <div>
                            <span className="font-bold text-slate-700 block text-sm">
                              Clique para selecionar ou arraste o arquivo aqui
                            </span>
                            <span className="text-xs text-slate-400 block mt-0.5">
                              Suporta qualquer tipo (PDF, DWG, DXF, PNG, JPG, RVT, IFC, ZIP até 100MB)
                            </span>
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
                          Nome de exibição do documento (Opcional)
                        </label>
                        <input
                          type="text"
                          value={newAttachmentName}
                          onChange={(e) => setNewAttachmentName(e.target.value)}
                          placeholder="Ex: Prancha 01 - Planta Baixa Arquitetônica R02"
                          className="w-full text-sm border border-slate-200 rounded-xl p-2.5 bg-white outline-hidden focus:border-blue-500"
                        />
                      </div>

                      {/* Configuração de Visibilidade no Portal do Cliente */}
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/90 flex items-center justify-between gap-3">
                        <div className="space-y-0.5">
                          <span className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                            <Globe className="w-4 h-4 text-blue-600" />
                            Exibir no portal de aprovação do cliente
                          </span>
                          <span className="text-xs text-slate-500 block">
                            {newAttachmentVisibleToClient
                              ? 'O cliente poderá visualizar e baixar este arquivo na etapa de aprovação.'
                              : 'Arquivo interno. Ficará visível apenas para a equipe do escritório.'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setNewAttachmentVisibleToClient(!newAttachmentVisibleToClient)}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                            newAttachmentVisibleToClient ? 'bg-blue-600' : 'bg-slate-300'
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                              newAttachmentVisibleToClient ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>

                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setShowAddAttachment(false)
                            setSelectedFile(null)
                          }}
                          className="px-3.5 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-xl cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          disabled={uploadingFile || !selectedFile}
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                        >
                          {uploadingFile && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                          {uploadingFile ? 'Enviando para Storage...' : 'Enviar Arquivo'}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* MODE 2: EXTERNAL LINK */}
                  {attachmentMode === 'link' && (
                    <form onSubmit={handleAddLinkSubmit} className="space-y-2.5 text-sm">
                      <div>
                        <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1.5">Nome do Anexo *</label>
                        <input
                          type="text"
                          required
                          value={newAttachmentName}
                          onChange={(e) => setNewAttachmentName(e.target.value)}
                          placeholder="Ex: Arquivo 3D no Trimble Connect / Figma"
                          className="w-full text-sm border border-slate-200 rounded-xl p-2.5 bg-white outline-hidden focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1.5">URL / Link *</label>
                        <input
                          type="url"
                          required
                          value={newAttachmentUrl}
                          onChange={(e) => setNewAttachmentUrl(e.target.value)}
                          placeholder="https://drive.google.com/..."
                          className="w-full text-sm border border-slate-200 rounded-xl p-2.5 bg-white outline-hidden focus:border-blue-500"
                        />
                      </div>

                      {/* Configuração de Visibilidade no Portal do Cliente */}
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/90 flex items-center justify-between gap-3">
                        <div className="space-y-0.5">
                          <span className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                            <Globe className="w-4 h-4 text-blue-600" />
                            Exibir no portal de aprovação do cliente
                          </span>
                          <span className="text-xs text-slate-500 block">
                            {newAttachmentVisibleToClient
                              ? 'O cliente poderá visualizar e acessar este link na etapa de aprovação.'
                              : 'Link interno. Ficará visível apenas para a equipe do escritório.'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setNewAttachmentVisibleToClient(!newAttachmentVisibleToClient)}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                            newAttachmentVisibleToClient ? 'bg-blue-600' : 'bg-slate-300'
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                              newAttachmentVisibleToClient ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>

                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setShowAddAttachment(false)}
                          className="px-3.5 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-xl cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          disabled={!newAttachmentName.trim() || !newAttachmentUrl.trim()}
                          className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-all shadow-xs cursor-pointer"
                        >
                          Salvar Link
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {attachments.length === 0 && !showAddAttachment ? (
                <p className="text-sm text-slate-400 italic">Nenhum anexo ou prancha adicionada nesta tarefa.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {attachments.map((att) => {
                    const isEditingAtt = editingAttachmentId === att.id
                    const isVisibleToClient = att.is_visible_to_client !== false

                    if (isEditingAtt) {
                      return (
                        <div
                          key={att.id}
                          className="col-span-1 sm:col-span-2 p-3 bg-white rounded-xl border-2 border-blue-400 shadow-xs space-y-2 animate-in fade-in"
                        >
                          <div className="flex items-center gap-2">
                            <div className="p-1 rounded-md bg-blue-50 border border-blue-200 shrink-0">
                              {getFileIcon(att.name, att.url)}
                            </div>
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                              Editar Nome do Arquivo / Prancha
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={editingAttachmentName}
                              onChange={(e) => setEditingAttachmentName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault()
                                  handleSaveEditAttachment(att.id)
                                } else if (e.key === 'Escape') {
                                  e.preventDefault()
                                  handleCancelEditAttachment()
                                }
                              }}
                              autoFocus
                              className="flex-1 text-sm font-semibold text-slate-900 border border-slate-300 rounded-lg px-3 py-2 bg-white outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                              placeholder="Nome do arquivo ou prancha..."
                            />

                            <button
                              type="button"
                              onClick={() => handleSaveEditAttachment(att.id)}
                              disabled={savingAttachmentId === att.id || !editingAttachmentName.trim()}
                              className="inline-flex items-center gap-1 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-all shadow-xs disabled:opacity-50 cursor-pointer shrink-0"
                              title="Salvar novo nome (Enter)"
                            >
                              {savingAttachmentId === att.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Check className="w-3.5 h-3.5" />
                              )}
                              Salvar
                            </button>

                            <button
                              type="button"
                              onClick={handleCancelEditAttachment}
                              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer shrink-0"
                              title="Cancelar (Esc)"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )
                    }

                    return (
                      <div
                        key={att.id}
                        className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200/80 hover:border-blue-300 transition-all group"
                      >
                        <a
                          href={att.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2.5 flex-1 min-w-0"
                          title={att.name}
                        >
                          <div className="p-1.5 rounded-lg bg-white border border-slate-200 shadow-2xs shrink-0">
                            {getFileIcon(att.name, att.url)}
                          </div>
                          <div className="truncate space-y-0.5">
                            <span className="text-sm font-bold text-slate-800 group-hover:text-blue-600 transition-colors block truncate">
                              {att.name}
                            </span>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs text-slate-400 font-mono">
                                {att.size || 'Arquivo'}
                              </span>
                              <span className="text-slate-300">•</span>
                              {isVisibleToClient ? (
                                <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                                  <Eye className="w-3 h-3" /> Portal
                                </span>
                              ) : (
                                <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-slate-200/70 text-slate-600 border border-slate-300 inline-flex items-center gap-1">
                                  <EyeOff className="w-3 h-3" /> Oculto
                                </span>
                              )}
                            </div>
                          </div>
                        </a>

                        <div className="flex items-center gap-1 shrink-0">
                          {/* Botão de Toggle Rápido de Visibilidade para o Cliente */}
                          <button
                            type="button"
                            onClick={() => handleToggleAttachmentVisibility(att)}
                            disabled={togglingVisibilityId === att.id}
                            className={`p-1 rounded-lg transition-colors cursor-pointer ${
                              isVisibleToClient
                                ? 'text-emerald-600 hover:bg-emerald-50'
                                : 'text-slate-400 hover:text-slate-700 hover:bg-slate-200'
                            }`}
                            title={
                              isVisibleToClient
                                ? 'Visível no Portal do Cliente (clique para ocultar)'
                                : 'Oculto no Portal do Cliente (clique para exibir)'
                            }
                          >
                            {togglingVisibilityId === att.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : isVisibleToClient ? (
                              <Eye className="w-3.5 h-3.5" />
                            ) : (
                              <EyeOff className="w-3.5 h-3.5" />
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleStartEditAttachment(att)}
                            className="p-1 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer"
                            title="Editar nome do anexo"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>

                          <a
                            href={att.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                            title="Abrir / Baixar"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>

                          <button
                            type="button"
                            onClick={() => handleDeleteAttachment(att.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Remover anexo"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Comments & Activity Feed Section */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-emerald-600" />
                <h4 className="text-sm font-bold text-slate-900">Comentários & Histórico Interno</h4>
                <span className="text-xs text-slate-400 font-mono">({comments.length})</span>
              </div>

              {/* Add comment form */}
              <form onSubmit={handleAddComment} className="space-y-2">
                <textarea
                  rows={2}
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  placeholder="Escreva um comentário ou alinhamento com a equipe..."
                  className="w-full text-sm border border-slate-200 rounded-xl p-3 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none bg-slate-50/50 focus:bg-white leading-relaxed"
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={!newCommentText.trim()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-all shadow-xs disabled:opacity-40 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" /> Comentar
                  </button>
                </div>
              </form>

              {/* Comments list */}
              <div className="space-y-2.5 max-h-72 overflow-y-auto pt-1">
                {comments.length === 0 && (
                  <p className="text-sm text-slate-400 italic">Nenhum comentário registrado nesta tarefa.</p>
                )}

                {comments.map((cmt) => {
                  const isEditing = editingCommentId === cmt.id
                  const isAudit =
                    cmt.text.includes('[Aprovação Manual]') ||
                    cmt.text.includes('[Validação do Cliente]') ||
                    cmt.user_id === 'portal-client'

                  return (
                    <div
                      key={cmt.id}
                      className={`p-3.5 rounded-xl border space-y-2 transition-all group ${isAudit
                          ? 'bg-emerald-50/70 border-emerald-200/90 shadow-2xs'
                          : 'bg-slate-50 border-slate-100 hover:border-slate-200'
                        }`}
                    >
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`font-bold ${isAudit ? 'text-emerald-950 flex items-center gap-1.5' : 'text-slate-700'
                              }`}
                          >
                            {isAudit && <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                            {cmt.user_name}
                          </span>
                          {isAudit && (
                            <span className="text-xs font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-md">
                              Auditoria & Aprovação
                            </span>
                          )}
                          <span>•</span>
                          <span>{formatDateTimeBR(cmt.created_at)}</span>
                          {cmt.updated_at && (
                            <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded-md font-medium">
                              Editado em {formatDateTimeBR(cmt.updated_at)}
                            </span>
                          )}
                        </div>

                        {!isEditing && !isAudit && (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => handleStartEditComment(cmt)}
                              className="p-1 text-slate-400 hover:text-blue-600 rounded-md hover:bg-blue-50 transition-colors cursor-pointer"
                              title="Editar comentário"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteComment(cmt.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition-colors cursor-pointer"
                              title="Excluir comentário"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      {isEditing ? (
                        <div className="space-y-2 pt-1">
                          <textarea
                            rows={2}
                            value={editingCommentText}
                            onChange={(e) => setEditingCommentText(e.target.value)}
                            className="w-full text-sm border border-blue-400 rounded-lg p-2.5 bg-white outline-hidden focus:ring-2 focus:ring-blue-500/20 resize-none leading-relaxed"
                            autoFocus
                          />
                          <div className="flex justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={handleCancelEditComment}
                              className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg cursor-pointer"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveEditComment(cmt.id)}
                              disabled={savingCommentId === cmt.id || !editingCommentText.trim()}
                              className="inline-flex items-center gap-1 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-2xs disabled:opacity-50 cursor-pointer"
                            >
                              {savingCommentId === cmt.id && <Loader2 className="w-3 h-3 animate-spin" />}
                              Salvar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p
                          className={`text-sm whitespace-pre-wrap leading-relaxed ${isAudit ? 'text-emerald-950 font-medium' : 'text-slate-700'
                            }`}
                        >
                          {cmt.text}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Exclusão de Tarefa com Subtarefas (P2: A) */}
      {subtaskDeleteModalOpen && (
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
                  A tarefa {stage?.code ? `[${stage.code}] ` : ''}<strong>&quot;{stage?.name}&quot;</strong> possui <strong>{subtasks.length} subtarefa(s) vinculada(s)</strong>. Como deseja prosseguir?
                </p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80 max-h-36 overflow-y-auto space-y-1.5 text-xs text-slate-600">
              <span className="font-bold text-slate-700 block mb-1">Subtarefas vinculadas:</span>
              {subtasks.map((s) => (
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
                onClick={() => handleConfirmDeleteWithSubtasks('cascade')}
                disabled={deletingStage}
                className="w-full p-3 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-left transition-colors cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-rose-700 flex items-center gap-1.5">
                    <Trash2 className="w-4 h-4 text-rose-600" /> Excluir Tudo (Tarefa e {subtasks.length} Subtarefas)
                  </span>
                  {deletingStage && <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-600" />}
                </div>
                <p className="text-[11px] text-rose-600/80 mt-1">
                  Move a tarefa principal e todas as suas subtarefas filhas para o histórico de tarefas excluídas.
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleConfirmDeleteWithSubtasks('unlink')}
                disabled={deletingStage}
                className="w-full p-3 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-left transition-colors cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-700 flex items-center gap-1.5">
                    <Unlink className="w-4 h-4 text-blue-600" /> Desvincular e Manter Subtarefas
                  </span>
                  {deletingStage && <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />}
                </div>
                <p className="text-[11px] text-blue-600/80 mt-1">
                  Exclui apenas a tarefa principal. As subtarefas tornam-se tarefas independentes de primeiro nível no projeto.
                </p>
              </button>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSubtaskDeleteModalOpen(false)}
                disabled={deletingStage}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
