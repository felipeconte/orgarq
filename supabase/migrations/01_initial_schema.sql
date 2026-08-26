-- ==============================================================================
-- ORGARQ: MIGRATION 01 - SCHEMA INICIAL COMPLETO (SaaS de Arquitetura)
-- ==============================================================================

-- 1. EXTENSÕES DO POSTGRESQL
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. ENUMS DE DOMÍNIO
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('owner', 'admin', 'architect', 'intern');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE project_status AS ENUM (
    'ativo',
    'pausado',
    'concluido',
    'cancelado'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE stage_status AS ENUM (
    'a_iniciar',
    'em_producao',
    'em_aprovacao',
    'concluido'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'urgent');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE task_status AS ENUM ('todo', 'in_progress', 'review', 'done');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE approval_action AS ENUM ('approved', 'changes_requested');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 3. FUNÇÃO UTILITÁRIA PARA ATUALIZAÇÃO AUTOMÁTICA DE updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- 4. TABELAS PRINCIPAIS
-- ==============================================================================

-- 4.1. ORGANIZAÇÕES (ESCRITÓRIOS DE ARQUITETURA)
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  cau_caubr TEXT,
  cnpj TEXT,
  phone TEXT,
  email TEXT,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT
);

CREATE TRIGGER set_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 4.2. MEMBROS DA ORGANIZAÇÃO
CREATE TABLE IF NOT EXISTS public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'architect',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE(organization_id, user_id)
);

-- 4.3. TEMPLATES DE ETAPAS DO ESCRITÓRIO
CREATE TABLE IF NOT EXISTS public.stage_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Padrão do Sistema',
  description TEXT,
  is_default BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TRIGGER set_stage_templates_updated_at
  BEFORE UPDATE ON public.stage_templates
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 4.4. ITENS DO TEMPLATE DE ETAPAS (AS 10 ETAPAS PADRÃO)
CREATE TABLE IF NOT EXISTS public.stage_template_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_template_id UUID NOT NULL REFERENCES public.stage_templates(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  stage_order INT NOT NULL DEFAULT 0,
  default_duration_days INT NOT NULL DEFAULT 7,
  is_client_approval_required BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4.5. PROJETOS
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  code TEXT NOT NULL, -- Ex: ARQ-2026-01
  title TEXT NOT NULL,
  description TEXT,
  typology TEXT, -- Residencial, Comercial, Interiores, Corporativo
  client_name TEXT NOT NULL,
  client_email TEXT,
  client_phone TEXT,
  status project_status NOT NULL DEFAULT 'ativo',
  area_sqm NUMERIC(10, 2), -- Área em m²
  estimated_budget NUMERIC(15, 2), -- Orçamento estimado de obra
  address TEXT,
  city TEXT,
  state TEXT,
  start_date DATE,
  deadline DATE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE(organization_id, code)
);

CREATE TRIGGER set_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 4.6. FICHA DE BRIEFING DO PROJETO
CREATE TABLE IF NOT EXISTS public.project_briefings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE UNIQUE,
  needs_program JSONB DEFAULT '[]'::jsonb, -- Lista de ambientes e requisitos
  style_preferences TEXT, -- Estilo arquitetônico e materiais preferidos
  budget_notes TEXT, -- Observações financeiras do cliente
  site_conditions TEXT, -- Topografia, orientação solar, ventilação
  notes TEXT, -- Notas gerais de reuniões
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TRIGGER set_project_briefings_updated_at
  BEFORE UPDATE ON public.project_briefings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 4.7. ETAPAS INSTANCIADAS DO PROJETO (SUPORTE A LISTA, KANBAN E GANTT)
