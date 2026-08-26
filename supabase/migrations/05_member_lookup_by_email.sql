-- ==============================================================================
-- MIGRATION 05: BUSCA E ADIÇÃO DE MEMBROS DA ORGANIZAÇÃO POR E-MAIL
-- ==============================================================================

-- 1. Função para buscar o ID do usuário pelo e-mail
CREATE OR REPLACE FUNCTION public.get_user_id_by_email(lookup_email TEXT)
RETURNS UUID AS $$
DECLARE
  found_id UUID;
BEGIN
  SELECT id INTO found_id
  FROM auth.users
  WHERE LOWER(email) = LOWER(TRIM(lookup_email))
  LIMIT 1;

  RETURN found_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 2. Função para adicionar membro por e-mail com validação amigável
CREATE OR REPLACE FUNCTION public.add_org_member_by_email(
  target_org_id UUID,
  member_email TEXT,
  member_role user_role DEFAULT 'architect'
)
RETURNS JSONB AS $$
DECLARE
  target_user_id UUID;
BEGIN
  -- 1. Localiza o usuário pelo e-mail
  SELECT id INTO target_user_id
  FROM auth.users
  WHERE LOWER(email) = LOWER(TRIM(member_email))
  LIMIT 1;

  IF target_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Nenhum usuário com o e-mail "' || member_email || '" foi encontrado. O usuário precisa se cadastrar na plataforma primeiro.'
    );
  END IF;

  -- 2. Verifica se já é membro
  IF EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = target_org_id AND user_id = target_user_id
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Este usuário já faz parte da equipe deste escritório.'
    );
  END IF;

  -- 3. Insere o membro
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (target_org_id, target_user_id, member_role);

  RETURN jsonb_build_object(
    'success', true,
    'user_id', target_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Função para listar membros com seus respectivos e-mails e nomes
CREATE OR REPLACE FUNCTION public.get_organization_members_with_email(target_org_id UUID)
RETURNS TABLE (
  id UUID,
  organization_id UUID,
  user_id UUID,
  role user_role,
  created_at TIMESTAMPTZ,
  email TEXT,
  full_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.organization_id,
    m.user_id,
    m.role,
    m.created_at,
    u.email::TEXT,
    COALESCE(
      (u.raw_user_meta_data->>'full_name')::TEXT,
      (u.raw_user_meta_data->>'display_name')::TEXT,
      split_part(u.email::TEXT, '@', 1)
    ) AS full_name
  FROM public.organization_members m
  JOIN auth.users u ON u.id = m.user_id
  WHERE m.organization_id = target_org_id
  ORDER BY m.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
