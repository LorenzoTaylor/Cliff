import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");

  if (!lat || !lng) {
    return NextResponse.json({ error: "lat and lng required" }, { status: 400 });
  }

  // Prefer server-only key so the Weather API key isn't browser-exposed
  const apiKey =
    process.env.GOOGLE_PLACES_API_KEY ??
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: "API key not configured" }, { status: 500 });
  }

  const url =
    `https://weather.googleapis.com/v1/currentConditions:lookup` +
    `?key=${apiKey}&location.latitude=${lat}&location.longitude=${lng}&unitsSystem=IMPERIAL`;

  try {
    const resp = await fetch(url);
    const data = await resp.json();
    return NextResponse.json(data, { status: resp.status });
  } catch {
    return NextResponse.json({ error: "Weather fetch failed" }, { status: 500 });
  }
}
