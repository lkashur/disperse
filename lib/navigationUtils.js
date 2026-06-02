// lib/navigationUtils.js

export const processDirections = (steps) => {
    if (!steps || steps.length === 0) return [];

    // Helper: Check if a name is garbage
    const isBadName = (name) => {
        if (!name) return true;
        const n = name.toLowerCase();
        return n === "the road" || n === "-" || n === "";
    };

    // 1. LOOK-AHEAD: Try to find the first valid name in the entire list
    // This solves the "Start of the trip" problem
    let startingName = "Start";
    for (const step of steps) {
        if (!isBadName(step.name)) {
            startingName = step.name;
            break;
        }
        // Also check if the instruction contains a road name
        const match = step.instruction.match(/(?:on|onto|take)\s+([A-Z0-9][A-Za-z0-9\s-]+)/i);
        if (match) {
            startingName = match[1].trim();
            break;
        }
    }

    let lastKnownValidName = startingName;

    // 2. Process and Clean
    return steps.reduce((acc, step) => {
        // Identify valid name
        let name = isBadName(step.name) ? null : step.name;

        // Try regex extraction from instruction
        if (!name) {
            const match = step.instruction.match(/(?:on|onto|take)\s+([A-Z0-9][A-Za-z0-9\s-]+)/i);
            if (match) name = match[1].trim();
        }

        // If we found a good name, update our "Last Known" tracker
        if (name && !isBadName(name)) {
            lastKnownValidName = name;
        }

        // Assign the name
        const finalName = lastKnownValidName;

        const last = acc[acc.length - 1];

        // Merge logic
        if (last && last.name === finalName) {
            last.distance += step.distance;
        } else {
            acc.push({ ...step, name: finalName });
        }
        return acc;
    }, []);
};
