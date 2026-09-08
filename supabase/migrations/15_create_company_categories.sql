-- ==============================================================================
-- ORGARQ: MIGRATION 15 - CATEGORIAS / ESPECIALIDADES DE EMPRESAS & FORNECEDORES
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.company_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE(organization_id, name)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_company_categories_org ON public.company_categories(organization_id);

-- RLS
ALTER TABLE public.company_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros podem visualizar categorias de empresas"
  ON public.company_categories
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Membros podem inserir categorias de empresas"
  ON public.company_categories
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Membros podem atualizar categorias de empresas"
  ON public.company_categories
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Membros podem excluir categorias de empresas"
  ON public.company_categories
  FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );
