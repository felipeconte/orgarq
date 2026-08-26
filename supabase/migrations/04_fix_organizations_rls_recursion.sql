-- ==============================================================================
-- MIGRATION 04: CORREÇÃO DEFINITIVA DE RECURSÃO INFINITA NAS POLÍTICAS RLS DE ORGANIZATIONS
-- ==============================================================================

-- 1. Helper functions com SECURITY DEFINER para quebrar o ciclo de recursão RLS
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

-- 2. Remove as políticas recursivas antigas
DROP POLICY IF EXISTS "Membros podem ver suas organizações" ON public.organizations;
DROP POLICY IF EXISTS "Usuários autenticados podem criar organizações" ON public.organizations;
DROP POLICY IF EXISTS "Owners e Admins podem atualizar a organização" ON public.organizations;
DROP POLICY IF EXISTS "Membros podem ver outros membros da organização" ON public.organization_members;
DROP POLICY IF EXISTS "Owners e Admins podem gerenciar membros" ON public.organization_members;

-- 3. Recria as políticas RLS limpas e não recursivas para ORGANIZATIONS
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

-- 4. Recria as políticas RLS limpas e não recursivas para ORGANIZATION_MEMBERS
CREATE POLICY "Membros podem ver outros membros da organização"
  ON public.organization_members FOR SELECT
  USING (user_id = (SELECT auth.uid()) OR public.is_org_member(organization_id));

CREATE POLICY "Owners e Admins podem gerenciar membros"
  ON public.organization_members FOR ALL
  USING (public.is_org_admin(organization_id))
  WITH CHECK (public.is_org_admin(organization_id));
