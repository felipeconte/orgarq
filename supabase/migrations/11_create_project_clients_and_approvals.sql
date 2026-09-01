-- ==============================================================================
-- ORGARQ: MIGRATION 11 - MULTI-CLIENTES POR PROJETO E APROVAÇÃO COLETIVA
-- ==============================================================================

-- 1. TABELA DE JUNÇÃO: project_clients (N:N entre Projetos e Clientes)
CREATE TABLE IF NOT EXISTS public.project_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE(project_id, client_id)
);

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_project_clients_project_id ON public.project_clients(project_id);
CREATE INDEX IF NOT EXISTS idx_project_clients_client_id ON public.project_clients(client_id);

-- 2. MIGRAÇÃO DE DADOS EXISTENTES (projects.client_id -> project_clients)
INSERT INTO public.project_clients (project_id, client_id)
SELECT id, client_id
FROM public.projects
WHERE client_id IS NOT NULL
ON CONFLICT (project_id, client_id) DO NOTHING;

-- 3. ATUALIZAÇÃO DA TABELA stage_approvals PARA REGISTRAR client_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stage_approvals' AND column_name = 'client_id'
  ) THEN
    ALTER TABLE public.stage_approvals
      ADD COLUMN client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_stage_approvals_stage_client ON public.stage_approvals(stage_id, client_id);

-- 4. POLÍTICAS DE SEGURANÇA RLS PARA project_clients
ALTER TABLE public.project_clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários autenticados gerenciam project_clients" ON public.project_clients;
CREATE POLICY "Usuários autenticados gerenciam project_clients"
  ON public.project_clients
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.organization_members om ON om.organization_id = p.organization_id
      WHERE p.id = project_clients.project_id
      AND om.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.organization_members om ON om.organization_id = p.organization_id
      WHERE p.id = project_clients.project_id
      AND om.user_id = auth.uid()
    )
  );

-- Permitir leitura pública/anon para o portal do cliente consultar os clientes vinculados ao projeto do token
DROP POLICY IF EXISTS "Acesso público aos clientes vinculados do projeto do portal" ON public.project_clients;
CREATE POLICY "Acesso público aos clientes vinculados do projeto do portal"
  ON public.project_clients
  FOR SELECT
  TO anon, authenticated
  USING (true);
