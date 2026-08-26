import { requireAuth } from '@/lib/server/guard'
import OfficeSettingsClient, {
  OrganizationData,
  MemberData
} from '@/components/organization/OfficeSettingsClient'

export default async function OfficeProfilePage() {
  const { supabase, user } = await requireAuth()

  // 1. Busca a organização onde o usuário é membro ou proprietário
  let org: OrganizationData | null = null

  const { data: memberOrg } = await supabase
    .from('organization_members')
    .select('role, organizations(*)')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (memberOrg?.organizations) {
    org = memberOrg.organizations as unknown as OrganizationData
  } else {
    // Busca por owner_id
    const { data: ownedOrg } = await supabase
      .from('organizations')
      .select('*')
      .eq('owner_id', user.id)
      .limit(1)
      .maybeSingle()

    if (ownedOrg) {
      org = ownedOrg as unknown as OrganizationData

      // Garante que o owner está registrado na tabela de membros
      await supabase
        .from('organization_members')
        .insert({
          organization_id: ownedOrg.id,
          user_id: user.id,
          role: 'owner',
        })
        .select('id')
        .maybeSingle()
    } else {
      // Auto-cria organização se não existir
      const slug = `escritorio-${user.id.slice(0, 6)}`
      const { data: newOrg } = await supabase
        .from('organizations')
        .insert({
          name: 'Meu Escritório de Arquitetura',
          slug,
          owner_id: user.id,
          email: user.email || null,
        })
        .select('*')
        .single()

      if (newOrg) {
        org = newOrg as unknown as OrganizationData

        await supabase
          .from('organization_members')
          .insert({
            organization_id: newOrg.id,
            user_id: user.id,
            role: 'owner',
          })
          .select('id')
          .maybeSingle()
      }
    }
  }

  // Fallback seguro caso a criação de organização no DB falhe
  if (!org) {
    org = {
      id: 'default-org',
      name: 'Meu Escritório de Arquitetura',
      slug: `escritorio-${user.id.slice(0, 6)}`,
      cau_caubr: null,
      cnpj: null,
      phone: null,
      email: user.email || null,
      logo_url: null,
      owner_id: user.id,
    }
  }

  // 2. Busca todos os membros da organização com e-mails e nomes
  let members: MemberData[] = []
  if (org.id && org.id !== 'default-org') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: rpcMembers, error } = await (supabase.rpc as any)('get_organization_members_with_email', {
        target_org_id: org.id,
      })

      if (!error && Array.isArray(rpcMembers) && rpcMembers.length > 0) {
        members = rpcMembers.map((m: any) => ({
          id: m.id,
          organization_id: m.organization_id,
          user_id: m.user_id,
          role: m.role,
          created_at: m.created_at,
          email: m.email || (m.user_id === user.id ? user.email : 'Membro'),
          fullName: m.full_name || (m.user_id === user.id ? (user.user_metadata?.full_name || user.email?.split('@')[0]) : 'Membro'),
        }))
      }
    } catch {
      // Segue para fallback
    }

    if (members.length === 0) {
      const { data: mems } = await supabase
        .from('organization_members')
        .select('*')
        .eq('organization_id', org.id)
        .order('created_at', { ascending: true })

      if (mems) {
        members = mems.map((m) => ({
          ...m,
          email: m.user_id === user.id ? user.email : undefined,
          fullName: m.user_id === user.id ? (user.user_metadata?.full_name || user.email?.split('@')[0]) : undefined,
        })) as MemberData[]
      }
    }
  }

  // Se a lista de membros estiver vazia, inclui o usuário atual como owner
  if (members.length === 0) {
    members = [
      {
        id: `owner-${user.id}`,
        organization_id: org.id,
        user_id: user.id,
        role: 'owner',
        created_at: new Date().toISOString(),
        email: user.email,
        fullName: user.user_metadata?.full_name || user.email?.split('@')[0],
      },
    ]
  }

  return (
    <OfficeSettingsClient
      organization={org}
      members={members}
      currentUserId={user.id}
      currentUserEmail={user.email || 'Arquiteto'}
    />
  )
}
