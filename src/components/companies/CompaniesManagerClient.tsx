'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  Building2,
  Plus,
  Search,
  Filter,
  Grid,
  List,
  Phone,
  Mail,
  MapPin,
  Percent,
  Star,
  MoreVertical,
  Edit2,
  Trash2,
  ExternalLink,
  DollarSign,
  FolderGit2,
  Sparkles,
  CheckCircle2,
  Clock,
  Briefcase
} from 'lucide-react'
import {
  deleteCompanyAction
} from '@/lib/actions/companies'
import {
  CompanyData,
  COMPANY_CATEGORIES
} from '@/types/companies'
import { cleanDigits, maskPhone } from '@/lib/formatters-and-validators'
import CompanyModal from './CompanyModal'

interface CompaniesManagerClientProps {
  initialCompanies: CompanyData[]
  organizationId: string
}

export default function CompaniesManagerClient({
  initialCompanies,
  organizationId,
}: CompaniesManagerClientProps) {
  const [companies, setCompanies] = useState<CompanyData[]>(initialCompanies)
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('todas')
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCompany, setEditingCompany] = useState<CompanyData | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Dynamic list of all categories in the system
  const allCategories = useMemo(() => {
    const set = new Set<string>(COMPANY_CATEGORIES)
    companies.forEach((c) => {
      if (Array.isArray(c.categories)) {
        c.categories.forEach((cat) => {
          if (cat && typeof cat === 'string') set.add(cat.trim())
        })
      }
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [companies])

  // Filtered companies
  const filteredCompanies = useMemo(() => {
    return companies.filter((c) => {
      // Search
      if (search.trim()) {
        const query = search.toLowerCase()
        const matchName = c.name?.toLowerCase().includes(query)
        const matchTrade = c.trade_name?.toLowerCase().includes(query)
        const matchContact = c.contact_name?.toLowerCase().includes(query)
        const matchCity = c.city?.toLowerCase().includes(query)
        const matchContactsList = Array.isArray(c.contacts) && c.contacts.some(
          (ct) =>
            ct.name?.toLowerCase().includes(query) ||
            ct.role?.toLowerCase().includes(query) ||
            ct.phone?.toLowerCase().includes(query) ||
            ct.email?.toLowerCase().includes(query)
        )
        if (!matchName && !matchTrade && !matchContact && !matchCity && !matchContactsList) {
          return false
        }
      }

      // Category
      if (selectedCategory !== 'todas') {
        if (!Array.isArray(c.categories) || !c.categories.includes(selectedCategory)) {
          return false
        }
      }

      return true
    })
  }, [companies, search, selectedCategory])

  // Aggregate Metrics
  const metrics = useMemo(() => {
    let totalReceived = 0
    let totalPending = 0

    companies.forEach((c) => {
      totalReceived += Number(c.total_commission_received || 0)
      totalPending += Number(c.total_commission_pending || 0)
    })

    return {
      total: companies.length,
      received: totalReceived,
      pending: totalPending,
    }
  }, [companies])

  const handleOpenNew = () => {
    setEditingCompany(null)
    setIsModalOpen(true)
  }

  const handleOpenEdit = (company: CompanyData) => {
    setEditingCompany(company)
    setIsModalOpen(true)
  }

  const handleSaved = (savedCompany: CompanyData) => {
    setCompanies((prev) => {
      const idx = prev.findIndex((c) => c.id === savedCompany.id)
      if (idx >= 0) {
        const copy = [...prev]
        copy[idx] = savedCompany
        return copy
      }
      return [savedCompany, ...prev]
    })
  }

  const handleDelete = async (companyId: string, name: string) => {
    if (!window.confirm(`Tem certeza que deseja excluir "${name}"? Esta ação removerá os vínculos e histórico de serviços desta empresa.`)) {
      return
    }

    setDeletingId(companyId)
    const res = await deleteCompanyAction(companyId)
    setDeletingId(null)

    if (res.success) {
      setCompanies((prev) => prev.filter((c) => c.id !== companyId))
    } else {
      alert(res.error || 'Erro ao excluir empresa.')
    }
  }

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val)
  }

  return (
    <div className="space-y-6">
      {/* Metric Cards Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total de Parceiros */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 block">Total de Parceiros</span>
            <span className="text-2xl font-black text-slate-900 mt-1 block">
              {metrics.total}
            </span>
            <span className="text-[11px] font-medium text-slate-400 mt-0.5 block">
              empresas e prestadores
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-2xs">
            <Building2 className="w-6 h-6" />
          </div>
        </div>

        {/* Card 2: Especialidades Atendidas */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 block">Categorias & Serviços</span>
            <span className="text-2xl font-black text-slate-900 mt-1 block">
              {new Set(companies.flatMap((c) => c.categories || [])).size}
            </span>
            <span className="text-[11px] font-medium text-slate-400 mt-0.5 block">
              especialidades cadastradas
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-2xs">
            <Briefcase className="w-6 h-6" />
          </div>
        </div>

        {/* Card 3: Comissões Recebidas */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 block">Comissões Recebidas (RT)</span>
            <span className="text-xl font-black text-emerald-600 mt-1 block">
              {formatCurrency(metrics.received)}
            </span>
            <span className="text-[11px] font-medium text-emerald-700/80 mt-0.5 block flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Total faturado pelo escritório
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-2xs">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        {/* Card 4: Comissões Previstas / Pendentes */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 block">Comissões Previstas</span>
            <span className="text-xl font-black text-amber-600 mt-1 block">
              {formatCurrency(metrics.pending)}
            </span>
            <span className="text-[11px] font-medium text-amber-700/80 mt-0.5 block flex items-center gap-1">
              <Clock className="w-3 h-3" /> A receber de projetos ativos
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shadow-2xs">
            <Percent className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Control Bar: Search, Category Filter, Status Filter, Mode & Add Button */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Buscar por empresa, nome fantasia, representante ou cidade..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
          />
        </div>

        {/* Filters and Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
          >
            <option value="todas">Todas as Especialidades</option>
            {allCategories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setViewMode('grid')}
              title="Visualização em Grade"
              className={`p-1.5 rounded-lg text-xs font-medium transition-all ${
                viewMode === 'grid'
                  ? 'bg-white text-indigo-600 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              title="Visualização em Tabela"
              className={`p-1.5 rounded-lg text-xs font-medium transition-all ${
                viewMode === 'table'
                  ? 'bg-white text-indigo-600 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Add Company Button */}
          <button
            onClick={handleOpenNew}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs shadow-indigo-500/20 shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Nova Empresa
          </button>
        </div>
      </div>

      {/* Content Rendering: GRID or TABLE */}
      {filteredCompanies.length === 0 ? (
        /* Empty State */
        <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center max-w-xl mx-auto my-8 shadow-xs">
          <div className="w-16 h-16 rounded-3xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mx-auto mb-4 shadow-xs">
            <Briefcase className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-800">
            {search || selectedCategory !== 'todas'
              ? 'Nenhuma empresa encontrada com estes filtros'
              : 'Nenhuma empresa ou parceiro cadastrado ainda'}
          </h3>
          <p className="text-xs text-slate-500 mt-1.5 max-w-sm mx-auto leading-relaxed">
            {search || selectedCategory !== 'todas'
              ? 'Tente ajustar os termos de busca ou remover os filtros aplicados.'
              : 'Cadastre marcenarias, marmorarias, lojas de iluminação e outros prestadores de serviços para vincular aos seus projetos e gerenciar comissões.'}
          </p>

          <div className="mt-6 flex items-center justify-center gap-3">
            {search || selectedCategory !== 'todas' ? (
              <button
                onClick={() => {
                  setSearch('')
                  setSelectedCategory('todas')
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all"
              >
                Limpar Filtros
              </button>
            ) : null}
            <button
              onClick={handleOpenNew}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs shadow-indigo-500/20"
            >
              <Plus className="w-4 h-4" /> Cadastrar Primeira Empresa
            </button>
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCompanies.map((company) => {
            const primaryContact = Array.isArray(company.contacts) && company.contacts.length > 0
              ? company.contacts.find((c) => c.is_primary) || company.contacts[0]
              : null
            const extraContactsCount = Array.isArray(company.contacts) && company.contacts.length > 1
              ? company.contacts.length - 1
              : 0

            const effectivePhone = primaryContact?.phone || company.phone
            const rawPhone = cleanDigits(effectivePhone)
            const waUrl = rawPhone ? `https://wa.me/55${rawPhone}` : null
            const effectiveEmail = primaryContact?.email || company.email

            return (
              <div
                key={company.id}
                className="bg-white rounded-3xl border border-slate-200/80 hover:border-indigo-300 transition-all shadow-xs hover:shadow-md flex flex-col justify-between overflow-hidden group"
              >
                <div className="p-5 space-y-3.5">
                  {/* Card Header: Name (Nome Fantasia em evidência) */}
                  <div className="min-w-0">
                    <Link
                      href={`/app/empresas/${company.id}`}
                      className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors block truncate"
                      title={company.trade_name || company.name}
                    >
                      {company.trade_name || company.name}
                    </Link>
                    {company.trade_name && (
                      <span className="text-[11px] font-medium text-slate-400 block truncate" title={company.name}>
                        {company.name}
                      </span>
                    )}
                  </div>

                  {/* Rating & Contact Name */}
                  <div className="flex items-center justify-between text-xs text-slate-500 pt-0.5">
                    <div className="flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                      <span className="text-xs font-bold text-slate-700">
                        {company.rating || 5}.0
                      </span>
                    </div>

                    {primaryContact ? (
                      <div className="flex items-center gap-1 min-w-0" title={primaryContact.name}>
                        <span className="text-[11px] font-semibold text-slate-700 truncate max-w-[130px]">
                          {primaryContact.name}
                        </span>
                        {extraContactsCount > 0 && (
                          <span
                            className="px-1.5 py-0.2 bg-slate-100 text-slate-500 text-[9px] font-bold rounded-md shrink-0"
                            title={`+${extraContactsCount} outros vendedores/representantes`}
                          >
                            +{extraContactsCount}
                          </span>
                        )}
                      </div>
                    ) : company.contact_name ? (
                      <span className="text-[11px] font-semibold text-slate-600 truncate max-w-[160px]">
                        {company.contact_name}
                      </span>
                    ) : null}
                  </div>

                  {/* Category Tags */}
                  <div className="flex flex-wrap gap-1">
                    {Array.isArray(company.categories) && company.categories.length > 0 ? (
                      <>
                        {company.categories.slice(0, 2).map((cat) => (
                          <span
                            key={cat}
                            className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded-lg border border-indigo-100 truncate"
                          >
                            {cat}
                          </span>
                        ))}
                        {company.categories.length > 2 && (
                          <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-lg">
                            +{company.categories.length - 2}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-[10px] text-slate-400 italic">
                        Sem especialidade definida
                      </span>
                    )}
                  </div>

                  {/* Commission Policy Box */}
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                      <span className="text-slate-400 font-medium text-[11px]">Comissão / RT:</span>
                      <span className="text-indigo-600">
                        {company.commission_type === 'percent'
                          ? `${company.commission_rate}% sobre contrato`
                          : company.commission_type === 'fixed'
                          ? formatCurrency(company.commission_rate)
                          : company.commission_type === 'negotiable'
                          ? 'Sob Negociação'
                          : 'Sem comissão'}
                      </span>
                    </div>

                    {company.commission_payment_method && (
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>Forma: {company.commission_payment_method}</span>
                        {company.commission_payment_terms && (
                          <span className="truncate max-w-[130px]" title={company.commission_payment_terms}>
                            {company.commission_payment_terms}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Projects Stats Bar */}
                  <div className="flex items-center justify-between pt-1 text-xs">
                    <div className="flex items-center gap-1.5 text-slate-600">
                      <FolderGit2 className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-semibold">{company.projects_count || 0}</span>
                      <span className="text-slate-400 text-[11px]">projetos</span>
                    </div>

                    {Number(company.total_commission_received || 0) > 0 && (
                      <span className="text-[11px] font-bold text-emerald-600">
                        {formatCurrency(Number(company.total_commission_received))} recebidos
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Footer: Quick Contact & Action Buttons */}
                <div className="px-5 py-3 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {waUrl && (
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Conversar no WhatsApp"
                        className="p-1.5 text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
                      >
                        <Phone className="w-3.5 h-3.5" />
                      </a>
                    )}

                    {effectiveEmail && (
                      <a
                        href={`mailto:${effectiveEmail}`}
                        title={`Enviar e-mail para ${effectiveEmail}`}
                        className="p-1.5 text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                      >
                        <Mail className="w-3.5 h-3.5" />
                      </a>
                    )}

                    {company.city && (
                      <span
                        className="text-[10px] text-slate-400 flex items-center gap-0.5 ml-1 truncate max-w-[110px]"
                        title={`${company.city} - ${company.state || ''}`}
                      >
                        <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                        {company.city}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEdit(company)}
                      title="Editar Empresa"
                      className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleDelete(company.id, company.name)}
                      disabled={deletingId === company.id}
                      title="Excluir Empresa"
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    <Link
                      href={`/app/empresas/${company.id}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white border border-slate-200 hover:border-indigo-300 text-slate-700 hover:text-indigo-600 text-xs font-bold rounded-xl transition-all shadow-2xs"
                    >
                      Ver Detalhes
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="bg-white rounded-3xl border border-slate-200/80 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50/80 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                <tr>
                  <th className="px-5 py-3.5">Empresa / Nome Fantasia</th>
                  <th className="px-4 py-3.5">Especialidade(s)</th>
                  <th className="px-4 py-3.5">Representante / Contato</th>
                  <th className="px-4 py-3.5">Comissão Padrão</th>
                  <th className="px-4 py-3.5">Projetos</th>
                  <th className="px-4 py-3.5">Comissões Recebidas</th>
                  <th className="px-5 py-3.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredCompanies.map((company) => {
                  const primaryContact = Array.isArray(company.contacts) && company.contacts.length > 0
                    ? company.contacts.find((c) => c.is_primary) || company.contacts[0]
                    : null
                  const extraContactsCount = Array.isArray(company.contacts) && company.contacts.length > 1
                    ? company.contacts.length - 1
                    : 0

                  const effectivePhone = primaryContact?.phone || company.phone
                  const rawPhone = cleanDigits(effectivePhone)
                  const waUrl = rawPhone ? `https://wa.me/55${rawPhone}` : null
                  const effectiveEmail = primaryContact?.email || company.email

                  return (
                    <tr
                      key={company.id}
                      className="hover:bg-slate-50/60 transition-colors group"
                    >
                      <td className="px-5 py-3.5">
                        <Link
                          href={`/app/empresas/${company.id}`}
                          className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors block"
                          title={company.trade_name || company.name}
                        >
                          {company.trade_name || company.name}
                        </Link>
                        {company.trade_name && (
                          <span className="text-[10px] text-slate-400 block" title={company.name}>
                            {company.name}
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {Array.isArray(company.categories) && company.categories.length > 0 ? (
                            company.categories.slice(0, 2).map((cat) => (
                              <span
                                key={cat}
                                className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded-lg border border-indigo-100 truncate"
                              >
                                {cat}
                              </span>
                            ))
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">-</span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        {primaryContact ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-800 text-[11px] truncate max-w-[140px]">
                                {primaryContact.name}
                              </span>
                              {primaryContact.role && (
                                <span className="text-[9px] text-slate-400 font-medium truncate max-w-[90px]">
                                  ({primaryContact.role})
                                </span>
                              )}
                              {extraContactsCount > 0 && (
                                <span
                                  className="px-1.5 py-0.2 bg-slate-100 text-slate-500 text-[9px] font-bold rounded-md"
                                  title={`+${extraContactsCount} outros vendedores/representantes`}
                                >
                                  +{extraContactsCount}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-500">
                              {waUrl && (
                                <a
                                  href={waUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-emerald-600 font-semibold hover:underline"
                                >
                                  {maskPhone(effectivePhone || '')}
                                </a>
                              )}
                              {effectiveEmail && (
                                <a
                                  href={`mailto:${effectiveEmail}`}
                                  className="text-slate-400 hover:text-blue-600"
                                  title={effectiveEmail}
                                >
                                  <Mail className="w-3 h-3 inline" />
                                </a>
                              )}
                            </div>
                          </div>
                        ) : company.contact_name ? (
                          <div className="space-y-0.5">
                            <span className="font-bold text-slate-800 block text-[11px]">
                              {company.contact_name}
                            </span>
                            <div className="flex items-center gap-2 text-[11px] text-slate-500">
                              {waUrl && (
                                <a
                                  href={waUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-emerald-600 font-semibold hover:underline"
                                >
                                  {maskPhone(company.phone || '')}
                                </a>
                              )}
                              {company.email && (
                                <a
                                  href={`mailto:${company.email}`}
                                  className="text-slate-400 hover:text-blue-600"
                                >
                                  <Mail className="w-3 h-3 inline" />
                                </a>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Sem vendedor</span>
                        )}
                      </td>

                      <td className="px-4 py-3.5 font-bold text-indigo-600">
                        {company.commission_type === 'percent'
                          ? `${company.commission_rate}%`
                          : company.commission_type === 'fixed'
                          ? formatCurrency(company.commission_rate)
                          : company.commission_type === 'negotiable'
                          ? 'Sob Consulta'
                          : 'Sem comissão'}
                      </td>

                      <td className="px-4 py-3.5">
                        <span className="font-bold text-slate-800">
                          {company.projects_count || 0}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 font-bold text-emerald-600">
                        {formatCurrency(Number(company.total_commission_received || 0))}
                      </td>

                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            href={`/app/empresas/${company.id}`}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Ver Detalhes"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Link>

                          <button
                            onClick={() => handleOpenEdit(company)}
                            title="Editar"
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleDelete(company.id, company.name)}
                            disabled={deletingId === company.id}
                            title="Excluir"
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
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
      )}

      {/* Interactive Create / Edit Modal */}
      <CompanyModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        company={editingCompany}
        organizationId={organizationId}
        onSaved={handleSaved}
      />
    </div>
  )
}
