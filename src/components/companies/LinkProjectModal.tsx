'use client'

import { useState, useEffect } from 'react'
import {
  X,
  FolderGit2,
  DollarSign,
  Percent,
  Clock,
  CreditCard,
  FileText,
  Loader2,
  Check
} from 'lucide-react'
import { CompanyData } from '@/lib/actions/companies'
import {
  addProjectCompanyAction,
  updateProjectCompanyAction,
  ProjectCompanyItem,
  ProjectCompanyInput
} from '@/lib/actions/project-companies'
import { parseNumber } from '@/lib/formatters-and-validators'

interface SimpleProject {
  id: string
  code: string
  title: string
  client_name?: string | null
}

interface LinkProjectModalProps {
  isOpen: boolean
  onClose: () => void
  company: CompanyData
  availableProjects: SimpleProject[]
  existingLink?: ProjectCompanyItem | null
  onSaved: () => void
}

export default function LinkProjectModal({
  isOpen,
  onClose,
  company,
  availableProjects,
  existingLink,
  onSaved,
}: LinkProjectModalProps) {
  const isEditing = Boolean(existingLink?.id)

  const [projectId, setProjectId] = useState('')
  const [serviceDescription, setServiceDescription] = useState('')
  const [category, setCategory] = useState('')
  const [contractValue, setContractValue] = useState('')
  const [commissionType, setCommissionType] = useState<'percent' | 'fixed'>('percent')
  const [commissionRate, setCommissionRate] = useState('')
  const [expectedCommission, setExpectedCommission] = useState('')
  const [receivedCommission, setReceivedCommission] = useState('0')
  const [commissionStatus, setCommissionStatus] = useState<
    'previsto' | 'pendente' | 'pago_parcial' | 'pago_total' | 'cancelado'
  >('pendente')
  const [commissionPaymentMethod, setCommissionPaymentMethod] = useState('PIX')
  const [commissionPaymentTerms, setCommissionPaymentTerms] = useState('')
  const [serviceStatus, setServiceStatus] = useState<
    'cotacao' | 'contratado' | 'em_andamento' | 'concluido' | 'cancelado'
  >('em_andamento')
  const [notes, setNotes] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      if (existingLink) {
        setProjectId(existingLink.project_id)
        setServiceDescription(existingLink.service_description || '')
        setCategory(existingLink.category || (company.categories?.[0] || ''))
        setContractValue(String(existingLink.contract_value || ''))
        setCommissionType(existingLink.commission_type || 'percent')
        setCommissionRate(String(existingLink.commission_rate || ''))
        
        let expected = existingLink.expected_commission_amount
        if (existingLink.commission_type === 'percent' && Number(existingLink.contract_value || 0) > 0 && Number(existingLink.commission_rate || 0) > 0) {
          expected = (Number(existingLink.contract_value) * Number(existingLink.commission_rate)) / 100
        }
        setExpectedCommission(String(expected || ''))
        setReceivedCommission(String(existingLink.received_commission_amount || '0'))
        setCommissionStatus(existingLink.commission_status || 'pendente')
        setCommissionPaymentMethod(existingLink.commission_payment_method || company.commission_payment_method || 'PIX')
        setCommissionPaymentTerms(existingLink.commission_payment_terms || company.commission_payment_terms || '')
        setServiceStatus(existingLink.service_status || 'em_andamento')
        setNotes(existingLink.notes || '')
      } else {
        setProjectId(availableProjects[0]?.id || '')
        setServiceDescription('')
        setCategory(company.categories?.[0] || '')
        setContractValue('')
        setCommissionType(company.commission_type === 'fixed' ? 'fixed' : 'percent')
        setCommissionRate(String(company.commission_rate || '10'))
        setExpectedCommission('')
        setReceivedCommission('0')
        setCommissionStatus('pendente')
        setCommissionPaymentMethod(company.commission_payment_method || 'PIX')
        setCommissionPaymentTerms(company.commission_payment_terms || '30 dias após emissão da NF')
        setServiceStatus('em_andamento')
        setNotes('')
      }
      setError(null)
    }
  }, [isOpen, existingLink, company, availableProjects])

  // Recalculate expected commission whenever contract value or commission rate changes
  useEffect(() => {
    const rawContract = parseNumber(contractValue)
    const rawRate = parseNumber(commissionRate)

    if (commissionType === 'percent') {
      if (rawContract > 0 && rawRate > 0) {
        const calculated = (rawContract * rawRate) / 100
        setExpectedCommission(calculated.toFixed(2))
      } else if (rawContract > 0 && rawRate === 0) {
        setExpectedCommission('0.00')
      }
    } else {
      if (rawRate > 0) {
        setExpectedCommission(rawRate.toFixed(2))
      }
    }
  }, [contractValue, commissionRate, commissionType])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!projectId) {
      setError('Selecione um projeto válido.')
      return
    }

    setLoading(true)

    const rawContract = parseNumber(contractValue)
    const rawRate = parseNumber(commissionRate)
    let rawExpected = parseNumber(expectedCommission)
    if (commissionType === 'percent' && rawContract > 0 && rawRate > 0) {
      rawExpected = (rawContract * rawRate) / 100
    }
    const rawReceived = parseNumber(receivedCommission)

    const payload: ProjectCompanyInput = {
      projectId,
      companyId: company.id,
      serviceDescription: serviceDescription.trim() || null,
      category: category.trim() || null,
      contractValue: rawContract,
      commissionType,
      commissionRate: rawRate,
      expectedCommissionAmount: rawExpected,
      receivedCommissionAmount: rawReceived,
      commissionStatus,
      commissionPaymentMethod: commissionPaymentMethod.trim() || null,
      commissionPaymentTerms: commissionPaymentTerms.trim() || null,
      serviceStatus,
      notes: notes.trim() || null,
    }

    try {
      if (isEditing && existingLink) {
        const res = await updateProjectCompanyAction(existingLink.id, payload)
        if (!res.success) {
          setError(res.error || 'Erro ao atualizar serviço no projeto.')
          setLoading(false)
          return
        }
      } else {
        const res = await addProjectCompanyAction(payload)
        if (!res.success) {
          setError(res.error || 'Erro ao vincular empresa ao projeto.')
          setLoading(false)
          return
        }
      }
      onSaved()
      onClose()
    } catch (err: any) {
      setError(err?.message || 'Ocorreu um erro inesperado.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-2xs">
              <FolderGit2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 leading-snug">
                {isEditing ? 'Editar Alocação no Projeto' : 'Alocar Empresa em um Projeto'}
              </h2>
              <p className="text-xs text-slate-500">
                Parceiro: <strong className="text-slate-800">{company.trade_name || company.name}</strong>
                {company.trade_name && <span className="text-slate-400 font-medium"> ({company.name})</span>}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mx-6 mt-4 p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-2xl flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="p-6 max-h-[65vh] overflow-y-auto space-y-4">
            {/* Project Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Selecione o Projeto de Arquitetura <span className="text-red-500">*</span>
              </label>
              <select
                disabled={isEditing}
                required
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all disabled:opacity-75"
              >
                <option value="">Selecione um projeto...</option>
                {availableProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    [{p.code}] {p.title} {p.client_name ? `(${p.client_name})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Service Category & Scope Description */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Especialidade / Categoria do Serviço
                </label>
                <input
                  type="text"
                  list="link-categories-suggestions"
                  placeholder="Ex: Marcenaria, Marmoraria, Iluminação"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
                <datalist id="link-categories-suggestions">
                  {company.categories?.map((cat) => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Status do Serviço
                </label>
                <select
                  value={serviceStatus}
                  onChange={(e) => setServiceStatus(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                >
                  <option value="cotacao">Em Cotação / Orçamento</option>
                  <option value="contratado">Contratado</option>
                  <option value="em_andamento">Em Execução / Andamento</option>
                  <option value="concluido">Concluído / Entregue</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Descrição do Escopo do Serviço
              </label>
              <textarea
                rows={2}
                placeholder="Ex: Fabricação e instalação de marcenaria da cozinha, living e suíte master conforme detalhamento executivo R-04"
                value={serviceDescription}
                onChange={(e) => setServiceDescription(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none"
              />
            </div>

            {/* Financials & Commissions */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
              <span className="text-xs font-bold text-slate-900 block">
                Valores Financeiros & Comissão do Escritório (RT)
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Valor Contratado (R$)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">
                      R$
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={contractValue}
                      onChange={(e) => setContractValue(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Regra de Comissão
                  </label>
                  <div className="flex items-center gap-1.5">
                    <select
                      value={commissionType}
                      onChange={(e) => setCommissionType(e.target.value as any)}
                      className="w-20 px-2 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none"
                    >
                      <option value="percent">%</option>
                      <option value="fixed">R$ Fixo</option>
                    </select>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="Taxa"
                      value={commissionRate}
                      onChange={(e) => setCommissionRate(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Comissão Prevista (R$)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">
                      R$
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={expectedCommission}
                      onChange={(e) => setExpectedCommission(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-indigo-50/50 border border-indigo-200 rounded-xl text-xs font-black text-indigo-700 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200/60">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Status da Comissão
                  </label>
                  <select
                    value={commissionStatus}
                    onChange={(e) => setCommissionStatus(e.target.value as any)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="previsto">Previsto (Em Negociação)</option>
                    <option value="pendente">Pendente (Aguardando Pagamento)</option>
                    <option value="pago_parcial">Pago Parcialmente</option>
                    <option value="pago_total">Pago Integralmente (100%)</option>
                    <option value="cancelado">Cancelado</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Valor Já Recebido (R$)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-xs text-slate-400 font-bold">
                      R$
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={receivedCommission}
                      onChange={(e) => setReceivedCommission(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-emerald-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Forma de Pagamento
                  </label>
                  <select
                    value={commissionPaymentMethod}
                    onChange={(e) => setCommissionPaymentMethod(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none"
                  >
                    <option value="PIX">PIX</option>
                    <option value="TED">Transferência Bancária (TED)</option>
                    <option value="Boleto">Boleto</option>
                    <option value="Dinheiro">Dinheiro</option>
                    <option value="Crédito em Loja / Permuta">Crédito em Loja / Permuta</option>
                    <option value="Outro">Outro</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Prazo de Repasse
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: 30 dias após NF"
                    value={commissionPaymentTerms}
                    onChange={(e) => setCommissionPaymentTerms(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                Observações deste Serviço no Projeto
              </label>
              <textarea
                rows={2}
                placeholder="Ex: Contrato assinado em 12/03. Previsão de entrega da primeira etapa em 20 dias."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/50">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-colors"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs shadow-indigo-500/20 disabled:opacity-50 cursor-pointer"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {isEditing ? 'Atualizar Serviço' : 'Vincular ao Projeto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
