import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ z: string; x: string; y: string }> }
) {
  const { z, x, y } = await params
  const cleanY = y.replace(/\.png$/i, '')

  try {
    // 1. Tenta buscar direto no OpenStreetMap oficial com User-Agent do servidor
    const osmUrl = `https://tile.openstreetmap.org/${z}/${x}/${cleanY}.png`
    let response = await fetch(osmUrl, {
      headers: {
        'User-Agent': 'OrgarqSaaS/1.0 (contact@orgarq.com.br; https://orgarq.com.br)',
      },
      next: { revalidate: 604800 }, // Cache por 7 dias
    })

    // 2. Fallback: Se o OSM falhar, busca no CartoDB Voyager
    if (!response.ok) {
      const cartoUrl = `https://a.basemaps.cartocdn.com/rastertiles/voyager/${z}/${x}/${cleanY}.png`
      response = await fetch(cartoUrl, {
        headers: {
          'User-Agent': 'OrgarqSaaS/1.0',
        },
        next: { revalidate: 604800 },
      })
    }

    if (!response.ok) {
      return new NextResponse(null, { status: 404 })
    }

    const imageBuffer = await response.arrayBuffer()

    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=604800, immutable',
      },
    })
  } catch (error) {
    console.error('Erro ao servir tile do mapa:', error)
    return new NextResponse(null, { status: 500 })
  }
}
