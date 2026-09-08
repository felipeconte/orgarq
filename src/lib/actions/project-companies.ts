'use server'

import { revalidatePath } from 'next/cache'
import { requireAuth, requireOrgAccess, requireProjectAccess } from '@/lib/server/guard'
import { sanitizeText } from '@/lib/server/sanitize'

export interface ProjectCompanyItem {
  id: string
  organization_id: string
  project_id: string
  company_id: string
  company_name: string
  company_trade_name: string | null
  company_phone: string | null
  company_email: string | null
  company_contact_name: string | null
  company_categories: string[]
  service_description: string | null
  category: string | null
  contract_value: number
  commission_type: 'percent' | 'fixed'
  commission_rate: number
  expected_commission_amount: number
  received_commission_amount: number
  commission_status: 'previsto' | 'pendente' | 'pago_parcial' | 'pago_total' | 'cancelado'
  commission_payment_method: string | null
  commission_payment_terms: string | null
  commission_due_date: string | null
  commission_paid_date: string | null
  service_status: 'cotacao' | 'contratado' | 'em_andamento' | 'concluido' | 'cancelado'
  notes: string | null
  created_at: string
  updated_at: string
}

export interface ProjectCompanyInput {
  projectId: string
  companyId: string
  serviceDescription?: string | null
  category?: string | null
  contractValue?: number
  commissionType?: 'percent' | 'fixed'
  commissionRate?: number
  expectedCommissionAmount?: number
  receivedCommissionAmount?: number
  commissionStatus?: 'previsto' | 'pendente' | 'pago_parcial' | 'pago_total' | 'cancelado'
  commissionPaymentMethod?: string | null
  commissionPaymentTerms?: string | null
  commissionDueDate?: string | null
  commissionPaidDate?: string | null
  serviceStatus?: 'cotacao' | 'contratado' | 'em_andamento' | 'concluido' | 'cancelado'
  notes?: string | null
}

/**
 * 1. LISTAR EMPRESAS & SERVIÇOS VINCULADOS A UM PROJETO ESPECÍFICO
 */
export async function getProjectCompaniesAction(projectId: string): Promise<{
  success: boolean
  items?: ProjectCompanyItem[]
  summary?: {
    totalContractValue: number
    totalExpectedCommission: number
    totalReceivedCommission: number
    totalPendingCommission: number
    totalCompaniesCount: number
  }
  error?: string
}> {
  try {
    const { supabase } = await requireProjectAccess(projectId)

    const { data: links, error: linksError } = await supabase
      .from('project_companies')
      .select(`
        id,
        organization_id,
        project_id,
        company_id,
        service_description,
        category,
        contract_value,
        commission_type,
        commission_rate,
        expected_commission_amount,
        received_commission_amount,
        commission_status,
        commission_payment_method,
        commission_payment_terms,
        commission_due_date,
        commission_paid_date,
        service_status,
        notes,
        created_at,
        updated_at,
        companies (
          id,
          name,
          trade_name,
          phone,
          email,
          contact_name,
          categories
        )
      `)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })

    if (linksError) {
      console.error('Erro ao buscar fornecedores do projeto:', linksError)
      return { success: false, error: linksError.message }
    }

    let totalContractValue = 0
    let totalExpectedCommission = 0
    let totalReceivedCommission = 0

    const items: ProjectCompanyItem[] = (links || []).map((l: any) => {
      const comp = l.companies || {}
      const contractVal = Number(l.contract_value || 0)
      const commRate = Number(l.commission_rate || 0)
      const commType = l.commission_type || 'percent'
      let expectedCom = Number(l.expected_commission_amount || 0)
      if (commType === 'percent' && contractVal > 0 && commRate > 0) {
        expectedCom = (contractVal * commRate) / 100
      }
      const receivedCom = Number(l.received_commission_amount || 0)

      totalContractValue += contractVal
      totalExpectedCommission += expectedCom
      totalReceivedCommission += receivedCom

      return {
        id: l.id,
        organization_id: l.organization_id,
        project_id: l.project_id,
        company_id: l.company_id,
        company_name: comp.name || 'Empresa / Prestador',
        company_trade_name: comp.trade_name || null,
        company_phone: comp.phone || null,
        company_email: comp.email || null,
        company_contact_name: comp.contact_name || null,
        company_categories: Array.isArray(comp.categories) ? comp.categories : [],
        service_description: l.service_description,
        category: l.category || (Array.isArray(comp.categories) && comp.categories[0]) || null,
        contract_value: contractVal,
        commission_type: commType,
        commission_rate: commRate,
        expected_commission_amount: expectedCom,
        received_commission_amount: receivedCom,
        commission_status: l.commission_status || 'pendente',
        commission_payment_method: l.commission_payment_method,
        commission_payment_terms: l.commission_payment_terms,
        commission_due_date: l.commission_due_date,
        commission_paid_date: l.commission_paid_date,
        service_status: l.service_status || 'em_andamento',
        notes: l.notes,
        created_at: l.created_at,
        updated_at: l.updated_at,
      }
    })

    const totalPendingCommission = Math.max(0, totalExpectedCommission - totalReceivedCommission)

    return {
      success: true,
      items,
      summary: {
        totalContractValue,
        totalExpectedCommission,
        totalReceivedCommission,
        totalPendingCommission,
        totalCompaniesCount: items.length,
      },
    }
  } catch (err: any) {
    console.error('getProjectCompaniesAction error:', err)
    return { success: false, error: err?.message || 'Erro ao carregar serviços do projeto.' }
  }
}

