import Ionicons from '@react-native-vector-icons/ionicons'
import { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import ListeParticipantsStatut from '@/components/listeParticipantsStatut'
import Spinner from '@/components/spinner'
import { useFont } from '@/contextes/contexteFont'
import { usePalette } from '@/contextes/contextePalette'

type Props = {
    /** Public id of the invited event. */
    idEvenement: string
    /** Pseudo of the member who sent the invitation. */
    organisateur: string
    /** "Adjust my schedule": the invitation review (everyone's schedule that day). */
    voirHoraire: () => void
    accepter: () => void
    refuser: () => void
    /** The answer being sent (spinner on its button, every button disabled), or false. */
    enCours: false | 'acceptee' | 'refusee'
    /** Shown under the participants: the postponement proposals (Philip — user story 23). */
    children?: ReactNode
    /** Inside a notification's card: no background nor padding of its own, like PanneauReport. */
    integre?: boolean
}

/**
 * Bottom panel of the decision page (an invited event opened from the invitation
 * review or from the feed): who invited the member, a drop-down list of the event's
 * participants with their answer, "adjust my schedule" (the invitation review), and
 * the decision — accept or refuse (see useDecisionInvitation).
 *
 * @author Philip — user story 8 (answering an invitation in conflict); user story 23
 *   (children: proposing another time, see PanneauReport)
 * @author Philip — the participants' list moved to ListeParticipantsStatut (also shown once
 *   accepted)
 * @param {Props} props
 * @returns {JSX.Element}
 */
export default function PanneauDecisionInvitation({ idEvenement, organisateur, voirHoraire, accepter, refuser, enCours, children, integre = false }: Props) {
    const { t } = useTranslation('events')
    const { colors } = usePalette()
    const { fonts } = useFont()

    const s = StyleSheet.create({
        panneau: integre ? { gap: 10 } : {
            backgroundColor: colors.card,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderColor: colors.border,
            paddingHorizontal: 16,
            paddingTop: 10,
            paddingBottom: 90, // room for the tab bar's FAB area
            gap: 10,
        },
        organisateur: { flexDirection: 'row', alignItems: 'center', gap: 6 },
        texteOrganisateur: { color: colors.muted, fontFamily: fonts.body, fontSize: 14 },
        nomOrganisateur: { color: colors.text, fontFamily: fonts.title },
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
        },
        texteBouton: { fontFamily: fonts.title, fontSize: 14 },
    })

    return (
        <View style={s.panneau}>
            <View style={s.organisateur}>
                <Ionicons name="star" size={16} color={colors.warning} />
                <Text style={s.texteOrganisateur}>
                    {t('invitationDecision.invitedBy')} <Text style={s.nomOrganisateur}>{organisateur}</Text>
                </Text>
            </View>

            {/* Participants and their answer, folded by default. */}
            <ListeParticipantsStatut idEvenement={idEvenement} />

            {children}

            <TouchableOpacity style={[s.bouton, { flex: 0, borderColor: colors.secondary }]} onPress={voirHoraire} disabled={!!enCours}>
                <Ionicons name="time-outline" size={18} color={colors.text} />
                <Text style={[s.texteBouton, { color: colors.text }]}>{t('conflict.adjust')}</Text>
            </TouchableOpacity>
            <View style={s.boutons}>
                <TouchableOpacity style={[s.bouton, { borderColor: colors.success }]} onPress={accepter} disabled={!!enCours}>
                    {enCours === 'acceptee'
                        ? <Spinner size={18} color={colors.success} />
                        : <Ionicons name="checkmark" size={18} color={colors.success} />}
                    <Text style={[s.texteBouton, { color: colors.success }]}>{t('invitationDecision.accept')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.bouton, { borderColor: colors.error }]} onPress={refuser} disabled={!!enCours}>
                    {enCours === 'refusee'
                        ? <Spinner size={18} color={colors.error} />
                        : <Ionicons name="close" size={18} color={colors.error} />}
                    <Text style={[s.texteBouton, { color: colors.error }]}>{t('invitationDecision.refuse')}</Text>
                </TouchableOpacity>
            </View>
        </View>
    )
}
