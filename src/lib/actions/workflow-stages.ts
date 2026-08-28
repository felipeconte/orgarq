'use server'

import { revalidatePath } from 'next/cache'
import { requireAuth, requireOrgAccess } from '@/lib/server/guard'
import { sanitizeText } from '@/lib/server/sanitize'
import {
  WorkflowStage,
  WorkflowStageColor,
  DEFAULT_WORKFLOW_STAGES,
  normalizeWorkflowStages
} from '@/lib/workflow-stages'

export async function getWorkflowStagesAction(explicitOrgId?: string): Promise<{
  success: boolean
  stages: WorkflowStage[]
  organizationId: string
  error?: string
}> {
  try {
    const { supabase, user } = await requireAuth()

    let orgId = explicitOrgId || ''
    if (!orgId) {
      const { data: member } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle()

      if (member?.organization_id) {
        orgId = member.organization_id
      } else {
        const { data: org } = await supabase
          .from('organizations')
          .select('id')
          .eq('owner_id', user.id)
          .limit(1)
          .maybeSingle()
        if (org?.id) orgId = org.id
      }
    }

    if (!orgId) {
      return { success: true, stages: DEFAULT_WORKFLOW_STAGES, organizationId: '' }
    }

    const { data: org, error } = await (supabase
      .from('organizations') as any)
      .select('id, workflow_stages')
      .eq('id', orgId)
      .maybeSingle()

    if (error || !org) {
      return { success: true, stages: DEFAULT_WORKFLOW_STAGES, organizationId: orgId }
    }

    const saved = org.workflow_stages as WorkflowStage[] | null
    const normalized = normalizeWorkflowStages(saved)

    return { success: true, stages: normalized, organizationId: orgId }
  } catch (err: unknown) {
    console.error('Erro ao buscar etapas do fluxo:', err)
    return {
      success: false,
      stages: DEFAULT_WORKFLOW_STAGES,
      organizationId: '',
      error: err instanceof Error ? err.message : 'Falha ao carregar etapas.',
    }
  }
}

export async function saveWorkflowStagesAction(
  stages: WorkflowStage[],
  explicitOrgId?: string
): Promise<{ success: boolean; stages?: WorkflowStage[]; error?: string }> {
  try {
    const { supabase, user } = await requireAuth()

    let orgId = explicitOrgId || ''
    if (!orgId) {
      const { data: member } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle()

      if (member?.organization_id) orgId = member.organization_id
    }

    if (!orgId) {
      return { success: false, error: 'Organização não encontrada.' }
    }

    await requireOrgAccess(orgId)

    const cleanedStages: WorkflowStage[] = stages.map((s, idx) => ({
      id: sanitizeText(s.id).trim() || `stage_${idx + 1}`,
      name: sanitizeText(s.name).trim() || `Etapa ${idx + 1}`,
      color: (s.color || 'blue') as WorkflowStageColor,
      order_index: idx,
      is_system: Boolean(s.is_system),
      is_client_approval_stage: Boolean(s.is_client_approval_stage),
      is_revision_stage: Boolean(s.is_revision_stage),
      is_approved_stage: Boolean(s.is_approved_stage),
      is_final_stage: Boolean(s.is_final_stage),
    }))

    const { error } = await supabase
      .from('organizations')
      .update({ workflow_stages: cleanedStages } as any)
      .eq('id', orgId)

    if (error) {
      console.error('Erro ao salvar workflow_stages:', error)
      return { success: false, error: error.message }
    }

    revalidatePath('/app/configuracoes/etapas-fluxo')
    revalidatePath('/app/projetos')
    revalidatePath('/app')

    return { success: true, stages: cleanedStages }
  } catch (err: unknown) {
    console.error('Erro ao salvar etapas:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Falha ao salvar etapas.' }
  }
}

