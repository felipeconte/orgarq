'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAuth, requireOrgAccess, requireProjectAccess } from '@/lib/server/guard'
import { sanitizeText } from '@/lib/server/sanitize'
import { Database, Json } from '@/types/database.types'

type ProjectUpdate = Database['public']['Tables']['projects']['Update']

function parseCleanNumber(val: string | null | undefined): number | null {
  if (!val) return null
  let cleaned = val.replace(/[^\d.,-]/g, '').trim()
  if (!cleaned) return null

  if (cleaned.includes(',') && cleaned.includes('.')) {
    if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.')
    } else {
      cleaned = cleaned.replace(/,/g, '')
    }
  } else if (cleaned.includes(',')) {
    cleaned = cleaned.replace(',', '.')
  }

  const num = parseFloat(cleaned)
  return isNaN(num) ? null : num
}

function extractClientIdsFromFormData(formData: FormData): string[] {
  const result: string[] = []

  const allEntries = formData.getAll('clientIds')
  for (const entry of allEntries) {
    const val = entry ? entry.toString().trim() : ''
    if (!val) continue
    if (val.startsWith('[') && val.endsWith(']')) {
      try {
        const parsed = JSON.parse(val)
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            const clean = typeof item === 'string' ? item.trim() : ''
            if (clean && !result.includes(clean) && !clean.startsWith('[') && !clean.startsWith('{')) {
              result.push(clean)
            }
          }
        }
      } catch {
        // ignore
      }
    } else if (!result.includes(val) && !val.startsWith('[') && !val.startsWith('{')) {
      result.push(val)
    }
  }

  const single = (formData.get('clientId') as string)?.trim()
  if (single && !result.includes(single) && !single.startsWith('[') && !single.startsWith('{')) {
    result.push(single)
  }

  return result
}

