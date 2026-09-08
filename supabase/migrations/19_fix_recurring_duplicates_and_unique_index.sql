-- ==============================================================================
-- ORGARQ: MIGRATION 19 - LIMPEZA DE DUPLICATAS DE RECORRÊNCIA E ÍNDICE ÚNICO
-- ==============================================================================

-- 1. LIMPEZA DE TRANSAÇÕES DUPLICADAS GERADAS POR RECORRÊNCIAS
-- Mantém apenas o registro mais antigo (ou pago) de cada combinação (recurring_expense_id, due_date)
DELETE FROM public.financial_transactions a
USING public.financial_transactions b
WHERE a.recurring_expense_id IS NOT NULL
  AND b.recurring_expense_id IS NOT NULL
  AND a.recurring_expense_id = b.recurring_expense_id
  AND a.due_date = b.due_date
  AND (
    -- Se um estiver pago e o outro pendente, deleta o pendente
    (a.status = 'pending' AND b.status = 'paid')
    OR
    -- Se ambos tiverem o mesmo status, deleta o registro com id maior (mais recente)
    (a.status = b.status AND a.id > b.id)
  );

-- 2. CRIAÇÃO DE ÍNDICE ÚNICO PARA IMPEDIR ABSOLUTAMENTE QUALQUER DUPLICAÇÃO FUTURA
-- Garante a nível de banco de dados que só pode existir 1 lançamento por recorrência por data de vencimento
DROP INDEX IF EXISTS public.uq_financial_tx_recurring_due_date;
CREATE UNIQUE INDEX uq_financial_tx_recurring_due_date
  ON public.financial_transactions (recurring_expense_id, due_date)
  WHERE recurring_expense_id IS NOT NULL;
