// Cell count must be odd -> center cell = start cell
export const COLS = 11;
export const ROWS = 11;

// Maximum rendered board width, in pixels.
export const BOARD_SIZE = 500;

// Includes the start and end rooms.
export const MAX_ROOMS = 15;

// Chance of leaving a frontier cell empty instead of placing a room.
// Skipping is only allowed while another frontier cell exists, so a map can
// never terminate with only the start room.
export const GAP_CHANCE = 0.15;
