-- ==============================================================================
-- MIGRATION 03: TAREFAS RICAS (CHECKLIST, COMENTÁRIOS, ANEXOS) E GESTÃO DE TEMPLATES
-- ==============================================================================

-- 1. Adiciona campos de conteúdo rico em project_stages
ALTER TABLE public.project_stages
  ADD COLUMN IF NOT EXISTS checklist JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS comments JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 2. Adiciona suporte a checklist pré-configurado e duração opcional nos templates
ALTER TABLE public.stage_template_items
  ADD COLUMN IF NOT EXISTS checklist JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.stage_template_items
  ALTER COLUMN default_duration_days DROP NOT NULL,
  ALTER COLUMN default_duration_days DROP DEFAULT;

-- 3. Atualiza função handle_new_project_stages para clonar com duração opcional e checklist
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
