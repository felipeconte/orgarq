'use server'

export interface CepAddressResult {
  success: boolean
  data?: {
    street: string
    neighborhood: string
    city: string
    state: string
  }
  error?: string
}

/**
 * Server Action com fallback multi-provedor (ViaCEP -> BrasilAPI -> OpenCEP)
 * Executa no servidor Node.js, imune a bloqueios de CORS, AdBlockers e extensões do navegador.
 */
export async function lookupCepAction(cep: string): Promise<CepAddressResult> {
  const digits = (cep || '').replace(/\D/g, '')

  if (digits.length !== 8) {
    return { success: false, error: 'CEP deve conter exatamente 8 dígitos numéricos.' }
  }

  // 1. Tenta ViaCEP
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 4500)

    const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Orgarq-App/1.0',
      },
      cache: 'force-cache',
    })

    clearTimeout(timeout)

    if (response.ok) {
      const data = await response.json()
      if (!data.erro) {
        return {
          success: true,
          data: {
            street: data.logradouro || '',
            neighborhood: data.bairro || '',
            city: data.localidade || '',
            state: (data.uf || '').toUpperCase(),
          },
        }
      }
    }
  } catch (err) {
    console.warn('[ViaCEP Fallback]', err)
  }

  // 2. Fallback: BrasilAPI
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 4500)

    const response = await fetch(`https://brasilapi.com.br/api/cep/v1/${digits}`, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Orgarq-App/1.0',
      },
      cache: 'force-cache',
    })

    clearTimeout(timeout)

    if (response.ok) {
      const data = await response.json()
      if (data.city && data.state) {
        return {
          success: true,
          data: {
            street: data.street || '',
            neighborhood: data.neighborhood || '',
            city: data.city || '',
            state: (data.state || '').toUpperCase(),
          },
        }
      }
    }
  } catch (err) {
    console.warn('[BrasilAPI Fallback]', err)
  }

  // 3. Fallback: OpenCEP
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 4500)

    const response = await fetch(`https://opencep.com/v1/${digits}`, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
      cache: 'force-cache',
    })

    clearTimeout(timeout)

    if (response.ok) {
      const data = await response.json()
      if (data.localidade && data.uf) {
        return {
          success: true,
          data: {
            street: data.logradouro || '',
            neighborhood: data.bairro || '',
            city: data.localidade || '',
            state: (data.uf || '').toUpperCase(),
          },
        }
      }
    }
  } catch (err) {
    console.warn('[OpenCEP Fallback]', err)
  }

  return {
    success: false,
    error: 'Não foi possível localizar o endereço para este CEP. Preencha manualmente os campos abaixo.',
  }
}
