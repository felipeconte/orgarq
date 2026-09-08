import { requireAuth } from '@/lib/server/guard'
import { getCompaniesAction } from '@/lib/actions/companies'
import CompaniesManagerClient from '@/components/companies/CompaniesManagerClient'

export const metadata = {
  title: 'Empresas & Serviços | Orgarq',
  description: 'Gestão de fornecedores, prestadores de serviços, vínculos com projetos e controle de comissões/RT',
}

export default async function EmpresasPage() {
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

  const res = await getCompaniesAction({ organizationId: orgId })
  const initialCompanies = res.companies || []

  return (
    <div className="space-y-6 antialiased max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Empresas & Prestadores de Serviços
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Cadastre parceiros, controle quais serviços estão em cada projeto e acompanhe o repasse de comissões (RT).
          </p>
        </div>
      </div>

      {/* Interactive Companies Manager */}
      <CompaniesManagerClient
        initialCompanies={initialCompanies}
        organizationId={orgId}
      />
    </div>
  )
}