export async function createWorkflowStageAction(
  name: string,
  color: WorkflowStageColor = 'blue',
  explicitOrgId?: string
): Promise<{ success: boolean; stage?: WorkflowStage; stages?: WorkflowStage[]; error?: string }> {
  try {
    const fetchRes = await getWorkflowStagesAction(explicitOrgId)
    const orgId = fetchRes.organizationId
    if (!orgId) return { success: false, error: 'Organização não encontrada.' }

    const cleanName = sanitizeText(name).trim()
    if (!cleanName) return { success: false, error: 'O nome da etapa é obrigatório.' }

    const currentStages = fetchRes.stages || DEFAULT_WORKFLOW_STAGES
    const baseSlug = cleanName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .slice(0, 20)

    const uniqueId = `${baseSlug || 'etapa'}_${Date.now().toString(36)}`

    const newStage: WorkflowStage = {
      id: uniqueId,
      name: cleanName,
      color,
      order_index: currentStages.length,
      is_system: false,
    }

    const updatedStages = [...currentStages, newStage]
    const saveRes = await saveWorkflowStagesAction(updatedStages, orgId)

    if (!saveRes.success) return { success: false, error: saveRes.error }

    return { success: true, stage: newStage, stages: updatedStages }
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Falha ao criar etapa.' }
  }
}

export async function renameWorkflowStageAction(
  stageId: string,
  newName: string,
  newColor?: WorkflowStageColor,
  explicitOrgId?: string
): Promise<{ success: boolean; stages?: WorkflowStage[]; error?: string }> {
  try {
    const fetchRes = await getWorkflowStagesAction(explicitOrgId)
    const orgId = fetchRes.organizationId
    if (!orgId) return { success: false, error: 'Organização não encontrada.' }

    const cleanName = sanitizeText(newName).trim()
    if (!cleanName) return { success: false, error: 'Nome não pode ser vazio.' }

    const currentStages = fetchRes.stages || DEFAULT_WORKFLOW_STAGES
    const updatedStages = currentStages.map((s) =>
      s.id === stageId
        ? {
            ...s,
            name: cleanName,
            color: newColor || s.color,
          }
        : s
    )

    const saveRes = await saveWorkflowStagesAction(updatedStages, orgId)
    return saveRes
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Falha ao renomear etapa.' }
  }
}

export async function deleteWorkflowStageAction(
  stageId: string,
  fallbackStageId?: string,
  explicitOrgId?: string
): Promise<{ success: boolean; stages?: WorkflowStage[]; error?: string }> {
  try {
    const { supabase } = await requireAuth()
    const fetchRes = await getWorkflowStagesAction(explicitOrgId)
    const orgId = fetchRes.organizationId
    if (!orgId) return { success: false, error: 'Organização não encontrada.' }

    const currentStages = fetchRes.stages || DEFAULT_WORKFLOW_STAGES
    if (currentStages.length <= 1) {
      return { success: false, error: 'O projeto deve ter pelo menos uma etapa de fluxo ativa.' }
    }

    const remaining = currentStages.filter((s) => s.id !== stageId)
    const fallbackId = fallbackStageId || remaining[0]?.id || 'a_iniciar'

    // Migra tarefas da etapa excluída para a etapa de fallback
    await (supabase
      .from('project_stages') as any)
      .update({ status: fallbackId })
      .eq('status', stageId)

    const saveRes = await saveWorkflowStagesAction(remaining, orgId)
    return saveRes
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Falha ao excluir etapa.' }
  }
}

export async function resetWorkflowStagesAction(
  explicitOrgId?: string
): Promise<{ success: boolean; stages?: WorkflowStage[]; error?: string }> {
  try {
    const { supabase } = await requireAuth()
    const fetchRes = await getWorkflowStagesAction(explicitOrgId)
    const orgId = fetchRes.organizationId
    if (!orgId) return { success: false, error: 'Organização não encontrada.' }

    // Busca projetos da organização para vincular todas as tarefas à etapa 'a_iniciar'
    const { data: orgProjects } = await (supabase
      .from('projects') as any)
      .select('id')
      .eq('organization_id', orgId)

    const projectIds = (orgProjects || []).map((p: any) => p.id)
    if (projectIds.length > 0) {
      await (supabase
        .from('project_stages') as any)
        .update({ status: 'a_iniciar' })
        .in('project_id', projectIds)
    }

    const saveRes = await saveWorkflowStagesAction(DEFAULT_WORKFLOW_STAGES, orgId)
    return saveRes
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Falha ao restaurar padrão.' }
  }
}
