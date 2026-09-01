'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  getClientPortalSession,
  refreshClientPortalSession,
} from './client-portal-auth'
import { sanitizeText } from '@/lib/server/sanitize'

export interface ClientProfileData {
  cpf: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
  city: string | null
  state: string | null
  zip_code: string | null
}

export interface ClientOfficeRegistrationInfo {
  officeId: string
  officeName: string
  officeLogo: string | null
  officeEmail: string | null
  officePhone: string | null
  clientRecordId: string
  currentData: {
    name: string
    email: string | null
    phone: string | null
    address: string | null
    city: string | null
    state: string | null
    zip_code: string | null
  }
  pendingRequest: {
    id: string
    requested_data: any
    status: string
    created_at: string
  } | null
}

/**
 * Obtém dados do perfil do cliente autenticado e o detalhamento cadastral em cada escritório vinculado
 */
export async function getClientPortalProfileAction(): Promise<{
  success: boolean
  error?: string
  data?: {
    profile: ClientProfileData
    offices: ClientOfficeRegistrationInfo[]
  }
}> {
  const session = await getClientPortalSession()
  if (!session) {
    return { success: false, error: 'UNAUTHORIZED' }
  }

  const supabase = await createClient()

  // 1. Busca dados da conta global do cliente (portal)
  const { data: portalAccount } = await supabase
    .from('client_portal_accounts')
    .select('cpf, name, email, phone, address, city, state, zip_code')
    .eq('cpf', session.cpf)
    .maybeSingle()

  const profile: ClientProfileData = {
    cpf: session.cpf,
    name: portalAccount?.name || session.name,
    email: portalAccount?.email || session.email || null,
    phone: portalAccount?.phone || null,
    address: portalAccount?.address || null,
    city: portalAccount?.city || null,
    state: portalAccount?.state || null,
    zip_code: portalAccount?.zip_code || null,
  }

  // 2. Busca todos os cadastros deste CPF nos escritórios
  const { data: clientRows } = await supabase
    .from('clients')
    .select('id, organization_id, name, email, phone, address, city, state, zip_code, organizations(id, name, logo_url, email, phone)')
    .eq('document_number', session.cpf)

  // 3. Busca solicitações pendentes feitas por este cliente
  const { data: pendingRequests } = await supabase
    .from('client_update_requests')
    .select('id, organization_id, client_id, requested_data, status, created_at')
    .eq('cpf', session.cpf)
    .eq('status', 'pending')

  const pendingMap = new Map<string, any>()
  ;(pendingRequests || []).forEach((req) => {
    pendingMap.set(req.organization_id, req)
  })

  const offices: ClientOfficeRegistrationInfo[] = []
  ;(clientRows || []).forEach((row: any) => {
    const org = row.organizations
    if (org) {
      offices.push({
        officeId: org.id,
        officeName: org.name,
        officeLogo: org.logo_url || null,
        officeEmail: org.email || null,
        officePhone: org.phone || null,
        clientRecordId: row.id,
        currentData: {
          name: row.name,
          email: row.email || null,
          phone: row.phone || null,
          address: row.address || null,
          city: row.city || null,
          state: row.state || null,
          zip_code: row.zip_code || null,
        },
        pendingRequest: pendingMap.get(org.id) || null,
      })
    }
  })

  return {
    success: true,
    data: {
      profile,
      offices,
    },
  }
}

/**
 * Atualiza o perfil global do cliente e opcionalmente dispara solicitações para os escritórios vinculados
 */
