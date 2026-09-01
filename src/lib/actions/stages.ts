'use server'

import { revalidatePath } from 'next/cache'
import { requireProjectAccess } from '@/lib/server/guard'
import { sanitizeText } from '@/lib/server/sanitize'
import { normalizeWorkflowStages, canMoveToFinalStage } from '@/lib/workflow-stages'

export interface ChecklistItem {
  id: string
  text: string
  completed: boolean
  due_date?: string | null
  assigned_to?: string | null
  created_at: string
}

export interface StageComment {
  id: string
  user_id: string
  user_name: string
  user_email?: string | null
  text: string
  created_at: string
  updated_at?: string | null
}

export interface StageAttachment {
  id: string
  name: string
  url: string
  size?: string
  is_visible_to_client?: boolean
  created_at: string
}

export async function updateStageStatusAction(
  projectId: string,
  stageId: string,
  newStatus: string
) {
  const { supabase, user } = await requireProjectAccess(projectId)

  // 1. Busca etapa atual e workflow_stages da organização para validação de integridade
  const { data: stageRecord } = await supabase
    .from('project_stages')
    .select('id, checklist, comments, is_client_approval_required, status, project_id, projects(organization_id, organizations(workflow_stages))')
    .eq('id', stageId)
    .eq('project_id', projectId)
    .single()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawStages = (stageRecord?.projects as any)?.organizations?.workflow_stages
  const normalizedStages = normalizeWorkflowStages(rawStages)
  const targetStageCfg = normalizedStages.find((s) => s.id === newStatus)

  // 2. Se a etapa de destino for conclusiva/final, valida checklists e aprovação do cliente
  if (targetStageCfg?.is_final_stage) {
    const check = canMoveToFinalStage(stageRecord || {}, normalizedStages)
    if (!check.allowed) {
      return { error: `Não é possível mover para a etapa finalizada: ${check.reasons.join(' ')}` }
    }
  }

  const progressPercent = targetStageCfg?.is_final_stage || newStatus === 'concluido' ? 100 : newStatus === 'a_iniciar' ? 0 : 50

  const updatePayload: Record<string, any> = {
    status: newStatus,
    progress_percent: progressPercent,
    is_locked_for_client: Boolean(targetStageCfg?.is_final_stage),
  }

  // 3. Se a etapa for de aprovação, registra auditoria com o usuário responsável
  const isTargetApproved = Boolean(
    targetStageCfg?.is_approved_stage ||
    targetStageCfg?.name?.toLowerCase().includes('aprovad') ||
    newStatus === 'concluido'
  )

  if (isTargetApproved && stageRecord?.status !== newStatus) {
    const { data: profile } = await (supabase
      .from('user_profiles') as any)
      .select('display_name, full_name')
      .eq('user_id', user.id)
      .maybeSingle()

    const approverName =
      profile?.display_name ||
      profile?.full_name ||
      (user.user_metadata as any)?.full_name ||
      (user.email ? user.email.split('@')[0] : 'Membro da Equipe')
    const approverEmail = user.email || null

    try {
      await (supabase.from('stage_approvals') as any).insert({
        project_id: projectId,
        stage_id: stageId,
        action: 'approved',
        approver_name: approverName,
        approver_email: approverEmail,
        feedback_message: 'Aprovação manual realizada pela equipe interna.',
      })
    } catch {
      // safe fallback
    }

    const currentComments = Array.isArray(stageRecord?.comments) ? (stageRecord.comments as any[]) : []
    const auditComment = {
      id: `cmt-appr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      user_id: user.id,
      user_name: approverName,
      user_email: approverEmail,
      text: `✅ [Aprovação Manual] Tarefa aprovada manualmente por ${approverName}.`,
      created_at: new Date().toISOString(),
    }
    updatePayload.comments = [...currentComments, auditComment]
  }

  const { error } = await supabase
    .from('project_stages')
    .update(updatePayload as any)
    .eq('id', stageId)
    .eq('project_id', projectId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/app/projetos/${projectId}`)
  return {
    success: true,
    comments: updatePayload.comments as StageComment[] | undefined
  }
}

export async function reorderStagesAction(
  projectId: string,
  stageUpdates: {
    id: string
    stage_order: number
    status?: string
  }[]
) {
  const { supabase } = await requireProjectAccess(projectId)

  const updates = stageUpdates.map((item) => {
    const payload: Record<string, any> = { stage_order: item.stage_order }
    if (item.status) {
      payload.status = item.status
      if (item.status === 'concluido') payload.progress_percent = 100
      else if (item.status === 'a_iniciar') payload.progress_percent = 0
    }
    return supabase
      .from('project_stages')
      .update(payload as any)
      .eq('id', item.id)
      .eq('project_id', projectId)
  })

  const results = await Promise.all(updates)
  const failed = results.find((r) => r.error)
  if (failed?.error) {
    return { error: failed.error.message }
  }

  revalidatePath(`/app/projetos/${projectId}`)
  return { success: true }
}

export async function updateStageProgressAction(
  projectId: string,
  stageId: string,
  progressPercent: number
) {
  const { supabase } = await requireProjectAccess(projectId)

  const clamped = Math.max(0, Math.min(100, Math.round(progressPercent)))
  const newStatus = clamped === 100 ? 'concluido' : clamped === 0 ? 'a_iniciar' : 'em_producao'

  const { error } = await supabase
    .from('project_stages')
    .update({
      progress_percent: clamped,
      status: newStatus,
    } as any)
    .eq('id', stageId)
    .eq('project_id', projectId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/app/projetos/${projectId}`)
  return { success: true }
}

export async function updateStageFullDetailsAction(
  projectId: string,
  stageId: string,
  data: {
    name?: string
    description?: string | null
    assigned_to?: string | null
    start_date?: string | null
    due_date?: string | null
    status?: string
    is_client_approval_required?: boolean
  }
) {
  const { supabase, user } = await requireProjectAccess(projectId)

  const updatePayload: Record<string, any> = {}

  if (data.name !== undefined) updatePayload.name = sanitizeText(data.name)
  if (data.description !== undefined) updatePayload.description = data.description ? sanitizeText(data.description) : null
  if (data.assigned_to !== undefined) updatePayload.assigned_to = data.assigned_to || null
  if (data.start_date !== undefined) updatePayload.start_date = data.start_date || null
  if (data.due_date !== undefined) updatePayload.due_date = data.due_date || null
  if (data.is_client_approval_required !== undefined) updatePayload.is_client_approval_required = data.is_client_approval_required
  if (data.status !== undefined) {
    // Busca workflow stages para validação de etapa final
    const { data: stageRecord } = await supabase
      .from('project_stages')
      .select('id, checklist, comments, is_client_approval_required, status, project_id, projects(organization_id, organizations(workflow_stages))')
      .eq('id', stageId)
      .eq('project_id', projectId)
      .single()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawStages = (stageRecord?.projects as any)?.organizations?.workflow_stages
    const normalizedStages = normalizeWorkflowStages(rawStages)
    const targetStageCfg = normalizedStages.find((s) => s.id === data.status)

    if (targetStageCfg?.is_final_stage) {
      const check = canMoveToFinalStage(stageRecord || {}, normalizedStages)
      if (!check.allowed) {
        return { error: `Não é possível mover para a etapa finalizada: ${check.reasons.join(' ')}` }
      }
      updatePayload.progress_percent = 100
      updatePayload.is_locked_for_client = true
    } else {
      if (data.status === 'concluido') updatePayload.progress_percent = 100
      if (data.status === 'a_iniciar') updatePayload.progress_percent = 0
    }

    const isTargetApproved = Boolean(
      targetStageCfg?.is_approved_stage ||
      targetStageCfg?.name?.toLowerCase().includes('aprovad') ||
      data.status === 'concluido'
    )

    if (isTargetApproved && stageRecord?.status !== data.status) {
      const { data: profile } = await (supabase
        .from('user_profiles') as any)
        .select('display_name, full_name')
        .eq('user_id', user.id)
        .maybeSingle()

      const approverName =
        profile?.display_name ||
        profile?.full_name ||
        (user.user_metadata as any)?.full_name ||
        (user.email ? user.email.split('@')[0] : 'Membro da Equipe')
      const approverEmail = user.email || null

      try {
        await (supabase.from('stage_approvals') as any).insert({
          project_id: projectId,
          stage_id: stageId,
          action: 'approved',
          approver_name: approverName,
          approver_email: approverEmail,
          feedback_message: 'Aprovação manual realizada pela equipe interna.',
        })
      } catch {
        // safe fallback
      }

      const currentComments = Array.isArray(stageRecord?.comments) ? (stageRecord.comments as any[]) : []
      const auditComment = {
        id: `cmt-appr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        user_id: user.id,
        user_name: approverName,
        user_email: approverEmail,
        text: `✅ [Aprovação Manual] Tarefa aprovada manualmente por ${approverName}.`,
        created_at: new Date().toISOString(),
      }
      updatePayload.comments = [...currentComments, auditComment]
    }

    updatePayload.status = data.status
  }

  const { error } = await supabase
    .from('project_stages')
    .update(updatePayload as any)
    .eq('id', stageId)
    .eq('project_id', projectId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/app/projetos/${projectId}`)
  return {
    success: true,
    comments: updatePayload.comments as StageComment[] | undefined
  }
}

export async function toggleStageClientApprovalAction(
  projectId: string,
  stageId: string,
  isRequired: boolean
) {
  const { supabase } = await requireProjectAccess(projectId)

  const { error } = await (supabase
    .from('project_stages') as any)
    .update({ is_client_approval_required: isRequired })
    .eq('id', stageId)
    .eq('project_id', projectId)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath(`/app/projetos/${projectId}`)
  return { success: true, is_client_approval_required: isRequired }
}

export async function createStageAction(
  projectId: string,
  data: {
    name: string
    description?: string | null
    assigned_to?: string | null
    start_date?: string | null
    due_date?: string | null
    status?: string
    is_client_approval_required?: boolean
  }
) {
  const { supabase } = await requireProjectAccess(projectId)
  const cleanName = sanitizeText(data.name)
  if (!cleanName) return { error: 'O nome da tarefa é obrigatório' }

  // 1. Obtém o próximo stage_order
  const { data: existingStages } = await supabase
    .from('project_stages')
    .select('stage_order')
    .eq('project_id', projectId)
    .order('stage_order', { ascending: false })
    .limit(1)

  const nextOrder = (existingStages?.[0]?.stage_order || 0) + 1
  const initialStatus = data.status || 'a_iniciar'
  const progressPercent = initialStatus === 'concluido' ? 100 : initialStatus === 'em_producao' ? 50 : 0

  const { data: newStage, error } = await supabase
    .from('project_stages')
    .insert({
      project_id: projectId,
      name: cleanName,
      description: data.description ? sanitizeText(data.description) : null,
      stage_order: nextOrder,
      status: initialStatus,
      progress_percent: progressPercent,
      assigned_to: data.assigned_to || null,
      start_date: data.start_date || null,
      due_date: data.due_date || null,
      is_client_approval_required: data.is_client_approval_required ?? true,
      checklist: [],
      comments: [],
      attachments: [],
    } as any)
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/app/projetos/${projectId}`)
  return { success: true, stage: newStage }
}

