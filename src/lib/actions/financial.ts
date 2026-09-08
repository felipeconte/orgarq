'use server'

import { requireAuth, requireOrgAccess, requireProjectAccess } from '@/lib/server/guard'
import { revalidatePath } from 'next/cache'
import { Database } from '@/types/database.types'
import {
  FinancialTransaction,
  RecurringExpense,
  FinancialSummary,
  ProjectProfitabilityItem,
  MonthCashFlowProjection,
  FINANCIAL_CATEGORIES,
  TransactionType,
  TransactionStatus,
  PaymentMethod,
  RecurringFrequency
} from '@/types/financial'

type TransactionUpdate = Database['public']['Tables']['financial_transactions']['Update']
type RecurringExpenseUpdate = Database['public']['Tables']['recurring_expenses']['Update']

// Trava em memória para evitar sincronizações simultâneas da mesma organização (Race Conditions)
const syncLocks = new Map<string, Promise<void>>()

// ==============================================================================
// 0. LIMPEZA DE DUPLICATAS & SINCRONIZADOR SEGURO DE RECORRÊNCIAS
// ==============================================================================

/**
 * Remove qualquer duplicata de lançamentos de recorrência no banco de dados,
 * mantendo apenas 1 lançamento por recorrência por data de vencimento.
 */
export async function cleanupDuplicateRecurringTransactions(
  supabase: any,
  organizationId: string
) {
  try {
    const { data: txs, error } = await supabase
      .from('financial_transactions')
      .select('id, recurring_expense_id, due_date, status, created_at')
      .eq('organization_id', organizationId)
      .not('recurring_expense_id', 'is', null)
      .order('created_at', { ascending: true })

    if (error || !txs || txs.length === 0) return

    // Agrupa por `recurring_expense_id` e `due_date`
    const grouped = new Map<string, any[]>()
    for (const tx of txs) {
      const key = `${tx.recurring_expense_id}_${tx.due_date}`
      if (!grouped.has(key)) {
        grouped.set(key, [])
      }
      grouped.get(key)!.push(tx)
    }

    const toDeleteIds: string[] = []

    for (const [_, list] of grouped.entries()) {
      if (list.length > 1) {
        // Se algum foi marcado como 'paid', mantém o pago. Senão mantém o primeiro criado.
        const paidItem = list.find((t) => t.status === 'paid')
        const keepItem = paidItem || list[0]

        for (const item of list) {
          if (item.id !== keepItem.id) {
            toDeleteIds.push(item.id)
          }
        }
      }
    }

    if (toDeleteIds.length > 0) {
      await supabase
        .from('financial_transactions')
        .delete()
        .in('id', toDeleteIds)
    }
  } catch (err) {
    console.error('Erro em cleanupDuplicateRecurringTransactions:', err)
  }
}

/**
 * Garante que todas as recorrências ativas tenham exatamente 1 registro
 * para o mês atual e próximo mês, com proteção estrita contra concorrência.
 */
export async function syncRecurringTransactionsForRange(
  supabase: any,
  organizationId: string,
  startDate?: string,
  endDate?: string
) {
  // Se já houver sincronização em andamento para esta organização, aguarda ela terminar
  if (syncLocks.has(organizationId)) {
    await syncLocks.get(organizationId)
    return
  }

  const syncPromise = (async () => {
    try {
      // 1. Limpa duplicatas existentes antes de gerar novos
      await cleanupDuplicateRecurringTransactions(supabase, organizationId)

      // 2. Busca recorrências ativas
      const { data: recurrings, error: recErr } = await supabase
        .from('recurring_expenses')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('is_active', true)

      if (recErr || !recurrings || recurrings.length === 0) return

      const now = new Date()
      // Limite controlado: Mês atual e próximo mês apenas
      const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)

      const rangeStart = startDate ? new Date(startDate + 'T00:00:00') : defaultStart
      const rangeEnd = endDate ? new Date(endDate + 'T23:59:59') : defaultEnd

      // Lista de meses a cobrir
      const monthsToSync: { year: number; month: number }[] = []
      let cur = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1)
      const endMonth = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), 1)

      while (cur <= endMonth) {
        monthsToSync.push({ year: cur.getFullYear(), month: cur.getMonth() + 1 })
        cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1)
      }

      // 3. Busca transações já existentes
      const { data: existingTxs } = await supabase
        .from('financial_transactions')
        .select('id, recurring_expense_id, due_date')
        .eq('organization_id', organizationId)
        .not('recurring_expense_id', 'is', null)

      const existingMap = new Set(
        existingTxs?.map((tx: any) => `${tx.recurring_expense_id}_${tx.due_date?.slice(0, 7)}`) || []
      )

      const toInsert: any[] = []
      const plannedKeys = new Set<string>()

      for (const rec of recurrings) {
        const recStartStr = rec.start_date || '2000-01-01'
        const recEndStr = rec.end_date

        for (const m of monthsToSync) {
          const monthKey = `${m.year}-${String(m.month).padStart(2, '0')}`
          const key = `${rec.id}_${monthKey}`

          if (existingMap.has(key) || plannedKeys.has(key)) {
            continue
          }

          // Calcula dia de vencimento
          const lastDayOfMonth = new Date(m.year, m.month, 0).getDate()
          const dueDay = Math.min(Math.max(1, rec.due_day || 5), lastDayOfMonth)
          const dueDateStr = `${monthKey}-${String(dueDay).padStart(2, '0')}`

          if (dueDateStr < recStartStr) {
            continue
          }
          if (recEndStr && dueDateStr > recEndStr) {
            continue
          }

          plannedKeys.add(key)
          toInsert.push({
            organization_id: organizationId,
            recurring_expense_id: rec.id,
            project_id: rec.project_id || null,
            client_id: rec.client_id || null,
            company_id: rec.company_id || null,
            type: rec.type || 'expense',
            category: rec.category,
            title: rec.title,
            description: rec.notes || (rec.type === 'income' ? 'Receita recorrente automática' : 'Despesa fixa automática'),
            amount: Number(rec.amount),
            due_date: dueDateStr,
            status: 'pending',
            payment_method: rec.payment_method || null
          })
        }
      }

      if (toInsert.length > 0) {
        await supabase.from('financial_transactions').insert(toInsert)
      }
    } catch (err) {
      console.error('Erro na sincronização de recorrências:', err)
    } finally {
      syncLocks.delete(organizationId)
    }
  })()

  syncLocks.set(organizationId, syncPromise)
  await syncPromise
}

