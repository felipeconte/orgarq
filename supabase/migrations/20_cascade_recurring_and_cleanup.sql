-- ==============================================================================
-- ORGARQ: MIGRATION 20 - FOREIGN KEY CASCADE EM RECORRÊNCIAS & LIMPEZA DE DADOS
-- ==============================================================================

-- 1. ATUALIZAÇÃO DA FOREIGN KEY PARA ON DELETE CASCADE
-- Garante que ao excluir uma regra de recorrência, todos os lançamentos gerados sejam excluídos
-- em vez de virarem lançamentos individuais soltos (evita o efeito 'ON DELETE SET NULL')
DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT tc.constraint_name INTO constraint_name
  FROM information_schema.table_constraints AS tc 
  JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
  WHERE tc.table_name = 'financial_transactions'
    AND kcu.column_name = 'recurring_expense_id'
    AND tc.constraint_type = 'FOREIGN KEY';

  IF constraint_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.financial_transactions DROP CONSTRAINT ' || quote_ident(constraint_name);
  END IF;
END $$;

ALTER TABLE public.financial_transactions
  ADD CONSTRAINT financial_transactions_recurring_expense_id_fkey
  FOREIGN KEY (recurring_expense_id)
  REFERENCES public.recurring_expenses(id)
  ON DELETE CASCADE;

-- 2. LIMPEZA TOTAL DE LANÇAMENTOS E RECORRÊNCIAS PARA TESTES LIMPOS DO ZERO
-- Limpa todos os dados residuais de transações financeiras e despesas/receitas recorrentes
DELETE FROM public.financial_transactions;
DELETE FROM public.recurring_expenses;
