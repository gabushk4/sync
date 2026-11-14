import { DateTime } from 'luxon'

import { applyBusyTimes } from '@/functions/availability'

/** One participant of the computation. */
export type PersonneDispo = {
    id: string
    /** Name shown in the blocks ("Me" for the member). */
    nom: string
    /** What makes them busy (local DateTimes); holidays (`jour_ferie`) don't count. */
    occupations: { debut?: DateTime, fin?: DateTime, jour_ferie?: unknown }[]
}

/** A piece of a block where the same people are free. */
export type SegmentDispo = {
    debut: DateTime
    fin: DateTime
    ids: string[]
    noms: string[]
}

/** A common availability in one participant's row. */
export type BlocDispo = {
    debut: DateTime
    fin: DateTime
    /** Every participant free (green); otherwise partial (orange: at least 2, not all). */
    tous: boolean
    /** Same people free over each piece: one piece while nobody joins or leaves. */
    segments: SegmentDispo[]
    /** Participants counted. */
    total: number
}

/**
 * Common availabilities of a day: the minutes where at least 2 participants are free at
 * once, per participant — each one's blocks are where they are free and at least one
 * other is too, so a block only shows in the rows of the people free then. A block is
 * split only where it goes from partial (at least 2, not all) to everyone free, or back;
 * the people free inside it can change otherwise (its `segments`).
 * "Everyone free" only counts for at least `dureeMinTous` minutes in a row (the event's
 * duration): a shorter stretch where everyone is free is partial, part of the blocks
 * around it — the event wouldn't fit there with everyone.
 *
 * @author Philip — invitation review: common availabilities placed on their exact times
 * @author Philip — `dureeMinTous`: everyone free for less than the event's duration is partial
 * @param {PersonneDispo[]} personnes - Every participant (the member included).
 * @param {DateTime} jour - Any moment of the day to compute (member's timezone).
 * @param {{ dureeMinTous?: number }} [options] - Shortest "everyone free" stretch, in minutes (0: any).
 * @returns {Map<string, BlocDispo[]>} Each participant's blocks, by id, earliest first.
 */
export function disponibilitesCommunes(
    personnes: PersonneDispo[],
    jour: DateTime,
    { dureeMinTous = 0 }: { dureeMinTous?: number } = {},
): Map<string, BlocDispo[]> {
    const resultat = new Map<string, BlocDispo[]>(personnes.map((p) => [p.id, []]))
    const total = personnes.length
    if (total < 2) return resultat

    const debutJour = jour.startOf('day')
    // 1440 minutes, or 1380 / 1500 on a daylight saving day (like getCommonFreeSlots).
    const minutes = Math.round(debutJour.plus({ days: 1 }).diff(debutJour, 'minutes').minutes)

    const libres = personnes.map((p) => {
        const bitmap = new Uint8Array(minutes).fill(1)
        applyBusyTimes(bitmap, p.occupations, debutJour)
        return bitmap
    })

    // Per minute: how many are free, and who ('1' / '0' per participant, in order).
    const compte = new Uint16Array(minutes)
    const cles: string[] = new Array(minutes)
    for (let m = 0; m < minutes; m++) {
        let cle = ''
        for (const bitmap of libres) {
            if (bitmap[m] === 1) {
                compte[m]++
                cle += '1'
            } else {
                cle += '0'
            }
        }
        cles[m] = cle
    }

    // Per minute: everyone free, in a stretch at least `dureeMinTous` long (the same for
    // every row). Bounded by the day: a stretch going on past midnight counts up to it.
    const tousValide = new Uint8Array(minutes)
    for (let m = 0; m < minutes;) {
        if (compte[m] !== total) { m++; continue }
        let fin = m
        while (fin < minutes && compte[fin] === total) fin++
        if (fin - m >= dureeMinTous) tousValide.fill(1, m, fin)
        m = fin
    }

    const versDate = (m: number) => debutJour.plus({ minutes: m })
    const segment = ({ debut, fin, cle }: { debut: number, fin: number, cle: string }): SegmentDispo => {
        const presents = personnes.filter((_, i) => cle[i] === '1')
        return { debut: versDate(debut), fin: versDate(fin), ids: presents.map((p) => p.id), noms: presents.map((p) => p.nom) }
    }

    personnes.forEach((personne, i) => {
        const blocs = resultat.get(personne.id)!
        let courant: { debut: number, tous: boolean, segments: { debut: number, fin: number, cle: string }[] } | null = null
        // `<= minutes`: the last turn closes a block still open at midnight.
        for (let m = 0; m <= minutes; m++) {
            const actif = m < minutes && libres[i][m] === 1 && compte[m] >= 2
            const tous = actif && tousValide[m] === 1
            if (courant && (!actif || tous !== courant.tous)) {
                blocs.push({
                    debut: versDate(courant.debut),
                    fin: versDate(m),
                    tous: courant.tous,
                    segments: courant.segments.map(segment),
                    total,
                })
                courant = null
            }
            if (!actif) continue
            if (!courant) courant = { debut: m, tous, segments: [] }
            const dernier = courant.segments[courant.segments.length - 1]
            if (dernier && dernier.cle === cles[m]) dernier.fin = m + 1
            else courant.segments.push({ debut: m, fin: m + 1, cle: cles[m] })
        }
    })

    return resultat
}
