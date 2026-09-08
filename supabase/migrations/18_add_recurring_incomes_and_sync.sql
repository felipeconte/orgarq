-- ==============================================================================
-- ORGARQ: MIGRATION 18 - SUPORTE A RECEITAS E DESPESAS RECORRENTES
-- ==============================================================================

-- 1. ADICIONA COLUNAS EM RECURRING_EXPENSES PARA SUPORTAR RECEITAS E DESPESAS RECORRENTES E VÍNCULOS
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'recurring_expenses' AND column_name = 'type'
  ) THEN
    ALTER TABLE public.recurring_expenses ADD COLUMN type TEXT NOT NULL DEFAULT 'expense';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'recurring_expenses' AND column_name = 'project_id'
  ) THEN
    ALTER TABLE public.recurring_expenses ADD COLUMN project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'recurring_expenses' AND column_name = 'client_id'
  ) THEN
    ALTER TABLE public.recurring_expenses ADD COLUMN client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'recurring_expenses' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE public.recurring_expenses ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 2. ÍNDICES DE PERFORMANCE PARA CONSULTAS E SINCRONIZAÇÃO DE RECORRÊNCIAS
CREATE INDEX IF NOT EXISTS idx_recurring_expenses_type ON public.recurring_expenses(type);
CREATE INDEX IF NOT EXISTS idx_recurring_expenses_project ON public.recurring_expenses(project_id);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_rec_id ON public.financial_transactions(recurring_expense_id);