/**
 * Sincroniza automaticamente todas as comissões RT da tabela `project_companies`
 * para a tabela `financial_transactions`, garantindo que apareçam no extrato,
 * nos relatórios de lucratividade e nos indicadores financeiros gerais.
 */
export async function syncProjectCommissionsToFinancial(
  supabase: any,
  organizationId: string
) {
  try {
    // 1. Busca todas as empresas/fornecedores vinculados a projetos nesta organização
    const { data: projectCompanies, error: pcError } = await supabase
      .from('project_companies')
      .select(`
        id,
        organization_id,
        project_id,
        company_id,
        service_description,
        category,
        contract_value,
        commission_type,
        commission_rate,
        expected_commission_amount,
        received_commission_amount,
        commission_status,
        commission_payment_method,
        commission_due_date,
        commission_paid_date,
        created_at,
        projects (
          id,
          code,
          title,
          client_name
        ),
        companies (
          id,
          name,
          trade_name
        )
      `)
      .eq('organization_id', organizationId)

    if (pcError || !projectCompanies) {
      if (pcError) console.error('Erro ao buscar project_companies para sincronização:', pcError)
      return
    }

    // 2. Busca todas as transações financeiras vinculadas a project_company_id
    const { data: existingTxs, error: txError } = await supabase
      .from('financial_transactions')
      .select('id, project_company_id, status, amount, due_date, payment_date, title, category, type, payment_method, project_id, company_id, created_at')
      .eq('organization_id', organizationId)
      .not('project_company_id', 'is', null)
      .order('created_at', { ascending: true })

    if (txError) {
      console.error('Erro ao buscar financial_transactions para sincronização de comissões:', txError)
      return
    }

    // Agrupa por project_company_id e remove duplicatas se houver mais de 1
    const txByProjectCompanyId = new Map<string, any>()
    const toDeleteDuplicates: string[] = []

    for (const tx of existingTxs || []) {
      if (tx.project_company_id) {
        if (!txByProjectCompanyId.has(tx.project_company_id)) {
          txByProjectCompanyId.set(tx.project_company_id, tx)
        } else {
          const current = txByProjectCompanyId.get(tx.project_company_id)
          if (tx.status === 'paid' && current.status !== 'paid') {
            toDeleteDuplicates.push(current.id)
            txByProjectCompanyId.set(tx.project_company_id, tx)
          } else {
            toDeleteDuplicates.push(tx.id)
          }
        }
      }
    }

    if (toDeleteDuplicates.length > 0) {
      await supabase.from('financial_transactions').delete().in('id', toDeleteDuplicates)
    }

    const currentPcIds = new Set<string>()

    for (const pc of projectCompanies) {
      currentPcIds.add(pc.id)

      const contractVal = Number(pc.contract_value || 0)
      const commRate = Number(pc.commission_rate || 0)
      const commType = pc.commission_type || 'percent'

      let expectedAmt = Number(pc.expected_commission_amount || 0)
      if (commType === 'percent' && contractVal > 0 && commRate > 0) {
        expectedAmt = (contractVal * commRate) / 100
      }

      const receivedAmt = Number(pc.received_commission_amount || 0)

      // Se não tem comissão esperada nem recebida nem valor contratual com taxa
      if (expectedAmt <= 0 && receivedAmt <= 0 && contractVal <= 0) {
        if (txByProjectCompanyId.has(pc.id)) {
          await supabase.from('financial_transactions').delete().eq('id', txByProjectCompanyId.get(pc.id).id)
        }
        continue
      }

      const isPaid = pc.commission_status === 'pago_total'
      const isCancelled = pc.commission_status === 'cancelado'

      let status: TransactionStatus = 'pending'
      if (isPaid) {
        status = 'paid'
      } else if (isCancelled) {
        status = 'cancelled'
      } else {
        status = 'pending'
      }

      let amount = 0
      if (isPaid) {
        amount = receivedAmt > 0 ? receivedAmt : (expectedAmt > 0 ? expectedAmt : contractVal)
      } else {
        amount = expectedAmt > 0 ? expectedAmt : (contractVal > 0 && commRate > 0 ? (contractVal * commRate) / 100 : contractVal)
      }

      if (amount <= 0) continue

      const comp = pc.companies || {}
      const compName = comp.trade_name || comp.name || 'Fornecedor'
      const proj = pc.projects || {}
      const projPart = proj.code ? `[${proj.code}] ` : ''
      const projTitle = proj.title ? ` - ${proj.title}` : ''
      const title = `Comissão RT: ${compName} ${projPart}${projTitle}`.trim()

      const dueDate = pc.commission_due_date || pc.created_at?.slice(0, 10) || new Date().toISOString().split('T')[0]
      const paymentDate = isPaid ? (pc.commission_paid_date || dueDate) : null

      const existing = txByProjectCompanyId.get(pc.id)

      if (existing) {
        // Verifica se precisa atualizar
        const needsUpdate =
          Number(existing.amount) !== Number(amount) ||
          existing.status !== status ||
          existing.due_date !== dueDate ||
          existing.payment_date !== paymentDate ||
          existing.project_id !== pc.project_id ||
          existing.company_id !== pc.company_id ||
          existing.title !== title

        if (needsUpdate) {
          await supabase
            .from('financial_transactions')
            .update({
              amount,
              status,
              due_date: dueDate,
              payment_date: paymentDate,
              project_id: pc.project_id,
              company_id: pc.company_id,
              title,
              payment_method: pc.commission_payment_method || existing.payment_method || 'PIX'
            })
            .eq('id', existing.id)
        }
      } else {
        // Insere novo lançamento de comissão
        await supabase
          .from('financial_transactions')
          .insert({
            organization_id: organizationId,
            project_id: pc.project_id,
            company_id: pc.company_id,
            project_company_id: pc.id,
            type: 'income',
            category: 'comissao_rt',
            title,
            description: pc.service_description
              ? `Referente ao serviço: ${pc.service_description}`
              : 'Comissão / Reserva Técnica (RT) de fornecedor parceiro na obra',
            amount,
            due_date: dueDate,
            payment_date: paymentDate,
            status,
            payment_method: pc.commission_payment_method || 'PIX'
          })
      }
    }

    // 3. Remove transações órfãs cujo project_company_id não existe mais
    for (const tx of existingTxs || []) {
      if (tx.project_company_id && !currentPcIds.has(tx.project_company_id)) {
        await supabase
          .from('financial_transactions')
          .delete()
          .eq('id', tx.id)
      }
    }
  } catch (err) {
    console.error('Erro em syncProjectCommissionsToFinancial:', err)
  }
}

