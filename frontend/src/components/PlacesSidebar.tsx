"use client"

import { useState, useEffect } from "react"
import { useMap, useMapsLibrary } from "@vis.gl/react-google-maps"
import { ArrowLeft, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Place } from "./PlacesMap"

function thumbUrl(ref: string) {
  return `/api/photo?ref=${encodeURIComponent(ref)}&maxwidth=160`
}

function largePhotoUrl(ref: string) {
  return `/api/photo?ref=${encodeURIComponent(ref)}&maxwidth=800`
}

function PhotoCarousel({ photos }: { photos: string[] }) {
  const [index, setIndex] = useState(0)

  useEffect(() => { setIndex(0) }, [photos])

  if (!photos.length) return null

  const prev = () => setIndex(i => (i - 1 + photos.length) % photos.length)
  const next = () => setIndex(i => (i + 1) % photos.length)

  return (
    <div className="relative w-full overflow-hidden rounded-t-2xl">
      <img
        key={photos[index]}
        src={photos[index]}
        className="w-full h-52 object-cover"
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
      />
      {photos.length > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={next}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
            {photos.map((_, i) => (
              <div
                key={i}
                className={cn("w-1.5 h-1.5 rounded-full transition-colors",
                  i === index ? "bg-white" : "bg-white/40"
                )}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

interface PlacesSidebarProps {
  places: Place[]
  selected: Place | null
  onSelect: (place: Place | null) => void
}

export function PlacesSidebar({ places, selected, onSelect }: PlacesSidebarProps) {
  if (!places.length) return null

  return (
    <div className="flex flex-col max-h-[620px] overflow-hidden rounded-2xl border-2 border-border bg-background shadow-2xl ring-1 ring-black/5">
      {selected ? (
        <PlaceDetail place={selected} onBack={() => onSelect(null)} />
      ) : (
        <PlaceList places={places} onSelect={onSelect} />
      )}
    </div>
  )
}

function PlaceList({ places, onSelect }: { places: Place[]; onSelect: (p: Place) => void }) {
  return (
    <div className="overflow-y-auto flex-1 py-1">
      {places.map((place, i) => (
        <div key={place.place_id}>
          <button
            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/60 transition-colors"
            onClick={() => onSelect(place)}
          >
            <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-muted">
              {place.photo_references?.[0] ? (
                <img
                  src={thumbUrl(place.photo_references[0])}
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
                />
              ) : (
                <div className="w-full h-full bg-muted" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-foreground leading-tight">{place.name}</p>
              {place.vicinity && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{place.vicinity}</p>
              )}
              {place.rating && (
                <div className="flex items-center gap-1 mt-1.5">
                  <span className="text-xs font-medium text-foreground">{place.rating}</span>
                  <span className="text-xs text-amber-400">★</span>
                </div>
              )}
            </div>

            <a
              href={`https://www.google.com/maps/place/?q=place_id:${place.place_id}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex-shrink-0 p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </button>

          {i < places.length - 1 && <div className="h-px bg-border mx-4" />}
        </div>
      ))}
    </div>
  )
}

type WeatherInfo = { desc: string; temp: number; wind: number; humidity: number }
type FireInfo = { name: string; acres?: number; contained?: number }

function PlaceDetail({ place, onBack }: { place: Place; onBack: () => void }) {
  const placesLib = useMapsLibrary("places")
  const map = useMap()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [service, setService] = useState<any>(null)
  const [phone, setPhone] = useState<string | null>(null)
  const [photos, setPhotos] = useState<string[]>(
    place.photo_references?.slice(0, 5).map(largePhotoUrl) ?? []
  )
  const [ranger, setRanger] = useState<{ name: string; phone?: string } | null | "loading">("loading")
  const [weather, setWeather] = useState<WeatherInfo | null | "loading">("loading")
  const [fires, setFires] = useState<FireInfo[] | "loading">("loading")

  useEffect(() => {
    if (!placesLib || !map) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setService(new (placesLib as any).PlacesService(map))
  }, [placesLib, map])

  useEffect(() => {
    setWeather("loading")
    setFires("loading")

    // Weather via server-side proxy (avoids browser API-key restrictions)
    fetch(`/api/weather?lat=${place.lat}&lng=${place.lng}`)
      .then(r => r.json())
      .then(data => {
        const c = data.currentConditions ?? {}
        setWeather({
          desc: c.weatherCondition?.description?.text ?? "Unknown",
          temp: c.temperature?.degrees ?? 0,
          wind: c.wind?.speed?.value ?? 0,
          humidity: c.humidity ?? 0,
        })
      })
      .catch(() => setWeather(null))

    // Active wildfires via NIFC WFIGS (public, no key required)
    const dlat = 80 / 111.0
    const dlng = 80 / (111.0 * Math.cos((place.lat * Math.PI) / 180))
    const bbox = `${place.lng - dlng},${place.lat - dlat},${place.lng + dlng},${place.lat + dlat}`
    const fireUrl = new URL(
      "https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services" +
      "/WFIGS_Incident_Locations_Current/FeatureServer/0/query"
    )
    fireUrl.searchParams.set("where", "1=1")
    fireUrl.searchParams.set("geometry", bbox)
    fireUrl.searchParams.set("geometryType", "esriGeometryEnvelope")
    fireUrl.searchParams.set("spatialRel", "esriSpatialRelIntersects")
    fireUrl.searchParams.set("inSR", "4326")
    fireUrl.searchParams.set("outFields", "IncidentName,GISAcres,PercentContained")
    fireUrl.searchParams.set("returnGeometry", "false")
    fireUrl.searchParams.set("f", "json")

    fetch(fireUrl.toString())
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(r => r.json())
      .then(data => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const features: FireInfo[] = (data.features ?? []).slice(0, 4).map((f: any) => ({
          name: f.attributes.IncidentName ?? "Unknown Fire",
          acres: f.attributes.GISAcres,
          contained: f.attributes.PercentContained,
        }))
        setFires(features)
      })
      .catch(() => setFires([]))
  }, [place])

  useEffect(() => {
    if (!service) return
    setPhone(null)
    setPhotos(place.photo_references?.slice(0, 5).map(largePhotoUrl) ?? [])
    setRanger("loading")

    const OK = google.maps.places.PlacesServiceStatus.OK

    service.getDetails(
      { placeId: place.place_id, fields: ["formatted_phone_number", "photos"] },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (result: any, status: string) => {
        if (status === OK && result) {
          setPhone(result.formatted_phone_number ?? null)
          if (result.photos?.length) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            setPhotos(result.photos.slice(0, 5).map((p: any) => p.getUrl({ maxWidth: 800 })))
          }
        }
      }
    )

    service.textSearch(
      { query: `ranger station near ${place.name} ${place.vicinity} Bay Area California` },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (results: any[], status: string) => {
        if (status !== OK || !results?.[0]) { setRanger(null); return }
        service.getDetails(
          { placeId: results[0].place_id, fields: ["name", "formatted_phone_number"] },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (detail: any, s: string) => {
            setRanger(s === OK && detail
              ? { name: detail.name ?? "Ranger Station", phone: detail.formatted_phone_number }
              : null
            )
          }
        )
      }
    )
  }, [service, place])

  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}&destination_place_id=${place.place_id}`

  return (
    <div className="flex flex-col overflow-hidden">
      {/* Photo carousel — flush to top, rounded corners handled by parent */}
      {photos.length > 0 && <PhotoCarousel photos={photos} />}

      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border flex-shrink-0">
        <button
          onClick={onBack}
          className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <p className="text-sm font-semibold text-foreground flex-1 truncate">{place.name}</p>
        {place.rating && (
          <span className="text-xs font-medium text-amber-500 whitespace-nowrap flex-shrink-0">
            {place.rating} ★
          </span>
        )}
      </div>

      {/* Scrollable details */}
      <div className="overflow-y-auto">
        <div className="p-4 space-y-3">
          {place.vicinity && (
            <p className="text-xs text-muted-foreground">{place.vicinity}</p>
          )}

          {phone && (
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Phone</p>
              <a href={`tel:${phone}`} className="text-sm text-blue-500 font-medium">
                {phone}
              </a>
            </div>
          )}

          <a
            href={directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center text-sm font-medium py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors"
          >
            Get Directions
          </a>

          <div className="border-t border-border pt-3">
            <p className="text-xs font-semibold text-foreground mb-1.5">Nearest Ranger Station</p>
            {ranger === "loading" ? (
              <p className="text-xs text-muted-foreground">Searching...</p>
            ) : ranger ? (
              <div>
                <p className="text-xs text-foreground mb-0.5">{ranger.name}</p>
                {ranger.phone && (
                  <a href={`tel:${ranger.phone}`} className="text-xs text-blue-500">
                    {ranger.phone}
                  </a>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">None found nearby</p>
            )}
          </div>

          <div className="border-t border-border pt-3">
            <p className="text-xs font-semibold text-foreground mb-1.5">Current Weather</p>
            {weather === "loading" ? (
              <p className="text-xs text-muted-foreground">Loading...</p>
            ) : weather ? (
              <div className="space-y-0.5">
                <p className="text-xs text-foreground">{weather.desc}</p>
                <p className="text-xs text-muted-foreground">
                  {weather.temp.toFixed(0)}°F &middot; Wind {weather.wind.toFixed(0)} mph &middot; Humidity {weather.humidity}%
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Unavailable</p>
            )}
          </div>

          <div className="border-t border-border pt-3">
            <p className="text-xs font-semibold text-foreground mb-1.5">Nearby Wildfires</p>
            {fires === "loading" ? (
              <p className="text-xs text-muted-foreground">Searching...</p>
            ) : fires.length > 0 ? (
              <div className="space-y-2">
                {fires.map((fire, i) => (
                  <div key={i}>
                    <p className="text-xs font-medium text-orange-500">{fire.name}</p>
                    {(fire.acres != null || fire.contained != null) && (
                      <p className="text-xs text-muted-foreground">
                        {[
                          fire.acres != null && `${fire.acres.toFixed(0)} acres`,
                          fire.contained != null && `${fire.contained.toFixed(0)}% contained`,
                        ].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No active fires within 80 km</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
