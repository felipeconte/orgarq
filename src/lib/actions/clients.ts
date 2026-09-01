'use server'

import { revalidatePath } from 'next/cache'
import { requireAuth, requireOrgAccess } from '@/lib/server/guard'
import { sanitizeText } from '@/lib/server/sanitize'
import {
  cleanDigits,
  validateDocument,
  validateEmail,
  validatePhone,
} from '@/lib/formatters-and-validators'
import {
  generateSecureClientPassword,
  hashClientPassword,
} from '@/lib/server/client-auth-crypto'
import {
  sendClientPortalCredentialsEmail,
  sendClientNewProjectNotificationEmail,
} from '@/lib/server/email'

export interface ClientData {
  id: string
  organization_id: string
  name: string
  email: string | null
  phone: string | null
  document_number: string | null
  person_type: 'PF' | 'PJ'
  address: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  notes: string | null
  status: 'ativo' | 'inativo'
  created_at: string
  updated_at: string
  projects_count?: number
}

export interface ClientProjectItem {
  id: string
  code: string
  title: string
  typology: string | null
  status: string
  deadline: string | null
  progress_percent?: number
  area_sqm?: number | null
  estimated_budget?: number | null
  created_at: string
}

export interface ClientInput {
  organizationId?: string
  name: string
  email?: string | null
  phone?: string | null
  documentNumber?: string | null
  personType?: 'PF' | 'PJ'
  address?: string | null
  city?: string | null
  state?: string | null
  zipCode?: string | null
  notes?: string | null
  status?: 'ativo' | 'inativo'
}

/**
 * Busca a organização do usuário logado
 */
async function resolveUserOrgId(supabase: any, userId: string, preferredOrgId?: string): Promise<string | null> {
  if (preferredOrgId) {
    return preferredOrgId
  }

  const { data: member } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle()

  if (member?.organization_id) return member.organization_id

  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('owner_id', userId)
    .limit(1)
    .maybeSingle()

  return org?.id || null
}

/**
 * 1. LISTAR TODOS OS CLIENTES DA ORGANIZAÇÃO COM CONTAGEM DE PROJETOS
 */
export async function getClientsAction(organizationId?: string): Promise<{
  success: boolean
  clients?: ClientData[]
  error?: string
}> {
  try {
    const { supabase, user } = await requireAuth()
    const orgId = await resolveUserOrgId(supabase, user.id, organizationId)

    if (!orgId) {
      return { success: true, clients: [] }
    }

    await requireOrgAccess(orgId)

    // Purga cliente fictício Julian caso ainda persista no banco
    await supabase
      .from('clients')
      .delete()
      .eq('organization_id', orgId)
      .ilike('name', '%Julian%')

    // 1. Busca clientes cadastrados
    const { data: clientsData, error: clientsError } = await supabase
      .from('clients')
      .select('*')
      .eq('organization_id', orgId)
      .not('name', 'ilike', '%Julian%')
      .order('name', { ascending: true })

    if (clientsError && clientsError.code !== '42P01') {
      console.error('Erro ao buscar clientes:', clientsError)
      return { success: false, error: clientsError.message }
    }

    const clients: ClientData[] = (clientsData || []) as ClientData[]

    // 2. Busca projetos e vínculos em project_clients para contagem
    const { data: projectsData } = await supabase
      .from('projects')
      .select('id, client_id, client_name, client_email, client_phone')
      .eq('organization_id', orgId)

    const { data: projectClientsData } = await supabase
      .from('project_clients')
      .select('project_id, client_id')

    const projectsList = projectsData || []
    const projectClientsList = projectClientsData || []

    // 3. Calcula contagem de projetos para cada cliente (sem duplicar projetos por cliente)
    const clientProjectsMap = new Map<string, Set<string>>()
    clients.forEach((c) => clientProjectsMap.set(c.id, new Set()))

    // Vínculos em project_clients
    projectClientsList.forEach((pc) => {
      if (clientProjectsMap.has(pc.client_id)) {
        clientProjectsMap.get(pc.client_id)!.add(pc.project_id)
      }
    })

    // Vínculos diretos em projects.client_id
    projectsList.forEach((p) => {
      if (p.client_id && clientProjectsMap.has(p.client_id)) {
        clientProjectsMap.get(p.client_id)!.add(p.id)
      }
    })

    const finalClients = clients.map((c) => ({
      ...c,
      projects_count: clientProjectsMap.get(c.id)?.size || 0,
    }))

    return { success: true, clients: finalClients }
  } catch (err: any) {
    console.error('getClientsAction error:', err)
    return { success: false, error: err?.message || 'Erro ao carregar lista de clientes.' }
  }
}

/**
 * 2. BUSCAR DETALHES DE UM CLIENTE E SEUS PROJETOS VINCULADOS
 */
