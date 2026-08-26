import { notFound } from 'next/navigation'
import { getPortalDataAction } from '@/lib/actions/portal'
import PortalClient, { PortalData } from '@/components/portal/PortalClient'

export default async function CustomerPortalPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const res = await getPortalDataAction(token)

  if (res.error || !res.data) {
    notFound()
  }

  const portalData = res.data as unknown as PortalData

  return <PortalClient token={token} data={portalData} />
}
