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

import Color from "./color.js";

const logger = {
  info: (msg) =>
    console.log(Color.blue("•") + " " + Color.gray("info  - ") + msg),
  ready: (msg) =>
    console.log(Color.green("•") + " " + Color.gray("ready - ") + msg),
  warn: (msg) =>
    console.log(Color.yellow("•") + " " + Color.gray("warn  - ") + msg),
  error: (msg) =>
    console.log(Color.red("•") + " " + Color.gray("error - ") + msg),
  event: (msg) =>
    console.log(Color.cyan("•") + " " + Color.gray("event - ") + msg),
};

export default logger;