export async function updateClientPortalProfileAction(
  profileInput: {
    name: string
    email?: string | null
    phone?: string | null
    address?: string | null
    city?: string | null
    state?: string | null
    zip_code?: string | null
  },
  shareWithOffices: boolean
): Promise<{ success: boolean; error?: string }> {
  const session = await getClientPortalSession()
  if (!session) {
    return { success: false, error: 'UNAUTHORIZED' }
  }

  const name = sanitizeText(profileInput.name)
  const email = profileInput.email ? sanitizeText(profileInput.email).toLowerCase() : null
  const phone = profileInput.phone ? profileInput.phone.replace(/\D/g, '') : null
  const address = profileInput.address ? sanitizeText(profileInput.address) : null
  const city = profileInput.city ? sanitizeText(profileInput.city) : null
  const state = profileInput.state ? sanitizeText(profileInput.state).toUpperCase() : null
  const zip_code = profileInput.zip_code ? profileInput.zip_code.replace(/\D/g, '') : null

  if (!name) {
    return { success: false, error: 'O nome é obrigatório.' }
  }

  const supabase = await createClient()

  // 1. Atualiza a tabela global client_portal_accounts
  const { data: updatedAccount, error: updateError } = await supabase
    .from('client_portal_accounts')
    .update({
      name,
      email,
      phone,
      address,
      city,
      state,
      zip_code,
      updated_at: new Date().toISOString(),
    })
    .eq('cpf', session.cpf)
    .select('id')
    .single()

  if (updateError) {
    console.error('Erro ao atualizar client_portal_accounts:', updateError)
    return { success: false, error: 'Erro ao salvar alterações no perfil.' }
  }

  const portalAccountId = updatedAccount?.id || null

  // 2. Se o cliente optou por compartilhar com os escritórios vinculados:
  if (shareWithOffices) {
    const { data: clientRows } = await supabase
      .from('clients')
      .select('id, organization_id, name, email, phone, address, city, state, zip_code')
      .eq('document_number', session.cpf)

    const requestedData = {
      name,
      email,
      phone,
      address,
      city,
      state,
      zip_code,
    }

    if (clientRows && clientRows.length > 0) {
      for (const row of clientRows) {
        // Verifica se já existe solicitação pendente para este escritório
        const { data: existingReq } = await supabase
          .from('client_update_requests')
          .select('id')
          .eq('organization_id', row.organization_id)
          .eq('cpf', session.cpf)
          .eq('status', 'pending')
          .maybeSingle()

        const currentData = {
          name: row.name,
          email: row.email || null,
          phone: row.phone || null,
          address: row.address || null,
          city: row.city || null,
          state: row.state || null,
          zip_code: row.zip_code || null,
        }

        if (existingReq) {
          // Atualiza a solicitação pendente existente
          await supabase
            .from('client_update_requests')
            .update({
              requested_data: requestedData,
              current_data: currentData,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingReq.id)
        } else {
          // Cria nova solicitação pendente
          await supabase.from('client_update_requests').insert({
            organization_id: row.organization_id,
            client_id: row.id,
            portal_account_id: portalAccountId,
            cpf: session.cpf,
            requested_data: requestedData,
            current_data: currentData,
            status: 'pending',
          })
        }
      }
    }
  }

  // Atualiza o cookie de sessão do portal com os novos dados
  await refreshClientPortalSession({
    cpf: session.cpf,
    name,
    email,
  })

  revalidatePath('/portal')
  revalidatePath('/portal/projeto/[id]', 'page')
  return { success: true }
}

/**
 * Envia uma solicitação de correção cadastral direcionada para um escritório específico
 */
export async function requestOfficeDataCorrectionAction(
  organizationId: string,
  clientRecordId: string,
  requestedData: {
    name: string
    email?: string | null
    phone?: string | null
    address?: string | null
    city?: string | null
    state?: string | null
    zip_code?: string | null
  }
): Promise<{ success: boolean; error?: string }> {
  const session = await getClientPortalSession()
  if (!session) {
    return { success: false, error: 'UNAUTHORIZED' }
  }

  const supabase = await createClient()

  // Busca dados atuais do cliente naquele escritório
  const { data: clientRow } = await supabase
    .from('clients')
    .select('id, name, email, phone, address, city, state, zip_code')
    .eq('id', clientRecordId)
    .eq('organization_id', organizationId)
    .single()

  if (!clientRow) {
    return { success: false, error: 'Cadastro do cliente não encontrado neste escritório.' }
  }

  const currentData = {
    name: clientRow.name,
    email: clientRow.email || null,
    phone: clientRow.phone || null,
    address: clientRow.address || null,
    city: clientRow.city || null,
    state: clientRow.state || null,
    zip_code: clientRow.zip_code || null,
  }

  // Verifica se já existe solicitação pendente
  const { data: existingReq } = await supabase
    .from('client_update_requests')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('cpf', session.cpf)
    .eq('status', 'pending')
    .maybeSingle()

  if (existingReq) {
    await supabase
      .from('client_update_requests')
      .update({
        requested_data: requestedData,
        current_data: currentData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingReq.id)
  } else {
    await supabase.from('client_update_requests').insert({
      organization_id: organizationId,
      client_id: clientRecordId,
      cpf: session.cpf,
      requested_data: requestedData,
      current_data: currentData,
      status: 'pending',
    })
  }

  revalidatePath('/portal')
  revalidatePath('/portal/projeto/[id]', 'page')
  return { success: true }
}

/**
 * Atualiza o perfil pessoal do cliente no Portal com os dados cadastrados em um escritório específico,
 * alinhando os dados e resolvendo a divergência imediatamente.
 */
export async function syncProfileFromOfficeAction(
  organizationId: string,
  clientRecordId: string
): Promise<{ success: boolean; error?: string }> {
  const session = await getClientPortalSession()
  if (!session) {
    return { success: false, error: 'UNAUTHORIZED' }
  }

  const supabase = await createClient()

  // 1. Busca os dados do cliente naquele escritório
  const { data: officeClient } = await supabase
    .from('clients')
    .select('id, name, email, phone, address, city, state, zip_code')
    .eq('id', clientRecordId)
    .eq('organization_id', organizationId)
    .single()

  if (!officeClient) {
    return { success: false, error: 'Cadastro do escritório não encontrado.' }
  }

  // 2. Atualiza client_portal_accounts com os dados do escritório
  const { error: updateErr } = await supabase
    .from('client_portal_accounts')
    .update({
      name: officeClient.name,
      email: officeClient.email || null,
      phone: officeClient.phone ? officeClient.phone.replace(/\D/g, '') : null,
      address: officeClient.address || null,
      city: officeClient.city || null,
      state: officeClient.state || null,
      zip_code: officeClient.zip_code ? officeClient.zip_code.replace(/\D/g, '') : null,
      updated_at: new Date().toISOString(),
    })
    .eq('cpf', session.cpf)

  if (updateErr) {
    console.error('Erro ao sincronizar perfil do cliente:', updateErr)
    return { success: false, error: 'Erro ao atualizar perfil pessoal.' }
  }

  // 3. Remove solicitações pendentes deste escritório para este CPF (pois agora já estão convergindo)
  await supabase
    .from('client_update_requests')
    .delete()
    .eq('organization_id', organizationId)
    .eq('cpf', session.cpf)
    .eq('status', 'pending')

  // 4. Atualiza o cookie de sessão do portal com os dados sincronizados
  await refreshClientPortalSession({
    cpf: session.cpf,
    name: officeClient.name,
    email: officeClient.email || null,
  })

  revalidatePath('/portal')
  revalidatePath('/portal/projeto/[id]', 'page')
  return { success: true }
}
