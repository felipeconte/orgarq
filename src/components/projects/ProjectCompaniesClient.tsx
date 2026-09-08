'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Building2,
  Phone,
  Mail,
  DollarSign,
  Percent,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  Clock,
  ExternalLink,
  Briefcase,
  Check
} from 'lucide-react'
import { CompanyData } from '@/lib/actions/companies'
import BackButton from '@/components/ui/BackButton'
import {
  ProjectCompanyItem,
  removeProjectCompanyAction,
  quickUpdateCommissionStatusAction
} from '@/lib/actions/project-companies'
import { cleanDigits, maskPhone } from '@/lib/formatters-and-validators'
import AddProjectCompanyModal from './AddProjectCompanyModal'

interface ProjectCompaniesClientProps {
  project: {
    id: string
    code: string
    title: string
    client_name: string
    organization_id: string
  }
  initialItems: ProjectCompanyItem[]
  availableCompanies: CompanyData[]
  initialSummary?: {
    totalContractValue: number
    totalExpectedCommission: number
    totalReceivedCommission: number
    totalPendingCommission: number
    totalCompaniesCount: number
  }
}

export default function ProjectCompaniesClient({
  project,
  initialItems,
  availableCompanies,
  initialSummary,
}: ProjectCompaniesClientProps) {
  const router = useRouter()
  const [items, setItems] = useState<ProjectCompanyItem[]>(initialItems)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<ProjectCompanyItem | null>(null)
  const [loadingActionId, setLoadingActionId] = useState<string | null>(null)

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val)
  }

  // Summary calculations
  const totalContract = items.reduce((acc, it) => acc + (it.contract_value || 0), 0)
  const totalExpected = items.reduce((acc, it) => acc + (it.expected_commission_amount || 0), 0)
  const totalReceived = items.reduce((acc, it) => acc + (it.received_commission_amount || 0), 0)
  const totalPending = Math.max(0, totalExpected - totalReceived)

  const handleOpenAdd = () => {
    setEditingItem(null)
    setIsModalOpen(true)
  }

  const handleOpenEdit = (item: ProjectCompanyItem) => {
    setEditingItem(item)
    setIsModalOpen(true)
  }

  const handleRemove = async (linkId: string, companyName: string) => {
    if (!window.confirm(`Tem certeza que deseja desvincular "${companyName}" deste projeto?`)) {
      return
    }
    setLoadingActionId(linkId)
    const res = await removeProjectCompanyAction(linkId)
    setLoadingActionId(null)
    if (res.success) {
      setItems((prev) => prev.filter((it) => it.id !== linkId))
      router.refresh()
    } else {
      alert(res.error || 'Erro ao remover fornecedor.')
    }
  }

  const handleMarkAsPaid = async (linkId: string) => {
    setLoadingActionId(linkId)
    const res = await quickUpdateCommissionStatusAction(linkId, 'pago_total')
    setLoadingActionId(null)
    if (res.success) {
      setItems((prev) =>
        prev.map((it) => {
          if (it.id === linkId) {
            return {
              ...it,
              commission_status: 'pago_total',
              received_commission_amount: it.expected_commission_amount,
            }
          }
          return it
        })
      )
      router.refresh()
    } else {
      alert(res.error || 'Erro ao atualizar comissão.')
    }
  }

  return (
    <div className="space-y-6 antialiased max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <BackButton fallbackHref={`/app/projetos/${project.id}`} />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                Fornecedores & Serviços Contratados
              </h1>
              <span className="px-2.5 py-0.5 text-xs font-mono font-bold bg-slate-100 text-slate-700 rounded-lg">
                {project.code}
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Projeto: <strong className="text-slate-800">{project.title}</strong> • Cliente: <strong className="text-slate-700">{project.client_name}</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/app/projetos/${project.id}/financeiro`}
            className="inline-flex items-center gap-1.5 py-2 px-3.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:text-emerald-600 hover:bg-slate-50 text-xs font-bold transition-all shadow-xs"
          >
            <DollarSign className="w-3.5 h-3.5 text-emerald-600" /> Financeiro do Projeto
          </Link>

          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-1.5 py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs shadow-indigo-500/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Adicionar Fornecedor
          </button>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 block">Total de Fornecedores</span>
            <span className="text-2xl font-black text-slate-900 mt-1 block">
              {items.length}
            </span>
            <span className="text-[11px] font-medium text-slate-400 mt-0.5 block">
              empresas alocadas nesta obra
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-2xs">
            <Building2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 block">Volume Contratado</span>
            <span className="text-xl font-black text-slate-800 mt-1 block">
              {formatCurrency(totalContract)}
            </span>
            <span className="text-[11px] font-medium text-slate-400 mt-0.5 block">
              total de orçamentos e serviços
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
              <CheckCircle2 className="w-3 h-3" /> Já pago pelos parceiros
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
              <Clock className="w-3 h-3" /> Previsão de recebimento
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shadow-2xs">
            <Clock className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main List of Suppliers */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-indigo-600" />
            Serviços e Fornecedores Atuantes na Obra
          </h3>

          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Adicionar Serviço
          </button>
        </div>

        {items.length === 0 ? (
          <div className="py-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mx-auto mb-3 shadow-2xs">
              <Building2 className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-800">
              Nenhuma empresa ou serviço vinculado a este projeto
            </h4>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
              Adicione marcenarias, marmorarias, lojas de iluminação ou prestadores de serviços para controlar os valores e as comissões de RT geradas por esta obra.
            </p>
            <button
              onClick={handleOpenAdd}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs shadow-indigo-500/20"
            >
              <Plus className="w-4 h-4" /> Adicionar Primeiro Fornecedor
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item) => {
              const rawPh = cleanDigits(item.company_phone)
              const waUrl = rawPh ? `https://wa.me/55${rawPh}` : null
              const isPaid = item.commission_status === 'pago_total'
              const isPartial = item.commission_status === 'pago_parcial'

              return (
                <div
                  key={item.id}
                  className="p-5 rounded-2xl border border-slate-200/80 hover:border-indigo-200 bg-slate-50/40 hover:bg-white transition-all shadow-2xs space-y-3.5"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/app/empresas/${item.company_id}`}
                          className="font-bold text-sm text-slate-900 hover:text-indigo-600 transition-colors truncate flex items-center gap-1.5"
                        >
                          <Building2 className="w-4 h-4 text-indigo-600" />
                          {item.company_trade_name || item.company_name}
                        </Link>
                        {item.company_trade_name && (
                          <span className="text-xs text-slate-400" title={item.company_name}>
                            ({item.company_name})
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1">
                        {item.category && (
                          <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded-md border border-indigo-100">
                            {item.category}
                          </span>
                        )}
                        {item.company_contact_name && (
                          <span>Contato: <strong className="text-slate-700">{item.company_contact_name}</strong></span>
                        )}
                        {item.company_phone && (
                          <span>• {maskPhone(item.company_phone)}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Service Status */}
                      <span className="px-2.5 py-1 bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl">
                        {item.service_status === 'cotacao'
                          ? 'Em Cotação'
                          : item.service_status === 'contratado'
                          ? 'Contratado'
                          : item.service_status === 'em_andamento'
                          ? 'Em Execução'
                          : item.service_status === 'concluido'
                          ? 'Concluído'
                          : 'Cancelado'}
                      </span>

                      {/* Commission Status */}
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
                          : item.commission_status === 'previsto'
                          ? 'RT Prevista'
                          : 'RT Pendente'}
                      </span>
                    </div>
                  </div>

                  {/* Scope description */}
                  {item.service_description && (
                    <p className="text-xs text-slate-600 bg-white p-3 rounded-xl border border-slate-100">
                      {item.service_description}
                    </p>
                  )}

                  {/* Financial Breakdown Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1 text-xs">
                    <div className="bg-white p-3 rounded-xl border border-slate-100">
                      <span className="text-[10px] text-slate-400 font-semibold block">
                        Valor Contratado
                      </span>
                      <span className="font-bold text-slate-900 block mt-0.5">
                        {formatCurrency(item.contract_value)}
                      </span>
                    </div>

                    <div className="bg-white p-3 rounded-xl border border-slate-100">
                      <span className="text-[10px] text-slate-400 font-semibold block">
                        Taxa de Comissão (RT)
                      </span>
                      <span className="font-bold text-indigo-600 block mt-0.5">
                        {item.commission_type === 'percent'
                          ? `${item.commission_rate}%`
                          : formatCurrency(item.commission_rate)}
                      </span>
                    </div>

                    <div className="bg-white p-3 rounded-xl border border-slate-100">
                      <span className="text-[10px] text-slate-400 font-semibold block">
                        Comissão Prevista
                      </span>
                      <span className="font-bold text-slate-900 block mt-0.5">
                        {formatCurrency(item.expected_commission_amount)}
                      </span>
                    </div>

                    <div className="bg-white p-3 rounded-xl border border-slate-100">
                      <span className="text-[10px] text-slate-400 font-semibold block">
                        Valor Já Recebido
                      </span>
                      <span className="font-bold text-emerald-600 block mt-0.5">
                        {formatCurrency(item.received_commission_amount)}
                      </span>
                    </div>
                  </div>

                  {/* Footer Bar */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-xs">
                    <div className="flex items-center gap-3 text-[11px] text-slate-500">
                      {item.commission_payment_method && (
                        <span>Forma: <strong>{item.commission_payment_method}</strong></span>
                      )}
                      {item.commission_payment_terms && (
                        <span>• Prazo: {item.commission_payment_terms}</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {waUrl && (
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                          title="WhatsApp do Fornecedor"
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </a>
                      )}

                      {!isPaid && (
                        <button
                          onClick={() => handleMarkAsPaid(item.id)}
                          disabled={loadingActionId === item.id}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-[11px] rounded-lg border border-emerald-200 transition-all cursor-pointer"
                        >
                          <Check className="w-3 h-3" /> Marcar RT como Paga
                        </button>
                      )}

                      <button
                        onClick={() => handleOpenEdit(item)}
                        className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                        title="Editar Valores / Escopo"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleRemove(item.id, item.company_name)}
                        disabled={loadingActionId === item.id}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        title="Desvincular do Projeto"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      <Link
                        href={`/app/empresas/${item.company_id}`}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Ver Perfil da Empresa"
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

      {/* Add / Edit Modal */}
      <AddProjectCompanyModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        projectId={project.id}
        availableCompanies={availableCompanies}
        existingItem={editingItem}
        onSaved={() => router.refresh()}
      />
    </div>
  )
}
