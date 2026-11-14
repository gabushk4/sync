export type ThemeColors = {
    primary: string;
    secondary: string;
    background: string;
    card: string;
    text: string;
    border: string;
    notification: string;
    error: string;
    success: string;
    muted: string;
    warning: string;
    /** Outline of the member's free stretches (blue, fixed whatever the hue). Philip — user story 20. */
    disponible: string;
    /** Block of an unavailability on the member's row (red, fixed whatever the hue). Philip — user story 20. */
    indisponible: string;
    /** Block of a group event (other participants) on the member's row (teal, fixed whatever the hue). Philip — user story 23. */
    groupe: string;
    /** Block of a slot where every participant is free — a "good line-up" to propose or
     * move an event to (gold, fixed whatever the hue). Philip — user story 23. */
    or: string;
    /** Common availability where some participants (at least 2, not all) are free —
     * invitation review (orange, fixed whatever the hue). Philip. */
    dispoPartielle: string;
    /** Common availability where every participant is free — invitation review
     * (green, fixed whatever the hue). Philip. */
    dispoTous: string;
    /** Pending answer to an invitation (orange, brighter than a partial availability;
     * fixed whatever the hue). Philip. */
    enAttente: string;
};


export function generateTheme(h: number, scheme: 'light' | 'dark') : ThemeColors {
    const hsl = (h: number,s: number, l: number) => `hsl(${h}, ${s}%, ${l}%)`;

    if (scheme === 'dark') {
        return {
            primary:    hsl(h, 54, 17),
            secondary:  hsl(h, 40, 60),
            background: hsl(h, 10, 10),
            card:       hsl(h, 30, 15),
            text:       hsl(h, 20, 90),
            muted:      hsl(h, 20, 60),
            border:     hsl(h, 30, 50),
            error:      hsl(0, 60, 60),
            success:    hsl(90, 60, 60),
            warning:    hsl(50, 60, 60),
            disponible: hsl(205, 75, 65),
            indisponible: hsl(0, 50, 32),
            groupe:     hsl(170, 45, 30),
            or:         hsl(43, 75, 38),
            dispoPartielle: hsl(28, 85, 58),
            dispoTous:  hsl(145, 50, 50),
            enAttente:  hsl(33, 90, 55),
            notification: hsl(0, 80, 50), // required by React Navigation
        };
    }

    return {
        primary:    hsl(h, 50, 85),
        secondary:  hsl(h, 40, 55),
        background: hsl(h, 10, 90),
        card:       hsl(h, 15, 85),
        text:       hsl(h, 20, 5),
        muted:      hsl(h, 24, 55),
        border:     hsl(h, 20, 25),
        error:      hsl(0, 60, 40),
        success:    hsl(90, 60, 40),
        warning:    hsl(50, 60, 40),
        disponible: hsl(205, 75, 45),
        indisponible: hsl(0, 75, 80),
        groupe:     hsl(170, 50, 75),
        or:         hsl(45, 90, 62),
        dispoPartielle: hsl(28, 90, 50),
        dispoTous:  hsl(145, 55, 38),
        enAttente:  hsl(33, 100, 55),
        notification: hsl(0, 80, 50), // required by React Navigation
    };
}