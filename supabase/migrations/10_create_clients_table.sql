-- ==============================================================================
-- ORGARQ: MIGRATION 10 - TABELA DE CLIENTES, VÍNCULO COM PROJETOS E RLS
-- ==============================================================================

-- 1. TABELA DE CLIENTES
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  document_number TEXT, -- CPF ou CNPJ
  person_type TEXT NOT NULL DEFAULT 'PF', -- 'PF' | 'PJ'
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT, -- CEP
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'ativo', -- 'ativo' | 'inativo'
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Trigger para updated_at automático
DROP TRIGGER IF EXISTS set_clients_updated_at ON public.clients;
CREATE TRIGGER set_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 2. ADICIONA client_id NA TABELA PROJECTS SE NÃO EXISTIR
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'projects'
    AND column_name = 'client_id'
  ) THEN
    ALTER TABLE public.projects ADD COLUMN client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 3. HABILITA RLS NA TABELA CLIENTS
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- 4. POLÍTICAS DE RLS PARA CLIENTS
DROP POLICY IF EXISTS "Membros podem visualizar clientes de sua organização" ON public.clients;
CREATE POLICY "Membros podem visualizar clientes de sua organização"
  ON public.clients
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

DROP POLICY IF EXISTS "Membros podem inserir clientes em sua organização" ON public.clients;
CREATE POLICY "Membros podem inserir clientes em sua organização"
  ON public.clients
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

DROP POLICY IF EXISTS "Membros podem atualizar clientes de sua organização" ON public.clients;
CREATE POLICY "Membros podem atualizar clientes de sua organização"
  ON public.clients
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

DROP POLICY IF EXISTS "Membros podem excluir clientes de sua organização" ON public.clients;
CREATE POLICY "Membros podem excluir clientes de sua organização"
  ON public.clients
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

-- 5. ÍNDICES DE PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_clients_org_id ON public.clients(organization_id);
CREATE INDEX IF NOT EXISTS idx_clients_name ON public.clients(name);
CREATE INDEX IF NOT EXISTS idx_clients_status ON public.clients(status);
CREATE INDEX IF NOT EXISTS idx_projects_client_id ON public.projects(client_id);
