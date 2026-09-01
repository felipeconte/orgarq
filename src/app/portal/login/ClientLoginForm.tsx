'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Building2,
  ArrowRight,
  Lock,
  UserCheck,
  Loader2,
  AlertCircle,
  Eye,
  EyeOff,
  ShieldCheck,
  ClipboardPaste,
} from 'lucide-react'
import { clientPortalLoginAction } from '@/lib/actions/client-portal-auth'
import { maskCPF } from '@/lib/formatters-and-validators'

function ClientLoginFormContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [cpf, setCpf] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    const paramCpf = searchParams.get('cpf')
    if (paramCpf) {
      setCpf(maskCPF(paramCpf))
    }
  }, [searchParams])

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const masked = maskCPF(e.target.value)
    setCpf(masked)
  }

  const handlePastePassword = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text) {
        setPassword(text.trim())
      }
    } catch {
      // Fallback normal caso o navegador restrinja leitura direta
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setErrorMessage(null)

    const formData = new FormData()
    formData.append('cpf', cpf)
    formData.append('password', password)

    const res = await clientPortalLoginAction(formData)

    if (res.success && res.redirectUrl) {
      router.push(res.redirectUrl)
      router.refresh()
    } else {
      setErrorMessage(res.error || 'Erro ao realizar login. Verifique seu CPF e senha.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center py-12 sm:px-6 lg:px-8 antialiased">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-3">
        <Link href="/" className="inline-flex items-center gap-2.5">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <Building2 className="w-6 h-6" />
          </div>
          <span className="text-2xl font-bold text-slate-900 tracking-tight">Orgarq</span>
        </Link>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200/80 text-blue-700 text-xs font-bold">
          <UserCheck className="w-3.5 h-3.5" /> Portal do Cliente
        </div>
        <h2 className="text-xl font-bold text-slate-800 tracking-tight">
          Acompanhe seu Projeto de Arquitetura
        </h2>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          Consulte o andamento da sua obra, aprove etapas e baixe pranchas e documentos
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white py-8 px-6 shadow-sm border border-slate-200/80 rounded-2xl sm:px-10 space-y-6">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Seu CPF
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <UserCheck className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  value={cpf}
                  onChange={handleCpfChange}
                  placeholder="000.000.000-00"
                  maxLength={14}
                  className="block w-full pl-10 pr-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all font-mono"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Senha de Acesso
                </label>
                <button
                  type="button"
                  onClick={handlePastePassword}
                  className="text-[11px] font-bold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1 cursor-pointer hover:underline"
                  title="Colar senha copiada da área de transferência"
                >
                  <ClipboardPaste className="w-3.5 h-3.5" /> Colar Senha
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Informe a senha recebida por e-mail"
                  className="block w-full pl-10 pr-10 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-xs font-mono font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                ℹ️ Sua senha foi enviada para o seu e-mail pelo escritório de arquitetura responsável.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || !cpf || !password}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shadow-sm shadow-blue-500/25 transition-all disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Verificando...
                </>
              ) : (
                <>
                  Acessar Meus Projetos <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          <div className="pt-4 border-t border-slate-100 flex flex-col items-center gap-3">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Ambiente seguro com criptografia de ponta a ponta
            </div>

            <p className="text-xs text-slate-500">
              É arquiteto ou membro da equipe?{' '}
              <Link href="/login" className="font-bold text-blue-600 hover:text-blue-700">
                Acessar Área do Escritório
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ClientLoginForm() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>}>
      <ClientLoginFormContent />
    </Suspense>
  )
}
