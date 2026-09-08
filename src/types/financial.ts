export type TransactionType = 'income' | 'expense'

export type TransactionStatus = 'pending' | 'paid' | 'overdue' | 'cancelled'

export type PaymentMethod =
  | 'PIX'
  | 'Boleto'
  | 'Cartao_Credito'
  | 'Cartao_Debito'
  | 'TED'
  | 'Debito_Automatico'
  | 'Dinheiro'
  | 'Outro'

export type RecurringFrequency = 'monthly' | 'yearly' | 'quarterly' | 'weekly'

// Categorias padronizadas
export interface FinancialCategoryOption {
  id: string
  label: string
  type: TransactionType
  group: 'projeto' | 'escritorio' | 'geral'
  color?: string
}

export const FINANCIAL_CATEGORIES: FinancialCategoryOption[] = [
  // Receitas (Income)
  { id: 'honorarios_projeto', label: 'Honorários de Projeto', type: 'income', group: 'projeto', color: 'emerald' },
  { id: 'fee_acompanhamento', label: 'Fee Mensal de Acompanhamento / Gestão', type: 'income', group: 'projeto', color: 'emerald' },
  { id: 'comissao_rt', label: 'Comissão / Reserva Técnica (RT)', type: 'income', group: 'projeto', color: 'blue' },
  { id: 'consultoria', label: 'Consultoria Arquitetônica', type: 'income', group: 'geral', color: 'teal' },
  { id: 'consultoria_mensal', label: 'Consultoria / Assessoria Recorrente', type: 'income', group: 'geral', color: 'teal' },
  { id: 'sublocacao_espaco', label: 'Sublocação de Espaço / Coworking', type: 'income', group: 'geral', color: 'cyan' },
  { id: 'reembolso', label: 'Reembolso de Cliente / Parceiro', type: 'income', group: 'projeto', color: 'indigo' },
  { id: 'rendimento', label: 'Rendimento Financeiro', type: 'income', group: 'geral', color: 'cyan' },
  { id: 'outros_ganhos', label: 'Outras Receitas', type: 'income', group: 'geral', color: 'slate' },

  // Despesas de Projeto (Project Expenses)
  { id: 'visitas_deslocamento', label: 'Visitas à Obra / Deslocamento', type: 'expense', group: 'projeto', color: 'amber' },
  { id: 'brindes_mimos', label: 'Brindes / Mimos de Cliente', type: 'expense', group: 'projeto', color: 'pink' },
  { id: 'locacao_espaco', label: 'Aluguel de Sala de Reunião / Coworking', type: 'expense', group: 'projeto', color: 'orange' },
  { id: 'impressao_plotagem', label: 'Impressões / Plotagens / Cadernos', type: 'expense', group: 'projeto', color: 'purple' },
  { id: 'maquete_render', label: 'Renderização 3D / Maquetes Terceirizadas', type: 'expense', group: 'projeto', color: 'rose' },
  { id: 'taxas_art_rrt', label: 'Taxas RRT / ART / Alvarás', type: 'expense', group: 'projeto', color: 'red' },
  { id: 'material_amostras', label: 'Amostras de Materiais / Catálogos', type: 'expense', group: 'projeto', color: 'amber' },
  { id: 'outras_despesas_projeto', label: 'Outros Custos Diretos do Projeto', type: 'expense', group: 'projeto', color: 'slate' },

  // Despesas Gerais do Escritório (Office Expenses)
  { id: 'aluguel_condominio', label: 'Aluguel & Condomínio do Escritório', type: 'expense', group: 'escritorio', color: 'red' },
  { id: 'energia_internet', label: 'Energia, Água & Internet', type: 'expense', group: 'escritorio', color: 'amber' },
  { id: 'softwares_licencas', label: 'Softwares & Licenças (BIM/CAD/3D)', type: 'expense', group: 'escritorio', color: 'blue' },
  { id: 'contabilidade_juridico', label: 'Contabilidade & Assessoria Jurídica', type: 'expense', group: 'escritorio', color: 'indigo' },
  { id: 'salarios_equipe', label: 'Equipe, Estagiários & Pró-labore', type: 'expense', group: 'escritorio', color: 'violet' },
  { id: 'marketing_anuncios', label: 'Marketing, Tráfego & Redes Sociais', type: 'expense', group: 'escritorio', color: 'pink' },
  { id: 'impostos', label: 'Impostos & Taxas Governamentais (DAS)', type: 'expense', group: 'escritorio', color: 'rose' },
  { id: 'material_escritorio', label: 'Material de Escritório & Café', type: 'expense', group: 'escritorio', color: 'slate' },
  { id: 'outros_custos_fixos', label: 'Outras Despesas do Escritório', type: 'expense', group: 'escritorio', color: 'slate' },
]

