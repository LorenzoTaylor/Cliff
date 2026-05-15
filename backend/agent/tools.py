import json
import logging
import math
import os
from typing import Optional

import httpx
from livekit.agents import Agent, RunContext, function_tool
from livekit.rtc import Room

logger = logging.getLogger("cliff-agent")


async def _geocode(location: str, api_key: str) -> tuple[float, float] | None:
    """Convert a location name to (lat, lng) using the Geocoding API."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://maps.googleapis.com/maps/api/geocode/json",
            params={"address": f"{location}, Bay Area, CA", "key": api_key},
        )
        resp.raise_for_status()
        data = resp.json()
        print(f"[cliff] geocode '{location}' status={data.get('status')} results={len(data.get('results', []))}")
        results = data.get("results", [])
    if not results:
        return None
    loc = results[0]["geometry"]["location"]
    return loc["lat"], loc["lng"]


class CliffAgent(Agent):
    def __init__(self, instructions: str, retriever, room: Optional[Room] = None):
        super().__init__(instructions=instructions)
        self._retriever = retriever
        self._room = room

    async def _publish_places(self, places: list[dict]) -> None:
        if not self._room:
            logger.warning("_publish_places: room is None, skipping")
            print("[cliff] _publish_places: room is None, skipping")
            return
        print(f"[cliff] publishing {len(places)} places to frontend")
        logger.info("Publishing %d places to frontend", len(places))
        await self._room.local_participant.publish_data(
            payload=json.dumps(places).encode(),
            reliable=True,
            topic="cliff:places",
        )
        print(f"[cliff] publish_data done")

    @function_tool
    async def search_knowledge_base(self, context: RunContext, query: str) -> str:
        """Search Bay Area outdoor knowledge base. Use this for ANY specific factual question — regulations,
        ranger contacts, trail details, seasonal rules, permit requirements, district or regional staff names,
        organizational contacts, management areas, fees, or any named person/role/place in Bay Area parks.

        Args:
            query: What to look up, e.g. 'Bay Region 3 manager' or 'fishing license requirements' or 'Mt Tam ranger station phone number'
        """
        docs = self._retriever.invoke(query)
        if not docs:
            return "No relevant information found in the knowledge base."
        return "\n\n".join(d.page_content for d in docs)

    @function_tool
    async def get_weather(self, context: RunContext, location: str) -> str:
        """Get current weather conditions for a Bay Area location.

        Args:
            location: Neighborhood or area name, e.g. 'Marin County' or 'Oakland Hills'
        """
        api_key = os.environ["GOOGLE_PLACES_API_KEY"]

        coords = await _geocode(location, api_key)
        if not coords:
            return f"Could not find coordinates for {location}."
        lat, lng = coords

        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://weather.googleapis.com/v1/currentConditions:lookup",
                params={
                    "key": api_key,
                    "location.latitude": lat,
                    "location.longitude": lng,
                    "unitsSystem": "IMPERIAL",
                },
            )
            resp.raise_for_status()
            data = resp.json()

        conditions = data.get("currentConditions", {})
        desc = conditions.get("weatherCondition", {}).get("description", {}).get("text", "unknown")
        temp = conditions.get("temperature", {}).get("degrees", "?")
        wind_val = conditions.get("wind", {}).get("speed", {}).get("value", "?")
        humidity = conditions.get("humidity", "?")

        return f"{location}: {desc}, {temp:.0f}°F, wind {wind_val:.0f} mph, humidity {humidity}%"

    @function_tool
    async def get_fire_and_closures(self, context: RunContext, location: str) -> str:
        """Get active fire alerts and trail closures near a Bay Area location.

        Args:
            location: Bay Area neighborhood or region to check
        """
        api_key = os.environ["GOOGLE_PLACES_API_KEY"]

        coords = await _geocode(location, api_key)
        if not coords:
            return f"Could not find coordinates for {location}."
        lat, lng = coords

        # ~80 km bounding box around the location
        dlat = 80 / 111.0
        dlng = 80 / (111.0 * math.cos(math.radians(lat)))
        bbox = f"{lng - dlng},{lat - dlat},{lng + dlng},{lat + dlat}"

        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services"
                "/WFIGS_Incident_Locations_Current/FeatureServer/0/query",
                params={
                    "where": "1=1",
                    "geometry": bbox,
                    "geometryType": "esriGeometryEnvelope",
                    "spatialRel": "esriSpatialRelIntersects",
                    "inSR": "4326",
                    "outFields": "IncidentName,IncidentTypeCategory,GISAcres,PercentContained",
                    "returnGeometry": "false",
                    "f": "json",
                },
                timeout=10,
            )
            resp.raise_for_status()
            data = resp.json()

        features = data.get("features", [])
        if not features:
            return f"No active fire incidents found within 80 km of {location}. Always confirm with your local ranger station before heading out."

        lines = []
        for feat in features[:4]:
            attrs = feat.get("attributes", {})
            name = attrs.get("IncidentName") or "Unknown Fire"
            acres = attrs.get("GISAcres")
            contained = attrs.get("PercentContained")
            parts = [name]
            if acres:
                parts.append(f"{acres:.0f} acres")
            if contained is not None:
                parts.append(f"{contained:.0f}% contained")
            lines.append(", ".join(parts))

        return (
            f"Active fire incidents within 80 km of {location}: {'; '.join(lines)}. "
            "Check with your local ranger station for current trail closures before heading out."
        )

    @function_tool
    async def find_nearby_spots(
        self, context: RunContext, location: str, activity: str
    ) -> str:
        """Find nearby outdoor spots or trailheads for a given activity.

        Args:
            location: Bay Area neighborhood or area name
            activity: One of: hiking, fishing, hunting, biking, climbing, dirtbiking
        """
        api_key = os.environ["GOOGLE_PLACES_API_KEY"]

        keywords = {
            "hiking": "hiking trail park",
            "fishing": "fishing lake river creek",
            "hunting": "hunting area wildlife game",
            "biking": "mountain biking trail park",
            "climbing": "outdoor rock climbing crag bouldering",
            "dirtbiking": "OHV off-road vehicle area park",
        }
        keyword = keywords.get(activity, f"outdoor {activity} park")

        indoor_type_tags = {"gym", "health", "fitness_center", "restaurant", "food",
                            "store", "lodging", "stadium", "arena", "school", "library"}
        indoor_name_tokens = {"gym", "fitness", "center", "studio", "indoor",
                               "climbing gym", "bouldering gym", "indoor climbing"}
        outdoor_type_tags = {"park", "natural_feature", "campground", "rv_park",
                             "point_of_interest"}
        # Activities where we require park/natural-feature typing to exclude urban gyms
        outdoor_strict_activities = {"climbing", "hiking"}

        def is_outdoor(r: dict) -> bool:
            types = set(r.get("types", []))
            name_lower = r.get("name", "").lower()
            if indoor_type_tags.intersection(types):
                return False
            if any(tok in name_lower for tok in indoor_name_tokens):
                return False
            return True

        def is_outdoor_strict(r: dict) -> bool:
            if not is_outdoor(r):
                return False
            return bool(outdoor_type_tags.intersection(set(r.get("types", []))))

        filter_fn = is_outdoor_strict if activity in outdoor_strict_activities else is_outdoor

        coords = await _geocode(location, api_key)
        if coords:
            lat, lng = coords
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    "https://maps.googleapis.com/maps/api/place/nearbysearch/json",
                    params={
                        "location": f"{lat},{lng}",
                        "rankby": "distance",
                        "keyword": keyword,
                        "key": api_key,
                    },
                )
                resp.raise_for_status()
                data = resp.json()
                raw = data.get("results", [])
                print(f"[cliff] nearbysearch status={data.get('status')} raw={len(raw)}")
                filtered = [r for r in raw if filter_fn(r)]
                results = (filtered if filtered else raw)[:5]
        else:
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    "https://maps.googleapis.com/maps/api/place/textsearch/json",
                    params={
                        "query": f"outdoor {activity} trail park area near {location} Bay Area California",
                        "key": api_key,
                    },
                )
                resp.raise_for_status()
                data = resp.json()
                raw = data.get("results", [])
                print(f"[cliff] textsearch status={data.get('status')} raw={len(raw)}")
                filtered = [r for r in raw if filter_fn(r)]
                results = (filtered if filtered else raw)[:5]

        if not results:
            return f"No {activity} spots found near {location}."

        places = [
            {
                "place_id": r["place_id"],
                "name": r["name"],
                "lat": r["geometry"]["location"]["lat"],
                "lng": r["geometry"]["location"]["lng"],
                "vicinity": r.get("vicinity", r.get("formatted_address", "")),
                "rating": r.get("rating"),
                "photo_references": [
                    p["photo_reference"]
                    for p in r.get("photos", [])[:3]
                ],
            }
            for r in results
        ]

        photo_counts = [len(p["photo_references"]) for p in places]
        print(f"[cliff] publishing {len(places)} places, photo_refs per place: {photo_counts}")
        await self._publish_places(places)

        spots = ", ".join(p["name"] for p in places)
        return f"Top {activity} spots near {location}: {spots}"