/**
 * 2. VINCULAR UMA EMPRESA A UM PROJETO (ALOCAÇÃO DE SERVIÇO / COMISSÃO)
 */
export async function addProjectCompanyAction(input: ProjectCompanyInput): Promise<{
  success: boolean
  item?: ProjectCompanyItem
  error?: string
}> {
  try {
    const { supabase } = await requireProjectAccess(input.projectId)

    // Busca dados da empresa para obter regras de comissão padrão caso não fornecidas
    const { data: company, error: compErr } = await supabase
      .from('companies')
      .select('*')
      .eq('id', input.companyId)
      .single()

    if (compErr || !company) {
      return { success: false, error: 'Empresa selecionada não encontrada.' }
    }

    const contractValue = Number(input.contractValue || 0)
    const commissionType = input.commissionType || company.commission_type || 'percent'
    const commissionRate = input.commissionRate !== undefined ? Number(input.commissionRate) : Number(company.commission_rate || 0)

    let expectedCommissionAmount = 0
    if (commissionType === 'percent') {
      expectedCommissionAmount = (contractValue * commissionRate) / 100
    } else {
      expectedCommissionAmount = input.expectedCommissionAmount !== undefined
        ? Number(input.expectedCommissionAmount)
        : commissionRate
    }

    const receivedCommissionAmount = Number(input.receivedCommissionAmount || 0)

    let commissionStatus = input.commissionStatus || 'pendente'
    if (receivedCommissionAmount > 0 && receivedCommissionAmount >= expectedCommissionAmount && expectedCommissionAmount > 0) {
      commissionStatus = 'pago_total'
    } else if (receivedCommissionAmount > 0) {
      commissionStatus = 'pago_parcial'
    }

    const category = input.category || (Array.isArray(company.categories) && company.categories[0]) || null

    const { data: newLink, error: insertError } = await supabase
      .from('project_companies')
      .insert({
        organization_id: company.organization_id,
        project_id: input.projectId,
        company_id: input.companyId,
        service_description: sanitizeText(input.serviceDescription) || null,
        category: sanitizeText(category) || null,
        contract_value: contractValue,
        commission_type: commissionType === 'fixed' ? 'fixed' : 'percent',
        commission_rate: commissionRate,
        expected_commission_amount: expectedCommissionAmount,
        received_commission_amount: receivedCommissionAmount,
        commission_status: commissionStatus,
        commission_payment_method: sanitizeText(input.commissionPaymentMethod || company.commission_payment_method) || null,
        commission_payment_terms: sanitizeText(input.commissionPaymentTerms || company.commission_payment_terms) || null,
        commission_due_date: input.commissionDueDate || null,
        commission_paid_date: input.commissionPaidDate || null,
        service_status: input.serviceStatus || 'em_andamento',
        notes: sanitizeText(input.notes) || null,
      })
      .select('*')
      .single()

    if (insertError) {
      console.error('Erro ao vincular empresa ao projeto:', insertError)
      return { success: false, error: insertError.message }
    }

    // Cria imediatamente o lançamento de comissão no módulo financeiro
    if (expectedCommissionAmount > 0 || receivedCommissionAmount > 0 || contractValue > 0) {
      const compName = company.trade_name || company.name || 'Fornecedor'
      const { data: proj } = await supabase.from('projects').select('title, code').eq('id', input.projectId).single()
      const projPart = proj?.code ? `[${proj.code}] ` : ''
      const projTitle = proj?.title ? ` - ${proj.title}` : ''
      const title = `Comissão RT: ${compName} ${projPart}${projTitle}`.trim()
      const isPaid = commissionStatus === 'pago_total'
      const amount = isPaid ? (receivedCommissionAmount > 0 ? receivedCommissionAmount : expectedCommissionAmount) : (expectedCommissionAmount > 0 ? expectedCommissionAmount : contractValue)
      const dueDate = input.commissionDueDate || newLink.created_at?.slice(0, 10) || new Date().toISOString().split('T')[0]
      const paymentDate = isPaid ? (input.commissionPaidDate || dueDate) : null

      if (amount > 0) {
        await supabase.from('financial_transactions').insert({
          organization_id: company.organization_id,
          project_id: input.projectId,
          company_id: input.companyId,
          project_company_id: newLink.id,
          type: 'income',
          category: 'comissao_rt',
          title,
          description: input.serviceDescription ? `Referente ao serviço: ${input.serviceDescription}` : 'Comissão / Reserva Técnica (RT) de fornecedor parceiro na obra',
          amount,
          due_date: dueDate,
          payment_date: paymentDate,
          status: isPaid ? 'paid' : (commissionStatus === 'cancelado' ? 'cancelled' : 'pending'),
          payment_method: input.commissionPaymentMethod || company.commission_payment_method || 'PIX'
        })
      }
    }

    revalidatePath('/app/financeiro')
    revalidatePath(`/app/projetos/${input.projectId}`)
    revalidatePath(`/app/projetos/${input.projectId}/fornecedores`)
    revalidatePath(`/app/projetos/${input.projectId}/financeiro`)
    revalidatePath(`/app/empresas/${input.companyId}`)
    revalidatePath('/app/empresas')

    return { success: true, item: newLink as any }
  } catch (err: any) {
    console.error('addProjectCompanyAction error:', err)
    return { success: false, error: err?.message || 'Erro ao vincular serviço ao projeto.' }
  }
}

