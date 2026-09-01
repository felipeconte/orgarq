'use server'

import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/server/guard'

export interface ClientUpdateRequestItem {
  id: string
  organization_id: string
  client_id: string | null
  cpf: string
  requested_data: {
    name: string
    email?: string | null
    phone?: string | null
    address?: string | null
    city?: string | null
    state?: string | null
    zip_code?: string | null
  }
  current_data: {
    name: string
    email?: string | null
    phone?: string | null
    address?: string | null
    city?: string | null
    state?: string | null
    zip_code?: string | null
  } | null
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  client?: {
    id: string
    name: string
    document_number: string | null
    email: string | null
    phone: string | null
  } | null
}

/**
 * Busca todas as solicitações de atualização cadastral pendentes para o escritório autenticado
 */
export async function getPendingClientUpdateRequestsAction(): Promise<{
  success: boolean
  error?: string
  data?: {
    count: number
    requests: ClientUpdateRequestItem[]
  }
}> {
  try {
    const { supabase, user } = await requireAuth()

    const { data: member } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()

    const organizationId = member?.organization_id
    if (!organizationId) {
      return { success: true, data: { count: 0, requests: [] } }
    }

    const { data: rows, error } = await supabase
      .from('client_update_requests')
      .select('id, organization_id, client_id, cpf, requested_data, current_data, status, created_at, clients(id, name, document_number, email, phone)')
      .eq('organization_id', organizationId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Erro ao buscar client_update_requests:', error)
      return { success: false, error: 'Erro ao buscar solicitações.' }
    }

    const requests: ClientUpdateRequestItem[] = (rows || []).map((r: any) => ({
      id: r.id,
      organization_id: r.organization_id,
      client_id: r.client_id,
      cpf: r.cpf,
      requested_data: r.requested_data,
      current_data: r.current_data,
      status: r.status,
      created_at: r.created_at,
      client: r.clients || null,
    }))

    return {
      success: true,
      data: {
        count: requests.length,
        requests,
      },
    }
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro de autenticação.' }
  }
}

/**
 * Revisa uma solicitação (Aprova e aplica no cadastro do cliente, ou Rejeita)
 */
export async function reviewClientUpdateRequestAction(
  requestId: string,
  action: 'approve' | 'reject',
  rejectionReason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase, user } = await requireAuth()

    const { data: member } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()

    const organizationId = member?.organization_id
    if (!organizationId) {
      return { success: false, error: 'Organização não encontrada.' }
    }

    const { data: requestRow, error: fetchErr } = await supabase
      .from('client_update_requests')
      .select('id, organization_id, client_id, cpf, requested_data, status')
      .eq('id', requestId)
      .eq('organization_id', organizationId)
      .single()

    if (fetchErr || !requestRow) {
      return { success: false, error: 'Solicitação não encontrada.' }
    }

    if (action === 'approve') {
      const reqData = requestRow.requested_data as any

      // 1. Atualiza os dados na tabela clients do escritório
      if (requestRow.client_id) {
        const { error: clientUpdateErr } = await supabase
          .from('clients')
          .update({
            name: reqData.name,
            email: reqData.email || null,
            phone: reqData.phone || null,
            address: reqData.address || null,
            city: reqData.city || null,
            state: reqData.state || null,
            zip_code: reqData.zip_code || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', requestRow.client_id)
          .eq('organization_id', organizationId)

        if (clientUpdateErr) {
          console.error('Erro ao atualizar cadastro do cliente:', clientUpdateErr)
          return { success: false, error: 'Erro ao atualizar dados do cliente.' }
        }
      }

      // 2. Marca a solicitação como aprovada
      await supabase
        .from('client_update_requests')
        .update({
          status: 'approved',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId)
    } else {
      // Rejeita a solicitação
      await supabase
        .from('client_update_requests')
        .update({
          status: 'rejected',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          rejection_reason: rejectionReason || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId)
    }

    revalidatePath('/app/clientes')
    revalidatePath('/app')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro ao processar revisão.' }
  }
}
