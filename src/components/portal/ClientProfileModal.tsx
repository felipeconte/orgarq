'use client'

import { useState, useEffect } from 'react'
import {
  User,
  Mail,
  Phone,
  MapPin,
  Building,
  CheckCircle2,
  AlertCircle,
  Clock,
  Send,
  Loader2,
  X,
  ShieldCheck,
  Building2,
  ArrowRight,
  HelpCircle,
} from 'lucide-react'
import {
  getClientPortalProfileAction,
  updateClientPortalProfileAction,
  requestOfficeDataCorrectionAction,
  ClientProfileData,
  ClientOfficeRegistrationInfo,
} from '@/lib/actions/client-profile'
import { maskCPF, maskPhone, maskCEP } from '@/lib/formatters-and-validators'

export interface ClientProfileModalProps {
  isOpen: boolean
  onClose: () => void
  onProfileUpdated?: () => void
}

const BRAZIL_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]

export default function ClientProfileModal({
  isOpen,
  onClose,
  onProfileUpdated,
}: ClientProfileModalProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'offices'>('profile')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Profile Form State
  const [profile, setProfile] = useState<ClientProfileData>({
    cpf: '',
    name: '',
    email: null,
    phone: null,
    address: null,
    city: null,
    state: null,
    zip_code: null,
  })

  // Office Registrations State
  const [offices, setOffices] = useState<ClientOfficeRegistrationInfo[]>([])
  const [selectedOfficeForCorrection, setSelectedOfficeForCorrection] = useState<ClientOfficeRegistrationInfo | null>(null)
  const [requestingCorrection, setRequestingCorrection] = useState(false)

  // Confirmation Modal for Sharing
  const [showShareConfirmModal, setShowShareConfirmModal] = useState(false)

  const loadProfileData = async () => {
    setLoading(true)
    setErrorMessage(null)
    const res = await getClientPortalProfileAction()

    if (res.success && res.data) {
      setProfile(res.data.profile)
      setOffices(res.data.offices)
    } else {
      setErrorMessage(res.error || 'Não foi possível carregar os dados do perfil.')
    }
    setLoading(false)
  }

  useEffect(() => {
    if (isOpen) {
      loadProfileData()
      setSuccessMessage(null)
      setErrorMessage(null)
    }
  }, [isOpen])

  if (!isOpen) return null

  const handlePhoneChange = (val: string) => {
    setProfile((prev) => ({ ...prev, phone: maskPhone(val) }))
  }

  const handleCepChange = (val: string) => {
    setProfile((prev) => ({ ...prev, zip_code: maskCEP(val) }))
  }

  // Ao submeter o formulário de perfil, abre a confirmação sobre compartilhamento
  const handlePreSave = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setSuccessMessage(null)

    if (!profile.name.trim()) {
      setErrorMessage('O nome é obrigatório.')
      return
    }

    setShowShareConfirmModal(true)
  }

  // Executa o salvamento com a decisão de compartilhamento
  const handleExecuteSave = async (shareWithOffices: boolean) => {
    setShowShareConfirmModal(false)
    setSaving(true)
    setErrorMessage(null)

    const res = await updateClientPortalProfileAction(
      {
        name: profile.name,
        email: profile.email,
        phone: profile.phone,
        address: profile.address,
        city: profile.city,
        state: profile.state,
        zip_code: profile.zip_code,
      },
      shareWithOffices
    )

    if (res.success) {
      setSuccessMessage(
        shareWithOffices
          ? 'Perfil atualizado e solicitação enviada aos escritórios vinculados!'
          : 'Perfil atualizado com sucesso (apenas na sua conta pessoal)!'
      )
      loadProfileData()
      if (onProfileUpdated) onProfileUpdated()
    } else {
      setErrorMessage(res.error || 'Erro ao salvar alterações.')
    }
    setSaving(false)
  }

  // Solicita correção direcionada a um escritório específico
  const handleSendOfficeCorrection = async (office: ClientOfficeRegistrationInfo) => {
    setRequestingCorrection(true)
    setErrorMessage(null)

    const res = await requestOfficeDataCorrectionAction(
      office.officeId,
      office.clientRecordId,
      {
        name: profile.name,
        email: profile.email,
        phone: profile.phone,
        address: profile.address,
        city: profile.city,
        state: profile.state,
        zip_code: profile.zip_code,
      }
    )

    if (res.success) {
      setSuccessMessage(`Solicitação de correção enviada para ${office.officeName}!`)
      loadProfileData()
      setSelectedOfficeForCorrection(null)
    } else {
      setErrorMessage(res.error || 'Erro ao enviar solicitação.')
    }
    setRequestingCorrection(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200/80 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-xs">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Meu Perfil & Cadastro</h3>
              <p className="text-xs text-slate-500">
                CPF: <span className="font-mono font-semibold text-slate-700">{maskCPF(profile.cpf)}</span>
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

        {/* Tab Navigation */}
        <div className="px-6 pt-3 border-b border-slate-100 flex gap-4 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`pb-3 text-xs font-bold transition-all relative cursor-pointer ${activeTab === 'profile'
              ? 'text-blue-600 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-blue-600'
              : 'text-slate-500 hover:text-slate-800'
              }`}
          >
            Meus Dados Pessoais
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('offices')}
            className={`pb-3 text-xs font-bold transition-all relative cursor-pointer flex items-center gap-1.5 ${activeTab === 'offices'
              ? 'text-blue-600 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-blue-600'
              : 'text-slate-500 hover:text-slate-800'
              }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            Escritórios Vinculados ({offices.length})
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              <p className="text-xs">Carregando informações...</p>
            </div>
          ) : activeTab === 'profile' ? (
            <form id="profileForm" onSubmit={handlePreSave} className="space-y-4">
              <div className="p-3 rounded-xl bg-blue-50/50 border border-blue-100 text-xs text-blue-800 flex items-start gap-2">
                <HelpCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <span>
                  Estes são seus dados do Portal Orgarq. Ao salvar, você poderá escolher se deseja notificar os escritórios para atualizar seus registros lá também.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  required
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  placeholder="Seu nome completo"
                  className="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    E-mail
                  </label>
                  <input
                    type="email"
                    value={profile.email || ''}
                    onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                    placeholder="seuemail@exemplo.com"
                    className="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Telefone / WhatsApp
                  </label>
                  <input
                    type="text"
                    value={profile.phone || ''}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    placeholder="(00) 00000-0000"
                    maxLength={15}
                    className="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Endereço Residencial / Comercial
                </label>
                <input
                  type="text"
                  value={profile.address || ''}
                  onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                  placeholder="Rua, número, complemento e bairro"
                  className="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className="sm:col-span-1">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    CEP
                  </label>
                  <input
                    type="text"
                    value={profile.zip_code || ''}
                    onChange={(e) => handleCepChange(e.target.value)}
                    placeholder="00000-000"
                    maxLength={9}
                    className="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-mono"
                  />
                </div>

                <div className="sm:col-span-1">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Cidade
                  </label>
                  <input
                    type="text"
                    value={profile.city || ''}
                    onChange={(e) => setProfile({ ...profile, city: e.target.value })}
                    placeholder="Sua cidade"
                    className="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>

                <div className="sm:col-span-1">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Estado (UF)
                  </label>
                  <select
                    value={profile.state || ''}
                    onChange={(e) => setProfile({ ...profile, state: e.target.value })}
                    className="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 cursor-pointer"
                  >
                    <option value="">Selecione...</option>
                    {BRAZIL_STATES.map((uf) => (
                      <option key={uf} value={uf}>
                        {uf}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </form>
          ) : (
            /* TAB: ESCRITÓRIOS VINCULADOS */
            <div className="space-y-4">
              <p className="text-xs text-slate-500">
                Abaixo estão os escritórios de arquitetura que possuem seu cadastro na plataforma. Se houver informações divergentes, você pode solicitar a correção diretamente para o escritório.
              </p>

              {offices.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  Nenhum escritório vinculado encontrado.
                </div>
              ) : (
                <div className="space-y-3">
                  {offices.map((office) => {
                    const hasDivergence =
                      office.currentData.name !== profile.name ||
                      (office.currentData.email || '') !== (profile.email || '') ||
                      (office.currentData.phone || '') !== (profile.phone || '')

                    return (
                      <div
                        key={office.officeId}
                        className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
                              <Building className="w-4 h-4" />
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-slate-900">{office.officeName}</h4>
                              <p className="text-[11px] text-slate-500">
                                {office.officeEmail || office.officePhone || 'Escritório parceiro'}
                              </p>
                            </div>
                          </div>

                          {office.pendingRequest ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold border border-amber-200">
                              <Clock className="w-3 h-3 text-amber-600" /> Solicitação Pendente
                            </span>
                          ) : hasDivergence ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold border border-blue-200">
                              Dados Divergentes
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Dados atualizados
                            </span>
                          )}
                        </div>

                        {/* Comparativo de Dados no Escritório */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] bg-white p-3 rounded-xl border border-slate-200/60 font-medium">
                          <div>
                            <span className="text-slate-400 block text-[10px]">Nome no Escritório:</span>
                            <span className={office.currentData.name !== profile.name ? 'text-amber-700 font-bold' : 'text-slate-700'}>
                              {office.currentData.name}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">E-mail no Escritório:</span>
                            <span className={(office.currentData.email || '') !== (profile.email || '') ? 'text-amber-700 font-bold' : 'text-slate-700'}>
                              {office.currentData.email || 'Não informado'}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Telefone no Escritório:</span>
                            <span className={(office.currentData.phone || '') !== (profile.phone || '') ? 'text-amber-700 font-bold' : 'text-slate-700'}>
                              {office.currentData.phone ? maskPhone(office.currentData.phone) : 'Não informado'}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Cidade/UF no Escritório:</span>
                            <span className="text-slate-700">
                              {office.currentData.city ? `${office.currentData.city} - ${office.currentData.state || ''}` : 'Não informado'}
                            </span>
                          </div>
                        </div>

                        {/* Ação de Correção */}
                        {!office.pendingRequest && (
                          <div className="flex justify-end pt-1">
                            <button
                              type="button"
                              disabled={requestingCorrection}
                              onClick={() => setSelectedOfficeForCorrection(office)}
                              className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-bold transition-all border border-blue-200/80 cursor-pointer"
                            >
                              <Send className="w-3 h-3" /> Solicitar Correção a este Escritório
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        {activeTab === 'profile' && (
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="py-2 px-4 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="profileForm"
              disabled={saving}
              className="py-2.5 px-5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all shadow-xs shadow-blue-500/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Salvando...
                </>
              ) : (
                'Salvar Alterações'
              )}
            </button>
          </div>
        )}
      </div>

      {/* CONFIRMATION MODAL: COMPARTILHAR COM ESCRITÓRIOS */}
      {showShareConfirmModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white max-w-md w-full rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Compartilhar com os Escritórios?</h4>
                <p className="text-xs text-slate-500">Atualização de Cadastro</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Você deseja enviar uma solicitação de atualização cadastral com estes novos dados para os escritórios de arquitetura vinculados ao seu cadastro?
            </p>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => handleExecuteSave(true)}
                className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs shadow-blue-500/20"
              >
                <CheckCircle2 className="w-4 h-4" /> Sim, Compartilhar com os Escritórios
              </button>

              <button
                type="button"
                onClick={() => handleExecuteSave(false)}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                Não, Salvar Apenas no Meu Perfil Pessoal
              </button>

              <button
                type="button"
                onClick={() => setShowShareConfirmModal(false)}
                className="w-full py-2 text-center text-xs font-semibold text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                Voltar e Continuar Editando
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL: SOLICITAR CORREÇÃO A ESCRITÓRIO ESPECÍFICO */}
      {selectedOfficeForCorrection && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white max-w-md w-full rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 shadow-xs">
                <Send className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Solicitar Atualização Cadastral</h4>
                <p className="text-xs text-slate-500">{selectedOfficeForCorrection.officeName}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Você deseja enviar uma solicitação para que o escritório <strong>{selectedOfficeForCorrection.officeName}</strong> atualize seu cadastro com os dados do seu perfil pessoal?
            </p>

            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs space-y-1.5">
              <p className="text-[11px] font-bold text-slate-800">Dados do seu perfil que serão enviados:</p>
              <div className="space-y-1 text-slate-600 text-[11px]">
                <div><span className="text-slate-400">Nome:</span> <strong className="text-slate-800">{profile.name}</strong></div>
                {profile.email && <div><span className="text-slate-400">E-mail:</span> <strong className="text-slate-800">{profile.email}</strong></div>}
                {profile.phone && <div><span className="text-slate-400">Telefone:</span> <strong className="text-slate-800">{profile.phone}</strong></div>}
                {profile.address && <div><span className="text-slate-400">Endereço:</span> <strong className="text-slate-800">{profile.address}</strong></div>}
                {profile.city && <div><span className="text-slate-400">Cidade/UF:</span> <strong className="text-slate-800">{profile.city} - {profile.state}</strong></div>}
                {profile.zip_code && <div><span className="text-slate-400">CEP:</span> <strong className="text-slate-800">{profile.zip_code}</strong></div>}
              </div>
            </div>

            <p className="text-[11px] text-amber-800 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
              ⏳ O escritório receberá uma notificação para analisar e aceitar a sincronização.
            </p>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                disabled={requestingCorrection}
                onClick={() => handleSendOfficeCorrection(selectedOfficeForCorrection)}
                className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs shadow-blue-500/20 disabled:opacity-50"
              >
                {requestingCorrection ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Enviando Solicitação...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" /> Confirmar e Enviar Solicitação
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={requestingCorrection}
                onClick={() => setSelectedOfficeForCorrection(null)}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
