'use client'

import { useState } from 'react'
import {
  Building2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileCheck,
  Loader2,
  Paperclip,
  ExternalLink,
  FileText,
  Download
} from 'lucide-react'
import { submitClientApprovalAction } from '@/lib/actions/portal'

export interface PortalData {
  project: {
    id: string
    code: string
    title: string
    description: string | null
    client_name: string
    area_sqm: number | null
    deadline: string | null
    status: string
  }
  organization: {
    name: string
    logo_url: string | null
    cau_caubr: string | null
    phone: string | null
    email: string | null
  }
  stages: Array<{
    id: string
    name: string
    description: string | null
    stage_order: number
    status: 'a_iniciar' | 'em_producao' | 'em_aprovacao' | 'concluido'
    progress_percent: number
    start_date: string | null
    due_date: string | null
    is_client_approval_required: boolean
    is_locked_for_client: boolean
    attachments?: Array<{ id: string; name: string; url: string; size?: string }>
  }>
}

export interface PortalClientProps {
  token: string
  data: PortalData
}

export default function PortalClient({
  token,
  data,
}: PortalClientProps) {
  const { project, organization, stages } = data
  const [selectedStage, setSelectedStage] = useState<PortalData['stages'][0] | null>(
    stages.find((s) => s.status === 'em_aprovacao') || stages[0] || null
  )
  const [modalAction, setModalAction] = useState<'approved' | 'changes_requested' | null>(null)
  const [loading, setLoading] = useState(false)
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const completedCount = stages.filter((s) => s.status === 'concluido').length
  const totalCount = stages.length
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  const handleApprovalSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selectedStage || !modalAction) return

    setLoading(true)
    setErrorMessage(null)

    const formData = new FormData(e.currentTarget)
    const res = await submitClientApprovalAction(token, selectedStage.id, modalAction, formData)

    if (res.error) {
      setErrorMessage(res.error)
      setLoading(false)
    } else {
      setFeedbackSuccess(
        modalAction === 'approved'
          ? 'Etapa aprovada com sucesso! O registro de auditoria foi gravado.'
          : 'Solicitação de ajustes enviada com sucesso para o arquiteto!'
      )
      setModalAction(null)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 antialiased font-sans flex flex-col justify-between">
      {/* Client Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold shadow-sm shadow-blue-500/20">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-sm font-bold text-slate-900 block">{organization.name}</span>
              <span className="text-xs text-slate-500">Portal de Acompanhamento & Aprovação de Projetos</span>
            </div>
          </div>

          <div className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold border border-blue-200">
            Acesso do Cliente
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8 flex-1 w-full">
        {/* Success Alert */}
        {feedbackSuccess && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 shadow-xs">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{feedbackSuccess}</span>
          </div>
        )}

        {/* Project Header Banner */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-700 font-mono text-xs font-bold">
                  {project.code}
                </span>
                <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                  {project.title}
                </h1>
              </div>
              <p className="text-xs text-slate-500">
                Cliente: <strong className="text-slate-700">{project.client_name}</strong> • Área: <strong>{project.area_sqm ? `${project.area_sqm} m²` : '—'}</strong>
              </p>
            </div>

            {/* Progress Meter */}
            <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
              <div className="text-right">
                <p className="text-xs text-slate-500 font-medium">Progresso Geral</p>
                <p className="text-lg font-extrabold text-blue-600 font-mono">{progressPercent}%</p>
              </div>
              <div className="w-28 bg-slate-200 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-500 to-indigo-600 h-full rounded-full transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Stages Stepper & Approval Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: 10 Stages Vertical List */}
          <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider pb-2 border-b border-slate-100 flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-blue-600" /> Etapas do Seu Projeto
            </h2>

            <div className="space-y-1.5">
              {stages.map((st) => {
                const isSelected = selectedStage?.id === st.id
                return (
                  <button
                    key={st.id}
                    onClick={() => setSelectedStage(st)}
                    className={`w-full text-left p-3 rounded-xl transition-all flex items-center justify-between border ${
                      isSelected
                        ? 'bg-blue-50/70 border-blue-300 shadow-2xs'
                        : 'bg-white hover:bg-slate-50 border-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-xs font-bold text-slate-400 w-5">
                        #{st.stage_order}
                      </span>
                      <div>
                        <span className={`text-xs font-bold block ${isSelected ? 'text-blue-900' : 'text-slate-800'}`}>
                          {st.name}
                        </span>
                      </div>
                    </div>

                    <div>
                      {st.status === 'concluido' && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      )}
                      {st.status === 'em_aprovacao' && (
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse block" title="Aguardando sua aprovação" />
                      )}
                      {st.status === 'em_producao' && (
                        <Clock className="w-3.5 h-3.5 text-blue-500" />
                      )}
                      {st.status === 'a_iniciar' && (
                        <span className="w-2 h-2 rounded-full bg-slate-300 block" />
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Right Column: Selected Stage Details & Approval Action */}
          <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-6 flex flex-col justify-between">
            {selectedStage ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <span className="text-[11px] font-mono font-bold text-blue-600 block">
                      Etapa #{selectedStage.stage_order}
                    </span>
                    <h3 className="text-xl font-bold text-slate-900">
                      {selectedStage.name}
                    </h3>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                    Descrição da Etapa
                  </span>
                  <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100">
                    {selectedStage.description || 'Os detalhes técnicos desta fase foram organizados pelo escritório de arquitetura.'}
                  </p>
                </div>

                {/* Pranchas e Documentos Anexados para o Cliente */}
                {Array.isArray(selectedStage.attachments) && selectedStage.attachments.length > 0 && (
                  <div className="space-y-2.5">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      <Paperclip className="w-3.5 h-3.5 text-indigo-600" /> Pranchas e Documentos para Visualização ({selectedStage.attachments.length})
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {selectedStage.attachments.map((att) => (
                        <a
                          key={att.id}
                          href={att.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 hover:border-blue-400 hover:bg-blue-50/40 transition-all group shadow-2xs"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="p-2 rounded-lg bg-white border border-slate-200 text-blue-600 group-hover:text-blue-700 shadow-2xs shrink-0">
                              <FileText className="w-4 h-4" />
                            </div>
                            <div className="truncate">
                              <span className="text-xs font-bold text-slate-800 group-hover:text-blue-700 block truncate">
                                {att.name}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono block">
                                {att.size || 'Arquivo'}
                              </span>
                            </div>
                          </div>
                          <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-blue-600 shrink-0 ml-2" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}


                {/* Status Box */}
                {selectedStage.status === 'concluido' && (
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 space-y-1">
                    <div className="flex items-center gap-2 font-bold text-xs">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Etapa Aprovada com Sucesso
                    </div>
                    <p className="text-[11px] text-emerald-700">
                      Esta etapa já foi aprovada e validada no sistema com registro de auditoria.
                    </p>
                  </div>
                )}

                {selectedStage.status === 'em_aprovacao' && (
                  <div className="p-5 rounded-2xl bg-amber-50/80 border border-amber-200 space-y-4">
                    <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
                      <Clock className="w-4 h-4 text-amber-600" />
                      Sua Aprovação é Necessária
                    </div>
                    <p className="text-xs text-amber-800 leading-relaxed">
                      O arquiteto finalizou a produção desta fase e enviou para sua validação. Você pode aprovar ou solicitar ajustes pontuais.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-3 pt-2">
                      <button
                        onClick={() => setModalAction('approved')}
                        className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle2 className="w-4 h-4" /> Aprovar Esta Etapa
                      </button>

                      <button
                        onClick={() => setModalAction('changes_requested')}
                        className="flex-1 py-2.5 px-4 rounded-xl bg-white border border-amber-300 text-amber-800 hover:bg-amber-100/50 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                      >
                        <AlertTriangle className="w-4 h-4 text-amber-600" /> Solicitar Ajustes
                      </button>
                    </div>
                  </div>
                )}

                {selectedStage.status === 'em_producao' && (
                  <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 text-blue-800 text-xs flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>Esta etapa está sendo trabalhada internamente pela equipe de arquitetura.</span>
                  </div>
                )}

                {selectedStage.status === 'a_iniciar' && (
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-xs">
                    Etapa planejada para o cronograma futuro do projeto.
                  </div>
                )}
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-slate-400">
                Selecione uma etapa ao lado para visualizar os detalhes.
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Approval / Adjustments Modal */}
      {modalAction && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h4 className="text-base font-bold text-slate-900 flex items-center gap-2">
                {modalAction === 'approved' ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" /> Confirmar Aprovação
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-5 h-5 text-amber-600" /> Solicitar Ajustes
                  </>
                )}
              </h4>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleApprovalSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Seu Nome Completo *
                </label>
                <input
                  type="text"
                  name="approverName"
                  required
                  defaultValue={project.client_name}
                  placeholder="Nome de quem está aprovando"
                  className="block w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Seu E-mail (Opcional)
                </label>
                <input
                  type="email"
                  name="approverEmail"
                  placeholder="seuemail@cliente.com"
                  className="block w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {modalAction === 'approved' ? 'Observações / Elogios (Opcional)' : 'Descreva os Ajustes Necessários *'}
                </label>
                <textarea
                  name="feedback"
                  required={modalAction === 'changes_requested'}
                  rows={3}
                  placeholder={
                    modalAction === 'approved'
                      ? 'Ex: Projeto excelente! Aprovado para seguirmos para o detalhamento executivo.'
                      : 'Ex: Gostaria de alterar a cor das esquadrias da fachada e verificar a iluminação da sala...'
                  }
                  className="block w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setModalAction(null)}
                  className="py-2 px-4 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className={`py-2 px-5 rounded-xl text-xs font-bold text-white transition-all shadow-xs flex items-center gap-1.5 ${
                    modalAction === 'approved'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-amber-600 hover:bg-amber-700'
                  }`}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Registrando...
                    </>
                  ) : modalAction === 'approved' ? (
                    'Confirmar e Gravar Aprovação'
                  ) : (
                    'Enviar Solicitação de Ajustes'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200/80 py-6 px-6 mt-8">
        <div className="max-w-5xl mx-auto text-center text-xs text-slate-400">
          Orgarq Architecture OS • Conexão Segura & Auditoria Criptográfica
        </div>
      </footer>
    </div>
  )
}
