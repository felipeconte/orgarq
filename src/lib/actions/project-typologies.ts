'use server'

import { revalidatePath } from 'next/cache'
import { requireAuth, requireOrgAccess } from '@/lib/server/guard'
import { sanitizeText } from '@/lib/server/sanitize'
import { DEFAULT_PROJECT_TYPOLOGIES, ProjectTypologyItem } from '@/types/typologies'

/**
 * 1. LISTAR TODAS AS TIPOLOGIAS DE PROJETOS DA ORGANIZAÇÃO
 */
export async function getProjectTypologiesAction(organizationId: string): Promise<{
  success: boolean
  typologies: ProjectTypologyItem[]
  error?: string
}> {
  try {
    if (!organizationId) {
      return {
        success: true,
        typologies: DEFAULT_PROJECT_TYPOLOGIES.map((name) => ({
          name,
          is_custom: false,
          project_count: 0,
        })),
      }
    }

    const { supabase } = await requireAuth()
    await requireOrgAccess(organizationId)

    // 1. Busca tipologias salvas na tabela project_typologies
    let dbTypologies: { id: string; name: string }[] = []
    try {
      const { data, error } = await supabase
        .from('project_typologies')
        .select('id, name')
        .eq('organization_id', organizationId)
        .order('name', { ascending: true })

      if (!error && data) {
        dbTypologies = data
      }
    } catch {
      // Fallback gracioso
    }

    // 2. Busca contagem de projetos agrupados por tipologia preservando grafia original
    const projectCounts = new Map<string, { count: number; originalName: string }>()
    try {
      const { data: projects } = await supabase
        .from('projects')
        .select('typology')
        .eq('organization_id', organizationId)

      if (projects) {
        projects.forEach((p: { typology: string | null }) => {
          if (p.typology && typeof p.typology === 'string') {
            const raw = p.typology.trim()
            if (raw) {
              const key = raw.toLowerCase()
              const existing = projectCounts.get(key)
              if (existing) {
                existing.count += 1
              } else {
                projectCounts.set(key, { count: 1, originalName: raw })
              }
            }
          }
        })
      }
    } catch (err) {
      console.warn('Erro ao contar projetos por tipologia:', err)
    }

    // 3. Se a organização ainda não possui nenhuma tipologia cadastrada no banco, semeia as 3 padrões
    if (dbTypologies.length === 0) {
      try {
        const seedPayload = DEFAULT_PROJECT_TYPOLOGIES.map((name) => ({
          organization_id: organizationId,
          name,
        }))
        const { data: seeded, error: seedError } = await supabase
          .from('project_typologies')
          .insert(seedPayload)
          .select('id, name')

        if (!seedError && seeded) {
          dbTypologies = seeded
        }
      } catch {
        // Se falhar o seed, continuaremos com os valores em memória
      }
    }

    // 4. Consolida mapa de tipologias
    const typologyMap = new Map<string, ProjectTypologyItem>()

    if (dbTypologies.length === 0) {
      // Se não há tipologias no DB ainda (ex: antes do seed ou fallback), usa os padrões
      DEFAULT_PROJECT_TYPOLOGIES.forEach((name) => {
        const lower = name.toLowerCase()
        typologyMap.set(lower, {
          name,
          is_custom: false,
          project_count: projectCounts.get(lower)?.count || 0,
        })
      })
    } else {
      // Se há tipologias cadastradas no DB, respeita RIGOROSAMENTE o catálogo do banco (sem reinserir deletadas)
      dbTypologies.forEach((t) => {
        const lower = t.name.toLowerCase()
        typologyMap.set(lower, {
          id: t.id,
          name: t.name,
          is_custom: true,
          project_count: projectCounts.get(lower)?.count || 0,
        })
      })
    }

    // Adiciona quaisquer tipologias legadas encontradas em projetos existentes com a grafia original exata
    projectCounts.forEach((item, lower) => {
      if (!typologyMap.has(lower)) {
        typologyMap.set(lower, {
          name: item.originalName,
          is_custom: true,
          project_count: item.count,
        })
      }
    })

    const typologies = Array.from(typologyMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name, 'pt-BR')
    )

    return {
      success: true,
      typologies,
    }
  } catch (err: any) {
    console.error('Erro em getProjectTypologiesAction:', err)
    return {
      success: false,
      typologies: DEFAULT_PROJECT_TYPOLOGIES.map((name) => ({
        name,
        is_custom: false,
        project_count: 0,
      })),
      error: err?.message || 'Erro ao carregar tipologias.',
    }
  }
}

/**
 * 2. CRIAR NOVA TIPOLOGIA DE PROJETO
 */