/**
 * 3. ATUALIZAR DADOS DO VÍNCULO / SERVIÇO / COMISSÃO
 */
export async function updateProjectCompanyAction(
  linkId: string,
  input: Partial<ProjectCompanyInput>
): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const { supabase } = await requireAuth()

    const { data: existing, error: fetchErr } = await supabase
      .from('project_companies')
      .select('*')
      .eq('id', linkId)
      .single()

    if (fetchErr || !existing) {
      return { success: false, error: 'Vínculo não encontrado.' }
    }

    await requireOrgAccess(existing.organization_id)

    const updatePayload: Record<string, any> = {}

    if (input.serviceDescription !== undefined) {
      updatePayload.service_description = sanitizeText(input.serviceDescription) || null
    }
    if (input.category !== undefined) {
      updatePayload.category = sanitizeText(input.category) || null
    }
    if (input.contractValue !== undefined) {
      updatePayload.contract_value = Number(input.contractValue || 0)
    }
    if (input.commissionType !== undefined) {
      updatePayload.commission_type = input.commissionType === 'fixed' ? 'fixed' : 'percent'
    }
    if (input.commissionRate !== undefined) {
      updatePayload.commission_rate = Number(input.commissionRate || 0)
    }

    const contractVal = input.contractValue !== undefined ? Number(input.contractValue) : Number(existing.contract_value || 0)
    const commType = input.commissionType !== undefined ? input.commissionType : (existing.commission_type || 'percent')
    const commRate = input.commissionRate !== undefined ? Number(input.commissionRate) : Number(existing.commission_rate || 0)

    if (commType === 'percent') {
      updatePayload.expected_commission_amount = (contractVal * commRate) / 100
    } else {
      updatePayload.expected_commission_amount = input.expectedCommissionAmount !== undefined
        ? Number(input.expectedCommissionAmount)
        : commRate
    }

    if (input.receivedCommissionAmount !== undefined) {
      updatePayload.received_commission_amount = Number(input.receivedCommissionAmount || 0)
    }

    if (input.commissionStatus !== undefined) {
      updatePayload.commission_status = input.commissionStatus
    } else if (input.receivedCommissionAmount !== undefined) {
      const expected = updatePayload.expected_commission_amount !== undefined ? updatePayload.expected_commission_amount : Number(existing.expected_commission_amount || 0)
      const received = Number(input.receivedCommissionAmount || 0)
      if (received > 0 && received >= expected && expected > 0) {
        updatePayload.commission_status = 'pago_total'
      } else if (received > 0) {
        updatePayload.commission_status = 'pago_parcial'
      }
    }

    if (input.commissionPaymentMethod !== undefined) {
      updatePayload.commission_payment_method = sanitizeText(input.commissionPaymentMethod) || null
    }
    if (input.commissionPaymentTerms !== undefined) {
      updatePayload.commission_payment_terms = sanitizeText(input.commissionPaymentTerms) || null
    }
    if (input.commissionDueDate !== undefined) {
      updatePayload.commission_due_date = input.commissionDueDate || null
    }
    if (input.commissionPaidDate !== undefined) {
      updatePayload.commission_paid_date = input.commissionPaidDate || null
    }
    if (input.serviceStatus !== undefined) {
      updatePayload.service_status = input.serviceStatus
    }
    if (input.notes !== undefined) {
      updatePayload.notes = sanitizeText(input.notes) || null
    }

    const { error: updateErr } = await supabase
      .from('project_companies')
      .update(updatePayload as any)
      .eq('id', linkId)

    if (updateErr) {
      console.error('Erro ao atualizar serviço do projeto:', updateErr)
      return { success: false, error: updateErr.message }
    }

    // Sincroniza o lançamento financeiro correspondente
    const finalCommStatus = updatePayload.commission_status || existing.commission_status
    const isPaid = finalCommStatus === 'pago_total'
    const isCancelled = finalCommStatus === 'cancelado'
    const txStatus = isPaid ? 'paid' : (isCancelled ? 'cancelled' : 'pending')
    const finalExpected = updatePayload.expected_commission_amount !== undefined ? updatePayload.expected_commission_amount : existing.expected_commission_amount
    const finalReceived = updatePayload.received_commission_amount !== undefined ? updatePayload.received_commission_amount : existing.received_commission_amount
    const txAmount = isPaid ? (finalReceived > 0 ? finalReceived : finalExpected) : finalExpected
    const txDueDate = updatePayload.commission_due_date || existing.commission_due_date || existing.created_at?.slice(0, 10)
    const txPaymentDate = isPaid ? (updatePayload.commission_paid_date || existing.commission_paid_date || new Date().toISOString().split('T')[0]) : null

    await supabase
      .from('financial_transactions')
      .update({
        status: txStatus,
        amount: Number(txAmount || 0),
        due_date: txDueDate,
        payment_date: txPaymentDate,
        payment_method: updatePayload.commission_payment_method || existing.commission_payment_method || 'PIX'
      })
      .eq('project_company_id', linkId)

    revalidatePath('/app/financeiro')
    revalidatePath(`/app/projetos/${existing.project_id}`)
    revalidatePath(`/app/projetos/${existing.project_id}/fornecedores`)
    revalidatePath(`/app/projetos/${existing.project_id}/financeiro`)
    revalidatePath(`/app/empresas/${existing.company_id}`)
    revalidatePath('/app/empresas')

    return { success: true }
  } catch (err: any) {
    console.error('updateProjectCompanyAction error:', err)
    return { success: false, error: err?.message || 'Erro ao atualizar serviço.' }
  }
}