export async function createProjectAction(formData: FormData): Promise<{ success: boolean; projectId?: string; error?: string }> {
  const { supabase, user } = await requireAuth()

  let organizationId = (formData.get('organizationId') as string) || ''
  const code = sanitizeText(formData.get('code') as string)
  const title = sanitizeText(formData.get('title') as string)
  const typology = sanitizeText(formData.get('typology') as string)
  const areaSqmStr = formData.get('areaSqm') as string
  const estimatedBudgetStr = formData.get('estimatedBudget') as string
  const address = sanitizeText(formData.get('address') as string)
  const city = sanitizeText(formData.get('city') as string)
  const state = sanitizeText(formData.get('state') as string)
  const startDate = formData.get('startDate') as string
  const deadline = formData.get('deadline') as string
  const description = sanitizeText(formData.get('description') as string)
  const clientName = sanitizeText(formData.get('clientName') as string)
  const clientEmail = sanitizeText(formData.get('clientEmail') as string)
  const clientPhone = sanitizeText(formData.get('clientPhone') as string)

  const clientIds = extractClientIdsFromFormData(formData)

  let linkedClients: { id: string; name: string; email: string | null; phone: string | null }[] = []
  if (clientIds.length > 0) {
    const { data: dbClients, error: clientsErr } = await supabase
      .from('clients')
      .select('id, name, email, phone')
      .in('id', clientIds)

    if (dbClients && dbClients.length > 0) {
      linkedClients = dbClients
    } else if (clientsErr) {
      console.warn('Erro ao consultar clients vinculados:', clientsErr)
    }
  }

  let finalClientName = clientName
  if (linkedClients.length > 0) {
    finalClientName = linkedClients.map((c) => c.name).join(' & ')
  } else if (!finalClientName && clientIds.length > 0) {
    finalClientName = 'Cliente do Projeto'
  }

  const primaryClientId = linkedClients[0]?.id || clientIds[0] || null
  const primaryClientEmail = linkedClients[0]?.email || clientEmail || null
  const primaryClientPhone = linkedClients[0]?.phone || clientPhone || null

  if (!code || !title || (!finalClientName && clientIds.length === 0)) {
    return { success: false, error: 'Código, título e ao menos um cliente são obrigatórios.' }
  }

  // Se organizationId não foi informada ou está vazia, busca ou auto-provisiona para o usuário
  if (!organizationId) {
    const { data: member } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()

    if (member?.organization_id) {
      organizationId = member.organization_id
    } else {
      const { data: existingOrg } = await supabase
        .from('organizations')
        .select('id')
        .eq('owner_id', user.id)
        .limit(1)
        .maybeSingle()

      if (existingOrg?.id) {
        organizationId = existingOrg.id
      } else {
        const slug = `escritorio-${user.id.slice(0, 6)}-${Math.floor(1000 + Math.random() * 9000)}`
        const { data: newOrg, error: orgCreateError } = await supabase
          .from('organizations')
          .insert({
            name: 'Meu Escritório de Arquitetura',
            slug,
            owner_id: user.id,
            email: user.email || null,
          })
          .select('id')
          .single()

        if (orgCreateError || !newOrg) {
          return { success: false, error: 'Não foi possível inicializar a organização do escritório.' }
        }
        organizationId = newOrg.id
      }
    }
  }

  // Prevenção IDOR: valida que o usuário é membro da organização
  try {
    await requireOrgAccess(organizationId)
  } catch (err: unknown) {
    // Se for o dono mas faltou o membership, associa como owner
    const { data: ownerOrg } = await supabase
      .from('organizations')
      .select('id')
      .eq('id', organizationId)
      .eq('owner_id', user.id)
      .maybeSingle()

    if (ownerOrg) {
      await supabase
        .from('organization_members')
        .insert({
          organization_id: organizationId,
          user_id: user.id,
          role: 'owner',
        })
        .select('id')
        .maybeSingle()
    } else {
      return { success: false, error: 'Você não tem permissão nesta organização.' }
    }
  }

  const templateOption = (formData.get('templateOption') as string) || 'default' // 'default' | 'none' | 'custom'
  const stageTemplateId = (formData.get('stageTemplateId') as string) || null

  const skipDefaultStages = templateOption === 'none'
  const finalStageTemplateId = templateOption === 'custom' && stageTemplateId ? stageTemplateId : null

  const areaSqm = parseCleanNumber(areaSqmStr)
  const estimatedBudget = parseCleanNumber(estimatedBudgetStr)

  const { data: project, error } = await supabase
    .from('projects')
    .insert({
      organization_id: organizationId,
      code,
      title,
      client_id: primaryClientId,
      client_name: finalClientName,
      client_email: primaryClientEmail,
      client_phone: primaryClientPhone,
      typology: typology || 'Residencial',
      area_sqm: areaSqm,
      estimated_budget: estimatedBudget,
      address: address || null,
      city: city || null,
      state: state || null,
      start_date: startDate || null,
      deadline: deadline || null,
      description: description || null,
      created_by: user.id,
      status: 'ativo',
      stage_template_id: finalStageTemplateId,
      skip_default_stages: skipDefaultStages,
    } as any)
    .select('id')
    .single()

  if (error || !project) {
    console.error('Erro ao criar projeto:', error)
    return { success: false, error: error?.message || 'Falha ao cadastrar projeto no banco de dados.' }
  }

  // Vincula todos os clientes selecionados na tabela project_clients
  if (clientIds.length > 0) {
    const projectClientRows = clientIds.map((cid) => ({
      project_id: project.id,
      client_id: cid,
    }))
    await supabase.from('project_clients').upsert(projectClientRows, { onConflict: 'project_id,client_id' })
  }

  revalidatePath('/app/projetos')
  revalidatePath('/app/clientes')
  clientIds.forEach((cid) => {
    revalidatePath(`/app/clientes/${cid}`)
  })
  revalidatePath('/app')

  return { success: true, projectId: project.id }
}

