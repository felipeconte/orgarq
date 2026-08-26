import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get('q')?.trim()
  const lat = searchParams.get('lat')
  const lon = searchParams.get('lon') || searchParams.get('lng')
  const isIpLookup = searchParams.get('ip') === '1' || searchParams.get('ip') === 'true'

  // 1. Caso seja busca de localização por IP da rede (fallback de alta fidelidade para desktop)
  if (isIpLookup) {
    try {
      let userLat: number | null = null
      let userLon: number | null = null
      let city = ''
      let state = ''

      // Tenta via ip-api
      try {
        const ipRes = await fetch('http://ip-api.com/json', {
          headers: { 'User-Agent': 'OrgarqSaaS/1.0' },
          next: { revalidate: 3600 },
        })
        if (ipRes.ok) {
          const ipData = await ipRes.json()
          if (ipData.status === 'success' && ipData.lat && ipData.lon) {
            userLat = ipData.lat
            userLon = ipData.lon
            city = ipData.city || ''
            state = ipData.regionName || ipData.region || ''
          }
        }
      } catch (err) {
        console.warn('ip-api falhou, tentando ipapi.co:', err)
      }

      // Fallback para ipapi.co
      if (!userLat || !userLon) {
        try {
          const ipCoRes = await fetch('https://ipapi.co/json/', {
            headers: { 'User-Agent': 'OrgarqSaaS/1.0' },
            next: { revalidate: 3600 },
          })
          if (ipCoRes.ok) {
            const ipCoData = await ipCoRes.json()
            if (ipCoData.latitude && ipCoData.longitude) {
              userLat = ipCoData.latitude
              userLon = ipCoData.longitude
              city = ipCoData.city || ''
              state = ipCoData.region || ''
            }
          }
        } catch (err) {
          console.warn('ipapi.co falhou:', err)
        }
      }

      // Se obteve as coordenadas de IP, faz o reverse geocoding para enriquecer os dados
      if (userLat !== null && userLon !== null) {
        try {
          const revUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${userLat}&lon=${userLon}&addressdetails=1&accept-language=pt-BR,en`
          const revRes = await fetch(revUrl, {
            headers: {
              'User-Agent': 'OrgarqSaaS/1.0 (contact@orgarq.com.br; https://orgarq.com.br)',
              'Accept-Language': 'pt-BR,en',
            },
            next: { revalidate: 3600 },
          })

          if (revRes.ok) {
            const revData = await revRes.json()
            if (revData && revData.address) {
              return NextResponse.json({
                place_id: revData.place_id,
                display_name: revData.display_name,
                lat: revData.lat || userLat.toString(),
                lon: revData.lon || userLon.toString(),
                address: {
                  road: revData.address.road || revData.address.pedestrian || revData.address.street || '',
                  house_number: revData.address.house_number || '',
                  suburb:
                    revData.address.suburb ||
                    revData.address.neighbourhood ||
                    revData.address.city_district ||
                    '',
                  city: revData.address.city || revData.address.town || city,
                  state: revData.address.state || state,
                  postcode: revData.address.postcode || '',
                  country: revData.address.country || 'Brasil',
                },
              })
            }
          }
        } catch {
          // Ignora erro no reverse e retorna dados do IP
        }

        return NextResponse.json({
          place_id: 1,
          display_name: `${city}, ${state}`,
          lat: userLat.toString(),
          lon: userLon.toString(),
          address: {
            road: '',
            house_number: '',
            suburb: '',
            city,
            state,
            postcode: '',
            country: 'Brasil',
          },
        })
      }

      return NextResponse.json(null)
    } catch (error) {
      console.error('Erro na rota de IP Geocoding:', error)
      return NextResponse.json(null)
    }
  }

  // 2. Caso seja Reverse Geocoding (quando o usuário clica ou arrasta o pin no mapa)
  if (lat && lon) {
    try {
      const reverseUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(
        lat
      )}&lon=${encodeURIComponent(lon)}&addressdetails=1&accept-language=pt-BR,en`

      const response = await fetch(reverseUrl, {
        headers: {
          'User-Agent': 'OrgarqSaaS/1.0 (contact@orgarq.com.br; https://orgarq.com.br)',
          'Accept-Language': 'pt-BR,en',
        },
        next: { revalidate: 3600 },
      })

      if (response.ok) {
        const data = await response.json()
        if (data && data.address) {
          return NextResponse.json({
            place_id: data.place_id,
            display_name: data.display_name,
            lat: data.lat,
            lon: data.lon,
            address: {
              road: data.address.road || data.address.pedestrian || data.address.street || '',
              house_number: data.address.house_number || data.address.house_name || '',
              suburb:
                data.address.suburb ||
                data.address.neighbourhood ||
                data.address.city_district ||
                data.address.quarter ||
                '',
              city:
                data.address.city ||
                data.address.town ||
                data.address.municipality ||
                data.address.village ||
                '',
              state: data.address.state || '',
              postcode: data.address.postcode || '',
              country: data.address.country || '',
            },
          })
        }
      }

      // Fallback para Photon Reverse
      const photonRevUrl = `https://photon.komoot.io/reverse?lat=${encodeURIComponent(
        lat
      )}&lon=${encodeURIComponent(lon)}`
      const photonRes = await fetch(photonRevUrl, {
        headers: { 'User-Agent': 'OrgarqSaaS/1.0' },
      })

      if (photonRes.ok) {
        const photonData = await photonRes.json()
        if (photonData.features && photonData.features.length > 0) {
          const feature = photonData.features[0]
          const props = feature.properties || {}
          const coords = feature.geometry?.coordinates || [lon, lat]
          return NextResponse.json({
            place_id: props.osm_id || 1,
            display_name:
              [props.name || props.street, props.district || props.suburb, props.city, props.state]
                .filter(Boolean)
                .join(', ') || 'Localização Selecionada',
            lat: coords[1]?.toString() || lat,
            lon: coords[0]?.toString() || lon,
            address: {
              road: props.street || props.name || '',
              house_number: props.housenumber || '',
              suburb: props.district || props.suburb || '',
              city: props.city || '',
              state: props.state || '',
              postcode: props.postcode || '',
              country: props.country || '',
            },
          })
        }
      }

      return NextResponse.json(null)
    } catch (error) {
      console.error('Erro no reverse geocoding:', error)
      return NextResponse.json(null)
    }
  }

  // 3. Caso seja busca textual por endereço
  if (!query || query.length < 3) {
    return NextResponse.json([])
  }

  try {
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      query
    )}&addressdetails=1&limit=6&accept-language=pt-BR,en`

    const response = await fetch(nominatimUrl, {
      headers: {
        'User-Agent': 'OrgarqSaaS/1.0 (contact@orgarq.com.br; https://orgarq.com.br)',
        'Accept-Language': 'pt-BR,en',
      },
      next: { revalidate: 3600 },
    })

    if (response.ok) {
      const data = await response.json()
      if (Array.isArray(data) && data.length > 0) {
        return NextResponse.json(data)
      }
    }

    // Fallback: Photon (Komoot)
    const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=6&lang=default`
    const photonRes = await fetch(photonUrl, {
      headers: {
        'User-Agent': 'OrgarqSaaS/1.0',
      },
    })

    if (photonRes.ok) {
      const photonData = await photonRes.json()
      if (photonData.features && Array.isArray(photonData.features)) {
        const mapped = photonData.features.map((f: any, idx: number) => {
          const props = f.properties || {}
          const coords = f.geometry?.coordinates || [0, 0]
          const displayParts = [
            props.name || props.street,
            props.district || props.suburb,
            props.city,
            props.state,
            props.country,
          ].filter(Boolean)

          return {
            place_id: props.osm_id || idx + 1000,
            display_name: displayParts.join(', ') || query,
            lat: coords[1]?.toString() || '0',
            lon: coords[0]?.toString() || '0',
            address: {
              road: props.street || props.name || '',
              house_number: props.housenumber || '',
              suburb: props.district || props.suburb || '',
              city: props.city || '',
              state: props.state || '',
              postcode: props.postcode || '',
              country: props.country || '',
            },
          }
        })
        return NextResponse.json(mapped)
      }
    }

    return NextResponse.json([])
  } catch (error) {
    console.error('Erro na rota de geocoding:', error)
    return NextResponse.json([])
  }
}
