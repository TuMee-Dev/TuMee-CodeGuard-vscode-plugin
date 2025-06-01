/**
 * Shared constants for the TuMee CodeGuard extension
 */

// CLI Display Constants
export const CLI_BORDER_CHAR = '▒'; // Unicode block character U+2592
export const CLI_MIXED_BORDER_CHAR = '▒'; // Lighter block character for mixed permissions

// ANSI Color Constants
export const ANSI = {
  reset: '\x1b[0m',
  black: '\x1b[30m',
  white: '\x1b[37m',
  dim: '\x1b[2m',
  // Background colors with different intensities
  bg: {
    black: '\x1b[40m',
    red: '\x1b[41m',
    green: '\x1b[42m',
    yellow: '\x1b[43m',
    blue: '\x1b[44m',
    magenta: '\x1b[45m',
    cyan: '\x1b[46m',
    white: '\x1b[47m',
    // Bright variants
    blackBright: '\x1b[100m',
    redBright: '\x1b[101m',
    greenBright: '\x1b[102m',
    yellowBright: '\x1b[103m',
    blueBright: '\x1b[104m',
    magentaBright: '\x1b[105m',
    cyanBright: '\x1b[106m',
    whiteBright: '\x1b[107m'
  }
};