export async function deleteStageAction(
  projectId: string,
  stageId: string
) {
  const { supabase } = await requireProjectAccess(projectId)

  const { error } = await supabase
    .from('project_stages')
    .delete()
    .eq('id', stageId)
    .eq('project_id', projectId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/app/projetos/${projectId}`)
  return { success: true }
}


export async function toggleStageChecklistItemAction(
  projectId: string,
  stageId: string,
  itemId: string,
  completed: boolean
) {
  const { supabase } = await requireProjectAccess(projectId)

  const { data: stage } = await supabase
    .from('project_stages')
    .select('checklist')
    .eq('id', stageId)
    .eq('project_id', projectId)
    .single()

  const currentChecklist: ChecklistItem[] = Array.isArray(stage?.checklist) ? stage.checklist : []
  const updatedChecklist = currentChecklist.map((item) =>
    item.id === itemId ? { ...item, completed } : item
  )

  const { error } = await supabase
    .from('project_stages')
    .update({ checklist: updatedChecklist })
    .eq('id', stageId)
    .eq('project_id', projectId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/app/projetos/${projectId}`)
  return { success: true, checklist: updatedChecklist }
}

export async function addStageChecklistItemAction(
  projectId: string,
  stageId: string,
  text: string,
  dueDate?: string | null,
  assignedTo?: string | null
) {
  const { supabase } = await requireProjectAccess(projectId)
  const cleanText = sanitizeText(text)
  if (!cleanText) return { error: 'O texto do item é obrigatório' }

  const { data: stage } = await supabase
    .from('project_stages')
    .select('checklist')
    .eq('id', stageId)
    .eq('project_id', projectId)
    .single()

  const currentChecklist: ChecklistItem[] = Array.isArray(stage?.checklist) ? stage.checklist : []
  const newItem: ChecklistItem = {
    id: `chk-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    text: cleanText,
    completed: false,
    due_date: dueDate || null,
    assigned_to: assignedTo || null,
    created_at: new Date().toISOString(),
  }

  const updatedChecklist = [...currentChecklist, newItem]

  const { error } = await supabase
    .from('project_stages')
    .update({ checklist: updatedChecklist })
    .eq('id', stageId)
    .eq('project_id', projectId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/app/projetos/${projectId}`)
  return { success: true, item: newItem }
}

