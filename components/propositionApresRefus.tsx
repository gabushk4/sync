import Ionicons from '@react-native-vector-icons/ionicons'
import { DateTime } from 'luxon'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import SelecteurReport from '@/components/selecteurReport'
import Spinner from '@/components/spinner'
import { useFont } from '@/contextes/contexteFont'
import { usePalette } from '@/contextes/contextePalette'
import { modalEvents } from '@/events/modalEvents'
import useReportEvenement, { Creneau } from '@/hooks/useReportEvenement'

/** Key of this content in the generic modal (`/(modals)/dataRenderer`). */
export const CLE_MODAL_APRES_REFUS = 'propositionApresRefus'

type Props = {
    /** Public id of the refused event. */
    idEvenement: string
    /** Its title, to remind which event it is. */
    titre: string
    /** Its time (local): the picker's default start, and the duration kept. */
    plageActuelle: { debut: DateTime, fin: DateTime }
}

/** 'question': "propose another date?"; 'choix': the date and time; 'envoye': sent. */
type Etape = 'question' | 'choix' | 'envoye'

/**
 * Shown right after an invitation is refused, in the generic modal (the feed's card
 * leaves the list once refused, the decision page goes back to the timeline: the modal
 * is a route of its own, it outlives both): "would you like to propose another date?".
 * Yes: a date and a time, the event's duration kept (SelecteurReport), sent as a
 * postponement proposal — the participants vote, and if the organizer applies it every
 * invitee is asked again, the member too. No (or swiping the modal down): nothing more,
 * the invitation stays refused.
 * Opened by useDecisionInvitation only when the API allows it (`peut_proposer`: not a
 * recurring event, not over).
 *
 * @author Philip — user story 23 (a postponement proposal offered on refusal)
 * @param {Props} props
 * @returns {JSX.Element}
 */
export default function PropositionApresRefus({ idEvenement, titre, plageActuelle }: Props) {
    const { t } = useTranslation('events')
    const { colors } = usePalette()
    const { fonts } = useFont()

    const { donnees, enCours, plage, envoyerCreneau } = useReportEvenement(idEvenement)
    const [etape, setEtape] = useState<Etape>('question')

    // ModalBase closes itself (slides down, then leaves the route).
    const fermer = () => modalEvents.emitClosing()

    /**
     * Sends the picked time as a proposal. No toast: this modal says it was sent (its
     * toast would vanish with the modal's route).
     *
     * @param {Creneau} creneau
     * @returns {Promise<boolean>} Whether it was sent.
     */
    const envoyer = async (creneau: Creneau) => {
        const envoye = await envoyerCreneau(creneau, { annoncer: false })
        if (envoye) setEtape('envoye')
        return envoye
    }

    const s = StyleSheet.create({
        contenu: { gap: 12, paddingTop: 4 },
        titreEvenement: { color: colors.muted, fontFamily: fonts.body, fontSize: 15, textAlign: 'center' },
        question: { color: colors.text, fontFamily: fonts.title, fontSize: 18, textAlign: 'center' },
        aide: { color: colors.muted, fontFamily: fonts.body, fontSize: 13, textAlign: 'center' },
        bouton: {
            height: 46,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: colors.secondary,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 6,
        },
        texteBouton: { color: colors.text, fontFamily: fonts.title, fontSize: 14 },
        lien: { alignSelf: 'center', paddingVertical: 4 },
        texteLien: { color: colors.muted, fontFamily: fonts.body, fontSize: 15, textDecorationLine: 'underline' },
        envoye: { alignItems: 'center', gap: 6 },
    })

    if (etape === 'envoye') {
        return (
            <View style={s.contenu}>
                <View style={s.envoye}>
                    <Ionicons name="checkmark-circle" size={40} color={colors.success} />
                    <Text style={s.question}>{t('postpone.sentTitle')}</Text>
                    <Text style={s.aide}>{t('postpone.sentMessage')}</Text>
                </View>
                <TouchableOpacity style={s.bouton} onPress={fermer} accessibilityRole="button">
                    <Text style={s.texteBouton}>{t('invitationDecision.done')}</Text>
                </TouchableOpacity>
            </View>
        )
    }

    if (etape === 'choix') {
        return (
            <View style={s.contenu}>
                <Text style={s.titreEvenement} numberOfLines={1}>{titre}</Text>
                {donnees ? (
                    <SelecteurReport
                        toujoursOuvert
                        plageActuelle={plageActuelle}
                        deplacement={false}
                        enCours={enCours === 'creneau'}
                        plage={plage}
                        onEnvoyer={envoyer}
                    />
                ) : (
                    <Spinner size={24} color={colors.muted} style={{ alignSelf: 'center' }} />
                )}
                <TouchableOpacity style={s.lien} onPress={fermer} disabled={!!enCours} accessibilityRole="button">
                    <Text style={s.texteLien}>{t('postpone.cancel')}</Text>
                </TouchableOpacity>
            </View>
        )
    }

    return (
        <View style={s.contenu}>
            <Text style={s.titreEvenement} numberOfLines={1}>{titre}</Text>
            <Text style={s.question}>{t('invitationDecision.proposeQuestion')}</Text>
            <Text style={s.aide}>{t('invitationDecision.proposeHint')}</Text>
            <TouchableOpacity style={s.bouton} onPress={() => setEtape('choix')} accessibilityRole="button">
                <Ionicons name="calendar-outline" size={18} color={colors.text} />
                <Text style={s.texteBouton}>{t('invitationDecision.proposeYes')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.lien} onPress={fermer} accessibilityRole="button">
                <Text style={s.texteLien}>{t('invitationDecision.proposeNo')}</Text>
            </TouchableOpacity>
        </View>
    )
}
