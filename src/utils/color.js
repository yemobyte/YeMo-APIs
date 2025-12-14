/**
 * @license
 * Copyright (C) 2025 YeMo
 * https://github.com/yemobyte
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

const styles = {
  modifier: {
    reset: [0, 0],
    bold: [1, 22],
    dim: [2, 22],
    italic: [3, 23],
    underline: [4, 24],
    overline: [53, 55],
    inverse: [7, 27],
    hidden: [8, 28],
    strikethrough: [9, 29],
  },
  color: {
    black: [30, 39],
    red: [31, 39],
    green: [32, 39],
    yellow: [33, 39],
    blue: [34, 39],
    magenta: [35, 39],
    cyan: [36, 39],
    white: [37, 39],
    gray: [90, 39],
  },
  bgColor: {
    black: [40, 49],
    red: [41, 49],
    green: [42, 49],
    yellow: [43, 49],
    blue: [44, 49],
    magenta: [45, 49],
    cyan: [46, 49],
    white: [47, 49],
  },
};

function applyStyle(text, style) {
  const [start, end] = style;
  return `\x1b[${start}m${text}\x1b[${end}m`;
}

const Color = {
  black: (text) => applyStyle(text, styles.color.black),
  red: (text) => applyStyle(text, styles.color.red),
  green: (text) => applyStyle(text, styles.color.green),
  yellow: (text) => applyStyle(text, styles.color.yellow),
  blue: (text) => applyStyle(text, styles.color.blue),
  magenta: (text) => applyStyle(text, styles.color.magenta),
  cyan: (text) => applyStyle(text, styles.color.cyan),
  white: (text) => applyStyle(text, styles.color.white),
  gray: (text) => applyStyle(text, styles.color.gray),

  bgBlack: (text) => applyStyle(text, styles.bgColor.black),
  bgRed: (text) => applyStyle(text, styles.bgColor.red),
  bgGreen: (text) => applyStyle(text, styles.bgColor.green),
  bgYellow: (text) => applyStyle(text, styles.bgColor.yellow),
  bgBlue: (text) => applyStyle(text, styles.bgColor.blue),
  bgMagenta: (text) => applyStyle(text, styles.bgColor.magenta),
  bgCyan: (text) => applyStyle(text, styles.bgColor.cyan),
  bgWhite: (text) => applyStyle(text, styles.bgColor.white),
};

export default Color;
