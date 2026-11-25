import { ColorSchemeName } from "react-native";

/**
 * Généralisation de RenderCalendarColor.
 *
 * Construit une couleur HSL à partir d'une HUE et du scheme (light/dark).
 *
 * @param hue - Teinte en degrés (0-360)
 * @param scheme - 'light' | 'dark'
 * @param variant - 'fond' pour un arrière-plan très clair/discret, 'texte' pour une couleur bien contrastée
 * @returns chaîne CSS hsl(...) utilisable en backgroundColor ou color
 */
export default function RenderHueColor(hue: number, scheme: ColorSchemeName, variant: 'fond' | 'texte' = 'fond'): string {
    if (variant === 'fond') {
        // fond très discret en light, un peu plus présent en dark
        return `hsl(${hue}, 35%, ${scheme === 'dark' ? '22%' : '94%'})`;
    }

    // texte : bien saturé pour contraster sur le fond de la carte
    return `hsl(${hue}, 60%, ${scheme === 'dark' ? '68%' : '42%'})`;
}