export async function editStageChecklistItemAction(
  projectId: string,
  stageId: string,
  itemId: string,
  text: string,
  dueDate?: string | null,
  assignedTo?: string | null
): Promise<{ success: boolean; item?: ChecklistItem; error?: string }> {
  const { supabase } = await requireProjectAccess(projectId)
  const cleanText = sanitizeText(text)
  if (!cleanText) return { success: false, error: 'O texto do item é obrigatório' }

  const { data: stage } = await supabase
    .from('project_stages')
    .select('checklist')
    .eq('id', stageId)
    .eq('project_id', projectId)
    .single()

  const currentChecklist: ChecklistItem[] = Array.isArray(stage?.checklist) ? stage.checklist : []
  const targetItem = currentChecklist.find((item) => item.id === itemId)

  if (!targetItem) {
    return { success: false, error: 'Item do checklist não encontrado' }
  }

  const updatedItem: ChecklistItem = {
    ...targetItem,
    text: cleanText,
    due_date: dueDate !== undefined ? (dueDate || null) : targetItem.due_date,
    assigned_to: assignedTo !== undefined ? (assignedTo || null) : targetItem.assigned_to,
  }

  const updatedChecklist = currentChecklist.map((item) =>
    item.id === itemId ? updatedItem : item
  )

  const { error } = await supabase
    .from('project_stages')
    .update({ checklist: updatedChecklist })
    .eq('id', stageId)
    .eq('project_id', projectId)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath(`/app/projetos/${projectId}`)
  return { success: true, item: updatedItem }
}

