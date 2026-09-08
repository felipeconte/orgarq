-- ==============================================================================
-- ORGARQ: MIGRATION 17 - MÓDULO FINANCEIRO (Entradas, Saídas, Despesas Fixas, Lucratividade por Projeto)
-- ==============================================================================

-- 1. TABELA DE DESPESAS FIXAS / RECORRENTES DO ESCRITÓRIO
CREATE TABLE IF NOT EXISTS public.recurring_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL, -- 'aluguel_condominio', 'softwares_licencas', 'energia_internet', 'contabilidade_juridico', 'salarios_equipe', 'marketing_anuncios', 'impostos', 'manutencao', 'outros'
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  frequency TEXT NOT NULL DEFAULT 'monthly', -- 'monthly' | 'yearly' | 'quarterly' | 'weekly'
  due_day INTEGER NOT NULL DEFAULT 5, -- Dia do vencimento no mês (1 a 31)
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  payment_method TEXT, -- 'PIX' | 'Boleto' | 'Cartao_Credito' | 'Debito_Automatico' | 'TED' | 'Dinheiro' | 'Outro'
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Trigger para updated_at automático em recurring_expenses
DROP TRIGGER IF EXISTS set_recurring_expenses_updated_at ON public.recurring_expenses;
CREATE TRIGGER set_recurring_expenses_updated_at
  BEFORE UPDATE ON public.recurring_expenses
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 2. TABELA DE LANÇAMENTOS FINANCEIROS (ENTRADAS E SAÍDAS)
CREATE TABLE IF NOT EXISTS public.financial_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  recurring_expense_id UUID REFERENCES public.recurring_expenses(id) ON DELETE SET NULL,
  type TEXT NOT NULL, -- 'income' (receita/entrada) | 'expense' (despesa/saída)
  category TEXT NOT NULL,
  -- Receitas: 'honorarios_projeto', 'comissao_rt', 'consultoria', 'reembolso', 'rendimento', 'outros_ganhos'
  -- Despesas do Projeto: 'visitas_deslocamento', 'brindes_mimos', 'locacao_espaco', 'impressao_plotagem', 'maquete_render', 'taxas_art_rrt', 'material_amostras', 'outras_despesas_projeto'
  -- Despesas Gerais: 'aluguel_condominio', 'softwares_licencas', 'energia_internet', 'contabilidade_juridico', 'salarios_equipe', 'marketing_anuncios', 'impostos', 'material_escritorio', 'outros_custos_fixos'
  title TEXT NOT NULL,
  description TEXT,
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  due_date DATE NOT NULL,
  payment_date DATE,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'paid' | 'overdue' | 'cancelled'
  payment_method TEXT, -- 'PIX' | 'Boleto' | 'Cartao_Credito' | 'Cartao_Debito' | 'TED' | 'Dinheiro' | 'Outro'
  receipt_url TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Trigger para updated_at automático em financial_transactions
DROP TRIGGER IF EXISTS set_financial_transactions_updated_at ON public.financial_transactions;
CREATE TRIGGER set_financial_transactions_updated_at
  BEFORE UPDATE ON public.financial_transactions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 3. HABILITAÇÃO DE ROW LEVEL SECURITY (RLS)
ALTER TABLE public.recurring_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;

-- 4. POLÍTICAS DE RLS PARA RECURRING_EXPENSES
DROP POLICY IF EXISTS "Membros podem visualizar despesas recorrentes de sua organização" ON public.recurring_expenses;
CREATE POLICY "Membros podem visualizar despesas recorrentes de sua organização"
  ON public.recurring_expenses
  FOR SELECT
  USING (
    organization_id IN (
      SELECT om.organization_id
      FROM public.organization_members om
      WHERE om.user_id = auth.uid()
    )
    OR
    organization_id IN (
      SELECT o.id
      FROM public.organizations o
      WHERE o.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Membros podem inserir despesas recorrentes em sua organização" ON public.recurring_expenses;
CREATE POLICY "Membros podem inserir despesas recorrentes em sua organização"
  ON public.recurring_expenses
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id
      FROM public.organization_members om
      WHERE om.user_id = auth.uid()
    )
    OR
    organization_id IN (
      SELECT o.id
      FROM public.organizations o
      WHERE o.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Membros podem atualizar despesas recorrentes de sua organização" ON public.recurring_expenses;
CREATE POLICY "Membros podem atualizar despesas recorrentes de sua organização"
  ON public.recurring_expenses
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT om.organization_id
      FROM public.organization_members om
      WHERE om.user_id = auth.uid()
    )
    OR
    organization_id IN (
      SELECT o.id
      FROM public.organizations o
      WHERE o.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Membros podem excluir despesas recorrentes de sua organização" ON public.recurring_expenses;
CREATE POLICY "Membros podem excluir despesas recorrentes de sua organização"
  ON public.recurring_expenses
  FOR DELETE
  USING (
    organization_id IN (
      SELECT om.organization_id
      FROM public.organization_members om
      WHERE om.user_id = auth.uid()
    )
    OR
    organization_id IN (
      SELECT o.id
      FROM public.organizations o
      WHERE o.owner_id = auth.uid()
    )
  );

-- 5. POLÍTICAS DE RLS PARA FINANCIAL_TRANSACTIONS
DROP POLICY IF EXISTS "Membros podem visualizar transações financeiras de sua organização" ON public.financial_transactions;
CREATE POLICY "Membros podem visualizar transações financeiras de sua organização"
  ON public.financial_transactions
  FOR SELECT
  USING (
    organization_id IN (
      SELECT om.organization_id
      FROM public.organization_members om
      WHERE om.user_id = auth.uid()
    )
    OR
    organization_id IN (
      SELECT o.id
      FROM public.organizations o
      WHERE o.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Membros podem inserir transações financeiras em sua organização" ON public.financial_transactions;
CREATE POLICY "Membros podem inserir transações financeiras em sua organização"
  ON public.financial_transactions
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id
      FROM public.organization_members om
      WHERE om.user_id = auth.uid()
    )
    OR
    organization_id IN (
      SELECT o.id
      FROM public.organizations o
      WHERE o.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Membros podem atualizar transações financeiras de sua organização" ON public.financial_transactions;
CREATE POLICY "Membros podem atualizar transações financeiras de sua organização"
  ON public.financial_transactions
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT om.organization_id
      FROM public.organization_members om
      WHERE om.user_id = auth.uid()
    )
    OR
    organization_id IN (
      SELECT o.id
      FROM public.organizations o
      WHERE o.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Membros podem excluir transações financeiras de sua organização" ON public.financial_transactions;
CREATE POLICY "Membros podem excluir transações financeiras de sua organização"
  ON public.financial_transactions
  FOR DELETE
  USING (
    organization_id IN (
      SELECT om.organization_id
      FROM public.organization_members om
      WHERE om.user_id = auth.uid()
    )
    OR
    organization_id IN (
      SELECT o.id
      FROM public.organizations o
      WHERE o.owner_id = auth.uid()
    )
  );

-- 6. ÍNDICES DE PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_recurring_expenses_org ON public.recurring_expenses(organization_id);
CREATE INDEX IF NOT EXISTS idx_recurring_expenses_active ON public.recurring_expenses(is_active);

CREATE INDEX IF NOT EXISTS idx_financial_transactions_org ON public.financial_transactions(organization_id);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_project ON public.financial_transactions(project_id);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_company ON public.financial_transactions(company_id);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_type ON public.financial_transactions(type);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_status ON public.financial_transactions(status);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_due_date ON public.financial_transactions(due_date);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_payment_date ON public.financial_transactions(payment_date);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_category ON public.financial_transactions(category);
