-- ==============================================================================
-- MIGRATION 02: REMOVE COLUNA TAG DE ETAPAS E TEMPLATES
-- ==============================================================================

-- 1. Remove coluna tag de stage_template_items
ALTER TABLE public.stage_template_items DROP COLUMN IF EXISTS tag;

-- 2. Remove coluna tag de project_stages
ALTER TABLE public.project_stages DROP COLUMN IF EXISTS tag;

-- 3. Atualiza função handle_new_organization_template
CREATE OR REPLACE FUNCTION public.handle_new_organization_template()
RETURNS TRIGGER AS $$
DECLARE
  new_template_id UUID;
BEGIN
  -- Cria o template padrão
  INSERT INTO public.stage_templates (organization_id, name, description, is_default)
  VALUES (NEW.id, 'Padrão do Sistema', 'Template padrão com as 10 etapas oficiais de projeto', true)
  RETURNING id INTO new_template_id;

  -- Insere as 10 etapas padrão sem a coluna tag
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

-- 4. Atualiza função handle_new_project_stages
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

  -- Clona os itens do template para as etapas do projeto sem tag
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
        progress_percent,
        is_locked_for_client
      )
      VALUES (
        NEW.id,
        item.name,
        item.description,
        item.stage_order,
        item.is_client_approval_required,
        current_date_cursor,
        current_date_cursor + item.default_duration_days,
        'a_iniciar',
        0,
        false
      );

      current_date_cursor := current_date_cursor + item.default_duration_days + 1;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Atualiza função get_portal_project sem a coluna tag
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

