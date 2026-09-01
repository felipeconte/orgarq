'use server'

import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { cleanDigits, maskCPF, validateCPF } from '@/lib/formatters-and-validators'
import {
  verifyClientPassword,
  signClientPortalSession,
  verifyClientPortalSession,
  ClientPortalSessionData,
} from '@/lib/server/client-auth-crypto'

const CLIENT_SESSION_COOKIE = 'orgarq_client_session'

export interface ClientPortalProjectCard {
  id: string
  code: string
  title: string
  typology: string | null
  status: string
  deadline: string | null
  progress_percent: number
  total_stages: number
  completed_stages: number
  current_stage_name?: string
  is_pending_client_approval: boolean
  office: {
    id: string
    name: string
    logo_url?: string | null
    phone?: string | null
    email?: string | null
    cau_caubr?: string | null
  }
}

export interface ClientPortalDashboardData {
  client: {
    cpf: string
    name: string
    email?: string | null
  }
  projects: ClientPortalProjectCard[]
  officesCount: number
}

/**
 * 1. REALIZA O LOGIN DO CLIENTE COM CPF E SENHA
 */
export async function clientPortalLoginAction(formData: FormData): Promise<{
  success: boolean
  error?: string
  redirectUrl?: string
}> {
  const rawCpf = formData.get('cpf') as string | null
  const password = formData.get('password') as string | null

  if (!rawCpf || !password) {
    return { success: false, error: 'Por favor, informe seu CPF e sua senha de acesso.' }
  }

  const cleanCpf = cleanDigits(rawCpf)
  if (!cleanCpf || cleanCpf.length !== 11) {
    return { success: false, error: 'O CPF informado deve conter exatamente 11 dígitos numéricos.' }
  }

  const supabase = await createClient()

  // 1. Busca conta na tabela global client_portal_accounts
  let account: any = null

  const { data: portalAcc, error: accErr } = await supabase
    .from('client_portal_accounts')
    .select('id, cpf, name, email, password_hash')
    .eq('cpf', cleanCpf)
    .maybeSingle()

  if (portalAcc && !accErr) {
    account = portalAcc
  }

  // Se não encontrou em client_portal_accounts, busca fallback na tabela clients
  if (!account) {
    const { data: clientRows } = await supabase
      .from('clients')
      .select('id, name, email, document_number')
      .eq('document_number', cleanCpf)
      .limit(1)

    if (!clientRows || clientRows.length === 0) {
      return {
        success: false,
        error: 'Nenhum cadastro encontrado com este CPF. Entre em contato com seu escritório de arquitetura.',
      }
    }
  }

  if (!account) {
    return {
      success: false,
      error: 'Senha de acesso não configurada. Solicite ao seu arquiteto o envio da senha por e-mail.',
    }
  }

  // 2. Valida a senha digitada contra o hash seguro
  const isValid = verifyClientPassword(password.trim(), account.password_hash)
  if (!isValid) {
    return {
      success: false,
      error: 'CPF ou senha incorretos. Verifique a senha recebida por e-mail e tente novamente.',
    }
  }

  // 3. Cria sessão segura via Cookie HTTP-Only
  const token = signClientPortalSession({
    cpf: cleanCpf,
    name: account.name,
    email: account.email || null,
  })

  const cookieStore = await cookies()
  cookieStore.set(CLIENT_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 dias
  })

  // 4. Registra timestamp de login
  await supabase
    .from('client_portal_accounts')
    .update({ last_login_at: new Date().toISOString() })
    .eq('cpf', cleanCpf)

  return { success: true, redirectUrl: '/portal' }
}

/**
 * 2. ENCERRA A SESSÃO DO CLIENTE
 */
export async function clientPortalLogoutAction(): Promise<{ success: boolean }> {
  const cookieStore = await cookies()
  cookieStore.delete(CLIENT_SESSION_COOKIE)
  return { success: true }
}

/**
 * 3. RECUPERA A SESSÃO ATUAL DO CLIENTE
 */
