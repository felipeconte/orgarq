-- ==============================================================================
-- ORGARQ: MIGRATION 16 - CONTATOS / VENDEDORES MÚLTIPLOS PARA EMPRESAS
-- ==============================================================================

ALTER TABLE public.companies 
  ADD COLUMN IF NOT EXISTS contacts JSONB DEFAULT '[]'::jsonb;
