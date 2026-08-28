'use client'

import { useState, useMemo } from 'react'
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
  Calendar,
  Sparkles,
  Check,
  AlertCircle,
  ChevronRight
} from 'lucide-react'
import { submitClientApprovalAction } from '@/lib/actions/portal'
import { formatDateRangeBR } from '@/lib/date-utils'
import {
  WorkflowStage,
  STAGE_COLOR_CONFIG,
  getStageConfig,
  DEFAULT_WORKFLOW_STAGES
} from '@/lib/workflow-stages'

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
    status: string
    progress_percent: number
    start_date: string | null
    due_date: string | null
    is_client_approval_required: boolean
    is_locked_for_client: boolean
    attachments?: Array<{ id: string; name: string; url: string; size?: string }>
  }>
  workflowStages?: WorkflowStage[]
}

export interface PortalClientProps {
  token: string
  data: PortalData
}

export default function PortalClient({
  token,
  data,
}: PortalClientProps) {
  const { project, organization } = data
  const workflowStages = data.workflowStages && data.workflowStages.length > 0
    ? data.workflowStages
    : DEFAULT_WORKFLOW_STAGES

  const clientApprovalStage = useMemo(() => {
    return workflowStages.find((s) => s.is_client_approval_stage === true) || null
  }, [workflowStages])

  // Filtra APENAS tarefas que exigem aprovação do cliente, mantendo a ordenação original
  const approvalStages = useMemo(() => {
    return (data.stages || [])
      .filter((s) => s.is_client_approval_required !== false)
      .sort((a, b) => a.stage_order - b.stage_order)
  }, [data.stages])

  const [selectedStage, setSelectedStage] = useState<PortalData['stages'][0] | null>(null)
  const [modalAction, setModalAction] = useState<'approved' | 'changes_requested' | null>(null)
  const [loading, setLoading] = useState(false)
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const completedCount = approvalStages.filter((s) => s.status === 'concluido' || s.status === 'aprovado').length
  const totalCount = approvalStages.length
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
          ? `Etapa "${selectedStage.name}" aprovada com sucesso! O registro de validação foi salvo.`
          : `Solicitação de ajustes para "${selectedStage.name}" enviada para o escritório de arquitetura!`
      )
      // Atualiza o status local para refletir a ação imediatamente
      selectedStage.status = modalAction === 'approved' ? 'concluido' : 'em_producao'
      setModalAction(null)
      setSelectedStage(null)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 antialiased font-sans flex flex-col justify-between selection:bg-blue-100 selection:text-blue-900">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {organization.logo_url ? (
              <img
                src={organization.logo_url}
                alt={organization.name}
                className="h-10 w-10 rounded-xl object-contain border border-slate-200 bg-white"
              />
            ) : (
              <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold shadow-xs shadow-blue-500/20">
                <Building2 className="w-5 h-5" />
              </div>
            )}
            <div>
              <span className="text-sm font-bold text-slate-900 block">{organization.name}</span>
              <span className="text-xs text-slate-500">Portal de Acompanhamento & Aprovações</span>
            </div>
          </div>

          <div className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold border border-blue-200 shadow-2xs">
            Acesso do Cliente
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8 flex-1 w-full">
        {/* Success Alert */}
        {feedbackSuccess && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between shadow-xs animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{feedbackSuccess}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedbackSuccess(null)}
              className="text-emerald-600 hover:text-emerald-800 text-xs font-bold ml-3 cursor-pointer"
            >
              Fechar
            </button>
          </div>
        )}

        {/* Project Header Banner */}
        <div className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-700 font-mono text-xs font-bold border border-slate-200">
                  {project.code}
                </span>
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                  {project.title}
                </h1>
              </div>
              <p className="text-xs text-slate-500">
                Cliente: <strong className="text-slate-700 font-semibold">{project.client_name}</strong>
                {project.area_sqm && (
                  <>
                    {' '}• Área: <strong className="text-slate-700 font-semibold">{project.area_sqm} m²</strong>
                  </>
                )}
              </p>
            </div>

            {/* Progress Meter */}
            <div className="flex items-center gap-3.5 bg-slate-50 p-3.5 rounded-2xl border border-slate-100 shrink-0">
              <div className="text-right">
                <p className="text-[11px] text-slate-500 font-medium">Aprovações Concluídas</p>
                <p className="text-base font-extrabold text-blue-600 font-mono">
                  {completedCount} de {totalCount} ({progressPercent}%)
                </p>
              </div>
              <div className="w-24 bg-slate-200 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-600 to-emerald-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* TIMELINE SECTION */}
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-xs space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                <FileCheck className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Linha do Tempo de Aprovações</h2>
                <p className="text-xs text-slate-500">Etapas do projeto que necessitam da sua validação</p>
              </div>
            </div>
          </div>

          {approvalStages.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <p className="text-sm font-semibold text-slate-600">Nenhuma etapa com aprovação necessária no momento.</p>
              <p className="text-xs text-slate-400">Quando o arquiteto solicitar a validação de uma prancha ou etapa, ela aparecerá aqui.</p>
            </div>
          ) : (
            <div className="relative pl-6 sm:pl-8 space-y-8 before:absolute before:left-3 sm:before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
              {approvalStages.map((st, index) => {
                const stepNumber = index + 1
                const stageConfig = getStageConfig(st.status, workflowStages)
                const colStyle = STAGE_COLOR_CONFIG[stageConfig.color] || STAGE_COLOR_CONFIG.blue
                const isApproved = st.status === 'concluido' || stageConfig.id === 'concluido' || stageConfig.id === 'aprovado'
                const isPendingApproval = Boolean(clientApprovalStage && st.status === clientApprovalStage.id)
                const hasDates = !!(st.start_date || st.due_date)

                return (
                  <div key={st.id} className="relative group">
                    {/* Timeline Node Marker */}
                    <div
                      className={`absolute -left-6 sm:-left-8 top-1.5 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                        isApproved
                          ? 'bg-emerald-500 text-white ring-4 ring-emerald-100 shadow-xs'
                          : isPendingApproval
                          ? 'bg-amber-500 text-white ring-4 ring-amber-100 shadow-xs animate-pulse'
                          : `${colStyle.badge} ring-4 ring-slate-100 shadow-xs`
                      }`}
                    >
                      {isApproved ? (
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      ) : (
                        <span className="text-[11px] font-mono font-bold">{stepNumber}</span>
                      )}
                    </div>

                    {/* Timeline Card */}
                    <div
                      className={`p-5 sm:p-6 rounded-2xl border transition-all space-y-4 ${
                        isPendingApproval
                          ? 'bg-amber-50/40 border-amber-300/90 shadow-md ring-2 ring-amber-500/10'
                          : isApproved
                          ? 'bg-emerald-50/20 border-emerald-200/80 hover:border-emerald-300 shadow-xs'
                          : 'bg-white border-slate-200/80 hover:border-slate-300 shadow-xs'
                      }`}
                    >
                      {/* Top Row: Task Name & Dynamic Status Badge */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                          {st.name}
                        </h3>

                        <div>
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border shadow-2xs ${colStyle.badge}`}
                          >
                            <span className={`w-2 h-2 rounded-full ${colStyle.dot}`} />
                            {stageConfig.name}
                          </span>
                        </div>
                      </div>

                      {/* Datas Previstas de Início e Conclusão */}
                      {hasDates && (
                        <div className="inline-flex items-center gap-2 text-xs text-slate-600 font-medium bg-slate-50 border border-slate-200/80 px-3 py-1.5 rounded-xl">
                          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="font-mono">{formatDateRangeBR(st.start_date, st.due_date)}</span>
                        </div>
                      )}

                      {/* SOLICITAÇÃO DE APROVAÇÃO (QUANDO EXISTIR) */}
                      {isPendingApproval && (
                        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-amber-200/90 shadow-xs space-y-4">
                          <div className="flex items-center gap-2.5 text-amber-900 font-bold text-sm">
                            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>Solicitação de Aprovação do Cliente</span>
                          </div>

                          <p className="text-xs text-slate-600 leading-relaxed">
                            Esta etapa foi finalizada pela equipe de arquitetura e está pronta para sua avaliação. Por favor, revise os arquivos anexos e clique abaixo para aprovar ou solicitar ajustes.
                          </p>

                          {/* Arquivos / Pranchas anexas da etapa */}
                          {Array.isArray(st.attachments) && st.attachments.length > 0 && (
                            <div className="space-y-2 pt-2 border-t border-slate-100">
                              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                <Paperclip className="w-3.5 h-3.5 text-indigo-600" /> Arquivos e Pranchas para Avaliação ({st.attachments.length})
                              </span>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                {st.attachments.map((att) => (
                                  <a
                                    key={att.id}
                                    href={att.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 hover:border-blue-400 hover:bg-blue-50/40 text-xs font-semibold text-slate-800 transition-all shadow-2xs group"
                                  >
                                    <div className="flex items-center gap-2 truncate">
                                      <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                                      <span className="truncate">{att.name}</span>
                                    </div>
                                    <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 shrink-0 ml-2" />
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Botões de Ação do Cliente */}
                          <div className="flex flex-col sm:flex-row gap-3 pt-2">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedStage(st)
                                setModalAction('approved')
                              }}
                              className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                            >
                              <CheckCircle2 className="w-4 h-4" /> Aprovar Etapa
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setSelectedStage(st)
                                setModalAction('changes_requested')
                              }}
                              className="flex-1 py-2.5 px-4 rounded-xl bg-white border border-amber-300 text-amber-800 hover:bg-amber-50 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
                            >
                              <AlertTriangle className="w-4 h-4 text-amber-600" /> Solicitar Ajustes
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Box informativo quando já aprovada */}
                      {isApproved && (
                        <div className="p-3.5 rounded-xl bg-emerald-50/80 border border-emerald-200/80 text-emerald-900 flex items-center justify-between text-xs font-medium">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>Etapa aprovada com registro de auditoria.</span>
                          </div>
                          {Array.isArray(st.attachments) && st.attachments.length > 0 && (
                            <div className="flex items-center gap-2">
                              {st.attachments.map((att) => (
                                <a
                                  key={att.id}
                                  href={att.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[11px] font-semibold text-emerald-700 hover:underline flex items-center gap-1"
                                >
                                  <FileText className="w-3 h-3" /> Ver prancha
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>

      {/* Approval / Adjustments Modal */}
      {modalAction && selectedStage && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 sm:p-7 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h4 className="text-base font-bold text-slate-900 flex items-center gap-2">
                {modalAction === 'approved' ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" /> Aprovar {selectedStage.name}
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-5 h-5 text-amber-600" /> Solicitar Ajustes em {selectedStage.name}
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
                  placeholder="Nome do responsável pela aprovação"
                  className="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
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
                  className="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {modalAction === 'approved' ? 'Observações / Comentários (Opcional)' : 'Descreva os Ajustes Necessários *'}
                </label>
                <textarea
                  name="feedback"
                  required={modalAction === 'changes_requested'}
                  rows={3}
                  placeholder={
                    modalAction === 'approved'
                      ? 'Ex: Projeto aprovado conforme pranchas apresentadas.'
                      : 'Ex: Gostaria de alterar as cores das esquadrias e rever o layout da cozinha...'
                  }
                  className="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 resize-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setModalAction(null)
                    setSelectedStage(null)
                  }}
                  className="py-2.5 px-4 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className={`py-2.5 px-5 rounded-xl text-xs font-bold text-white transition-all shadow-xs flex items-center gap-1.5 cursor-pointer ${
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
        <div className="max-w-4xl mx-auto text-center text-xs text-slate-400">
          Orgarq Architecture OS • Conexão Segura & Auditoria Criptográfica
        </div>
      </footer>
    </div>
  )
}