export async function deleteStageChecklistItemAction(
  projectId: string,
  stageId: string,
  itemId: string
) {
  const { supabase } = await requireProjectAccess(projectId)

  const { data: stage } = await supabase
    .from('project_stages')
    .select('checklist')
    .eq('id', stageId)
    .eq('project_id', projectId)
    .single()

  const currentChecklist: ChecklistItem[] = Array.isArray(stage?.checklist) ? stage.checklist : []
  const updatedChecklist = currentChecklist.filter((item) => item.id !== itemId)

  const { error } = await supabase
    .from('project_stages')
    .update({ checklist: updatedChecklist })
    .eq('id', stageId)
    .eq('project_id', projectId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/app/projetos/${projectId}`)
  return { success: true }
}

export async function addStageCommentAction(
  projectId: string,
  stageId: string,
  text: string
) {
  const { supabase, user } = await requireProjectAccess(projectId)
  const cleanText = sanitizeText(text)
  if (!cleanText) return { error: 'O comentário não pode ser vazio' }

  const { data: stage } = await supabase
    .from('project_stages')
    .select('comments')
    .eq('id', stageId)
    .eq('project_id', projectId)
    .single()

  const currentComments: StageComment[] = Array.isArray(stage?.comments) ? stage.comments : []

  // Busca nome de exibição do autor
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('display_name, full_name')
    .eq('user_id', user.id)
    .maybeSingle()

  const authorName =
    profile?.display_name ||
    profile?.full_name ||
    user.user_metadata?.full_name ||
    (user.email ? user.email.split('@')[0] : 'Arquiteto')

  const newComment: StageComment = {
    id: `cmt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    user_id: user.id,
    user_name: authorName,
    user_email: user.email,
    text: cleanText,
    created_at: new Date().toISOString(),
  }

  const updatedComments = [...currentComments, newComment]

  const { error } = await supabase
    .from('project_stages')
    .update({ comments: updatedComments })
    .eq('id', stageId)
    .eq('project_id', projectId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/app/projetos/${projectId}`)
  return { success: true, comment: newComment }
}

export async function editStageCommentAction(
  projectId: string,
  stageId: string,
  commentId: string,
  text: string
): Promise<{ success: boolean; comment?: StageComment; error?: string }> {
  const { supabase } = await requireProjectAccess(projectId)
  const cleanText = sanitizeText(text)
  if (!cleanText) return { success: false, error: 'O comentário não pode ser vazio' }

  const { data: stage } = await supabase
    .from('project_stages')
    .select('comments')
    .eq('id', stageId)
    .eq('project_id', projectId)
    .single()

  const currentComments: StageComment[] = Array.isArray(stage?.comments) ? stage.comments : []
  const targetComment = currentComments.find((c) => c.id === commentId)

  if (!targetComment) {
    return { success: false, error: 'Comentário não encontrado' }
  }

  const updatedComment: StageComment = {
    ...targetComment,
    text: cleanText,
    updated_at: new Date().toISOString(),
  }

  const updatedComments = currentComments.map((c) =>
    c.id === commentId ? updatedComment : c
  )

  const { error } = await supabase
    .from('project_stages')
    .update({ comments: updatedComments })
    .eq('id', stageId)
    .eq('project_id', projectId)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath(`/app/projetos/${projectId}`)
  return { success: true, comment: updatedComment }
}

export async function deleteStageCommentAction(
  projectId: string,
  stageId: string,
  commentId: string
): Promise<{ success: boolean; error?: string }> {
  const { supabase } = await requireProjectAccess(projectId)

  const { data: stage } = await supabase
    .from('project_stages')
    .select('comments')
    .eq('id', stageId)
    .eq('project_id', projectId)
    .single()

  const currentComments: StageComment[] = Array.isArray(stage?.comments) ? stage.comments : []
  const updatedComments = currentComments.filter((c) => c.id !== commentId)

  const { error } = await supabase
    .from('project_stages')
    .update({ comments: updatedComments })
    .eq('id', stageId)
    .eq('project_id', projectId)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath(`/app/projetos/${projectId}`)
  return { success: true }
}

export async function addStageAttachmentAction(
  projectId: string,
  stageId: string,
  attachment: { name: string; url: string; size?: string; is_visible_to_client?: boolean }
) {
  const { supabase } = await requireProjectAccess(projectId)
  const cleanName = sanitizeText(attachment.name)
  const cleanUrl = attachment.url.trim()
  if (!cleanName || !cleanUrl) return { error: 'Nome e URL do anexo são obrigatórios' }

  const { data: stage } = await supabase
    .from('project_stages')
    .select('attachments')
    .eq('id', stageId)
    .eq('project_id', projectId)
    .single()

  const currentAttachments: StageAttachment[] = Array.isArray(stage?.attachments) ? stage.attachments : []
  const newAttachment: StageAttachment = {
    id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    name: cleanName,
    url: cleanUrl,
    size: attachment.size || undefined,
    is_visible_to_client: Boolean(attachment.is_visible_to_client),
    created_at: new Date().toISOString(),
  }

  const updatedAttachments = [...currentAttachments, newAttachment]

  const { error } = await supabase
    .from('project_stages')
    .update({ attachments: updatedAttachments })
    .eq('id', stageId)
    .eq('project_id', projectId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/app/projetos/${projectId}`)
  return { success: true, attachment: newAttachment }
}

