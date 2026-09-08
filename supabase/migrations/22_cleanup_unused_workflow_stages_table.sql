-- ==============================================================================
-- ORGARQ: MIGRATION 22 - LIMPEZA DE TABELA LEGADA E NÃO UTILIZADA
-- ==============================================================================

-- 1. REMOVE TABELA RELACIONAL LEGADA 'organization_workflow_stages'
-- Esta tabela foi criada na migration 09 como alternativa, mas o sistema adota
-- nativamente a coluna JSONB 'organizations.workflow_stages'.
-- A tabela possui 0 registros e 0 referências no código do sistema.
DROP TABLE IF EXISTS public.organization_workflow_stages CASCADE;
