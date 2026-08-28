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

export async function createProjectAction(formData: FormData): Promise<{ success: boolean; projectId?: string; error?: string }> {
  const { supabase, user } = await requireAuth()

  let organizationId = (formData.get('organizationId') as string) || ''
  const code = sanitizeText(formData.get('code') as string)
  const title = sanitizeText(formData.get('title') as string)
  const clientName = sanitizeText(formData.get('clientName') as string)
  const clientEmail = sanitizeText(formData.get('clientEmail') as string)
  const clientPhone = sanitizeText(formData.get('clientPhone') as string)
  const typology = sanitizeText(formData.get('typology') as string)
  const areaSqmStr = formData.get('areaSqm') as string
  const estimatedBudgetStr = formData.get('estimatedBudget') as string
  const address = sanitizeText(formData.get('address') as string)
  const city = sanitizeText(formData.get('city') as string)
  const state = sanitizeText(formData.get('state') as string)
  const startDate = formData.get('startDate') as string
  const deadline = formData.get('deadline') as string
  const description = sanitizeText(formData.get('description') as string)

  if (!code || !title || !clientName) {
    return { success: false, error: 'Código, título e nome do cliente são obrigatórios.' }
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
      client_name: clientName,
      client_email: clientEmail || null,
      client_phone: clientPhone || null,
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

  revalidatePath('/app/projetos')
  revalidatePath('/app')

  return { success: true, projectId: project.id }
}

export async function updateProjectAction(projectId: string, formData: FormData) {
  const { supabase } = await requireProjectAccess(projectId)

  const title = sanitizeText(formData.get('title') as string)
  const clientName = sanitizeText(formData.get('clientName') as string)
  const clientEmail = sanitizeText(formData.get('clientEmail') as string)
  const clientPhone = sanitizeText(formData.get('clientPhone') as string)
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

  const updatePayload: ProjectUpdate = {}
  if (title) updatePayload.title = title
  if (clientName) updatePayload.client_name = clientName
  if (clientEmail !== undefined) updatePayload.client_email = clientEmail || null
  if (clientPhone !== undefined) updatePayload.client_phone = clientPhone || null
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

  const { error } = await supabase
    .from('projects')
    .update(updatePayload)
    .eq('id', projectId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/app/projetos/${projectId}`)
  revalidatePath('/app/projetos')
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
