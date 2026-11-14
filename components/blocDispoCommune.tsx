import Ionicons from '@react-native-vector-icons/ionicons'
import { DateTime } from 'luxon'
import { useTranslation } from 'react-i18next'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Animated, { SharedValue } from 'react-native-reanimated'

import { useFont } from '@/contextes/contexteFont'
import { usePalette } from '@/contextes/contextePalette'
import { useTimeline } from '@/contextes/contexteTimeline'
import { convertirTimestampHeure } from '@/functions/convertirTimestamp'
import { BlocDispo } from '@/functions/disponibilitesCommunes'
import { positionHeures } from '@/functions/positionTimeline'
import useTimelineLabelOffset from '@/hooks/useTimelineLabelOffset'

/** Widest the label gets, and narrowest block that still shows one. */
const LARGEUR_TEXTE = 96
const LARGEUR_MIN_TEXTE = 22
const PAD = 4

/**
 * "3/4", or "2–3/4" when people join or leave during a partial block.
 *
 * @param {BlocDispo} bloc
 * @returns {string}
 */
export function compteDispo(bloc: BlocDispo): string {
    const comptes = bloc.segments.map((sg) => sg.ids.length)
    const min = Math.min(...comptes)
    const max = Math.max(...comptes)
    return `${min === max ? min : `${min}–${max}`}/${bloc.total}`
}

type Props = {
    bloc: BlocDispo
    /** The row's day (its midnight is the row's start). */
    jour: DateTime
    /** Shared scroll offset of the rows (the label sticks to the visible edge). */
    listOffset: SharedValue<number>
    /** Selected: thicker outline. */
    choisi: boolean
    /** Holds a slot the member can propose (send icon). */
    proposable?: boolean
    onPress: (bloc: BlocDispo) => void
}

/**
 * A common availability on a horizontal row of the invitation review: from its exact
 * start to its exact end (no minimum size), orange when some participants are free,
 * green when everyone is, with only how many are free ("14/16"). Drawn behind the row's
 * events (EventsList `arrierePlan`); tapping it shows its details — who, range by range,
 * each one proposable (DetailDispoCommune).
 *
 * @author Philip — invitation review: common availabilities placed on their exact times
 * @param {Props} props
 * @returns {JSX.Element | null}
 */
export default function BlocDispoCommune({ bloc, jour, listOffset, choisi, proposable = false, onPress }: Props) {
    const { t } = useTranslation('events')
    const { colors } = usePalette()
    const { fonts } = useFont()
    const { pxHeures, L_HEURES } = useTimeline()

    const heureOffset = pxHeures + L_HEURES
    const debutFenetre = jour.startOf('day')
    // Same wall-clock layout as the events (ListItem) and the hours header.
    const left = positionHeures(bloc.debut, debutFenetre) * heureOffset
    const largeur = Math.max(0, (positionHeures(bloc.fin, debutFenetre) - positionHeures(bloc.debut, debutFenetre)) * heureOffset)
    const largeurTexte = Math.max(0, Math.min(LARGEUR_TEXTE, largeur - 2 * PAD))

    // Hooks before any early return.
    const texteAnime = useTimelineLabelOffset({
        axis: 'x',
        itemOffset: left,
        itemSize: largeur,
        labelSize: largeurTexte,
        listOffset,
        inset: pxHeures,
        centerThreshold: 2 * heureOffset,
        timelineLength: 24 * heureOffset,
    })

    if (largeur <= 0) return null

    const couleur = bloc.tous ? colors.dispoTous : colors.dispoPartielle
    const categorie = t(bloc.tous ? 'invitationReview.availabilityAll' : 'invitationReview.availabilityPartial')
    // Only for screen readers: the block shows the count, the names are in the details (tap).
    const noms = [...new Set(bloc.segments.flatMap((sg) => sg.noms))].join(', ')
    const heures = `${convertirTimestampHeure(bloc.debut)}–${convertirTimestampHeure(bloc.fin)}`

    const s = StyleSheet.create({
        bloc: {
            position: 'absolute',
            left,
            top: 0,
            width: largeur,
            height: '100%',
            borderRadius: 8,
            borderWidth: choisi ? 3 : 1.5,
            borderColor: choisi ? colors.text : couleur,
            overflow: 'hidden',
        },
        fond: { backgroundColor: couleur, opacity: 0.28 },
        texte: {
            position: 'absolute',
            left: 0,
            top: PAD,
            bottom: PAD,
            width: largeurTexte,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
        },
        compte: { flexDirection: 'row', alignItems: 'center', gap: 2 },
        nombre: { color: colors.text, fontFamily: fonts.number, fontSize: 14 },
        envoi: { position: 'absolute', top: 3, right: 3 },
    })

    return (
        <TouchableOpacity
            style={s.bloc}
            activeOpacity={0.7}
            onPress={() => onPress(bloc)}
            accessibilityRole="button"
            accessibilityLabel={`${categorie}, ${heures}, ${compteDispo(bloc)} : ${noms}`}
            accessibilityState={{ selected: choisi }}
        >
            <View style={[StyleSheet.absoluteFill, s.fond]} />
            {largeur >= LARGEUR_MIN_TEXTE && (
                <Animated.View style={[s.texte, texteAnime]}>
                    <View style={s.compte}>
                        {largeurTexte >= 56 && <Ionicons name="people" size={12} color={colors.text} />}
                        <Text style={s.nombre} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{compteDispo(bloc)}</Text>
                    </View>
                </Animated.View>
            )}
            {proposable && largeur >= 2 * LARGEUR_MIN_TEXTE && (
                <Ionicons name="paper-plane" size={12} color={colors.text} style={s.envoi} />
            )}
        </TouchableOpacity>
    )
}
