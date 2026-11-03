import Ionicons from '@react-native-vector-icons/ionicons'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import Spinner from '@/components/spinner'
import { useFont } from '@/contextes/contexteFont'
import { usePalette } from '@/contextes/contextePalette'

type Props = {
    /** Button label ("Propose", "Move", "Change the time"). */
    libelle: string
    /** Button icon (Ionicons), the send icon by default. */
    icone?: string
    /** Question shown once the button is pressed ("Propose Tue 4 Nov from 14:00 to 15:00?"). */
    question: string
    /** Nothing selected yet: the button is greyed out. */
    desactive?: boolean
    /** Being sent: spinner, nothing can be pressed. */
    enCours?: boolean
    /** Confirmed. */
    onConfirmer: () => void
}

/**
 * A send button that confirms in place instead of an iOS / Android alert: pressed, it
 * turns into the question with "Cancel" and "Confirm". Used to propose / move to a
 * common free slot and to apply a proposal.
 *
 * @author Philip — user story 23 (no native alert to confirm)
 * @param {Props} props
 * @returns {JSX.Element}
 */
export default function ConfirmationEnvoi({ libelle, icone = 'paper-plane-outline', question, desactive = false, enCours = false, onConfirmer }: Props) {
    const { t } = useTranslation('events')
    const { colors } = usePalette()
    const { fonts } = useFont()
    const [demande, setDemande] = useState(false)

    const s = StyleSheet.create({
        bouton: {
            flex: 1,
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
        question: { color: colors.text, fontFamily: fonts.body, fontSize: 14 },
        rangee: { flexDirection: 'row', gap: 8 },
    })

    if (!demande || desactive) {
        return (
            <View style={s.rangee}>
                <TouchableOpacity
                    style={[s.bouton, desactive && { opacity: 0.5 }]}
                    onPress={() => setDemande(true)}
                    disabled={desactive || enCours}
                    accessibilityRole="button"
                >
                    {enCours ? <Spinner size={18} color={colors.text} /> : <Ionicons name={icone as any} size={18} color={colors.text} />}
                    <Text style={s.texteBouton}>{libelle}</Text>
                </TouchableOpacity>
            </View>
        )
    }

    return (
        <View style={{ gap: 8 }}>
            <Text style={s.question}>{question}</Text>
            <View style={s.rangee}>
                <TouchableOpacity style={[s.bouton, { borderColor: colors.border }]} onPress={() => setDemande(false)} accessibilityRole="button">
                    <Text style={s.texteBouton}>{t('postpone.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[s.bouton, { backgroundColor: colors.secondary }]}
                    onPress={() => { setDemande(false); onConfirmer() }}
                    accessibilityRole="button"
                >
                    <Ionicons name={icone as any} size={18} color={colors.card} />
                    <Text style={[s.texteBouton, { color: colors.card }]}>{t('postpone.confirm')}</Text>
                </TouchableOpacity>
            </View>
        </View>
    )
}
