'use client'

import { useState } from 'react'
import {
  UserCheck,
  Check,
  X,
  AlertCircle,
  Clock,
  Loader2,
  Building,
  User,
  Mail,
  Phone,
  MapPin,
  CheckCircle2,
} from 'lucide-react'
import {
  ClientUpdateRequestItem,
  reviewClientUpdateRequestAction,
} from '@/lib/actions/client-update-requests'
import { maskCPF, maskPhone, maskCEP } from '@/lib/formatters-and-validators'

export interface ClientUpdateRequestReviewModalProps {
  request: ClientUpdateRequestItem | null
  onClose: () => void
  onReviewed: () => void
}

export default function ClientUpdateRequestReviewModal({
  request,
  onClose,
  onReviewed,
}: ClientUpdateRequestReviewModalProps) {
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [showRejectInput, setShowRejectInput] = useState(false)

  if (!request) return null

  const cur = (request.current_data || {}) as any
  const req = (request.requested_data || {}) as any

  const handleReview = async (action: 'approve' | 'reject') => {
    setLoading(true)
    setErrorMessage(null)

    const res = await reviewClientUpdateRequestAction(
      request.id,
      action,
      action === 'reject' ? rejectionReason : undefined
    )

    if (res.success) {
      onReviewed()
      onClose()
    } else {
      setErrorMessage(res.error || 'Erro ao processar a solicitação.')
      setLoading(false)
    }
  }

  const fields: Array<{ label: string; curVal: string | null | undefined; reqVal: string | null | undefined; isDiff: boolean }> = [
    {
      label: 'Nome',
      curVal: cur.name,
      reqVal: req.name,
      isDiff: cur.name !== req.name,
    },
    {
      label: 'E-mail',
      curVal: cur.email,
      reqVal: req.email,
      isDiff: (cur.email || '') !== (req.email || ''),
    },
    {
      label: 'Telefone / WhatsApp',
      curVal: cur.phone ? maskPhone(cur.phone) : null,
      reqVal: req.phone ? maskPhone(req.phone) : null,
      isDiff: (cur.phone || '') !== (req.phone || ''),
    },
    {
      label: 'Endereço',
      curVal: cur.address,
      reqVal: req.address,
      isDiff: (cur.address || '') !== (req.address || ''),
    },
    {
      label: 'Cidade',
      curVal: cur.city,
      reqVal: req.city,
      isDiff: (cur.city || '') !== (req.city || ''),
    },
    {
      label: 'Estado (UF)',
      curVal: cur.state,
      reqVal: req.state,
      isDiff: (cur.state || '') !== (req.state || ''),
    },
    {
      label: 'CEP',
      curVal: cur.zip_code ? maskCEP(cur.zip_code) : null,
      reqVal: req.zip_code ? maskCEP(req.zip_code) : null,
      isDiff: (cur.zip_code || '') !== (req.zip_code || ''),
    },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-200/80 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold shadow-xs">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Solicitação de Atualização Cadastral</h3>
              <p className="text-xs text-slate-500">
                Cliente: <strong className="text-slate-800">{request.client?.name || req.name}</strong> • CPF: {maskCPF(request.cpf)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <p className="text-xs text-slate-600 leading-relaxed">
            O cliente atualizou suas informações pessoais no Portal e solicitou que o cadastro no seu escritório seja atualizado. Compare as alterações abaixo:
          </p>

          {/* Diff Table */}
          <div className="border border-slate-200/80 rounded-2xl overflow-hidden text-xs">
            <div className="grid grid-cols-3 bg-slate-100/80 p-3 font-bold text-slate-700 border-b border-slate-200/80">
              <div>Campo</div>
              <div>Cadastro Atual no Escritório</div>
              <div>Novo Dado Solicitado</div>
            </div>

            <div className="divide-y divide-slate-100">
              {fields.map((f, i) => (
                <div
                  key={i}
                  className={`grid grid-cols-3 p-3 items-center ${
                    f.isDiff ? 'bg-amber-50/50' : 'bg-white'
                  }`}
                >
                  <div className="font-semibold text-slate-700 flex items-center gap-1.5">
                    {f.label}
                    {f.isDiff && (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" title="Dado alterado" />
                    )}
                  </div>
                  <div className="text-slate-500 truncate pr-2">
                    {f.curVal || <span className="text-slate-300 italic">Vazio</span>}
                  </div>
                  <div className={`truncate pr-2 ${f.isDiff ? 'font-bold text-emerald-700' : 'text-slate-700'}`}>
                    {f.reqVal || <span className="text-slate-300 italic">Vazio</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Rejection input */}
          {showRejectInput && (
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 animate-in fade-in">
              <label className="block text-xs font-semibold text-slate-700">
                Motivo da Recusa (Opcional):
              </label>
              <input
                type="text"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Ex: Dados inconsistentes com o contrato assinado..."
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-600"
              />
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="w-full sm:w-auto py-2 px-4 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Fechar
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {!showRejectInput ? (
              <>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setShowRejectInput(true)}
                  className="flex-1 sm:flex-none py-2.5 px-4 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-all cursor-pointer"
                >
                  Recusar
                </button>

                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleReview('approve')}
                  className="flex-1 sm:flex-none py-2.5 px-5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-all shadow-xs shadow-emerald-600/20 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Atualizando...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" /> Aceitar e Atualizar Cadastro
                    </>
                  )}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setShowRejectInput(false)}
                  className="flex-1 sm:flex-none py-2.5 px-4 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 bg-slate-100 transition-all cursor-pointer"
                >
                  Voltar
                </button>

                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleReview('reject')}
                  className="flex-1 sm:flex-none py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Confirmar Recusa'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