/**
 * Faz upload de um arquivo direto do dispositivo para o Supabase Storage ('task-attachments')
 */
export async function uploadStageAttachmentFileAction(
  projectId: string,
  stageId: string,
  formData: FormData
): Promise<{ success: boolean; attachment?: StageAttachment; error?: string }> {
  const { supabase } = await requireProjectAccess(projectId)

  const file = formData.get('file') as File | null
  const customName = formData.get('name') as string | null

  if (!file || !(file instanceof File) || file.size === 0) {
    return { success: false, error: 'Nenhum arquivo válido foi selecionado.' }
  }

  const rawFileName = customName?.trim() || file.name
  const cleanName = sanitizeText(rawFileName) || file.name
  const sanitizedFileName = cleanName.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `${projectId}/${stageId}/${Date.now()}_${sanitizedFileName}`

  // 1. Upload para o Supabase Storage bucket 'task-attachments'
  const fileBuffer = await file.arrayBuffer()
  const { error: uploadError } = await supabase.storage
    .from('task-attachments')
    .upload(storagePath, fileBuffer, {
      contentType: file.type || 'application/octet-stream',
      upsert: true,
    })

  if (uploadError) {
    return {
      success: false,
      error: `Erro no upload para o Supabase Storage: ${uploadError.message}. Certifique-se de que a migration do bucket "task-attachments" foi executada.`,
    }
  }

  // 2. Obtém a URL assinada segura do Storage Privado
  let fileUrl = ''
  const { data: signedUrlData, error: signedError } = await supabase.storage
    .from('task-attachments')
    .createSignedUrl(storagePath, 60 * 60 * 24 * 365) // Válido por 1 ano

  if (!signedError && signedUrlData?.signedUrl) {
    fileUrl = signedUrlData.signedUrl
  } else {
    const { data: publicUrlData } = supabase.storage
      .from('task-attachments')
      .getPublicUrl(storagePath)
    fileUrl = publicUrlData.publicUrl
  }

  // Formata o tamanho do arquivo
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const isVisibleToClientStr = formData.get('isVisibleToClient') as string | null
  const isVisibleToClient = isVisibleToClientStr === 'true' || isVisibleToClientStr === '1'

  const newAttachment: StageAttachment = {
    id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    name: cleanName,
    url: fileUrl,
    size: formatSize(file.size),
    is_visible_to_client: isVisibleToClient,
    created_at: new Date().toISOString(),
  }

  // 3. Registra na lista de anexos da etapa
  const { data: stage } = await supabase
    .from('project_stages')
    .select('attachments')
    .eq('id', stageId)
    .eq('project_id', projectId)
    .single()

  const currentAttachments: StageAttachment[] = Array.isArray(stage?.attachments) ? stage.attachments : []
  const updatedAttachments = [...currentAttachments, newAttachment]

  const { error: dbError } = await supabase
    .from('project_stages')
    .update({ attachments: updatedAttachments })
    .eq('id', stageId)
    .eq('project_id', projectId)

  if (dbError) {
    return { success: false, error: dbError.message }
  }

  revalidatePath(`/app/projetos/${projectId}`)
  return { success: true, attachment: newAttachment }
}


