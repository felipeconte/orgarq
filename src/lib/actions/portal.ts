'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireProjectAccess } from '@/lib/server/guard'
import { sanitizeText } from '@/lib/server/sanitize'
import {
  normalizeWorkflowStages,
  getApprovedStage,
  getRevisionStage
} from '@/lib/workflow-stages'
import { getClientPortalSession } from '@/lib/actions/client-portal-auth'

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
      const filteredRpcStages = (rpcData.stages || [])
        .filter((s: any) => s.is_client_approval_required !== false)
        .map((s: any) => ({
          ...s,
          attachments: (Array.isArray(s.attachments) ? s.attachments : []).filter(
            (att: any) => att.is_visible_to_client !== false
          ),
        }))
      return {
        data: {
          ...rpcData,
          stages: filteredRpcStages,
        },
      }
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
    .select('id, code, title, description, client_id, client_name, area_sqm, deadline, status, organization_id')
    .eq('id', tokenRecord.project_id)
    .single()

  if (!project) {
    return { error: 'Projeto não encontrado.' }
  }

  const { data: org } = await (supabase
    .from('organizations') as any)
    .select('name, logo_url, cau_caubr, phone, email, workflow_stages')
    .eq('id', project.organization_id)
    .single()

  // 1. Busca todos os clientes vinculados ao projeto
  const { data: pcRows } = await supabase
    .from('project_clients')
    .select('client_id, clients(id, name, email, phone, person_type)')
    .eq('project_id', project.id)

  let linkedClients: { id: string; name: string; email: string | null; phone: string | null; person_type: string }[] = []

  if (pcRows && pcRows.length > 0) {
    linkedClients = pcRows
      .map((r: any) => r.clients)
      .filter((c: any): c is { id: string; name: string; email: string | null; phone: string | null; person_type: string } => Boolean(c))
  }

  // Fallback para projetos legados
  if (linkedClients.length === 0) {
    if (project.client_id) {
      const { data: singleClient } = await supabase
        .from('clients')
        .select('id, name, email, phone, person_type')
        .eq('id', project.client_id)
        .maybeSingle()
      if (singleClient) linkedClients.push(singleClient)
    } else if (project.client_name) {
      linkedClients.push({
        id: 'legacy-client',
        name: project.client_name,
        email: null,
        phone: null,
        person_type: 'PF',
      })
    }
  }

  const { data: stages } = await supabase
    .from('project_stages')
    .select('id, name, description, stage_order, status, progress_percent, start_date, due_date, is_client_approval_required, is_locked_for_client, attachments, comments')
    .eq('project_id', project.id)
    .eq('is_client_approval_required', true)
    .order('stage_order', { ascending: true })

  // 2. Busca histórico de aprovações da tabela stage_approvals
  const { data: approvalsData } = await supabase
    .from('stage_approvals')
    .select('id, stage_id, client_id, approver_name, approver_email, action, created_at, feedback_message')
    .eq('project_id', project.id)
    .order('created_at', { ascending: true })

  const stageApprovalsMap = new Map<string, any[]>()
  ;(approvalsData || []).forEach((a) => {
    const list = stageApprovalsMap.get(a.stage_id) || []
    list.push(a)
    stageApprovalsMap.set(a.stage_id, list)
  })

  const totalRequired = Math.max(linkedClients.length, 1)

  const enrichedStages = (stages || []).map((s: any) => {
    const stageApprovals = stageApprovalsMap.get(s.id) || []
    const approvedRecords = stageApprovals.filter((a) => a.action === 'approved')

    // Identifica clientes únicos que aprovaram
    const uniqueApprovedKeys = new Set(
      approvedRecords.map((a) => a.client_id || a.approver_name.toLowerCase())
    )
    const currentApprovedCount = uniqueApprovedKeys.size
    const isFullyApproved = currentApprovedCount >= totalRequired

    const approvedClientsList = approvedRecords.map((a) => ({
      clientId: a.client_id,
      name: a.approver_name,
      approvedAt: a.created_at,
    }))

    const rawAttachments = Array.isArray(s.attachments) ? s.attachments : []
    const visibleAttachments = rawAttachments.filter((att: any) => att.is_visible_to_client !== false)

    return {
      ...s,
      attachments: visibleAttachments,
      approvals: stageApprovals,
      approvalProgress: {
        totalRequired,
        currentApprovedCount,
        isFullyApproved,
        approvedClients: approvedClientsList,
      },
    }
  })

  const workflowStages = normalizeWorkflowStages(org?.workflow_stages)

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
      clients: linkedClients,
      organization: org || {
        name: 'Escritório de Arquitetura',
        logo_url: null,
        cau_caubr: null,
        phone: null,
        email: null,
      },
      stages: enrichedStages,
      workflowStages: workflowStages,
    },
  }
}

