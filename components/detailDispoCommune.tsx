import Ionicons from '@react-native-vector-icons/ionicons'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import ConfirmationEnvoi from '@/components/confirmationEnvoi'
import { useFont } from '@/contextes/contexteFont'
import { usePalette } from '@/contextes/contextePalette'
import { convertirTimestampHeure } from '@/functions/convertirTimestamp'
import { BlocDispo, SegmentDispo } from '@/functions/disponibilitesCommunes'
import { Creneau } from '@/hooks/useReportEvenement'

/** Whether a range of the block can be proposed (null: the member can't propose at all). */
export type EtatSegment = 'proposable' | 'dejaPropose' | 'passe' | null

type Props = {
    bloc: BlocDispo
    /** Can this range be proposed? Without it, the ranges can't be picked. */
    etatSegment?: (segment: SegmentDispo) => EtatSegment
    /** The slot to send for a range (from now on when it already started). */
    creneauDuSegment?: (segment: SegmentDispo) => Creneau | null
    /** Proposed while no range is picked: the slot of GET /postpone the block holds (member's row). */
    creneauParDefaut?: Creneau | null
    /** Shown while no range is picked (e.g. that slot is already proposed). */
    noteParDefaut?: string
    /** "Tue 12 Nov from 14:00 to 15:00" (useReportEvenement). */
    plage: (debut: string, fin: string) => string
    /** Being sent (spinner). */
    enCours: boolean
    /** Sends a slot (the screen's envoyerCreneau, then closes the modal). */
    onProposer: (creneau: Creneau) => void
}

/**
 * Details of a common availability of the invitation review, in the modal opened by
 * tapping its block (the block only shows the count): partial or everyone, its exact
 * times, then its exact ranges — split wherever someone joins or leaves — each with how
 * many are free and who. Tapping a range picks it; "Propose" sends it (confirmed in
 * place). A partial block where everyone is free for a while says that stretch is
 * shorter than the event.
 *
 * @author Philip — invitation review: common availabilities placed on their exact times
 * @author Philip — in a modal (dataRenderer) instead of a card between the rows; each
 *   exact range proposable
 * @param {Props} props
 * @returns {JSX.Element}
 */
export default function DetailDispoCommune({ bloc, etatSegment, creneauDuSegment, creneauParDefaut = null, noteParDefaut, plage, enCours, onProposer }: Props) {
    const { t } = useTranslation('events')
    const { colors } = usePalette()
    const { fonts } = useFont()
    // Start (ms) of the range picked to propose.
    const [segmentChoisi, setSegmentChoisi] = useState<number | null>(null)

    const couleur = bloc.tous ? colors.dispoTous : colors.dispoPartielle
    const heures = (debut: BlocDispo['debut'], fin: BlocDispo['fin']) => `${convertirTimestampHeure(debut)}–${convertirTimestampHeure(fin)}`
    // Partial although everyone is free at some point: not as long as the event.
    const tropCourt = !bloc.tous && bloc.segments.some((sg) => sg.ids.length === bloc.total)
    const etats = bloc.segments.map((sg) => etatSegment?.(sg) ?? null)

    const segment = bloc.segments.find((sg, i) => sg.debut.toMillis() === segmentChoisi && etats[i] === 'proposable')
    const aProposer = segment ? creneauDuSegment?.(segment) ?? null : creneauParDefaut

    const s = StyleSheet.create({
        contenu: { flex: 1, gap: 6, paddingBottom: 8 },
        entete: { flexDirection: 'row', alignItems: 'center', gap: 8 },
        pastille: { width: 12, height: 12, borderRadius: 6, backgroundColor: couleur },
        titre: { flex: 1, color: colors.text, fontFamily: fonts.title, fontSize: 16 },
        plages: { flexGrow: 0, flexShrink: 1 },
        ligne: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingVertical: 8,
            paddingHorizontal: 8,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: 'transparent',
        },
        ligneProposable: { borderColor: colors.border },
        ligneChoisie: { borderColor: colors.secondary, backgroundColor: colors.primary },
        texteLigne: { flex: 1, color: colors.text, fontFamily: fonts.body, fontSize: 14 },
        heures: { fontFamily: fonts.number },
        note: { color: colors.muted, fontFamily: fonts.body, fontSize: 12 },
    })

    return (
        <View style={s.contenu}>
            <View style={s.entete}>
                <View style={s.pastille} />
                <Text style={s.titre} numberOfLines={1}>
                    {t(bloc.tous ? 'invitationReview.availabilityAll' : 'invitationReview.availabilityPartial')} · {heures(bloc.debut, bloc.fin)}
                </Text>
            </View>
            {/* Many people join and leave in a big group: the ranges scroll. */}
            <ScrollView style={s.plages} contentContainerStyle={{ gap: 4 }} showsVerticalScrollIndicator>
                {bloc.segments.map((sg, i) => {
                    const etat = etats[i]
                    const choisie = segmentChoisi === sg.debut.toMillis()
                    const texte = (
                        <Text style={[s.texteLigne, etat !== null && etat !== 'proposable' && { color: colors.muted }]}>
                            <Text style={s.heures}>{heures(sg.debut, sg.fin)} · </Text>
                            {t('invitationReview.availablePeople', { compte: `${sg.ids.length}/${bloc.total}`, noms: sg.noms.join(', ') })}
                            {etat === 'dejaPropose' && ` · ${t('invitationReview.rangeAlreadyProposed')}`}
                        </Text>
                    )
                    return etat === 'proposable' ? (
                        <TouchableOpacity
                            key={sg.debut.toMillis()}
                            style={[s.ligne, s.ligneProposable, choisie && s.ligneChoisie]}
                            onPress={() => setSegmentChoisi(choisie ? null : sg.debut.toMillis())}
                            disabled={enCours}
                            accessibilityRole="radio"
                            accessibilityState={{ selected: choisie }}
                        >
                            {texte}
                            <Ionicons name={choisie ? 'radio-button-on' : 'radio-button-off'} size={18} color={colors.text} />
                        </TouchableOpacity>
                    ) : (
                        <View key={sg.debut.toMillis()} style={s.ligne}>{texte}</View>
                    )
                })}
            </ScrollView>
            {tropCourt && <Text style={s.note}>{t('invitationReview.allTooShort')}</Text>}
            {!segment && !!noteParDefaut && <Text style={s.note}>{noteParDefaut}</Text>}
            {aProposer && (
                <ConfirmationEnvoi
                    libelle={segment ? t('invitationReview.proposeRange', { plage: plage(aProposer.debut, aProposer.fin) }) : t('postpone.propose')}
                    question={t('postpone.confirmPropose', { plage: plage(aProposer.debut, aProposer.fin) })}
                    enCours={enCours}
                    onConfirmer={() => onProposer(aProposer)}
                />
            )}
        </View>
    )
}
