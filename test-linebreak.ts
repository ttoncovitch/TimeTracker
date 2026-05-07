import { isShiftMismatch } from './src/lib/shiftUtils';
console.log("with \\n:", isShiftMismatch("14:00-\n23:00", "14:00-23:00"));
console.log("with \\r\\n:", isShiftMismatch("14:00-\r\n23:00", "14:00-23:00"));
