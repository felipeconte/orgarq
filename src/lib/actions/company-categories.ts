'use server'

import { revalidatePath } from 'next/cache'
import { requireAuth, requireOrgAccess } from '@/lib/server/guard'
import { sanitizeText } from '@/lib/server/sanitize'
import { COMPANY_CATEGORIES } from '@/types/companies'

export interface CategoryItem {
  id?: string
  name: string
  is_custom?: boolean
}

/**
 * 1. LISTAR TODAS AS CATEGORIAS / ESPECIALIDADES DA ORGANIZAÇÃO
 */
export async function getCompanyCategoriesAction(organizationId: string): Promise<{
  success: boolean
  categories: CategoryItem[]
  error?: string
}> {
  try {
    const { supabase } = await requireAuth()
    await requireOrgAccess(organizationId)

    // 1. Busca categorias customizadas salvas na tabela company_categories
    let dbCategories: { id: string; name: string }[] = []
    try {
      const { data, error } = await supabase
        .from('company_categories')
        .select('id, name')
        .eq('organization_id', organizationId)
        .order('name', { ascending: true })

      if (!error && data) {
        dbCategories = data
      }
    } catch {
      // Fallback gracioso se a migration 15 ainda não tiver sido executada
    }

    // 2. Busca categorias já em uso nas empresas cadastradas
    const { data: companies } = await supabase
      .from('companies')
      .select('categories')
      .eq('organization_id', organizationId)

    const usedInCompanies = new Set<string>()
    if (companies) {
      companies.forEach((c: any) => {
        if (Array.isArray(c.categories)) {
          c.categories.forEach((cat: string) => {
            if (cat && typeof cat === 'string') usedInCompanies.add(cat.trim())
          })
        }
      })
    }

    // 3. Monta o conjunto final consolidando: Padrões do Sistema + DB + Usadas em Empresas
    const dbCategoryMap = new Map<string, string>()
    dbCategories.forEach((cat) => {
      dbCategoryMap.set(cat.name.toLowerCase(), cat.id)
    })

    const finalMap = new Map<string, CategoryItem>()

    // Adiciona categorias padrão
    COMPANY_CATEGORIES.forEach((cat) => {
      const dbId = dbCategoryMap.get(cat.toLowerCase())
      finalMap.set(cat.toLowerCase(), {
        id: dbId,
        name: cat,
        is_custom: Boolean(dbId),
      })
    })

    // Adiciona categorias do banco de dados
    dbCategories.forEach((cat) => {
      finalMap.set(cat.name.toLowerCase(), {
        id: cat.id,
        name: cat.name,
        is_custom: true,
      })
    })

    // Adiciona quaisquer categorias históricas encontradas nas empresas
    usedInCompanies.forEach((cat) => {
      if (!finalMap.has(cat.toLowerCase())) {
        finalMap.set(cat.toLowerCase(), {
          name: cat,
          is_custom: true,
        })
      }
    })

    const result = Array.from(finalMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name, 'pt-BR')
    )

    return {
      success: true,
      categories: result,
    }
  } catch (err: any) {
    console.error('getCompanyCategoriesAction error:', err)
    return {
      success: false,
      categories: COMPANY_CATEGORIES.map((name) => ({ name, is_custom: false })),
      error: err?.message,
    }
  }
}

/**
 * 2. CRIAR NOVA CATEGORIA / ESPECIALIDADE
 */
export async function createCompanyCategoryAction(
  organizationId: string,
  name: string
): Promise<{
  success: boolean
  category?: CategoryItem
  error?: string
}> {
  try {
    const { supabase } = await requireAuth()
    await requireOrgAccess(organizationId)

    const cleanName = sanitizeText(name)?.trim()
    if (!cleanName || cleanName.length < 2) {
      return { success: false, error: 'O nome da categoria deve ter no mínimo 2 caracteres.' }
    }

    // Insere no banco
    try {
      const { data, error } = await supabase
        .from('company_categories')
        .insert({
          organization_id: organizationId,
          name: cleanName,
        })
        .select('id, name')
        .single()

      if (error) {
        // Se erro for de duplicidade (unique constraint)
        if (error.code === '23505') {
          return { success: true, category: { name: cleanName, is_custom: true } }
        }
        console.warn('Erro ao inserir company_categories:', error)
      } else if (data) {
        revalidatePath('/app/empresas')
        return { success: true, category: { id: data.id, name: data.name, is_custom: true } }
      }
    } catch (dbErr) {
      console.warn('Tabela company_categories não disponível:', dbErr)
    }

    revalidatePath('/app/empresas')
    return { success: true, category: { name: cleanName, is_custom: true } }
  } catch (err: any) {
    console.error('createCompanyCategoryAction error:', err)
    return { success: false, error: err?.message || 'Erro ao criar categoria.' }
  }
}