export async function updateProjectAction(projectId: string, formData: FormData) {
  const { supabase } = await requireProjectAccess(projectId)

  const title = sanitizeText(formData.get('title') as string)
  const clientName = sanitizeText(formData.get('clientName') as string)
  const typology = sanitizeText(formData.get('typology') as string)
  const areaSqmStr = formData.get('areaSqm') as string
  const estimatedBudgetStr = formData.get('estimatedBudget') as string
  const address = sanitizeText(formData.get('address') as string)
  const city = sanitizeText(formData.get('city') as string)
  const state = sanitizeText(formData.get('state') as string)
  const startDate = formData.get('startDate') as string
  const deadline = formData.get('deadline') as string
  const description = sanitizeText(formData.get('description') as string)
  const status = formData.get('status') as 'ativo' | 'em_producao' | 'pausado' | 'concluido' | 'cancelado'

  // Support multi-client update
  const hasClientIds = formData.has('clientIds') || formData.has('clientId')
  const clientIds = hasClientIds ? extractClientIdsFromFormData(formData) : null

  const updatePayload: ProjectUpdate = {}
  if (title) updatePayload.title = title
  if (typology) updatePayload.typology = typology
  if (areaSqmStr !== undefined) updatePayload.area_sqm = parseCleanNumber(areaSqmStr)
  if (estimatedBudgetStr !== undefined) updatePayload.estimated_budget = parseCleanNumber(estimatedBudgetStr)
  if (address !== undefined) updatePayload.address = address || null
  if (city !== undefined) updatePayload.city = city || null
  if (state !== undefined) updatePayload.state = state || null
  if (startDate !== undefined) updatePayload.start_date = startDate || null
  if (deadline !== undefined) updatePayload.deadline = deadline || null
  if (description !== undefined) updatePayload.description = description || null
  if (status) updatePayload.status = status as any

  if (clientIds !== null) {
    let linkedClients: { id: string; name: string; email: string | null; phone: string | null }[] = []
    if (clientIds.length > 0) {
      const { data: dbClients } = await supabase
        .from('clients')
        .select('id, name, email, phone')
        .in('id', clientIds)

      if (dbClients) linkedClients = dbClients
    }

    if (linkedClients.length > 0) {
      updatePayload.client_name = linkedClients.map((c) => c.name).join(' & ')
      ;(updatePayload as any).client_id = linkedClients[0].id
      updatePayload.client_email = linkedClients[0].email
      updatePayload.client_phone = linkedClients[0].phone
    } else if (clientName) {
      updatePayload.client_name = clientName
    }

    // Sincroniza tabela project_clients
    try {
      await supabase.from('project_clients').delete().eq('project_id', projectId)
      if (clientIds.length > 0) {
        const rows = clientIds.map((cid) => ({
          project_id: projectId,
          client_id: cid,
        }))
        await supabase.from('project_clients').insert(rows)
      }
    } catch (syncErr) {
      console.warn('project_clients sync error:', syncErr)
    }
  } else if (clientName) {
    updatePayload.client_name = clientName
  }

  const { error } = await supabase
    .from('projects')
    .update(updatePayload)
    .eq('id', projectId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/app/projetos/${projectId}`)
  revalidatePath('/app/projetos')
  revalidatePath('/app/clientes')
  if (clientIds) {
    clientIds.forEach((cid) => revalidatePath(`/app/clientes/${cid}`))
  }
  revalidatePath('/app')
  return { success: true }
}

export async function deleteProjectAction(projectId: string) {
  const { supabase } = await requireProjectAccess(projectId)

  const { error } = await supabase.from('projects').delete().eq('id', projectId)
  if (error) {
    return { error: error.message }
  }

  revalidatePath('/app/projetos')
  revalidatePath('/app')
  return { success: true }
}


export async function updateBriefingAction(projectId: string, formData: FormData) {
  const { supabase } = await requireProjectAccess(projectId)

  const stylePreferences = sanitizeText(formData.get('stylePreferences') as string)
  const budgetNotes = sanitizeText(formData.get('budgetNotes') as string)
  const siteConditions = sanitizeText(formData.get('siteConditions') as string)
  const notes = sanitizeText(formData.get('notes') as string)
  const needsProgramJson = formData.get('needsProgram') as string

  let needsProgram: Json = []
  if (needsProgramJson) {
    try {
      needsProgram = JSON.parse(needsProgramJson)
    } catch {
      needsProgram = []
    }
  }

  const { error } = await supabase
    .from('project_briefings')
    .upsert({
      project_id: projectId,
      style_preferences: stylePreferences || null,
      budget_notes: budgetNotes || null,
      site_conditions: siteConditions || null,
      notes: notes || null,
      needs_program: needsProgram,
    })

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/app/projetos/${projectId}/briefing`)
  return { success: true }
}