export async function getClientPortalSession(): Promise<ClientPortalSessionData | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(CLIENT_SESSION_COOKIE)?.value
    if (!token) return null
    return verifyClientPortalSession(token)
  } catch {
    return null
  }
}

/**
 * ATUALIZA OS DADOS DO COOKIE DE SESSÃO DO CLIENTE
 */
export async function refreshClientPortalSession(sessionData: {
  cpf: string
  name: string
  email: string | null
}): Promise<void> {
  try {
    const token = signClientPortalSession({
      cpf: sessionData.cpf,
      name: sessionData.name,
      email: sessionData.email || null,
    })

    const cookieStore = await cookies()
    cookieStore.set(CLIENT_SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 dias
    })
  } catch (err) {
    console.error('Erro ao atualizar cookie de sessão do portal:', err)
  }
}

/**
 * 4. BUSCA TODOS OS PROJETOS VINCULADOS AO CLIENTE (INCLUINDO MULTI-ESCRITÓRIOS)
 */
export async function getClientPortalDashboardDataAction(): Promise<{
  success: boolean
  data?: ClientPortalDashboardData
  error?: string
}> {
  const session = await getClientPortalSession()
  if (!session) {
    return { success: false, error: 'UNAUTHORIZED' }
  }

  const supabase = await createClient()

  // Busca dados atuais do perfil do cliente em client_portal_accounts
  const { data: portalAcc } = await supabase
    .from('client_portal_accounts')
    .select('name, email')
    .eq('cpf', session.cpf)
    .maybeSingle()

  const clientName = portalAcc?.name || session.name
  const clientEmail = portalAcc?.email || session.email || null

  // 1. Busca todos os registros de clientes que possuem este CPF (pode pertencer a mais de 1 escritório)
  const { data: clientRecords, error: clientErr } = await supabase
    .from('clients')
    .select('id, organization_id, name, email, document_number')
    .eq('document_number', session.cpf)

  if (clientErr || !clientRecords || clientRecords.length === 0) {
    return {
      success: true,
      data: {
        client: {
          cpf: session.cpf,
          name: clientName,
          email: clientEmail,
        },
        projects: [],
        officesCount: 0,
      },
    }
  }

  const clientIds = clientRecords.map((c) => c.id)
  const orgIds = Array.from(new Set(clientRecords.map((c) => c.organization_id)))

  // 2. Busca informações de todas as organizações (escritórios)
  const { data: orgsData } = await (supabase
    .from('organizations') as any)
    .select('id, name, logo_url, phone, email, cau_caubr')
    .in('id', orgIds)

  const orgsMap = new Map<string, any>()
  ;(orgsData || []).forEach((o: any) => {
    orgsMap.set(o.id, o)
  })

  // 3. Busca IDs de projetos na tabela N:N project_clients
  const { data: pcRows } = await supabase
    .from('project_clients')
    .select('project_id, client_id')
    .in('client_id', clientIds)

  const linkedProjectIds = (pcRows || []).map((r) => r.project_id)

  // 4. Busca projetos vinculados
  let projectQuery = supabase
    .from('projects')
    .select(`
      id,
      code,
      title,
      typology,
      status,
      deadline,
      organization_id,
      created_at,
      project_stages(
        id,
        name,
        stage_order,
        status,
        progress_percent,
        is_client_approval_required
      )
    `)
    .in('organization_id', orgIds)

  if (linkedProjectIds.length > 0) {
    projectQuery = projectQuery.or(`id.in.(${linkedProjectIds.join(',')}),client_id.in.(${clientIds.join(',')})`)
  } else {
    projectQuery = projectQuery.in('client_id', clientIds)
  }

  const { data: projects, error: projErr } = await projectQuery.order('created_at', { ascending: false })

  if (projErr) {
    console.error('Erro ao buscar projetos do portal do cliente:', projErr)
    return { success: false, error: 'Erro ao carregar projetos.' }
  }

  const projectCards: ClientPortalProjectCard[] = (projects || []).map((p: any) => {
    const stages = (p.project_stages || []).sort(
      (a: any, b: any) => (a.stage_order || 0) - (b.stage_order || 0)
    )

    const totalStages = stages.length
    const completedStages = stages.filter((s: any) => s.status === 'concluido').length
    const progressPercent = totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 0

    // Etapa ativa ou em aprovação
    const pendingApprovalStage = stages.find(
      (s: any) => s.status === 'em_aprovacao' && s.is_client_approval_required !== false
    )
    const activeStage =
      pendingApprovalStage ||
      stages.find((s: any) => s.status === 'em_producao') ||
      stages.find((s: any) => s.status === 'a_iniciar') ||
      stages[stages.length - 1]

    const org = orgsMap.get(p.organization_id) || {
      id: p.organization_id,
      name: 'Escritório de Arquitetura',
    }

    return {
      id: p.id,
      code: p.code,
      title: p.title,
      typology: p.typology,
      status: p.status,
      deadline: p.deadline,
      progress_percent: progressPercent,
      total_stages: totalStages,
      completed_stages: completedStages,
      current_stage_name: activeStage?.name || undefined,
      is_pending_client_approval: Boolean(pendingApprovalStage),
      office: {
        id: org.id,
        name: org.name,
        logo_url: org.logo_url || null,
        phone: org.phone || null,
        email: org.email || null,
        cau_caubr: org.cau_caubr || null,
      },
    }
  })

  return {
    success: true,
    data: {
      client: {
        cpf: session.cpf,
        name: session.name,
        email: session.email,
      },
      projects: projectCards,
      officesCount: orgIds.length,
    },
  }
}

