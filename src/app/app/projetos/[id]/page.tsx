import { requireProjectAccess } from '@/lib/server/guard'
import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import ProjectHubClient from '@/components/projects/ProjectHubClient'
import { getWorkflowStagesAction } from '@/lib/actions/workflow-stages'
import { BreadcrumbSetter } from '@/contexts/BreadcrumbContext'
import ProjectDetailHeader from '@/components/projects/ProjectDetailHeader'
import type { ProjectItem } from '@/components/projects/ProjectsManagerClient'

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ view?: string }>
}) {
  const { id } = await params
  const { view } = (await searchParams) || {}
  const { supabase, project, user } = await requireProjectAccess(id)

  if (!project) {
    notFound()
  }

  // Identifica a visão inicial (URL searchParams > Cookie > 'lista')
  const validViews = ['lista', 'kanban', 'gantt'] as const
  type ViewType = typeof validViews[number]

  const cookieStore = await cookies()
  const cookieView =
    cookieStore.get(`orgarq_project_view_${id}`)?.value ||
    cookieStore.get('orgarq_last_view')?.value

  let initialView: ViewType = 'lista'
  if (view && (validViews as readonly string[]).includes(view)) {
    initialView = view as ViewType
  } else if (cookieView && (validViews as readonly string[]).includes(cookieView)) {
    initialView = cookieView as ViewType
  }

  // Busca as etapas ativas do projeto (exclui soft-deleted)
  const { data: stages } = await supabase
    .from('project_stages')
    .select('*')
    .eq('project_id', id)
    .is('deleted_at', null)
    .order('stage_order', { ascending: true })

  // Busca tarefas excluídas para histórico e pesquisa de códigos
  const { data: rawDeletedStages } = await (supabase
    .from('project_stages') as any)
    .select('id, name, code, deleted_at, deleted_by, created_at, status')
    .eq('project_id', id)
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })

  // Busca etapas do fluxo configuradas para o escritório
  const { stages: workflowStages } = await getWorkflowStagesAction(project.organization_id)

  // Busca clientes da organização para o modal de edição
  const { data: clientsData } = await supabase
    .from('clients')
    .select('*')
    .eq('organization_id', project.organization_id)
    .order('name', { ascending: true })

  // Busca vínculos múltiplos de clientes do projeto
  const { data: pcData } = await supabase
    .from('project_clients')
    .select('client_id')
    .eq('project_id', id)

  const projectWithClientIds = {
    ...project,
    client_ids: pcData?.map((pc) => pc.client_id) || (project.client_id ? [project.client_id] : []),
  } as unknown as ProjectItem

  // 1. Busca membros da organização para delegação/responsáveis
  const { data: orgMembers } = await supabase
    .from('organization_members')
    .select('user_id, role')
    .eq('organization_id', project.organization_id)

  const memberUserIds = (orgMembers || []).map((m) => m.user_id)
  if (!memberUserIds.includes(user.id)) {
    memberUserIds.push(user.id)
  }

  // 2. Busca os perfis (Nome de Exibição, Avatar) de todos os membros
  const { data: userProfiles } = await supabase
    .from('user_profiles')
    .select('user_id, full_name, display_name, avatar_url')
    .in('user_id', memberUserIds)

  const profileMap = new Map<string, { name: string; avatarUrl?: string | null }>()
  userProfiles?.forEach((p) => {
    const name = p.display_name || p.full_name
    if (name) {
      profileMap.set(p.user_id, { name, avatarUrl: p.avatar_url })
    }
  })

  // 3. Monta a lista com o Nome de Exibição formatado
  const membersList = (orgMembers || []).map((m) => {
    const profile = profileMap.get(m.user_id)
    const isSelf = m.user_id === user.id
    const currentMetaName = isSelf ? (user.user_metadata?.display_name || user.user_metadata?.full_name) : null
    const baseName = profile?.name || currentMetaName || (isSelf ? (user.email?.split('@')[0] || 'Você') : 'Membro da Equipe')
    const finalName = isSelf && !baseName.includes('(Você)') ? `${baseName} (Você)` : baseName

    return {
      id: m.user_id,
      name: finalName,
      role: m.role,
      avatarUrl: profile?.avatarUrl || (isSelf ? user.user_metadata?.avatar_url : null),
    }
  })

  // Garante que o usuário logado está na lista
  if (!membersList.some((m) => m.id === user.id)) {
    const selfProfile = profileMap.get(user.id)
    const selfName = selfProfile?.name || user.user_metadata?.display_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Você'
    membersList.unshift({
      id: user.id,
      name: `${selfName} (Você)`,
      role: 'owner',
      avatarUrl: selfProfile?.avatarUrl || user.user_metadata?.avatar_url || null,
    })
  }


  // Busca ou cria o token do portal do cliente diretamente no servidor
  const { data: existingToken } = await supabase
    .from('client_access_tokens')
    .select('token')
    .eq('project_id', id)
    .eq('is_revoked', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let portalToken = existingToken?.token || ''

  if (!portalToken) {
    const { data: newToken } = await supabase
      .from('client_access_tokens')
      .insert({ project_id: id })
      .select('token')
      .single()

    portalToken = newToken?.token || ''
  }

  const projectStages = (stages || []) as any[]

  return (
    <div className="space-y-6 antialiased">
      <BreadcrumbSetter
        items={[
          { label: 'Escritório', href: '/app' },
          { label: 'Projetos', href: '/app/projetos' },
          { label: project.title },
        ]}
      />
      {/* Header com Informações, Botão de Edição e Abas de Ação */}
      <ProjectDetailHeader
        project={projectWithClientIds}
        clients={(clientsData || []) as any[]}
        organizationId={project.organization_id}
        projectId={id}
      />


      {/* Interactive Project Hub (List / Kanban Drag & Drop / Gantt + Task Drawer) */}
      <ProjectHubClient
        projectId={id}
        organizationId={project.organization_id}
        stages={projectStages}
        portalToken={portalToken}
        members={membersList}
        initialWorkflowStages={workflowStages}
        initialView={initialView}
        initialDeletedStages={(rawDeletedStages || []).map((ds: any) => ({
          id: ds.id,
          name: ds.name,
          code: ds.code || null,
          deleted_at: ds.deleted_at,
          deleted_by: ds.deleted_by || null,
          deleted_by_name: ds.deleted_by ? (profileMap.get(ds.deleted_by)?.name || 'Membro da equipe') : 'Sistema',
          created_at: ds.created_at,
          status: ds.status,
        }))}
      />
    </div>
  )
}
