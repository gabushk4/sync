import { DateTime } from 'luxon'
import { useSyncExternalStore } from 'react'

const INTERVALLE_MS = 30_000

/**
 * One clock for the whole app: a single setInterval, started with the first component
 * that uses it and stopped with the last. Each consumer re-renders every 30 s, but
 * only THAT component: the screen that hosts it doesn't (before, the clock was a
 * useState of the home screen, so the whole screen redrew every 30 s).
 */
let instant = DateTime.now()
let minuterie: ReturnType<typeof setInterval> | null = null
const abonnes = new Set<() => void>()

function abonner(rappel: () => void) {
    abonnes.add(rappel)
    if (!minuterie) {
        minuterie = setInterval(() => {
            instant = DateTime.now()
            abonnes.forEach((fn) => fn())
        }, INTERVALLE_MS)
    }
    return () => {
        abonnes.delete(rappel)
        if (abonnes.size === 0 && minuterie) {
            clearInterval(minuterie)
            minuterie = null
        }
    }
}

const lireInstant = () => instant

/**
 * @returns {DateTime} The current time, refreshed every 30 s.
 */
export function useInstantCourant(): DateTime {
    return useSyncExternalStore(abonner, lireInstant)
}