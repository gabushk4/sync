import { useState } from 'react'
import { FlatList, Modal, Pressable, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Icon from '@react-native-vector-icons/ionicons'

import ImageChargement from '@/components/imageChargement'
import ProfilPic from '@/components/pfp'
import { useAPI } from '@/contextes/contexteAPI'
import { useFont } from '@/contextes/contexteFont'
import { useMembre } from '@/contextes/contexteMembre'
import { convertirTimestampHeure, convertirTimestampJourCourt } from '@/functions/convertirTimestamp'
import { convertUTCToLocal } from '@/functions/convertirUTCenLocal'
import { PhotoEvenement } from '@/types/albumEvenement'

type Props = {
    photos: PhotoEvenement[]
    /** photo shown first; null = closed */
    indexDepart: number | null
    onFermer: () => void
    /** asks to delete a photo (only offered on the ones the member may delete) */
    onSupprimer?: (photo: PhotoEvenement) => void
    /** review mode (an admin going through photos waiting for approval): ✕ refuse, ✓ accept */
    revue?: {
        onAccepter: (photo: PhotoEvenement) => void
        onRefuser: (photo: PhotoEvenement) => void
    }
}

/**
 * An event album's photos full screen: swipe between them, who added each one and
 * when (and "waiting for approval"), a delete button on the member's own photos (and on
 * every one for an admin). In review mode, ✕ / ✓ to refuse / accept the photo shown.
 * Tap the photo or ✕ at the top to close.
 */
export default function VisionneusePhotos({ photos, indexDepart, onFermer, onSupprimer, revue }: Props) {
    const { t } = useTranslation('events')
    const { fonts } = useFont()
    const { APIBaseURL } = useAPI()
    const { membre } = useMembre()
    const insets = useSafeAreaInsets()
    const { width: largeur, height: hauteur } = useWindowDimensions()
    // index of the photo on screen: starts at indexDepart (the list is re-created each opening)
    const [index, setIndex] = useState(indexDepart ?? 0)
    const [indexOuvert, setIndexOuvert] = useState(indexDepart)
    if (indexDepart !== indexOuvert) {
        setIndexOuvert(indexDepart)
        if (indexDepart !== null) setIndex(indexDepart)
    }

    const photo = photos[Math.min(index, photos.length - 1)]
    const quand = (iso: string) => {
        const d = convertUTCToLocal(iso, membre?.timezone)
        return `${convertirTimestampJourCourt(d)} · ${convertirTimestampHeure(d)}`
    }

    return (
        <Modal visible={indexDepart !== null && photos.length > 0} transparent animationType="fade" onRequestClose={onFermer} statusBarTranslucent>
            <View style={s.fond}>
                {indexDepart !== null && (
                    <FlatList
                        data={photos}
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        keyExtractor={(p) => p.id}
                        initialScrollIndex={Math.min(indexDepart, Math.max(0, photos.length - 1))}
                        getItemLayout={(_, i) => ({ length: largeur, offset: largeur * i, index: i })}
                        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / largeur))}
                        renderItem={({ item }) => (
                            <Pressable onPress={onFermer} style={{ width: largeur, height: hauteur, justifyContent: 'center' }} accessibilityLabel={t('album.close')}>
                                <ImageChargement tailleSpinner={36} couleurSpinner="white" source={{ uri: `${APIBaseURL}${item.url}` }} style={s.image} resizeMode="contain" />
                            </Pressable>
                        )}
                    />
                )}

                {/* top: counter and close */}
                <View style={[s.barre, { top: insets.top + 12 }]} pointerEvents="box-none">
                    <Text style={[s.texte, { fontFamily: fonts.body }]}>
                        {photos.length > 1 ? t('album.counter', { index: index + 1, total: photos.length }) : ''}
                    </Text>
                    <TouchableOpacity onPress={onFermer} hitSlop={12} style={s.rond} accessibilityRole="button" accessibilityLabel={t('album.close')}>
                        <Icon name="close" size={26} color="white" />
                    </TouchableOpacity>
                </View>

                {/* bottom: who added it, when, delete */}
                {photo && (
                    <View style={[s.barre, { bottom: insets.bottom + 16 }]} pointerEvents="box-none">
                        <View style={s.auteur}>
                            <ProfilPic size={32} pfp={photo.auteur.fp_url ?? undefined} />
                            <View>
                                <Text style={[s.texte, { fontFamily: fonts.title }]} numberOfLines={1}>
                                    {photo.de_moi ? t('album.you') : photo.auteur.pseudo}
                                </Text>
                                <Text style={[s.detail, { fontFamily: fonts.body }]}>
                                    {quand(photo.cree_le)}{photo.statut === 'en_attente' ? ` · ${t('album.pending')}` : ''}
                                </Text>
                            </View>
                        </View>
                        {revue ? (
                            <View style={s.decision}>
                                <TouchableOpacity
                                    onPress={() => revue.onRefuser(photo)}
                                    hitSlop={8}
                                    style={[s.grosRond, { backgroundColor: 'rgba(255,255,255,0.15)' }]}
                                    accessibilityRole="button"
                                    accessibilityLabel={t('album.refuse')}
                                >
                                    <Icon name="close" size={26} color="white" />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => revue.onAccepter(photo)}
                                    hitSlop={8}
                                    style={[s.grosRond, { backgroundColor: '#2e9d5b' }]}
                                    accessibilityRole="button"
                                    accessibilityLabel={t('album.accept')}
                                >
                                    <Icon name="checkmark" size={26} color="white" />
                                </TouchableOpacity>
                            </View>
                        ) : photo.peut_supprimer && onSupprimer && (
                            <TouchableOpacity
                                onPress={() => onSupprimer(photo)}
                                hitSlop={12}
                                style={s.rond}
                                accessibilityRole="button"
                                accessibilityLabel={t('album.delete')}
                            >
                                <Icon name="trash-outline" size={22} color="white" />
                            </TouchableOpacity>
                        )}
                    </View>
                )}
            </View>
        </Modal>
    )
}

const s = StyleSheet.create({
    fond: { flex: 1, backgroundColor: 'rgba(0,0,0,0.96)' },
    image: { width: '100%', height: '100%' },
    barre: {
        position: 'absolute',
        left: 16,
        right: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    auteur: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
    texte: { color: 'white', fontSize: 15 },
    detail: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
    decision: { flexDirection: 'row', gap: 14 },
    grosRond: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
    rond: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.15)',
    },
})
