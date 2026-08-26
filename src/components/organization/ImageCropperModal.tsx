'use client'

import { useState, useRef, useEffect } from 'react'
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Check,
  Building2,
  UploadCloud,
  Eye
} from 'lucide-react'

interface ImageCropperModalProps {
  imageSrc: string
  onCropComplete: (croppedDataUrl: string) => void
  onCancel: () => void
}

export default function ImageCropperModal({
  imageSrc,
  onCropComplete,
  onCancel,
}: ImageCropperModalProps) {
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const imageRef = useRef<HTMLImageElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null)

  // Load image
  useEffect(() => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = imageSrc
    img.onload = () => {
      imageRef.current = img
      setZoom(1)
      setOffset({ x: 0, y: 0 })
      renderCanvas()
    }
  }, [imageSrc])

  // Re-render when zoom or offset changes
  useEffect(() => {
    if (imageRef.current) {
      renderCanvas()
    }
  }, [zoom, offset])

  const renderCanvas = () => {
    const img = imageRef.current
    if (!img) return

    // Render Preview
    const previewCanvas = previewCanvasRef.current || document.createElement('canvas')
    previewCanvas.width = 256
    previewCanvas.height = 256
    const ctx = previewCanvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, 256, 256)

    // Calculate scaling to fill square viewport
    const aspect = img.width / img.height
    let drawWidth = 256 * zoom
    let drawHeight = 256 * zoom

    if (aspect > 1) {
      drawWidth = 256 * aspect * zoom
    } else {
      drawHeight = (256 / aspect) * zoom
    }

    const drawX = (256 - drawWidth) / 2 + offset.x
    const drawY = (256 - drawHeight) / 2 + offset.y

    ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight)

    try {
      const dataUrl = previewCanvas.toDataURL('image/png', 0.9)
      setPreviewUrl(dataUrl)
    } catch {
      // ignore
    }
  }

  // Handle Drag / Pan
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return
    setOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleConfirm = () => {
    const img = imageRef.current
    if (!img) return

    const outputCanvas = document.createElement('canvas')
    outputCanvas.width = 256
    outputCanvas.height = 256
    const ctx = outputCanvas.getContext('2d')
    if (!ctx) return

    const aspect = img.width / img.height
    let drawWidth = 256 * zoom
    let drawHeight = 256 * zoom

    if (aspect > 1) {
      drawWidth = 256 * aspect * zoom
    } else {
      drawHeight = (256 / aspect) * zoom
    }

    const drawX = (256 - drawWidth) / 2 + offset.x
    const drawY = (256 - drawHeight) / 2 + offset.y

    ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight)
    const finalDataUrl = outputCanvas.toDataURL('image/png', 0.95)

    onCropComplete(finalDataUrl)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={onCancel} />
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl z-10 space-y-5 border border-slate-200 animate-in zoom-in-95">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900">Ajustar Logomarca do Escritório</h3>
            <p className="text-xs text-slate-500">Arraste e use o zoom para centralizar o ícone perfeitamente.</p>
          </div>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cropper Viewport */}
        <div className="flex flex-col items-center gap-4">
          <div
            className="relative w-64 h-64 bg-slate-900 rounded-2xl overflow-hidden cursor-grab active:cursor-grabbing select-none border-2 border-dashed border-blue-500 shadow-inner flex items-center justify-center"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {imageSrc && (
              <img
                ref={imageRef}
                src={imageSrc}
                alt="Para cortar"
                className="max-w-none pointer-events-none transition-transform duration-75"
                style={{
                  transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                }}
              />
            )}

            {/* Circular / Square Guide Overlay */}
            <div className="absolute inset-0 pointer-events-none rounded-2xl border-2 border-white/60 shadow-[0_0_0_9999px_rgba(15,23,42,0.6)]" />
          </div>

          {/* Controls: Zoom Slider */}
          <div className="w-full space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-200/80">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
              <span className="flex items-center gap-1">
                <ZoomOut className="w-3.5 h-3.5 text-slate-400" /> Zoom
              </span>
              <span className="font-mono text-[11px] text-blue-600 font-bold">{Math.round(zoom * 100)}%</span>
            </div>
            <div className="flex items-center gap-3">
              <ZoomOut className="w-4 h-4 text-slate-400" />
              <input
                type="range"
                min={0.5}
                max={3}
                step={0.05}
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="w-full accent-blue-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
              />
              <ZoomIn className="w-4 h-4 text-slate-400" />
            </div>
          </div>

          {/* Live Preview Display */}
          {previewUrl && (
            <div className="w-full flex items-center justify-center gap-6 py-2 px-4 bg-slate-50/60 rounded-xl border border-slate-100">
              <div className="text-center space-y-1">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Sidebar (36px)</span>
                <div className="w-9 h-9 rounded-xl overflow-hidden border border-slate-200 shadow-2xs mx-auto bg-white flex items-center justify-center">
                  <img src={previewUrl} alt="Preview 36px" className="w-full h-full object-cover" />
                </div>
              </div>

              <div className="text-center space-y-1">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Portal (56px)</span>
                <div className="w-14 h-14 rounded-2xl overflow-hidden border border-slate-200 shadow-xs mx-auto bg-white flex items-center justify-center">
                  <img src={previewUrl} alt="Preview 56px" className="w-full h-full object-cover" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between items-center pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={() => {
              setZoom(1)
              setOffset({ x: 0, y: 0 })
            }}
            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 font-semibold"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Resetar
          </button>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <Check className="w-4 h-4" /> Aplicar Logomarca
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
