'use client'

import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import { MapPin, Navigation, ExternalLink, Locate, Loader2, AlertCircle, X } from 'lucide-react'

interface ProjectLocationMapProps {
  lat: number | null
  lng: number | null
  addressTitle?: string
  onLocationChange?: (lat: number, lng: number) => void
}

// Coordenadas padrão de Belém - Pará
const BELEM_LAT = -1.4558
const BELEM_LNG = -48.4902

export default function ProjectLocationMap({
  lat,
  lng,
  addressTitle,
  onLocationChange,
}: ProjectLocationMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const [isLocating, setIsLocating] = useState(false)
  const [approximateNotice, setApproximateNotice] = useState<string | null>(null)

  const initialLat = lat ?? BELEM_LAT
  const initialLng = lng ?? BELEM_LNG
  const hasCoordinates = lat !== null && lng !== null

  // Fallback Nível 2 via IP Geolocation caso o GPS não responda ou não esteja disponível
  const fetchLocationByIp = async () => {
    try {
      const res = await fetch('/api/geocode?ip=1')
      if (res.ok) {
        const data = await res.json()
        if (data && data.lat && data.lon) {
          const parsedLat = parseFloat(data.lat)
          const parsedLng = parseFloat(data.lon)
          if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
            if (mapInstanceRef.current) {
              mapInstanceRef.current.setView([parsedLat, parsedLng], 16, { animate: true })
            }
            onLocationChange?.(parsedLat, parsedLng)
            setApproximateNotice(
              'Não foi possível obter a sua localização exata por GPS. Definimos a localização aproximada pela sua rede — clique no mapa ou arraste o pin para ajustar a posição precisa do lote.'
            )
            return true
          }
        }
      }
    } catch (err) {
      console.error('Erro ao buscar localização por IP:', err)
    }
    return false
  }

  // Função para solicitar e obter a localização do usuário com fallback garantido
  const handleRequestUserLocation = async () => {
    setIsLocating(true)
    setApproximateNotice(null)

    // 1. Nível 1: Tenta obter pelo GPS/Navegador com alta prioridade
    if (typeof window !== 'undefined' && navigator?.geolocation) {
      let resolved = false

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolved = true
          setIsLocating(false)
          setApproximateNotice(null)
          if (pos?.coords) {
            const userLat = pos.coords.latitude
            const userLng = pos.coords.longitude
            if (mapInstanceRef.current) {
              mapInstanceRef.current.setView([userLat, userLng], 16, { animate: true })
            }
            onLocationChange?.(userLat, userLng)
          }
        },
        async () => {
          // 2. Nível 2: Se o GPS falhar, recusar ou der timeout, executa o fallback com aviso
          if (!resolved) {
            await fetchLocationByIp()
            setIsLocating(false)
          }
        },
        { timeout: 4000, enableHighAccuracy: false }
      )
    } else {
      // Navegador sem API de geolocalização: busca direta por IP com aviso
      await fetchLocationByIp()
      setIsLocating(false)
    }
  }

  useEffect(() => {
    if (!mapContainerRef.current) return

    let resizeObserver: ResizeObserver | null = null

    // Evita recriar se o mapa já estiver instanciado no mesmo container
    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [initialLat, initialLng],
        zoom: hasCoordinates ? 16 : 13,
        scrollWheelZoom: true,
        attributionControl: true,
      })

      // Tile layer servida através do proxy interno /api/tiles (100% first-party)
      L.tileLayer('/api/tiles/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map)

      // Ícone customizado elegante para o pin do projeto
      const customPinHtml = `
        <div style="transform: translate(-50%, -100%); position: relative; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;">
          <div style="width: 36px; height: 36px; background-color: #2563eb; border-radius: 9999px; box-shadow: 0 10px 15px -3px rgba(37,99,235,0.4); display: flex; align-items: center; justify-content: center; color: white; border: 2px solid white;">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
          </div>
          <div style="position: absolute; bottom: -2px; width: 10px; height: 4px; background-color: rgba(15,23,42,0.3); border-radius: 9999px; filter: blur(1px);"></div>
        </div>
      `

      const customIcon = L.divIcon({
        html: customPinHtml,
        className: 'custom-map-pin',
        iconSize: [36, 36],
        iconAnchor: [18, 36],
      })

      if (hasCoordinates) {
        const marker = L.marker([initialLat, initialLng], {
          icon: customIcon,
          draggable: true,
        }).addTo(map)

        if (addressTitle) {
          marker.bindPopup(`<strong style="font-size: 12px;">${addressTitle}</strong>`)
        }

        marker.on('dragend', () => {
          const pos = marker.getLatLng()
          onLocationChange?.(pos.lat, pos.lng)
        })

        markerRef.current = marker
      }

      // Permite clicar no mapa para reposicionar o pin e disparar reverse geocoding
      map.on('click', (e: L.LeafletMouseEvent) => {
        const { lat: clickLat, lng: clickLng } = e.latlng
        onLocationChange?.(clickLat, clickLng)

        if (markerRef.current) {
          markerRef.current.setLatLng([clickLat, clickLng])
        } else {
          const marker = L.marker([clickLat, clickLng], {
            icon: customIcon,
            draggable: true,
          }).addTo(map)

          marker.on('dragend', () => {
            const pos = marker.getLatLng()
            onLocationChange?.(pos.lat, pos.lng)
          })

          markerRef.current = marker
        }
      })

      mapInstanceRef.current = map

      // Tenta obter a localização inicial de forma silenciosa se não tiver coordenadas
      if (!hasCoordinates && typeof navigator !== 'undefined' && navigator.geolocation) {
        try {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              if (pos?.coords) {
                const userLat = pos.coords.latitude
                const userLng = pos.coords.longitude
                if (mapInstanceRef.current && lat === null && lng === null) {
                  mapInstanceRef.current.setView([userLat, userLng], 15, { animate: true })
                }
              }
            },
            () => {
              // Mantém Belém-PA como padrão
            },
            { timeout: 4000, enableHighAccuracy: false }
          )
        } catch {
          // Mantém Belém-PA
        }
      }

      // ResizeObserver garante recálculo instantâneo
      if (typeof ResizeObserver !== 'undefined' && mapContainerRef.current) {
        resizeObserver = new ResizeObserver(() => {
          map.invalidateSize()
        })
        resizeObserver.observe(mapContainerRef.current)
      }

      setTimeout(() => {
        map.invalidateSize()
      }, 200)
    }

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect()
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
        markerRef.current = null
      }
    }
  }, [])

  // Atualiza a posição do marcador e visualização quando lat/lng mudarem externamente
  useEffect(() => {
    if (!mapInstanceRef.current || lat === null || lng === null) return

    const map = mapInstanceRef.current
    map.invalidateSize()
    map.setView([lat, lng], 16, { animate: true })

    const customPinHtml = `
      <div style="transform: translate(-50%, -100%); position: relative; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;">
        <div style="width: 36px; height: 36px; background-color: #2563eb; border-radius: 9999px; box-shadow: 0 10px 15px -3px rgba(37,99,235,0.4); display: flex; align-items: center; justify-content: center; color: white; border: 2px solid white;">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
        </div>
        <div style="position: absolute; bottom: -2px; width: 10px; height: 4px; background-color: rgba(15,23,42,0.3); border-radius: 9999px; filter: blur(1px);"></div>
      </div>
    `

    const customIcon = L.divIcon({
      html: customPinHtml,
      className: 'custom-map-pin',
      iconSize: [36, 36],
      iconAnchor: [18, 36],
    })

    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng])
      if (addressTitle) {
        markerRef.current.bindPopup(`<strong style="font-size: 12px;">${addressTitle}</strong>`)
      }
    } else {
      const marker = L.marker([lat, lng], {
        icon: customIcon,
        draggable: true,
      }).addTo(map)

      marker.on('dragend', () => {
        const pos = marker.getLatLng()
        onLocationChange?.(pos.lat, pos.lng)
      })

      markerRef.current = marker
    }

    setTimeout(() => {
      map.invalidateSize()
    }, 150)
  }, [lat, lng, addressTitle, onLocationChange])

  return (
    <div className="space-y-2">
      {/* Aviso de Localização Aproximada (Fallback Nível 2) */}
      {approximateNotice && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start justify-between gap-2.5 shadow-xs animate-fadeIn">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong className="font-semibold block text-amber-950">Aviso de Localização</strong>
              <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                {approximateNotice}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setApproximateNotice(null)}
            className="text-amber-500 hover:text-amber-800 p-0.5 rounded-md hover:bg-amber-100/60 transition-colors shrink-0"
            title="Fechar aviso"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
          <MapPin className="w-3.5 h-3.5 text-blue-600" />
          <span>Localização Exata no Mapa (OpenStreetMap)</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Botão de Localização Atual */}
          <button
            type="button"
            onClick={handleRequestUserLocation}
            disabled={isLocating}
            title="Localizar minha posição atual"
            className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1.5 border border-blue-200 cursor-pointer shadow-xs active:scale-95"
          >
            {isLocating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
            ) : (
              <Locate className="w-3.5 h-3.5 text-blue-600" />
            )}
            <span>{isLocating ? 'Localizando...' : 'Minha Localização'}</span>
          </button>

          {hasCoordinates && (
            <>
              <span className="font-mono text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                <Navigation className="w-3 h-3 text-blue-600" />
                {lat.toFixed(5)}, {lng.toFixed(5)}
              </span>
              <a
                href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-0.5"
              >
                Abrir Mapa <ExternalLink className="w-3 h-3" />
              </a>
            </>
          )}
        </div>
      </div>

      <div
        className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-xs bg-slate-100 z-0"
        style={{ width: '100%', height: '280px', minHeight: '280px' }}
      >
        <div
          ref={mapContainerRef}
          style={{ width: '100%', height: '100%', minHeight: '280px' }}
        />

        {!hasCoordinates && (
          <div className="absolute inset-0 bg-slate-900/10 backdrop-blur-[1px] flex items-center justify-center pointer-events-none z-10">
            <div className="bg-white/95 px-4 py-2 rounded-xl shadow-md border border-slate-200 text-xs font-medium text-slate-700 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-600 animate-pulse" />
              Busque um endereço ou clique no mapa para fixar o pin do lote
            </div>
          </div>
        )}
      </div>

      <p className="text-[11px] text-slate-400">
        💡 Dica: Você pode clicar em qualquer ponto do mapa ou arrastar o pin para preencher os dados de endereço do lote automaticamente.
      </p>
    </div>
  )
}
