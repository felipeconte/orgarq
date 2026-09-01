import { lookupCepAction } from '@/lib/actions/cep'

/**
 * Utilitários de Máscaras e Validações Brasileiras para Clientes (CPF, CNPJ, Telefone, CEP, E-mail)
 */

// ==========================================
// 1. MÁSCARAS
// ==========================================

export function cleanDigits(value: string | null | undefined): string {
  if (!value) return ''
  return value.replace(/\D/g, '')
}

export function maskCPF(value: string): string {
  const digits = cleanDigits(value).slice(0, 11)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`
}

export function maskCNPJ(value: string): string {
  const digits = cleanDigits(value).slice(0, 14)
  if (digits.length <= 2) return digits
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`
  if (digits.length <= 12)
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`
}

export function maskCPFOrCNPJ(value: string, personType?: 'PF' | 'PJ'): string {
  const digits = cleanDigits(value)
  if (personType === 'PF') return maskCPF(digits)
  if (personType === 'PJ') return maskCNPJ(digits)
  return digits.length > 11 ? maskCNPJ(digits) : maskCPF(digits)
}

export function maskPhone(value: string): string {
  const digits = cleanDigits(value).slice(0, 11)
  if (digits.length === 0) return ''
  if (digits.length <= 2) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`
}

export function maskCEP(value: string): string {
  const digits = cleanDigits(value).slice(0, 8)
  if (digits.length <= 5) return digits
  return `${digits.slice(0, 5)}-${digits.slice(5, 8)}`
}

// ==========================================
// 2. VALIDAÇÕES DE REGRAS DE NEGÓCIO
// ==========================================

export function validateCPF(cpf: string): boolean {
  const digits = cleanDigits(cpf)
  if (digits.length !== 11) return false

  // Elimina CPFs inválidos conhecidos (todos dígitos iguais)
  if (/^(\d)\1{10}$/.test(digits)) return false

  // Validação do 1º dígito verificador
  let sum = 0
  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits.charAt(i)) * (10 - i)
  }
  let rev = 11 - (sum % 11)
  if (rev === 10 || rev === 11) rev = 0
  if (rev !== parseInt(digits.charAt(9))) return false

  // Validação do 2º dígito verificador
  sum = 0
  for (let i = 0; i < 10; i++) {
    sum += parseInt(digits.charAt(i)) * (11 - i)
  }
  rev = 11 - (sum % 11)
  if (rev === 10 || rev === 11) rev = 0
  if (rev !== parseInt(digits.charAt(10))) return false

  return true
}

export function validateCNPJ(cnpj: string): boolean {
  const digits = cleanDigits(cnpj)
  if (digits.length !== 14) return false

  // Elimina CNPJs inválidos conhecidos
  if (/^(\d)\1{13}$/.test(digits)) return false

  // Validação do 1º dígito verificador
  let size = digits.length - 2
  let numbers = digits.substring(0, size)
  const digitsCheck = digits.substring(size)
  let sum = 0
  let pos = size - 7

  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i)) * pos--
    if (pos < 2) pos = 9
  }

  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11)
  if (result !== parseInt(digitsCheck.charAt(0))) return false

  // Validação do 2º dígito verificador
  size = size + 1
  numbers = digits.substring(0, size)
  sum = 0
  pos = size - 7

  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i)) * pos--
    if (pos < 2) pos = 9
  }

  result = sum % 11 < 2 ? 0 : 11 - (sum % 11)
  if (result !== parseInt(digitsCheck.charAt(1))) return false

  return true
}

export function validateDocument(document: string, personType: 'PF' | 'PJ'): { valid: boolean; message?: string } {
  const digits = cleanDigits(document)
  if (!digits) {
    return { valid: true } // Opcional se vazio
  }

  if (personType === 'PF') {
    if (digits.length !== 11) {
      return { valid: false, message: 'CPF deve conter 11 dígitos.' }
    }
    if (!validateCPF(digits)) {
      return { valid: false, message: 'CPF inválido. Verifique os números.' }
    }
    return { valid: true }
  } else {
    if (digits.length !== 14) {
      return { valid: false, message: 'CNPJ deve conter 14 dígitos.' }
    }
    if (!validateCNPJ(digits)) {
      return { valid: false, message: 'CNPJ inválido. Verifique os números.' }
    }
    return { valid: true }
  }
}

export function validateEmail(email: string): boolean {
  if (!email || !email.trim()) return true // Opcional se vazio
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

export function validatePhone(phone: string): boolean {
  const digits = cleanDigits(phone)
  if (!digits) return true // Opcional se vazio
  if (digits.length < 10 || digits.length > 11) return false
  const ddd = parseInt(digits.slice(0, 2))
  return ddd >= 11 && ddd <= 99
}

export function validateCEP(cep: string): boolean {
  const digits = cleanDigits(cep)
  if (!digits) return true
  return digits.length === 8
}

// ==========================================
// 3. CONSULTA VIA CEP
// ==========================================

export interface ViaCepResult {
  cep: string
  logradouro: string
  complemento: string
  bairro: string
  localidade: string // Cidade
  uf: string
  erro?: boolean
}

export async function fetchAddressByCEP(cep: string): Promise<{
  success: boolean
  data?: {
    street: string
    neighborhood: string
    city: string
    state: string
  }
  error?: string
}> {
  return lookupCepAction(cep)
}

export const ESTADOS_BRASIL = [
  { sigla: 'AC', nome: 'Acre' },
  { sigla: 'AL', nome: 'Alagoas' },
  { sigla: 'AP', nome: 'Amapá' },
  { sigla: 'AM', nome: 'Amazonas' },
  { sigla: 'BA', nome: 'Bahia' },
  { sigla: 'CE', nome: 'Ceará' },
  { sigla: 'DF', nome: 'Distrito Federal' },
  { sigla: 'ES', nome: 'Espírito Santo' },
  { sigla: 'GO', nome: 'Goiás' },
  { sigla: 'MA', nome: 'Maranhão' },
  { sigla: 'MT', nome: 'Mato Grosso' },
  { sigla: 'MS', nome: 'Mato Grosso do Sul' },
  { sigla: 'MG', nome: 'Minas Gerais' },
  { sigla: 'PA', nome: 'Pará' },
  { sigla: 'PB', nome: 'Paraíba' },
  { sigla: 'PR', nome: 'Paraná' },
  { sigla: 'PE', nome: 'Pernambuco' },
  { sigla: 'PI', nome: 'Piauí' },
  { sigla: 'RJ', nome: 'Rio de Janeiro' },
  { sigla: 'RN', nome: 'Rio Grande do Norte' },
  { sigla: 'RS', nome: 'Rio Grande do Sul' },
  { sigla: 'RO', nome: 'Rondônia' },
  { sigla: 'RR', nome: 'Roraima' },
  { sigla: 'SC', nome: 'Santa Catarina' },
  { sigla: 'SP', nome: 'São Paulo' },
  { sigla: 'SE', nome: 'Sergipe' },
  { sigla: 'TO', nome: 'Tocantins' },
]
