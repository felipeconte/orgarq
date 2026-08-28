'use client'

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'
import { AlertTriangle, Trash2, Info, CheckCircle2, X, Save } from 'lucide-react'

export type DialogVariant = 'danger' | 'warning' | 'info' | 'primary' | 'success' | 'error'

export interface ConfirmOptions {
  title?: string
  message: React.ReactNode
  description?: React.ReactNode
  confirmText?: string
  cancelText?: string
  variant?: DialogVariant
}

export interface AlertOptions {
  title?: string
  message: React.ReactNode
  description?: React.ReactNode
  confirmText?: string
  variant?: DialogVariant
}

export interface PromptSaveOrDiscardOptions {
  title?: string
  message?: React.ReactNode
  description?: React.ReactNode
  saveText?: string
  discardText?: string
  cancelText?: string
}

export type SaveOrDiscardResult = 'save' | 'discard' | 'cancel'

type ModalType = 'confirm' | 'alert' | 'save_or_discard'

interface DialogState {
  isOpen: boolean
  type: ModalType
  title: string
  message: React.ReactNode
  description?: React.ReactNode
  confirmText: string
  cancelText: string
  discardText?: string
  variant: DialogVariant
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions | string) => Promise<boolean>
  showAlert: (options: AlertOptions | string) => Promise<void>
  promptSaveOrDiscard: (options?: PromptSaveOrDiscardOptions) => Promise<SaveOrDiscardResult>
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined)

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [dialogState, setDialogState] = useState<DialogState>({
    isOpen: false,
    type: 'confirm',
    title: '',
    message: '',
    confirmText: 'Confirmar',
    cancelText: 'Cancelar',
    variant: 'danger',
  })

  const resolveConfirmRef = useRef<((value: boolean) => void) | null>(null)
  const resolveAlertRef = useRef<(() => void) | null>(null)
  const resolveSaveDiscardRef = useRef<((value: SaveOrDiscardResult) => void) | null>(null)
  const confirmBtnRef = useRef<HTMLButtonElement | null>(null)

  const confirm = useCallback((options: ConfirmOptions | string): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      resolveConfirmRef.current = resolve

      if (typeof options === 'string') {
        setDialogState({
          isOpen: true,
          type: 'confirm',
          title: 'Confirmação',
          message: options,
          confirmText: 'Confirmar',
          cancelText: 'Cancelar',
          variant: 'danger',
        })
      } else {
        setDialogState({
          isOpen: true,
          type: 'confirm',
          title: options.title || 'Confirmação',
          message: options.message,
          description: options.description,
          confirmText: options.confirmText || 'Confirmar',
          cancelText: options.cancelText || 'Cancelar',
          variant: options.variant || 'danger',
        })
      }
    })
  }, [])

  const showAlert = useCallback((options: AlertOptions | string): Promise<void> => {
    return new Promise<void>((resolve) => {
      resolveAlertRef.current = () => resolve()

      if (typeof options === 'string') {
        setDialogState({
          isOpen: true,
          type: 'alert',
          title: 'Atenção',
          message: options,
          confirmText: 'Entendi',
          cancelText: '',
          variant: 'info',
        })
      } else {
        setDialogState({
          isOpen: true,
          type: 'alert',
          title: options.title || 'Atenção',
          message: options.message,
          description: options.description,
          confirmText: options.confirmText || 'Entendi',
          cancelText: '',
          variant: options.variant || 'info',
        })
      }
    })
  }, [])

  const promptSaveOrDiscard = useCallback((options?: PromptSaveOrDiscardOptions): Promise<SaveOrDiscardResult> => {
    return new Promise<SaveOrDiscardResult>((resolve) => {
      resolveSaveDiscardRef.current = resolve
      setDialogState({
        isOpen: true,
        type: 'save_or_discard',
        title: options?.title || 'Alterações não salvas',
        message: options?.message || 'Você realizou alterações nesta tarefa que ainda não foram salvas.',
        description: options?.description || 'Deseja salvar as alterações antes de fechar?',
        confirmText: options?.saveText || 'Salvar e Sair',
        discardText: options?.discardText || 'Sair sem Salvar',
        cancelText: options?.cancelText || 'Continuar Editando',
        variant: 'primary',
      })
    })
  }, [])

  const handleConfirm = () => {
    setDialogState((prev) => ({ ...prev, isOpen: false }))
    if (dialogState.type === 'save_or_discard' && resolveSaveDiscardRef.current) {
      resolveSaveDiscardRef.current('save')
      resolveSaveDiscardRef.current = null
    } else if (dialogState.type === 'confirm' && resolveConfirmRef.current) {
      resolveConfirmRef.current(true)
      resolveConfirmRef.current = null
    } else if (dialogState.type === 'alert' && resolveAlertRef.current) {
      resolveAlertRef.current()
      resolveAlertRef.current = null
    }
  }

  const handleDiscard = () => {
    setDialogState((prev) => ({ ...prev, isOpen: false }))
    if (resolveSaveDiscardRef.current) {
      resolveSaveDiscardRef.current('discard')
      resolveSaveDiscardRef.current = null
    }
  }

  const handleCancel = () => {
    setDialogState((prev) => ({ ...prev, isOpen: false }))
    if (dialogState.type === 'save_or_discard' && resolveSaveDiscardRef.current) {
      resolveSaveDiscardRef.current('cancel')
      resolveSaveDiscardRef.current = null
    } else if (dialogState.type === 'confirm' && resolveConfirmRef.current) {
      resolveConfirmRef.current(false)
      resolveConfirmRef.current = null
    } else if (dialogState.type === 'alert' && resolveAlertRef.current) {
      resolveAlertRef.current()
      resolveAlertRef.current = null
    }
  }

  // Keyboard shortcut listener (Escape to cancel)
  useEffect(() => {
    if (!dialogState.isOpen) return

    const timer = setTimeout(() => {
      confirmBtnRef.current?.focus()
    }, 50)

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCancel()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [dialogState.isOpen])

  const getVariantStyles = (variant: DialogVariant, type: ModalType) => {
    if (type === 'save_or_discard') {
      return {
        icon: <Save className="w-6 h-6 text-blue-600" />,
        iconBg: 'bg-blue-50 border border-blue-200/70',
        confirmBtn: 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs shadow-blue-600/20 focus:ring-blue-500',
      }
    }

    switch (variant) {
      case 'danger':
      case 'error':
        return {
          icon: <Trash2 className="w-6 h-6 text-rose-600" />,
          iconBg: 'bg-rose-50 border border-rose-200/70',
          confirmBtn: 'bg-rose-600 hover:bg-rose-700 text-white shadow-xs shadow-rose-600/20 focus:ring-rose-500',
        }
      case 'warning':
        return {
          icon: <AlertTriangle className="w-6 h-6 text-amber-600" />,
          iconBg: 'bg-amber-50 border border-amber-200/70',
          confirmBtn: 'bg-amber-600 hover:bg-amber-700 text-white shadow-xs shadow-amber-600/20 focus:ring-amber-500',
        }
      case 'success':
        return {
          icon: <CheckCircle2 className="w-6 h-6 text-emerald-600" />,
          iconBg: 'bg-emerald-50 border border-emerald-200/70',
          confirmBtn: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs shadow-emerald-600/20 focus:ring-emerald-500',
        }
      case 'info':
      case 'primary':
      default:
        return {
          icon: <Info className="w-6 h-6 text-blue-600" />,
          iconBg: 'bg-blue-50 border border-blue-200/70',
          confirmBtn: 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs shadow-blue-600/20 focus:ring-blue-500',
        }
    }
  }

  const styles = getVariantStyles(dialogState.variant, dialogState.type)

  return (
    <ConfirmContext.Provider value={{ confirm, showAlert, promptSaveOrDiscard }}>
      {children}

      {dialogState.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            onClick={handleCancel}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
          />

          {/* Modal Card */}
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 overflow-hidden transform transition-all duration-200 animate-in zoom-in-95 slide-in-from-bottom-2">
            {/* Close X button */}
            <button
              type="button"
              onClick={handleCancel}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-start gap-4">
              {/* Icon badge */}
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${styles.iconBg}`}>
                {styles.icon}
              </div>

              {/* Text content */}
              <div className="flex-1 min-w-0 pt-0.5">
                <h3 className="text-base font-bold text-slate-900 leading-snug">
                  {dialogState.title}
                </h3>
                <div className="mt-1.5 text-xs text-slate-600 leading-relaxed whitespace-pre-line">
                  {dialogState.message}
                </div>
                {dialogState.description && (
                  <div className="mt-2 text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    {dialogState.description}
                  </div>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
              {dialogState.type === 'save_or_discard' && (
                <>
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-all cursor-pointer"
                  >
                    {dialogState.cancelText}
                  </button>

                  <button
                    type="button"
                    onClick={handleDiscard}
                    className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/70 text-xs font-bold transition-all cursor-pointer"
                  >
                    {dialogState.discardText}
                  </button>

                  <button
                    ref={confirmBtnRef}
                    type="button"
                    onClick={handleConfirm}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 cursor-pointer ${styles.confirmBtn}`}
                  >
                    {dialogState.confirmText}
                  </button>
                </>
              )}

              {dialogState.type === 'confirm' && (
                <>
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all cursor-pointer"
                  >
                    {dialogState.cancelText}
                  </button>

                  <button
                    ref={confirmBtnRef}
                    type="button"
                    onClick={handleConfirm}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 cursor-pointer ${styles.confirmBtn}`}
                  >
                    {dialogState.confirmText}
                  </button>
                </>
              )}

              {dialogState.type === 'alert' && (
                <button
                  ref={confirmBtnRef}
                  type="button"
                  onClick={handleConfirm}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 cursor-pointer ${styles.confirmBtn}`}
                >
                  {dialogState.confirmText}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const context = useContext(ConfirmContext)
  if (!context) {
    throw new Error('useConfirm deve ser utilizado dentro de um ConfirmProvider')
  }
  return context.confirm
}

export function useAlert() {
  const context = useContext(ConfirmContext)
  if (!context) {
    throw new Error('useAlert deve ser utilizado dentro de um ConfirmProvider')
  }
  return context.showAlert
}

export function usePromptSaveOrDiscard() {
  const context = useContext(ConfirmContext)
  if (!context) {
    throw new Error('usePromptSaveOrDiscard deve ser utilizado dentro de um ConfirmProvider')
  }
  return context.promptSaveOrDiscard
}
