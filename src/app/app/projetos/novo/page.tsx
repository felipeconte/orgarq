import { requireAuth } from '@/lib/server/guard'
import Link from 'next/link'
import NewProjectForm from '@/components/projects/NewProjectForm'
import { getClientsAction } from '@/lib/actions/clients'
import BackButton from '@/components/ui/BackButton'

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>
}) {
  const { supabase, user } = await requireAuth()
  const { clientId } = await searchParams

  // Busca a organização do usuário
  let { data: member } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  let orgId = member?.organization_id || ''

  // Se não tiver registro de membro, verifica se existe organização onde é dono
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

  // Busca templates disponíveis para o escritório
  let templates: { id: string; name: string; description: string | null; is_default: boolean; count?: number }[] = []
  if (orgId) {
    const { data: tpls } = await supabase
      .from('stage_templates')
      .select('id, name, description, is_default, stage_template_items(id)')
      .eq('organization_id', orgId)
      .order('is_default', { ascending: false })

    if (tpls) {
      templates = tpls.map((t: any) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        is_default: t.is_default,
        count: Array.isArray(t.stage_template_items) ? t.stage_template_items.length : 0,
      }))
    }
  }

  // Busca clientes já cadastrados
  const clientsRes = await getClientsAction(orgId)
  const clientsList = clientsRes.clients || []

  return (
    <div className="max-w-4xl mx-auto space-y-6 antialiased">
      {/* Top Breadcrumb & Title */}
      <div className="flex items-center gap-3">
        <BackButton fallbackHref="/app/projetos" />
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Cadastrar Novo Projeto
          </h1>
          <p className="text-sm text-slate-500">
            Selecione um cliente cadastrado ou preencha as informações do projeto.
          </p>
        </div>
      </div>

      {/* Interactive New Project Form */}
      <NewProjectForm
        organizationId={orgId}
        userEmail={user.email}
        templates={templates}
        initialClients={clientsList}
        initialClientId={clientId}
      />
    </div>
  )
}
