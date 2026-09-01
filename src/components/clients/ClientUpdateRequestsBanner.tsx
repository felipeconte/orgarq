'use client'

import { useState, useEffect } from 'react'
import {
  BellRing,
  ChevronRight,
  UserCheck,
  Sparkles,
  ArrowRight,
} from 'lucide-react'
import {
  ClientUpdateRequestItem,
  getPendingClientUpdateRequestsAction,
} from '@/lib/actions/client-update-requests'
import ClientUpdateRequestReviewModal from './ClientUpdateRequestReviewModal'

export default function ClientUpdateRequestsBanner({
  onRefreshClients,
}: {
  onRefreshClients?: () => void
}) {
  const [requests, setRequests] = useState<ClientUpdateRequestItem[]>([])
  const [selectedRequest, setSelectedRequest] = useState<ClientUpdateRequestItem | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchRequests = async () => {
    setLoading(true)
    const res = await getPendingClientUpdateRequestsAction()
    if (res.success && res.data) {
      setRequests(res.data.requests)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchRequests()
  }, [])

  if (loading || requests.length === 0) return null

  const count = requests.length

  return (
    <>
      <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/90 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold shadow-xs shrink-0 animate-bounce">
            <BellRing className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold text-amber-950">
                {count === 1
                  ? '1 cliente solicitou atualização cadastral'
                  : `${count} clientes solicitaram atualização cadastral`}
              </h4>
              <span className="px-2 py-0.5 rounded-full bg-amber-200/80 text-amber-900 font-bold text-[10px]">
                Pendente
              </span>
            </div>
            <p className="text-[11px] text-amber-800/80">
              O cliente alterou suas informações pessoais no Portal e solicitou que os dados deste escritório sejam atualizados.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {requests.length === 1 ? (
            <button
              type="button"
              onClick={() => setSelectedRequest(requests[0])}
              className="py-2 px-3.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              Revisar Alterações <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {requests.slice(0, 3).map((req) => (
                <button
                  key={req.id}
                  type="button"
                  onClick={() => setSelectedRequest(req)}
                  className="py-1.5 px-3 rounded-xl bg-white hover:bg-amber-100/60 border border-amber-300 text-amber-900 text-xs font-bold transition-all cursor-pointer truncate max-w-[160px]"
                >
                  {req.client?.name || req.requested_data.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal de Revisão */}
      <ClientUpdateRequestReviewModal
        request={selectedRequest}
        onClose={() => setSelectedRequest(null)}
        onReviewed={() => {
          fetchRequests()
          if (onRefreshClients) onRefreshClients()
        }}
      />
    </>
  )
}
