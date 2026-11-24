import Ionicons from '@react-native-vector-icons/ionicons'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import ProfilPic from '@/components/pfp'
import Spinner from '@/components/spinner'
import { useAPI } from '@/contextes/contexteAPI'
import { useFont } from '@/contextes/contexteFont'
import { usePalette } from '@/contextes/contextePalette'
import catcher from '@/functions/catcher'
import couleurStatutInvitation from '@/functions/couleurStatutInvitation'
import { Participant } from '@/types/invites'

type Props = {
    /** Public id of the event. */
    idEvenement: string
}

/**
 * The event's participants with their answer (accepted / pending / refused, colored),
 * in a drop-down folded by default and loaded the first time it opens. Reopening after a
 * failure tries again.
 *
 * @author Philip — taken out of PanneauDecisionInvitation (user story 8), also shown once
 *   the member accepted (the event's card in the feed)
 * @param {Props} props
 * @returns {JSX.Element}
 */
export default function ListeParticipantsStatut({ idEvenement }: Props) {
    const { t } = useTranslation('events')
    const { colors } = usePalette()
    const { fonts } = useFont()
    const { api } = useAPI()

    const [ouvert, setOuvert] = useState(false)
    // null while loading; `erreur`: the request failed (no endless spinner).
    const [participants, setParticipants] = useState<Participant[] | null>(null)
    const [erreur, setErreur] = useState(false)

    // Loaded the first time the list is opened.
    useEffect(() => {
        if (!ouvert || participants) return
        api.get(`/evenements/${idEvenement}/participants`, { params: { limite: 50 } })
            .then((reponse) => setParticipants(reponse.data.participants ?? []))
            .catch((error) => {
                setErreur(true)
                catcher(error, t('errors.participantsLoadFailed'))
            })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ouvert])

    const s = StyleSheet.create({
        entete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
        titre: { color: colors.text, fontFamily: fonts.title, fontSize: 16 },
        texte: { color: colors.muted, fontFamily: fonts.body, fontSize: 14 },
        ligne: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
        pseudo: { flex: 1, color: colors.text, fontFamily: fonts.body, fontSize: 15 },
        statut: { fontFamily: fonts.title, fontSize: 12 },
    })

    return (
        <View style={{ gap: 10 }}>
            <TouchableOpacity
                style={s.entete}
                // Reopening after a failure tries again.
                onPress={() => { setErreur(false); setOuvert((o) => !o) }}
                accessibilityRole="button"
                accessibilityState={{ expanded: ouvert }}
            >
                <Text style={s.titre}>{t('form.participants')}</Text>
                <Ionicons name={ouvert ? 'chevron-up' : 'chevron-down'} size={20} color={colors.text} />
            </TouchableOpacity>
            {ouvert && erreur && <Text style={s.texte}>{t('errors.participantsLoadFailed')}</Text>}
            {ouvert && !erreur && (participants === null
                ? <Spinner size={22} color={colors.muted} style={{ alignSelf: 'center' }} />
                : participants.map((p) => (
                    <View key={p.id} style={s.ligne}>
                        <ProfilPic pfp={p.fp_url ?? null} size={28} />
                        <Text style={s.pseudo} numberOfLines={1}>{p.pseudo}</Text>
                        <Text style={[s.statut, { color: couleurStatutInvitation(p.statut, colors) }]}>
                            {t(`participantStatus.${p.statut}`)}
                        </Text>
                    </View>
                )))}
        </View>
    )
}
