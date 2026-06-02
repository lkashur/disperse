// lib/navigationUtils.js

export const extractHighwayName = (instruction) => {
    // This regex now catches:
    // 1. "Highway 101", "Hwy 101", "Hwy-101"
    // 2. "US 101", "US-101"
    // 3. "CA 118", "I-5"
    // 4. "FR 1N54" (Forest Roads)
    const regex = /(US|CA|I-|Hwy|Highway|State Route|SR|FR|Forest\sRd|Forest\sRoad)\s?[-]?\s?\d+[a-zA-Z0-9]*/i;
    
    const match = instruction.match(regex);
    if (match) return match[0];

    // Fallback: If it's a "Turn on" instruction, try to extract the road name
    const ontoMatch = instruction.match(/(?:onto|on)\s+([A-Za-z0-9\s]+)(?:\.|$|,)/i);
    if (ontoMatch && ontoMatch[1]) return ontoMatch[1].trim();

    return null;
};

export const processDirections = (steps) => {
    if (!steps) return [];
    
    return steps.reduce((acc, step) => {
        // Try to identify the road name
        let currentName = (step.name && step.name !== "-") 
            ? step.name 
            : extractHighwayName(step.instruction);
        
        // If still nothing, fallback to a cleaner instruction
        if (!currentName || currentName === "the road") {
            currentName = "Continue ahead";
        }

        const last = acc[acc.length - 1];

        // Merge logic
        if (last && last.name === currentName) {
            last.distance += step.distance;
        } else {
            acc.push({ ...step, name: currentName });
        }
        return acc;
    }, []);
};
