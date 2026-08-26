'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireProjectAccess } from '@/lib/server/guard'
import { sanitizeText } from '@/lib/server/sanitize'

/**
 * Gera ou recupera o Magic Link / Token do Portal do Cliente.
 */
export async function getOrCreatePortalTokenAction(projectId: string) {
  const { supabase } = await requireProjectAccess(projectId)

  // 1. Procura token ativo existente
  const { data: existingToken } = await supabase
    .from('client_access_tokens')
    .select('token, expires_at')
    .eq('project_id', projectId)
    .eq('is_revoked', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existingToken?.token) {
    return { token: existingToken.token }
  }

  // 2. Se não existir, gera um novo
  const { data: newToken, error } = await supabase
    .from('client_access_tokens')
    .insert({ project_id: projectId })
    .select('token')
    .single()

  if (error || !newToken) {
    return { error: 'Falha ao gerar link do cliente.' }
  }

  return { token: newToken.token }
}

/**
 * Consulta dados públicos do portal (tenta RPC e faz fallback automático direto pelo banco).
 */
export async function getPortalDataAction(token: string) {
  const supabase = await createClient()

  // 1. Tenta via RPC se existir e estiver atualizada
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rpcData, error: rpcError } = await (supabase.rpc as any)('get_portal_project', {
      client_token: token,
    })

    if (!rpcError && rpcData && typeof rpcData === 'object' && !('error' in rpcData) && rpcData.project) {
      return { data: rpcData }
    }
  } catch {
    // Continua para o fallback direto
  }

  // 2. Fallback direto (seguro e imune a RPCs com colunas antigas)
  const { data: tokenRecord } = await supabase
    .from('client_access_tokens')
    .select('project_id, is_revoked, expires_at')
    .eq('token', token)
    .eq('is_revoked', false)
    .limit(1)
    .maybeSingle()

  if (!tokenRecord?.project_id) {
    return { error: 'Link do portal inválido ou expirado.' }
  }

  // Atualiza timestamp de último acesso
  await supabase
    .from('client_access_tokens')
    .update({ last_accessed_at: new Date().toISOString() })
    .eq('token', token)

  const { data: project } = await supabase
    .from('projects')
    .select('id, code, title, description, client_name, area_sqm, deadline, status, organization_id')
    .eq('id', tokenRecord.project_id)
    .single()

  if (!project) {
    return { error: 'Projeto não encontrado.' }
  }

  const { data: org } = await supabase
    .from('organizations')
    .select('name, logo_url, cau_caubr, phone, email')
    .eq('id', project.organization_id)
    .single()

  const { data: stages } = await supabase
    .from('project_stages')
    .select('id, name, description, stage_order, status, progress_percent, start_date, due_date, is_client_approval_required, is_locked_for_client, attachments')
    .eq('project_id', project.id)
    .order('stage_order', { ascending: true })

  return {
    data: {
      project: {
        id: project.id,
        code: project.code,
        title: project.title,
        description: project.description,
        client_name: project.client_name,
        area_sqm: project.area_sqm,
        deadline: project.deadline,
        status: project.status,
      },
      organization: org || {
        name: 'Escritório de Arquitetura',
        logo_url: null,
        cau_caubr: null,
        phone: null,
        email: null,
      },
      stages: stages || [],
    },
  }
}

/**
 * Registra aprovação ou solicitação de ajustes do cliente via RPC com fallback seguro.
 */
export async function submitClientApprovalAction(
  token: string,
  stageId: string,
  actionType: 'approved' | 'changes_requested',
  formData: FormData
) {
  const approverName = sanitizeText(formData.get('approverName') as string)
  const approverEmail = sanitizeText(formData.get('approverEmail') as string)
  const feedback = sanitizeText(formData.get('feedback') as string)

  if (!approverName) {
    return { error: 'Por favor, informe seu nome para confirmar a ação.' }
  }

  const supabase = await createClient()

  // 1. Tenta via RPC
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rpcData, error: rpcError } = await (supabase.rpc as any)('submit_portal_approval', {
      client_token: token,
      target_stage_id: stageId,
      action_type: actionType,
      approver_name: approverName,
      approver_email: approverEmail || undefined,
      feedback: feedback || undefined,
    })

    if (!rpcError && rpcData && typeof rpcData === 'object' && (rpcData as { success?: boolean }).success) {
      revalidatePath(`/portal/${token}`)
      return { success: true, action: actionType }
    }
  } catch {
    // Segue para o fallback direto
  }

  // 2. Fallback direto de aprovação
  const { data: tokenRecord } = await supabase
    .from('client_access_tokens')
    .select('project_id')
    .eq('token', token)
    .eq('is_revoked', false)
    .single()

  if (!tokenRecord?.project_id) {
    return { error: 'Link do portal inválido ou expirado.' }
  }

  const projectId = tokenRecord.project_id

  // Registra auditoria
  await supabase.from('stage_approvals').insert({
    project_id: projectId,
    stage_id: stageId,
    action: actionType,
    approver_name: approverName,
    approver_email: approverEmail || null,
    feedback_message: feedback || null,
  })

  // Atualiza status da etapa
  if (actionType === 'approved') {
    await supabase
      .from('project_stages')
      .update({
        status: 'concluido',
        progress_percent: 100,
        is_locked_for_client: true,
      })
      .eq('id', stageId)
      .eq('project_id', projectId)
  } else {
    await supabase
      .from('project_stages')
      .update({
        status: 'em_producao',
        progress_percent: 50,
        is_locked_for_client: false,
      })
      .eq('id', stageId)
      .eq('project_id', projectId)
  }

  revalidatePath(`/portal/${token}`)
  return { success: true, action: actionType }
}
