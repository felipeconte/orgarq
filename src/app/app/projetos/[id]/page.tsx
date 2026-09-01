import { requireProjectAccess } from '@/lib/server/guard'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import {
  ArrowLeft,
  FileText,
  ShieldCheck
} from 'lucide-react'
import ProjectHubClient from '@/components/projects/ProjectHubClient'
import { formatDateBR } from '@/lib/date-utils'
import { getWorkflowStagesAction } from '@/lib/actions/workflow-stages'

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

  // Busca as etapas do projeto
  const { data: stages } = await supabase
    .from('project_stages')
    .select('*')
    .eq('project_id', id)
    .order('stage_order', { ascending: true })

  // Busca etapas do fluxo configuradas para o escritório
  const { stages: workflowStages } = await getWorkflowStagesAction(project.organization_id)

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
  const totalStages = projectStages.length
  const completedStages = projectStages.filter((s) => {
    return (
      s.status === 'concluido' ||
      workflowStages?.find((ws) => ws.id === s.status)?.is_final_stage
    )
  }).length

  let progressSum = 0
  projectStages.forEach((st) => {
    const isFinal = Boolean(
      st.status === 'concluido' ||
      workflowStages?.find((ws) => ws.id === st.status)?.is_final_stage
    )
    if (isFinal) {
      progressSum += 100
    } else if (Array.isArray(st.checklist) && st.checklist.length > 0) {
      const done = st.checklist.filter((c: any) => c.completed).length
      progressSum += Math.round((done / st.checklist.length) * 100)
    } else if (st.status === 'em_producao' || st.status === 'em_andamento') {
      progressSum += Math.max(st.progress_percent || 0, 50)
    } else {
      progressSum += st.progress_percent || 0
    }
  })
  const progressPercent = totalStages > 0 ? Math.round(progressSum / totalStages) : 0

  return (
    <div className="space-y-6 antialiased">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/app/projetos"
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-blue-600 hover:bg-slate-50 transition-all shadow-2xs"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                {project.title}
              </h1>
              <span className="px-2.5 py-0.5 text-xs font-mono font-bold bg-slate-100 text-slate-700 rounded-lg">
                {project.code}
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-1.5">
              Cliente: <strong className="text-slate-700">{project.client_name}</strong> • {project.typology || 'Residencial'} • {project.area_sqm ? `${project.area_sqm} m²` : 'Área não definida'}
            </p>
          </div>
        </div>

        {/* Action Tabs & Portal Link */}
        <div className="flex items-center gap-2">
          <Link
            href={`/app/projetos/${id}/briefing`}
            className="inline-flex items-center gap-1.5 py-2 px-3.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:text-blue-600 hover:bg-slate-50 text-xs font-bold transition-all shadow-xs"
          >
            <FileText className="w-3.5 h-3.5" /> Ficha de Briefing
          </Link>

          <Link
            href={`/app/projetos/${id}/auditoria`}
            className="inline-flex items-center gap-1.5 py-2 px-3.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:text-blue-600 hover:bg-slate-50 text-xs font-bold transition-all shadow-xs"
          >
            <ShieldCheck className="w-3.5 h-3.5" /> Auditoria de Aprovações
          </Link>
        </div>
      </div>

      {/* Progress Bar & Summary */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <div>
            <span className="text-xs text-slate-400 font-semibold block">Status das Tarefas</span>
            <span className="text-lg font-bold text-slate-800">
              {completedStages} de {totalStages} concluídas
            </span>
          </div>

          <div className="hidden sm:block h-8 w-px bg-slate-200" />

          <div>
            <span className="text-xs text-slate-400 font-semibold block">Prazo Final</span>
            <span className="text-xs font-bold text-slate-700">
              {formatDateBR(project.deadline) || 'Não informado'}
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="flex items-center gap-3">
          <div className="w-48 bg-slate-100 h-3 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-blue-500 to-indigo-600 h-full rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="font-mono text-xs font-extrabold text-blue-600">
            {progressPercent}%
          </span>
        </div>
      </div>

      {/* Interactive Project Hub (List / Kanban Drag & Drop / Gantt + Task Drawer) */}
      <ProjectHubClient
        projectId={id}
        organizationId={project.organization_id}
        stages={projectStages}
        portalToken={portalToken}
        members={membersList}
        initialWorkflowStages={workflowStages}
        initialView={initialView}
      />
    </div>
  )
}
