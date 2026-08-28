import { requireAuth } from '@/lib/server/guard'
import Link from 'next/link'
import { ArrowLeft, KanbanSquare } from 'lucide-react'
import WorkflowStagesManager from '@/components/workflow/WorkflowStagesManager'
import { getWorkflowStagesAction } from '@/lib/actions/workflow-stages'

export default async function WorkflowStagesConfigPage() {
  const { supabase, user } = await requireAuth()

  // Busca a organização do usuário
  let { data: member } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  let orgId = member?.organization_id || ''

  if (!orgId) {
    const { data: org } = await supabase
      .from('organizations')
      .select('id')
      .eq('owner_id', user.id)
      .limit(1)
      .maybeSingle()

    if (org?.id) {
      orgId = org.id
    }
  }

  const { stages } = await getWorkflowStagesAction(orgId)

  return (
    <div className="max-w-5xl mx-auto space-y-6 antialiased">
      {/* Top Breadcrumb & Title */}
      <div className="flex items-center gap-3">
        <Link
          href="/app"
          className="p-2 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-blue-600 hover:bg-slate-50 transition-all shadow-2xs"
          title="Voltar para Início"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Etapas do Projeto
            </h1>
            <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
              Fluxo de Trabalho
            </span>
          </div>
          <p className="text-sm text-slate-500">
            Gerencie as colunas do Kanban e legendas do Gantt compartilhadas pelo escritório.
          </p>
        </div>
      </div>

      {/* CRUD Manager Component */}
      <WorkflowStagesManager
        organizationId={orgId}
        initialStages={stages}
      />
    </div>
  )
}
