/**
 * The color that stands for a theme hue (0-359): the color wheel's ring, its cursor, and
 * the circle of the settings' "palette" row. The theme itself is generated from the hue
 * alone (generateTheme), each role with its own saturation and lightness.
 *
 * @author Philip — user story 49 (theme color wheel)
 * @param {number} teinte - Hue, in degrees.
 * @returns {string} A CSS hsl() color.
 */
export default function couleurTeinte(teinte: number): string {
    return `hsl(${Math.round(teinte)}, 65%, 55%)`
}
