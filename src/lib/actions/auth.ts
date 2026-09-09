'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { sanitizeText } from '@/lib/server/sanitize'
import { sendPasswordResetEmail, sendSignupConfirmationEmail, sendMagicLinkEmail } from '@/lib/server/email'


export async function loginAction(formData: FormData) {
  const email = sanitizeText(formData.get('email') as string)
  const password = formData.get('password') as string

  if (!email || !password) {
    return { error: 'E-mail e senha são obrigatórios.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { error: error.message || 'Credenciais inválidas. Verifique seu e-mail e senha.' }
  }

  redirect('/app')
}

export async function registerAction(formData: FormData) {
  const name = sanitizeText(formData.get('name') as string)
  const officeName = sanitizeText(formData.get('officeName') as string)
  const email = sanitizeText(formData.get('email') as string)
  const password = formData.get('password') as string

  if (!name || !officeName || !email || !password) {
    return { error: 'Todos os campos são obrigatórios.' }
  }

  if (password.length < 6) {
    return { error: 'A senha deve ter no mínimo 6 caracteres.' }
  }

  const supabase = await createClient()

  // 1. Cria usuário no Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: name,
      },
    },
  })

  if (authError || !authData.user) {
    return { error: authError?.message || 'Falha ao registrar usuário.' }
  }

  const userId = authData.user.id
  const slug = officeName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '') + '-' + Math.floor(1000 + Math.random() * 9000)

  // 2. Cria a Organização (o trigger no Postgres criará automaticamente as 10 etapas padrão)
  const { error: orgError } = await supabase
    .from('organizations')
    .insert({
      name: officeName,
      slug,
      owner_id: userId,
      email,
    })

  if (orgError) {
    console.error('Erro ao criar organização inicial:', orgError)
  }

  // 3. Se confirmação de e-mail estiver ativa (sem sessão imediata), envia e-mail com layout Orgarq via Resend
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const resendApiKey = process.env.RESEND_API_KEY
  if (serviceRoleKey && resendApiKey && !authData.session) {
    try {
      const adminClient = createAdminClient()
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      const { data: linkData } = await adminClient.auth.admin.generateLink({
        type: 'signup',
        email,
        password,
        options: {
          data: { full_name: name },
          redirectTo: `${baseUrl}/app`,
        },
      })
      if (linkData?.properties?.action_link) {
        await sendSignupConfirmationEmail({
          userEmail: email,
          userName: name,
          confirmationLink: linkData.properties.action_link,
        })
      }
    } catch (linkErr) {
      console.warn('Erro ao gerar/enviar confirmação de cadastro via Resend:', linkErr)
    }
  }

  redirect('/app')
}

export async function logoutAction() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function resetPasswordAction(formData: FormData) {
  const email = sanitizeText(formData.get('email') as string)?.toLowerCase().trim()

  if (!email) {
    return { error: 'Por favor, informe seu e-mail.' }
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const redirectTo = `${baseUrl}/recuperar-senha`

  // 1. Tenta gerar link oficial com admin e enviar direto via Resend
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const resendApiKey = process.env.RESEND_API_KEY

  if (serviceRoleKey && resendApiKey) {
    try {
      const adminClient = createAdminClient()
      const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: { redirectTo },
      })

      if (!linkError && linkData?.properties?.action_link) {
        const sendRes = await sendPasswordResetEmail({
          userEmail: email,
          resetLink: linkData.properties.action_link,
        })

        if (sendRes.success) {
          return { success: true, message: 'Link de recuperação enviado para o seu e-mail!' }
        }
      }
    } catch (adminErr) {
      console.warn('Erro na geração/envio via Resend Admin (tentando fallback nativo):', adminErr)
    }
  }

  // 2. Fallback padrão
  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  })

  if (error) {
    const lower = (error.message || '').toLowerCase()
    if (lower.includes('rate limit') || lower.includes('over_email_send_rate_limit')) {
      return { error: 'Limite de envio atingido. Por favor, aguarde alguns instantes antes de tentar novamente.' }
    }
    if (lower.includes('error sending')) {
      return { error: 'Falha no serviço de e-mail ao enviar o link de recuperação. Tente novamente em instantes.' }
    }
    return { error: error.message }
  }

  return { success: true, message: 'Link de recuperação enviado para o seu e-mail!' }
}

/**
 * Envia Magic Link / OTP para login rápido sem senha
 */
export async function sendMagicLinkAction(formData: FormData): Promise<{ success?: boolean; message?: string; error?: string }> {
  const email = sanitizeText(formData.get('email') as string)?.toLowerCase().trim()
  if (!email) return { error: 'E-mail é obrigatório.' }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const resendApiKey = process.env.RESEND_API_KEY

  if (serviceRoleKey && resendApiKey) {
    try {
      const adminClient = createAdminClient()
      const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
        type: 'magiclink',
        email,
        options: { redirectTo: `${baseUrl}/app` },
      })

      if (!linkError && linkData?.properties?.action_link) {
        const sendRes = await sendMagicLinkEmail({
          userEmail: email,
          magicLink: linkData.properties.action_link,
          otpCode: linkData.properties.email_otp || null,
        })

        if (sendRes.success) {
          return { success: true, message: 'Link de acesso seguro enviado para o seu e-mail!' }
        }
      }
    } catch (err) {
      console.warn('Erro ao gerar/enviar magic link via Resend:', err)
    }
  }

  // Fallback nativo
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${baseUrl}/app` },
  })

  if (error) {
    return { error: error.message }
  }

  return { success: true, message: 'Link de acesso enviado para o seu e-mail!' }
}

