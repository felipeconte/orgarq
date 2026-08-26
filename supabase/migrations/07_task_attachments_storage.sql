-- ==============================================================================
-- MIGRATION 07: BUCKET PRIVADO E POLÍTICAS DE ACESSO POR PROJETO / MEMBRO
-- ==============================================================================

-- 1. Helper Security Definer para validar se o usuário tem permissão no projeto
CREATE OR REPLACE FUNCTION public.can_access_project(target_project_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = target_project_id
      AND (
        p.created_by = (SELECT auth.uid())
        OR public.is_org_member(p.organization_id)
        OR public.is_org_admin(p.organization_id)
      )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 2. Cria ou atualiza o bucket de anexos como PRIVADO (public = false)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'task-attachments',
  'task-attachments',
  false,     -- Privado: exige autenticação e permissão de acesso ao projeto
  104857600, -- Limite de 100MB por arquivo
  null       -- Qualquer tipo de arquivo permitido (PDF, DWG, DXF, PNG, JPG, ZIP, IFC, RVT, etc.)
)
ON CONFLICT (id) DO UPDATE SET public = false;

-- 3. Remove políticas antigas se existirem
DROP POLICY IF EXISTS "Usuários autenticados podem enviar arquivos de tarefas" ON storage.objects;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar arquivos de tarefas" ON storage.objects;
DROP POLICY IF EXISTS "Usuários autenticados podem deletar arquivos de tarefas" ON storage.objects;
DROP POLICY IF EXISTS "Arquivos de tarefas são acessíveis publicamente" ON storage.objects;
DROP POLICY IF EXISTS "Membros do projeto podem visualizar anexos do storage" ON storage.objects;
DROP POLICY IF EXISTS "Membros do projeto podem enviar anexos para o storage" ON storage.objects;
DROP POLICY IF EXISTS "Membros do projeto podem atualizar anexos no storage" ON storage.objects;
DROP POLICY IF EXISTS "Membros do projeto podem deletar anexos do storage" ON storage.objects;

-- 4. Políticas RLS estritas: somente membros que possuem acesso ao projeto podem ver, enviar ou deletar
CREATE POLICY "Membros do projeto podem visualizar anexos do storage"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'task-attachments'
    AND public.can_access_project((split_part(name, '/', 1))::UUID)
  );

CREATE POLICY "Membros do projeto podem enviar anexos para o storage"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'task-attachments'
    AND public.can_access_project((split_part(name, '/', 1))::UUID)
  );

CREATE POLICY "Membros do projeto podem atualizar anexos no storage"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'task-attachments'
    AND public.can_access_project((split_part(name, '/', 1))::UUID)
  );

CREATE POLICY "Membros do projeto podem deletar anexos do storage"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'task-attachments'
    AND public.can_access_project((split_part(name, '/', 1))::UUID)
  );
