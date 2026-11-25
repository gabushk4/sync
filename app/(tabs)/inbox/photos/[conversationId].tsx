import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useCallback, useState } from 'react'
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import Icon from '@react-native-vector-icons/ionicons'

import ImageChargement from '@/components/imageChargement'
import VisionneusePhotos from '@/components/visionneusePhotos'
import { useAPI } from '@/contextes/contexteAPI'
import { useFont } from '@/contextes/contexteFont'
import { usePalette } from '@/contextes/contextePalette'
import catcher from '@/functions/catcher'
import { chargerPhotosConversation } from '@/functions/photosConversation'
import { PhotoEvenement } from '@/types/albumEvenement'

const COLONNES = 3
const ESPACE = 2

/**
 * All the photos sent in a conversation, in a grid (most recent first), opened from its
 * info screen ("See all"). Tap one to see it full screen and swipe through the others.
 */
export default function PhotosConversationEcran() {
    const { t } = useTranslation('inbox')
    const { colors } = usePalette()
    const { fonts } = useFont()
    const { api, APIBaseURL } = useAPI()
    const { width } = useWindowDimensions()
    const { conversationId } = useLocalSearchParams<{ conversationId: string }>()
    const [photos, setPhotos] = useState<PhotoEvenement[] | null>(null)
    const [indexVu, setIndexVu] = useState<number | null>(null)

    useFocusEffect(useCallback(() => {
        if (!conversationId) return
        let actif = true
        chargerPhotosConversation(api, conversationId)
            .then((liste) => { if (actif) setPhotos(liste) })
            .catch((error) => { if (actif) catcher(error, t('photos.loadFailed')) })
        return () => { actif = false }
    }, [api, conversationId, t]))

    const cote = (width - ESPACE * (COLONNES - 1)) / COLONNES

    return (
        <View style={[s.page, { backgroundColor: colors.background }]}>
            <Stack.Screen options={{ headerTitle: t('photos.title') }} />
            {photos === null ? (
                <View style={s.centre}><ActivityIndicator color={colors.muted} /></View>
            ) : (
                <FlatList
                    data={photos}
                    keyExtractor={(p) => p.id}
                    numColumns={COLONNES}
                    columnWrapperStyle={{ gap: ESPACE }}
                    contentContainerStyle={{ gap: ESPACE, paddingBottom: 24, flexGrow: 1 }}
                    ListEmptyComponent={
                        <View style={s.centre}>
                            <Icon name="images-outline" size={48} color={colors.muted} />
                            <Text style={{ color: colors.muted, fontFamily: fonts.body, fontSize: 16, textAlign: 'center' }}>
                                {t('photos.empty')}
                            </Text>
                        </View>
                    }
                    renderItem={({ item, index }) => (
                        <TouchableOpacity
                            onPress={() => setIndexVu(index)}
                            accessibilityRole="imagebutton"
                            accessibilityLabel={t('photos.open', { pseudo: item.auteur.pseudo })}
                            style={{ width: cote, height: cote, backgroundColor: colors.border }}
                        >
                            <ImageChargement source={{ uri: `${APIBaseURL}${item.url}` }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                        </TouchableOpacity>
                    )}
                />
            )}
            <VisionneusePhotos photos={photos ?? []} indexDepart={indexVu} onFermer={() => setIndexVu(null)} />
        </View>
    )
}

const s = StyleSheet.create({
    page: { flex: 1 },
    centre: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
})
