import { requireAuth } from '@/lib/server/guard'
import { getClientsAction } from '@/lib/actions/clients'
import ClientsManagerClient from '@/components/clients/ClientsManagerClient'

export const metadata = {
  title: 'Clientes | Orgarq',
  description: 'Gestão de clientes e vínculo de projetos arquitetônicos',
}

export default async function ClientesPage() {
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

  const res = await getClientsAction(orgId)
  const initialClients = res.clients || []

  return (
    <div className="space-y-6 antialiased max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Clientes & Contratantes
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Gerencie contatos, documentos e visualize todos os projetos vinculados a cada cliente.
          </p>
        </div>
      </div>

      {/* Interactive Clients Manager */}
      <ClientsManagerClient
        initialClients={initialClients}
        organizationId={orgId}
      />
    </div>
  )
}