CREATE TABLE IF NOT EXISTS public.project_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  stage_order INT NOT NULL DEFAULT 0,
  status stage_status NOT NULL DEFAULT 'a_iniciar',
  progress_percent INT NOT NULL DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  start_date DATE,
  due_date DATE,
  is_client_approval_required BOOLEAN NOT NULL DEFAULT true,
  is_locked_for_client BOOLEAN NOT NULL DEFAULT false, -- Bloqueio após aprovação
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TRIGGER set_project_stages_updated_at
  BEFORE UPDATE ON public.project_stages
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 4.8. TAREFAS / KANBAN OPERACIONAL DAS ETAPAS
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  stage_id UUID REFERENCES public.project_stages(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  priority task_priority NOT NULL DEFAULT 'medium',
  status task_status NOT NULL DEFAULT 'todo',
  order_index INT NOT NULL DEFAULT 0,
  due_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TRIGGER set_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 4.9. TOKENS DE ACESSO DO CLIENTE (PORTAL DO CLIENTE - MAGIC LINK)
CREATE TABLE IF NOT EXISTS public.client_access_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  is_revoked BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ,
  last_accessed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4.10. AUDITORIA DE APROVAÇÕES DO CLIENTE (HISTÓRICO IMUTÁVEL)
CREATE TABLE IF NOT EXISTS public.stage_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  stage_id UUID NOT NULL REFERENCES public.project_stages(id) ON DELETE CASCADE,
  action approval_action NOT NULL,
  approver_name TEXT NOT NULL,
  approver_email TEXT,
  ip_address TEXT,
  user_agent TEXT,
  feedback_message TEXT,
  audit_hash TEXT NOT NULL DEFAULT encode(sha256(gen_random_bytes(32)), 'hex'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- 5. FUNÇÕES E TRIGGERS DE NEGÓCIO AUTOMATIZADOS
-- ==============================================================================

-- 5.1. FUNÇÃO PARA CRIAR TEMPLATE DAS 10 ETAPAS AUTOMATICAMENTE AO CRIAR ORGANIZAÇÃO
CREATE OR REPLACE FUNCTION public.handle_new_organization_template()
RETURNS TRIGGER AS $$
DECLARE
  new_template_id UUID;
BEGIN
  -- Cria o template padrão
  INSERT INTO public.stage_templates (organization_id, name, description, is_default)
  VALUES (NEW.id, 'Padrão do Sistema', 'Template padrão com as 10 etapas oficiais de projeto', true)
  RETURNING id INTO new_template_id;

  -- Insere as 10 etapas padrão
  INSERT INTO public.stage_template_items (stage_template_id, name, description, stage_order, default_duration_days, is_client_approval_required)
  VALUES
    (new_template_id, '01. Contrato', 'Formalização da proposta e assinatura de contrato', 1, 5, true),
    (new_template_id, '02. Briefing', 'Levantamento de necessidades, estilo e referências', 2, 7, true),
    (new_template_id, '03. Estudo Preliminar', 'Concepção volumétrica inicial e plantas de layout', 3, 15, true),
    (new_template_id, '04. Revisão', 'Primeira rodada de alinhamento com o cliente', 4, 5, true),
    (new_template_id, '05. Projeto 3D', 'Modelagem 3D e renders fotorrealistas para aprovação visual', 5, 15, true),
    (new_template_id, '06. Revisões', 'Refinamento de materiais, cores e iluminação', 6, 7, true),
    (new_template_id, '07. Projeto Executivo', 'Desenvolvimento técnico de pranchas e paginações', 7, 25, false),
    (new_template_id, '08. Entrega Final', 'Emissão do caderno executivo e pranchas completas', 8, 5, true),
    (new_template_id, '09. Suporte', 'Tira-dúvidas técnico para obra e orçamentistas', 9, 15, false),
    (new_template_id, '10. Finalizado', 'Encerramento de ciclo e arquivo As-Built', 10, 5, true);

  -- Adiciona o owner como membro 'owner' da organização
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner')
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_on_new_organization
  AFTER INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_organization_template();

-- 5.2. FUNÇÃO PARA INSTANCIAR ETAPAS AUTOMATICAMENTE AO CRIAR UM NOVO PROJETO
CREATE OR REPLACE FUNCTION public.handle_new_project_stages()
RETURNS TRIGGER AS $$
DECLARE
  tpl_id UUID;
  item RECORD;
  current_date_cursor DATE;
BEGIN
  -- Cria a ficha de briefing inicial vazia
  INSERT INTO public.project_briefings (project_id)
  VALUES (NEW.id)
  ON CONFLICT (project_id) DO NOTHING;

  -- Gera o primeiro token do portal do cliente
  INSERT INTO public.client_access_tokens (project_id)
  VALUES (NEW.id)
  ON CONFLICT DO NOTHING;

  -- Busca o template padrão da organização
  SELECT id INTO tpl_id
  FROM public.stage_templates
  WHERE organization_id = NEW.organization_id AND is_default = true
  LIMIT 1;

  -- Se não achar default, pega o primeiro template disponível
  IF tpl_id IS NULL THEN
    SELECT id INTO tpl_id
    FROM public.stage_templates
    WHERE organization_id = NEW.organization_id
    LIMIT 1;
  END IF;

  current_date_cursor := COALESCE(NEW.start_date, CURRENT_DATE);

  -- Clona os itens do template para as etapas do projeto
  IF tpl_id IS NOT NULL THEN
    FOR item IN
      SELECT * FROM public.stage_template_items
      WHERE stage_template_id = tpl_id
      ORDER BY stage_order ASC
    LOOP
      INSERT INTO public.project_stages (
        project_id,
        name,
        description,
        stage_order,
        is_client_approval_required,
        start_date,
        due_date,
        status,
        progress_percent
      ) VALUES (
        NEW.id,
        item.name,
        item.description,
        item.stage_order,
        item.is_client_approval_required,
        current_date_cursor,
        current_date_cursor + (item.default_duration_days || ' days')::INTERVAL,
        'a_iniciar',
        0
      );

      current_date_cursor := current_date_cursor + (item.default_duration_days || ' days')::INTERVAL;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_on_new_project
  AFTER INSERT ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_project_stages();

-- ==============================================================================
-- 6. ÍNDICES DE ALTA PERFORMANCE (Postgres Patterns)
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_org_members_user ON public.organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON public.organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_stage_templates_org ON public.stage_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_stage_template_items_tpl ON public.stage_template_items(stage_template_id, stage_order);
CREATE INDEX IF NOT EXISTS idx_projects_org ON public.projects(organization_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_project_stages_project ON public.project_stages(project_id, stage_order);
CREATE INDEX IF NOT EXISTS idx_tasks_stage ON public.tasks(stage_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON public.tasks(project_id, status);
CREATE INDEX IF NOT EXISTS idx_client_tokens_token ON public.client_access_tokens(token) WHERE is_revoked = false;
CREATE INDEX IF NOT EXISTS idx_stage_approvals_project ON public.stage_approvals(project_id, created_at DESC);

-- ==============================================================================
-- 7. ROW LEVEL SECURITY (RLS) & POLÍTICAS DE ACESSO
-- ==============================================================================

-- Habilita RLS em todas as tabelas
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stage_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stage_template_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_briefings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_access_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stage_approvals ENABLE ROW LEVEL SECURITY;

-- Helper Security Definer para verificar membresia
CREATE OR REPLACE FUNCTION public.is_org_member(org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = org_id
      AND user_id = (SELECT auth.uid())
  ) OR EXISTS (
    SELECT 1 FROM public.organizations
    WHERE id = org_id
      AND owner_id = (SELECT auth.uid())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_org_admin(org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.organizations
    WHERE id = org_id
      AND owner_id = (SELECT auth.uid())
  ) OR EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = org_id
      AND user_id = (SELECT auth.uid())
      AND role IN ('owner', 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 7.1. POLÍTICAS: ORGANIZATIONS
CREATE POLICY "Membros podem ver suas organizações"
  ON public.organizations FOR SELECT
  USING (owner_id = (SELECT auth.uid()) OR public.is_org_member(id));

CREATE POLICY "Usuários autenticados podem criar organizações"
  ON public.organizations FOR INSERT
  WITH CHECK (owner_id = (SELECT auth.uid()));

CREATE POLICY "Owners e Admins podem atualizar a organização"
  ON public.organizations FOR UPDATE
  USING (public.is_org_admin(id))
  WITH CHECK (public.is_org_admin(id));

-- 7.2. POLÍTICAS: ORGANIZATION_MEMBERS
CREATE POLICY "Membros podem ver outros membros da organização"
  ON public.organization_members FOR SELECT
  USING (user_id = (SELECT auth.uid()) OR public.is_org_member(organization_id));

CREATE POLICY "Owners e Admins podem gerenciar membros"
  ON public.organization_members FOR ALL
  USING (public.is_org_admin(organization_id))
  WITH CHECK (public.is_org_admin(organization_id));


-- 7.3. POLÍTICAS: STAGE_TEMPLATES & ITEMS
CREATE POLICY "Membros podem ver e usar templates da organização"
  ON public.stage_templates FOR SELECT
  USING (public.is_org_member(organization_id));

CREATE POLICY "Membros podem gerenciar templates da organização"
  ON public.stage_templates FOR ALL
  USING (public.is_org_member(organization_id));

CREATE POLICY "Membros podem ver e gerenciar itens de templates"
  ON public.stage_template_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.stage_templates t
      WHERE t.id = stage_template_items.stage_template_id
        AND public.is_org_member(t.organization_id)
    )
  );

-- 7.4. POLÍTICAS: PROJECTS & BRIEFINGS
CREATE POLICY "Membros podem ver projetos da organização"
  ON public.projects FOR SELECT
  USING (public.is_org_member(organization_id));

CREATE POLICY "Membros podem criar projetos na organização"
  ON public.projects FOR INSERT
  WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY "Membros podem atualizar projetos"
  ON public.projects FOR UPDATE
  USING (public.is_org_member(organization_id));

CREATE POLICY "Membros podem deletar projetos"
  ON public.projects FOR DELETE
  USING (public.is_org_member(organization_id));

CREATE POLICY "Membros podem acessar e editar briefing"
  ON public.project_briefings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_briefings.project_id
        AND public.is_org_member(p.organization_id)
    )
  );

-- 7.5. POLÍTICAS: PROJECT_STAGES & TASKS
CREATE POLICY "Membros podem ver e gerenciar etapas do projeto"
  ON public.project_stages FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_stages.project_id
        AND public.is_org_member(p.organization_id)
    )
  );

