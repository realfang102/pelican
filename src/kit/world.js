// kit/world — the geometry every module agrees on.
//
// The film is one long wall of square pictures with a road running through all of them.
//   • every section is a SEC × SEC (1000 × 1000) unit picture; its own origin is its top-left corner
//   • each picture wears a FRAME-unit frame, so neighbours are PITCH = SEC + 2·FRAME apart
//   • the road's riding line is y = ROAD_Y in every picture, so it joins up across the frames
//   • at zoom 1 one unit is one output pixel: the 1920 × 1080 screen shows a full picture plus ~44 % of each neighbour

export const W = 1920;
export const H = 1080;
export const SEC = 1000;
export const FRAME = 30;
export const PITCH = SEC + 2 * FRAME; // 1060
export const ROAD_Y = 800;
/** x of section i's left edge on the wall (i = 1..21; 21 is the press-conference panel) */
export const sectionX = (i) => (i - 1) * PITCH;
/** nominal riding speed in units/s: one PITCH per 6-second section */
export const SPEED = PITCH / 6;