/**
 * 3. EDITAR NOME DE UMA CATEGORIA EXISTENTE
 */
export async function updateCompanyCategoryAction(
  organizationId: string,
  oldName: string,
  newName: string,
  categoryId?: string
): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const { supabase } = await requireAuth()
    await requireOrgAccess(organizationId)

    const cleanNewName = sanitizeText(newName)?.trim()
    const cleanOldName = sanitizeText(oldName)?.trim()

    if (!cleanNewName || cleanNewName.length < 2) {
      return { success: false, error: 'O novo nome da categoria deve ter no mínimo 2 caracteres.' }
    }

    if (!cleanOldName) {
      return { success: false, error: 'Nome anterior da categoria inválido.' }
    }

    // 1. Atualiza na tabela company_categories se existir
    try {
      if (categoryId) {
        await supabase
          .from('company_categories')
          .update({ name: cleanNewName, updated_at: new Date().toISOString() })
          .eq('id', categoryId)
          .eq('organization_id', organizationId)
      } else {
        await supabase
          .from('company_categories')
          .update({ name: cleanNewName, updated_at: new Date().toISOString() })
          .eq('organization_id', organizationId)
          .ilike('name', cleanOldName)
      }
    } catch {
      // Ignore se tabela não existir
    }

    // 2. Atualiza empresas que possuíam a categoria anterior
    const { data: companies } = await supabase
      .from('companies')
      .select('id, categories')
      .eq('organization_id', organizationId)

    if (companies) {
      for (const comp of companies) {
        if (Array.isArray(comp.categories) && comp.categories.includes(cleanOldName)) {
          const updatedCategories = comp.categories.map((c: string) =>
            c === cleanOldName ? cleanNewName : c
          )
          await supabase
            .from('companies')
            .update({ categories: updatedCategories })
            .eq('id', comp.id)
        }
      }
    }

    revalidatePath('/app/empresas')
    return { success: true }
  } catch (err: any) {
    console.error('updateCompanyCategoryAction error:', err)
    return { success: false, error: err?.message || 'Erro ao renomear categoria.' }
  }
}

/**
 * 4. EXCLUIR CATEGORIA / ESPECIALIDADE
 */
export async function deleteCompanyCategoryAction(
  organizationId: string,
  name: string,
  categoryId?: string
): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const { supabase } = await requireAuth()
    await requireOrgAccess(organizationId)

    const cleanName = sanitizeText(name)?.trim()

    // 1. Remove da tabela company_categories
    try {
      if (categoryId) {
        await supabase
          .from('company_categories')
          .delete()
          .eq('id', categoryId)
          .eq('organization_id', organizationId)
      } else if (cleanName) {
        await supabase
          .from('company_categories')
          .delete()
          .eq('organization_id', organizationId)
          .ilike('name', cleanName)
      }
    } catch {
      // Ignore se tabela não existir
    }

    // 2. Remove a categoria das empresas que a possuíam
    if (cleanName) {
      const { data: companies } = await supabase
        .from('companies')
        .select('id, categories')
        .eq('organization_id', organizationId)

      if (companies) {
        for (const comp of companies) {
          if (Array.isArray(comp.categories) && comp.categories.includes(cleanName)) {
            const updatedCategories = comp.categories.filter((c: string) => c !== cleanName)
            await supabase
              .from('companies')
              .update({ categories: updatedCategories })
              .eq('id', comp.id)
          }
        }
      }
    }

    revalidatePath('/app/empresas')
    return { success: true }
  } catch (err: any) {
    console.error('deleteCompanyCategoryAction error:', err)
    return { success: false, error: err?.message || 'Erro ao excluir categoria.' }
  }
}
