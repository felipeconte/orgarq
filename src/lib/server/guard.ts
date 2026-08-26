/**
 * ==============================================================================
 * ORGARQ - Server Security Guard & IDOR Prevention
 * ==============================================================================
 * Garante que regras de negócio, autenticação e validações de tenant/ownership
 * sejam executadas exclusivamente no servidor antes de qualquer consulta ou mutação.
 */

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Database } from '@/types/database.types'

type MemberRow = Database['public']['Tables']['organization_members']['Row']
type ProjectRow = Database['public']['Tables']['projects']['Row']

export interface AuthenticatedUser {
  id: string
  email: string
  user_metadata?: Record<string, any>
}

/**
 * 1. Exige autenticação válida do usuário no servidor.
 */
export async function requireAuth(): Promise<{ supabase: Awaited<ReturnType<typeof createClient>>; user: AuthenticatedUser }> {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user || !user.id) {
    redirect('/login')
  }

  return {
    supabase,
    user: {
      id: user.id,
      email: user.email || '',
      user_metadata: user.user_metadata || {},
    },
  }
}


/**
 * 2. Prevenção de IDOR: Valida se o usuário autenticado é membro ativo ou proprietário da organização.
 */
export async function requireOrgAccess(organizationId: string) {
  const { supabase, user } = await requireAuth()

  // 1. Verifica se o usuário é membro registrado da organização
  const { data: memberData } = await supabase
    .from('organization_members')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('user_id', user.id)
    .maybeSingle()

  const member = memberData as MemberRow | null
  if (member) {
    return { supabase, user, memberRole: member.role }
  }

  // 2. Se não estiver em organization_members, verifica se é o proprietário (owner_id) da organização
  const { data: orgData } = await supabase
    .from('organizations')
    .select('id, owner_id')
    .eq('id', organizationId)
    .eq('owner_id', user.id)
    .maybeSingle()

  if (orgData) {
    // Auto-associa como owner na tabela de membros para manter consistência
    await supabase.from('organization_members').upsert(
      {
        organization_id: organizationId,
        user_id: user.id,
        role: 'owner',
      },
      { onConflict: 'organization_id,user_id' }
    )

    return { supabase, user, memberRole: 'owner' as const }
  }

  throw new Error('Acesso negado: Você não possui permissão para acessar esta organização (IDOR Blocked).')
}

/**
 * 3. Prevenção de IDOR: Valida se o projeto pertence a uma organização do usuário autenticado ou foi criado por ele.
 */
export async function requireProjectAccess(projectId: string) {
  const { supabase, user } = await requireAuth()

  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .maybeSingle()

  const project = data as ProjectRow | null

  if (error || !project) {
    throw new Error('Acesso negado: Projeto não encontrado (IDOR Blocked).')
  }

  // Se o usuário foi o criador do projeto diretamente
  if (project.created_by === user.id) {
    let memberRole: any = 'owner'
    try {
      const orgAccess = await requireOrgAccess(project.organization_id)
      memberRole = orgAccess.memberRole
    } catch {
      // Garante permissão para o criador
    }
    return { supabase, user, project, memberRole }
  }

  // Valida que o usuário é membro ou proprietário da organização proprietária do projeto
  const { memberRole } = await requireOrgAccess(project.organization_id)

  return { supabase, user, project, memberRole }
}