/**
 * 4. ATUALIZAÇÃO RÁPIDA DE STATUS DE COMISSÃO
 */
export async function quickUpdateCommissionStatusAction(
  linkId: string,
  status: 'previsto' | 'pendente' | 'pago_parcial' | 'pago_total' | 'cancelado',
  receivedAmount?: number,
  paidDate?: string
): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const { supabase } = await requireAuth()

    const { data: existing, error: fetchErr } = await supabase
      .from('project_companies')
      .select('*')
      .eq('id', linkId)
      .single()

    if (fetchErr || !existing) {
      return { success: false, error: 'Registro não encontrado.' }
    }

    await requireOrgAccess(existing.organization_id)

    const payload: Record<string, any> = {
      commission_status: status,
    }

    if (status === 'pago_total') {
      payload.received_commission_amount = Number(existing.expected_commission_amount || 0)
      payload.commission_paid_date = paidDate || new Date().toISOString().split('T')[0]
    } else if (status === 'pendente' || status === 'previsto') {
      payload.received_commission_amount = 0
      payload.commission_paid_date = null
    } else if (receivedAmount !== undefined) {
      payload.received_commission_amount = Number(receivedAmount)
      if (paidDate) payload.commission_paid_date = paidDate
    }

    const { error: updateErr } = await supabase
      .from('project_companies')
      .update(payload as any)
      .eq('id', linkId)

    if (updateErr) {
      console.error('Erro ao atualizar status de comissão:', updateErr)
      return { success: false, error: updateErr.message }
    }

    // Sincroniza status na transação financeira correspondente
    const isPaid = status === 'pago_total'
    const isCancelled = status === 'cancelado'
    const txStatus = isPaid ? 'paid' : (isCancelled ? 'cancelled' : 'pending')
    const txAmount = isPaid
      ? (payload.received_commission_amount || existing.expected_commission_amount || 0)
      : (existing.expected_commission_amount || 0)
    const txPaymentDate = isPaid ? payload.commission_paid_date : null

    await supabase
      .from('financial_transactions')
      .update({
        status: txStatus,
        amount: Number(txAmount || 0),
        payment_date: txPaymentDate
      })
      .eq('project_company_id', linkId)

    revalidatePath('/app/financeiro')
    revalidatePath(`/app/projetos/${existing.project_id}`)
    revalidatePath(`/app/projetos/${existing.project_id}/fornecedores`)
    revalidatePath(`/app/projetos/${existing.project_id}/financeiro`)
    revalidatePath(`/app/empresas/${existing.company_id}`)
    revalidatePath('/app/empresas')

    return { success: true }
  } catch (err: any) {
    console.error('quickUpdateCommissionStatusAction error:', err)
    return { success: false, error: err?.message || 'Erro ao atualizar comissão.' }
  }
}

