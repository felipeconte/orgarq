-- ==============================================================================
-- ORGARQ: MIGRATION 21 - VÍNCULO DIRETO DE COMISSÕES (RT) COM LANÇAMENTOS FINANCEIROS
-- ==============================================================================

-- 1. ADICIONA COLUNA project_company_id NA TABELA DE TRANSAÇÕES
ALTER TABLE public.financial_transactions
  ADD COLUMN IF NOT EXISTS project_company_id UUID REFERENCES public.project_companies(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_financial_transactions_project_company_id 
  ON public.financial_transactions(project_company_id);
