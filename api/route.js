// api/route.js
// This file IS accessible via /api/route

import { processDirections } from '../lib/navigationUtils.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();
    
    // 1. Fetch raw data from ORS
    const { start, end } = req.body;
    const response = await fetch(`https://api.openrouteservice.org/v2/directions/driving-car?api_key=YOUR_KEY&start=${start[0]},${start[1]}&end=${end[0]},${end[1]}`);
    const data = await response.json();
    
    // 2. Pass it through your lib/ logic
    const steps = data.features[0].properties.segments[0].steps;
    const cleanData = processDirections(steps);
    
    // 3. Return clean JSON
    res.status(200).json({ cleanData });
}