/**
 * 5. DESVINCULAR EMPRESA / SERVIÇO DO PROJETO
 */
export async function removeProjectCompanyAction(linkId: string): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const { supabase } = await requireAuth()

    const { data: link, error: fetchErr } = await supabase
      .from('project_companies')
      .select('organization_id, project_id, company_id')
      .eq('id', linkId)
      .single()

    if (fetchErr || !link) {
      return { success: false, error: 'Registro não encontrado.' }
    }

    await requireOrgAccess(link.organization_id)

    // Remove primeiro qualquer lançamento financeiro vinculado
    await supabase
      .from('financial_transactions')
      .delete()
      .eq('project_company_id', linkId)

    const { error: delErr } = await supabase
      .from('project_companies')
      .delete()
      .eq('id', linkId)

    if (delErr) {
      console.error('Erro ao desvincular empresa:', delErr)
      return { success: false, error: delErr.message }
    }

    revalidatePath('/app/financeiro')
    revalidatePath(`/app/projetos/${link.project_id}`)
    revalidatePath(`/app/projetos/${link.project_id}/fornecedores`)
    revalidatePath(`/app/projetos/${link.project_id}/financeiro`)
    revalidatePath(`/app/empresas/${link.company_id}`)
    revalidatePath('/app/empresas')

    return { success: true }
  } catch (err: any) {
    console.error('removeProjectCompanyAction error:', err)
    return { success: false, error: err?.message || 'Erro ao remover vínculo.' }
  }
}
