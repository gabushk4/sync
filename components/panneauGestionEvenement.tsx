import Icon from '@react-native-vector-icons/ionicons'
import { router } from 'expo-router'
import { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import ListeParticipantsStatut from '@/components/listeParticipantsStatut'
import PanneauDecisionInvitation from '@/components/panneauDecisionInvitation'
import PanneauReport from '@/components/panneauReport'
import Spinner from '@/components/spinner'
import { useFont } from '@/contextes/contexteFont'
import { usePalette } from '@/contextes/contextePalette'
import { convertirTimestampDateCourte, convertirTimestampHeure } from '@/functions/convertirTimestamp'
import ouvrirRevueInvitation from '@/functions/ouvrirRevueInvitation'
import useDecisionInvitation from '@/hooks/useDecisionInvitation'
import useGestionEvenement from '@/hooks/useGestionEvenement'
import { defaultEvent, Event } from '@/types/calendar'
import { InvitationInfo } from '@/types/invitation'

type Props = {
    /** Public id of the event the notification is about. */
    idEvenement: string
    /** The event, loaded by the card (null while loading), see useDetailsEvenement. */
    event: Event | null
    /** The event can't be read (e.g. deleted since). */
    erreur: boolean
    /** Reloads the event (moved by the creator). */
    recharger: () => void
    /** The event is already over: nothing left to do but delete it (creator). */
    passe: boolean
    /** The invitation, only while it awaits the member's answer (not expired). */
    invitation: InvitationInfo | null
    /** The member never answered and the invitation expired: nothing to do anymore. */
    invitationExpiree: boolean
    /** The member left the event (invitation 'annulee'): nothing to do anymore. */
    quitte?: boolean
    /** The card's decision logic (accept / refuse, conflict screen). */
    decision: ReturnType<typeof useDecisionInvitation>
    /** The event was deleted / left: the feed refreshes. */
    onTermine: () => void
    /** The answer ("accepted"…), on the date's line (no row of its own above). */
    statut?: ReactNode
}

/**
 * Managing an event right in its unfolded notification, instead of opening the
 * details page: when and what, then the same panels and actions as that page, by
 * the member's real role on the event (`privilege_membre`, from the API):
 * - invitation awaiting an answer: who invited, the participants, "adjust my
 *   schedule", accept / refuse and proposing another time (PanneauDecisionInvitation);
 * - creator (editor): the participants and their answer, moving it to a date and time,
 *   the postponement proposals to apply, edit and delete;
 * - participant (accepted): the participants and their answer, voting on the
 *   postponement proposals (no proposing once in the event), and leaving.
 * An expired invitation or a left event offers nothing, and a past event only its
 * deletion (creator).
 *
 * @author Philip — rectification (event managed from its notification)
 * @author Philip — rectification: a left event reads "cancelled", without actions
 * @author Philip — "propose another time" back here: a date and time picker, sent in
 *   place (PanneauReport `plageActuelle`) — not once accepted (the API's `peut_proposer`)
 * @author Philip — the participants' list (ListeParticipantsStatut) once accepted too
 * @param {Props} props
 * @returns {JSX.Element}
 */
export default function PanneauGestionEvenement({ idEvenement, event, erreur, recharger, passe, invitation, invitationExpiree, quitte = false, decision, onTermine, statut }: Props) {
    const { t } = useTranslation('events')
    const { t: tNotifs } = useTranslation('notifications')
    const { colors } = usePalette()
    const { fonts } = useFont()

    const gestion = useGestionEvenement(event ?? defaultEvent, { onTermine })

    // The feed stack's edit: saving comes back to the notification, which reloads.
    const modifier = () => {
        if (!event) return
        router.push({ pathname: '/(tabs)/feed/edit/[event]', params: { event: JSON.stringify(event) } } as any)
    }

    const s = StyleSheet.create({
        // Tighter than before: the card's message is right above (no status row between).
        panneau: { gap: 8, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 8 },
        // The date, and the answer at its right.
        ligneQuand: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
        quand: { flexShrink: 1, color: colors.text, fontFamily: fonts.number, fontSize: 15 },
        description: { color: colors.muted, fontFamily: fonts.body, fontSize: 14 },
        boutons: { flexDirection: 'row', gap: 8 },
        bouton: {
            flex: 1,
            height: 46,
            borderRadius: 10,
            borderWidth: 1,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 6,
            backgroundColor: colors.card,
        },
        texteBouton: { fontFamily: fonts.title, fontSize: 14 },
    })

    if (erreur) {
        return <View style={s.panneau}><Text style={s.description}>{t('errors.loadFailed')}</Text></View>
    }
    if (!event) {
        return <View style={s.panneau}><Spinner size={22} color={colors.muted} style={{ alignSelf: 'center' }} /></View>
    }

    const debut = event.debut
    const fin = event.fin
    // "Propose another time" starts from it and keeps its duration.
    const plageActuelle = debut && fin ? { debut, fin } : undefined
    const quand = debut && fin
        ? debut.hasSame(fin, 'day')
            ? `${convertirTimestampDateCourte(debut)}, ${convertirTimestampHeure(debut)} – ${convertirTimestampHeure(fin)}`
            : `${convertirTimestampDateCourte(debut)} ${convertirTimestampHeure(debut)} – ${convertirTimestampDateCourte(fin)} ${convertirTimestampHeure(fin)}`
        : null

    const actions = () => {
        if (quitte) return <Text style={s.description}>{tNotifs('expiration.left')}</Text>
        // Too late to answer, or over: only the creator can still clear it away.
        if (invitationExpiree || passe) {
            return (
                <>
                    <Text style={[s.description, { color: colors.warning }]}>
                        {invitationExpiree ? tNotifs('expiration.invitationExpired') : tNotifs('expiration.eventPast')}
                    </Text>
                    {passe && gestion.estEditeur && (
                        <View style={s.boutons}>
                            <TouchableOpacity style={[s.bouton, { borderColor: colors.error }]} onPress={gestion.supprimerOuQuitter} accessibilityRole="button">
                                <Icon name="trash-sharp" color={colors.error} size={18} />
                                <Text style={[s.texteBouton, { color: colors.error }]}>{t('conflict.delete')}</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </>
            )
        }
        if (invitation) {
            return (
                <PanneauDecisionInvitation
                    integre
                    idEvenement={idEvenement}
                    organisateur={invitation.pseudo_invitant}
                    voirHoraire={() => ouvrirRevueInvitation(invitation)}
                    accepter={decision.accepter}
                    refuser={decision.refuser}
                    enCours={decision.enCours}
                >
                    {/* Proposing another time (date + time) and voting (user story 23). */}
                    <PanneauReport idEvenement={idEvenement} integre plageActuelle={plageActuelle} />
                </PanneauDecisionInvitation>
            )
        }
        return (
            <>
                {/* Who's coming, with their answer — also once the member accepted. */}
                <ListeParticipantsStatut idEvenement={idEvenement} />
                {/* Participant (accepted): votes on the proposals, doesn't propose (the API's
                    `peut_proposer`); creator: move it to a date and time or apply a
                    proposal (user story 23). */}
                <PanneauReport idEvenement={idEvenement} integre onPlageChangee={recharger} plageActuelle={plageActuelle} />
                <View style={s.boutons}>
                    {gestion.estEditeur && (
                        <TouchableOpacity style={[s.bouton, { borderColor: colors.secondary }]} onPress={modifier} accessibilityRole="button">
                            <Icon name="pencil" color={colors.text} size={18} />
                            <Text style={[s.texteBouton, { color: colors.text }]}>{t('navigation.edit')}</Text>
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity style={[s.bouton, { borderColor: colors.error }]} onPress={gestion.supprimerOuQuitter} accessibilityRole="button">
                        <Icon name={gestion.estEditeur ? 'trash-sharp' : 'exit-outline'} color={colors.error} size={18} />
                        <Text style={[s.texteBouton, { color: colors.error }]}>
                            {gestion.estEditeur ? t('conflict.delete') : t('conflict.leave')}
                        </Text>
                    </TouchableOpacity>
                </View>
            </>
        )
    }

    return (
        <View style={s.panneau}>
            {(quand || statut) && (
                <View style={s.ligneQuand}>
                    {quand ? <Text style={s.quand}>{quand}</Text> : <View />}
                    {statut}
                </View>
            )}
            {!!event.description && <Text style={s.description} numberOfLines={4}>{event.description}</Text>}
            {actions()}
        </View>
    )
}
