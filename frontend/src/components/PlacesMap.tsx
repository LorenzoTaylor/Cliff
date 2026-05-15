"use client"

import { Map, AdvancedMarker, Pin } from "@vis.gl/react-google-maps"
import { useTheme } from "@/hooks/use-theme"

export type Place = {
  place_id: string
  name: string
  lat: number
  lng: number
  vicinity: string
  rating?: number
  photo_references?: string[]
}

const SF_BAY_CENTER = { lat: 37.7272, lng: -122.2913 }

interface PlacesMapProps {
  places: Place[]
  userLocation?: { lat: number; lng: number } | null
  selected: Place | null
  onSelect: (place: Place | null) => void
}

export function PlacesMap({ places, userLocation, selected, onSelect }: PlacesMapProps) {
  const isDark = useTheme()

  return (
    <div className="w-full h-full">
      <Map
        defaultCenter={SF_BAY_CENTER}
        defaultZoom={10}
        mapId="DEMO_MAP_ID"
        colorScheme={isDark ? "DARK" : "LIGHT"}
        gestureHandling="greedy"
        disableDefaultUI
        style={{ width: "100%", height: "100%" }}
      >
        {userLocation && (
          <AdvancedMarker position={userLocation}>
            <div className="w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow-md" />
          </AdvancedMarker>
        )}

        {places.map((place) => (
          <AdvancedMarker
            key={place.place_id}
            position={{ lat: place.lat, lng: place.lng }}
            onClick={() => onSelect(selected?.place_id === place.place_id ? null : place)}
          >
            <Pin
              background={selected?.place_id === place.place_id ? "#2563eb" : undefined}
              borderColor={selected?.place_id === place.place_id ? "#1d4ed8" : undefined}
              glyphColor={selected?.place_id === place.place_id ? "#fff" : undefined}
            />
          </AdvancedMarker>
        ))}
      </Map>
    </div>
  )
}