export async function deleteStageAttachmentAction(
  projectId: string,
  stageId: string,
  attachmentId: string
) {
  const { supabase } = await requireProjectAccess(projectId)

  const { data: stage } = await supabase
    .from('project_stages')
    .select('attachments')
    .eq('id', stageId)
    .eq('project_id', projectId)
    .single()

  const currentAttachments: StageAttachment[] = Array.isArray(stage?.attachments) ? stage.attachments : []
  const updatedAttachments = currentAttachments.filter((att) => att.id !== attachmentId)

  const { error } = await supabase
    .from('project_stages')
    .update({ attachments: updatedAttachments })
    .eq('id', stageId)
    .eq('project_id', projectId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/app/projetos/${projectId}`)
  return { success: true }
}

export async function editStageAttachmentAction(
  projectId: string,
  stageId: string,
  attachmentId: string,
  newName: string,
  isVisibleToClient?: boolean
): Promise<{ success: boolean; attachment?: StageAttachment; error?: string }> {
  const { supabase } = await requireProjectAccess(projectId)
  const cleanName = sanitizeText(newName)
  if (!cleanName) return { success: false, error: 'O nome do anexo não pode ser vazio.' }

  const { data: stage } = await supabase
    .from('project_stages')
    .select('attachments')
    .eq('id', stageId)
    .eq('project_id', projectId)
    .single()

  const currentAttachments: StageAttachment[] = Array.isArray(stage?.attachments) ? stage.attachments : []
  let updatedAttachment: StageAttachment | null = null

  const updatedAttachments = currentAttachments.map((att) => {
    if (att.id === attachmentId) {
      updatedAttachment = {
        ...att,
        name: cleanName,
        is_visible_to_client: isVisibleToClient !== undefined ? isVisibleToClient : (att.is_visible_to_client !== false),
      }
      return updatedAttachment
    }
    return att
  })

  if (!updatedAttachment) {
    return { success: false, error: 'Anexo não encontrado.' }
  }

  const { error } = await supabase
    .from('project_stages')
    .update({ attachments: updatedAttachments })
    .eq('id', stageId)
    .eq('project_id', projectId)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath(`/app/projetos/${projectId}`)
  return { success: true, attachment: updatedAttachment }
}

export async function toggleStageAttachmentVisibilityAction(
  projectId: string,
  stageId: string,
  attachmentId: string,
  isVisibleToClient: boolean
): Promise<{ success: boolean; attachment?: StageAttachment; error?: string }> {
  const { supabase } = await requireProjectAccess(projectId)

  const { data: stage } = await supabase
    .from('project_stages')
    .select('attachments')
    .eq('id', stageId)
    .eq('project_id', projectId)
    .single()

  const currentAttachments: StageAttachment[] = Array.isArray(stage?.attachments) ? stage.attachments : []
  let updatedAttachment: StageAttachment | null = null

  const updatedAttachments = currentAttachments.map((att) => {
    if (att.id === attachmentId) {
      updatedAttachment = { ...att, is_visible_to_client: isVisibleToClient }
      return updatedAttachment
    }
    return att
  })

  if (!updatedAttachment) {
    return { success: false, error: 'Anexo não encontrado.' }
  }

  const { error } = await supabase
    .from('project_stages')
    .update({ attachments: updatedAttachments })
    .eq('id', stageId)
    .eq('project_id', projectId)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath(`/app/projetos/${projectId}`)
  return { success: true, attachment: updatedAttachment }
}

export async function requestClientApprovalAction(
  projectId: string,
  stageId: string
) {
  const { supabase } = await requireProjectAccess(projectId)

  const { error } = await supabase
    .from('project_stages')
    .update({
      status: 'em_aprovacao',
      is_locked_for_client: false,
    })
    .eq('id', stageId)
    .eq('project_id', projectId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/app/projetos/${projectId}`)
  return { success: true }
}

export async function unlockStageForEditAction(
  projectId: string,
  stageId: string
) {
  const { supabase } = await requireProjectAccess(projectId)

  const { error } = await supabase
    .from('project_stages')
    .update({
      status: 'em_producao',
      is_locked_for_client: false,
    })
    .eq('id', stageId)
    .eq('project_id', projectId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/app/projetos/${projectId}`)
  return { success: true }
}
