// Tells the reviewer side panel that a request was passed to exactly one other person.
export const announce = (detail) => window.dispatchEvent(new CustomEvent('ascend:handoff', { detail }));