// lib/navigationUtils.js

export const processDirections = (steps) => {
    if (!steps || !Array.isArray(steps)) return [];

    return steps.map((step) => {
        // 1. Identify if the name is usable (not junk)
        const isNameValid = step.name && 
                            step.name !== "-" && 
                            step.name.toLowerCase() !== "the road";

        // 2. Create a clean display label
        // If there's a valid name, include it. If not, rely solely on the instruction.
        let displayLabel = step.instruction;
        
        if (isNameValid && !step.instruction.includes(step.name)) {
            displayLabel = `${step.instruction} (${step.name})`;
        }

        return {
            ...step,
            displayLabel: displayLabel,
            // Convert meters to miles
            miles: (step.distance / 1609.34).toFixed(1)
        };
    });
};
