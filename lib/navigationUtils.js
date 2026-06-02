// lib/navigationUtils.js

export const processDirections = (steps) => {
    if (!steps || steps.length === 0) return [];

    // 1. Sanitize: Convert "the road" / "-" to null immediately
    const sanitized = steps.map(step => ({
        ...step,
        // Treat generic labels as null so we can overwrite them
        name: (!step.name || step.name.toLowerCase() === "the road" || step.name === "-") 
              ? null 
              : step.name
    }));

    // 2. Propagation: Backfill missing names
    // This logic ensures that if we have ["Hwy 1", null, null, "Hwy 2"], 
    // it becomes ["Hwy 1", "Hwy 1", "Hwy 1", "Hwy 2"]
    let lastValidName = null;

    // Find the first valid name to handle the start of the trip
    for (let i = 0; i < sanitized.length; i++) {
        if (sanitized[i].name) {
            lastValidName = sanitized[i].name;
            break;
        }
    }

    // Propagate forward
    const propagated = sanitized.map(step => {
        if (step.name) {
            lastValidName = step.name;
        } else {
            step.name = lastValidName || "Starting Segment";
        }
        return step;
    });

    // 3. Merge: Combine consecutive segments that now share the same name
    return propagated.reduce((acc, step) => {
        const last = acc[acc.length - 1];
        if (last && last.name === step.name) {
            last.distance += step.distance;
        } else {
            acc.push(step);
        }
        return acc;
    }, []);
};
