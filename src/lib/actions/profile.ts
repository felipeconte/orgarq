'use server'

import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/server/guard'
import { sanitizeText } from '@/lib/server/sanitize'
import { createAdminClient } from '@/lib/supabase/server'
import { sendPasswordResetEmail, sendEmailChangeConfirmationEmail } from '@/lib/server/email'

function translateAuthError(msg: string): string {
  if (!msg) return 'Ocorreu um erro ao processar a solicitação.'
  const lower = msg.toLowerCase()
  if (lower.includes('new password should be different') || lower.includes('different from the old')) {
    return 'A nova senha deve ser diferente da senha atual.'
  }
  if (lower.includes('password should be at least')) {
    return 'A nova senha deve ter no mínimo 6 caracteres.'
  }
  if (lower.includes('invalid login credentials') || lower.includes('invalid credentials')) {
    return 'A senha atual informada está incorreta.'
  }
  if (lower.includes('reauthentication needed') || lower.includes('reauthenticate')) {
    return 'Por favor, confirme sua senha atual antes de continuar.'
  }
  if (lower.includes('email already registered') || lower.includes('already registered') || lower.includes('user already exists')) {
    return 'Este endereço de e-mail já está em uso por outro usuário.'
  }
  if (lower.includes('over_email_send_rate_limit') || lower.includes('rate limit')) {
    return 'Limite de envio de e-mails atingido. Por favor, aguarde alguns minutos antes de tentar novamente.'
  }
  if (lower.includes('error sending recovery email') || lower.includes('error sending')) {
    return 'Falha no serviço de e-mail ao enviar o link de recuperação. Por favor, tente novamente em instantes.'
  }
  return msg
}


/**
 * Atualiza os dados de perfil do usuário na tabela user_profiles e no Supabase Auth (e-mail e nome)
 */
export async function updateUserProfileAction(formData: FormData): Promise<{
  success: boolean
  error?: string
  emailChangePending?: boolean
  newEmail?: string
}> {
  const { supabase, user } = await requireAuth()

  const fullName = sanitizeText(formData.get('fullName') as string)
  const email = sanitizeText(formData.get('email') as string)?.toLowerCase().trim()
  const phone = sanitizeText(formData.get('phone') as string)
  const jobRole = sanitizeText(formData.get('jobRole') as string)
  const cau = sanitizeText(formData.get('cau') as string)
  const bio = sanitizeText(formData.get('bio') as string)
  const avatarUrl = formData.get('avatarUrl') as string

  if (!fullName) {
    return { success: false, error: 'O nome de exibição é obrigatório.' }
  }

  // 1. Validação e atualização de e-mail no Supabase Auth
  let emailChangePending = false
  if (email && email !== user.email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return { success: false, error: 'Por favor, informe um endereço de e-mail válido.' }
    }

    const { data: authData, error: emailError } = await supabase.auth.updateUser({
      email,
    })

    if (emailError) {
      return { success: false, error: `Erro ao atualizar e-mail no login: ${translateAuthError(emailError.message)}` }
    }

    if (authData?.user?.new_email) {
      emailChangePending = true

      // Dispara o e-mail estilizado com o link gerado pelo Admin se as credenciais existirem
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      const resendApiKey = process.env.RESEND_API_KEY
      if (serviceRoleKey && resendApiKey) {
        try {
          const adminClient = createAdminClient()
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
          const { data: linkData } = await adminClient.auth.admin.generateLink({
            type: 'email_change_new',
            email: user.email,
            newEmail: email,
            options: { redirectTo: `${baseUrl}/app/configuracoes/perfil` },
          })
          if (linkData?.properties?.action_link) {
            await sendEmailChangeConfirmationEmail({
              userEmail: user.email,
              newEmail: email,
              userName: fullName,
              confirmationLink: linkData.properties.action_link,
            })
          }
        } catch (linkErr) {
          console.warn('Erro ao disparar e-mail de troca de e-mail via Resend:', linkErr)
        }
      }
    }
  }

  // 2. Salva na tabela public.user_profiles
  const { error: dbError } = await supabase
    .from('user_profiles')
    .upsert(
      {
        user_id: user.id,
        full_name: fullName,
        display_name: fullName,
        avatar_url: avatarUrl || null,
        phone: phone || null,
        job_role: jobRole || null,
        cau: cau || null,
        bio: bio || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )

  if (dbError) {
    console.error('Error updating user_profiles table:', dbError)
  }

  // 3. Atualiza metadados leves no Supabase Auth
  await supabase.auth.updateUser({
    data: {
      full_name: fullName,
      display_name: fullName,
      avatar_url: null, // Limpa para evitar inchar cookie JWT
    },
  })

  revalidatePath('/app/configuracoes/perfil')
  revalidatePath('/app', 'layout')
  return {
    success: true,
    emailChangePending,
    newEmail: email || user.email,
  }
}