export async function getClientByIdAction(clientId: string): Promise<{
  success: boolean
  client?: ClientData
  projects?: ClientProjectItem[]
  error?: string
}> {
  try {
    const { supabase } = await requireAuth()

    const { data: client, error: clientErr } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single()

    if (clientErr || !client) {
      return { success: false, error: 'Cliente não encontrado.' }
    }

    await requireOrgAccess(client.organization_id)

    // 1. Busca IDs de projetos vinculados na tabela project_clients
    const { data: pcRows } = await supabase
      .from('project_clients')
      .select('project_id')
      .eq('client_id', clientId)

    const linkedProjectIds = (pcRows || []).map((r) => r.project_id)

    // 2. Busca projetos vinculados por project_clients ou client_id ou nome
    let projectQuery = supabase
      .from('projects')
      .select(`
        id,
        code,
        title,
        typology,
        status,
        deadline,
        area_sqm,
        estimated_budget,
        created_at,
        project_stages(id, status, progress_percent, is_client_approval_required)
      `)
      .eq('organization_id', client.organization_id)

    if (linkedProjectIds.length > 0) {
      projectQuery = projectQuery.or(`id.in.(${linkedProjectIds.join(',')}),client_id.eq.${clientId}`)
    } else {
      projectQuery = projectQuery.or(`client_id.eq.${clientId},client_name.ilike.%${client.name}%`)
    }

    const { data: projects, error: projErr } = await projectQuery.order('created_at', { ascending: false })

    if (projErr) {
      console.error('Erro ao buscar projetos do cliente:', projErr)
    }

    const projectsWithProgress: ClientProjectItem[] = (projects || []).map((p: any) => {
      const stages = p.project_stages || []
      let progress = 0
      if (stages.length > 0) {
        const completed = stages.filter((s: any) => s.status === 'concluido').length
        progress = Math.round((completed / stages.length) * 100)
      }

      return {
        id: p.id,
        code: p.code,
        title: p.title,
        typology: p.typology,
        status: p.status,
        deadline: p.deadline,
        area_sqm: p.area_sqm,
        estimated_budget: p.estimated_budget,
        created_at: p.created_at,
        progress_percent: progress,
      }
    })

    return {
      success: true,
      client: {
        ...client,
        projects_count: projectsWithProgress.length,
      },
      projects: projectsWithProgress,
    }
  } catch (err: any) {
    console.error('getClientByIdAction error:', err)
    return { success: false, error: err?.message || 'Erro ao carregar detalhes do cliente.' }
  }
}

/**
 * 3. CRIAR NOVO CLIENTE COM VALIDAÇÃO RIGOROSA
 */
export async function createClientAction(input: ClientInput): Promise<{
  success: boolean
  client?: ClientData
  error?: string
}> {
  try {
    const { supabase, user } = await requireAuth()
    const orgId = await resolveUserOrgId(supabase, user.id, input.organizationId)

    if (!orgId) {
      return { success: false, error: 'Organização não identificada.' }
    }

    await requireOrgAccess(orgId)

    const name = sanitizeText(input.name)
    if (!name || name.trim().length < 2) {
      return { success: false, error: 'O nome do cliente deve conter no mínimo 2 caracteres.' }
    }

    const personType = input.personType === 'PJ' ? 'PJ' : 'PF'
    const documentNumber = cleanDigits(input.documentNumber) || null
    const email = input.email ? input.email.trim().toLowerCase() : null
    const phone = cleanDigits(input.phone) || null
    const zipCode = cleanDigits(input.zipCode) || null

    // Validações
    if (documentNumber) {
      const docCheck = validateDocument(documentNumber, personType)
      if (!docCheck.valid) {
        return { success: false, error: docCheck.message || 'Documento inválido.' }
      }
    }

    if (email && !validateEmail(email)) {
      return { success: false, error: 'E-mail informado possui formato inválido.' }
    }

    if (phone && !validatePhone(phone)) {
      return { success: false, error: 'Telefone informado deve conter DDD válido e 10 a 11 dígitos.' }
    }

    const { data: newClient, error: insertError } = await supabase
      .from('clients')
      .insert({
        organization_id: orgId,
        name,
        person_type: personType,
        document_number: documentNumber,
        email,
        phone,
        address: sanitizeText(input.address) || null,
        city: sanitizeText(input.city) || null,
        state: sanitizeText(input.state) || null,
        zip_code: zipCode,
        notes: sanitizeText(input.notes) || null,
        status: input.status || 'ativo',
      })
      .select('*')
      .single()

    if (insertError) {
      console.error('Erro ao inserir cliente:', insertError)
      return { success: false, error: insertError.message }
    }

    // 2. CRIAÇÃO AUTOMÁTICA DE CONTA DO PORTAL E ENVIO DE E-MAIL (SE HOUVER CPF)
    if (documentNumber && documentNumber.length === 11) {
      try {
        const { data: existingAccount } = await supabase
          .from('client_portal_accounts')
          .select('id, cpf, email')
          .eq('cpf', documentNumber)
          .maybeSingle()

        const { data: orgData } = await supabase
          .from('organizations')
          .select('name, phone, email')
          .eq('id', orgId)
          .single()

        const officeName = orgData?.name || 'Escritório de Arquitetura'

        if (!existingAccount) {
          // Conta nova: gera senha aleatória e envia por e-mail (arquiteto NÃO tem acesso à senha)
          const rawPassword = generateSecureClientPassword()
          const passwordHash = hashClientPassword(rawPassword)

          await supabase.from('client_portal_accounts').insert({
            cpf: documentNumber,
            name,
            email,
            password_hash: passwordHash,
          })

          if (email) {
            await sendClientPortalCredentialsEmail({
              clientName: name,
              clientEmail: email,
              clientCpf: documentNumber,
              rawPassword,
              officeName,
              officePhone: orgData?.phone,
              officeEmail: orgData?.email,
            })
          }
        } else if (email) {
          // Conta existente (ex: já é cliente de outro escritório no Orgarq): notifica sem trocar senha
          await sendClientNewProjectNotificationEmail({
            clientName: name,
            clientEmail: email,
            clientCpf: documentNumber,
            officeName,
            projectTitle: 'Acompanhamento de Projetos',
          })
        }
      } catch (portalAuthErr) {
        console.warn('Aviso: Não foi possível processar conta do portal:', portalAuthErr)
      }
    }

    revalidatePath('/app/clientes')
    revalidatePath('/app/projetos')
    revalidatePath('/app')

    return { success: true, client: newClient as ClientData }
  } catch (err: any) {
    console.error('createClientAction error:', err)
    return { success: false, error: err?.message || 'Erro ao criar cliente.' }
  }
}

