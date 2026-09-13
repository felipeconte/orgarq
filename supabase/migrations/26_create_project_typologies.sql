-- ==============================================================================
-- ORGARQ: MIGRATION 26 - TIPOLOGIAS DE PROJETOS E CRUD CUSTOMIZADO
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.project_typologies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE(organization_id, name)
);

-- Índices para performance de busca e integridade
CREATE INDEX IF NOT EXISTS idx_project_typologies_org ON public.project_typologies(organization_id);
CREATE INDEX IF NOT EXISTS idx_projects_org_typology ON public.projects(organization_id, typology);

-- Habilita RLS
ALTER TABLE public.project_typologies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros podem visualizar tipologias de projetos"
  ON public.project_typologies
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Membros podem inserir tipologias de projetos"
  ON public.project_typologies
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Membros podem atualizar tipologias de projetos"
  ON public.project_typologies
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Membros podem excluir tipologias de projetos"
  ON public.project_typologies
  FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );
