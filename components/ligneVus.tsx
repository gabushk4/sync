import { memo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'

import ProfilPic from '@/components/pfp'
import { useFont } from '@/contextes/contexteFont'
import { usePalette } from '@/contextes/contextePalette'
import { Vu } from '@/types/messaging'

const TAILLE = 16
const MAX_AFFICHES = 5

type Props = {
    lecteurs: Vu[]
}

/**
 * "Seen by" in a group conversation (like Messenger): the small avatars of the members
 * whose last seen message is this one, under it on the right.
 */
function LigneVus({ lecteurs }: Props) {
    const { t } = useTranslation('inbox')
    const { colors } = usePalette()
    const { fonts } = useFont()
    if (lecteurs.length === 0) return null

    const affiches = lecteurs.slice(0, MAX_AFFICHES)
    const reste = lecteurs.length - affiches.length

    return (
        <View
            style={s.ligne}
            accessible
            accessibilityLabel={t('seenBy', { noms: lecteurs.map((l) => l.pseudo).join(', ') })}
        >
            {affiches.map((l) => (
                <ProfilPic key={l.membreId} size={TAILLE} pfp={l.fp_url ?? undefined} />
            ))}
            {reste > 0 && (
                <Text style={[s.reste, { color: colors.muted, fontFamily: fonts.body }]}>+{reste}</Text>
            )}
        </View>
    )
}

const s = StyleSheet.create({
    ligne: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: 14,
        marginTop: 1,
        marginBottom: 4,
    },
    reste: { fontSize: 11, marginLeft: 2 },
})

export default memo(LigneVus, (a, b) =>
    a.lecteurs.map((l) => l.membreId + (l.fp_url ?? '')).join('|') === b.lecteurs.map((l) => l.membreId + (l.fp_url ?? '')).join('|'))