/**
 * 4. ATUALIZAR CLIENTE E SINCRONIZAR PROJETOS VINCULADOS
 */
export async function updateClientAction(
  clientId: string,
  input: Partial<ClientInput>
): Promise<{
  success: boolean
  client?: ClientData
  error?: string
}> {
  try {
    const { supabase } = await requireAuth()

    const { data: existingClient, error: fetchErr } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single()

    if (fetchErr || !existingClient) {
      return { success: false, error: 'Cliente não encontrado.' }
    }

    await requireOrgAccess(existingClient.organization_id)

    const updatePayload: Record<string, any> = {}

    if (input.name !== undefined) {
      const name = sanitizeText(input.name)
      if (!name || name.trim().length < 2) {
        return { success: false, error: 'O nome do cliente deve conter no mínimo 2 caracteres.' }
      }
      updatePayload.name = name
    }

    if (input.personType !== undefined) {
      updatePayload.person_type = input.personType === 'PJ' ? 'PJ' : 'PF'
    }

    const currentPersonType = (updatePayload.person_type || existingClient.person_type) as 'PF' | 'PJ'

    if (input.documentNumber !== undefined) {
      const doc = cleanDigits(input.documentNumber) || null
      if (doc) {
        const docCheck = validateDocument(doc, currentPersonType)
        if (!docCheck.valid) {
          return { success: false, error: docCheck.message || 'Documento inválido.' }
        }
      }
      updatePayload.document_number = doc
    }

    if (input.email !== undefined) {
      const email = input.email ? input.email.trim().toLowerCase() : null
      if (email && !validateEmail(email)) {
        return { success: false, error: 'E-mail informado possui formato inválido.' }
      }
      updatePayload.email = email
    }

    if (input.phone !== undefined) {
      const phone = cleanDigits(input.phone) || null
      if (phone && !validatePhone(phone)) {
        return { success: false, error: 'Telefone informado deve conter DDD válido e 10 a 11 dígitos.' }
      }
      updatePayload.phone = phone
    }

    if (input.address !== undefined) updatePayload.address = sanitizeText(input.address) || null
    if (input.city !== undefined) updatePayload.city = sanitizeText(input.city) || null
    if (input.state !== undefined) updatePayload.state = sanitizeText(input.state) || null
    if (input.zipCode !== undefined) updatePayload.zip_code = cleanDigits(input.zipCode) || null
    if (input.notes !== undefined) updatePayload.notes = sanitizeText(input.notes) || null
    if (input.status !== undefined) updatePayload.status = input.status

    const { data: updatedClient, error: updateErr } = await supabase
      .from('clients')
      .update(updatePayload as any)
      .eq('id', clientId)
      .select('*')
      .single()

    if (updateErr) {
      console.error('Erro ao atualizar cliente:', updateErr)
      return { success: false, error: updateErr.message }
    }

    // Sincroniza dados nos projetos vinculados para que reflita em todos os lugares
    const projectSyncPayload: Record<string, any> = {}
    if (updatePayload.name) projectSyncPayload.client_name = updatePayload.name
    if (updatePayload.email !== undefined) projectSyncPayload.client_email = updatePayload.email
    if (updatePayload.phone !== undefined) projectSyncPayload.client_phone = updatePayload.phone

    if (Object.keys(projectSyncPayload).length > 0) {
      await supabase
        .from('projects')
        .update(projectSyncPayload as any)
        .or(`client_id.eq.${clientId},client_name.eq.${existingClient.name}`)
    }

    revalidatePath('/app/clientes')
    revalidatePath(`/app/clientes/${clientId}`)
    revalidatePath('/app/projetos')
    revalidatePath('/app')

    return { success: true, client: updatedClient as ClientData }
  } catch (err: any) {
    console.error('updateClientAction error:', err)
    return { success: false, error: err?.message || 'Erro ao atualizar cliente.' }
  }
}