/**
 * Atualiza a senha do usuário exigindo a senha atual para validação de segurança
 */
export async function updateUserPasswordAction(formData: FormData): Promise<{ success: boolean; error?: string }> {
  const { supabase, user } = await requireAuth()

  const currentPassword = (formData.get('currentPassword') as string) || ''
  const newPassword = (formData.get('newPassword') as string) || ''
  const confirmPassword = (formData.get('confirmPassword') as string) || ''

  if (!currentPassword) {
    return { success: false, error: 'Por favor, informe sua senha atual para confirmação.' }
  }

  if (!newPassword || newPassword.length < 6) {
    return { success: false, error: 'A nova senha deve ter no mínimo 6 caracteres.' }
  }

  if (newPassword !== confirmPassword) {
    return { success: false, error: 'As novas senhas digitadas não coincidem.' }
  }

  if (currentPassword === newPassword) {
    return { success: false, error: 'A nova senha deve ser diferente da senha atual.' }
  }

  // Validação: reautentica no Supabase Auth com a senha atual informada
  if (user.email) {
    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    })

    if (reauthError) {
      return { success: false, error: 'A senha atual informada está incorreta. Verifique e tente novamente.' }
    }
  }

  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  })

  if (error) {
    return { success: false, error: translateAuthError(error.message) }
  }

  return { success: true }
}

/**
 * Envia e-mail oficial do Supabase para redefinição segura de senha
 */
export async function sendPasswordResetEmailAction(): Promise<{ success: boolean; message?: string; error?: string }> {
  const { supabase, user } = await requireAuth()

  if (!user.email) {
    return { success: false, error: 'E-mail do usuário não encontrado.' }
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const redirectTo = `${baseUrl}/recuperar-senha`

  // 1. Tenta gerar o link seguro oficial via Admin e enviar com template Orgarq via Resend
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const resendApiKey = process.env.RESEND_API_KEY

  if (serviceRoleKey && resendApiKey) {
    try {
      const adminClient = createAdminClient()
      const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
        type: 'recovery',
        email: user.email,
        options: { redirectTo },
      })

      if (!linkError && linkData?.properties?.action_link) {
        const sendRes = await sendPasswordResetEmail({
          userEmail: user.email,
          userName: user.user_metadata?.full_name || null,
          resetLink: linkData.properties.action_link,
        })

        if (sendRes.success) {
          return {
            success: true,
            message: `Enviamos as instruções e o link seguro de redefinição de senha para o e-mail ${user.email}.`,
          }
        }
      }
    } catch (adminErr) {
      console.warn('Erro na geração/envio via Resend Admin (tentando fallback nativo):', adminErr)
    }
  }

  // 2. Fallback padrão: resetPasswordForEmail nativo
  const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
    redirectTo,
  })

  if (error) {
    return { success: false, error: translateAuthError(error.message) }
  }

  return {
    success: true,
    message: `Enviamos as instruções e o link seguro de redefinição de senha para o e-mail ${user.email}.`,
  }
}