// ==============================================================================
// 1. SUMÁRIO FINANCEIRO GERAL
// ==============================================================================

export async function getFinancialSummaryAction({
  organizationId,
  startDate,
  endDate,
  projectId
}: {
  organizationId: string
  startDate?: string
  endDate?: string
  projectId?: string
}): Promise<{ success: boolean; summary?: FinancialSummary; error?: string }> {
  try {
    const { supabase } = await requireOrgAccess(organizationId)

    // Sincroniza recorrências ativas e comissões RT
    await syncRecurringTransactionsForRange(supabase, organizationId, startDate, endDate)
    await syncProjectCommissionsToFinancial(supabase, organizationId)

    let query = supabase
      .from('financial_transactions')
      .select('*')
      .eq('organization_id', organizationId)

    if (projectId) {
      query = query.eq('project_id', projectId)
    }

    if (startDate) {
      query = query.gte('due_date', startDate)
    }

    if (endDate) {
      query = query.lte('due_date', endDate)
    }

    const { data: transactions, error } = await query

    if (error) {
      console.error('Erro ao buscar transações para sumário:', error)
      return { success: false, error: 'Erro ao calcular sumário financeiro.' }
    }

    // Busca despesas e receitas fixas ativas
    const { data: recurringData } = await supabase
      .from('recurring_expenses')
      .select('amount, frequency, type')
      .eq('organization_id', organizationId)
      .eq('is_active', true)

    let totalMonthlyFixedExpenses = 0
    let totalMonthlyRecurringIncome = 0

    recurringData?.forEach((rec) => {
      const amt = Number(rec.amount || 0)
      let monthlyVal = amt
      if (rec.frequency === 'yearly') monthlyVal = amt / 12
      else if (rec.frequency === 'quarterly') monthlyVal = amt / 3
      else if (rec.frequency === 'weekly') monthlyVal = amt * 4.33

      if (rec.type === 'income') {
        totalMonthlyRecurringIncome += monthlyVal
      } else {
        totalMonthlyFixedExpenses += monthlyVal
      }
    })

    const totalMonthlyRecurringNet = totalMonthlyRecurringIncome - totalMonthlyFixedExpenses

    const todayStr = new Date().toISOString().split('T')[0]

    let realizedIncome = 0
    let realizedExpense = 0
    let pendingIncome = 0
    let pendingExpense = 0
    let overdueIncome = 0
    let overdueExpense = 0
    let overdueCount = 0

    const incomeCatMap = new Map<string, number>()
    const expenseCatMap = new Map<string, number>()

    transactions?.forEach((tx) => {
      const amt = Number(tx.amount || 0)
      const isPaid = tx.status === 'paid'
      const isPending = tx.status === 'pending'
      const isOverdue = tx.status === 'overdue' || (isPending && tx.due_date < todayStr)

      if (tx.type === 'income') {
        if (isPaid) {
          realizedIncome += amt
        } else if (isPending || isOverdue) {
          pendingIncome += amt
          if (isOverdue) overdueIncome += amt
        }

        const currentCatAmt = incomeCatMap.get(tx.category) || 0
        incomeCatMap.set(tx.category, currentCatAmt + amt)
      } else if (tx.type === 'expense') {
        if (isPaid) {
          realizedExpense += amt
        } else if (isPending || isOverdue) {
          pendingExpense += amt
          if (isOverdue) {
            overdueExpense += amt
            overdueCount++
          }
        }

        const currentCatAmt = expenseCatMap.get(tx.category) || 0
        expenseCatMap.set(tx.category, currentCatAmt + amt)
      }
    })

    const totalIncome = realizedIncome + pendingIncome
    const totalExpense = realizedExpense + pendingExpense

    const incomesByCategory = Array.from(incomeCatMap.entries())
      .map(([catId, amount]) => {
        const catDef = FINANCIAL_CATEGORIES.find((c) => c.id === catId)
        return {
          category: catId,
          label: catDef?.label || catId,
          amount,
          percentage: totalIncome > 0 ? (amount / totalIncome) * 100 : 0
        }
      })
      .sort((a, b) => b.amount - a.amount)

    const expensesByCategory = Array.from(expenseCatMap.entries())
      .map(([catId, amount]) => {
        const catDef = FINANCIAL_CATEGORIES.find((c) => c.id === catId)
        return {
          category: catId,
          label: catDef?.label || catId,
          amount,
          percentage: totalExpense > 0 ? (amount / totalExpense) * 100 : 0
        }
      })
      .sort((a, b) => b.amount - a.amount)

    const summary: FinancialSummary = {
      realizedIncome,
      realizedExpense,
      realizedBalance: realizedIncome - realizedExpense,
      pendingIncome,
      pendingExpense,
      pendingBalance: pendingIncome - pendingExpense,
      totalIncome,
      totalExpense,
      projectedBalance: totalIncome - totalExpense,
      overdueExpense,
      overdueIncome,
      overdueCount,
      totalMonthlyFixedExpenses,
      totalMonthlyRecurringIncome,
      totalMonthlyRecurringNet,
      incomesByCategory,
      expensesByCategory
    }

    return { success: true, summary }
  } catch (error: any) {
    console.error('Erro em getFinancialSummaryAction:', error)
    return { success: false, error: error.message || 'Erro inesperado ao buscar sumário financeiro.' }
  }
}

