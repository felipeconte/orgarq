'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { sanitizeText } from '@/lib/server/sanitize'

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

  redirect('/app')
}

export async function logoutAction() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function resetPasswordAction(formData: FormData) {
  const email = sanitizeText(formData.get('email') as string)

  if (!email) {
    return { error: 'Por favor, informe seu e-mail.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/login?reset=true`,
  })

  if (error) {
    return { error: error.message }
  }

  return { success: true, message: 'Link de recuperação enviado para o seu e-mail!' }
}
