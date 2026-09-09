'use client'

import { useState, useRef } from 'react'
import {
  User,
  Mail,
  Phone,
  Shield,
  Key,
  CheckCircle2,
  Loader2,
  UploadCloud,
  Trash2,
  BadgeCheck,
  Lock,
  Edit2,
  AlertCircle,
  Briefcase,
  FileCheck,
  Send,
  X
} from 'lucide-react'
import {
  updateUserProfileAction,
  updateUserPasswordAction,
  sendPasswordResetEmailAction
} from '@/lib/actions/profile'
import { maskPhone } from '@/lib/formatters-and-validators'
import ImageCropperModal from '@/components/organization/ImageCropperModal'
import { useAlert, useConfirm } from '@/components/ui/ConfirmDialog'

export interface UserProfileData {
  id: string
  email: string
  fullName: string
  avatarUrl: string | null
  phone: string | null
  jobRole: string | null
  cau: string | null
  bio: string | null
}

export interface UserProfileSettingsClientProps {
  initialProfile: UserProfileData
  role: string
}

export default function UserProfileSettingsClient({
  initialProfile,
  role,
}: UserProfileSettingsClientProps) {
  const showAlert = useAlert()
  const confirm = useConfirm()
  const [profile, setProfile] = useState<UserProfileData>(initialProfile)

  // Mode: View (default) vs Edit
  const [isEditing, setIsEditing] = useState(false)

  // Form State
  const [formData, setFormData] = useState({
    fullName: initialProfile.fullName || '',
    email: initialProfile.email || '',
    phone: initialProfile.phone ? maskPhone(initialProfile.phone) : '',
    jobRole: initialProfile.jobRole || '',
    cau: initialProfile.cau || '',
    bio: initialProfile.bio || '',
    avatarUrl: initialProfile.avatarUrl || '',
  })

  // Password Form State
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })

  // Image Cropper State
  const [cropperRawImage, setCropperRawImage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Status & Feedback
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [sendingResetEmail, setSendingResetEmail] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setFeedback(msg)
    setTimeout(() => setFeedback(null), 3500)
  }

  // Handle File Selection for Avatar
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      await showAlert({
        title: 'Formato inválido',
        message: 'Por favor, selecione um arquivo de imagem válido (PNG, JPG, WebP).',
        variant: 'warning',
      })
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      setCropperRawImage(reader.result as string)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  // Save Profile Info
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.fullName.trim()) return

    setSavingProfile(true)
    const data = new FormData()
    data.append('fullName', formData.fullName.trim())
    data.append('email', formData.email.trim())
    data.append('phone', formData.phone.trim())
    data.append('jobRole', formData.jobRole.trim())
    data.append('cau', formData.cau.trim())
    data.append('bio', formData.bio.trim())
    data.append('avatarUrl', formData.avatarUrl.trim())

    const res = await updateUserProfileAction(data)
    setSavingProfile(false)

    if (res.success) {
      const updatedEmail = res.newEmail || formData.email.trim()
      setProfile({
        ...profile,
        fullName: formData.fullName.trim(),
        email: updatedEmail,
        phone: formData.phone.trim() || null,
        jobRole: formData.jobRole.trim() || null,
        cau: formData.cau.trim() || null,
        bio: formData.bio.trim() || null,
        avatarUrl: formData.avatarUrl.trim() || null,
      })
      setIsEditing(false)

      if (res.emailChangePending) {
        await showAlert({
          title: 'Confirmação de E-mail Pendente',
          message: `Um link de confirmação foi enviado para ${formData.email}. Por favor, clique no link recebido em sua caixa de entrada para concluir a troca do seu login.`,
          variant: 'info',
        })
      } else {
        showToast('Perfil e dados de acesso atualizados com sucesso!')
      }
    } else {
      await showAlert({
        title: 'Erro ao salvar perfil',
        message: res.error || 'Erro ao atualizar dados do perfil.',
        variant: 'error',
      })
    }
  }

  // Save New Password (with Current Password check)
  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!passwordData.currentPassword) {
      await showAlert({
        title: 'Senha Atual Obrigatória',
        message: 'Por favor, digite sua senha atual para validação de segurança.',
        variant: 'warning',
      })
      return
    }

    if (!passwordData.newPassword) return

    if (passwordData.newPassword.length < 6) {
      await showAlert({
        title: 'Senha muito curta',
        message: 'A nova senha deve ter no mínimo 6 caracteres.',
        variant: 'warning',
      })
      return
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      await showAlert({
        title: 'Senhas não coincidem',
        message: 'A confirmação de senha é diferente da nova senha digitada.',
        variant: 'warning',
      })
      return
    }

    if (passwordData.currentPassword === passwordData.newPassword) {
      await showAlert({
        title: 'Senha idêntica',
        message: 'A nova senha deve ser diferente da senha atual.',
        variant: 'warning',
      })
      return
    }

    setSavingPassword(true)
    const data = new FormData()
    data.append('currentPassword', passwordData.currentPassword)
    data.append('newPassword', passwordData.newPassword)
    data.append('confirmPassword', passwordData.confirmPassword)

    const res = await updateUserPasswordAction(data)
    setSavingPassword(false)

    if (res.success) {
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' })
      showToast('Senha de acesso atualizada com sucesso!')
    } else {
      let errorMsg = res.error || 'Erro ao atualizar senha.'
      if (errorMsg.toLowerCase().includes('new password should be different')) {
        errorMsg = 'A nova senha deve ser diferente da senha atual.'
      }
      await showAlert({
        title: 'Erro ao atualizar senha',
        message: errorMsg,
        variant: 'error',
      })
    }
  }

  // Send Password Reset Email (Supabase Recovery Link)
  const handleSendResetEmail = async () => {
    const ok = await confirm({
      title: 'Redefinir Senha por E-mail',
      message: `Deseja enviar um link oficial de redefinição de senha para o e-mail ${profile.email}?`,
      confirmText: 'Enviar Link',
      cancelText: 'Cancelar',
      variant: 'primary',
    })

    if (!ok) return

    setSendingResetEmail(true)
    const res = await sendPasswordResetEmailAction()
    setSendingResetEmail(false)

    if (res.success) {
      await showAlert({
        title: 'E-mail Enviado!',
        message: res.message || 'Verifique sua caixa de entrada e spam para redefinir sua senha.',
        variant: 'success',
      })
    } else {
      await showAlert({
        title: 'Erro ao enviar e-mail',
        message: res.error || 'Não foi possível enviar o e-mail de recuperação.',
        variant: 'error',
      })
    }
  }

  // User Initials
  const getInitials = (name: string) => {
    if (!name) return 'AR'
    const parts = name.trim().split(' ')
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
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
            setFormData({ ...formData, avatarUrl: croppedUrl })
            setCropperRawImage(null)
            showToast('Foto de perfil ajustada com sucesso!')
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
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
          <User className="w-6 h-6 text-blue-600" /> Meu Perfil
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Gerencie suas informações pessoais, foto de exibição e credenciais de segurança.
        </p>
      </div>

      {/* Profile Card: View Mode or Edit Mode */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <BadgeCheck className="w-4 h-4 text-blue-600" /> Dados Pessoais & Exibição
          </h2>

          {!isEditing && (
            <button
              type="button"
              onClick={() => {
                setFormData({
                  fullName: profile.fullName || '',
                  email: profile.email || '',
                  phone: profile.phone ? maskPhone(profile.phone) : '',
                  jobRole: profile.jobRole || '',
                  cau: profile.cau || '',
                  bio: profile.bio || '',
                  avatarUrl: profile.avatarUrl || '',
                })
                setIsEditing(true)
              }}
              className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-xl bg-white border border-slate-200 text-slate-700 hover:text-blue-600 hover:bg-slate-50 text-xs font-bold transition-all shadow-2xs cursor-pointer"
            >
              <Edit2 className="w-3.5 h-3.5" /> Editar Informações
            </button>
          )}
        </div>

        {isEditing ? (
          /* ============================================================ */
          /*                       EDIT MODE FORM                         */
          /* ============================================================ */
          <form onSubmit={handleSaveProfile} className="space-y-5">
            {/* Avatar Section */}
            <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-extrabold text-lg shadow-sm border-2 border-white overflow-hidden shrink-0">
                  {formData.avatarUrl ? (
                    <img src={formData.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span>{getInitials(formData.fullName || profile.email)}</span>
                  )}
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Foto de Perfil</span>
                  <p className="text-[11px] text-slate-500">
                    Sua foto aparecerá nos comentários, histórico de tarefas e no menu da barra lateral.
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
                  {formData.avatarUrl ? 'Trocar Foto' : 'Anexar Foto'}
                </button>

                {formData.avatarUrl && (
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, avatarUrl: '' })}
                    className="p-2 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors shadow-2xs cursor-pointer"
                    title="Remover Foto"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Form Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Nome Completo (será exibido no sistema) *
                </label>
                <input
                  type="text"
                  required
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  placeholder="Ex: Arq. Felipe Conte"
                  className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-hidden focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  E-mail de Acesso (Login) *
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="seu.email@exemplo.com"
                    className="w-full text-xs border border-slate-200 rounded-xl p-2.5 pl-8 outline-hidden focus:border-blue-500"
                  />
                  <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Alterar este e-mail atualizará suas credenciais de login no sistema.
                </p>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Cargo / Especialidade</label>
                <input
                  type="text"
                  value={formData.jobRole}
                  onChange={(e) => setFormData({ ...formData, jobRole: e.target.value })}
                  placeholder="Ex: Arquiteto Titular, Coordenador de Projetos"
                  className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-hidden focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Registro CAU Pessoal</label>
                <input
                  type="text"
                  value={formData.cau}
                  onChange={(e) => setFormData({ ...formData, cau: e.target.value })}
                  placeholder="Ex: A123456-7"
                  className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-hidden focus:border-blue-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-slate-700 block mb-1">Telefone / WhatsApp</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: maskPhone(e.target.value) })}
                  placeholder="(11) 98765-4321"
                  className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-hidden focus:border-blue-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-slate-700 block mb-1">Mini Bio / Especialidades</label>
                <textarea
                  rows={3}
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  placeholder="Breve descrição sobre sua trajetória e foco de atuação..."
                  className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-hidden focus:border-blue-500 resize-none"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setFormData({
                    fullName: profile.fullName || '',
                    email: profile.email || '',
                    phone: profile.phone ? maskPhone(profile.phone) : '',
                    jobRole: profile.jobRole || '',
                    cau: profile.cau || '',
                    bio: profile.bio || '',
                    avatarUrl: profile.avatarUrl || '',
                  })
                  setIsEditing(false)
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={savingProfile || !formData.fullName.trim() || !formData.email.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {savingProfile && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {savingProfile ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </form>
        ) : (
          /* ============================================================ */
          /*                       VIEW MODE DISPLAY                      */
          /* ============================================================ */
          <div className="space-y-6">
            {/* Header with Avatar and Basic Info */}
            <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
              <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-extrabold text-lg shadow-sm border-2 border-white overflow-hidden shrink-0">
                {profile.avatarUrl ? (
                  <img src={profile.avatarUrl} alt={profile.fullName} className="w-full h-full object-cover" />
                ) : (
                  <span>{getInitials(profile.fullName || profile.email)}</span>
                )}
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">{profile.fullName}</h3>
                <div className="flex flex-wrap items-center gap-2 mt-0.5">
                  <span className="text-xs text-slate-500 font-medium">
                    {profile.jobRole || 'Membro da Equipe'}
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 capitalize">
                    {role}
                  </span>
                </div>
              </div>
            </div>

            {/* Read-Only Information Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 text-xs">
              <div className="space-y-1">
                <span className="font-semibold text-slate-400 block">E-mail de Acesso (Login)</span>
                <span className="text-slate-800 font-medium block flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  {profile.email}
                </span>
              </div>

              <div className="space-y-1">
                <span className="font-semibold text-slate-400 block">Cargo / Especialidade</span>
                <span className="text-slate-800 font-medium block">
                  {profile.jobRole || 'Não informado'}
                </span>
              </div>

              <div className="space-y-1">
                <span className="font-semibold text-slate-400 block">Registro CAU Pessoal</span>
                <span className="text-slate-800 font-medium block">
                  {profile.cau || 'Não informado'}
                </span>
              </div>

              <div className="space-y-1">
                <span className="font-semibold text-slate-400 block">Telefone / WhatsApp</span>
                <span className="text-slate-800 font-medium block">
                  {profile.phone ? maskPhone(profile.phone) : 'Não informado'}
                </span>
              </div>

              <div className="sm:col-span-2 space-y-1">
                <span className="font-semibold text-slate-400 block">Mini Bio / Especialidades</span>
                <p className="text-slate-700 font-normal leading-relaxed">
                  {profile.bio || 'Nenhuma biografia informada.'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Security & Password Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-6">
        <div className="pb-3 border-b border-slate-100">
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-600" /> Segurança & Troca de Senha
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Atualize sua senha informando sua senha atual ou solicite um link de redefinição por e-mail.
          </p>
        </div>

        {/* Option 1: Direct Password Change with Current Password verification */}
        <form onSubmit={handleSavePassword} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Senha Atual *</label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                  placeholder="Sua senha atual"
                  className="w-full text-xs border border-slate-200 rounded-xl p-2.5 pl-8 outline-hidden focus:border-blue-500"
                />
                <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Nova Senha *</label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full text-xs border border-slate-200 rounded-xl p-2.5 pl-8 outline-hidden focus:border-blue-500"
                />
                <Key className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Confirmar Nova Senha *</label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  placeholder="Repita a nova senha"
                  className="w-full text-xs border border-slate-200 rounded-xl p-2.5 pl-8 outline-hidden focus:border-blue-500"
                />
                <Key className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={savingPassword || !passwordData.currentPassword || !passwordData.newPassword}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {savingPassword && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {savingPassword ? 'Validando e Alterando...' : 'Alterar Senha'}
            </button>
          </div>
        </form>

        {/* Option 2: Alternative recovery link via email */}
        <div className="p-4 bg-slate-50/80 border border-slate-200/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-800 block">
                Esqueceu sua senha atual?
              </span>
              <p className="text-[11px] text-slate-500">
                Você pode solicitar um link de redefinição de senha oficial do Supabase Auth para o seu e-mail cadastrado ({profile.email}).
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSendResetEmail}
            disabled={sendingResetEmail}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:border-blue-300 hover:text-blue-600 text-slate-700 text-xs font-bold transition-all shadow-2xs cursor-pointer shrink-0 disabled:opacity-50"
          >
            {sendingResetEmail ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
            ) : (
              <Send className="w-3.5 h-3.5 text-blue-600" />
            )}
            <span>{sendingResetEmail ? 'Enviando...' : 'Enviar Link por E-mail'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
