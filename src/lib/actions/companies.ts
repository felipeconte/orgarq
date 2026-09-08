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
  CompanyData,
  CompanyInput,
  CompanyProjectLink,
} from '@/types/companies'

export type {
  CompanyData,
  CompanyInput,
  CompanyProjectLink,
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
 * 1. LISTAR TODAS AS EMPRESAS DA ORGANIZAÇÃO COM RESUMO DE PROJETOS E COMISSÕES
 */
export async function getCompaniesAction(params?: {
  organizationId?: string
  search?: string
  category?: string
  status?: string
}): Promise<{
  success: boolean
  companies?: CompanyData[]
  error?: string
}> {
  try {
    const { supabase, user } = await requireAuth()
    const orgId = await resolveUserOrgId(supabase, user.id, params?.organizationId)

    if (!orgId) {
      return { success: true, companies: [] }
    }

    await requireOrgAccess(orgId)

    let query = supabase
      .from('companies')
      .select('*')
      .eq('organization_id', orgId)
      .order('name', { ascending: true })

    if (params?.status && params.status !== 'todos') {
      query = query.eq('status', params.status as 'ativo' | 'inativo')
    }

    if (params?.search) {
      const searchClean = sanitizeText(params.search)
      if (searchClean) {
        query = query.or(`name.ilike.%${searchClean}%,trade_name.ilike.%${searchClean}%,contact_name.ilike.%${searchClean}%`)
      }
    }

    const { data: companiesData, error: companiesError } = await query

    if (companiesError) {
      console.error('Erro ao buscar empresas:', companiesError)
      return { success: false, error: companiesError.message }
    }

    const companies = (companiesData || []) as unknown as CompanyData[]

    // Busca vínculos de projetos para métricas agregadas
    const { data: projectLinks } = await supabase
      .from('project_companies')
      .select('company_id, contract_value, commission_type, commission_rate, expected_commission_amount, received_commission_amount, commission_status, service_status')
      .eq('organization_id', orgId)

    const links = projectLinks || []

    const statsMap = new Map<
      string,
      { total: number; active: number; received: number; pending: number }
    >()

    companies.forEach((c) => {
      statsMap.set(c.id, { total: 0, active: 0, received: 0, pending: 0 })
    })

    links.forEach((l: any) => {
      const stat = statsMap.get(l.company_id)
      if (stat) {
        stat.total += 1
        if (l.service_status === 'em_andamento' || l.service_status === 'contratado') {
          stat.active += 1
        }
        stat.received += Number(l.received_commission_amount || 0)

        const contractVal = Number(l.contract_value || 0)
        const commRate = Number(l.commission_rate || 0)
        const commType = l.commission_type || 'percent'
        let expectedCom = Number(l.expected_commission_amount || 0)
        if (commType === 'percent' && contractVal > 0 && commRate > 0) {
          expectedCom = (contractVal * commRate) / 100
        }

        if (l.commission_status === 'pendente' || l.commission_status === 'previsto' || l.commission_status === 'pago_parcial') {
          const pendente = expectedCom - Number(l.received_commission_amount || 0)
          stat.pending += Math.max(0, pendente)
        }
      }
    })

    const enrichedCompanies = companies
      .filter((c) => {
        if (!params?.category || params.category === 'todas') return true
        return Array.isArray(c.categories) && c.categories.includes(params.category)
      })
      .map((c) => {
        const stat = statsMap.get(c.id) || { total: 0, active: 0, received: 0, pending: 0 }
        let contactsList = Array.isArray(c.contacts) && c.contacts.length > 0 ? (c.contacts as any) : []
        if (contactsList.length === 0 && c.contact_name) {
          contactsList = [
            {
              id: 'legacy-1',
              name: c.contact_name,
              role: 'Representante Comercial',
              phone: c.phone || null,
              email: c.email || null,
              is_primary: true,
            },
          ]
        }

        return {
          ...c,
          contacts: contactsList,
          projects_count: stat.total,
          active_projects_count: stat.active,
          total_commission_received: stat.received,
          total_commission_pending: stat.pending,
        }
      })

    return { success: true, companies: enrichedCompanies }
  } catch (err: any) {
    console.error('getCompaniesAction error:', err)
    return { success: false, error: err?.message || 'Erro ao carregar lista de empresas.' }
  }
}

/**
 * 2. BUSCAR DETALHES DE UMA EMPRESA ESPECÍFICA E SEUS PROJETOS ALOCADOS
 */
export async function getCompanyByIdAction(companyId: string): Promise<{
  success: boolean
  company?: CompanyData
  projects?: CompanyProjectLink[]
  error?: string
}> {
  try {
    const { supabase } = await requireAuth()

    const { data: company, error: companyErr } = await supabase
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .single()

    if (companyErr || !company) {
      return { success: false, error: 'Empresa não encontrada.' }
    }

    await requireOrgAccess(company.organization_id)

    let contactsList = Array.isArray(company.contacts) && company.contacts.length > 0 ? (company.contacts as any) : []
    if (contactsList.length === 0 && company.contact_name) {
      contactsList = [
        {
          id: 'legacy-1',
          name: company.contact_name,
          role: 'Representante Comercial',
          phone: company.phone || null,
          email: company.email || null,
          is_primary: true,
        },
      ]
    }

    const companyData: CompanyData = {
      ...(company as any),
      contacts: contactsList,
    }

    // Busca vínculos de projetos
    const { data: links, error: linksErr } = await supabase
      .from('project_companies')
      .select(`
        id,
        project_id,
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
        projects (
          id,
          code,
          title,
          status,
          client_name
        )
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })

    if (linksErr) {
      console.error('Erro ao buscar projetos da empresa:', linksErr)
    }

    let totalReceived = 0
    let totalPending = 0
    let activeProjects = 0

    const projects: CompanyProjectLink[] = (links || []).map((l: any) => {
      const proj = l.projects || {}
      const contractVal = Number(l.contract_value || 0)
      const commRate = Number(l.commission_rate || 0)
      const commType = l.commission_type || 'percent'
      let expectedCom = Number(l.expected_commission_amount || 0)
      if (commType === 'percent' && contractVal > 0 && commRate > 0) {
        expectedCom = (contractVal * commRate) / 100
      }
      const receivedCom = Number(l.received_commission_amount || 0)

      totalReceived += receivedCom
      if (l.commission_status === 'pendente' || l.commission_status === 'previsto' || l.commission_status === 'pago_parcial') {
        totalPending += Math.max(0, expectedCom - receivedCom)
      }
      if (l.service_status === 'em_andamento' || l.service_status === 'contratado') {
        activeProjects += 1
      }

      return {
        id: l.id,
        project_id: l.project_id,
        project_code: proj.code || 'PRJ',
        project_title: proj.title || 'Projeto sem título',
        project_status: proj.status || 'ativo',
        client_name: proj.client_name || 'Cliente',
        service_description: l.service_description,
        category: l.category,
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
      }
    })

    const enrichedCompany: CompanyData = {
      ...(company as unknown as CompanyData),
      contacts: contactsList,
      projects_count: projects.length,
      active_projects_count: activeProjects,
      total_commission_received: totalReceived,
      total_commission_pending: totalPending,
    }

    return { success: true, company: enrichedCompany, projects }
  } catch (err: any) {
    console.error('getCompanyByIdAction error:', err)
    return { success: false, error: err?.message || 'Erro ao carregar detalhes da empresa.' }
  }
}

/**
 * 3. CRIAR NOVA EMPRESA / PRESTADOR DE SERVIÇOS
 */
export async function createCompanyAction(input: CompanyInput): Promise<{
  success: boolean
  company?: CompanyData
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
      return { success: false, error: 'O nome / razão social deve conter no mínimo 2 caracteres.' }
    }

    const personType = input.personType === 'PF' ? 'PF' : 'PJ'
    const documentNumber = cleanDigits(input.documentNumber) || null
    const email = input.email ? input.email.trim().toLowerCase() : null
    const phone = cleanDigits(input.phone) || null
    const zipCode = cleanDigits(input.zipCode) || null

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

    // Processa lista de múltiplos vendedores / contatos
    let contactsPayload: any[] = []
    if (Array.isArray(input.contacts)) {
      contactsPayload = input.contacts
        .filter((c) => c && c.name && c.name.trim().length > 0)
        .map((c) => ({
          id: c.id || crypto.randomUUID(),
          name: sanitizeText(c.name) || '',
          role: sanitizeText(c.role) || null,
          phone: cleanDigits(c.phone) || null,
          email: c.email ? c.email.trim().toLowerCase() : null,
          is_primary: Boolean(c.is_primary),
        }))
    }

    const primaryContact = contactsPayload.find((c) => c.is_primary) || contactsPayload[0]
    const contactName = primaryContact ? primaryContact.name : (sanitizeText(input.contactName) || null)

    const insertPayload: Record<string, any> = {
      organization_id: orgId,
      name,
      trade_name: sanitizeText(input.tradeName) || null,
      person_type: personType,
      document_number: documentNumber,
      categories: Array.isArray(input.categories) ? input.categories : [],
      contacts: contactsPayload,
      contact_name: contactName,
      email,
      phone,
      address: sanitizeText(input.address) || null,
      city: sanitizeText(input.city) || null,
      state: sanitizeText(input.state) || null,
      zip_code: zipCode,
      website: sanitizeText(input.website) || null,
      instagram: sanitizeText(input.instagram) || null,
      commission_type: input.commissionType || 'percent',
      commission_rate: Number(input.commissionRate || 0),
      commission_payment_method: sanitizeText(input.commissionPaymentMethod) || null,
      commission_payment_terms: sanitizeText(input.commissionPaymentTerms) || null,
      notes: sanitizeText(input.notes) || null,
      rating: Number(input.rating || 5),
      status: input.status || 'ativo',
    }

    const { data: newCompany, error: insertError } = await supabase
      .from('companies')
      .insert(insertPayload as any)
      .select('*')
      .single()

    if (insertError) {
      console.error('Erro ao inserir empresa:', insertError)
      return { success: false, error: insertError.message }
    }

    revalidatePath('/app/empresas')
    revalidatePath('/app')

    return { success: true, company: newCompany as unknown as CompanyData }
  } catch (err: any) {
    console.error('createCompanyAction error:', err)
    return { success: false, error: err?.message || 'Erro ao criar empresa.' }
  }
}

/**
 * 4. ATUALIZAR EMPRESA
 */
export async function updateCompanyAction(
  companyId: string,
  input: Partial<CompanyInput>
): Promise<{
  success: boolean
  company?: CompanyData
  error?: string
}> {
  try {
    const { supabase } = await requireAuth()

    const { data: existing, error: fetchErr } = await supabase
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .single()

    if (fetchErr || !existing) {
      return { success: false, error: 'Empresa não encontrada.' }
    }

    await requireOrgAccess(existing.organization_id)

    const updatePayload: Record<string, any> = {}

    if (input.name !== undefined) {
      const name = sanitizeText(input.name)
      if (!name || name.trim().length < 2) {
        return { success: false, error: 'O nome / razão social deve conter no mínimo 2 caracteres.' }
      }
      updatePayload.name = name
    }

    if (input.tradeName !== undefined) updatePayload.trade_name = sanitizeText(input.tradeName) || null
    if (input.personType !== undefined) updatePayload.person_type = input.personType === 'PF' ? 'PF' : 'PJ'

    const currentPersonType = (updatePayload.person_type || existing.person_type) as 'PF' | 'PJ'

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

    if (input.categories !== undefined) updatePayload.categories = Array.isArray(input.categories) ? input.categories : []

    // Atualiza contatos múltiplos
    if (input.contacts !== undefined) {
      const contactsPayload = Array.isArray(input.contacts)
        ? input.contacts
            .filter((c) => c && c.name && c.name.trim().length > 0)
            .map((c) => ({
              id: c.id || crypto.randomUUID(),
              name: sanitizeText(c.name) || '',
              role: sanitizeText(c.role) || null,
              phone: cleanDigits(c.phone) || null,
              email: c.email ? c.email.trim().toLowerCase() : null,
              is_primary: Boolean(c.is_primary),
            }))
        : []

      updatePayload.contacts = contactsPayload
      const primaryContact = contactsPayload.find((c) => c.is_primary) || contactsPayload[0]
      updatePayload.contact_name = primaryContact ? primaryContact.name : null
    } else if (input.contactName !== undefined) {
      updatePayload.contact_name = sanitizeText(input.contactName) || null
    }

    if (input.address !== undefined) updatePayload.address = sanitizeText(input.address) || null
    if (input.city !== undefined) updatePayload.city = sanitizeText(input.city) || null
    if (input.state !== undefined) updatePayload.state = sanitizeText(input.state) || null
    if (input.zipCode !== undefined) updatePayload.zip_code = cleanDigits(input.zipCode) || null
    if (input.website !== undefined) updatePayload.website = sanitizeText(input.website) || null
    if (input.instagram !== undefined) updatePayload.instagram = sanitizeText(input.instagram) || null
    if (input.commissionType !== undefined) updatePayload.commission_type = input.commissionType
    if (input.commissionRate !== undefined) updatePayload.commission_rate = Number(input.commissionRate || 0)
    if (input.commissionPaymentMethod !== undefined) updatePayload.commission_payment_method = sanitizeText(input.commissionPaymentMethod) || null
    if (input.commissionPaymentTerms !== undefined) updatePayload.commission_payment_terms = sanitizeText(input.commissionPaymentTerms) || null
    if (input.notes !== undefined) updatePayload.notes = sanitizeText(input.notes) || null
    if (input.rating !== undefined) updatePayload.rating = Number(input.rating || 5)
    if (input.status !== undefined) updatePayload.status = input.status

    const { data: updated, error: updateErr } = await supabase
      .from('companies')
      .update(updatePayload as any)
      .eq('id', companyId)
      .select('*')
      .single()

    if (updateErr) {
      console.error('Erro ao atualizar empresa:', updateErr)
      return { success: false, error: updateErr.message }
    }

    revalidatePath('/app/empresas')
    revalidatePath(`/app/empresas/${companyId}`)
    revalidatePath('/app/projetos')
    revalidatePath('/app')

    return { success: true, company: updated as unknown as CompanyData }
  } catch (err: any) {
    console.error('updateCompanyAction error:', err)
    return { success: false, error: err?.message || 'Erro ao atualizar empresa.' }
  }
}

/**
 * 5. EXCLUIR EMPRESA
 */
export async function deleteCompanyAction(companyId: string): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const { supabase } = await requireAuth()

    const { data: company, error: fetchErr } = await supabase
      .from('companies')
      .select('organization_id')
      .eq('id', companyId)
      .single()

    if (fetchErr || !company) {
      return { success: false, error: 'Empresa não encontrada.' }
    }

    await requireOrgAccess(company.organization_id)

    const { error: delErr } = await supabase
      .from('companies')
      .delete()
      .eq('id', companyId)

    if (delErr) {
      console.error('Erro ao excluir empresa:', delErr)
      return { success: false, error: delErr.message }
    }

    revalidatePath('/app/empresas')
    revalidatePath('/app/projetos')
    revalidatePath('/app')

    return { success: true }
  } catch (err: any) {
    console.error('deleteCompanyAction error:', err)
    return { success: false, error: err?.message || 'Erro ao excluir empresa.' }
  }
}
