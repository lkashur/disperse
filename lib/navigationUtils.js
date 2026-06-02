// lib/navigationUtils.js

export const extractHighwayName = (instruction) => {
  const match = instruction.match(/(US|CA|I-|Hwy)\s?\d+/i);
  return match ? match[0] : "the road";
};

export const processDirections = (steps) => {
  if (!steps) return [];
  
  return steps.reduce((acc, step) => {
    const currentName = (step.name && step.name !== "-") 
      ? step.name 
      : extractHighwayName(step.instruction);

    const last = acc[acc.length - 1];

    if (last && last.name === currentName) {
      last.distance += step.distance;
    } else {
      acc.push({ ...step, name: currentName });
    }
    return acc;
  }, []);
};
