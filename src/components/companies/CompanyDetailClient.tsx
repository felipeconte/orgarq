'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Building2,
  Phone,
  Mail,
  MapPin,
  Percent,
  DollarSign,
  Star,
  Globe,
  User,
  Clock,
  CreditCard,
  FileText,
  Edit2,
  Trash2,
  Plus,
  FolderGit2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Check
} from 'lucide-react'

function InstagramIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  )
}
import { CompanyData, CompanyProjectLink, deleteCompanyAction } from '@/lib/actions/companies'
import BackButton from '@/components/ui/BackButton'
import {
  removeProjectCompanyAction,
  quickUpdateCommissionStatusAction,
  ProjectCompanyItem
} from '@/lib/actions/project-companies'
import {
  cleanDigits,
  maskCPFOrCNPJ,
  maskPhone,
  maskCEP
} from '@/lib/formatters-and-validators'
import CompanyModal from './CompanyModal'
import LinkProjectModal from './LinkProjectModal'

interface SimpleProject {
  id: string
  code: string
  title: string
  client_name?: string | null
}

interface CompanyDetailClientProps {
  initialCompany: CompanyData
  initialProjects: CompanyProjectLink[]
  availableProjects: SimpleProject[]
  organizationId: string
}

export default function CompanyDetailClient({
  initialCompany,
  initialProjects,
  availableProjects,
  organizationId,
}: CompanyDetailClientProps) {
  const router = useRouter()
  const [company, setCompany] = useState<CompanyData>(initialCompany)
  const [projects, setProjects] = useState<CompanyProjectLink[]>(initialProjects)

  // Modals state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false)
  const [editingLink, setEditingLink] = useState<ProjectCompanyItem | null>(null)
  const [loadingActionId, setLoadingActionId] = useState<string | null>(null)

  const rawPhone = cleanDigits(company.phone)
  const waUrl = rawPhone ? `https://wa.me/55${rawPhone}` : null

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val)
  }

  const handleSavedCompany = (saved: CompanyData) => {
    setCompany(saved)
    router.refresh()
  }

  const handleDeleteCompany = async () => {
    if (!window.confirm(`Tem certeza que deseja excluir "${company.name}"?`)) {
      return
    }
    const res = await deleteCompanyAction(company.id)
    if (res.success) {
      router.push('/app/empresas')
    } else {
      alert(res.error || 'Erro ao excluir empresa.')
    }
  }

  const handleOpenNewLink = () => {
    setEditingLink(null)
    setIsLinkModalOpen(true)
  }

  const handleOpenEditLink = (link: CompanyProjectLink) => {
    setEditingLink({
      ...link,
      organization_id: company.organization_id,
      company_id: company.id,
      company_name: company.name,
      company_trade_name: company.trade_name,
      company_phone: company.phone,
      company_email: company.email,
      company_contact_name: company.contact_name,
      company_categories: company.categories,
      updated_at: link.created_at,
    })
    setIsLinkModalOpen(true)
  }

  const handleRemoveLink = async (linkId: string, projectTitle: string) => {
    if (!window.confirm(`Desvincular o serviço desta empresa no projeto "${projectTitle}"?`)) {
      return
    }
    setLoadingActionId(linkId)
    const res = await removeProjectCompanyAction(linkId)
    setLoadingActionId(null)
    if (res.success) {
      setProjects((prev) => prev.filter((p) => p.id !== linkId))
      router.refresh()
    } else {
      alert(res.error || 'Erro ao remover vínculo.')
    }
  }

  const handleMarkAsPaid = async (linkId: string) => {
    setLoadingActionId(linkId)
    const res = await quickUpdateCommissionStatusAction(linkId, 'pago_total')
    setLoadingActionId(null)
    if (res.success) {
      setProjects((prev) =>
        prev.map((p) => {
          if (p.id === linkId) {
            return {
              ...p,
              commission_status: 'pago_total',
              received_commission_amount: p.expected_commission_amount,
            }
          }
          return p
        })
      )
      router.refresh()
    } else {
      alert(res.error || 'Erro ao atualizar status da comissão.')
    }
  }

  // Aggregated totals
  const totalContract = projects.reduce((acc, p) => acc + (p.contract_value || 0), 0)
  const totalReceived = projects.reduce((acc, p) => acc + (p.received_commission_amount || 0), 0)
  const totalExpected = projects.reduce((acc, p) => acc + (p.expected_commission_amount || 0), 0)
  const totalPending = Math.max(0, totalExpected - totalReceived)

  return (
    <div className="space-y-6 antialiased max-w-7xl mx-auto">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <BackButton fallbackHref="/app/empresas" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                {company.trade_name || company.name}
              </h1>
            </div>
            {company.trade_name && (
              <p className="text-sm text-slate-500 mt-0.5">
                Razão Social: <span className="text-slate-700 font-medium">{company.name}</span>
              </p>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {waUrl && (
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 py-2 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs shadow-emerald-500/20"
            >
              <Phone className="w-3.5 h-3.5" /> WhatsApp
            </a>
          )}

          <button
            onClick={() => setIsEditModalOpen(true)}
            className="inline-flex items-center gap-1.5 py-2 px-3.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:text-indigo-600 hover:bg-slate-50 text-xs font-bold transition-all shadow-xs"
          >
            <Edit2 className="w-3.5 h-3.5" /> Editar Cadastro
          </button>

          <button
            onClick={handleOpenNewLink}
            className="inline-flex items-center gap-1.5 py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs shadow-indigo-500/20"
          >
            <Plus className="w-4 h-4" /> Alocar em Projeto
          </button>

          <button
            onClick={handleDeleteCompany}
            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
            title="Excluir Empresa"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Metrics Banner for this Company */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 block">Projetos Atendidos</span>
            <span className="text-2xl font-black text-slate-900 mt-1 block">
              {projects.length}
            </span>
            <span className="text-[11px] font-medium text-slate-400 mt-0.5 block">
              {projects.filter((p) => p.service_status === 'em_andamento' || p.service_status === 'contratado').length} em andamento
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-2xs">
            <FolderGit2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 block">Volume Total em Serviços</span>
            <span className="text-xl font-black text-slate-800 mt-1 block">
              {formatCurrency(totalContract)}
            </span>
            <span className="text-[11px] font-medium text-slate-400 mt-0.5 block">
              contratados pelos clientes
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-2xs">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 block">Comissões Recebidas (RT)</span>
            <span className="text-xl font-black text-emerald-600 mt-1 block">
              {formatCurrency(totalReceived)}
            </span>
            <span className="text-[11px] font-medium text-emerald-700/80 mt-0.5 block flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Faturado pelo escritório
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-2xs">
            <Percent className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 block">Comissões a Receber</span>
            <span className="text-xl font-black text-amber-600 mt-1 block">
              {formatCurrency(totalPending)}
            </span>
            <span className="text-[11px] font-medium text-amber-700/80 mt-0.5 block flex items-center gap-1">
              <Clock className="w-3 h-3" /> Previsão de repasse
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shadow-2xs">
            <Clock className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Grid: Details Column & Projects Column */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Company Info & Commission Policy */}
        <div className="space-y-6">
          {/* Card 1: Perfil & Contato */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-indigo-600" />
                Dados Cadastrais & Contato
              </h3>
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                <span className="text-xs font-bold text-slate-700">
                  {company.rating || 5}.0
                </span>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              {company.trade_name && (
                <div>
                  <span className="text-slate-400 font-semibold block text-[11px]">
                    Razão Social Oficial:
                  </span>
                  <span className="text-slate-700 font-bold">
                    {company.name}
                  </span>
                </div>
              )}

              {company.document_number && (
                <div>
                  <span className="text-slate-400 font-semibold block text-[11px]">
                    {company.person_type === 'PJ' ? 'CNPJ' : 'CPF'}:
                  </span>
                  <span className="font-mono text-slate-700 font-bold">
                    {maskCPFOrCNPJ(company.document_number, company.person_type)}
                  </span>
                </div>
              )}

              {/* Vendedores & Representantes Comerciais */}
              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-slate-400 font-semibold block text-[11px]">
                    Vendedores & Representantes:
                  </span>
                  <span className="text-[10px] font-bold text-slate-500">
                    {company.contacts && company.contacts.length > 0
                      ? `${company.contacts.length} ${company.contacts.length === 1 ? 'cadastrado' : 'cadastrados'}`
                      : 'Nenhum'}
                  </span>
                </div>

                {company.contacts && company.contacts.length > 0 ? (
                  <div className="space-y-2">
                    {company.contacts.map((contact) => {
                      const contactRawPhone = cleanDigits(contact.phone)
                      const contactWaUrl = contactRawPhone ? `https://wa.me/55${contactRawPhone}` : null

                      return (
                        <div
                          key={contact.id}
                          className="p-2.5 bg-slate-50/80 hover:bg-slate-50 rounded-2xl border border-slate-100 space-y-1.5 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5 text-indigo-600" />
                              <span className="font-bold text-slate-900 text-xs">{contact.name}</span>
                              {contact.role && (
                                <span className="text-[10px] text-slate-500 font-medium">({contact.role})</span>
                              )}
                            </div>
                            {contact.is_primary && (
                              <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold rounded-md">
                                ★ Principal
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600 pt-0.5">
                            {contact.phone && (
                              <div className="flex items-center gap-1">
                                <Phone className="w-3 h-3 text-emerald-600" />
                                <span>{maskPhone(contact.phone)}</span>
                                {contactWaUrl && (
                                  <a
                                    href={contactWaUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-emerald-600 font-bold hover:underline ml-1"
                                  >
                                    WhatsApp →
                                  </a>
                                )}
                              </div>
                            )}

                            {contact.email && (
                              <div className="flex items-center gap-1">
                                <Mail className="w-3 h-3 text-blue-500" />
                                <a
                                  href={`mailto:${contact.email}`}
                                  className="text-indigo-600 hover:underline truncate max-w-[180px]"
                                >
                                  {contact.email}
                                </a>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : company.contact_name ? (
                  <div className="p-2.5 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-indigo-600" />
                      <span className="font-bold text-slate-800 text-xs">{company.contact_name}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">Nenhum vendedor ou representante cadastrado.</p>
                )}
              </div>

              {company.phone && (
                <div>
                  <span className="text-slate-400 font-semibold block text-[11px]">Telefone Geral da Empresa:</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-slate-800 font-bold">{maskPhone(company.phone)}</span>
                    {waUrl && (
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-600 font-bold hover:underline inline-flex items-center gap-1"
                      >
                        Abrir WhatsApp →
                      </a>
                    )}
                  </div>
                </div>
              )}

              {company.email && (
                <div>
                  <span className="text-slate-400 font-semibold block text-[11px]">E-mail Geral da Empresa:</span>
                  <a
                    href={`mailto:${company.email}`}
                    className="text-indigo-600 font-bold hover:underline block mt-0.5 truncate"
                  >
                    {company.email}
                  </a>
                </div>
              )}

              {(company.city || company.address) && (
                <div>
                  <span className="text-slate-400 font-semibold block text-[11px]">Endereço:</span>
                  <span className="text-slate-700 font-medium block mt-0.5">
                    {company.address ? `${company.address}, ` : ''}
                    {company.city || ''} {company.state ? `- ${company.state}` : ''}
                    {company.zip_code ? ` (CEP: ${maskCEP(company.zip_code)})` : ''}
                  </span>
                </div>
              )}

              {(company.website || company.instagram) && (
                <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-2">
                  {company.website && (
                    <a
                      href={company.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-600 hover:text-indigo-600 hover:bg-slate-100"
                    >
                      <Globe className="w-3 h-3" /> Website
                    </a>
                  )}

                  {company.instagram && (
                    <a
                      href={`https://instagram.com/${company.instagram.replace('@', '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-pink-50 border border-pink-200 text-pink-700 rounded-lg text-[11px] font-semibold hover:bg-pink-100"
                    >
                      <InstagramIcon className="w-3 h-3" /> {company.instagram}
                    </a>
                  )}
                </div>
              )}

              {/* Categorias */}
              <div className="pt-2 border-t border-slate-100">
                <span className="text-slate-400 font-semibold block text-[11px] mb-1.5">
                  Especialidades Homologadas:
                </span>
                <div className="flex flex-wrap gap-1">
                  {Array.isArray(company.categories) && company.categories.length > 0 ? (
                    company.categories.map((cat) => (
                      <span
                        key={cat}
                        className="px-2.5 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-xl border border-indigo-100"
                      >
                        {cat}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-400 italic">Nenhuma definida</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Política de Comissão & Prazos */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Percent className="w-4 h-4 text-indigo-600" />
                Política de Comissão / RT Padrão
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Regras comerciais acordadas com este parceiro
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-indigo-50/70 rounded-2xl border border-indigo-100 flex items-center justify-between">
                <span className="text-indigo-900 font-bold text-xs">Taxa / Percentual:</span>
                <span className="text-indigo-700 font-black text-sm">
                  {company.commission_type === 'percent'
                    ? `${company.commission_rate}% sobre o contrato`
                    : company.commission_type === 'fixed'
                    ? formatCurrency(company.commission_rate)
                    : company.commission_type === 'negotiable'
                    ? 'Sob Negociação'
                    : 'Sem Comissão'}
                </span>
              </div>

              {company.commission_payment_method && (
                <div>
                  <span className="text-slate-400 font-semibold block text-[11px]">
                    Forma de Pagamento Praticada:
                  </span>
                  <span className="font-bold text-slate-800 flex items-center gap-1.5 mt-0.5">
                    <CreditCard className="w-3.5 h-3.5 text-indigo-600" />
                    {company.commission_payment_method}
                  </span>
                </div>
              )}

              {company.commission_payment_terms && (
                <div>
                  <span className="text-slate-400 font-semibold block text-[11px]">
                    Prazo / Gatilho de Pagamento:
                  </span>
                  <span className="font-bold text-slate-800 flex items-center gap-1.5 mt-0.5">
                    <Clock className="w-3.5 h-3.5 text-indigo-600" />
                    {company.commission_payment_terms}
                  </span>
                </div>
              )}

              {company.notes && (
                <div className="pt-2 border-t border-slate-100">
                  <span className="text-slate-400 font-semibold block text-[11px] mb-1">
                    Notas Internas & Histórico:
                  </span>
                  <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100 whitespace-pre-wrap">
                    {company.notes}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Linked Projects & Services Table */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                  <FolderGit2 className="w-5 h-5 text-indigo-600" />
                  Projetos em que esta Empresa Atua
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Histórico de serviços alocados, valores orçados e repasses de comissão
                </p>
              </div>

              <button
                onClick={handleOpenNewLink}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs shadow-indigo-500/20 cursor-pointer self-start sm:self-auto"
              >
                <Plus className="w-4 h-4" /> Alocar em Outro Projeto
              </button>
            </div>

            {/* Projects List */}
            {projects.length === 0 ? (
              <div className="py-12 text-center">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mx-auto mb-3 shadow-2xs">
                  <FolderGit2 className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-slate-800">
                  Nenhum projeto vinculado a esta empresa ainda
                </h4>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
                  Clique no botão acima para associar esta empresa a um projeto de arquitetura, registrar o escopo e controlar o repasse da RT.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {projects.map((link) => {
                  const isPaid = link.commission_status === 'pago_total'
                  const isPartial = link.commission_status === 'pago_parcial'

                  return (
                    <div
                      key={link.id}
                      className="p-4 rounded-2xl border border-slate-200/80 hover:border-indigo-200 bg-slate-50/40 hover:bg-white transition-all shadow-2xs space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/app/projetos/${link.project_id}`}
                              className="font-bold text-sm text-slate-900 hover:text-indigo-600 transition-colors truncate"
                            >
                              {link.project_title}
                            </Link>
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-mono font-bold rounded-md">
                              {link.project_code}
                            </span>
                          </div>
                          <span className="text-xs text-slate-500 block mt-0.5">
                            Cliente: <strong className="text-slate-700">{link.client_name}</strong>
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {/* Service Status Badge */}
                          <span className="px-2.5 py-1 bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl">
                            {link.service_status === 'cotacao'
                              ? 'Em Cotação'
                              : link.service_status === 'contratado'
                              ? 'Contratado'
                              : link.service_status === 'em_andamento'
                              ? 'Em Execução'
                              : link.service_status === 'concluido'
                              ? 'Concluído'
                              : 'Cancelado'}
                          </span>

                          {/* Commission Status Badge */}
                          <span
                            className={`px-2.5 py-1 text-xs font-bold rounded-xl border ${
                              isPaid
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : isPartial
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}
                          >
                            {isPaid
                              ? 'RT Paga (100%)'
                              : isPartial
                              ? 'RT Paga Parcial'
                              : link.commission_status === 'previsto'
                              ? 'RT Prevista'
                              : 'RT Pendente'}
                          </span>
                        </div>
                      </div>

                      {/* Service Scope Description */}
                      {link.service_description && (
                        <p className="text-xs text-slate-600 bg-white p-2.5 rounded-xl border border-slate-100">
                          {link.service_description}
                        </p>
                      )}

                      {/* Financials & Commission Breakdown */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                        <div className="bg-white p-2.5 rounded-xl border border-slate-100">
                          <span className="text-[10px] text-slate-400 font-semibold block">
                            Valor do Contrato
                          </span>
                          <span className="font-bold text-slate-800 block mt-0.5">
                            {formatCurrency(link.contract_value)}
                          </span>
                        </div>

                        <div className="bg-white p-2.5 rounded-xl border border-slate-100">
                          <span className="text-[10px] text-slate-400 font-semibold block">
                            Taxa de Comissão
                          </span>
                          <span className="font-bold text-indigo-600 block mt-0.5">
                            {link.commission_type === 'percent'
                              ? `${link.commission_rate}%`
                              : formatCurrency(link.commission_rate)}
                          </span>
                        </div>

                        <div className="bg-white p-2.5 rounded-xl border border-slate-100">
                          <span className="text-[10px] text-slate-400 font-semibold block">
                            Comissão Prevista
                          </span>
                          <span className="font-bold text-slate-800 block mt-0.5">
                            {formatCurrency(link.expected_commission_amount)}
                          </span>
                        </div>

                        <div className="bg-white p-2.5 rounded-xl border border-slate-100">
                          <span className="text-[10px] text-slate-400 font-semibold block">
                            Valor Já Recebido
                          </span>
                          <span className="font-bold text-emerald-600 block mt-0.5">
                            {formatCurrency(link.received_commission_amount)}
                          </span>
                        </div>
                      </div>

                      {/* Footer Actions */}
                      <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-xs">
                        <div className="text-[11px] text-slate-400">
                          {link.commission_payment_terms && (
                            <span>Prazo: {link.commission_payment_terms}</span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {!isPaid && (
                            <button
                              onClick={() => handleMarkAsPaid(link.id)}
                              disabled={loadingActionId === link.id}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-[11px] rounded-lg border border-emerald-200 transition-all cursor-pointer"
                            >
                              <Check className="w-3 h-3" /> Marcar RT como Paga
                            </button>
                          )}

                          <button
                            onClick={() => handleOpenEditLink(link)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="Editar Valores / Escopo"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleRemoveLink(link.id, link.project_title)}
                            disabled={loadingActionId === link.id}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Desvincular do Projeto"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>

                          <Link
                            href={`/app/projetos/${link.project_id}`}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Ver Painel do Projeto"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Company Modal */}
      <CompanyModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        company={company}
        organizationId={organizationId}
        onSaved={handleSavedCompany}
      />

      {/* Link to Project Modal */}
      <LinkProjectModal
        isOpen={isLinkModalOpen}
        onClose={() => setIsLinkModalOpen(false)}
        company={company}
        availableProjects={availableProjects}
        existingLink={editingLink}
        onSaved={() => router.refresh()}
      />
    </div>
  )
}
