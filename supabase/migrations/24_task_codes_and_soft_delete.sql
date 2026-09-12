-- ==============================================================================
-- ORGARQ: MIGRATION 24 - CÓDIGO INDIVIDUAL DE TAREFAS E HISTÓRICO DE EXCLUSÕES
-- Formato: {incremental}/{ano} por organização (ex: 1/2026, 2/2026)
-- Reset anual automático por escritório
-- Soft delete (deleted_at, deleted_by) para manter histórico e pesquisa
-- ==============================================================================

-- 1. Tabela de contadores sequenciais por escritório e ano
CREATE TABLE IF NOT EXISTS public.organization_task_counters (
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  year INT NOT NULL,
  last_val INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY (organization_id, year)
);

-- Habilitar RLS
ALTER TABLE public.organization_task_counters ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso para contadores da organização
DROP POLICY IF EXISTS "Permitir leitura de contadores para membros da organizacao" ON public.organization_task_counters;
CREATE POLICY "Permitir acesso completo a contadores para membros da organizacao"
  ON public.organization_task_counters FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

GRANT ALL ON TABLE public.organization_task_counters TO authenticated, service_role;

-- 2. Novas colunas em public.project_stages
ALTER TABLE public.project_stages
  ADD COLUMN IF NOT EXISTS code TEXT,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_project_stages_code ON public.project_stages(code);
CREATE INDEX IF NOT EXISTS idx_project_stages_deleted_at ON public.project_stages(deleted_at);

-- 3. Função e Trigger para atribuição automática do código incremental
CREATE OR REPLACE FUNCTION public.assign_project_stage_code()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  org_id UUID;
  task_year INT;
  next_val INT;
BEGIN
  -- Se o código ainda não foi definido, gera o próximo código para a organização e ano
  IF NEW.code IS NULL OR NEW.code = '' THEN
    SELECT p.organization_id INTO org_id
    FROM public.projects p
    WHERE p.id = NEW.project_id;

    IF org_id IS NOT NULL THEN
      task_year := EXTRACT(YEAR FROM COALESCE(NEW.created_at, timezone('utc'::text, now())))::INT;

      INSERT INTO public.organization_task_counters (organization_id, year, last_val, updated_at)
      VALUES (org_id, task_year, 1, timezone('utc'::text, now()))
      ON CONFLICT (organization_id, year)
      DO UPDATE SET 
        last_val = organization_task_counters.last_val + 1,
        updated_at = timezone('utc'::text, now())
      RETURNING last_val INTO next_val;

      NEW.code := next_val || '/' || task_year;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_assign_project_stage_code ON public.project_stages;
CREATE TRIGGER trigger_assign_project_stage_code
  BEFORE INSERT ON public.project_stages
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_project_stage_code();

-- 4. Backfill para tarefas existentes que ainda não possuem código (Decisão Opção A)
DO $$
DECLARE
  r RECORD;
  c INT;
BEGIN
  FOR r IN (
    SELECT s.id, s.project_id, s.created_at, p.organization_id,
           EXTRACT(YEAR FROM s.created_at)::INT AS task_year
    FROM public.project_stages s
    JOIN public.projects p ON p.id = s.project_id
    WHERE s.code IS NULL OR s.code = ''
    ORDER BY p.organization_id, EXTRACT(YEAR FROM s.created_at)::INT, s.created_at ASC
  ) LOOP
    INSERT INTO public.organization_task_counters (organization_id, year, last_val, updated_at)
    VALUES (r.organization_id, r.task_year, 1, timezone('utc'::text, now()))
    ON CONFLICT (organization_id, year)
    DO UPDATE SET 
      last_val = organization_task_counters.last_val + 1,
      updated_at = timezone('utc'::text, now())
    RETURNING last_val INTO c;

    UPDATE public.project_stages
    SET code = c || '/' || r.task_year
    WHERE id = r.id;
  END LOOP;
END $$;
