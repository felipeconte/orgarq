'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  X,
  Building2,
  DollarSign,
  Percent,
  Clock,
  CreditCard,
  FileText,
  Loader2,
  Plus
} from 'lucide-react'
import { CompanyData } from '@/lib/actions/companies'
import {
  addProjectCompanyAction,
  updateProjectCompanyAction,
  ProjectCompanyItem,
  ProjectCompanyInput
} from '@/lib/actions/project-companies'
import { parseNumber } from '@/lib/formatters-and-validators'

interface AddProjectCompanyModalProps {
  isOpen: boolean
  onClose: () => void
  projectId: string
  availableCompanies: CompanyData[]
  existingItem?: ProjectCompanyItem | null
  onSaved: () => void
}

export default function AddProjectCompanyModal({
  isOpen,
  onClose,
  projectId,
  availableCompanies,
  existingItem,
  onSaved,
}: AddProjectCompanyModalProps) {
  const isEditing = Boolean(existingItem?.id)

  const [companyId, setCompanyId] = useState('')
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
      if (existingItem) {
        setCompanyId(existingItem.company_id)
        setServiceDescription(existingItem.service_description || '')
        setCategory(existingItem.category || '')
        setContractValue(String(existingItem.contract_value || ''))
        setCommissionType(existingItem.commission_type || 'percent')
        setCommissionRate(String(existingItem.commission_rate || ''))
        
        let expected = existingItem.expected_commission_amount
        if (existingItem.commission_type === 'percent' && Number(existingItem.contract_value || 0) > 0 && Number(existingItem.commission_rate || 0) > 0) {
          expected = (Number(existingItem.contract_value) * Number(existingItem.commission_rate)) / 100
        }
        setExpectedCommission(String(expected || ''))
        setReceivedCommission(String(existingItem.received_commission_amount || '0'))
        setCommissionStatus(existingItem.commission_status || 'pendente')
        setCommissionPaymentMethod(existingItem.commission_payment_method || 'PIX')
        setCommissionPaymentTerms(existingItem.commission_payment_terms || '')
        setServiceStatus(existingItem.service_status || 'em_andamento')
        setNotes(existingItem.notes || '')
      } else {
        const firstComp = availableCompanies[0]
        if (firstComp) {
          setCompanyId(firstComp.id)
          setCategory(firstComp.categories?.[0] || '')
          setCommissionType(firstComp.commission_type === 'fixed' ? 'fixed' : 'percent')
          setCommissionRate(String(firstComp.commission_rate || '10'))
          setCommissionPaymentMethod(firstComp.commission_payment_method || 'PIX')
          setCommissionPaymentTerms(firstComp.commission_payment_terms || '30 dias após emissão da NF')
        } else {
          setCompanyId('')
          setCategory('')
          setCommissionType('percent')
          setCommissionRate('10')
          setCommissionPaymentMethod('PIX')
          setCommissionPaymentTerms('30 dias após emissão da NF')
        }
        setServiceDescription('')
        setContractValue('')
        setExpectedCommission('')
        setReceivedCommission('0')
        setCommissionStatus('pendente')
        setServiceStatus('em_andamento')
        setNotes('')
      }
      setError(null)
    }
  }, [isOpen, existingItem, availableCompanies])

  // When selected company changes in creation mode, load defaults
  const handleCompanyChange = (id: string) => {
    setCompanyId(id)
    const comp = availableCompanies.find((c) => c.id === id)
    if (comp) {
      setCategory(comp.categories?.[0] || '')
      setCommissionType(comp.commission_type === 'fixed' ? 'fixed' : 'percent')
      setCommissionRate(String(comp.commission_rate || '10'))
      setCommissionPaymentMethod(comp.commission_payment_method || 'PIX')
      setCommissionPaymentTerms(comp.commission_payment_terms || '30 dias após emissão da NF')
    }
  }

  // Auto-calculate expected commission
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

    if (!companyId) {
      setError('Selecione uma empresa ou fornecedor cadastrado.')
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
      companyId,
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
      if (isEditing && existingItem) {
        const res = await updateProjectCompanyAction(existingItem.id, payload)
        if (!res.success) {
          setError(res.error || 'Erro ao atualizar serviço no projeto.')
          setLoading(false)
          return
        }
      } else {
        const res = await addProjectCompanyAction(payload)
        if (!res.success) {
          setError(res.error || 'Erro ao associar empresa ao projeto.')
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
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 leading-snug">
                {isEditing ? 'Editar Fornecedor / Serviço' : 'Adicionar Empresa / Serviço ao Projeto'}
              </h2>
              <p className="text-xs text-slate-500">
                Alocar parceiro para a execução desta obra e registrar a comissão prevista (RT)
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
            {/* Company Selection */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Empresa / Fornecedor Parceiro <span className="text-red-500">*</span>
                </label>
                <Link
                  href="/app/empresas"
                  target="_blank"
                  className="text-[11px] font-bold text-indigo-600 hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Cadastrar nova empresa
                </Link>
              </div>

              <select
                disabled={isEditing}
                required
                value={companyId}
                onChange={(e) => handleCompanyChange(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all disabled:opacity-75"
              >
                <option value="">Selecione uma empresa parceira...</option>
                {availableCompanies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.trade_name ? `${c.trade_name} (${c.name})` : c.name} - {c.categories?.join(', ') || 'Sem categoria'}
                  </option>
                ))}
              </select>
            </div>

            {/* Service Category & Scope */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Especialidade / Categoria
                </label>
                <input
                  type="text"
                  list="add-project-categories-suggestions"
                  placeholder="Ex: Marcenaria, Marmoraria, Iluminação"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
                <datalist id="add-project-categories-suggestions">
                  {availableCompanies.flatMap((c) => c.categories || []).map((cat) => (
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
                placeholder="Ex: Marcenaria completa planejada da cozinha, lavanderia e painel do home theater"
                value={serviceDescription}
                onChange={(e) => setServiceDescription(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none"
              />
            </div>

            {/* Financials & RT */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
              <span className="text-xs font-bold text-slate-900 block">
                Valores Financeiros & Repasse de Comissão (RT)
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
                    Regra de RT
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
                    <option value="pendente">Pendente (Aguardando Repasse)</option>
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
                    Prazo / Gatilho de Pagamento
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
                Observações Adicionais
              </label>
              <textarea
                rows={2}
                placeholder="Observações de entrega, contato com encarregado de obra, etc."
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
              {isEditing ? 'Salvar Alterações' : 'Adicionar ao Projeto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