// ==============================================================================
// 2. LISTAGEM DE TRANSAÇÕES FINANCEIRAS
// ==============================================================================

export interface GetTransactionsFilters {
  organizationId: string
  projectId?: string
  companyId?: string
  clientId?: string
  type?: TransactionType | 'all'
  status?: TransactionStatus | 'all'
  category?: string
  startDate?: string
  endDate?: string
  search?: string
}

export async function getFinancialTransactionsAction(
  filters: GetTransactionsFilters
): Promise<{ success: boolean; transactions?: FinancialTransaction[]; error?: string }> {
  try {
    const { supabase } = await requireOrgAccess(filters.organizationId)

    // Sincroniza recorrências ativas com trava de concorrência e limpeza de duplicatas
    await syncRecurringTransactionsForRange(
      supabase,
      filters.organizationId,
      filters.startDate,
      filters.endDate
    )
    // Sincroniza comissões RT de fornecedores
    await syncProjectCommissionsToFinancial(supabase, filters.organizationId)

    let query = supabase
      .from('financial_transactions')
      .select(`
        *,
        projects (
          id,
          code,
          title,
          client_name
        ),
        companies (
          id,
          name,
          trade_name
        ),
        clients (
          id,
          name
        )
      `)
      .eq('organization_id', filters.organizationId)
      .order('due_date', { ascending: false })

    if (filters.projectId) {
      query = query.eq('project_id', filters.projectId)
    }

    if (filters.companyId) {
      query = query.eq('company_id', filters.companyId)
    }

    if (filters.clientId) {
      query = query.eq('client_id', filters.clientId)
    }

    if (filters.type && filters.type !== 'all') {
      query = query.eq('type', filters.type)
    }

    if (filters.status && filters.status !== 'all') {
      query = query.eq('status', filters.status)
    }

    if (filters.category && filters.category !== 'all') {
      query = query.eq('category', filters.category)
    }

    if (filters.startDate) {
      query = query.gte('due_date', filters.startDate)
    }

    if (filters.endDate) {
      query = query.lte('due_date', filters.endDate)
    }

    if (filters.search && filters.search.trim()) {
      const term = `%${filters.search.trim()}%`
      query = query.or(`title.ilike.${term},description.ilike.${term}`)
    }

    const { data, error } = await query

    if (error) {
      console.error('Erro ao buscar transações financeiras:', error)
      return { success: false, error: 'Erro ao buscar extrato financeiro.' }
    }

    return {
      success: true,
      transactions: (data || []) as unknown as FinancialTransaction[]
    }
  } catch (error: any) {
    console.error('Erro em getFinancialTransactionsAction:', error)
    return { success: false, error: error.message || 'Erro inesperado.' }
  }
}

// ==============================================================================
// 3. CRUD DE TRANSAÇÕES
// ==============================================================================

export interface CreateTransactionInput {
  organizationId: string
  projectId?: string | null
  companyId?: string | null
  clientId?: string | null
  type: TransactionType
  category: string
  title: string
  description?: string | null
  amount: number
  dueDate: string
  paymentDate?: string | null
  status?: TransactionStatus
  paymentMethod?: PaymentMethod | string | null
  receiptUrl?: string | null
  isRecurring?: boolean
  recurringFrequency?: RecurringFrequency
}

export async function createFinancialTransactionAction(
  input: CreateTransactionInput
): Promise<{ success: boolean; transaction?: FinancialTransaction; error?: string }> {
  try {
    const { supabase, user } = await requireOrgAccess(input.organizationId)

    if (!input.title || !input.title.trim()) {
      return { success: false, error: 'O título do lançamento é obrigatório.' }
    }

    if (!input.amount || input.amount <= 0) {
      return { success: false, error: 'O valor deve ser maior que zero.' }
    }

    if (!input.dueDate) {
      return { success: false, error: 'A data de vencimento/previsão é obrigatória.' }
    }

    let recurringId: string | null = null

    // Se o usuário marcou para tornar recorrente
    if (input.isRecurring) {
      const dueDay = parseInt(input.dueDate.split('-')[2], 10) || 5
      const { data: recData, error: recError } = await supabase
        .from('recurring_expenses')
        .insert({
          organization_id: input.organizationId,
          type: input.type,
          title: input.title.trim(),
          category: input.category,
          amount: Number(input.amount),
          frequency: input.recurringFrequency || 'monthly',
          due_day: dueDay,
          start_date: input.dueDate,
          payment_method: input.paymentMethod || null,
          project_id: input.projectId || null,
          client_id: input.clientId || null,
          company_id: input.companyId || null,
          is_active: true,
          notes: input.description?.trim() || null
        })
        .select('id')
        .single()

      if (!recError && recData) {
        recurringId = recData.id
      }
    }

    const payload = {
      organization_id: input.organizationId,
      project_id: input.projectId || null,
      company_id: input.companyId || null,
      client_id: input.clientId || null,
      recurring_expense_id: recurringId,
      type: input.type,
      category: input.category,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      amount: Number(input.amount),
      due_date: input.dueDate,
      payment_date: input.paymentDate || (input.status === 'paid' ? input.dueDate : null),
      status: input.status || 'pending',
      payment_method: input.paymentMethod || null,
      receipt_url: input.receiptUrl || null,
      created_by: user.id
    }

    const { data, error } = await supabase
      .from('financial_transactions')
      .insert(payload)
      .select(`
        *,
        projects (
          id,
          code,
          title,
          client_name
        ),
        companies (
          id,
          name,
          trade_name
        ),
        clients (
          id,
          name
        )
      `)
      .single()

    if (error) {
      console.error('Erro ao criar lançamento:', error)
      return { success: false, error: 'Falha ao salvar lançamento no banco de dados.' }
    }

    revalidatePath('/app/financeiro')
    if (input.projectId) {
      revalidatePath(`/app/projetos/${input.projectId}`)
      revalidatePath(`/app/projetos/${input.projectId}/financeiro`)
    }

    return {
      success: true,
      transaction: data as unknown as FinancialTransaction
    }
  } catch (error: any) {
    console.error('Erro em createFinancialTransactionAction:', error)
    return { success: false, error: error.message || 'Erro inesperado ao criar lançamento.' }
  }
}

