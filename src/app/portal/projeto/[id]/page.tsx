import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { Building2 } from 'lucide-react'
import { getClientPortalProjectDetailAction } from '@/lib/actions/client-portal-auth'
import PortalClient, { PortalData } from '@/components/portal/PortalClient'
import BackButton from '@/components/ui/BackButton'

export default async function CustomerProjectViewPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const res = await getClientPortalProjectDetailAction(id)

  if (!res.success || !res.data) {
    if (res.error === 'UNAUTHORIZED') {
      redirect('/portal/login')
    }
    notFound()
  }

  const { token, portalData } = res.data

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Top Client Navigation Header */}
      <div className="bg-slate-900 text-white px-6 py-2.5 border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <BackButton
            fallbackHref="/portal"
            label="Voltar para Todos os Meus Projetos"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-300 hover:text-white transition-colors cursor-pointer bg-transparent border-0 p-0 shadow-none"
            iconSize="w-3.5 h-3.5"
          />
          <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">
            Acompanhamento de Projeto — {portalData.project.code}
          </span>
        </div>
      </div>

      {/* Render Portal Client Timeline & Approvals */}
      <PortalClient token={token} data={portalData as unknown as PortalData} />
    </div>
  )
}
