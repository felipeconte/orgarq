-- ==============================================================================
-- ORGARQ: MIGRATION 14 - TABELA DE EMPRESAS/SERVIÇOS E VÍNCULO COM PROJETOS & COMISSÕES
-- ==============================================================================

-- 1. TABELA DE EMPRESAS E PRESTADORES DE SERVIÇOS
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trade_name TEXT,
  document_number TEXT, -- CNPJ ou CPF
  person_type TEXT NOT NULL DEFAULT 'PJ', -- 'PJ' | 'PF'
  categories TEXT[] NOT NULL DEFAULT '{}',
  contact_name TEXT, -- Vendedor ou Representante Comercial
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  website TEXT,
  instagram TEXT,
  commission_type TEXT NOT NULL DEFAULT 'percent', -- 'percent' | 'fixed' | 'none' | 'negotiable'
  commission_rate NUMERIC(10, 2) DEFAULT 0,
  commission_payment_method TEXT, -- 'PIX' | 'TED' | 'Dinheiro' | 'Boleto' | 'Outro'
  commission_payment_terms TEXT, -- '30 dias após emissão da NF', 'No fechamento', etc.
  notes TEXT,
  rating INTEGER DEFAULT 5,
  status TEXT NOT NULL DEFAULT 'ativo', -- 'ativo' | 'inativo'
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Trigger para updated_at automático em companies
DROP TRIGGER IF EXISTS set_companies_updated_at ON public.companies;
CREATE TRIGGER set_companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 2. TABELA DE VÍNCULO ENTRE PROJETOS E EMPRESAS / SERVIÇOS E COMISSÕES
CREATE TABLE IF NOT EXISTS public.project_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  service_description TEXT,
  category TEXT,
  contract_value NUMERIC(12, 2) DEFAULT 0,
  commission_type TEXT NOT NULL DEFAULT 'percent', -- 'percent' | 'fixed'
  commission_rate NUMERIC(10, 2) DEFAULT 0,
  expected_commission_amount NUMERIC(12, 2) DEFAULT 0,
  received_commission_amount NUMERIC(12, 2) DEFAULT 0,
  commission_status TEXT NOT NULL DEFAULT 'pendente', -- 'previsto' | 'pendente' | 'pago_parcial' | 'pago_total' | 'cancelado'
  commission_payment_method TEXT,
  commission_payment_terms TEXT,
  commission_due_date DATE,
  commission_paid_date DATE,
  service_status TEXT NOT NULL DEFAULT 'em_andamento', -- 'cotacao' | 'contratado' | 'em_andamento' | 'concluido' | 'cancelado'
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Trigger para updated_at automático em project_companies
DROP TRIGGER IF EXISTS set_project_companies_updated_at ON public.project_companies;
CREATE TRIGGER set_project_companies_updated_at
  BEFORE UPDATE ON public.project_companies
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 3. HABILITAÇÃO DE RLS
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_companies ENABLE ROW LEVEL SECURITY;

-- 4. POLÍTICAS DE RLS PARA COMPANIES
DROP POLICY IF EXISTS "Membros podem visualizar empresas de sua organização" ON public.companies;
CREATE POLICY "Membros podem visualizar empresas de sua organização"
  ON public.companies
  FOR SELECT
  USING (
    organization_id IN (
      SELECT om.organization_id
      FROM public.organization_members om
      WHERE om.user_id = auth.uid()
    )
    OR
    organization_id IN (
      SELECT o.id
      FROM public.organizations o
      WHERE o.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Membros podem inserir empresas em sua organização" ON public.companies;
CREATE POLICY "Membros podem inserir empresas em sua organização"
  ON public.companies
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id
      FROM public.organization_members om
      WHERE om.user_id = auth.uid()
    )
    OR
    organization_id IN (
      SELECT o.id
      FROM public.organizations o
      WHERE o.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Membros podem atualizar empresas de sua organização" ON public.companies;
CREATE POLICY "Membros podem atualizar empresas de sua organização"
  ON public.companies
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT om.organization_id
      FROM public.organization_members om
      WHERE om.user_id = auth.uid()
    )
    OR
    organization_id IN (
      SELECT o.id
      FROM public.organizations o
      WHERE o.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Membros podem excluir empresas de sua organização" ON public.companies;
CREATE POLICY "Membros podem excluir empresas de sua organização"
  ON public.companies
  FOR DELETE
  USING (
    organization_id IN (
      SELECT om.organization_id
      FROM public.organization_members om
      WHERE om.user_id = auth.uid()
    )
    OR
    organization_id IN (
      SELECT o.id
      FROM public.organizations o
      WHERE o.owner_id = auth.uid()
    )
  );

-- 5. POLÍTICAS DE RLS PARA PROJECT_COMPANIES
DROP POLICY IF EXISTS "Membros podem visualizar project_companies de sua organização" ON public.project_companies;
CREATE POLICY "Membros podem visualizar project_companies de sua organização"
  ON public.project_companies
  FOR SELECT
  USING (
    organization_id IN (
      SELECT om.organization_id
      FROM public.organization_members om
      WHERE om.user_id = auth.uid()
    )
    OR
    organization_id IN (
      SELECT o.id
      FROM public.organizations o
      WHERE o.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Membros podem inserir project_companies em sua organização" ON public.project_companies;
CREATE POLICY "Membros podem inserir project_companies em sua organização"
  ON public.project_companies
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id
      FROM public.organization_members om
      WHERE om.user_id = auth.uid()
    )
    OR
    organization_id IN (
      SELECT o.id
      FROM public.organizations o
      WHERE o.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Membros podem atualizar project_companies de sua organização" ON public.project_companies;
CREATE POLICY "Membros podem atualizar project_companies de sua organização"
  ON public.project_companies
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT om.organization_id
      FROM public.organization_members om
      WHERE om.user_id = auth.uid()
    )
    OR
    organization_id IN (
      SELECT o.id
      FROM public.organizations o
      WHERE o.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Membros podem excluir project_companies de sua organização" ON public.project_companies;
CREATE POLICY "Membros podem excluir project_companies de sua organização"
  ON public.project_companies
  FOR DELETE
  USING (
    organization_id IN (
      SELECT om.organization_id
      FROM public.organization_members om
      WHERE om.user_id = auth.uid()
    )
    OR
    organization_id IN (
      SELECT o.id
      FROM public.organizations o
      WHERE o.owner_id = auth.uid()
    )
  );

-- 6. ÍNDICES DE PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_companies_org_id ON public.companies(organization_id);
CREATE INDEX IF NOT EXISTS idx_companies_name ON public.companies(name);
CREATE INDEX IF NOT EXISTS idx_companies_status ON public.companies(status);
CREATE INDEX IF NOT EXISTS idx_project_companies_org_id ON public.project_companies(organization_id);
CREATE INDEX IF NOT EXISTS idx_project_companies_project_id ON public.project_companies(project_id);
CREATE INDEX IF NOT EXISTS idx_project_companies_company_id ON public.project_companies(company_id);
CREATE INDEX IF NOT EXISTS idx_project_companies_commission_status ON public.project_companies(commission_status);
