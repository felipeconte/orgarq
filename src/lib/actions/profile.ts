'use server'

import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/server/guard'
import { sanitizeText } from '@/lib/server/sanitize'

/**
 * Atualiza os dados de perfil do usuário na tabela user_profiles (mantém o JWT/cookies limpos)
 */
export async function updateUserProfileAction(formData: FormData): Promise<{ success: boolean; error?: string }> {
  const { supabase, user } = await requireAuth()

  const fullName = sanitizeText(formData.get('fullName') as string)
  const phone = sanitizeText(formData.get('phone') as string)
  const jobRole = sanitizeText(formData.get('jobRole') as string)
  const cau = sanitizeText(formData.get('cau') as string)
  const bio = sanitizeText(formData.get('bio') as string)
  const avatarUrl = formData.get('avatarUrl') as string

  if (!fullName) {
    return { success: false, error: 'O nome de exibição é obrigatório.' }
  }

  // 1. Salva na tabela public.user_profiles (onde imagens/textos não afetam o cabeçalho de cookies)
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

  // 2. Atualiza apenas metadados leves no Supabase Auth (NUNCA incluir avatar base64 no cookie)
  await supabase.auth.updateUser({
    data: {
      full_name: fullName,
      display_name: fullName,
      avatar_url: null, // Limpa para garantir que o cookie JWT não inche
    },
  })

  revalidatePath('/app/configuracoes/perfil')
  revalidatePath('/app', 'layout')
  return { success: true }
}

/**
 * Atualiza a senha do usuário
 */
export async function updateUserPasswordAction(formData: FormData): Promise<{ success: boolean; error?: string }> {
  const { supabase } = await requireAuth()

  const newPassword = (formData.get('newPassword') as string) || ''
  const confirmPassword = (formData.get('confirmPassword') as string) || ''

  if (!newPassword || newPassword.length < 6) {
    return { success: false, error: 'A nova senha deve ter no mínimo 6 caracteres.' }
  }

  if (newPassword !== confirmPassword) {
    return { success: false, error: 'As senhas digitadas não coincidem.' }
  }

  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  })

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}