export interface UpdateTransactionInput {
  id: string
  organizationId: string
  projectId?: string | null
  companyId?: string | null
  clientId?: string | null
  type?: TransactionType
  category?: string
  title?: string
  description?: string | null
  amount?: number
  dueDate?: string
  paymentDate?: string | null
  status?: TransactionStatus
  paymentMethod?: PaymentMethod | string | null
  receiptUrl?: string | null
}

export async function updateFinancialTransactionAction(
  input: UpdateTransactionInput
): Promise<{ success: boolean; transaction?: FinancialTransaction; error?: string }> {
  try {
    const { supabase } = await requireOrgAccess(input.organizationId)

    const updatePayload: TransactionUpdate = {}

    if (input.title !== undefined) updatePayload.title = input.title.trim()
    if (input.description !== undefined) updatePayload.description = input.description?.trim() || null
    if (input.amount !== undefined) updatePayload.amount = Number(input.amount)
    if (input.type !== undefined) updatePayload.type = input.type
    if (input.category !== undefined) updatePayload.category = input.category
    if (input.dueDate !== undefined) updatePayload.due_date = input.dueDate
    if (input.paymentDate !== undefined) updatePayload.payment_date = input.paymentDate
    if (input.status !== undefined) updatePayload.status = input.status
    if (input.paymentMethod !== undefined) updatePayload.payment_method = input.paymentMethod
    if (input.receiptUrl !== undefined) updatePayload.receipt_url = input.receiptUrl
    if (input.projectId !== undefined) updatePayload.project_id = input.projectId
    if (input.companyId !== undefined) updatePayload.company_id = input.companyId
    if (input.clientId !== undefined) updatePayload.client_id = input.clientId

    const { data, error } = await supabase
      .from('financial_transactions')
      .update(updatePayload)
      .eq('id', input.id)
      .eq('organization_id', input.organizationId)
      .select(`
        *,
        projects (
          id,
          code,
          title,
          client_name
        ),
        companies (
          id,
          name,
          trade_name
        ),
        clients (
          id,
          name
        )
      `)
      .single()

    if (error) {
      console.error('Erro ao atualizar lançamento:', error)
      return { success: false, error: 'Falha ao atualizar lançamento.' }
    }

    revalidatePath('/app/financeiro')
    if (data?.project_id) {
      revalidatePath(`/app/projetos/${data.project_id}`)
      revalidatePath(`/app/projetos/${data.project_id}/financeiro`)
    }

    return {
      success: true,
      transaction: data as unknown as FinancialTransaction
    }
  } catch (error: any) {
    console.error('Erro em updateFinancialTransactionAction:', error)
    return { success: false, error: error.message || 'Erro inesperado ao atualizar lançamento.' }
  }
}

export async function deleteFinancialTransactionAction({
  id,
  organizationId,
  deleteSeries = false
}: {
  id: string
  organizationId: string
  deleteSeries?: boolean
}): Promise<{ success: boolean; deletedRecurringId?: string | null; error?: string }> {
  try {
    const { supabase } = await requireOrgAccess(organizationId)

    const { data: existing } = await supabase
      .from('financial_transactions')
      .select('project_id, recurring_expense_id')
      .eq('id', id)
      .eq('organization_id', organizationId)
      .maybeSingle()

    if (existing?.recurring_expense_id && deleteSeries) {
      // 1. Remove primeiro todos os lançamentos vinculados a essa recorrência (evita ON DELETE SET NULL)
      await supabase
        .from('financial_transactions')
        .delete()
        .eq('recurring_expense_id', existing.recurring_expense_id)
        .eq('organization_id', organizationId)

      // 2. Remove a regra de recorrência da tabela principal
      await supabase
        .from('recurring_expenses')
        .delete()
        .eq('id', existing.recurring_expense_id)
        .eq('organization_id', organizationId)
    } else {
      const { error } = await supabase
        .from('financial_transactions')
        .delete()
        .eq('id', id)
        .eq('organization_id', organizationId)

      if (error) {
        console.error('Erro ao deletar lançamento:', error)
        return { success: false, error: 'Falha ao remover lançamento.' }
      }
    }

    revalidatePath('/app/financeiro')
    if (existing?.project_id) {
      revalidatePath(`/app/projetos/${existing.project_id}`)
      revalidatePath(`/app/projetos/${existing.project_id}/financeiro`)
    }

    return {
      success: true,
      deletedRecurringId: deleteSeries ? existing?.recurring_expense_id : null
    }
  } catch (error: any) {
    console.error('Erro em deleteFinancialTransactionAction:', error)
    return { success: false, error: error.message || 'Erro inesperado ao remover lançamento.' }
  }
}

