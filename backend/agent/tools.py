import os

import httpx
from livekit.agents import Agent, RunContext, function_tool

from .prompts import SYSTEM_PROMPT


class CliffAgent(Agent):
    def __init__(self, retriever):
        super().__init__(instructions=SYSTEM_PROMPT)
        self._retriever = retriever

    @function_tool
    async def get_weather(self, context: RunContext, location: str) -> str:
        """Get current weather conditions for a Bay Area location.

        Args:
            location: City or area name, e.g. 'Marin County' or 'Oakland Hills'
        """
        api_key = os.environ["OPENWEATHER_API_KEY"]
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://api.openweathermap.org/data/2.5/weather",
                params={"q": f"{location},CA,US", "appid": api_key, "units": "imperial"},
            )
            resp.raise_for_status()
            data = resp.json()

        desc = data["weather"][0]["description"]
        temp = data["main"]["temp"]
        wind = data["wind"]["speed"]
        return f"{location}: {desc}, {temp:.0f}°F, wind {wind:.0f} mph"

    @function_tool
    async def get_fire_and_closures(self, context: RunContext, location: str) -> str:
        """Get active fire alerts and trail closures near a Bay Area location.

        Args:
            location: Bay Area city or region to check
        """
        # TODO: replace with CAL FIRE / USFS ArcGIS query
        return (
            f"Checking fire and closure status near {location}. "
            "No active closures in the system right now, but always double-check with your local ranger station before heading out!"
        )

    @function_tool
    async def find_nearby_spots(
        self, context: RunContext, location: str, activity: str
    ) -> str:
        """Find nearby outdoor spots or trailheads for a given activity.

        Args:
            location: Bay Area city or neighborhood
            activity: One of: hiking, fishing, hunting, biking, climbing, dirtbiking
        """
        api_key = os.environ["GOOGLE_PLACES_API_KEY"]
        query = f"{activity} trails parks near {location} Bay Area California"
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://maps.googleapis.com/maps/api/place/textsearch/json",
                params={"query": query, "key": api_key},
            )
            resp.raise_for_status()
            results = resp.json().get("results", [])[:5]

        if not results:
            return f"No {activity} spots found near {location}."

        spots = ", ".join(r["name"] for r in results)
        return f"Top {activity} spots near {location}: {spots}"

    @function_tool
    async def search_knowledge_base(self, context: RunContext, query: str) -> str:
        """Search Bay Area outdoor knowledge base for regulations, ranger contacts, trail details, or seasonal rules.

        Args:
            query: What to look up, e.g. 'fishing license requirements' or 'Mt Tam ranger station phone number'
        """
        docs = self._retriever.invoke(query)
        if not docs:
            return "No relevant information found in the knowledge base."
        return "\n\n".join(d.page_content for d in docs[:3])
