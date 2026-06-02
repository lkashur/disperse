// lib/navigationUtils.js

export const processDirections = (steps) => {
    if (!steps || steps.length === 0) return [];

    // We start assuming the first step might be unnamed. 
    // We will update this as soon as we hit the first real road name.
    let currentRoadContext = "Starting Route";

    // 1. Pass 1: Build a clean list with inherited names
    const cleanedSteps = steps.map(step => {
        let name = step.name;
        const isBadName = (!name || name === "-" || name.toLowerCase() === "the road");

        // If the name is bad, try to parse the instruction one last time
        if (isBadName) {
            const match = step.instruction.match(/(?:on|onto|take|along)\s+([A-Z0-9][A-Za-z0-9\s-]+)/i);
            if (match) {
                name = match[1].trim();
            } else {
                // If parsing fails, FORCE inheritance from the current context
                name = currentRoadContext;
            }
        }

        // Update the context if we found a good name
        if (name && name !== "the road" && name !== "Starting Route") {
            currentRoadContext = name;
        }

        return { ...step, name: name };
    });

    // 2. Pass 2: Merge consecutive segments with identical names
    return cleanedSteps.reduce((acc, step) => {
        const last = acc[acc.length - 1];
        if (last && last.name === step.name) {
            last.distance += step.distance;
        } else {
            acc.push(step);
        }
        return acc;
    }, []);
};
