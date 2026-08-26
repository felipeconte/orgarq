-- Migration 08: Redefine default project stages template (7 stages) & Project Template Selection
-- 1. Adds support for selecting a specific template or creating a clean project without stages (skip_default_stages)
-- 2. Updates default template to the 7 essential stages: Contrato, Briefing, Estudo Preliminar, Projeto 3D, Projeto Executivo, Entrega Final, Suporte

-- 1. Adiciona campos de seleção de template na tabela projects
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS stage_template_id UUID REFERENCES public.stage_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS skip_default_stages BOOLEAN DEFAULT false;

-- 2. Atualiza a criação do template padrão para novas organizações
CREATE OR REPLACE FUNCTION public.handle_new_organization_template()
RETURNS TRIGGER AS $$
DECLARE
  new_template_id UUID;
BEGIN
  -- Cria o template padrão
  INSERT INTO public.stage_templates (organization_id, name, description, is_default)
  VALUES (NEW.id, 'Padrão do Sistema', 'Template padrão com as etapas oficiais de projeto', true)
  RETURNING id INTO new_template_id;

  -- Insere as 7 etapas padrão
  INSERT INTO public.stage_template_items (stage_template_id, name, description, stage_order, default_duration_days, is_client_approval_required)
  VALUES
    (new_template_id, 'Contrato', 'Formalização da proposta e assinatura de contrato', 1, 5, true),
    (new_template_id, 'Briefing', 'Levantamento de necessidades, estilo e referências', 2, 7, false),
    (new_template_id, 'Estudo Preliminar', 'Concepção volumétrica inicial e plantas de layout', 3, 15, true),
    (new_template_id, 'Projeto 3D', 'Modelagem 3D e renders fotorrealistas para aprovação visual', 4, 15, true),
    (new_template_id, 'Projeto Executivo', 'Desenvolvimento técnico de pranchas e paginações', 5, 25, false),
    (new_template_id, 'Entrega Final', 'Entrega do projeto completo', 6, 5, true),
    (new_template_id, 'Suporte', 'Pós entrega final, suporte para dúvidas, orçamentos, ambientações...', 7, 15, false);

  -- Adiciona o owner como membro 'owner' da organização
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner')
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Atualiza função handle_new_project_stages para suportar template customizado ou nenhum (projeto em branco)
CREATE OR REPLACE FUNCTION public.handle_new_project_stages()
RETURNS TRIGGER AS $$
DECLARE
  tpl_id UUID;
  item RECORD;
  current_date_cursor DATE;
  calc_due_date DATE;
BEGIN
  -- Cria a ficha de briefing inicial vazia
  INSERT INTO public.project_briefings (project_id)
  VALUES (NEW.id)
  ON CONFLICT (project_id) DO NOTHING;

  -- Gera o primeiro token do portal do cliente
  INSERT INTO public.client_access_tokens (project_id)
  VALUES (NEW.id)
  ON CONFLICT DO NOTHING;

  -- Se o projeto foi configurado para NÃO usar template (em branco), encerra sem criar etapas
  IF NEW.skip_default_stages = true THEN
    RETURN NEW;
  END IF;

  -- Se foi especificado um template específico, usa ele
  IF NEW.stage_template_id IS NOT NULL THEN
    tpl_id := NEW.stage_template_id;
  ELSE
    -- Busca o template padrão da organização
    SELECT id INTO tpl_id
    FROM public.stage_templates
    WHERE organization_id = NEW.organization_id AND is_default = true
    LIMIT 1;

    -- Se não achar default, pega o primeiro template disponível da organização
    IF tpl_id IS NULL THEN
      SELECT id INTO tpl_id
      FROM public.stage_templates
      WHERE organization_id = NEW.organization_id
      LIMIT 1;
    END IF;
  END IF;

  current_date_cursor := COALESCE(NEW.start_date, CURRENT_DATE);

  -- Clona os itens do template para as tarefas/etapas do projeto
  IF tpl_id IS NOT NULL THEN
    FOR item IN
      SELECT * FROM public.stage_template_items
      WHERE stage_template_id = tpl_id
      ORDER BY stage_order ASC
    LOOP
      IF item.default_duration_days IS NOT NULL AND item.default_duration_days > 0 THEN
        calc_due_date := current_date_cursor + (item.default_duration_days || ' days')::INTERVAL;
      ELSE
        calc_due_date := NULL;
      END IF;

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
        is_locked_for_client,
        checklist,
        comments,
        attachments
      )
      VALUES (
        NEW.id,
        item.name,
        item.description,
        item.stage_order,
        item.is_client_approval_required,
        current_date_cursor,
        calc_due_date,
        'a_iniciar',
        0,
        false,
        COALESCE(item.checklist, '[]'::jsonb),
        '[]'::jsonb,
        '[]'::jsonb
      );

      IF item.default_duration_days IS NOT NULL AND item.default_duration_days > 0 THEN
        current_date_cursor := calc_due_date + interval '1 day';
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Atualiza os templates padrão existentes nas organizações para refletir a nova estrutura
DO $$
DECLARE
  tpl RECORD;
BEGIN
  FOR tpl IN
    SELECT id FROM public.stage_templates WHERE is_default = true
  LOOP
    -- Deleta itens antigos do template padrão
    DELETE FROM public.stage_template_items WHERE stage_template_id = tpl.id;

    -- Insere os novos 7 itens
    INSERT INTO public.stage_template_items (stage_template_id, name, description, stage_order, default_duration_days, is_client_approval_required)
    VALUES
      (tpl.id, 'Contrato', 'Formalização da proposta e assinatura de contrato', 1, 5, true),
      (tpl.id, 'Briefing', 'Levantamento de necessidades, estilo e referências', 2, 7, false),
      (tpl.id, 'Estudo Preliminar', 'Concepção volumétrica inicial e plantas de layout', 3, 15, true),
      (tpl.id, 'Projeto 3D', 'Modelagem 3D e renders fotorrealistas para aprovação visual', 4, 15, true),
      (tpl.id, 'Projeto Executivo', 'Desenvolvimento técnico de pranchas e paginações', 5, 25, false),
      (tpl.id, 'Entrega Final', 'Entrega do projeto completo', 6, 5, true),
      (tpl.id, 'Suporte', 'Pós entrega final, suporte para dúvidas, orçamentos, ambientações...', 7, 15, false);
  END LOOP;
END $$;
