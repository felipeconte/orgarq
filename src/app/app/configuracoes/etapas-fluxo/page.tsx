import { requireAuth } from '@/lib/server/guard'
import WorkflowStagesManager from '@/components/workflow/WorkflowStagesManager'
import { getWorkflowStagesAction } from '@/lib/actions/workflow-stages'
import BackButton from '@/components/ui/BackButton'

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
      <WorkflowStagesManager
        organizationId={orgId}
        initialStages={stages}
      >
        {/* Top Breadcrumb & Title */}
        <div className="flex items-center gap-3">
          <BackButton fallbackHref="/app" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                Etapas do Projeto
              </h1>
            </div>
            <p className="text-sm text-slate-500">
              Gerencie as colunas do Kanban e legendas do Gantt compartilhadas pelo escritório.
            </p>
          </div>
        </div>
      </WorkflowStagesManager>
    </div>
  )
}
