-- ==============================================================================
-- ORGARQ: MIGRATION 25 - ORDENAÇÃO INDEPENDENTE DO KANBAN
-- Permite ordenar tarefas livremente no Kanban sem interferir na Lista e no Gantt
-- ==============================================================================

-- 1. Adiciona coluna kanban_order na tabela project_stages
ALTER TABLE public.project_stages
  ADD COLUMN IF NOT EXISTS kanban_order INT NOT NULL DEFAULT 0;

-- 2. Backfill inicial: inicializa kanban_order com o valor de stage_order existente
UPDATE public.project_stages
SET kanban_order = stage_order
WHERE kanban_order = 0;

-- 3. Cria índice composto para otimizar busca e ordenação no Kanban por projeto e etapa
CREATE INDEX IF NOT EXISTS idx_project_stages_kanban_order
  ON public.project_stages(project_id, status, kanban_order);
