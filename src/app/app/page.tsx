import { requireAuth } from '@/lib/server/guard'
import { getFinancialSummaryAction } from '@/lib/actions/financial'
import OverviewDashboardClient, {
  DashboardProject,
  DashboardFinancialSummary,
} from '@/components/dashboard/OverviewDashboardClient'

export const metadata = {
  title: 'Visão Geral | Orgarq',
  description: 'Painel executivo do escritório de arquitetura com projetos, aprovações de clientes e controle financeiro.',
}

export default async function DashboardPage() {
  const { supabase, user } = await requireAuth()

  // 1. Busca todas as organizações onde o usuário é membro ou owner
  const { data: memberOrgs } = await supabase
    .from('organization_members')
    .select('organization_id, role, organizations(id, name, slug)')
    .eq('user_id', user.id)

  const { data: ownedOrgs } = await supabase
    .from('organizations')
    .select('id, name, slug')
    .eq('owner_id', user.id)

  const orgIdsSet = new Set<string>()
  let officeName = 'Meu Escritório'
  let primaryOrgId = ''

  if (ownedOrgs && ownedOrgs.length > 0) {
    ownedOrgs.forEach((o) => {
      orgIdsSet.add(o.id)
      if (!primaryOrgId) {
        primaryOrgId = o.id
        officeName = o.name || officeName
      }
    })
  }

  if (memberOrgs && memberOrgs.length > 0) {
    memberOrgs.forEach((m: any) => {
      orgIdsSet.add(m.organization_id)
      if (!primaryOrgId) {
        primaryOrgId = m.organization_id
        officeName = m.organizations?.name || officeName
      }
    })
  }

  const allOrgIds = Array.from(orgIdsSet)

  // 2. Busca perfil do usuário
  const { data: dbProfile } = await supabase
    .from('user_profiles')
    .select('full_name, display_name')
    .eq('user_id', user.id)
    .maybeSingle()

  const meta = user.user_metadata || {}
  const userDisplayName =
    dbProfile?.full_name ||
    dbProfile?.display_name ||
    meta.full_name ||
    meta.display_name ||
    user.email?.split('@')[0] ||
    'Arquiteto'

  // 3. Monta consulta de projetos com etapas aninhadas
  let query = supabase
    .from('projects')
    .select(`
      id,
      code,
      title,
      client_name,
      client_email,
      typology,
      status,
      area_sqm,
      deadline,
      created_at,
      project_stages (
        id,
        name,
        code,
        stage_order,
        status,
        progress_percent,
        due_date,
        is_client_approval_required,
        deleted_at
      )
    `)
    .order('created_at', { ascending: false })

  if (allOrgIds.length > 0) {
    query = query.or(`organization_id.in.(${allOrgIds.join(',')}),created_by.eq.${user.id}`)
  } else {
    query = query.eq('created_by', user.id)
  }

  const { data: projs, error: projsError } = await query

  if (projsError) {
    console.error('Erro ao buscar projetos no dashboard:', projsError)
  }

  const rawProjects = projs || []

  // 4. Busca tokens ativos do Portal do Cliente para ações rápidas de cópia
  const projectIds = rawProjects.map((p) => p.id)
  const tokensMap = new Map<string, string>()

  if (projectIds.length > 0) {
    const { data: tokens } = await supabase
      .from('client_access_tokens')
      .select('project_id, token')
      .in('project_id', projectIds)
      .eq('is_revoked', false)

    if (tokens) {
      tokens.forEach((t) => {
        if (t.project_id && t.token) {
          tokensMap.set(t.project_id, t.token)
        }
      })
    }
  }

  // 5. Busca dados consolidados do financeiro (se houver organização)
  let financialSummary: DashboardFinancialSummary | null = null

  if (primaryOrgId) {
    try {
      const summaryRes = await getFinancialSummaryAction({ organizationId: primaryOrgId })
      if (summaryRes.success && summaryRes.summary) {
        financialSummary = summaryRes.summary as unknown as DashboardFinancialSummary
      }
    } catch (err) {
      console.error('Erro ao buscar resumo financeiro no dashboard:', err)
    }
  }

  // 6. Formata projetos para o componente cliente
  const projects: DashboardProject[] = rawProjects.map((p: any) => ({
    id: p.id,
    code: p.code,
    title: p.title,
    client_name: p.client_name,
    client_email: p.client_email,
    typology: p.typology,
    status: p.status || 'ativo',
    area_sqm: p.area_sqm,
    deadline: p.deadline,
    created_at: p.created_at,
    project_stages: (p.project_stages || []).filter((s: any) => !s.deleted_at),
    portalToken: tokensMap.get(p.id) || null,
  }))

  return (
    <OverviewDashboardClient
      officeName={officeName}
      userDisplayName={userDisplayName}
      projects={projects}
      financialSummary={financialSummary}
      hasPrimaryOrg={Boolean(primaryOrgId)}
    />
  )
}