export async function toggleTransactionStatusAction({
  id,
  organizationId,
  status,
  paymentDate
}: {
  id: string
  organizationId: string
  status: TransactionStatus
  paymentDate?: string
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase } = await requireOrgAccess(organizationId)

    const actualDate = paymentDate || (status === 'paid' ? new Date().toISOString().split('T')[0] : null)

    const { data, error } = await supabase
      .from('financial_transactions')
      .update({
        status,
        payment_date: actualDate
      })
      .eq('id', id)
      .eq('organization_id', organizationId)
      .select('project_id, project_company_id, amount')
      .single()

    if (error) {
      console.error('Erro ao alternar status da transação:', error)
      return { success: false, error: 'Falha ao atualizar status.' }
    }

    // Se for uma transação originada de comissão RT de fornecedor (project_companies)
    if (data?.project_company_id) {
      const commStatus = status === 'paid' ? 'pago_total' : 'pendente'
      const commReceived = status === 'paid' ? Number(data.amount || 0) : 0
      const commPaidDate = status === 'paid' ? actualDate : null

      await supabase
        .from('project_companies')
        .update({
          commission_status: commStatus,
          received_commission_amount: commReceived,
          commission_paid_date: commPaidDate
        })
        .eq('id', data.project_company_id)

      if (data.project_id) {
        revalidatePath(`/app/projetos/${data.project_id}/fornecedores`)
      }
    }

    revalidatePath('/app/financeiro')
    if (data?.project_id) {
      revalidatePath(`/app/projetos/${data.project_id}`)
      revalidatePath(`/app/projetos/${data.project_id}/financeiro`)
    }

    return { success: true }
  } catch (error: any) {
    console.error('Erro em toggleTransactionStatusAction:', error)
    return { success: false, error: error.message || 'Erro inesperado ao atualizar status.' }
  }
}

// ==============================================================================
// 4. CRUD DE RECORRÊNCIAS (RECEITAS E DESPESAS FIXAS)
// ==============================================================================

export async function getRecurringExpensesAction(
  organizationId: string,
  type?: TransactionType | 'all'
): Promise<{ success: boolean; expenses?: RecurringExpense[]; error?: string }> {
  try {
    const { supabase } = await requireOrgAccess(organizationId)

    let query = supabase
      .from('recurring_expenses')
      .select(`
        *,
        projects (
          id,
          code,
          title,
          client_name
        ),
        clients (
          id,
          name
        ),
        companies (
          id,
          name,
          trade_name
        )
      `)
      .eq('organization_id', organizationId)
      .order('due_day', { ascending: true })

    if (type && type !== 'all') {
      query = query.eq('type', type)
    }

    const { data, error } = await query

    if (error) {
      console.error('Erro ao buscar recorrências:', error)
      return { success: false, error: 'Falha ao buscar recorrências.' }
    }

    return {
      success: true,
      expenses: (data || []) as unknown as RecurringExpense[]
    }
  } catch (error: any) {
    console.error('Erro em getRecurringExpensesAction:', error)
    return { success: false, error: error.message || 'Erro inesperado.' }
  }
}

export interface CreateRecurringExpenseInput {
  organizationId: string
  type?: TransactionType
  projectId?: string | null
  clientId?: string | null
  companyId?: string | null
  title: string
  category: string
  amount: number
  frequency?: RecurringFrequency
  dueDay: number
  startDate?: string
  endDate?: string | null
  paymentMethod?: PaymentMethod | string | null
  notes?: string | null
}

export async function createRecurringExpenseAction(
  input: CreateRecurringExpenseInput
): Promise<{ success: boolean; expense?: RecurringExpense; error?: string }> {
  try {
    const { supabase } = await requireOrgAccess(input.organizationId)

    if (!input.title || !input.title.trim()) {
      return { success: false, error: 'O nome da recorrência é obrigatório.' }
    }

    if (!input.amount || input.amount <= 0) {
      return { success: false, error: 'O valor deve ser maior que zero.' }
    }

    const recType = input.type || 'expense'

    const { data, error } = await supabase
      .from('recurring_expenses')
      .insert({
        organization_id: input.organizationId,
        type: recType,
        project_id: input.projectId || null,
        client_id: input.clientId || null,
        company_id: input.companyId || null,
        title: input.title.trim(),
        category: input.category,
        amount: Number(input.amount),
        frequency: input.frequency || 'monthly',
        due_day: Number(input.dueDay || 5),
        start_date: input.startDate || new Date().toISOString().split('T')[0],
        end_date: input.endDate || null,
        payment_method: input.paymentMethod || null,
        is_active: true,
        notes: input.notes?.trim() || null
      })
      .select(`
        *,
        projects (
          id,
          code,
          title,
          client_name
        ),
        clients (
          id,
          name
        ),
        companies (
          id,
          name,
          trade_name
        )
      `)
      .single()

    if (error) {
      console.error('Erro ao criar recorrência:', error)
      return { success: false, error: 'Falha ao salvar recorrência.' }
    }

    // Sincroniza imediatamente o lançamento no banco de dados
    await syncRecurringTransactionsForRange(supabase, input.organizationId)

    revalidatePath('/app/financeiro')

    return {
      success: true,
      expense: data as unknown as RecurringExpense
    }
  } catch (error: any) {
    console.error('Erro em createRecurringExpenseAction:', error)
    return { success: false, error: error.message || 'Erro inesperado.' }
  }
}

export interface UpdateRecurringExpenseInput {
  id: string
  organizationId: string
  type?: TransactionType
  projectId?: string | null
  clientId?: string | null
  companyId?: string | null
  title?: string
  category?: string
  amount?: number
  frequency?: RecurringFrequency
  dueDay?: number
  startDate?: string
  endDate?: string | null
  paymentMethod?: PaymentMethod | string | null
  isActive?: boolean
  notes?: string | null
}

