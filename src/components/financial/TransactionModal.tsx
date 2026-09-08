'use client'

import { useState, useEffect } from 'react'
import {
  X,
  Plus,
  Loader2,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Calendar,
  Building2,
  FolderGit2,
  CreditCard,
  FileText,
  AlertCircle,
  CheckCircle2,
  Clock,
  Trash2,
  Repeat
} from 'lucide-react'
import {
  FinancialTransaction,
  FINANCIAL_CATEGORIES,
  TransactionType,
  TransactionStatus,
  PaymentMethod,
  RecurringFrequency
} from '@/types/financial'
import {
  createFinancialTransactionAction,
  updateFinancialTransactionAction,
  deleteFinancialTransactionAction
} from '@/lib/actions/financial'

interface ProjectOption {
  id: string
  code: string
  title: string
  client_name?: string
}

interface CompanyOption {
  id: string
  name: string
  trade_name?: string | null
}

interface TransactionModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (tx: FinancialTransaction, isDeleted?: boolean) => void
  organizationId: string
  projects?: ProjectOption[]
  companies?: CompanyOption[]
  initialTransaction?: FinancialTransaction | null
  defaultProjectId?: string | null
  defaultType?: TransactionType
}

export default function TransactionModal({
  isOpen,
  onClose,
  onSuccess,
  organizationId,
  projects = [],
  companies = [],
  initialTransaction = null,
  defaultProjectId = null,
  defaultType = 'income'
}: TransactionModalProps) {
  const isEditing = Boolean(initialTransaction)

  const [type, setType] = useState<TransactionType>(defaultType)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [projectId, setProjectId] = useState<string>(defaultProjectId || '')
  const [companyId, setCompanyId] = useState<string>('')
  const [dueDate, setDueDate] = useState('')
  const [paymentDate, setPaymentDate] = useState('')
  const [status, setStatus] = useState<TransactionStatus>('pending')
  const [paymentMethod, setPaymentMethod] = useState<string>('PIX')
  const [receiptUrl, setReceiptUrl] = useState('')
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurringFrequency, setRecurringFrequency] = useState<RecurringFrequency>('monthly')

  const [isLoading, setIsLoading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // Sincroniza estado quando modal abre
  useEffect(() => {
    if (isOpen) {
      setErrorMsg('')
      if (initialTransaction) {
        setType(initialTransaction.type)
        setTitle(initialTransaction.title || '')
        setDescription(initialTransaction.description || '')
        setAmount(String(initialTransaction.amount || ''))
        setCategory(initialTransaction.category || '')
        setProjectId(initialTransaction.project_id || '')
        setCompanyId(initialTransaction.company_id || '')
        setDueDate(initialTransaction.due_date || '')
        setPaymentDate(initialTransaction.payment_date || '')
        setStatus(initialTransaction.status || 'pending')
        setPaymentMethod(initialTransaction.payment_method || 'PIX')
        setReceiptUrl(initialTransaction.receipt_url || '')
        setIsRecurring(Boolean(initialTransaction.recurring_expense_id))
        setRecurringFrequency('monthly')
      } else {
        setType(defaultType)
        setTitle('')
        setDescription('')
        setAmount('')
        const defaultCats = FINANCIAL_CATEGORIES.filter((c) => c.type === defaultType)
        setCategory(defaultCats[0]?.id || '')
        setProjectId(defaultProjectId || '')
        setCompanyId('')
        const today = new Date().toISOString().split('T')[0]
        setDueDate(today)
        setPaymentDate(today)
        setStatus('pending')
        setPaymentMethod('PIX')
        setReceiptUrl('')
        setIsRecurring(false)
        setRecurringFrequency('monthly')
      }
    }
  }, [isOpen, initialTransaction, defaultProjectId, defaultType])

  // Ajusta categoria padrão quando o tipo (Receita/Despesa) muda
  const handleTypeChange = (newType: TransactionType) => {
    setType(newType)
    const available = FINANCIAL_CATEGORIES.filter((c) => c.type === newType)
    if (!available.some((c) => c.id === category)) {
      setCategory(available[0]?.id || '')
    }
  }

  if (!isOpen) return null

  const availableCategories = FINANCIAL_CATEGORIES.filter((c) => c.type === type)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    if (!title.trim()) {
      setErrorMsg('Informe a descrição / título do lançamento.')
      return
    }

    const numAmount = parseFloat(amount.replace(',', '.'))
    if (isNaN(numAmount) || numAmount <= 0) {
      setErrorMsg('Informe um valor válido e maior que zero.')
      return
    }

    if (!dueDate) {
      setErrorMsg('Informe a data de vencimento / previsão.')
      return
    }

    setIsLoading(true)

    try {
      if (isEditing && initialTransaction) {
        const res = await updateFinancialTransactionAction({
          id: initialTransaction.id,
          organizationId,
          type,
          title: title.trim(),
          description: description.trim() || null,
          amount: numAmount,
          category,
          projectId: projectId || null,
          companyId: companyId || null,
          dueDate,
          paymentDate: status === 'paid' ? (paymentDate || dueDate) : null,
          status,
          paymentMethod,
          receiptUrl: receiptUrl.trim() || null
        })

        if (!res.success || !res.transaction) {
          setErrorMsg(res.error || 'Falha ao atualizar lançamento.')
          setIsLoading(false)
          return
        }

        onSuccess(res.transaction)
        onClose()
      } else {
        const res = await createFinancialTransactionAction({
          organizationId,
          type,
          title: title.trim(),
          description: description.trim() || null,
          amount: numAmount,
          category,
          projectId: projectId || null,
          companyId: companyId || null,
          dueDate,
          paymentDate: status === 'paid' ? (paymentDate || dueDate) : null,
          status,
          paymentMethod,
          receiptUrl: receiptUrl.trim() || null,
          isRecurring,
          recurringFrequency
        })

        if (!res.success || !res.transaction) {
          setErrorMsg(res.error || 'Falha ao criar lançamento.')
          setIsLoading(false)
          return
        }

        onSuccess(res.transaction)
        onClose()
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro inesperado.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (deleteSeries = false) => {
    if (!initialTransaction) return

    if (initialTransaction.recurring_expense_id) {
      const msg = deleteSeries
        ? 'Deseja excluir a regra de recorrência e TODOS os lançamentos pendentes futuros vinculados a ela? Ela não voltará a ser gerada.'
        : 'Deseja excluir apenas este lançamento específico deste mês?'

      if (!confirm(msg)) return
    } else {
      if (!confirm('Tem certeza que deseja excluir permanentemente este lançamento financeiro?')) return
    }

    setIsDeleting(true)
    setErrorMsg('')

    try {
      const res = await deleteFinancialTransactionAction({
        id: initialTransaction.id,
        organizationId,
        deleteSeries
      })

      if (!res.success) {
        setErrorMsg(res.error || 'Falha ao excluir lançamento.')
        setIsDeleting(false)
        return
      }

      onSuccess(initialTransaction, true)
      onClose()
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao excluir lançamento.')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs antialiased animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-xs ${
                type === 'income' ? 'bg-emerald-600 shadow-emerald-500/20' : 'bg-rose-600 shadow-rose-500/20'
              }`}
            >
              {type === 'income' ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {isEditing ? 'Editar Lançamento' : type === 'income' ? 'Nova Entrada (Receita)' : 'Nova Saída (Despesa)'}
              </h2>
              <p className="text-xs text-slate-500">
                {isEditing ? 'Atualize as informações do registro financeiro.' : 'Preencha os dados do fluxo de caixa.'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1 text-xs">
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {isEditing && initialTransaction?.recurring_expense_id && (
            <div className="p-3 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center gap-2.5 text-indigo-900 font-medium">
              <div className="w-7 h-7 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                <Repeat className="w-3.5 h-3.5" />
              </div>
              <span className="text-[11px]">
                Este lançamento foi gerado automaticamente por uma <strong>regra recorrente</strong>.
              </span>
            </div>
          )}

          {/* Type Selector (Receita vs Despesa) */}
          <div className="flex p-1 bg-slate-100 rounded-2xl">
            <button
              type="button"
              onClick={() => handleTypeChange('income')}
              className={`flex-1 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
                type === 'income'
                  ? 'bg-emerald-600 text-white shadow-xs shadow-emerald-600/30'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TrendingUp className="w-4 h-4" /> Entrada / Receita
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange('expense')}
              className={`flex-1 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
                type === 'expense'
                  ? 'bg-rose-600 text-white shadow-xs shadow-rose-600/30'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TrendingDown className="w-4 h-4" /> Saída / Despesa
            </button>
          </div>

          {/* Title & Amount Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <label className="font-bold text-slate-700">Descrição / Título do Lançamento *</label>
              <input
                type="text"
                required
                placeholder={type === 'income' ? 'Ex: 1ª Parcela de Honorários' : 'Ex: Visita à Obra - Combustível & Pedágio'}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white text-slate-800 font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-700">Valor (R$) *</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">R$</span>
                <input
                  type="text"
                  required
                  placeholder="0,00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white text-slate-800 font-bold font-mono"
                />
              </div>
            </div>
          </div>

          {/* Category & Project Link */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700">Categoria *</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white text-slate-800 font-medium"
              >
                {availableCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 flex items-center justify-between">
                <span>Vínculo com Projeto</span>
                <span className="text-[10px] text-slate-400 font-normal">(Opcional)</span>
              </label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white text-slate-800 font-medium"
              >
                <option value="">Nenhum (Despesa/Receita Geral do Escritório)</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    [{p.code}] {p.title} {p.client_name ? `• ${p.client_name}` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Company / Supplier & Payment Method */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 flex items-center justify-between">
                <span>Fornecedor / Empresa / Parceiro</span>
                <span className="text-[10px] text-slate-400 font-normal">(Opcional)</span>
              </label>
              <select
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white text-slate-800 font-medium"
              >
                <option value="">Não vinculado</option>
                {companies.map((comp) => (
                  <option key={comp.id} value={comp.id}>
                    {comp.name} {comp.trade_name ? `(${comp.trade_name})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-700">Forma de Pagamento</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white text-slate-800 font-medium"
              >
                <option value="PIX">PIX</option>
                <option value="Boleto">Boleto Bancário</option>
                <option value="Cartao_Credito">Cartão de Crédito</option>
                <option value="Cartao_Debito">Cartão de Débito</option>
                <option value="TED">Transferência (TED/DOC)</option>
                <option value="Debito_Automatico">Débito Automático</option>
                <option value="Dinheiro">Dinheiro em Espécie</option>
                <option value="Outro">Outro</option>
              </select>
            </div>
          </div>

          {/* Dates & Status Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700">Vencimento / Previsão *</label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white text-slate-800 font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-700">Status do Lançamento</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TransactionStatus)}
                className={`w-full px-3.5 py-2.5 rounded-xl border font-bold ${
                  status === 'paid'
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                    : status === 'overdue'
                    ? 'border-rose-300 bg-rose-50 text-rose-800'
                    : 'border-amber-300 bg-amber-50 text-amber-800'
                }`}
              >
                <option value="pending">⏳ Pendente (A Receber / A Pagar)</option>
                <option value="paid">✅ Pago / Recebido</option>
                <option value="overdue">🚨 Vencido / Atrasado</option>
                <option value="cancelled">🚫 Cancelado</option>
              </select>
            </div>

            {status === 'paid' ? (
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700">Data de Liquidação</label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-800 font-medium"
                />
              </div>
            ) : (
              <div className="space-y-1.5 opacity-50">
                <label className="font-bold text-slate-400">Data de Liquidação</label>
                <input
                  type="text"
                  disabled
                  value="Disponível quando Pago"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-100 text-slate-400 font-medium"
                />
              </div>
            )}
          </div>

          {/* Recurring Option (When creating) */}
          {!isEditing && (
            <div className="p-3.5 rounded-2xl bg-indigo-50/50 border border-indigo-100 flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                    <Repeat className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-800 block text-xs">
                      Tornar este lançamento recorrente?
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Gera automaticamente a regra para se repetir nos próximos meses.
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsRecurring(!isRecurring)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    isRecurring ? 'bg-indigo-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      isRecurring ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {isRecurring && (
                <div className="pt-2 border-t border-indigo-100/60 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-1 duration-200">
                  <span className="text-xs font-semibold text-indigo-900">Periodicidade da repetição:</span>
                  <select
                    value={recurringFrequency}
                    onChange={(e) => setRecurringFrequency(e.target.value as RecurringFrequency)}
                    className="px-2.5 py-1.5 rounded-lg border border-indigo-200 bg-white text-xs font-bold text-indigo-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="monthly">Mensal (todo mês)</option>
                    <option value="quarterly">Trimestral (a cada 3 meses)</option>
                    <option value="yearly">Anual (uma vez ao ano)</option>
                    <option value="weekly">Semanal</option>
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Description / Notes */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-700">Observações / Detalhes</label>
            <textarea
              rows={2}
              placeholder="Ex: Referente à parcela da entrega do estudo preliminar..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white text-slate-800 font-medium resize-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
            {isEditing ? (
              <div className="flex items-center gap-2">
                {initialTransaction?.recurring_expense_id ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleDelete(true)}
                      disabled={isDeleting || isLoading}
                      className="px-3.5 py-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 font-bold transition-colors flex items-center gap-1.5 text-xs cursor-pointer"
                      title="Exclui a regra de recorrência e impede futuras repetições"
                    >
                      {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      Excluir Toda a Recorrência
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(false)}
                      disabled={isDeleting || isLoading}
                      className="px-3 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold transition-colors text-xs cursor-pointer"
                      title="Exclui apenas este registro deste mês"
                    >
                      Apenas Este Mês
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleDelete(false)}
                    disabled={isDeleting || isLoading}
                    className="px-4 py-2.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    Excluir
                  </button>
                )}
              </div>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading || isDeleting}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold transition-colors"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={isLoading || isDeleting}
                className={`px-5 py-2.5 rounded-xl text-white font-bold transition-all shadow-xs flex items-center gap-2 ${
                  type === 'income'
                    ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                    : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
                }`}
              >
                {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                {isEditing ? 'Salvar Alterações' : 'Confirmar Lançamento'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
