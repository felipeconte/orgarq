'use client'

import { useState, useEffect } from 'react'
import {
  X,
  Loader2,
  Calendar,
  CreditCard,
  Building2,
  FolderGit2,
  Trash2,
  AlertCircle,
  Repeat,
  TrendingUp,
  TrendingDown,
  User,
  Sparkles
} from 'lucide-react'
import {
  RecurringExpense,
  RecurringFrequency,
  PaymentMethod,
  TransactionType,
  FINANCIAL_CATEGORIES
} from '@/types/financial'
import {
  createRecurringExpenseAction,
  updateRecurringExpenseAction,
  deleteRecurringExpenseAction
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

interface ClientOption {
  id: string
  name: string
}

interface RecurringExpenseModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (expense: RecurringExpense, isDeleted?: boolean) => void
  organizationId: string
  initialExpense?: RecurringExpense | null
  defaultType?: TransactionType
  projects?: ProjectOption[]
  companies?: CompanyOption[]
  clients?: ClientOption[]
}

export default function RecurringExpenseModal({
  isOpen,
  onClose,
  onSuccess,
  organizationId,
  initialExpense = null,
  defaultType = 'expense',
  projects = [],
  companies = [],
  clients = []
}: RecurringExpenseModalProps) {
  const isEditing = Boolean(initialExpense)

  const [type, setType] = useState<TransactionType>(defaultType)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [amount, setAmount] = useState('')
  const [frequency, setFrequency] = useState<RecurringFrequency>('monthly')
  const [dueDay, setDueDay] = useState('5')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<string>('Boleto')
  const [projectId, setProjectId] = useState<string>('')
  const [clientId, setClientId] = useState<string>('')
  const [companyId, setCompanyId] = useState<string>('')
  const [notes, setNotes] = useState('')
  const [isActive, setIsActive] = useState(true)

  const [isLoading, setIsLoading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (isOpen) {
      setErrorMsg('')
      if (initialExpense) {
        setType(initialExpense.type || 'expense')
        setTitle(initialExpense.title || '')
        setCategory(initialExpense.category || '')
        setAmount(String(initialExpense.amount || ''))
        setFrequency(initialExpense.frequency || 'monthly')
        setDueDay(String(initialExpense.due_day || '5'))
        setStartDate(initialExpense.start_date || '')
        setEndDate(initialExpense.end_date || '')
        setPaymentMethod(initialExpense.payment_method || 'Boleto')
        setProjectId(initialExpense.project_id || '')
        setClientId(initialExpense.client_id || '')
        setCompanyId(initialExpense.company_id || '')
        setNotes(initialExpense.notes || '')
        setIsActive(initialExpense.is_active !== false)
      } else {
        setType(defaultType)
        setTitle('')
        const availableCats = FINANCIAL_CATEGORIES.filter((c) => c.type === defaultType)
        setCategory(availableCats[0]?.id || (defaultType === 'income' ? 'fee_acompanhamento' : 'aluguel_condominio'))
        setAmount('')
        setFrequency('monthly')
        setDueDay('5')
        setStartDate(new Date().toISOString().split('T')[0])
        setEndDate('')
        setPaymentMethod(defaultType === 'income' ? 'PIX' : 'Boleto')
        setProjectId('')
        setClientId('')
        setCompanyId('')
        setNotes('')
        setIsActive(true)
      }
    }
  }, [isOpen, initialExpense, defaultType])

  const handleTypeChange = (newType: TransactionType) => {
    setType(newType)
    const available = FINANCIAL_CATEGORIES.filter((c) => c.type === newType)
    if (!available.some((c) => c.id === category)) {
      setCategory(available[0]?.id || '')
    }
    if (newType === 'income' && paymentMethod === 'Boleto') {
      setPaymentMethod('PIX')
    }
  }

  if (!isOpen) return null

  const availableCategories = FINANCIAL_CATEGORIES.filter((c) => c.type === type)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    if (!title.trim()) {
      setErrorMsg(`Informe a identificação da ${type === 'income' ? 'receita recorrente' : 'despesa fixa'}.`)
      return
    }

    const numAmount = parseFloat(amount.replace(',', '.'))
    if (isNaN(numAmount) || numAmount <= 0) {
      setErrorMsg('Informe um valor válido e maior que zero.')
      return
    }

    const numDay = parseInt(dueDay, 10)
    if (isNaN(numDay) || numDay < 1 || numDay > 31) {
      setErrorMsg('Informe um dia de vencimento válido (entre 1 e 31).')
      return
    }

    setIsLoading(true)

    try {
      if (isEditing && initialExpense) {
        const res = await updateRecurringExpenseAction({
          id: initialExpense.id,
          organizationId,
          type,
          title: title.trim(),
          category,
          amount: numAmount,
          frequency,
          dueDay: numDay,
          startDate,
          endDate: endDate.trim() || null,
          paymentMethod,
          projectId: projectId || null,
          clientId: clientId || null,
          companyId: companyId || null,
          isActive,
          notes: notes.trim() || null
        })

        if (!res.success || !res.expense) {
          setErrorMsg(res.error || 'Falha ao atualizar recorrência.')
          setIsLoading(false)
          return
        }

        onSuccess(res.expense)
        onClose()
      } else {
        const res = await createRecurringExpenseAction({
          organizationId,
          type,
          title: title.trim(),
          category,
          amount: numAmount,
          frequency,
          dueDay: numDay,
          startDate,
          endDate: endDate.trim() || null,
          paymentMethod,
          projectId: projectId || null,
          clientId: clientId || null,
          companyId: companyId || null,
          notes: notes.trim() || null
        })

        if (!res.success || !res.expense) {
          setErrorMsg(res.error || 'Falha ao cadastrar recorrência.')
          setIsLoading(false)
          return
        }

        onSuccess(res.expense)
        onClose()
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro inesperado.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!initialExpense) return
    if (!confirm('Deseja excluir permanentemente esta recorrência? Lançamentos futuros pendentes vinculados a ela serão removidos.')) return

    setIsDeleting(true)
    setErrorMsg('')

    try {
      const res = await deleteRecurringExpenseAction({
        id: initialExpense.id,
        organizationId
      })

      if (!res.success) {
        setErrorMsg(res.error || 'Falha ao remover recorrência.')
        setIsDeleting(false)
        return
      }

      onSuccess(initialExpense, true)
      onClose()
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao remover.')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs antialiased animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-xs ${
                type === 'income'
                  ? 'bg-emerald-600 shadow-emerald-500/20'
                  : 'bg-indigo-600 shadow-indigo-500/20'
              }`}
            >
              <Repeat className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {isEditing
                  ? `Editar ${type === 'income' ? 'Receita Recorrente' : 'Despesa Fixa'}`
                  : `Cadastrar ${type === 'income' ? 'Receita Recorrente' : 'Despesa Fixa'}`}
              </h2>
              <p className="text-xs text-slate-500">
                Lançamentos recorrentes que impactam o fluxo e os gráficos mensalmente.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Type Selector (Receita Recorrente vs Despesa Fixa) */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100/80 rounded-2xl border border-slate-200/60">
            <button
              type="button"
              onClick={() => handleTypeChange('expense')}
              className={`py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                type === 'expense'
                  ? 'bg-white text-rose-700 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TrendingDown className="w-4 h-4 text-rose-600" />
              Despesa Fixa (-)
            </button>

            <button
              type="button"
              onClick={() => handleTypeChange('income')}
              className={`py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                type === 'income'
                  ? 'bg-white text-emerald-700 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              Receita Recorrente (+)
            </button>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-700">
              {type === 'income' ? 'Identificação da Receita Recorrente *' : 'Identificação da Despesa Fixa *'}
            </label>
            <input
              type="text"
              required
              placeholder={
                type === 'income'
                  ? 'Ex: Fee Mensal de Gestão de Obra, Consultoria Contínua...'
                  : 'Ex: Aluguel do Escritório, Licença BIM/AutoCAD, Internet...'
              }
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white text-slate-800 font-medium"
            />
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-700">Categoria *</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white text-slate-800 font-medium"
            >
              {availableCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          {/* Amount, Frequency & Due Day Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700">Valor (R$) *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">R$</span>
                <input
                  type="text"
                  required
                  placeholder="0,00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className={`w-full pl-9 pr-2.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:border-indigo-500 bg-white font-bold font-mono ${
                    type === 'income' ? 'text-emerald-700 focus:ring-emerald-500/20' : 'text-slate-900 focus:ring-indigo-500/20'
                  }`}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-700">Frequência</label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as RecurringFrequency)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white text-slate-800 font-medium"
              >
                <option value="monthly">Mensal</option>
                <option value="yearly">Anual</option>
                <option value="quarterly">Trimestral</option>
                <option value="weekly">Semanal</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-700">Dia Vencimento *</label>
              <input
                type="number"
                min={1}
                max={31}
                required
                value={dueDay}
                onChange={(e) => setDueDay(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white text-slate-800 font-bold text-center"
              />
            </div>
          </div>

          {/* Project & Client / Partner Links (Optional) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 flex items-center gap-1.5">
                <FolderGit2 className="w-3.5 h-3.5 text-slate-400" /> Vínculo com Projeto (Opcional)
              </label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white text-slate-800 font-medium truncate"
              >
                <option value="">Nenhum projeto (Custo/Receita Geral)</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} - {p.title}
                  </option>
                ))}
              </select>
            </div>

            {type === 'income' ? (
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-400" /> Cliente Pagador (Opcional)
                </label>
                <select
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white text-slate-800 font-medium truncate"
                >
                  <option value="">Nenhum cliente específico</option>
                  {clients.map((cl) => (
                    <option key={cl.id} value={cl.id}>
                      {cl.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" /> Fornecedor / Empresa (Opcional)
                </label>
                <select
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white text-slate-800 font-medium truncate"
                >
                  <option value="">Nenhum fornecedor específico</option>
                  {companies.map((co) => (
                    <option key={co.id} value={co.id}>
                      {co.trade_name || co.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Payment Method & Start Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700">Forma de Pagamento Preferencial</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white text-slate-800 font-medium"
              >
                <option value="PIX">PIX</option>
                <option value="Boleto">Boleto Bancário</option>
                <option value="Debito_Automatico">Débito Automático</option>
                <option value="Cartao_Credito">Cartão de Crédito</option>
                <option value="TED">Transferência (TED)</option>
                <option value="Dinheiro">Dinheiro</option>
                <option value="Outro">Outro</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-700">Data de Início da Recorrência</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white text-slate-800 font-medium"
              />
            </div>
          </div>

          {/* Status Active Toggle (When editing) */}
          {isEditing && (
            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
              <div>
                <span className="font-bold text-slate-800 block">Recorrência Ativa</span>
                <span className="text-[11px] text-slate-500">
                  Desative caso tenha cancelado o contrato ou o serviço tenha expirado.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsActive(!isActive)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isActive
                    ? type === 'income'
                      ? 'bg-emerald-600'
                      : 'bg-indigo-600'
                    : 'bg-slate-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    isActive ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-700">Observações / Detalhes</label>
            <textarea
              rows={2}
              placeholder="Ex: Contrato com duração de 12 meses, reajuste pelo IPCA..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white text-slate-800 font-medium resize-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
            {isEditing ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting || isLoading}
                className="px-4 py-2.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Excluir
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading || isDeleting}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold transition-colors cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={isLoading || isDeleting}
                className={`px-5 py-2.5 rounded-xl text-white font-bold transition-all shadow-xs flex items-center gap-2 cursor-pointer ${
                  type === 'income'
                    ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                    : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20'
                }`}
              >
                {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                {isEditing ? 'Salvar Alterações' : type === 'income' ? 'Salvar Receita Recorrente' : 'Salvar Despesa Fixa'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