export async function updateRecurringExpenseAction(
  input: UpdateRecurringExpenseInput
): Promise<{ success: boolean; expense?: RecurringExpense; error?: string }> {
  try {
    const { supabase } = await requireOrgAccess(input.organizationId)

    const updatePayload: RecurringExpenseUpdate = {}

    if (input.type !== undefined) updatePayload.type = input.type
    if (input.projectId !== undefined) updatePayload.project_id = input.projectId
    if (input.clientId !== undefined) updatePayload.client_id = input.clientId
    if (input.companyId !== undefined) updatePayload.company_id = input.companyId
    if (input.title !== undefined) updatePayload.title = input.title.trim()
    if (input.category !== undefined) updatePayload.category = input.category
    if (input.amount !== undefined) updatePayload.amount = Number(input.amount)
    if (input.frequency !== undefined) updatePayload.frequency = input.frequency
    if (input.dueDay !== undefined) updatePayload.due_day = Number(input.dueDay)
    if (input.startDate !== undefined) updatePayload.start_date = input.startDate
    if (input.endDate !== undefined) updatePayload.end_date = input.endDate
    if (input.paymentMethod !== undefined) updatePayload.payment_method = input.paymentMethod
    if (input.isActive !== undefined) updatePayload.is_active = input.isActive
    if (input.notes !== undefined) updatePayload.notes = input.notes?.trim() || null

    const { data, error } = await supabase
      .from('recurring_expenses')
      .update(updatePayload)
      .eq('id', input.id)
      .eq('organization_id', input.organizationId)
      .select(`
        *,
        projects (
          id,
          code,
          title,
          client_name
        ),
        clients (
          id,
          name
        ),
        companies (
          id,
          name,
          trade_name
        )
      `)
      .single()

    if (error) {
      console.error('Erro ao atualizar recorrência:', error)
      return { success: false, error: 'Falha ao atualizar recorrência.' }
    }

    // Atualiza lançamentos pendentes futuros
    if (data) {
      await supabase
        .from('financial_transactions')
        .update({
          title: data.title,
          category: data.category,
          amount: data.amount,
          type: data.type,
          payment_method: data.payment_method
        })
        .eq('recurring_expense_id', input.id)
        .eq('status', 'pending')
    }

    // Limpa e sincroniza
    await syncRecurringTransactionsForRange(supabase, input.organizationId)

    revalidatePath('/app/financeiro')

    return {
      success: true,
      expense: data as unknown as RecurringExpense
    }
  } catch (error: any) {
    console.error('Erro em updateRecurringExpenseAction:', error)
    return { success: false, error: error.message || 'Erro inesperado.' }
  }
}

export async function deleteRecurringExpenseAction({
  id,
  organizationId
}: {
  id: string
  organizationId: string
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase } = await requireOrgAccess(organizationId)

    // Remove todos os lançamentos vinculados a essa regra
    await supabase
      .from('financial_transactions')
      .delete()
      .eq('recurring_expense_id', id)
      .eq('organization_id', organizationId)

    const { error } = await supabase
      .from('recurring_expenses')
      .delete()
      .eq('id', id)
      .eq('organization_id', organizationId)

    if (error) {
      console.error('Erro ao deletar recorrência:', error)
      return { success: false, error: 'Falha ao remover recorrência.' }
    }

    revalidatePath('/app/financeiro')

    return { success: true }
  } catch (error: any) {
    console.error('Erro em deleteRecurringExpenseAction:', error)
    return { success: false, error: error.message || 'Erro inesperado.' }
  }
}

// ==============================================================================
// 5. RELATÓRIO DE LUCRATIVIDADE POR PROJETO
// ==============================================================================

export async function getProjectsProfitabilityAction(
  organizationId: string
): Promise<{ success: boolean; projects?: ProjectProfitabilityItem[]; error?: string }> {
  try {
    const { supabase } = await requireOrgAccess(organizationId)

    // Sincroniza comissões de fornecedores
    await syncProjectCommissionsToFinancial(supabase, organizationId)

    // 1. Busca todos os projetos
    const { data: projectsData, error: projErr } = await supabase
      .from('projects')
      .select('id, code, title, client_name, status, typology')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })

    if (projErr || !projectsData) {
      return { success: false, error: 'Erro ao buscar projetos.' }
    }

    // 2. Busca todas as transações financeiras vinculadas a projetos
    const { data: transactionsData } = await supabase
      .from('financial_transactions')
      .select('project_id, type, category, amount, status')
      .eq('organization_id', organizationId)
      .not('project_id', 'is', null)

    // Mapeia por projeto
    const profitabilityList: ProjectProfitabilityItem[] = projectsData.map((proj) => {
      let directContractIncome = 0
      let commissionsIncome = 0
      let pendingRevenue = 0
      let pendingCommissions = 0
      let expensesTotal = 0
      let pendingExpenses = 0

      const expensesBreakdown = {
        visitas: 0,
        brindes: 0,
        locacao: 0,
        plotagens: 0,
        maquetes: 0,
        taxas: 0,
        outros: 0
      }

      // Transações financeiras diretas (incluindo comissões RT sincronizadas)
      transactionsData
        ?.filter((tx) => tx.project_id === proj.id)
        .forEach((tx) => {
          const amt = Number(tx.amount || 0)
          const isPaid = tx.status === 'paid'

          if (tx.type === 'income') {
            if (isPaid) {
              if (tx.category === 'comissao_rt') {
                commissionsIncome += amt
              } else {
                directContractIncome += amt
              }
            } else if (tx.status === 'pending' || tx.status === 'overdue') {
              pendingRevenue += amt
              if (tx.category === 'comissao_rt') {
                pendingCommissions += amt
              }
            }
          } else if (tx.type === 'expense') {
            if (isPaid) {
              expensesTotal += amt
              if (tx.category === 'visitas_deslocamento') expensesBreakdown.visitas += amt
              else if (tx.category === 'brindes_mimos') expensesBreakdown.brindes += amt
              else if (tx.category === 'locacao_espaco') expensesBreakdown.locacao += amt
              else if (tx.category === 'impressao_plotagem') expensesBreakdown.plotagens += amt
              else if (tx.category === 'maquete_render') expensesBreakdown.maquetes += amt
              else if (tx.category === 'taxas_art_rrt') expensesBreakdown.taxas += amt
              else expensesBreakdown.outros += amt
            } else if (tx.status === 'pending' || tx.status === 'overdue') {
              pendingExpenses += amt
            }
          }
        })

      const totalRevenue = directContractIncome + commissionsIncome
      const netProfit = totalRevenue - expensesTotal
      const profitMarginPercent = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0

      return {
        projectId: proj.id,
        projectCode: proj.code,
        projectTitle: proj.title,
        clientName: proj.client_name,
        status: proj.status,
        typology: proj.typology,
        directContractIncome,
        commissionsIncome,
        pendingCommissions,
        totalRevenue,
        pendingRevenue,
        expensesTotal,
        pendingExpenses,
        expensesBreakdown,
        netProfit,
        profitMarginPercent
      }
    })

    return { success: true, projects: profitabilityList }
  } catch (error: any) {
    console.error('Erro em getProjectsProfitabilityAction:', error)
    return { success: false, error: error.message || 'Erro inesperado.' }
  }
}

