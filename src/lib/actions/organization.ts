'use server'

import { revalidatePath } from 'next/cache'
import { requireAuth, requireOrgAccess } from '@/lib/server/guard'
import { sanitizeText } from '@/lib/server/sanitize'
import { Database } from '@/types/database.types'
import { cleanDigits, maskCPFOrCNPJ, validateCPF, validateCNPJ } from '@/lib/formatters-and-validators'
import { createAdminClient } from '@/lib/supabase/server'
import { sendUserInvitationEmail } from '@/lib/server/email'


type OrganizationUpdate = Database['public']['Tables']['organizations']['Update']

/**
 * Atualiza os dados cadastrais do escritório / organização
 */
export async function updateOrganizationAction(
  orgId: string,
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  const { supabase, user } = await requireAuth()

  // Validação de acesso
  await requireOrgAccess(orgId)

  const name = sanitizeText(formData.get('name') as string)
  const slug = sanitizeText(formData.get('slug') as string)
    ?.toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
  const cau_caubr = sanitizeText(formData.get('cau_caubr') as string)
  const cnpj = sanitizeText(formData.get('cnpj') as string)
  const phone = sanitizeText(formData.get('phone') as string)
  const email = sanitizeText(formData.get('email') as string)
  const logo_url = sanitizeText(formData.get('logo_url') as string)

  if (!name) {
    return { success: false, error: 'O nome do escritório é obrigatório.' }
  }

  if (!slug) {
    return { success: false, error: 'O identificador (slug) é obrigatório.' }
  }

  if (cnpj) {
    const digits = cleanDigits(cnpj)
    if (digits.length === 11) {
      if (!validateCPF(digits)) {
        return { success: false, error: 'O CPF informado é inválido. Verifique os dígitos.' }
      }
    } else if (digits.length === 14) {
      if (!validateCNPJ(digits)) {
        return { success: false, error: 'O CNPJ informado é inválido. Verifique os dígitos.' }
      }
    } else {
      return { success: false, error: 'O documento deve ser um CPF válido (11 dígitos) ou CNPJ válido (14 dígitos).' }
    }
  }

  // Verifica se o slug já está em uso por outro escritório
  const { data: existingSlug } = await supabase
    .from('organizations')
    .select('id')
    .eq('slug', slug)
    .neq('id', orgId)
    .maybeSingle()

  if (existingSlug) {
    return { success: false, error: 'Este identificador (slug) já está em uso por outro escritório. Escolha outro.' }
  }

  const updatePayload: OrganizationUpdate = {
    name,
    slug,
    cau_caubr: cau_caubr || null,
    cnpj: cnpj ? maskCPFOrCNPJ(cnpj) : null,
    phone: phone || null,
    email: email || null,
    logo_url: logo_url || null,
  }

  const { error } = await supabase
    .from('organizations')
    .update(updatePayload)
    .eq('id', orgId)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/app/configuracoes/escritorio')
  revalidatePath('/app')
  return { success: true }
}

/**
 * Adiciona um novo membro na equipe do escritório buscando pelo e-mail
 */
export async function addOrganizationMemberAction(
  orgId: string,
  data: {
    email: string
    role: 'owner' | 'admin' | 'architect' | 'intern'
  }
): Promise<{ success: boolean; message?: string; error?: string }> {
  const { supabase } = await requireAuth()
  await requireOrgAccess(orgId)

  const cleanEmail = sanitizeText(data.email).toLowerCase().trim()
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return { success: false, error: 'Por favor, informe um endereço de e-mail válido.' }
  }

  // 1. Tenta via RPC add_org_member_by_email
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rpcRes, error: rpcError } = await (supabase.rpc as any)('add_org_member_by_email', {
      target_org_id: orgId,
      member_email: cleanEmail,
      member_role: data.role || 'architect',
    })

    if (!rpcError && rpcRes && typeof rpcRes === 'object') {
      if ((rpcRes as { success?: boolean }).success) {
        revalidatePath('/app/configuracoes/escritorio')
        return { success: true }
      }
      if ((rpcRes as { error?: string }).error) {
        return { success: false, error: (rpcRes as { error: string }).error }
      }
    }
  } catch {
    // Segue para fallback
  }

  // 2. Fallback via get_user_id_by_email
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: foundUserId, error: lookupError } = await (supabase.rpc as any)('get_user_id_by_email', {
      lookup_email: cleanEmail,
    })

    if (lookupError || !foundUserId) {
      // Se não encontrou usuário cadastrado, gera convite oficial via Admin e envia e-mail com layout Orgarq via Resend
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      const resendApiKey = process.env.RESEND_API_KEY
      if (serviceRoleKey && resendApiKey) {
        try {
          const adminClient = createAdminClient()
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
          const { data: inviteData, error: inviteError } = await adminClient.auth.admin.generateLink({
            type: 'invite',
            email: cleanEmail,
            options: {
              redirectTo: `${baseUrl}/app`,
              data: { invited_to_org: orgId, role: data.role || 'architect' },
            },
          })

          if (!inviteError && inviteData?.properties?.action_link) {
            const { data: orgData } = await supabase.from('organizations').select('name').eq('id', orgId).single()
            await sendUserInvitationEmail({
              userEmail: cleanEmail,
              officeName: orgData?.name || 'Nosso Escritório',
              inviteLink: inviteData.properties.action_link,
            })
            return {
              success: true,
              message: `Convite enviado por e-mail para "${cleanEmail}". O colaborador poderá criar sua senha e acessar o escritório.`,
            }
          }
        } catch (inviteErr) {
          console.warn('Erro ao gerar/enviar convite de membro:', inviteErr)
        }
      }

      return {
        success: false,
        error: `Nenhum usuário com o e-mail "${cleanEmail}" foi encontrado. O usuário precisa se cadastrar na plataforma primeiro.`,
      }
    }


    const { error: insertError } = await supabase
      .from('organization_members')
      .insert({
        organization_id: orgId,
        user_id: foundUserId,
        role: data.role || 'architect',
      })

    if (insertError) {
      if (insertError.code === '23505') {
        return { success: false, error: 'Este usuário já faz parte da equipe deste escritório.' }
      }
      return { success: false, error: insertError.message }
    }

    revalidatePath('/app/configuracoes/escritorio')
    return { success: true }
  } catch (err: any) {
    return {
      success: false,
      error: `Não foi possível localizar o usuário "${cleanEmail}". Certifique-se de que a conta está cadastrada.`,
    }
  }
}


/**
 * Atualiza o cargo/papel de um membro
 */
export async function updateMemberRoleAction(
  orgId: string,
  memberId: string,
  newRole: 'owner' | 'admin' | 'architect' | 'intern'
): Promise<{ success: boolean; error?: string }> {
  const { supabase } = await requireAuth()
  await requireOrgAccess(orgId)

  const { error } = await supabase
    .from('organization_members')
    .update({ role: newRole })
    .eq('id', memberId)
    .eq('organization_id', orgId)


  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/app/configuracoes/escritorio')
  return { success: true }
}

/**
 * Remove um membro da organização
 */
export async function removeMemberAction(
  orgId: string,
  memberId: string
): Promise<{ success: boolean; error?: string }> {
  const { supabase } = await requireAuth()
  await requireOrgAccess(orgId)

  const { error } = await supabase
    .from('organization_members')
    .delete()
    .eq('id', memberId)
    .eq('organization_id', orgId)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/app/configuracoes/escritorio')
  return { success: true }
}