export interface FinancialTransaction {
  id: string
  organization_id: string
  project_id: string | null
  company_id: string | null
  client_id: string | null
  recurring_expense_id: string | null
  project_company_id?: string | null
  type: TransactionType
  category: string
  title: string
  description: string | null
  amount: number
  due_date: string
  payment_date: string | null
  status: TransactionStatus
  payment_method: PaymentMethod | string | null
  receipt_url: string | null
  created_by: string | null
  created_at: string
  updated_at: string

  // Joins opcionais
  projects?: {
    id: string
    code: string
    title: string
    client_name: string
  } | null
  companies?: {
    id: string
    name: string
    trade_name: string | null
  } | null
  clients?: {
    id: string
    name: string
  } | null
}

export interface RecurringExpense {
  id: string
  organization_id: string
  project_id?: string | null
  client_id?: string | null
  company_id?: string | null
  type: TransactionType
  title: string
  category: string
  amount: number
  frequency: RecurringFrequency
  due_day: number
  start_date: string
  end_date: string | null
  payment_method: PaymentMethod | string | null
  is_active: boolean
  notes: string | null
  created_at: string
  updated_at: string

  // Joins opcionais
  projects?: {
    id: string
    code: string
    title: string
    client_name: string
  } | null
  clients?: {
    id: string
    name: string
  } | null
  companies?: {
    id: string
    name: string
    trade_name: string | null
  } | null
}

export interface FinancialSummary {
  // Realizado (Efetivamente pago/recebido)
  realizedIncome: number
  realizedExpense: number
  realizedBalance: number

  // Previsto / A realizar no período
  pendingIncome: number
  pendingExpense: number
  pendingBalance: number

  // Total do período (Realizado + Pendente)
  totalIncome: number
  totalExpense: number
  projectedBalance: number

  // Contas vencidas
  overdueExpense: number
  overdueIncome: number
  overdueCount: number

  // Recorrências Mensais Totais
  totalMonthlyFixedExpenses: number
  totalMonthlyRecurringIncome: number
  totalMonthlyRecurringNet: number

  // Breakdown por categorias
  incomesByCategory: { category: string; label: string; amount: number; percentage: number }[]
  expensesByCategory: { category: string; label: string; amount: number; percentage: number }[]
}

export interface ProjectProfitabilityItem {
  projectId: string
  projectCode: string
  projectTitle: string
  clientName: string
  status: string
  typology: string | null

  // Entradas do Projeto
  directContractIncome: number // Honorários recebidos/faturados
  commissionsIncome: number // Comissões RT efetivamente recebidas de fornecedores
  pendingCommissions?: number // Comissões RT previstas ainda pendentes de recebimento
  totalRevenue: number // directContractIncome + commissionsIncome (Realizado)
  pendingRevenue: number // Valores a receber (honorários ou comissões previstas pendentes)

  // Saídas do Projeto
  expensesTotal: number // Brindes, visitas, plotagens, locação, etc. (Realizado/Pago)
  pendingExpenses: number // Despesas previstas ainda pendentes de pagamento
  expensesBreakdown: {
    visitas: number
    brindes: number
    locacao: number
    plotagens: number
    maquetes: number
    taxas: number
    outros: number
  }

  // Métricas
  netProfit: number // totalRevenue - expensesTotal
  profitMarginPercent: number // (netProfit / totalRevenue) * 100 se totalRevenue > 0 senão 0
}

export interface MonthCashFlowProjection {
  monthKey: string // "2026-09"
  monthLabel: string // "Set 2026"
  isPast: boolean
  isCurrent: boolean
  isFuture: boolean

  realizedIncome: number
  realizedExpense: number
  realizedBalance: number

  projectedIncome: number
  projectedExpense: number // Inclui despesas fixas recorrentes projetadas
  projectedBalance: number

  accumulatedBalance: number
}
