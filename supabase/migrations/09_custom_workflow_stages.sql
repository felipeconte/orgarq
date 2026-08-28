-- ==============================================================================
-- ORGARQ: MIGRATION 09 - ETAPAS DO FLUXO PERSONALIZÁVEIS (WORKFLOW STAGES)
-- ==============================================================================

-- 1. Altera project_stages.status para TEXT para permitir qualquer etapa personalizada
ALTER TABLE public.project_stages 
  ALTER COLUMN status TYPE TEXT;

-- 2. Adiciona coluna workflow_stages na tabela organizations para persistência JSONB direta
ALTER TABLE public.organizations 
  ADD COLUMN IF NOT EXISTS workflow_stages JSONB DEFAULT NULL;

-- 3. Tabela relacional organization_workflow_stages para sincronização
CREATE TABLE IF NOT EXISTS public.organization_workflow_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'blue',
  order_index INT NOT NULL DEFAULT 0,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE(organization_id, key)
);

ALTER TABLE public.organization_workflow_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros podem visualizar etapas do fluxo da organização"
  ON public.organization_workflow_stages
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Membros podem gerenciar etapas do fluxo da organização"
  ON public.organization_workflow_stages
  FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );
