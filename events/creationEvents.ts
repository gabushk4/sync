import { DateTime } from 'luxon'

/** The time range of what was just created (local DateTimes). */
export type PlageCreee = { debut: DateTime, fin: DateTime }

/** Told every range created (the home screen). */
type Ecouteur = (plage: PlageCreee) => void

const ecouteurs = new Set<Ecouteur>()

/**
 * Time range of an event (or unavailability) just created, announced by the creation
 * page once the API created it, as it leaves. The home screen moves to it right away,
 * while it's still hidden under the creation screen, so going back shows the timeline on
 * what was created — instead of where it was before opening the creation (its kept
 * position). Same pattern as calendrierEvents.
 *
 * @author Philip — back on the created event's time range after a creation
 */
export const creationEvents = {
    /**
     * Something was created over `plage`: tells the listeners.
     *
     * @param {PlageCreee} plage
     * @returns {void}
     */
    creee: (plage: PlageCreee) => {
        ecouteurs.forEach((ecouteur) => ecouteur(plage))
    },

    /**
     * Calls `ecouteur` with every range created from now on.
     *
     * @param {(plage: PlageCreee) => void} ecouteur
     * @returns {() => void} Unsubscribes.
     */
    abonner: (ecouteur: Ecouteur): (() => void) => {
        ecouteurs.add(ecouteur)
        return () => { ecouteurs.delete(ecouteur) }
    },
}
