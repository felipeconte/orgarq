import { redirect } from 'next/navigation'
import { getClientPortalDashboardDataAction, getClientPortalSession } from '@/lib/actions/client-portal-auth'
import ClientPortalDashboard from './ClientPortalDashboard'

export default async function CustomerPortalDashboardPage() {
  const session = await getClientPortalSession()
  if (!session) {
    redirect('/portal/login')
  }

  const res = await getClientPortalDashboardDataAction()

  if (!res.success || !res.data) {
    redirect('/portal/login')
  }

  return <ClientPortalDashboard data={res.data} />
}
