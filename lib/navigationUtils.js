// lib/navigationUtils.js

export const processDirections = (steps) => {
    if (!steps) return [];

    let currentHighwayContext = "Starting Route";

    return steps.reduce((acc, step) => {
        // 1. Determine a candidate name from the API's 'name' property
        let nameCandidate = (step.name && step.name !== "-" && step.name.toLowerCase() !== "the road") 
            ? step.name 
            : null;

        // 2. If API provided nothing, try to extract it from the instruction text 
        // (This is where "Continue on US 101" gets captured)
        if (!nameCandidate) {
            const instrMatch = step.instruction.match(/(?:on|onto|take)\s+([A-Z0-9][A-Za-z0-9\s-]+)/i);
            if (instrMatch) nameCandidate = instrMatch[1].trim();
        }

        // 3. Update the Context
        // If we found a specific, reliable name, update our "Context"
        // We ignore "Unnamed" names so we don't overwrite our known highway with bad data
        if (nameCandidate && nameCandidate.toLowerCase() !== "unnamed connector") {
            currentHighwayContext = nameCandidate;
        }

        // 4. Final label: Use the candidate if valid, otherwise use the persistent context
        const finalName = nameCandidate || currentHighwayContext;

        const last = acc[acc.length - 1];

        // 5. Merge logic
        if (last && last.name === finalName) {
            last.distance += step.distance;
        } else {
            acc.push({ ...step, name: finalName, distance: step.distance });
        }
        return acc;
    }, []);
};
