import { useState } from 'react'
import {
    FlatList, Modal, Pressable, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import Icon from '@react-native-vector-icons/ionicons'

import ImageChargement from '@/components/imageChargement'
import { useFont } from '@/contextes/contexteFont'
import { usePalette } from '@/contextes/contextePalette'
import { Message } from '@/types/messaging'

const LARGEUR = 220
const LARGEUR_ALBUM = 240
const ESPACE = 3
const HAUTEUR_MIN = 120
const HAUTEUR_MAX = 300

type Props = {
    message: Message
}

/**
 * The photos of a message (like Messenger): one photo at its own shape, several in a
 * grid of squares (2 per row for 2 or 4 photos, 3 otherwise). Tapping one opens them
 * full screen, from that one; swipe to see the others, tap or ✕ to close.
 */
export default function ImageMessageBubble({ message }: Props) {
    const { colors } = usePalette()
    const { fonts } = useFont()
    const { t } = useTranslation('inbox')
    const { width: largeurEcran, height: hauteurEcran } = useWindowDimensions()
    // width / height of a single photo, known once it's loaded (square until then)
    const [ratio, setRatio] = useState(1)
    // index of the photo shown full screen, null when closed
    const [pleinEcran, setPleinEcran] = useState<number | null>(null)
    const [indexVu, setIndexVu] = useState(0)

    const urls = message.imageUrls ?? []
    if (urls.length === 0) return null

    const ouvrir = (index: number) => {
        setIndexVu(index)
        setPleinEcran(index)
    }

    const vignette = (url: string, index: number, largeur: number, hauteur: number) => (
        <TouchableOpacity
            key={`${url}-${index}`}
            activeOpacity={0.85}
            onPress={() => ouvrir(index)}
            accessibilityRole="imagebutton"
            accessibilityLabel={t('photo.open')}
            style={[s.cadre, { width: largeur, height: hauteur, backgroundColor: colors.border }]}
        >
            {/* the app's spinner until the photo is there */}
            <ImageChargement
                source={{ uri: url }}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
                onLoad={(e) => {
                    if (urls.length === 1) {
                        const { width, height } = e.nativeEvent.source
                        if (width > 0 && height > 0) setRatio(width / height)
                    }
                }}
            />
        </TouchableOpacity>
    )

    let contenu
    if (urls.length === 1) {
        contenu = vignette(urls[0], 0, LARGEUR, Math.min(HAUTEUR_MAX, Math.max(HAUTEUR_MIN, LARGEUR / ratio)))
    } else {
        const colonnes = urls.length === 2 || urls.length === 4 ? 2 : 3
        const cote = (LARGEUR_ALBUM - ESPACE * (colonnes - 1)) / colonnes
        contenu = (
            <View style={[s.grille, { width: LARGEUR_ALBUM }]}>
                {urls.map((url, index) => vignette(url, index, cote, cote))}
            </View>
        )
    }

    return (
        <>
            {contenu}

            <Modal
                visible={pleinEcran !== null}
                transparent
                animationType="fade"
                onRequestClose={() => setPleinEcran(null)}
                statusBarTranslucent
            >
                <View style={s.fond}>
                    <FlatList
                        data={urls}
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        keyExtractor={(url, index) => `${url}-${index}`}
                        initialScrollIndex={pleinEcran ?? 0}
                        getItemLayout={(_, index) => ({ length: largeurEcran, offset: largeurEcran * index, index })}
                        onMomentumScrollEnd={(e) => setIndexVu(Math.round(e.nativeEvent.contentOffset.x / largeurEcran))}
                        renderItem={({ item }) => (
                            <Pressable
                                onPress={() => setPleinEcran(null)}
                                accessibilityLabel={t('photo.close')}
                                style={{ width: largeurEcran, height: hauteurEcran, justifyContent: 'center' }}
                            >
                                <ImageChargement tailleSpinner={36} couleurSpinner="white" source={{ uri: item }} style={s.pleineImage} resizeMode="contain" />
                            </Pressable>
                        )}
                    />
                    <View style={s.barreHaut} pointerEvents="box-none">
                        {urls.length > 1 ? (
                            <Text style={[s.compteur, { fontFamily: fonts.body }]}>
                                {t('photo.counter', { index: indexVu + 1, total: urls.length })}
                            </Text>
                        ) : <View />}
                        <TouchableOpacity
                            onPress={() => setPleinEcran(null)}
                            hitSlop={12}
                            accessibilityRole="button"
                            accessibilityLabel={t('photo.close')}
                            style={s.fermer}
                        >
                            <Icon name="close" size={26} color="white" />
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </>
    )
}

const s = StyleSheet.create({
    cadre: { borderRadius: 10, overflow: 'hidden' },
    grille: { flexDirection: 'row', flexWrap: 'wrap', gap: ESPACE },
    fond: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)' },
    pleineImage: { width: '100%', height: '100%' },
    barreHaut: {
        position: 'absolute',
        top: 56,
        left: 16,
        right: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    compteur: { color: 'white', fontSize: 15 },
    fermer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.15)',
    },
})
