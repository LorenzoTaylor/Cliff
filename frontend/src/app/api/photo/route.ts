import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const ref = searchParams.get("ref");
  const maxwidth = searchParams.get("maxwidth") ?? "400";

  if (!ref) return NextResponse.json({ error: "ref required" }, { status: 400 });

  const apiKey =
    process.env.GOOGLE_PLACES_API_KEY ??
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) return NextResponse.json({ error: "API key not configured" }, { status: 500 });

  const url =
    `https://maps.googleapis.com/maps/api/place/photo` +
    `?maxwidth=${maxwidth}&photo_reference=${encodeURIComponent(ref)}&key=${apiKey}`;

  try {
    const resp = await fetch(url, { redirect: "follow" });
    if (!resp.ok) return NextResponse.json({ error: "Photo fetch failed" }, { status: resp.status });

    const buffer = await resp.arrayBuffer();
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": resp.headers.get("content-type") ?? "image/jpeg",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return NextResponse.json({ error: "Photo fetch failed" }, { status: 500 });
  }
}
