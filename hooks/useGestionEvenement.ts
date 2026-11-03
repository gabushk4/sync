import { DateTime } from "luxon";
import { useTranslation } from "react-i18next";
import { Alert } from "react-native";

import { useAPI } from "@/contextes/contexteAPI";
import { useAccessToken } from "@/contextes/contexteToken";

import ToastAbs from "@/abstractions/toastAbs";
import { toastTypes } from "@/constants/toastConfig";
import catcher from "@/functions/catcher";
import { convertLocalToUTC } from "@/functions/convertirUTCenLocal";
import formaterDatePourServeur from "@/functions/formaterDatePourServeur";
import log from "@/functions/log";
import { Event } from "@/types/calendar";
import { UrlDescriptor } from "@/types/url";

/**
 * What the member can do to an event they're part of, by their role on it: an editor
 * (the creator) deletes it — the whole series or this occurrence for a recurring
 * event — and anyone else leaves it. Shared by the details page and an event
 * notification's unfolded card.
 *
 * @author Philip — rectification (taken out of the details page)
 * @author Philip — user story 20 (review): deleting one occurrence ("this one") never
 *   worked — the API reads `debut_occurence` and got `date_occurence` (400) — and it
 *   would have cancelled the FIRST occurrence: GET /evenements/:id sends the series'
 *   start, so the occurrence that was opened is passed as `occurrence`
 * @param {Event} event - The loaded event (its `privilege_membre`).
 * @param {{ onTermine: () => void, occurrence?: { debut: DateTime, fin: DateTime } }} options -
 *   `onTermine`: called once deleted / left. `occurrence`: the occurrence opened (local),
 *   defaults to the event's own dates.
 * @returns {{ estEditeur: boolean, supprimerOuQuitter: () => void }}
 */
export default function useGestionEvenement(event: Event, { onTermine, occurrence }: { onTermine: () => void, occurrence?: { debut: DateTime, fin: DateTime } }) {
    const { t } = useTranslation('events')
    const { api } = useAPI()
    const { getToken } = useAccessToken()

    const estEditeur = event.privilege_membre === 'editeur'

    const verifAvantDelete = ()=>{
        // GET /evenements/:id sends the rule, not `type`: a recurring event opened from
        // its details used to delete the whole series without asking.
        if (event.type === "recurrence" || !!event.regle_recurrence) {
            Alert.alert(t('details.recurringEditTitle'), t('details.recurringEditMessage'),
                [
                    {text:t('details.editSeries'), onPress:()=>{
                        const url = {
                            method: 'DELETE',
                            string: `/evenements/${event.id}`,
                            data: {}
                        };
                        deleteEvenement(url)
                    }},
                    {text:t('details.editOccurrence'), onPress:()=>{
                        const debutOcc = occurrence?.debut ?? event.debut
                        const finOcc = occurrence?.fin ?? event.fin
                        const url = {
                            method: 'POST',
                            string: '/evenements/exceptions/',
                            data: {
                                id_parent:event.id,
                                debut_occurence:formaterDatePourServeur(convertLocalToUTC(debutOcc)),
                                debut:formaterDatePourServeur(convertLocalToUTC(debutOcc)),
                                fin:formaterDatePourServeur(convertLocalToUTC(finOcc)),
                                type: 'annule'
                            }
                        };
                        log("url avant delete", url)
                        deleteEvenement(url)
                    }, isPreferred:true}
                ]
            )
        }
        else{
            const url = {
                method: 'DELETE',
                string: `/evenements/${event.id}`,
                data: {}
            };
            deleteEvenement(url)
        }
    }

    const deleteEvenement = async (url:UrlDescriptor)=>{
        try {
            const token = await getToken()
            const reponse = await api.request(
                {
                    method:url.method,
                    url:url.string,
                    ...(url.data?{data:url.data}:{}),
                    headers: {
                        'Authorization':`Bearer ${token}`,
                    },
                }
            )

            log('evenements supprimé', reponse.status)

            ToastAbs.show({
                type:toastTypes.success,
                text1:t('details.deletedTitle'),
                text2:t('details.deletedMessage'),
                position:'top'
            })
            onTermine()
        } catch (error) {
            log('erreur en supprimant l\'évènement', error)
            catcher(error, t('errors.deleteFailed'))
        }
    }

    const quitterEvenement = async ()=>{
        try {
            const reponse = await api.post(`/evenements/${event.id}/quitter`, {})
            if(reponse.status === 201){
                ToastAbs.show({
                    type:toastTypes.success,
                    text2:reponse.data.message
                })
                onTermine()
            }
        } catch (error) {
            catcher(error, t('errors.leaveFailed'))
        }
    }

    const supprimerOuQuitter = () => {
        if (estEditeur) verifAvantDelete()
        else quitterEvenement()
    }

    return { estEditeur, supprimerOuQuitter }
}
