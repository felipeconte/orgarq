'use server'

import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/server/guard'
import { sanitizeText } from '@/lib/server/sanitize'

async function resolveUserOrgId(supabase: any, userId: string): Promise<string> {
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

  if (org?.id) return org.id

  const slug = `escritorio-${userId.slice(0, 6)}`
  const { data: newOrg } = await supabase
    .from('organizations')
    .insert({
      name: 'Meu Escritório de Arquitetura',
      slug,
      owner_id: userId,
    })
    .select('id')
    .single()

  return newOrg?.id || ''
}

export async function createTemplateAction(
  name: string,
  description?: string,
  duplicateFromId?: string
) {
  const { supabase, user } = await requireAuth()
  const cleanName = sanitizeText(name)
  if (!cleanName) return { error: 'O nome do template é obrigatório' }

  const orgId = await resolveUserOrgId(supabase, user.id)
  if (!orgId) return { error: 'Organização não encontrada' }

  const { data: newTpl, error: tplError } = await supabase
    .from('stage_templates')
    .insert({
      organization_id: orgId,
      name: cleanName,
      description: description ? sanitizeText(description) : null,
      is_default: false,
    })
    .select('id')
    .single()

  if (tplError || !newTpl) {
    return { error: tplError?.message || 'Erro ao criar template' }
  }

  if (duplicateFromId) {
    const { data: sourceItems } = await supabase
      .from('stage_template_items')
      .select('*')
      .eq('stage_template_id', duplicateFromId)
      .order('stage_order', { ascending: true })

    if (sourceItems && sourceItems.length > 0) {
      const itemsToClone = sourceItems.map((item) => ({
        stage_template_id: newTpl.id,
        name: item.name,
        description: item.description,
        stage_order: item.stage_order,
        default_duration_days: item.default_duration_days,
        is_client_approval_required: item.is_client_approval_required,
        checklist: item.checklist || [],
      }))

      await supabase.from('stage_template_items').insert(itemsToClone)
    }
  }

  revalidatePath('/app/configuracoes/etapas')
  return { success: true, templateId: newTpl.id }
}

export async function updateTemplateAction(
  templateId: string,
  name: string,
  description?: string
) {
  const { supabase, user } = await requireAuth()
  const cleanName = sanitizeText(name)
  if (!cleanName) return { error: 'O nome do template é obrigatório' }

  const orgId = await resolveUserOrgId(supabase, user.id)

  const { error } = await supabase
    .from('stage_templates')
    .update({
      name: cleanName,
      description: description ? sanitizeText(description) : null,
    })
    .eq('id', templateId)
    .eq('organization_id', orgId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/app/configuracoes/etapas')
  return { success: true }
}

export async function setDefaultTemplateAction(templateId: string) {
  const { supabase, user } = await requireAuth()
  const orgId = await resolveUserOrgId(supabase, user.id)

  // 1. Remove default de todos
  await supabase
    .from('stage_templates')
    .update({ is_default: false })
    .eq('organization_id', orgId)

  // 2. Define o novo default
  const { error } = await supabase
    .from('stage_templates')
    .update({ is_default: true })
    .eq('id', templateId)
    .eq('organization_id', orgId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/app/configuracoes/etapas')
  return { success: true }
}

export async function deleteTemplateAction(templateId: string) {
  const { supabase, user } = await requireAuth()
  const orgId = await resolveUserOrgId(supabase, user.id)

  const { data: tpl } = await supabase
    .from('stage_templates')
    .select('is_default')
    .eq('id', templateId)
    .eq('organization_id', orgId)
    .single()

  if (tpl?.is_default) {
    return { error: 'Você não pode excluir o template ativo padrão. Defina outro como padrão antes.' }
  }

  const { error } = await supabase
    .from('stage_templates')
    .delete()
    .eq('id', templateId)
    .eq('organization_id', orgId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/app/configuracoes/etapas')
  return { success: true }
}

export async function addTemplateItemAction(
  templateId: string,
  itemData: {
    name: string
    description?: string
    default_duration_days?: number | null
    is_client_approval_required?: boolean
  }
) {
  const { supabase } = await requireAuth()
  const cleanName = sanitizeText(itemData.name)
  if (!cleanName) return { error: 'O nome da tarefa é obrigatório' }

  // Busca a maior ordem atual
  const { data: items } = await supabase
    .from('stage_template_items')
    .select('stage_order')
    .eq('stage_template_id', templateId)
    .order('stage_order', { ascending: false })
    .limit(1)

  const nextOrder = (items?.[0]?.stage_order || 0) + 1

  const durationVal =
    itemData.default_duration_days != null && !isNaN(Number(itemData.default_duration_days))
      ? Number(itemData.default_duration_days)
      : null

  const { data: newItem, error } = await supabase
    .from('stage_template_items')
    .insert({
      stage_template_id: templateId,
      name: cleanName,
      description: itemData.description ? sanitizeText(itemData.description) : null,
      stage_order: nextOrder,
      default_duration_days: durationVal,
      is_client_approval_required: itemData.is_client_approval_required ?? true,
      checklist: [],
    })
    .select('*')
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/app/configuracoes/etapas')
  return { success: true, item: newItem }
}

export async function updateTemplateItemAction(
  itemId: string,
  itemData: {
    name?: string
    description?: string
    default_duration_days?: number | null
    is_client_approval_required?: boolean
  }
) {
  const { supabase } = await requireAuth()

  const updatePayload: Record<string, any> = {}
  if (itemData.name !== undefined) updatePayload.name = sanitizeText(itemData.name)
  if (itemData.description !== undefined) updatePayload.description = itemData.description ? sanitizeText(itemData.description) : null
  if (itemData.default_duration_days !== undefined) {
    updatePayload.default_duration_days =
      itemData.default_duration_days != null && !isNaN(Number(itemData.default_duration_days))
        ? Number(itemData.default_duration_days)
        : null
  }
  if (itemData.is_client_approval_required !== undefined) updatePayload.is_client_approval_required = itemData.is_client_approval_required

  const { error } = await supabase
    .from('stage_template_items')
    .update(updatePayload as any)
    .eq('id', itemId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/app/configuracoes/etapas')
  return { success: true }
}

export async function deleteTemplateItemAction(itemId: string) {
  const { supabase } = await requireAuth()

  const { error } = await supabase
    .from('stage_template_items')
    .delete()
    .eq('id', itemId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/app/configuracoes/etapas')
  return { success: true }
}

export async function reorderTemplateItemsAction(
  templateId: string,
  orderedItemIds: string[]
) {
  const { supabase } = await requireAuth()

  const updates = orderedItemIds.map((id, index) =>
    supabase
      .from('stage_template_items')
      .update({ stage_order: index + 1 })
      .eq('id', id)
      .eq('stage_template_id', templateId)
  )

  await Promise.all(updates)

  revalidatePath('/app/configuracoes/etapas')
  return { success: true }
}
