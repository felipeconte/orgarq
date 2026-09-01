'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  Users,
  UserPlus,
  Search,
  Building,
  User,
  Mail,
  Phone,
  FolderGit2,
  Edit2,
  Trash2,
  ExternalLink,
  Plus,
  Sparkles,
  MapPin,
  CheckCircle2,
  FileText,
  Filter,
} from 'lucide-react'
import { ClientData, deleteClientAction } from '@/lib/actions/clients'
import { maskCPFOrCNPJ, maskPhone } from '@/lib/formatters-and-validators'
import ClientModal from './ClientModal'
import ClientUpdateRequestsBanner from './ClientUpdateRequestsBanner'
import { useConfirm, useAlert } from '@/components/ui/ConfirmDialog'

export interface ClientsManagerClientProps {
  initialClients: ClientData[]
  organizationId?: string
}

export default function ClientsManagerClient({
  initialClients,
  organizationId,
}: ClientsManagerClientProps) {
  const [clients, setClients] = useState<ClientData[]>(initialClients)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'ativo' | 'inativo'>('all')
  const [typeFilter, setTypeFilter] = useState<'all' | 'PF' | 'PJ'>('all')

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [clientToEdit, setClientToEdit] = useState<ClientData | null>(null)

  const confirm = useConfirm()
  const showAlert = useAlert()

  // Filtered Clients
  const filteredClients = useMemo(() => {
    return clients.filter((c) => {
      const matchSearch =
        search === '' ||
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        (c.document_number && c.document_number.includes(search.replace(/\D/g, ''))) ||
        (c.email && c.email.toLowerCase().includes(search.toLowerCase())) ||
        (c.phone && c.phone.includes(search.replace(/\D/g, ''))) ||
        (c.city && c.city.toLowerCase().includes(search.toLowerCase()))

      const matchStatus = statusFilter === 'all' || c.status === statusFilter
      const matchType = typeFilter === 'all' || c.person_type === typeFilter

      return matchSearch && matchStatus && matchType
    })
  }, [clients, search, statusFilter, typeFilter])

  // Summary Metrics
  const metrics = useMemo(() => {
    const total = clients.length
    const active = clients.filter((c) => c.status === 'ativo').length
    const totalProjects = clients.reduce((acc, c) => acc + (c.projects_count || 0), 0)
    return { total, active, totalProjects }
  }, [clients])

  // Handlers
  const handleOpenCreate = () => {
    setClientToEdit(null)
    setIsModalOpen(true)
  }

  const handleOpenEdit = (client: ClientData) => {
    setClientToEdit(client)
    setIsModalOpen(true)
  }

  const handleModalSuccess = (savedClient: ClientData) => {
    setClients((prev) => {
      const exists = prev.some((c) => c.id === savedClient.id)
      if (exists) {
        return prev.map((c) => (c.id === savedClient.id ? { ...savedClient, projects_count: c.projects_count } : c))
      }
      return [savedClient, ...prev]
    })
  }

  const handleDeleteClient = async (client: ClientData) => {
    const confirmed = await confirm({
      title: 'Excluir Cliente',
      message: `Tem certeza que deseja excluir o cliente "${client.name}"?`,
      confirmText: 'Excluir',
      cancelText: 'Cancelar',
      variant: 'danger',
    })

    if (!confirmed) return

    const res = await deleteClientAction(client.id)
    if (res.success) {
      setClients((prev) => prev.filter((c) => c.id !== client.id))
      showAlert({
        title: 'Sucesso',
        message: 'Cliente excluído com sucesso.',
        variant: 'success',
      })
    } else {
      showAlert({
        title: 'Erro',
        message: res.error || 'Erro ao excluir cliente.',
        variant: 'error',
      })
    }
  }

  const getInitials = (name: string) => {
    if (!name) return 'CL'
    const parts = name.trim().split(' ')
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }

  return (
    <div className="space-y-6 antialiased">
      {/* 0. BANNER DE SOLICITAÇÕES DE ATUALIZAÇÃO CADASTRAL PENDENTES */}
      <ClientUpdateRequestsBanner onRefreshClients={() => window.location.reload()} />

      {/* 1. TOP METRICS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
              Total de Clientes
            </span>
            <span className="text-2xl font-extrabold text-slate-900 font-mono mt-1 block">
              {metrics.total}
            </span>
          </div>
          <div className="h-11 w-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
              Clientes Ativos
            </span>
            <span className="text-2xl font-extrabold text-emerald-600 font-mono mt-1 block">
              {metrics.active}
            </span>
          </div>
          <div className="h-11 w-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
              Projetos Vinculados
            </span>
            <span className="text-2xl font-extrabold text-indigo-600 font-mono mt-1 block">
              {metrics.totalProjects}
            </span>
          </div>
          <div className="h-11 w-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            <FolderGit2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 2. FILTERS & SEARCH BAR */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3 w-full md:w-auto flex-1 max-w-xl">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, CPF/CNPJ, e-mail, telefone ou cidade..."
              className="w-full text-xs font-semibold pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-800"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-700 outline-hidden focus:border-blue-500 cursor-pointer shrink-0"
          >
            <option value="all">Status: Todos</option>
            <option value="ativo">Ativos</option>
            <option value="inativo">Inativos</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-700 outline-hidden focus:border-blue-500 cursor-pointer shrink-0"
          >
            <option value="all">Tipo: Todos</option>
            <option value="PF">Pessoa Física (PF)</option>
            <option value="PJ">Pessoa Jurídica (PJ)</option>
          </select>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="w-full md:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-sm shadow-blue-500/20 cursor-pointer"
        >
          <UserPlus className="w-4 h-4" /> Novo Cliente
        </button>
      </div>

      {/* 3. CLIENTS TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3.5 px-4">Cliente / Razão Social</th>
                <th className="py-3.5 px-4">Documento</th>
                <th className="py-3.5 px-4">Contato (E-mail / WhatsApp)</th>
                <th className="py-3.5 px-4">Localização</th>
                <th className="py-3.5 px-4 text-center">Projetos</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
              {filteredClients.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Users className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="text-sm font-semibold text-slate-600">Nenhum cliente encontrado.</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {search || statusFilter !== 'all' || typeFilter !== 'all'
                        ? 'Tente ajustar os filtros ou o termo de busca.'
                        : 'Cadastre seu primeiro cliente para vincular aos projetos.'}
                    </p>
                    <button
                      type="button"
                      onClick={handleOpenCreate}
                      className="mt-3.5 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Cadastrar Cliente
                    </button>
                  </td>
                </tr>
              )}

              {filteredClients.map((client) => {
                const rawPhoneDigits = client.phone ? client.phone.replace(/\D/g, '') : ''
                const whatsappUrl = rawPhoneDigits.length >= 10
                  ? `https://wa.me/55${rawPhoneDigits}`
                  : null

                return (
                  <tr
                    key={client.id}
                    className="hover:bg-blue-50/40 transition-colors group cursor-pointer"
                    onClick={() => {
                      window.location.href = `/app/clientes/${client.id}`
                    }}
                  >
                    {/* Nome & Avatar */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-xl font-bold text-xs flex items-center justify-center shrink-0 ${
                          client.person_type === 'PJ'
                            ? 'bg-purple-100 text-purple-700 border border-purple-200'
                            : 'bg-blue-100 text-blue-700 border border-blue-200'
                        }`}>
                          {client.person_type === 'PJ' ? <Building className="w-4 h-4" /> : getInitials(client.name)}
                        </div>
                        <div>
                          <span className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors block">
                            {client.name}
                          </span>
                          <span className="text-[10px] text-slate-400 font-semibold uppercase">
                            {client.person_type === 'PJ' ? 'Pessoa Jurídica' : 'Pessoa Física'}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Documento (CPF / CNPJ) */}
                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600">
                      {client.document_number ? (
                        maskCPFOrCNPJ(client.document_number, client.person_type)
                      ) : (
                        <span className="text-slate-300 italic">Não informado</span>
                      )}
                    </td>

                    {/* Contatos */}
                    <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                      <div className="space-y-1">
                        {client.phone && (
                          <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-700">
                            <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                            {whatsappUrl ? (
                              <a
                                href={whatsappUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-emerald-600 hover:underline font-bold transition-colors"
                                title="Abrir conversa no WhatsApp"
                              >
                                {maskPhone(client.phone)}
                              </a>
                            ) : (
                              <span>{maskPhone(client.phone)}</span>
                            )}
                          </div>
                        )}
                        {client.email && (
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                            <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                            <a
                              href={`mailto:${client.email}`}
                              className="hover:text-blue-600 hover:underline truncate max-w-[180px] block"
                            >
                              {client.email}
                            </a>
                          </div>
                        )}
                        {!client.phone && !client.email && (
                          <span className="text-slate-300 italic text-[11px]">Sem contatos</span>
                        )}
                      </div>
                    </td>

                    {/* Localização */}
                    <td className="py-3.5 px-4 text-slate-600 text-[11px]">
                      {client.city || client.state ? (
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>
                            {client.city ? `${client.city}` : ''}
                            {client.city && client.state ? ' - ' : ''}
                            {client.state || ''}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-300 italic">-</span>
                      )}
                    </td>

                    {/* Projetos Vinculados */}
                    <td className="py-3.5 px-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold font-mono border ${
                        (client.projects_count || 0) > 0
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : 'bg-slate-50 text-slate-400 border-slate-200'
                      }`}>
                        <FolderGit2 className="w-3.5 h-3.5" />
                        {client.projects_count || 0}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        client.status === 'ativo'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          client.status === 'ativo' ? 'bg-emerald-500' : 'bg-slate-400'
                        }`} />
                        {client.status === 'ativo' ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>

                    {/* Ações */}
                    <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/app/projetos/novo?clientId=${client.id}`}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          title="Criar novo projeto para este cliente"
                        >
                          <Plus className="w-4 h-4" />
                        </Link>

                        <button
                          type="button"
                          onClick={() => handleOpenEdit(client)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          title="Editar cadastro do cliente"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteClient(client)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Excluir cliente"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. MODAL DE CADASTRO / EDIÇÃO */}
      <ClientModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        clientToEdit={clientToEdit}
        organizationId={organizationId}
        onSuccess={handleModalSuccess}
      />
    </div>
  )
}
