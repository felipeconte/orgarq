import { requireAuth } from '@/lib/server/guard'
import ProjectsManagerClient, { ProjectItem } from '@/components/projects/ProjectsManagerClient'

export default async function ProjectsListPage() {
  const { supabase, user } = await requireAuth()

  // 1. Busca todas as organizações onde o usuário é membro
  const { data: memberRows } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)

  const memberOrgIds = (memberRows || []).map((m) => m.organization_id).filter(Boolean)

  // 2. Busca todas as organizações onde o usuário é proprietário
  const { data: ownerRows } = await supabase
    .from('organizations')
    .select('id')
    .eq('owner_id', user.id)

  const ownerOrgIds = (ownerRows || []).map((o) => o.id).filter(Boolean)

  const allOrgIds = Array.from(new Set([...memberOrgIds, ...ownerOrgIds]))

  // 3. Busca todos os projetos vinculados às organizações do usuário ou criados por ele
  let projectsQuery = supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false })

  if (allOrgIds.length > 0) {
    projectsQuery = projectsQuery.or(
      `organization_id.in.(${allOrgIds.join(',')}),created_by.eq.${user.id}`
    )
  } else {
    projectsQuery = projectsQuery.eq('created_by', user.id)
  }

  const { data: projs } = await projectsQuery

  // 4. Busca todos os clientes cadastrados das organizações
  let clientsQuery = supabase
    .from('clients')
    .select('*')
    .not('name', 'ilike', '%Julian%')
    .order('name', { ascending: true })

  if (allOrgIds.length > 0) {
    clientsQuery = clientsQuery.in('organization_id', allOrgIds)
  }

  const { data: clientsData } = await clientsQuery
  const clients = (clientsData || []) as any[]

  // 5. Busca vínculos da tabela project_clients
  const { data: pcData } = await supabase
    .from('project_clients')
    .select('project_id, client_id')

  const projectClientsMap = new Map<string, string[]>()
  ;(pcData || []).forEach((pc) => {
    const list = projectClientsMap.get(pc.project_id) || []
    list.push(pc.client_id)
    projectClientsMap.set(pc.project_id, list)
  })

  const projects = (projs || []).map((p: any) => ({
    ...p,
    client_ids: projectClientsMap.get(p.id) || (p.client_id ? [p.client_id] : []),
  })) as unknown as ProjectItem[]

  return (
    <ProjectsManagerClient
      initialProjects={projects}
      initialClients={clients}
      organizationId={allOrgIds[0]}
    />
  )
}
