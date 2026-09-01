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