// ==============================================================================
// 6. PROJEÇÃO DE FLUXO DE CAIXA (PASSADO, PRESENTE E FUTURO)
// ==============================================================================

export async function getFutureCashFlowProjectionAction({
  organizationId,
  monthsAhead = 6
}: {
  organizationId: string
  monthsAhead?: number
}): Promise<{ success: boolean; timeline?: MonthCashFlowProjection[]; error?: string }> {
  try {
    const { supabase } = await requireOrgAccess(organizationId)

    // Sincroniza comissões de fornecedores
    await syncProjectCommissionsToFinancial(supabase, organizationId)

    // Busca todas as transações
    const { data: allTransactions } = await supabase
      .from('financial_transactions')
      .select('type, amount, due_date, payment_date, status')
      .eq('organization_id', organizationId)

    // Busca despesas e receitas fixas recorrentes ativas
    const { data: recurringData } = await supabase
      .from('recurring_expenses')
      .select('amount, frequency, type, is_active')
      .eq('organization_id', organizationId)
      .eq('is_active', true)

    let monthlyFixedTotal = 0
    let monthlyRecurringIncomeTotal = 0

    recurringData?.forEach((rec) => {
      const amt = Number(rec.amount || 0)
      let monthlyVal = amt
      if (rec.frequency === 'yearly') monthlyVal = amt / 12
      else if (rec.frequency === 'quarterly') monthlyVal = amt / 3
      else if (rec.frequency === 'weekly') monthlyVal = amt * 4.33

      if (rec.type === 'income') {
        monthlyRecurringIncomeTotal += monthlyVal
      } else {
        monthlyFixedTotal += monthlyVal
      }
    })

    // Gera lista de meses: 3 meses passados + mês atual + monthsAhead meses futuros
    const now = new Date()
    const months: MonthCashFlowProjection[] = []
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

    let runningAccumulatedBalance = 0

    for (let offset = -3; offset <= monthsAhead; offset++) {
      const targetDate = new Date(now.getFullYear(), now.getMonth() + offset, 1)
      const year = targetDate.getFullYear()
      const month = targetDate.getMonth() + 1
      const monthKey = `${year}-${String(month).padStart(2, '0')}`
      const monthLabel = `${monthNames[month - 1]} ${year}`

      const isPast = offset < 0
      const isCurrent = offset === 0
      const isFuture = offset > 0

      let realizedIncome = 0
      let realizedExpense = 0
      let projectedIncome = 0
      let projectedExpense = 0

      // Transações no mês
      allTransactions?.forEach((tx) => {
        const txDate = tx.due_date || tx.payment_date
        if (txDate && txDate.startsWith(monthKey)) {
          const amt = Number(tx.amount || 0)
          const isPaid = tx.status === 'paid'

          if (tx.type === 'income') {
            if (isPaid) realizedIncome += amt
            else projectedIncome += amt
          } else if (tx.type === 'expense') {
            if (isPaid) realizedExpense += amt
            else projectedExpense += amt
          }
        }
      })

      // Para meses futuros, projeta valores de despesa fixa e receita recorrente se não houver registros manuais suficientes
      if (isFuture) {
        if (projectedExpense < monthlyFixedTotal) {
          projectedExpense = monthlyFixedTotal
        }
        if (projectedIncome < monthlyRecurringIncomeTotal) {
          projectedIncome = monthlyRecurringIncomeTotal
        }
      } else if (isCurrent) {
        const currentTotalExp = realizedExpense + projectedExpense
        if (currentTotalExp < monthlyFixedTotal) {
          projectedExpense += (monthlyFixedTotal - currentTotalExp)
        }
        const currentTotalInc = realizedIncome + projectedIncome
        if (currentTotalInc < monthlyRecurringIncomeTotal) {
          projectedIncome += (monthlyRecurringIncomeTotal - currentTotalInc)
        }
      }

      const realizedBalance = realizedIncome - realizedExpense
      const totalMonthIncome = realizedIncome + projectedIncome
      const totalMonthExpense = realizedExpense + projectedExpense
      const projectedBalance = totalMonthIncome - totalMonthExpense

      runningAccumulatedBalance += isPast ? realizedBalance : projectedBalance

      months.push({
        monthKey,
        monthLabel,
        isPast,
        isCurrent,
        isFuture,
        realizedIncome,
        realizedExpense,
        realizedBalance,
        projectedIncome: totalMonthIncome,
        projectedExpense: totalMonthExpense,
        projectedBalance,
        accumulatedBalance: runningAccumulatedBalance
      })
    }

    return { success: true, timeline: months }
  } catch (error: any) {
    console.error('Erro em getFutureCashFlowProjectionAction:', error)
    return { success: false, error: error.message || 'Erro ao gerar projeção futura.' }
  }
}
