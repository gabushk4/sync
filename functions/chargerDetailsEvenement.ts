import { AxiosInstance } from 'axios'
import { DateTime } from 'luxon'

import { convertLocalToUTC, convertUTCToLocal } from '@/functions/convertirUTCenLocal'
import formaterDatePourServeur from '@/functions/formaterDatePourServeur'
import { Event } from '@/types/calendar'

/**
 * Loads an event (GET /evenements/:id) for the occurrence between `start` and `end`
 * (ISO, local; now and in an hour by default), dates converted to local. Its
 * `privilege_membre` ('editeur' for the creator) decides what the member can do.
 * Shared by the details page and an event notification's unfolded card.
 *
 * @author Philip — rectification (taken out of the details page)
 * @param {AxiosInstance} api
 * @param {string} id - Public id of the event.
 * @param {string} [timezone] - The member's timezone.
 * @param {string} [start] - Start of the occurrence (ISO).
 * @param {string} [end] - End of the occurrence (ISO).
 * @returns {Promise<Event>}
 */
export default async function chargerDetailsEvenement(api: AxiosInstance, id: string, timezone?: string, start?: string, end?: string): Promise<Event> {
    const res = await api.request({
        method: "GET",
        url: `/evenements/${id}`,
        params: {
            debut: formaterDatePourServeur(convertLocalToUTC(start ?? DateTime.now())),
            fin: formaterDatePourServeur(convertLocalToUTC(end ?? DateTime.now().plus({ hour: 1 }))),
        }
    })

    res.data.debut = convertUTCToLocal(res.data.debut, timezone)
    res.data.fin = convertUTCToLocal(res.data.fin, timezone)
    return res.data
}
