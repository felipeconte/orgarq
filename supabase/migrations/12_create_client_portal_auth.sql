-- ==============================================================================
-- ORGARQ: MIGRATION 12 - PORTAL DO CLIENTE (AUTENTICAÇÃO GLOBAL POR CPF E MULTI-ESCRITÓRIOS)
-- ==============================================================================

-- 1. TABELA GLOBAL DE CONTAS DO PORTAL DO CLIENTE
-- Identificada unicamente pelo CPF (11 dígitos). Permite que o cliente use a mesma conta
-- para acompanhar projetos em múltiplos escritórios de arquitetura na plataforma Orgarq.
CREATE TABLE IF NOT EXISTS public.client_portal_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cpf TEXT UNIQUE NOT NULL, -- 11 dígitos limpos
  name TEXT NOT NULL,
  email TEXT,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  last_login_at TIMESTAMPTZ
);

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_client_portal_accounts_cpf ON public.client_portal_accounts(cpf);

-- Trigger para updated_at automático
DROP TRIGGER IF EXISTS set_client_portal_accounts_updated_at ON public.client_portal_accounts;
CREATE TRIGGER set_client_portal_accounts_updated_at
  BEFORE UPDATE ON public.client_portal_accounts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 2. HABILITA RLS
ALTER TABLE public.client_portal_accounts ENABLE ROW LEVEL SECURITY;

-- 3. POLÍTICAS RLS
DROP POLICY IF EXISTS "Leitura de contas do portal para login" ON public.client_portal_accounts;
CREATE POLICY "Leitura de contas do portal para login"
  ON public.client_portal_accounts
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Usuários autenticados gerenciam client_portal_accounts" ON public.client_portal_accounts;
CREATE POLICY "Usuários autenticados gerenciam client_portal_accounts"
  ON public.client_portal_accounts
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Atualização anônima de last_login_at" ON public.client_portal_accounts;
CREATE POLICY "Atualização anônima de last_login_at"
  ON public.client_portal_accounts
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
