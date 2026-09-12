-- ==============================================================================
-- ORGARQ: MIGRATION 23 - HIERARQUIA DE SUBTAREFAS EM PROJECT_STAGES
-- ==============================================================================

-- 1. Adiciona coluna parent_stage_id com chave estrangeira auto-referenciada
ALTER TABLE public.project_stages
  ADD COLUMN IF NOT EXISTS parent_stage_id UUID REFERENCES public.project_stages(id) ON DELETE CASCADE;

-- 2. Cria índice para otimização de consultas hierárquicas e joins
CREATE INDEX IF NOT EXISTS idx_project_stages_parent_stage_id 
  ON public.project_stages(parent_stage_id);
