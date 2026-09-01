-- ==============================================================================
-- ORGARQ: MIGRATION 13 - SOLICITAÇÃO DE ATUALIZAÇÃO CADASTRAL DE CLIENTES
-- ==============================================================================

-- 1. ADICIONA CAMPOS DE ENDEREÇO E TELEFONE À CONTA GLOBAL DO CLIENTE (PORTAL)
ALTER TABLE public.client_portal_accounts
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS zip_code TEXT;

-- 2. TABELA DE SOLICITAÇÕES DE ATUALIZAÇÃO CADASTRAL
-- Registra quando um cliente solicita que um escritório atualize seus dados cadastrais
CREATE TABLE IF NOT EXISTS public.client_update_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  portal_account_id UUID REFERENCES public.client_portal_accounts(id) ON DELETE CASCADE,
  cpf TEXT NOT NULL,
  requested_data JSONB NOT NULL, -- { name, email, phone, address, city, state, zip_code }
  current_data JSONB, -- { name, email, phone, address, city, state, zip_code }
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_client_update_requests_org_status ON public.client_update_requests(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_client_update_requests_cpf ON public.client_update_requests(cpf);
CREATE INDEX IF NOT EXISTS idx_client_update_requests_client_id ON public.client_update_requests(client_id);

-- Trigger para updated_at automático
DROP TRIGGER IF EXISTS set_client_update_requests_updated_at ON public.client_update_requests;
CREATE TRIGGER set_client_update_requests_updated_at
  BEFORE UPDATE ON public.client_update_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 3. HABILITA RLS
ALTER TABLE public.client_update_requests ENABLE ROW LEVEL SECURITY;

-- 4. POLÍTICAS RLS
DROP POLICY IF EXISTS "Membros do escritório gerenciam solicitações de atualização" ON public.client_update_requests;
CREATE POLICY "Membros do escritório gerenciam solicitações de atualização"
  ON public.client_update_requests
  FOR ALL
  TO authenticated
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

DROP POLICY IF EXISTS "Acesso anônimo/portal para inserir e consultar solicitações por CPF" ON public.client_update_requests;
CREATE POLICY "Acesso anônimo/portal para inserir e consultar solicitações por CPF"
  ON public.client_update_requests
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
