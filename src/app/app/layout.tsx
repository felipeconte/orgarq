import { requireAuth } from '@/lib/server/guard'
import { AppShellClient } from '@/components/layout/AppShellClient'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { supabase, user } = await requireAuth()

  // Busca dados da organização do usuário
  const { data: member } = await supabase
    .from('organization_members')
    .select('role, organizations(id, name, slug, logo_url)')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  let org = member?.organizations as { id: string; name: string; slug: string; logo_url: string | null } | null

  if (!org) {
    const { data: ownedOrg } = await supabase
      .from('organizations')
      .select('id, name, slug, logo_url')
      .eq('owner_id', user.id)
      .limit(1)
      .maybeSingle()
    if (ownedOrg) {
      org = ownedOrg
    }
  }

  const officeName = org?.name || 'Meu Escritório'

  // Busca perfil na tabela dedicada user_profiles
  const { data: dbProfile } = await supabase
    .from('user_profiles')
    .select('full_name, display_name, avatar_url')
    .eq('user_id', user.id)
    .maybeSingle()

  // Dados do usuário
  const meta = user.user_metadata || {}
  const userDisplayName =
    dbProfile?.full_name ||
    dbProfile?.display_name ||
    meta.full_name ||
    meta.display_name ||
    user.email?.split('@')[0] ||
    'Arquiteto'
  const userAvatarUrl = dbProfile?.avatar_url || meta.avatar_url || null
  const userRole = member?.role || 'owner'

  // Busca se há solicitações de atualização cadastral de clientes pendentes
  let pendingClientUpdatesCount = 0
  if (org?.id) {
    const { count } = await supabase
      .from('client_update_requests')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', org.id)
      .eq('status', 'pending')
    pendingClientUpdatesCount = count || 0
  }

  return (
    <AppShellClient
      officeName={officeName}
      orgLogoUrl={org?.logo_url || null}
      userDisplayName={userDisplayName}
      userAvatarUrl={userAvatarUrl}
      userRole={userRole}
      pendingClientUpdatesCount={pendingClientUpdatesCount}
    >
      {children}
    </AppShellClient>
  )
}
