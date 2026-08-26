-- ==============================================================================
-- MIGRATION 06: TABELA DEDICADA DE PERFIS DE USUÁRIO (EVITA BLOAT DE JWT / COOKIES)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  display_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  job_role TEXT,
  cau TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilita RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
DROP POLICY IF EXISTS "Perfis são visíveis para usuários autenticados" ON public.user_profiles;
CREATE POLICY "Perfis são visíveis para usuários autenticados"
  ON public.user_profiles FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Usuários podem gerenciar seu próprio perfil" ON public.user_profiles;
CREATE POLICY "Usuários podem gerenciar seu próprio perfil"
  ON public.user_profiles FOR ALL
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- Limpa avatares pesados em base64 que possam ter ficado no auth.users.raw_user_meta_data
UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data - 'avatar_url'
WHERE raw_user_meta_data ? 'avatar_url';