/**
 * 5. EXCLUIR CLIENTE
 */
export async function deleteClientAction(clientId: string): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const { supabase } = await requireAuth()

    const { data: client, error: fetchErr } = await supabase
      .from('clients')
      .select('organization_id')
      .eq('id', clientId)
      .single()

    if (fetchErr || !client) {
      return { success: false, error: 'Cliente não encontrado.' }
    }

    await requireOrgAccess(client.organization_id)

    // Desvincula projetos para não quebrar integridade
    await supabase
      .from('projects')
      .update({ client_id: null })
      .eq('client_id', clientId)

    const { error: delErr } = await supabase
      .from('clients')
      .delete()
      .eq('id', clientId)

    if (delErr) {
      console.error('Erro ao excluir cliente:', delErr)
      return { success: false, error: delErr.message }
    }

    revalidatePath('/app/clientes')
    revalidatePath('/app/projetos')
    revalidatePath('/app')

    return { success: true }
  } catch (err: any) {
    console.error('deleteClientAction error:', err)
    return { success: false, error: err?.message || 'Erro ao excluir cliente.' }
  }
}

/**
 * 6. REENVIAR / REDEFINIR SENHA DO PORTAL DIRETAMENTE PARA O E-MAIL DO CLIENTE
 */
export async function resendClientPortalAccessAction(clientId: string): Promise<{
  success: boolean
  message?: string
  error?: string
}> {
  try {
    const { supabase } = await requireAuth()

    const { data: client, error: fetchErr } = await supabase
      .from('clients')
      .select('id, name, email, document_number, organization_id')
      .eq('id', clientId)
      .single()

    if (fetchErr || !client) {
      return { success: false, error: 'Cliente não encontrado.' }
    }

    await requireOrgAccess(client.organization_id)

    const cpf = cleanDigits(client.document_number)
    if (!cpf || cpf.length !== 11) {
      return {
        success: false,
        error: 'O cliente precisa ter um CPF válido cadastrado para acessar o portal.',
      }
    }

    if (!client.email) {
      return {
        success: false,
        error: 'O cliente precisa ter um e-mail cadastrado para receber a senha de acesso.',
      }
    }

    const { data: orgData } = await supabase
      .from('organizations')
      .select('name, phone, email')
      .eq('id', client.organization_id)
      .single()

    const officeName = orgData?.name || 'Escritório de Arquitetura'
    const rawPassword = generateSecureClientPassword()
    const passwordHash = hashClientPassword(rawPassword)

    // Atualiza ou insere a conta com nova senha
    const { data: existing } = await supabase
      .from('client_portal_accounts')
      .select('id')
      .eq('cpf', cpf)
      .maybeSingle()

    if (existing) {
      await supabase
        .from('client_portal_accounts')
        .update({
          password_hash: passwordHash,
          email: client.email,
          name: client.name,
        })
        .eq('cpf', cpf)
    } else {
      await supabase.from('client_portal_accounts').insert({
        cpf,
        name: client.name,
        email: client.email,
        password_hash: passwordHash,
      })
    }

    // Envia o e-mail diretamente ao cliente
    await sendClientPortalCredentialsEmail({
      clientName: client.name,
      clientEmail: client.email,
      clientCpf: cpf,
      rawPassword,
      officeName,
      officePhone: orgData?.phone,
      officeEmail: orgData?.email,
    })

    return {
      success: true,
      message: `Uma nova senha de acesso foi gerada e enviada diretamente para o e-mail do cliente (${client.email}).`,
    }
  } catch (err: any) {
    console.error('resendClientPortalAccessAction error:', err)
    return { success: false, error: err?.message || 'Erro ao reenviar acesso do cliente.' }
  }
}

