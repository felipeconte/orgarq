'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Building,
  User,
  Mail,
  Phone,
  MapPin,
  FileText,
  Edit2,
  Plus,
  FolderGit2,
  Calendar,
  DollarSign,
  Compass,
  CheckCircle2,
  MessageCircle,
  KeyRound,
  Send,
  Loader2,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react'
import { ClientData, ClientProjectItem, resendClientPortalAccessAction } from '@/lib/actions/clients'
import { maskCPFOrCNPJ, maskPhone, maskCEP } from '@/lib/formatters-and-validators'
import { formatDateBR } from '@/lib/date-utils'
import { useConfirm, useAlert } from '@/components/ui/ConfirmDialog'
import ClientModal from './ClientModal'

export interface ClientDetailClientProps {
  client: ClientData
  projects: ClientProjectItem[]
  organizationId?: string
}

export default function ClientDetailClient({
  client: initialClient,
  projects,
  organizationId,
}: ClientDetailClientProps) {
  const confirm = useConfirm()
  const showAlert = useAlert()
  const [client, setClient] = useState<ClientData>(initialClient)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [resendingAccess, setResendingAccess] = useState(false)

  const handleResendAccess = async () => {
    if (!client.document_number) {
      await showAlert({
        title: 'CPF Necessário',
        message: 'O cliente precisa ter um CPF cadastrado para ter acesso ao portal.',
        variant: 'warning',
      })
      return
    }

    if (!client.email) {
      await showAlert({
        title: 'E-mail Necessário',
        message: 'O cliente precisa ter um e-mail cadastrado para receber as credenciais.',
        variant: 'warning',
      })
      return
    }

    const confirmed = await confirm({
      title: 'Reenviar Acesso ao Portal',
      message: `Deseja gerar uma nova senha e enviar diretamente para o e-mail do cliente (${client.email})?`,
      description: 'Por segurança e privacidade, a senha é gerada no servidor e enviada exclusivamente para o cliente.',
      confirmText: 'Gerar e Enviar Senha',
      cancelText: 'Cancelar',
      variant: 'primary',
    })

    if (!confirmed) return

    setResendingAccess(true)
    const res = await resendClientPortalAccessAction(client.id)
    setResendingAccess(false)

    if (res.success) {
      await showAlert({
        title: 'Acesso Enviado',
        message: res.message || 'Credenciais enviadas com sucesso para o e-mail do cliente.',
        variant: 'success',
      })
    } else {
      await showAlert({
        title: 'Erro ao Enviar Acesso',
        message: res.error || 'Não foi possível gerar e enviar o acesso do cliente.',
        variant: 'error',
      })
    }
  }

  const rawPhoneDigits = client.phone ? client.phone.replace(/\D/g, '') : ''
  const whatsappUrl = rawPhoneDigits.length >= 10
    ? `https://wa.me/55${rawPhoneDigits}`
    : null

  const getInitials = (name: string) => {
    if (!name) return 'CL'
    const parts = name.trim().split(' ')
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }

  const formatCurrencyBRL = (val?: number | null) => {
    if (val == null) return null
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
  }

  return (
    <div className="space-y-6 antialiased max-w-7xl mx-auto">
      {/* 1. TOP BREADCRUMB & ACTIONS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/app/clientes"
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-blue-600 hover:bg-slate-50 transition-all shadow-2xs"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                {client.name}
              </h1>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                client.status === 'ativo'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}>
                {client.status === 'ativo' ? 'Ativo' : 'Inativo'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {client.person_type === 'PJ' ? 'Pessoa Jurídica' : 'Pessoa Física'} • {projects.length} projeto(s) vinculado(s)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsEditModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:text-blue-600 hover:bg-slate-50 text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            <Edit2 className="w-3.5 h-3.5" /> Editar Cadastro
          </button>

          <Link
            href={`/app/projetos/novo?clientId=${client.id}`}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-sm shadow-blue-500/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Novo Projeto para este Cliente
          </Link>
        </div>
      </div>

      {/* 2. CLIENT METADATA CARD */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Identificação e Documentos */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-2xl font-extrabold text-base flex items-center justify-center shrink-0 ${
              client.person_type === 'PJ'
                ? 'bg-purple-100 text-purple-700 border border-purple-200'
                : 'bg-blue-100 text-blue-700 border border-blue-200'
            }`}>
              {client.person_type === 'PJ' ? <Building className="w-6 h-6" /> : getInitials(client.name)}
            </div>
            <div className="min-w-0 flex-1">
              <span className="font-extrabold text-slate-900 text-sm block truncate">
                {client.name}
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {client.document_number
                  ? `${client.person_type === 'PJ' ? 'CNPJ: ' : 'CPF: '}${maskCPFOrCNPJ(client.document_number, client.person_type)}`
                  : 'Documento não informado'}
              </span>
            </div>
          </div>

          <div className="space-y-2 pt-3 border-t border-slate-100 text-xs">
            <div className="flex items-center justify-between text-slate-500">
              <span>Tipo de Pessoa:</span>
              <strong className="text-slate-800">{client.person_type === 'PJ' ? 'Jurídica (PJ)' : 'Física (PF)'}</strong>
            </div>
            <div className="flex items-center justify-between text-slate-500">
              <span>Status:</span>
              <strong className={client.status === 'ativo' ? 'text-emerald-700' : 'text-slate-600'}>
                {client.status === 'ativo' ? 'Ativo' : 'Inativo'}
              </strong>
            </div>
          </div>
        </div>

        {/* Canais de Contato */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Canais de Contato
          </span>

          <div className="space-y-2.5 text-xs">
            {client.phone ? (
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-2 text-slate-700 font-mono font-bold">
                  <Phone className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span>{maskPhone(client.phone)}</span>
                </div>
                {whatsappUrl && (
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 py-1 px-2.5 rounded-lg bg-emerald-100 text-emerald-800 hover:bg-emerald-200 text-[11px] font-bold transition-all"
                  >
                    <MessageCircle className="w-3 h-3 text-emerald-700" /> WhatsApp
                  </a>
                )}
              </div>
            ) : (
              <p className="text-slate-400 italic text-xs">Telefone não cadastrado</p>
            )}

            {client.email ? (
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-2 text-slate-700 truncate">
                  <Mail className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span className="truncate">{client.email}</span>
                </div>
                <a
                  href={`mailto:${client.email}`}
                  className="text-blue-600 hover:underline text-[11px] font-bold shrink-0 ml-2"
                >
                  Enviar E-mail
                </a>
              </div>
            ) : (
              <p className="text-slate-400 italic text-xs">E-mail não cadastrado</p>
            )}

            {/* Acesso ao Portal do Cliente */}
            <div className="pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={handleResendAccess}
                disabled={resendingAccess}
                className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200/80 hover:border-blue-300 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
              >
                {resendingAccess ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Enviando Acesso...
                  </>
                ) : (
                  <>
                    <KeyRound className="w-3.5 h-3.5 text-blue-600" /> Reenviar Acesso ao Portal
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Endereço e Localização */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Endereço & Localização
          </span>

          <div className="space-y-1.5 text-xs text-slate-600">
            {client.address ? (
              <p className="font-semibold text-slate-800">{client.address}</p>
            ) : null}

            {client.city || client.state ? (
              <p className="flex items-center gap-1.5 text-slate-600">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>
                  {client.city ? `${client.city}` : ''}
                  {client.city && client.state ? ' - ' : ''}
                  {client.state || ''}
                </span>
                {client.zip_code && (
                  <span className="font-mono text-slate-400">({maskCEP(client.zip_code)})</span>
                )}
              </p>
            ) : null}

            {!client.address && !client.city && !client.state && (
              <p className="text-slate-400 italic text-xs">Endereço não informado</p>
            )}

            {client.notes && (
              <div className="mt-2 pt-2 border-t border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Notas Internas:</span>
                <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-2">{client.notes}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. PROJETOS VINCULADOS */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <FolderGit2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                Projetos Vinculados ({projects.length})
              </h3>
              <p className="text-xs text-slate-500">
                Todos os projetos de arquitetura e design vinculados a este cliente.
              </p>
            </div>
          </div>

          <Link
            href={`/app/projetos/novo?clientId=${client.id}`}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold transition-all cursor-pointer w-fit"
          >
            <Plus className="w-3.5 h-3.5" /> Adicionar Projeto
          </Link>
        </div>

        {projects.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <FolderGit2 className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-semibold text-slate-600">Nenhum projeto vinculado a este cliente.</p>
            <p className="text-xs text-slate-400 mt-1">
              Crie o primeiro projeto para começar o cronograma e aprovações no portal.
            </p>
            <Link
              href={`/app/projetos/novo?clientId=${client.id}`}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Criar Primeiro Projeto
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((proj) => {
              const prog = proj.progress_percent || 0
              return (
                <Link
                  key={proj.id}
                  href={`/app/projetos/${proj.id}`}
                  className="p-5 rounded-2xl border border-slate-200/80 bg-slate-50/40 hover:bg-white hover:border-blue-300 hover:shadow-md transition-all group space-y-3 block"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200">
                      {proj.code}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      proj.status === 'concluido'
                        ? 'bg-emerald-100 text-emerald-800'
                        : proj.status === 'pausado'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {proj.status}
                    </span>
                  </div>

                  <div>
                    <h4 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors text-sm">
                      {proj.title}
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {proj.typology || 'Residencial'} {proj.area_sqm ? `• ${proj.area_sqm} m²` : ''}
                    </p>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 font-medium">Progresso</span>
                      <span className="font-mono font-bold text-blue-600">{prog}%</span>
                    </div>
                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-blue-600 h-full rounded-full transition-all duration-300"
                        style={{ width: `${prog}%` }}
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200/70 flex items-center justify-between text-xs text-slate-500">
                    <span>Prazo: {formatDateBR(proj.deadline) || 'Sem prazo'}</span>
                    <span className="text-blue-600 font-bold group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                      Abrir <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      <ClientModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        clientToEdit={client}
        organizationId={organizationId}
        onSuccess={(updated) => setClient(updated)}
      />
    </div>
  )
}
