/**
 * Serviço de Envio de E-mails para o Portal do Cliente
 */

import { maskCPF } from '@/lib/formatters-and-validators'

export interface ClientCredentialsEmailParams {
  clientName: string
  clientEmail: string
  clientCpf: string
  rawPassword: string
  officeName: string
  officePhone?: string | null
  officeEmail?: string | null
}

export interface ClientNewProjectNotificationEmailParams {
  clientName: string
  clientEmail: string
  clientCpf: string
  officeName: string
  projectTitle: string
}

/**
 * Envia e-mail com as credenciais de primeiro acesso para o cliente
 */
export async function sendClientPortalCredentialsEmail(
  params: ClientCredentialsEmailParams
): Promise<{ success: boolean; error?: string }> {
  const {
    clientName,
    clientEmail,
    clientCpf,
    rawPassword,
    officeName,
    officePhone,
    officeEmail,
  } = params

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const formattedCpf = maskCPF(clientCpf)
  const portalLoginUrl = `${baseUrl}/portal/login?cpf=${encodeURIComponent(formattedCpf)}`

  const emailSubject = `Seu acesso ao Portal de Acompanhamento — ${officeName}`

  const emailHtml = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>${emailSubject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 24px; }
    .card { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .header { text-align: center; margin-bottom: 24px; }
    .logo-badge { display: inline-block; background: linear-gradient(135deg, #2563eb, #4f46e5); color: #ffffff; font-weight: bold; font-size: 18px; padding: 10px 18px; border-radius: 12px; margin-bottom: 12px; }
    h1 { font-size: 20px; font-weight: 700; color: #0f172a; margin: 0 0 8px 0; }
    p { font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 16px 0; }
    .credentials-box { background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 14px; padding: 20px 22px; margin: 24px 0; }
    .credential-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; font-size: 14px; }
    .credential-label { color: #64748b; font-weight: 600; }
    .credential-val-cpf { font-family: monospace; font-size: 15px; font-weight: 700; color: #0f172a; background: #ffffff; padding: 6px 12px; border-radius: 8px; border: 1px solid #e2e8f0; }
    .credential-val-password { font-family: 'SFMono-Regular', Consolas, Menlo, Courier, monospace; font-size: 20px; font-weight: 800; letter-spacing: 2px; color: #1d4ed8; background: #ffffff; border: 2px dashed #93c5fd; padding: 8px 16px; border-radius: 8px; user-select: all; -webkit-user-select: all; -moz-user-select: all; display: inline-block; }
    .btn-container { text-align: center; margin: 28px 0 16px 0; }
    .btn { display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 700; padding: 14px 28px; border-radius: 10px; }
    .footer { text-align: center; font-size: 12px; color: #94a3b8; margin-top: 24px; border-top: 1px solid #f1f5f9; padding-top: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="logo-badge">Orgarq</div>
      <h1>Acompanhe seu Projeto de Arquitetura</h1>
      <p>Olá <strong>${clientName}</strong>, o escritório <strong>${officeName}</strong> preparou um portal exclusivo para você acompanhar todas as etapas, entregas e aprovações do seu projeto em tempo real.</p>
    </div>

    <div class="credentials-box">
      <div class="credential-row">
        <span class="credential-label">Usuário (Seu CPF):</span>
        <span class="credential-val-cpf">${formattedCpf}</span>
      </div>
      <div class="credential-row" style="margin-top: 10px; align-items: center;">
        <span class="credential-label">Sua Senha de Acesso:</span>
        <span class="credential-val-password" title="Dê dois cliques para copiar">${rawPassword}</span>
      </div>
      <div style="text-align: right; margin-top: 6px;">
        <span style="font-size: 11px; color: #64748b;">📋 Dica: Selecione ou dê dois cliques na senha acima para copiar.</span>
      </div>
    </div>

    <div class="btn-container">
      <a href="${portalLoginUrl}" class="btn" style="color: #ffffff;">Acessar Portal do Cliente →</a>
    </div>

    <p style="font-size: 12px; color: #64748b; text-align: center;">
      Guarde estas informações com segurança. Você poderá utilizá-las sempre que quiser acompanhar o status da sua obra e projetos.
    </p>

    <div class="footer">
      <p>Mensagem enviada por <strong>${officeName}</strong> através da plataforma Orgarq Architecture OS.</p>
      ${officePhone ? `<p>Telefone / WhatsApp do escritório: ${officePhone}</p>` : ''}
      ${officeEmail ? `<p>E-mail: ${officeEmail}</p>` : ''}
    </div>
  </div>
</body>
</html>
  `

  console.log('===================================================================')
  console.log(`📧 [EMAIL PORTAL CLIENTE] Enviando credenciais para: ${clientEmail}`)
  console.log(`👤 Cliente: ${clientName} | CPF: ${formattedCpf}`)
  console.log(`🔑 Senha Gerada: ${rawPassword}`)
  console.log(`🏢 Escritório: ${officeName}`)
  console.log(`🔗 Link de Acesso: ${portalLoginUrl}`)
  console.log('===================================================================')

  // Se houver chave RESEND_API_KEY ou serviço SMTP configurado no ambiente:
  const resendApiKey = process.env.RESEND_API_KEY
  const resendFrom = process.env.RESEND_FROM_EMAIL || 'Orgarq <onboarding@resend.dev>'

  if (resendApiKey) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: resendFrom,
          to: [clientEmail],
          subject: emailSubject,
          html: emailHtml,
        }),
      })

      if (!res.ok) {
        const errText = await res.text()
        console.warn('Falha no envio via Resend API (usando fallback de log):', errText)
      }
    } catch (apiErr) {
      console.warn('Erro ao chamar provedor de e-mail:', apiErr)
    }
  }

  return { success: true }
}

/**
 * Envia notificação quando um cliente já cadastrado é vinculado a um novo projeto
 */
export async function sendClientNewProjectNotificationEmail(
  params: ClientNewProjectNotificationEmailParams
): Promise<{ success: boolean; error?: string }> {
  const { clientName, clientEmail, clientCpf, officeName, projectTitle } = params

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const portalLoginUrl = `${baseUrl}/portal/login`
  const formattedCpf = maskCPF(clientCpf)

  const emailSubject = `Novo projeto disponível no seu Portal — ${officeName}`

  console.log('===================================================================')
  console.log(`📧 [EMAIL PORTAL CLIENTE] Notificação de Novo Projeto para: ${clientEmail}`)
  console.log(`👤 Cliente: ${clientName} | CPF: ${formattedCpf}`)
  console.log(`🏢 Escritório: ${officeName} | Projeto: ${projectTitle}`)
  console.log(`🔗 Acesso: ${portalLoginUrl}`)
  console.log('===================================================================')

  const resendApiKey = process.env.RESEND_API_KEY
  const resendFrom = process.env.RESEND_FROM_EMAIL || 'Orgarq <onboarding@resend.dev>'

  if (resendApiKey) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: resendFrom,
          to: [clientEmail],
          subject: emailSubject,
          html: `
            <p>Olá <strong>${clientName}</strong>,</p>
            <p>O escritório <strong>${officeName}</strong> adicionou você ao projeto <strong>${projectTitle}</strong>.</p>
            <p>Para acompanhar o projeto, acesse seu portal com seu CPF (<strong>${formattedCpf}</strong>) e sua senha já cadastrada:</p>
            <p><a href="${portalLoginUrl}">Clique aqui para acessar o Portal do Cliente</a></p>
          `,
        }),
      })
    } catch (err) {
      console.warn('Erro envio notificação novo projeto:', err)
    }
  }

  return { success: true }
}

export interface PasswordResetEmailParams {
  userEmail: string
  userName?: string | null
  resetLink: string
}

/**
 * Envia e-mail de redefinição de senha com layout oficial Orgarq via Resend
 */
export async function sendPasswordResetEmail(
  params: PasswordResetEmailParams
): Promise<{ success: boolean; error?: string }> {
  const { userEmail, userName, resetLink } = params
  const resendApiKey = process.env.RESEND_API_KEY
  const resendFrom = process.env.RESEND_FROM_EMAIL || 'Orgarq <onboarding@resend.dev>'
  const greeting = userName ? `Olá, <strong>${userName}</strong>` : 'Olá'
  const emailSubject = 'Redefina sua senha de acesso no Orgarq'

  const emailHtml = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>${emailSubject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 24px; }
    .card { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .header { text-align: center; margin-bottom: 24px; }
    .logo-badge { display: inline-block; background: #2563eb; color: #ffffff; font-weight: bold; font-size: 16px; padding: 8px 18px; border-radius: 10px; margin-bottom: 12px; }
    h1 { font-size: 22px; font-weight: 700; color: #0f172a; margin: 0 0 8px 0; }
    p { font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 16px 0; }
    .btn-container { text-align: center; margin: 28px 0; }
    .btn { display: inline-block; background: #2563eb; color: #ffffff !important; text-decoration: none; font-size: 14px; font-weight: 700; padding: 14px 32px; border-radius: 10px; }
    .link-box { font-size: 12px; line-height: 1.5; color: #2563eb; word-break: break-all; background-color: #f1f5f9; padding: 10px 14px; border-radius: 8px; border: 1px solid #e2e8f0; margin: 0 0 20px 0; }
    .security-notice { background-color: #f8fafc; border-left: 4px solid #f59e0b; border-radius: 0 8px 8px 0; padding: 12px 16px; margin: 20px 0 16px 0; font-size: 12px; color: #64748b; line-height: 1.5; }
    .footer { text-align: center; font-size: 12px; color: #94a3b8; margin-top: 24px; border-top: 1px solid #f1f5f9; padding-top: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="logo-badge">Orgarq</div>
      <h1>Redefinição de senha</h1>
    </div>
    <p>${greeting},</p>
    <p>Recebemos uma solicitação para redefinir a senha da sua conta de acesso ao <strong>Orgarq Architecture OS</strong>.</p>
    
    <div class="btn-container">
      <a href="${resetLink}" class="btn">Redefinir Minha Senha &rarr;</a>
    </div>

    <p style="font-size: 13px; color: #64748b; margin-bottom: 8px;">Se o botão não funcionar, copie e cole o link direto no seu navegador:</p>
    <div class="link-box">
      <a href="${resetLink}" style="color: #2563eb; text-decoration: none;">${resetLink}</a>
    </div>

    <div class="security-notice">
      <strong style="color: #78350f; display: block; margin-bottom: 4px;">Informações de Segurança:</strong>
      Este link possui validade limitada. Se você não solicitou a redefinição de senha, nenhuma ação é necessária — sua conta continua segura.
    </div>

    <div class="footer">
      <p><strong>Orgarq Architecture OS</strong> &bull; Gestão Inteligente de Projetos de Arquitetura</p>
    </div>
  </div>
</body>
</html>
  `

  console.log('===================================================================')
  console.log(`📧 [EMAIL RECUPERAÇÃO DE SENHA] Enviando para: ${userEmail}`)
  console.log(`🔗 Link de Redefinição: ${resetLink}`)
  console.log('===================================================================')

  if (resendApiKey) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: resendFrom,
          to: [userEmail],
          subject: emailSubject,
          html: emailHtml,
        }),
      })

      if (!res.ok) {
        const errText = await res.text()
        console.warn('Falha no envio via Resend API (recuperação):', errText)
        return { success: false, error: 'Falha ao enviar e-mail via provedor.' }
      }
      return { success: true }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao conectar com provedor de e-mail.'
      console.warn('Erro ao chamar Resend:', err)
      return { success: false, error: msg }
    }
  }

  return { success: true }
}

export interface SignupConfirmationEmailParams {
  userEmail: string
  userName?: string | null
  confirmationLink: string
}

/**
 * Envia e-mail de confirmação de cadastro com layout oficial Orgarq via Resend
 */
export async function sendSignupConfirmationEmail(
  params: SignupConfirmationEmailParams
): Promise<{ success: boolean; error?: string }> {
  const { userEmail, userName, confirmationLink } = params
  const resendApiKey = process.env.RESEND_API_KEY
  const resendFrom = process.env.RESEND_FROM_EMAIL || 'Orgarq <onboarding@resend.dev>'
  const greeting = userName ? `Olá, <strong>${userName}</strong>` : 'Olá'
  const emailSubject = 'Confirme seu e-mail para ativar sua conta no Orgarq'

  const emailHtml = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>${emailSubject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 24px; }
    .card { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .header { text-align: center; margin-bottom: 24px; }
    .logo-badge { display: inline-block; background: #2563eb; color: #ffffff; font-weight: bold; font-size: 16px; padding: 8px 18px; border-radius: 10px; margin-bottom: 12px; }
    h1 { font-size: 22px; font-weight: 700; color: #0f172a; margin: 0 0 8px 0; }
    p { font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 16px 0; }
    .btn-container { text-align: center; margin: 28px 0; }
    .btn { display: inline-block; background: #2563eb; color: #ffffff !important; text-decoration: none; font-size: 14px; font-weight: 700; padding: 14px 32px; border-radius: 10px; }
    .link-box { font-size: 12px; line-height: 1.5; color: #2563eb; word-break: break-all; background-color: #f1f5f9; padding: 10px 14px; border-radius: 8px; border: 1px solid #e2e8f0; margin: 0 0 20px 0; }
    .footer { text-align: center; font-size: 12px; color: #94a3b8; margin-top: 24px; border-top: 1px solid #f1f5f9; padding-top: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="logo-badge">Orgarq</div>
      <h1>Confirme seu endereço de e-mail</h1>
    </div>
    <p>${greeting},</p>
    <p>Obrigado por criar sua conta no <strong>Orgarq Architecture OS</strong>. Para ativar o acesso ao seu painel e às etapas de projeto do seu escritório, confirme seu endereço de e-mail clicando no botão abaixo:</p>
    
    <div class="btn-container">
      <a href="${confirmationLink}" class="btn">Confirmar meu E-mail &rarr;</a>
    </div>

    <p style="font-size: 13px; color: #64748b; margin-bottom: 8px;">Ou copie e cole o link direto no seu navegador:</p>
    <div class="link-box">
      <a href="${confirmationLink}" style="color: #2563eb; text-decoration: none;">${confirmationLink}</a>
    </div>

    <div style="border-top: 1px solid #f1f5f9; padding-top: 16px;">
      <p style="font-size: 12px; line-height: 1.5; color: #94a3b8; margin: 0;">
        🔒 Este link foi enviado para <strong>${userEmail}</strong>. Se você não solicitou este cadastro, desconsidere esta mensagem.
      </p>
    </div>

    <div class="footer">
      <p><strong>Orgarq Architecture OS</strong> &bull; Gestão Inteligente de Projetos de Arquitetura</p>
    </div>
  </div>
</body>
</html>
  `

  console.log('===================================================================')
  console.log(`📧 [EMAIL CONFIRMAÇÃO CADASTRO] Enviando para: ${userEmail}`)
  console.log(`🔗 Link de Confirmação: ${confirmationLink}`)
  console.log('===================================================================')

  if (resendApiKey) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: resendFrom,
          to: [userEmail],
          subject: emailSubject,
          html: emailHtml,
        }),
      })

      if (!res.ok) {
        const errText = await res.text()
        console.warn('Falha no envio via Resend API (confirmação cadastro):', errText)
        return { success: false, error: 'Falha ao enviar e-mail via provedor.' }
      }
      return { success: true }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao conectar com provedor de e-mail.'
      console.warn('Erro ao chamar Resend:', err)
      return { success: false, error: msg }
    }
  }

  return { success: true }
}

export interface EmailChangeConfirmationParams {
  userEmail: string
  newEmail: string
  userName?: string | null
  confirmationLink: string
}

/**
 * Envia e-mail de confirmação de alteração de e-mail com layout oficial Orgarq via Resend
 */
export async function sendEmailChangeConfirmationEmail(
  params: EmailChangeConfirmationParams
): Promise<{ success: boolean; error?: string }> {
  const { userEmail, newEmail, userName, confirmationLink } = params
  const resendApiKey = process.env.RESEND_API_KEY
  const resendFrom = process.env.RESEND_FROM_EMAIL || 'Orgarq <onboarding@resend.dev>'
  const greeting = userName ? `Olá, <strong>${userName}</strong>` : 'Olá'
  const emailSubject = 'Confirme a alteração do seu e-mail no Orgarq'

  const emailHtml = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>${emailSubject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 24px; }
    .card { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .header { text-align: center; margin-bottom: 24px; }
    .logo-badge { display: inline-block; background: #2563eb; color: #ffffff; font-weight: bold; font-size: 16px; padding: 8px 18px; border-radius: 10px; margin-bottom: 12px; }
    h1 { font-size: 22px; font-weight: 700; color: #0f172a; margin: 0 0 8px 0; }
    p { font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 16px 0; }
    .highlight-box { background-color: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 12px; padding: 14px 18px; margin: 0 0 20px 0; }
    .btn-container { text-align: center; margin: 28px 0; }
    .btn { display: inline-block; background: #2563eb; color: #ffffff !important; text-decoration: none; font-size: 14px; font-weight: 700; padding: 14px 32px; border-radius: 10px; }
    .link-box { font-size: 12px; line-height: 1.5; color: #2563eb; word-break: break-all; background-color: #f1f5f9; padding: 10px 14px; border-radius: 8px; border: 1px solid #e2e8f0; margin: 0 0 20px 0; }
    .warning-notice { border-top: 1px solid #f1f5f9; padding-top: 16px; font-size: 12px; line-height: 1.5; color: #64748b; }
    .footer { text-align: center; font-size: 12px; color: #94a3b8; margin-top: 24px; border-top: 1px solid #f1f5f9; padding-top: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="logo-badge">Orgarq</div>
      <h1>Alteração de endereço de e-mail</h1>
    </div>
    <p>${greeting},</p>
    <p>Recebemos uma solicitação para alterar o endereço de e-mail de acesso da sua conta no <strong>Orgarq Architecture OS</strong>.</p>
    
    <div class="highlight-box">
      <span style="display: block; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Novo endereço solicitado:</span>
      <span style="font-size: 15px; font-weight: 700; color: #0f172a; font-family: monospace;">${newEmail}</span>
    </div>

    <p>Para confirmar e oficializar a troca deste e-mail, clique no botão de confirmação abaixo:</p>

    <div class="btn-container">
      <a href="${confirmationLink}" class="btn">Confirmar Novo E-mail &rarr;</a>
    </div>

    <p style="font-size: 13px; color: #64748b; margin-bottom: 8px;">Ou copie e cole o link direto no seu navegador:</p>
    <div class="link-box">
      <a href="${confirmationLink}" style="color: #2563eb; text-decoration: none;">${confirmationLink}</a>
    </div>

    <div class="warning-notice">
      <strong style="color: #dc2626; display: block; margin-bottom: 4px;">⚠️ Não solicitou essa alteração?</strong>
      Se você não pediu a troca de e-mail, ignore esta mensagem ou acesse sua conta para alterar sua senha imediatamente.
    </div>

    <div class="footer">
      <p><strong>Orgarq Architecture OS</strong> &bull; Gestão Inteligente de Projetos de Arquitetura</p>
    </div>
  </div>
</body>
</html>
  `

  console.log('===================================================================')
  console.log(`📧 [EMAIL TROCA DE E-MAIL] Enviando para: ${newEmail} (solicitado por: ${userEmail})`)
  console.log(`🔗 Link de Confirmação: ${confirmationLink}`)
  console.log('===================================================================')

  if (resendApiKey) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: resendFrom,
          to: [newEmail],
          subject: emailSubject,
          html: emailHtml,
        }),
      })

      if (!res.ok) {
        const errText = await res.text()
        console.warn('Falha no envio via Resend API (troca e-mail):', errText)
        return { success: false, error: 'Falha ao enviar e-mail via provedor.' }
      }
      return { success: true }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao conectar com provedor de e-mail.'
      console.warn('Erro ao chamar Resend:', err)
      return { success: false, error: msg }
    }
  }

  return { success: true }
}

export interface UserInvitationEmailParams {
  userEmail: string
  inviterName?: string | null
  officeName: string
  inviteLink: string
}

/**
 * Envia e-mail de convite para colaborador/membro do escritório via Resend
 */
export async function sendUserInvitationEmail(
  params: UserInvitationEmailParams
): Promise<{ success: boolean; error?: string }> {
  const { userEmail, inviterName, officeName, inviteLink } = params
  const resendApiKey = process.env.RESEND_API_KEY
  const resendFrom = process.env.RESEND_FROM_EMAIL || 'Orgarq <onboarding@resend.dev>'
  const emailSubject = `Convite para participar do escritório ${officeName} no Orgarq`

  const emailHtml = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>${emailSubject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 24px; }
    .card { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .header { text-align: center; margin-bottom: 24px; }
    .logo-badge { display: inline-block; background: #2563eb; color: #ffffff; font-weight: bold; font-size: 16px; padding: 8px 18px; border-radius: 10px; margin-bottom: 12px; }
    h1 { font-size: 22px; font-weight: 700; color: #0f172a; margin: 0 0 8px 0; }
    p { font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 16px 0; }
    .btn-container { text-align: center; margin: 28px 0; }
    .btn { display: inline-block; background: #2563eb; color: #ffffff !important; text-decoration: none; font-size: 14px; font-weight: 700; padding: 14px 32px; border-radius: 10px; }
    .link-box { font-size: 12px; line-height: 1.5; color: #2563eb; word-break: break-all; background-color: #f1f5f9; padding: 10px 14px; border-radius: 8px; border: 1px solid #e2e8f0; margin: 0 0 20px 0; }
    .footer { text-align: center; font-size: 12px; color: #94a3b8; margin-top: 24px; border-top: 1px solid #f1f5f9; padding-top: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="logo-badge">Orgarq</div>
      <h1>Você foi convidado para a equipe!</h1>
    </div>
    <p>Olá,</p>
    <p>
      ${inviterName ? `<strong>${inviterName}</strong> convidou` : 'Você foi convidado(a)'} você para fazer parte da equipe do escritório <strong>${officeName}</strong> no <strong>Orgarq Architecture OS</strong>.
    </p>
    <p>
      Clique no botão abaixo para aceitar o convite, configurar sua senha de acesso e começar a colaborar nos projetos:
    </p>
    
    <div class="btn-container">
      <a href="${inviteLink}" class="btn">Aceitar Convite e Acessar &rarr;</a>
    </div>

    <p style="font-size: 13px; color: #64748b; margin-bottom: 8px;">Ou copie e cole o link direto no seu navegador:</p>
    <div class="link-box">
      <a href="${inviteLink}" style="color: #2563eb; text-decoration: none;">${inviteLink}</a>
    </div>

    <div class="footer">
      <p><strong>Orgarq Architecture OS</strong> &bull; Gestão Inteligente de Projetos de Arquitetura</p>
    </div>
  </div>
</body>
</html>
  `

  console.log('===================================================================')
  console.log(`📧 [EMAIL CONVITE MEMBRO] Enviando para: ${userEmail} | Escritório: ${officeName}`)
  console.log(`🔗 Link de Convite: ${inviteLink}`)
  console.log('===================================================================')

  if (resendApiKey) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: resendFrom,
          to: [userEmail],
          subject: emailSubject,
          html: emailHtml,
        }),
      })

      if (!res.ok) {
        const errText = await res.text()
        console.warn('Falha no envio via Resend API (convite membro):', errText)
        return { success: false, error: 'Falha ao enviar convite via provedor.' }
      }
      return { success: true }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao conectar com provedor de e-mail.'
      console.warn('Erro ao chamar Resend:', err)
      return { success: false, error: msg }
    }
  }

  return { success: true }
}

export interface MagicLinkEmailParams {
  userEmail: string
  userName?: string | null
  magicLink: string
  otpCode?: string | null
}

/**
 * Envia e-mail de Magic Link / OTP para login sem senha via Resend
 */
export async function sendMagicLinkEmail(
  params: MagicLinkEmailParams
): Promise<{ success: boolean; error?: string }> {
  const { userEmail, userName, magicLink, otpCode } = params
  const resendApiKey = process.env.RESEND_API_KEY
  const resendFrom = process.env.RESEND_FROM_EMAIL || 'Orgarq <onboarding@resend.dev>'
  const greeting = userName ? `Olá, <strong>${userName}</strong>` : 'Olá'
  const emailSubject = 'Seu link de acesso ao Orgarq'

  const emailHtml = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>${emailSubject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 24px; }
    .card { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .header { text-align: center; margin-bottom: 24px; }
    .logo-badge { display: inline-block; background: #2563eb; color: #ffffff; font-weight: bold; font-size: 16px; padding: 8px 18px; border-radius: 10px; margin-bottom: 12px; }
    h1 { font-size: 22px; font-weight: 700; color: #0f172a; margin: 0 0 8px 0; }
    p { font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 16px 0; }
    .otp-box { text-align: center; margin: 24px 0; }
    .otp-code { font-size: 26px; font-weight: 800; letter-spacing: 6px; color: #1d4ed8; font-family: 'SFMono-Regular', Consolas, Menlo, monospace; background: #f1f5f9; padding: 12px 24px; border-radius: 10px; border: 2px dashed #93c5fd; display: inline-block; }
    .btn-container { text-align: center; margin: 24px 0; }
    .btn { display: inline-block; background: #2563eb; color: #ffffff !important; text-decoration: none; font-size: 14px; font-weight: 700; padding: 14px 32px; border-radius: 10px; }
    .link-box { font-size: 12px; line-height: 1.5; color: #2563eb; word-break: break-all; background-color: #f1f5f9; padding: 10px 14px; border-radius: 8px; border: 1px solid #e2e8f0; margin: 0 0 20px 0; }
    .security-notice { background-color: #f8fafc; border-left: 4px solid #3b82f6; border-radius: 0 8px 8px 0; padding: 12px 16px; margin: 20px 0 16px 0; font-size: 12px; color: #475569; line-height: 1.5; }
    .footer { text-align: center; font-size: 12px; color: #94a3b8; margin-top: 24px; border-top: 1px solid #f1f5f9; padding-top: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="logo-badge">Orgarq</div>
      <h1>Acesso rápido sem senha</h1>
    </div>
    <p>${greeting},</p>
    <p>Recebemos uma solicitação de login direto para sua conta no <strong>Orgarq Architecture OS</strong>.</p>
    
    ${
      otpCode
        ? `
    <div class="otp-box">
      <span class="otp-code">${otpCode}</span>
      <p style="font-size: 12px; color: #64748b; margin-top: 8px;">Código de verificação temporário de 6 dígitos</p>
    </div>
    `
        : ''
    }

    <div class="btn-container">
      <a href="${magicLink}" class="btn">Entrar no Orgarq com 1 Clique &rarr;</a>
    </div>

    <p style="font-size: 13px; color: #64748b; margin-bottom: 8px;">Ou copie e cole o link direto no seu navegador:</p>
    <div class="link-box">
      <a href="${magicLink}" style="color: #2563eb; text-decoration: none;">${magicLink}</a>
    </div>

    <div class="security-notice">
      ⏳ Este link expira em poucos minutos e só pode ser utilizado uma única vez. Se você não solicitou este acesso, desconsidere esta mensagem.
    </div>

    <div class="footer">
      <p><strong>Orgarq Architecture OS</strong> &bull; Gestão Inteligente de Projetos de Arquitetura</p>
    </div>
  </div>
</body>
</html>
  `

  console.log('===================================================================')
  console.log(`📧 [EMAIL MAGIC LINK] Enviando para: ${userEmail}`)
  console.log(`🔗 Link de Acesso: ${magicLink}`)
  console.log('===================================================================')

  if (resendApiKey) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: resendFrom,
          to: [userEmail],
          subject: emailSubject,
          html: emailHtml,
        }),
      })

      if (!res.ok) {
        const errText = await res.text()
        console.warn('Falha no envio via Resend API (magic link):', errText)
        return { success: false, error: 'Falha ao enviar magic link via provedor.' }
      }
      return { success: true }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao conectar com provedor de e-mail.'
      console.warn('Erro ao chamar Resend:', err)
      return { success: false, error: msg }
    }
  }

  return { success: true }
}

export interface ReauthenticationEmailParams {
  userEmail: string
  userName?: string | null
  otpCode: string
}

/**
 * Envia e-mail com código de reautenticação de segurança para ações sensíveis via Resend
 */
export async function sendReauthenticationEmail(
  params: ReauthenticationEmailParams
): Promise<{ success: boolean; error?: string }> {
  const { userEmail, userName, otpCode } = params
  const resendApiKey = process.env.RESEND_API_KEY
  const resendFrom = process.env.RESEND_FROM_EMAIL || 'Orgarq <onboarding@resend.dev>'
  const greeting = userName ? `Olá, <strong>${userName}</strong>` : 'Olá'
  const emailSubject = 'Seu código de verificação de segurança — Orgarq'

  const emailHtml = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>${emailSubject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 24px; }
    .card { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .header { text-align: center; margin-bottom: 24px; }
    .logo-badge { display: inline-block; background: #2563eb; color: #ffffff; font-weight: bold; font-size: 16px; padding: 8px 18px; border-radius: 10px; margin-bottom: 12px; }
    h1 { font-size: 22px; font-weight: 700; color: #0f172a; margin: 0 0 8px 0; }
    p { font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 16px 0; }
    .otp-box { text-align: center; margin: 28px 0; }
    .otp-code { font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #2563eb; font-family: 'SFMono-Regular', Consolas, Menlo, monospace; background: #f8fafc; padding: 14px 28px; border-radius: 12px; border: 2px dashed #93c5fd; display: inline-block; }
    .warning-box { background-color: #fffbeb; border-left: 4px solid #f59e0b; border-radius: 0 8px 8px 0; padding: 12px 16px; margin: 20px 0 16px 0; font-size: 12px; color: #92400e; line-height: 1.5; }
    .footer { text-align: center; font-size: 12px; color: #94a3b8; margin-top: 24px; border-top: 1px solid #f1f5f9; padding-top: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="logo-badge">Orgarq</div>
      <h1>Verificação de Segurança</h1>
    </div>
    <p>${greeting},</p>
    <p>Para confirmar uma operação de segurança sensível na sua conta do <strong>Orgarq Architecture OS</strong>, informe o código de verificação abaixo:</p>
    
    <div class="otp-box">
      <span class="otp-code">${otpCode}</span>
    </div>

    <div class="warning-box">
      <strong>⚠️ Importante:</strong> Este código é pessoal, expira em instantes e nunca deve ser compartilhado com terceiros. Se você não solicitou este código, acesse sua conta imediatamente e troque sua senha.
    </div>

    <div class="footer">
      <p><strong>Orgarq Architecture OS</strong> &bull; Gestão Inteligente de Projetos de Arquitetura</p>
    </div>
  </div>
</body>
</html>
  `

  console.log('===================================================================')
  console.log(`📧 [EMAIL REAUTENTICAÇÃO] Enviando para: ${userEmail} | Código: ${otpCode}`)
  console.log('===================================================================')

  if (resendApiKey) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: resendFrom,
          to: [userEmail],
          subject: emailSubject,
          html: emailHtml,
        }),
      })

      if (!res.ok) {
        const errText = await res.text()
        console.warn('Falha no envio via Resend API (reautenticação):', errText)
        return { success: false, error: 'Falha ao enviar código via provedor.' }
      }
      return { success: true }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao conectar com provedor de e-mail.'
      console.warn('Erro ao chamar Resend:', err)
      return { success: false, error: msg }
    }
  }

  return { success: true }
}