/**
 * Registra aprovação ou solicitação de ajustes do cliente com suporte a aprovação colegiada.
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
  const clientId = (formData.get('clientId') as string) || null

  if (!approverName) {
    return { error: 'Por favor, informe seu nome para confirmar a ação.' }
  }

  const supabase = await createClient()

  // 1. Valida token e obtém project_id
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

  // 2. Busca projeto e lista de clientes vinculados
  const { data: project } = await supabase
    .from('projects')
    .select('id, client_id, client_name, organization_id, organizations(workflow_stages)')
    .eq('id', projectId)
    .single()

  const { data: pcRows } = await supabase
    .from('project_clients')
    .select('client_id, clients(id, name, email)')
    .eq('project_id', projectId)

  let linkedClients: { id: string; name: string }[] = []
  if (pcRows && pcRows.length > 0) {
    linkedClients = pcRows.map((r: any) => r.clients).filter(Boolean)
  }

  const totalLinkedClients = Math.max(linkedClients.length, 1)

  // 3. Tenta resolver o client_id caso não tenha sido enviado
  let resolvedClientId = clientId
  if (!resolvedClientId && linkedClients.length > 0) {
    const matched = linkedClients.find(
      (c) => c.name.toLowerCase() === approverName.toLowerCase()
    )
    if (matched) {
      resolvedClientId = matched.id
    }
  }

  // 3.1. Validação de Convergência Cadastral (Impede ação se houver divergência ou solicitação pendente)
  const portalSession = await getClientPortalSession()
  if (portalSession && project?.organization_id) {
    const { data: portalAccount } = await supabase
      .from('client_portal_accounts')
      .select('name, email, phone, address, city, state, zip_code')
      .eq('cpf', portalSession.cpf)
      .maybeSingle()

    const { data: officeClient } = await supabase
      .from('clients')
      .select('name, email, phone, address, city, state, zip_code')
      .eq('document_number', portalSession.cpf)
      .eq('organization_id', project.organization_id)
      .maybeSingle()

    const { data: pendingReq } = await supabase
      .from('client_update_requests')
      .select('id')
      .eq('organization_id', project.organization_id)
      .eq('cpf', portalSession.cpf)
      .eq('status', 'pending')
      .maybeSingle()

    let hasDivergence = false
    if (portalAccount && officeClient) {
      if (portalAccount.name.trim().toLowerCase() !== (officeClient.name || '').trim().toLowerCase()) hasDivergence = true
      if ((portalAccount.email || '').trim().toLowerCase() !== (officeClient.email || '').trim().toLowerCase()) hasDivergence = true
      if ((portalAccount.phone || '').replace(/\D/g, '') !== (officeClient.phone || '').replace(/\D/g, '')) hasDivergence = true
      if ((portalAccount.address || '').trim().toLowerCase() !== (officeClient.address || '').trim().toLowerCase()) hasDivergence = true
      if ((portalAccount.city || '').trim().toLowerCase() !== (officeClient.city || '').trim().toLowerCase()) hasDivergence = true
      if ((portalAccount.state || '').trim().toUpperCase() !== (officeClient.state || '').trim().toUpperCase()) hasDivergence = true
      if ((portalAccount.zip_code || '').replace(/\D/g, '') !== (officeClient.zip_code || '').replace(/\D/g, '')) hasDivergence = true
    }

    if (hasDivergence || pendingReq) {
      return {
        error: 'Existem divergências cadastrais com o escritório. Por favor, regularize seus dados antes de aprovar ou solicitar ajustes nesta etapa.',
      }
    }
  }

  // 4. Workflow stages para status de aprovação
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawWorkflowStages = (project?.organizations as any)?.workflow_stages
  const normalizedStages = normalizeWorkflowStages(rawWorkflowStages)
  const approvedStage = getApprovedStage(normalizedStages)
  const revisionStage = getRevisionStage(normalizedStages)

  const targetStatus = actionType === 'approved'
    ? (approvedStage?.id || 'concluido')
    : (revisionStage?.id || 'em_producao')

  // 5. Registra auditoria na tabela stage_approvals
  await supabase.from('stage_approvals').insert({
    project_id: projectId,
    stage_id: stageId,
    client_id: resolvedClientId || null,
    action: actionType,
    approver_name: approverName,
    approver_email: approverEmail || null,
    feedback_message: feedback || null,
  })

  // 6. Busca histórico de aprovações para calcular quantas aprovações únicas já foram registradas
  const { data: stageApprovals } = await supabase
    .from('stage_approvals')
    .select('id, client_id, approver_name, action')
    .eq('stage_id', stageId)
    .eq('project_id', projectId)
    .eq('action', 'approved')

  const uniqueApprovers = new Set(
    (stageApprovals || []).map((a) => a.client_id || a.approver_name.toLowerCase())
  )
  const approvedCount = uniqueApprovers.size
  const isFullyApproved = approvedCount >= totalLinkedClients

  // 7. Busca comentários atuais da tarefa para registrar o histórico de validação
  const { data: currentStage } = await supabase
    .from('project_stages')
    .select('comments')
    .eq('id', stageId)
    .eq('project_id', projectId)
    .single()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentComments: any[] = Array.isArray(currentStage?.comments) ? currentStage.comments : []

  let commentText = ''
  if (actionType === 'approved') {
    if (isFullyApproved) {
      commentText = totalLinkedClients > 1
        ? `🎉 [Validação Concluída] Aprovado por ${approverName} (${approvedCount} de ${totalLinkedClients} clientes aprovaram - Todas as aprovações concluídas!).${feedback ? `\nObservação: "${feedback}"` : ''}`
        : `✅ [Validação do Cliente] Aprovado por ${approverName}.${feedback ? `\nObservação: "${feedback}"` : ''}`
    } else {
      commentText = `✅ [Validação Parcial] Aprovado por ${approverName} (${approvedCount} de ${totalLinkedClients} aprovações necessárias). Aguardando aprovação dos demais clientes.${feedback ? `\nObservação: "${feedback}"` : ''}`
    }
  } else {
    commentText = `⚠️ [Validação do Cliente] Solicitação de Ajustes por ${approverName}:\n"${feedback || 'Ajustes solicitados conforme alinhamento.'}"`
  }

  const validationComment = {
    id: `cmt-portal-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    user_id: 'portal-client',
    user_name: `${approverName} (Cliente)`,
    user_email: approverEmail || null,
    text: commentText,
    created_at: new Date().toISOString(),
  }

  const updatedComments = [...currentComments, validationComment]

  // 8. Atualiza status da etapa no banco
  if (actionType === 'approved') {
    if (isFullyApproved) {
      // Todos aprovaram: conclui a etapa
      await (supabase
        .from('project_stages') as any)
        .update({
          status: targetStatus,
          progress_percent: 100,
          is_locked_for_client: true,
          comments: updatedComments,
        })
        .eq('id', stageId)
        .eq('project_id', projectId)
    } else {
      // Aprovação parcial: mantém em aprovação
      await (supabase
        .from('project_stages') as any)
        .update({
          status: 'em_aprovacao',
          progress_percent: Math.round((approvedCount / totalLinkedClients) * 100),
          is_locked_for_client: false,
          comments: updatedComments,
        })
        .eq('id', stageId)
        .eq('project_id', projectId)
    }
  } else {
    // Solicitação de ajustes
    await (supabase
      .from('project_stages') as any)
      .update({
        status: targetStatus,
        progress_percent: 50,
        is_locked_for_client: false,
        comments: updatedComments,
      })
      .eq('id', stageId)
      .eq('project_id', projectId)
  }

  revalidatePath(`/portal/${token}`)
  revalidatePath(`/app/projetos/${projectId}`)
  revalidatePath('/app/projetos')
  return { success: true, action: actionType, isFullyApproved }
}