/**
 * 5. BUSCA OS DADOS COMPLETOS DO PROJETO SELECIONADO PARA O CLIENTE LOGADO
 */
export async function getClientPortalProjectDetailAction(projectId: string) {
  const session = await getClientPortalSession()
  if (!session) {
    return { success: false, error: 'UNAUTHORIZED' }
  }

  const supabase = await createClient()

  // 1. Valida se o cliente autenticado tem vínculo com este projeto
  const { data: clientRecords } = await supabase
    .from('clients')
    .select('id, organization_id')
    .eq('document_number', session.cpf)

  const clientIds = (clientRecords || []).map((c) => c.id)

  // 1. Busca dados do projeto
  const { data: project, error: projErr } = await supabase
    .from('projects')
    .select('id, code, title, description, client_id, client_name, area_sqm, deadline, status, organization_id, organizations(id, name, logo_url, phone, email, cau_caubr, workflow_stages)')
    .eq('id', projectId)
    .single()

  if (projErr || !project) {
    return { success: false, error: 'Projeto não encontrado.' }
  }

  const org = (project as any)?.organizations || null

  // Verifica vínculo via client_id ou tabela project_clients
  let isLinked = Boolean(project.client_id && clientIds.includes(project.client_id))

  if (!isLinked) {
    const { data: pcRow } = await supabase
      .from('project_clients')
      .select('id')
      .eq('project_id', projectId)
      .in('client_id', clientIds)
      .limit(1)
      .maybeSingle()

    if (pcRow) {
      isLinked = true
    }
  }

  if (!isLinked) {
    return { success: false, error: 'Você não possui permissão para visualizar este projeto.' }
  }

  // 2. Busca lista de clientes vinculados a este projeto (N:N)
  const { data: projectClientRows } = await supabase
    .from('project_clients')
    .select('client_id, clients(id, name, email, phone, person_type, document_number)')
    .eq('project_id', projectId)

  const linkedClients: any[] = []
  ;(projectClientRows || []).forEach((row: any) => {
    if (row.clients) {
      linkedClients.push(row.clients)
    }
  })

  // Fallback se não houver registros em project_clients
  if (linkedClients.length === 0) {
    if (project.client_id) {
      const { data: singleClient } = await supabase
        .from('clients')
        .select('id, name, email, phone, person_type, document_number')
        .eq('id', project.client_id)
        .maybeSingle()
      if (singleClient) linkedClients.push(singleClient)
    }
  }

  // 4. Busca dados da conta global do cliente e do cadastro deste cliente neste escritório
  const { data: portalAccount } = await supabase
    .from('client_portal_accounts')
    .select('name, email, phone, address, city, state, zip_code')
    .eq('cpf', session.cpf)
    .maybeSingle()

  const currentProfileName = portalAccount?.name || session.name
  const currentProfileEmail = portalAccount?.email || session.email || null

  const profileData = {
    name: currentProfileName,
    email: currentProfileEmail,
    phone: portalAccount?.phone || null,
    address: portalAccount?.address || null,
    city: portalAccount?.city || null,
    state: portalAccount?.state || null,
    zip_code: portalAccount?.zip_code || null,
  }

  if (linkedClients.length === 0) {
    linkedClients.push({
      id: 'session-client',
      name: currentProfileName,
      email: currentProfileEmail || null,
      phone: null,
      person_type: 'PF',
    })
  }

  // Identifica o cliente logado nesta sessão
  const matchingClient = linkedClients.find((c) =>
    (c.document_number && session.cpf && c.document_number.replace(/\D/g, '') === session.cpf.replace(/\D/g, '')) ||
    (c.email && session.email && c.email.toLowerCase() === session.email.toLowerCase()) ||
    c.name.trim().toLowerCase() === currentProfileName.trim().toLowerCase()
  ) || linkedClients[0]

  const loggedClient = {
    id: matchingClient?.id || null,
    name: currentProfileName,
    email: currentProfileEmail || matchingClient?.email || null,
  }

  const { data: officeClient } = await supabase
    .from('clients')
    .select('id, name, email, phone, address, city, state, zip_code')
    .eq('document_number', session.cpf)
    .eq('organization_id', project.organization_id)
    .maybeSingle()

  const officeData = {
    id: officeClient?.id || matchingClient?.id || null,
    name: officeClient?.name || matchingClient?.name || '',
    email: officeClient?.email || matchingClient?.email || null,
    phone: officeClient?.phone || matchingClient?.phone || null,
    address: officeClient?.address || null,
    city: officeClient?.city || null,
    state: officeClient?.state || null,
    zip_code: officeClient?.zip_code || null,
  }

  // 5. Busca se há solicitação pendente de atualização cadastral para este escritório
  const { data: pendingRequest } = await supabase
    .from('client_update_requests')
    .select('id, requested_data, current_data, status, created_at')
    .eq('organization_id', project.organization_id)
    .eq('cpf', session.cpf)
    .eq('status', 'pending')
    .maybeSingle()

  // 5.1 Busca última solicitação rejeitada para este escritório
  const { data: lastRejectedRequest } = await supabase
    .from('client_update_requests')
    .select('id, rejection_reason, reviewed_at, updated_at')
    .eq('organization_id', project.organization_id)
    .eq('cpf', session.cpf)
    .eq('status', 'rejected')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const divergences: Array<{ field: string; label: string; profileValue: string | null; officeValue: string | null }> = []

  if (profileData.name.trim().toLowerCase() !== (officeData.name || '').trim().toLowerCase()) {
    divergences.push({
      field: 'name',
      label: 'Nome Completo',
      profileValue: profileData.name,
      officeValue: officeData.name || 'Não informado',
    })
  }

  if ((profileData.email || '').trim().toLowerCase() !== (officeData.email || '').trim().toLowerCase()) {
    divergences.push({
      field: 'email',
      label: 'E-mail',
      profileValue: profileData.email || 'Não informado',
      officeValue: officeData.email || 'Não informado',
    })
  }

  const normProfilePhone = (profileData.phone || '').replace(/\D/g, '')
  const normOfficePhone = (officeData.phone || '').replace(/\D/g, '')
  if (normProfilePhone !== normOfficePhone) {
    divergences.push({
      field: 'phone',
      label: 'Telefone / WhatsApp',
      profileValue: profileData.phone || 'Não informado',
      officeValue: officeData.phone || 'Não informado',
    })
  }

  const normProfileAddress = (profileData.address || '').trim().toLowerCase()
  const normOfficeAddress = (officeData.address || '').trim().toLowerCase()
  if (normProfileAddress !== normOfficeAddress) {
    divergences.push({
      field: 'address',
      label: 'Endereço',
      profileValue: profileData.address || 'Não informado',
      officeValue: officeData.address || 'Não informado',
    })
  }

  const normProfileCity = (profileData.city || '').trim().toLowerCase()
  const normOfficeCity = (officeData.city || '').trim().toLowerCase()
  if (normProfileCity !== normOfficeCity) {
    divergences.push({
      field: 'city',
      label: 'Cidade',
      profileValue: profileData.city || 'Não informado',
      officeValue: officeData.city || 'Não informado',
    })
  }

  const normProfileState = (profileData.state || '').trim().toUpperCase()
  const normOfficeState = (officeData.state || '').trim().toUpperCase()
  if (normProfileState !== normOfficeState) {
    divergences.push({
      field: 'state',
      label: 'Estado (UF)',
      profileValue: profileData.state || 'Não informado',
      officeValue: officeData.state || 'Não informado',
    })
  }

  const normProfileZip = (profileData.zip_code || '').replace(/\D/g, '')
  const normOfficeZip = (officeData.zip_code || '').replace(/\D/g, '')
  if (normProfileZip !== normOfficeZip) {
    divergences.push({
      field: 'zip_code',
      label: 'CEP',
      profileValue: profileData.zip_code || 'Não informado',
      officeValue: officeData.zip_code || 'Não informado',
    })
  }

  const hasDivergence = divergences.length > 0
  const hasPendingRequest = Boolean(pendingRequest)
  const isBlocked = hasDivergence || hasPendingRequest

  const cadastralStatus = {
    hasDivergence,
    hasPendingRequest,
    pendingRequestId: pendingRequest?.id || null,
    pendingRequestCreatedAt: pendingRequest?.created_at || null,
    isBlocked,
    rejectionReason: lastRejectedRequest?.rejection_reason || null,
    rejectionDate: lastRejectedRequest?.reviewed_at || lastRejectedRequest?.updated_at || null,
    divergences,
    profileData,
    officeData,
    organizationId: project.organization_id,
    clientRecordId: officeData.id,
  }

  // 6. Busca etapas do projeto (apenas com is_client_approval_required)
  const { data: stages } = await supabase
    .from('project_stages')
    .select('id, name, description, stage_order, status, progress_percent, start_date, due_date, is_client_approval_required, is_locked_for_client, attachments, comments')
    .eq('project_id', project.id)
    .eq('is_client_approval_required', true)
    .order('stage_order', { ascending: true })

  // 7. Busca histórico de aprovações
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

    // Filtra anexos apenas visíveis para o cliente
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

  // Obtém ou gera um token de acesso para permitir aprovação das etapas
  const { data: existingToken } = await supabase
    .from('client_access_tokens')
    .select('token')
    .eq('project_id', projectId)
    .eq('is_revoked', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let token = existingToken?.token

  if (!token) {
    const newToken = `portal_${Date.now()}_${Math.random().toString(36).substring(2, 12)}`
    await supabase.from('client_access_tokens').insert({
      project_id: projectId,
      token: newToken,
    })
    token = newToken
  }

  return {
    success: true,
    data: {
      token,
      portalData: {
        project: {
          id: project.id,
          code: project.code,
          title: project.title,
          description: project.description,
          client_name: linkedClients[0]?.name || project.client_name || session.name,
          client_email: linkedClients[0]?.email || null,
          area_sqm: project.area_sqm,
          deadline: project.deadline,
          status: project.status,
        },
        cadastralStatus,
        loggedClient,
        clients: linkedClients,
        organization: org || {
          name: 'Escritório de Arquitetura',
          logo_url: null,
          cau_caubr: null,
          phone: null,
          email: null,
        },
        stages: enrichedStages,
        feedbacks: [],
      },
    },
  }
}
