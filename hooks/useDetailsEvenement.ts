import { useCallback, useEffect, useState } from "react";

import { useAPI } from "@/contextes/contexteAPI";
import { useMembre } from "@/contextes/contexteMembre";
import chargerDetailsEvenement from "@/functions/chargerDetailsEvenement";
import { Event } from "@/types/calendar";

/**
 * Loads an event as soon as the component mounts (see chargerDetailsEvenement), so a
 * notification card knows before being tapped whether its event is already over,
 * and unfolds with it ready.
 *
 * @author Philip — rectification (event managed from its notification)
 * @param {string | null} idEvenement - Nothing is loaded without it.
 * @param {string} [debut] - Start of the occurrence (ISO), e.g. the invited one.
 * @param {string} [fin] - End of the occurrence (ISO).
 * @returns {{ event: Event | null, erreur: boolean, recharger: () => void }} `event`
 *   is null while loading; `erreur`: it can't be read (e.g. deleted since).
 */
export default function useDetailsEvenement(idEvenement: string | null, debut?: string, fin?: string) {
    const { api } = useAPI()
    const { membre } = useMembre()

    const [event, setEvent] = useState<Event | null>(null)
    const [erreur, setErreur] = useState(false)

    const recharger = useCallback(() => {
        if (!idEvenement) return
        chargerDetailsEvenement(api, idEvenement, membre.timezone, debut, fin)
            .then((charge) => {
                setEvent(charge)
                setErreur(false)
            })
            .catch(() => setErreur(true))
    }, [api, idEvenement, membre.timezone, debut, fin])

    useEffect(() => { recharger() }, [recharger])

    return { event, erreur, recharger }
}
