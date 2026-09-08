'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

interface BackButtonProps {
  fallbackHref?: string
  className?: string
  iconSize?: string
  label?: string
}

export default function BackButton({
  fallbackHref = '/app',
  className = 'p-2 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-blue-600 hover:bg-slate-50 transition-all shadow-2xs cursor-pointer inline-flex items-center justify-center',
  iconSize = 'w-4 h-4',
  label
}: BackButtonProps) {
  const router = useRouter()

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
    } else if (fallbackHref) {
      router.push(fallbackHref)
    }
  }

  return (
    <button
      type="button"
      onClick={handleBack}
      className={className}
      title="Voltar à tela anterior"
      aria-label="Voltar"
    >
      <ArrowLeft className={iconSize} />
      {label && <span className="ml-1.5">{label}</span>}
    </button>
  )
}
