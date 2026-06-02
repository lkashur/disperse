// api/route.js
import { processDirections } from '../lib/navigationUtils.js';

export async function getRoute(start, end) {
  // 1. Call the API
  const response = await fetch(`https://api.openrouteservice.org/v2/directions/driving-car?api_key=YOUR_KEY&start=${start}&end=${end}`);
  const data = await response.json();
  
  // 2. Get the raw steps
  const rawSteps = data.routes[0].segments[0].steps;
  
  // 3. Clean the data using your utility
  const cleanData = processDirections(rawSteps);
  
  // 4. Return to your frontend
  return cleanData;
}
