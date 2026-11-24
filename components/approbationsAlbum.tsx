import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import Icon from '@react-native-vector-icons/ionicons'

import ImageChargement from '@/components/imageChargement'
import ProfilPic from '@/components/pfp'
import { useAPI } from '@/contextes/contexteAPI'
import { useFont } from '@/contextes/contexteFont'
import { usePalette } from '@/contextes/contextePalette'
import { LotEnAttente } from '@/types/albumEvenement'

const TAILLE = 44
const MAX_VIGNETTES = 5

type Props = {
    lots: LotEnAttente[]
    onToutAccepter: (lot: LotEnAttente) => void
    /** opens the photos of the sending one by one (accept / refuse each) */
    onRevoir: (lot: LotEnAttente) => void
}

/**
 * For an admin of the event: the photos waiting for approval, one row per sending
 * (who sent it, its photos), "Accept all" in one tap, or "Review" to go through them.
 */
export default function ApprobationsAlbum({ lots, onToutAccepter, onRevoir }: Props) {
    const { t } = useTranslation('events')
    const { colors } = usePalette()
    const { fonts } = useFont()
    const { APIBaseURL } = useAPI()
    const total = lots.reduce((n, l) => n + l.photos.length, 0)
    if (total === 0) return null

    return (
        <View style={[s.carte, { borderColor: colors.warning, backgroundColor: colors.background }]}>
            <View style={s.titre}>
                <Icon name="time-outline" size={18} color={colors.warning} />
                <Text style={{ color: colors.text, fontFamily: fonts.title, fontSize: 16 }}>{t('album.toApprove', { count: total })}</Text>
            </View>

            {lots.map((lot, i) => (
                <View key={lot.id} style={[s.lot, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: 10 }]}>
                    <View style={s.auteur}>
                        <ProfilPic size={24} pfp={lot.auteur.fp_url ?? undefined} />
                        <Text style={{ color: colors.text, fontFamily: fonts.body, fontSize: 15, flexShrink: 1 }} numberOfLines={1}>
                            {t('album.wantsToAdd', { pseudo: lot.auteur.pseudo, count: lot.photos.length })}
                        </Text>
                    </View>

                    <TouchableOpacity onPress={() => onRevoir(lot)} style={s.vignettes} accessibilityRole="button" accessibilityLabel={t('album.review')}>
                        {lot.photos.slice(0, MAX_VIGNETTES).map((p) => (
                            <View key={p.id} style={[s.vignette, { backgroundColor: colors.border }]}>
                                <ImageChargement tailleSpinner={16} source={{ uri: `${APIBaseURL}${p.url}` }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                            </View>
                        ))}
                        {lot.photos.length > MAX_VIGNETTES && (
                            <View style={[s.vignette, s.reste, { backgroundColor: colors.card }]}>
                                <Text style={{ color: colors.muted, fontFamily: fonts.title }}>+{lot.photos.length - MAX_VIGNETTES}</Text>
                            </View>
                        )}
                    </TouchableOpacity>

                    <View style={s.boutons}>
                        <TouchableOpacity
                            onPress={() => onRevoir(lot)}
                            style={[s.bouton, { borderWidth: 1, borderColor: colors.border }]}
                            accessibilityRole="button"
                        >
                            <Text style={{ color: colors.text, fontFamily: fonts.body, fontSize: 15 }}>{t('album.review')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => onToutAccepter(lot)}
                            style={[s.bouton, { backgroundColor: colors.primary }]}
                            accessibilityRole="button"
                        >
                            <Icon name="checkmark" size={18} color="white" />
                            <Text style={{ color: 'white', fontFamily: fonts.title, fontSize: 15 }}>
                                {t(lot.photos.length > 1 ? 'album.acceptAll' : 'album.accept')}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            ))}
        </View>
    )
}

const s = StyleSheet.create({
    carte: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 10 },
    titre: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    lot: { gap: 8 },
    auteur: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    vignettes: { flexDirection: 'row', gap: 6 },
    vignette: { width: TAILLE, height: TAILLE, borderRadius: 8, overflow: 'hidden' },
    reste: { alignItems: 'center', justifyContent: 'center' },
    boutons: { flexDirection: 'row', gap: 8 },
    bouton: {
        flex: 1,
        height: 40,
        borderRadius: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
})
