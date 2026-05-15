"use client";

import { useCallback, useEffect, useState } from "react";
import { APIProvider } from "@vis.gl/react-google-maps";
import { LiveKitRoom, RoomAudioRenderer } from "@livekit/components-react";
import { ConnectedView } from "@/components/ConnectedView";
import { ControlDock } from "@/components/ControlDock";
import { LandingHero } from "@/components/LandingHero";
import { PlacesMap, type Place } from "@/components/PlacesMap";
import { PlacesSidebar } from "@/components/PlacesSidebar";
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";
import { useCallSession } from "@/hooks/use-call-session";
import { cn } from "@/lib/utils";

type LayoutState = "hidden" | "panel" | "sidebar";
type UserLocation = { lat: number; lng: number; city?: string } | null;

export default function Home() {
  const { token, serverUrl, isConnected, controlState, startCall, endCall, setAgentState } =
    useCallSession();
  const [sidebarMode, setSidebarMode] = useState(false);
  const [places, setPlaces] = useState<Place[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [userLocation, setUserLocation] = useState<UserLocation>(null);
  // Hero: visible by default on first load, gone permanently after first call
  const [heroVisible, setHeroVisible] = useState(true);
  const [heroLeaving, setHeroLeaving] = useState(false);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { timeout: 8000 }
    );
  }, []);

  const layoutState: LayoutState = !isConnected
    ? "hidden"
    : sidebarMode
    ? "sidebar"
    : "panel";

  async function handleStart() {
    if (heroVisible) {
      setHeroLeaving(true);
      // After all exit animations finish, permanently hide
      setTimeout(() => {
        setHeroLeaving(false);
        setHeroVisible(false);
      }, 1600);
    }
    const loc = await new Promise<UserLocation>((resolve) => {
      if (!navigator.geolocation) { resolve(null); return; }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { timeout: 3000, maximumAge: 60_000 }
      );
    });
    if (loc) setUserLocation(loc);
    // Fall back to cached location so agent always gets coordinates on repeat calls
    void startCall(loc ?? userLocation ?? undefined);
  }

  const handlePlacesReceived = useCallback((places: Place[]) => {
    setPlaces(places);
    setSelectedPlace(null);
    setSidebarMode(true);
  }, []);

  function handleEndCall() {
    setSidebarMode(false);
    setPlaces([]);
    setSelectedPlace(null);
    // Force hero hidden — never show again after any call
    setHeroVisible(false);
    setHeroLeaving(false);
    endCall();
  }

  const isSidebar = layoutState === "sidebar";

  return (
    <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ""}>
    <main className="min-h-screen w-full bg-background relative overflow-hidden">

      {/* Full-screen map */}
      <div className="fixed inset-0 z-0">
        <PlacesMap
          places={places}
          userLocation={userLocation}
          selected={selectedPlace}
          onSelect={setSelectedPlace}
        />
      </div>

      {/* Theme toggle — top-right, above sidebar */}
      <div className="fixed top-4 right-4 z-50">
        <AnimatedThemeToggler
          variant="circle"
          className="w-9 h-9 rounded-full border border-border bg-background hover:bg-muted transition-colors flex items-center justify-center text-foreground"
        />
      </div>

      {/* Places sidebar — vertically centered on right */}
      {places.length > 0 && (
        <div className="fixed right-4 top-1/2 -translate-y-1/2 w-96 z-20">
          <PlacesSidebar
            places={places}
            selected={selectedPlace}
            onSelect={setSelectedPlace}
          />
        </div>
      )}

      {/* Agent panel — inline styles so position/size transitions are GPU-composited */}
      {layoutState !== "hidden" && (
        <div
          className={cn(
            "fixed z-30",
            isSidebar && "border-r border-border bg-background/80 backdrop-blur-sm",
          )}
          style={{
            top: isSidebar ? 0 : "50%",
            left: isSidebar ? 0 : "50%",
            width: isSidebar ? "24rem" : "28rem",
            height: isSidebar ? "100%" : "auto",
            transform: isSidebar ? "translate(0, 0)" : "translate(-50%, -50%)",
            transition: "top 500ms cubic-bezier(0.22,1,0.36,1), left 500ms cubic-bezier(0.22,1,0.36,1), width 500ms cubic-bezier(0.22,1,0.36,1), transform 500ms cubic-bezier(0.22,1,0.36,1)",
            willChange: "transform",
          }}
        >
          <LiveKitRoom
            token={token!}
            serverUrl={serverUrl!}
            connect={true}
            audio={false}
            video={false}
            onDisconnected={handleEndCall}
            className={isSidebar ? "h-full w-full flex items-center justify-center" : undefined}
          >
            <RoomAudioRenderer />
            <ConnectedView
              onStateChange={setAgentState}
              onPlacesReceived={handlePlacesReceived}
              sidebarMode={isSidebar}
            />
          </LiveKitRoom>
        </div>
      )}

      {/* Landing hero — mounted until timeout fires (~1.6s after first tap), regardless of connect state */}
      {heroVisible && <LandingHero leaving={heroLeaving} />}

      {/* Dock */}
      <div className="fixed bottom-0 left-0 right-0 flex justify-center p-5 z-40">
        <ControlDock
          state={controlState}
          onStart={handleStart}
          onEnd={handleEndCall}
          sidebarMode={sidebarMode}
          onToggleLayout={() => setSidebarMode((m) => !m)}
        />
      </div>
    </main>
    </APIProvider>
  );
}
