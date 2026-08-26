'use client'

import { useState, useRef } from 'react'
import {
  Building2,
  Users,
  FileCheck,
  Edit2,
  Save,
  CheckCircle2,
  Loader2,
  Plus,
  Trash2,
  Shield,
  UserCheck,
  Mail,
  Phone,
  Hash,
  Globe,
  AlertCircle,
  X,
  UploadCloud,
  ImageIcon,
  Crop,
  AlertTriangle
} from 'lucide-react'
import {
  updateOrganizationAction,
  addOrganizationMemberAction,
  updateMemberRoleAction,
  removeMemberAction
} from '@/lib/actions/organization'
import ImageCropperModal from './ImageCropperModal'

export interface OrganizationData {
  id: string
  name: string
  slug: string
  cau_caubr: string | null
  cnpj: string | null
  phone: string | null
  email: string | null
  logo_url: string | null
  owner_id: string
}

export interface MemberData {
  id: string
  organization_id: string
  user_id: string
  role: 'owner' | 'admin' | 'architect' | 'intern'
  created_at: string
  email?: string
  fullName?: string
}

export interface OfficeSettingsClientProps {
  organization: OrganizationData
  members: MemberData[]
  currentUserId: string
  currentUserEmail: string
}

const ROLE_LABELS: Record<string, { label: string; bg: string; text: string; border: string }> = {
  owner: { label: 'Proprietário', bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
  admin: { label: 'Administrador', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  architect: { label: 'Arquiteto', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  intern: { label: 'Estagiário / Assistente', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
}

export default function OfficeSettingsClient({
  organization: initialOrg,
  members: initialMembers,
  currentUserId,
  currentUserEmail,
}: OfficeSettingsClientProps) {
  const [org, setOrg] = useState<OrganizationData>(initialOrg)
  const [members, setMembers] = useState<MemberData[]>(initialMembers)

  // Form State
  const [formData, setFormData] = useState({
    name: initialOrg.name || '',
    slug: initialOrg.slug || '',
    cau_caubr: initialOrg.cau_caubr || '',
    cnpj: initialOrg.cnpj || '',
    phone: initialOrg.phone || '',
    email: initialOrg.email || currentUserEmail || '',
    logo_url: initialOrg.logo_url || '',
  })

  // Modals & Feedback
  const [isEditing, setIsEditing] = useState(false)
  const [savingOrg, setSavingOrg] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  // Image Cropper State
  const [cropperRawImage, setCropperRawImage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Add Member Modal State
  const [showAddMemberModal, setShowAddMemberModal] = useState(false)
  const [newMemberEmail, setNewMemberEmail] = useState('')
  const [newMemberRole, setNewMemberRole] = useState<'admin' | 'architect' | 'intern'>('architect')
  const [savingMember, setSavingMember] = useState(false)
  const [memberModalError, setMemberModalError] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setFeedback(msg)
    setTimeout(() => setFeedback(null), 3000)
  }

  // Handle Image File Select
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecione um arquivo de imagem válido (PNG, JPG, SVG, WebP).')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      setCropperRawImage(reader.result as string)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  // SAVE ORGANIZATION
  const handleSaveOrganization = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim() || !formData.slug.trim()) return

    setSavingOrg(true)
    const data = new FormData()
    data.append('name', formData.name.trim())
    data.append('slug', formData.slug.trim())
    data.append('cau_caubr', formData.cau_caubr.trim())
    data.append('cnpj', formData.cnpj.trim())
    data.append('phone', formData.phone.trim())
    data.append('email', formData.email.trim())
    data.append('logo_url', formData.logo_url.trim())

    const res = await updateOrganizationAction(org.id, data)
    setSavingOrg(false)

    if (res.success) {
      setOrg({
        ...org,
        name: formData.name.trim(),
        slug: formData.slug.trim(),
        cau_caubr: formData.cau_caubr.trim() || null,
        cnpj: formData.cnpj.trim() || null,
        phone: formData.phone.trim() || null,
        email: formData.email.trim() || null,
        logo_url: formData.logo_url.trim() || null,
      })
      setIsEditing(false)
      showToast('Dados do escritório atualizados com sucesso!')
    } else {
      alert(res.error || 'Erro ao atualizar dados do escritório.')
    }
  }

  // ADD MEMBER BY EMAIL
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault()
    setMemberModalError(null)

    const cleanEmail = newMemberEmail.trim().toLowerCase()
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setMemberModalError('Por favor, insira um e-mail válido.')
      return
    }

    setSavingMember(true)
    const res = await addOrganizationMemberAction(org.id, {
      email: cleanEmail,
      role: newMemberRole,
    })
    setSavingMember(false)

    if (res.success) {
      const newMemberItem: MemberData = {
        id: `temp-${Date.now()}`,
        organization_id: org.id,
        user_id: `temp-${Date.now()}`,
        role: newMemberRole,
        created_at: new Date().toISOString(),
        email: cleanEmail,
        fullName: cleanEmail.split('@')[0],
      }
      setMembers([...members, newMemberItem])
      setShowAddMemberModal(false)
      setNewMemberEmail('')
      showToast(`Membro (${cleanEmail}) adicionado com sucesso!`)
    } else {
      setMemberModalError(res.error || 'Não foi possível adicionar o membro.')
    }
  }

  // UPDATE MEMBER ROLE
  const handleUpdateRole = async (memberId: string, role: 'owner' | 'admin' | 'architect' | 'intern') => {
    const res = await updateMemberRoleAction(org.id, memberId, role)
    if (res.success) {
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, role } : m))
      )
      showToast('Função do membro atualizada!')
    } else {
      alert(res.error || 'Erro ao atualizar função.')
    }
  }

  // REMOVE MEMBER
  const handleRemoveMember = async (memberId: string, userId: string, memberEmail?: string) => {
    if (userId === org.owner_id) {
      alert('Não é possível remover o proprietário principal do escritório.')
      return
    }

    const displayName = memberEmail || 'este membro'
    if (confirm(`Tem certeza que deseja remover ${displayName} da equipe do escritório?`)) {
      const res = await removeMemberAction(org.id, memberId)
      if (res.success) {
        setMembers((prev) => prev.filter((m) => m.id !== memberId))
        showToast('Membro removido do escritório.')
      } else {
        alert(res.error || 'Erro ao remover membro.')
      }
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 antialiased">
      {/* Toast Notification */}
      {feedback && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 text-xs font-bold animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Image Cropper Modal */}
      {cropperRawImage && (
        <ImageCropperModal
          imageSrc={cropperRawImage}
          onCropComplete={(croppedUrl) => {
            setFormData({ ...formData, logo_url: croppedUrl })
            setCropperRawImage(null)
            showToast('Logomarca ajustada com sucesso!')
          }}
          onCancel={() => setCropperRawImage(null)}
        />
      )}

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Building2 className="w-6 h-6 text-blue-600" /> Perfil do Escritório & Equipe
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Gerencie os dados cadastrais da empresa de arquitetura e controle os membros com acesso ao sistema.
          </p>
        </div>

        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="inline-flex items-center gap-1.5 py-2 px-4 rounded-xl bg-white border border-slate-200 text-slate-700 hover:text-blue-600 hover:bg-slate-50 text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0"
          >
            <Edit2 className="w-3.5 h-3.5" /> Editar Informações
          </button>
        )}
      </div>

      {/* CARD: INFORMAÇÕES INSTITUCIONAIS */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-blue-600" /> Informações Institucionais
          </h2>
        </div>

        {isEditing ? (
          /* EDIT FORM */
          <form onSubmit={handleSaveOrganization} className="space-y-5">
            {/* Logo Attachment & Preview */}
            <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-white border-2 border-slate-200 shadow-xs flex items-center justify-center overflow-hidden shrink-0">
                  {formData.logo_url ? (
                    <img src={formData.logo_url} alt="Logo" className="w-full h-full object-cover" />
                  ) : (
                    <Building2 className="w-8 h-8 text-slate-300" />
                  )}
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Logomarca do Escritório</span>
                  <p className="text-[11px] text-slate-500">
                    A imagem será exibida na barra lateral e no Portal do Cliente.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:border-blue-300 hover:text-blue-600 text-slate-700 text-xs font-bold transition-all shadow-2xs cursor-pointer"
                >
                  <UploadCloud className="w-4 h-4 text-blue-600" />
                  {formData.logo_url ? 'Trocar Imagem' : 'Anexar Imagem'}
                </button>

                {formData.logo_url && (
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, logo_url: '' })}
                    className="p-2 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors shadow-2xs cursor-pointer"
                    title="Remover Logo"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Nome do Escritório *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Studio Arquitetura & Interiores"
                  className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-hidden focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Identificador / Slug *</label>
                <input
                  type="text"
                  required
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  placeholder="Ex: studio-arquitetura"
                  className="w-full text-xs font-mono border border-slate-200 rounded-xl p-2.5 outline-hidden focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Registro CAU / CAUBR</label>
                <input
                  type="text"
                  value={formData.cau_caubr}
                  onChange={(e) => setFormData({ ...formData, cau_caubr: e.target.value })}
                  placeholder="Ex: A123456-7"
                  className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-hidden focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">CNPJ do Escritório</label>
                <input
                  type="text"
                  value={formData.cnpj}
                  onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                  placeholder="Ex: 12.345.678/0001-90"
                  className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-hidden focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">E-mail Institucional</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="contato@escritorio.com"
                  className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-hidden focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Telefone / WhatsApp</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="(11) 98765-4321"
                  className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-hidden focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={savingOrg || !formData.name.trim() || !formData.slug.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {savingOrg && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {savingOrg ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </form>
        ) : (
          /* DISPLAY VIEW */
          <div className="space-y-6">
            {/* Top Logo & Title Badge */}
            <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center overflow-hidden border-2 border-white shadow-md shrink-0">
                {org.logo_url ? (
                  <img src={org.logo_url} alt={org.name} className="w-full h-full object-cover" />
                ) : (
                  <Building2 className="w-8 h-8" />
                )}
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">{org.name}</h3>
                <span className="font-mono text-xs font-bold text-blue-600">{org.slug}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 text-xs">
              <div className="space-y-1">
                <span className="font-semibold text-slate-400 block">Registro CAU / CAUBR</span>
                <span className="text-slate-800 font-medium block">{org.cau_caubr || 'Não informado'}</span>
              </div>

              <div className="space-y-1">
                <span className="font-semibold text-slate-400 block">CNPJ</span>
                <span className="text-slate-800 font-medium block">{org.cnpj || 'Não informado'}</span>
              </div>

              <div className="space-y-1">
                <span className="font-semibold text-slate-400 block">E-mail de Contato</span>
                <span className="text-slate-800 font-medium block">{org.email || currentUserEmail}</span>
              </div>

              <div className="space-y-1">
                <span className="font-semibold text-slate-400 block">Telefone / WhatsApp</span>
                <span className="text-slate-800 font-medium block">{org.phone || 'Não informado'}</span>
              </div>

              <div className="space-y-1">
                <span className="font-semibold text-slate-400 block">Status da Logomarca</span>
                <span className="text-slate-800 font-medium block">
                  {org.logo_url ? 'Logomarca ativa' : 'Nenhuma logomarca cadastrada'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* CARD: MEMBROS & COLABORADORES */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" /> Membros & Colaboradores
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Controle quem tem acesso aos projetos e atribuição de tarefas do escritório.
            </p>
          </div>

          <button
            onClick={() => {
              setMemberModalError(null)
              setNewMemberEmail('')
              setShowAddMemberModal(true)
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Adicionar Membro
          </button>
        </div>

        {members.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs">
            Nenhum membro vinculado além do proprietário.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {members.map((m) => {
              const isCurrentUser = m.user_id === currentUserId
              const isOwner = m.user_id === org.owner_id
              const roleConfig = ROLE_LABELS[m.role] || ROLE_LABELS.architect
              const memberDisplayName = isCurrentUser
                ? `${currentUserEmail} (Você)`
                : m.fullName || m.email || 'Membro da Equipe'

              return (
                <div key={m.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs shrink-0">
                      {isCurrentUser ? 'EU' : <UserCheck className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">
                          {memberDisplayName}
                        </span>
                        {isOwner && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            Owner
                          </span>
                        )}
                      </div>
                      {!isCurrentUser && m.email && m.fullName && (
                        <span className="text-[11px] text-slate-400 block mt-0.5">
                          {m.email}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 pl-12 sm:pl-0">
                    <select
                      value={m.role}
                      disabled={isOwner}
                      onChange={(e) => handleUpdateRole(m.id, e.target.value as any)}
                      className={`text-xs font-bold px-2.5 py-1 rounded-lg border outline-hidden cursor-pointer ${roleConfig.bg} ${roleConfig.text} ${roleConfig.border} disabled:opacity-80`}
                    >
                      <option value="owner">Proprietário</option>
                      <option value="admin">Administrador</option>
                      <option value="architect">Arquiteto</option>
                      <option value="intern">Estagiário / Assistente</option>
                    </select>

                    {!isOwner && (
                      <button
                        onClick={() => handleRemoveMember(m.id, m.user_id, m.email)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Remover membro"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* MODAL: ADICIONAR MEMBRO POR E-MAIL */}
      {showAddMemberModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs"
            onClick={() => setShowAddMemberModal(false)}
          />
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl z-10 space-y-4 border border-slate-200 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" /> Adicionar Membro à Equipe
              </h3>
              <button
                onClick={() => setShowAddMemberModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Error Notification inside modal */}
            {memberModalError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-700">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{memberModalError}</span>
              </div>
            )}

            <form onSubmit={handleAddMember} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  E-mail do Usuário Cadastrado *
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={newMemberEmail}
                    onChange={(e) => {
                      setNewMemberEmail(e.target.value)
                      if (memberModalError) setMemberModalError(null)
                    }}
                    placeholder="usuario@arquiteto.com"
                    className="w-full text-xs border border-slate-200 rounded-xl p-2.5 pl-8 outline-hidden focus:border-blue-500"
                  />
                  <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  O colaborador precisa possuir uma conta cadastrada na plataforma Orgarq com este e-mail.
                </p>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Função / Nível de Acesso</label>
                <select
                  value={newMemberRole}
                  onChange={(e) => setNewMemberRole(e.target.value as any)}
                  className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-hidden focus:border-blue-500 bg-white"
                >
                  <option value="architect">Arquiteto (Pode gerenciar tarefas e projetos)</option>
                  <option value="admin">Administrador (Controle total das configurações)</option>
                  <option value="intern">Estagiário / Assistente (Acesso operacional)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddMemberModal(false)}
                  className="px-3.5 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingMember || !newMemberEmail.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {savingMember && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {savingMember ? 'Verificando...' : 'Adicionar Membro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
