import { requireAuth } from '@/lib/server/guard'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import NewProjectForm from '@/components/projects/NewProjectForm'

export default async function NewProjectPage() {
  const { supabase, user } = await requireAuth()

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

  return (
    <div className="max-w-4xl mx-auto space-y-6 antialiased">
      {/* Top Breadcrumb & Title */}
      <div className="flex items-center gap-3">
        <Link
          href="/app/projetos"
          className="p-2 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-blue-600 hover:bg-slate-50 transition-all shadow-2xs"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Cadastrar Novo Projeto
          </h1>
          <p className="text-sm text-slate-500">
            Nem todos os campos são obrigatórios.
          </p>
        </div>
      </div>

      {/* Interactive New Project Form */}
      <NewProjectForm organizationId={orgId} userEmail={user.email} templates={templates} />
    </div>
  )
}