export async function createProjectTypologyAction(
  organizationId: string,
  name: string
): Promise<{
  success: boolean
  typology?: ProjectTypologyItem
  error?: string
}> {
  try {
    const { supabase } = await requireAuth()
    await requireOrgAccess(organizationId)

    const cleanName = sanitizeText(name)
    if (!cleanName || cleanName.length < 2) {
      return { success: false, error: 'O nome da tipologia deve ter pelo menos 2 caracteres.' }
    }

    // 1. Verifica se já existe na organização
    const { data: existing } = await supabase
      .from('project_typologies')
      .select('id, name')
      .eq('organization_id', organizationId)
      .ilike('name', cleanName)
      .maybeSingle()

    if (existing) {
      return {
        success: true,
        typology: {
          id: existing.id,
          name: existing.name,
          is_custom: true,
          project_count: 0,
        },
      }
    }

    // 2. Insere na tabela
    const { data, error } = await supabase
      .from('project_typologies')
      .insert({
        organization_id: organizationId,
        name: cleanName,
      })
      .select('id, name')
      .single()

    if (error) {
      return { success: false, error: 'Erro ao cadastrar tipologia: ' + error.message }
    }

    revalidatePath('/app/projetos')
    revalidatePath('/app')

    return {
      success: true,
      typology: {
        id: data.id,
        name: data.name,
        is_custom: true,
        project_count: 0,
      },
    }
  } catch (err: any) {
    console.error('Erro em createProjectTypologyAction:', err)
    return { success: false, error: err?.message || 'Erro inesperado ao cadastrar tipologia.' }
  }
}

/**
 * 3. ATUALIZAR / RENOMEAR TIPOLOGIA (PROPAGA EM CASCATA PARA OS PROJETOS EXISTENTES)
 */
export async function updateProjectTypologyAction(
  organizationId: string,
  oldName: string,
  newName: string,
  id?: string
): Promise<{
  success: boolean
  countUpdated?: number
  error?: string
}> {
  try {
    const { supabase } = await requireAuth()
    await requireOrgAccess(organizationId)

    const cleanNew = sanitizeText(newName)
    const cleanOld = sanitizeText(oldName)

    if (!cleanNew || cleanNew.length < 2) {
      return { success: false, error: 'O novo nome da tipologia deve ter pelo menos 2 caracteres.' }
    }

    // 1. Atualiza na tabela project_typologies
    if (id) {
      await supabase
        .from('project_typologies')
        .update({ name: cleanNew, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('organization_id', organizationId)
    } else {
      // Se não tinha ID (ex: default inicial), tenta atualizar ou criar com o novo nome
      const { data: existing } = await supabase
        .from('project_typologies')
        .select('id')
        .eq('organization_id', organizationId)
        .ilike('name', cleanOld)
        .maybeSingle()

      if (existing) {
        await supabase
          .from('project_typologies')
          .update({ name: cleanNew, updated_at: new Date().toISOString() })
          .eq('id', existing.id)
      } else {
        await supabase.from('project_typologies').insert({
          organization_id: organizationId,
          name: cleanNew,
        })
      }
    }

    // 2. Atualiza em cascata nos projetos vinculados (case-insensitive para garantir migração de qualquer variação)
    const { data: updatedProjects, error: updateProjErr } = await supabase
      .from('projects')
      .update({ typology: cleanNew })
      .eq('organization_id', organizationId)
      .ilike('typology', cleanOld)
      .select('id')

    if (updateProjErr) {
      console.warn('Erro ao atualizar projetos em cascata:', updateProjErr)
    }

    revalidatePath('/app/projetos')
    revalidatePath('/app')

    return {
      success: true,
      countUpdated: updatedProjects?.length || 0,
    }
  } catch (err: any) {
    console.error('Erro em updateProjectTypologyAction:', err)
    return { success: false, error: err?.message || 'Erro inesperado ao renomear tipologia.' }
  }
}

/**
 * 4. EXCLUIR TIPOLOGIA COM REATRIBUIÇÃO OBRIGATÓRIA DOS PROJETOS VINCULADOS
 */
export async function deleteProjectTypologyAction(
  organizationId: string,
  name: string,
  replacementTypology: string,
  id?: string
): Promise<{
  success: boolean
  countMigrated?: number
  error?: string
}> {
  try {
    const { supabase } = await requireAuth()
    await requireOrgAccess(organizationId)

    const cleanTarget = sanitizeText(name)
    const cleanReplacement = sanitizeText(replacementTypology)

    if (!cleanReplacement) {
      return {
        success: false,
        error: 'É necessário selecionar para qual outra tipologia os projetos vinculados devem ser transferidos.',
      }
    }

    if (cleanTarget.toLowerCase() === cleanReplacement.toLowerCase()) {
      return {
        success: false,
        error: 'A tipologia de destino deve ser diferente da tipologia sendo excluída.',
      }
    }

    // 1. Migra todos os projetos com a tipologia antiga para a nova selecionada (case-insensitive)
    const { data: migratedProjects, error: migrateErr } = await supabase
      .from('projects')
      .update({ typology: cleanReplacement })
      .eq('organization_id', organizationId)
      .ilike('typology', cleanTarget)
      .select('id')

    if (migrateErr) {
      return {
        success: false,
        error: 'Falha ao migrar projetos vinculados: ' + migrateErr.message,
      }
    }

    // 2. Exclui da tabela project_typologies por ID e por Nome
    if (id) {
      await supabase
        .from('project_typologies')
        .delete()
        .eq('id', id)
        .eq('organization_id', organizationId)
    }
    await supabase
      .from('project_typologies')
      .delete()
      .eq('organization_id', organizationId)
      .ilike('name', cleanTarget)

    revalidatePath('/app/projetos')
    revalidatePath('/app')

    return {
      success: true,
      countMigrated: migratedProjects?.length || 0,
    }
  } catch (err: any) {
    console.error('Erro em deleteProjectTypologyAction:', err)
    return { success: false, error: err?.message || 'Erro inesperado ao excluir tipologia.' }
  }
}