CREATE POLICY "Membros podem ver e gerenciar tarefas do projeto"
  ON public.tasks FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = tasks.project_id
        AND public.is_org_member(p.organization_id)
    )
  );

-- 7.6. POLÍTICAS: CLIENT_ACCESS_TOKENS & STAGE_APPROVALS
CREATE POLICY "Membros podem gerenciar tokens de acesso do cliente"
  ON public.client_access_tokens FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = client_access_tokens.project_id
        AND public.is_org_member(p.organization_id)
    )
  );

CREATE POLICY "Membros podem visualizar histórico de aprovações"
  ON public.stage_approvals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = stage_approvals.project_id
        AND public.is_org_member(p.organization_id)
    )
  );

-- ==============================================================================
-- 8. FUNÇÕES RPC SEGURAS PARA O PORTAL DO CLIENTE (ZERO FRICTION)
-- ==============================================================================

-- 8.1. Obter dados públicos do projeto através do Token
CREATE OR REPLACE FUNCTION public.get_portal_project(client_token TEXT)
RETURNS JSONB AS $$
DECLARE
  proj_id UUID;
  result JSONB;
BEGIN
  -- Valida o token
  SELECT project_id INTO proj_id
  FROM public.client_access_tokens
  WHERE token = client_token
    AND is_revoked = false
    AND (expires_at IS NULL OR expires_at > timezone('utc'::text, now()))
  LIMIT 1;

  IF proj_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Token inválido ou expirado');
  END IF;

  -- Atualiza o último acesso
  UPDATE public.client_access_tokens
  SET last_accessed_at = timezone('utc'::text, now())
  WHERE token = client_token;

  -- Monta os dados do projeto, escritório e etapas
  SELECT jsonb_build_object(
    'project', (
      SELECT jsonb_build_object(
        'id', p.id,
        'code', p.code,
        'title', p.title,
        'description', p.description,
        'client_name', p.client_name,
        'area_sqm', p.area_sqm,
        'deadline', p.deadline,
        'status', p.status
      ) FROM public.projects p WHERE p.id = proj_id
    ),
    'organization', (
      SELECT jsonb_build_object(
        'name', o.name,
        'logo_url', o.logo_url,
        'cau_caubr', o.cau_caubr,
        'phone', o.phone,
        'email', o.email
      ) FROM public.projects p
      JOIN public.organizations o ON o.id = p.organization_id
      WHERE p.id = proj_id
    ),
    'stages', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', s.id,
          'name', s.name,
          'description', s.description,
          'stage_order', s.stage_order,
          'status', s.status,
          'progress_percent', s.progress_percent,
          'start_date', s.start_date,
          'due_date', s.due_date,
          'is_client_approval_required', s.is_client_approval_required,
          'is_locked_for_client', s.is_locked_for_client
        ) ORDER BY s.stage_order ASC
      ) FROM public.project_stages s WHERE s.project_id = proj_id
    )
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 8.2. Registrar aprovação ou solicitação de ajuste do cliente com auditoria
CREATE OR REPLACE FUNCTION public.submit_portal_approval(
  client_token TEXT,
  target_stage_id UUID,
  action_type approval_action,
  approver_name TEXT,
  approver_email TEXT,
  feedback TEXT,
  client_ip TEXT DEFAULT NULL,
  client_ua TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  proj_id UUID;
  stage_record RECORD;
BEGIN
  -- Valida o token
  SELECT project_id INTO proj_id
  FROM public.client_access_tokens
  WHERE token = client_token
    AND is_revoked = false
    AND (expires_at IS NULL OR expires_at > timezone('utc'::text, now()))
  LIMIT 1;

  IF proj_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Token inválido ou expirado');
  END IF;

  -- Verifica se a etapa pertence ao projeto
  SELECT * INTO stage_record
  FROM public.project_stages
  WHERE id = target_stage_id AND project_id = proj_id;

  IF stage_record IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Etapa não encontrada neste projeto');
  END IF;

  -- Se a etapa já estiver travada para o cliente
  IF stage_record.is_locked_for_client AND action_type = 'approved' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Esta etapa já foi aprovada e está bloqueada para novas alterações');
  END IF;

  -- Insere o registro de auditoria imutável
  INSERT INTO public.stage_approvals (
    project_id,
    stage_id,
    action,
    approver_name,
    approver_email,
    ip_address,
    user_agent,
    feedback_message
  ) VALUES (
    proj_id,
    target_stage_id,
    action_type,
    approver_name,
    approver_email,
    client_ip,
    client_ua,
    feedback
  );

  -- Atualiza o status da etapa
  IF action_type = 'approved' THEN
    UPDATE public.project_stages
    SET status = 'concluido',
        progress_percent = 100,
        is_locked_for_client = true
    WHERE id = target_stage_id;
  ELSE
    UPDATE public.project_stages
    SET status = 'em_producao',
        is_locked_for_client = false
    WHERE id = target_stage_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'action', action_type);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
