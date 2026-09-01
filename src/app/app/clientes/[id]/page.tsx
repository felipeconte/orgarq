import { notFound } from 'next/navigation'
import { requireAuth } from '@/lib/server/guard'
import { getClientByIdAction } from '@/lib/actions/clients'
import ClientDetailClient from '@/components/clients/ClientDetailClient'

export const metadata = {
  title: 'Detalhes do Cliente | Orgarq',
  description: 'Visualização de cadastro e projetos vinculados ao cliente',
}

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { user } = await requireAuth()
  const { id } = await params

  const res = await getClientByIdAction(id)
  if (!res.success || !res.client) {
    notFound()
  }

  return (
    <ClientDetailClient
      client={res.client}
      projects={res.projects || []}
      organizationId={res.client.organization_id}
    />
  )
}
