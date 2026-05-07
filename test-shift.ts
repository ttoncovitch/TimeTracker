import { isShiftMismatch } from './src/lib/shiftUtils';
console.log("1:", isShiftMismatch("14:00-23:00", "14:00-23:00"));
console.log("2:", isShiftMismatch("14:00 - 23:00", "14:00-23:00"));
console.log("3:", isShiftMismatch("LMEG - FRENCH", "14:00-23:00"));
