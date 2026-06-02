// lib/navigationUtils.js

export const extractNameFromInstruction = (instruction) => {
    // 1. Priority: Look for patterns in the text directly
    // This looks for "on [Name]", "onto [Name]", or "take [Name]"
    const patterns = [
        /(?:on|onto|take)\s+([A-Z0-9][A-Za-z0-9\s-]+)/i,
        /(US|CA|I-|Hwy|Highway|State Route|SR|FR|Forest\sRd|Forest\sRoad)\s?[-]?\s?\d+[a-zA-Z0-9]*/i
    ];

    for (let pattern of patterns) {
        const match = instruction.match(pattern);
        if (match) return match[1] || match[0]; // Return capture group or full match
    }

    return null;
};

export const processDirections = (steps) => {
    if (!steps) return [];
    
    return steps.reduce((acc, step) => {
        // 1. Try step.name first (only if it's not generic)
        let currentName = (step.name && step.name !== "-" && step.name.toLowerCase() !== "the road") 
            ? step.name 
            : extractNameFromInstruction(step.instruction);
        
        // 2. If we still have nothing, clean it up
        if (!currentName || currentName.toLowerCase() === "the road") {
            // Check if we can inherit the previous name
            const last = acc[acc.length - 1];
            currentName = last ? last.name : "Continue";
        }

        const last = acc[acc.length - 1];

        // 3. Merge logic
        if (last && last.name === currentName) {
            last.distance += step.distance;
        } else {
            acc.push({ ...step, name: currentName });
        }
        return acc;
    }, []);
};
