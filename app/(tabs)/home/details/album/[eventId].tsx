import { Stack, useLocalSearchParams } from 'expo-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import Icon from '@react-native-vector-icons/ionicons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import ImageChargement from '@/components/imageChargement'
import SwitchAbs from '@/abstractions/switchAbs'
import ApprobationsAlbum from '@/components/approbationsAlbum'
import SelecteurPhotos, { type PhotoAEnvoyer, type SelecteurPhotosRef } from '@/components/selecteurPhotos'
import VisionneusePhotos from '@/components/visionneusePhotos'
import { useAPI } from '@/contextes/contexteAPI'
import { useFont } from '@/contextes/contexteFont'
import { usePalette } from '@/contextes/contextePalette'
import { grouperParLot, MAX_PHOTOS_PAR_ENVOI } from '@/functions/photosEvenement'
import useAlbumEvenement from '@/hooks/useAlbumEvenement'
import { PhotoEvenement } from '@/types/albumEvenement'

const COLONNES = 3
const ESPACE = 2

/**
 * An event's whole shared album (opened from its page): every photo in a grid, most
 * recent first, + in the header to add some (the app's photo picker: the picked ones in
 * a strip at the bottom, then "Add to the album"; opened right away with `ajouter=1`).
 * One's own photos waiting for approval come first, faded. An admin sees the photos to
 * approve on top and can turn the approval off. Tap a photo to see it full screen.
 */
export default function AlbumEvenementEcran() {
    const { t } = useTranslation('events')
    const { colors } = usePalette()
    const { fonts } = useFont()
    const { APIBaseURL } = useAPI()
    const { width } = useWindowDimensions()
    const { eventId, ajouter: ajouterAuDepart } = useLocalSearchParams<{ eventId: string, ajouter?: string }>()
    const { album, accessible, envoi, ajouter, decider, changerApprobation, supprimer } = useAlbumEvenement(eventId)
    const { bottom } = useSafeAreaInsets()
    // the photos picked to add, and the picker (the same as everywhere photos are added)
    const [photosAAjouter, setPhotosAAjouter] = useState<PhotoAEnvoyer[]>([])
    const [preparation, setPreparation] = useState(false)
    const selecteur = useRef<SelecteurPhotosRef>(null)
    const choisirPhotos = () => selecteur.current?.ouvrir()
    const envoyerPhotos = async () => {
        if (await ajouter(photosAAjouter)) setPhotosAAjouter([])
    }

    // + of the event page: the picker opens right away
    useEffect(() => {
        if (ajouterAuDepart === '1') selecteur.current?.ouvrir()
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
    const [indexVu, setIndexVu] = useState<number | null>(null)
    const [lotRevu, setLotRevu] = useState<string | null>(null)

    const cote = (width - ESPACE * (COLONNES - 1)) / COLONNES
    const lots = useMemo(() => grouperParLot(album?.estAdmin ? album.enAttente : []), [album])
    const grille = useMemo<PhotoEvenement[]>(
        () => [...(album && !album.estAdmin ? album.enAttente : []), ...(album?.photos ?? [])],
        [album]
    )
    const photosRevues = lots.find((l) => l.id === lotRevu)?.photos ?? []

    const options = useMemo(() => ({
        headerRight: () => (
            <TouchableOpacity onPress={choisirPhotos} disabled={envoi || !accessible} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('album.add')}>
                {envoi ? <ActivityIndicator color={colors.text} /> : <Icon name="add" size={28} color={colors.text} />}
            </TouchableOpacity>
        ),
    }), [envoi, accessible, colors.text, t])

    // above the grid: an admin's approval switch and the photos to approve
    const entete = album?.estAdmin ? (
        <View style={s.entete}>
            <View style={[s.reglage, { backgroundColor: colors.card }]}>
                <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontFamily: fonts.body, fontSize: 16 }}>{t('album.approvalSetting')}</Text>
                    <Text style={{ color: colors.muted, fontFamily: fonts.body, fontSize: 13 }}>{t('album.approvalSettingHint')}</Text>
                </View>
                {/* the app's switch (its colours, like the settings) */}
                <SwitchAbs value={album.approbation} onValueChange={changerApprobation} />
            </View>
            <ApprobationsAlbum
                lots={lots}
                onToutAccepter={(lot) => decider(lot.photos, 'acceptee')}
                onRevoir={(lot) => setLotRevu(lot.id)}
            />
        </View>
    ) : null

    let contenu
    if (album === null) {
        contenu = <View style={s.centre}><ActivityIndicator color={colors.muted} /></View>
    } else if (!accessible) {
        contenu = <View style={s.centre}><Text style={{ color: colors.muted, fontFamily: fonts.body }}>{t('album.noAccess')}</Text></View>
    } else {
        contenu = (
            <FlatList
                data={grille}
                keyExtractor={(p) => p.id}
                numColumns={COLONNES}
                columnWrapperStyle={{ gap: ESPACE }}
                contentContainerStyle={{ gap: ESPACE, paddingBottom: 24, flexGrow: 1 }}
                ListHeaderComponent={entete}
                ListEmptyComponent={
                    <View style={s.centre}>
                        <Icon name="images-outline" size={48} color={colors.muted} />
                        <Text style={[s.vide, { color: colors.muted, fontFamily: fonts.body }]}>
                            {t(album.approbation && !album.estAdmin ? 'album.emptyWithApproval' : 'album.empty')}
                        </Text>
                        <TouchableOpacity onPress={choisirPhotos} disabled={envoi} style={[s.bouton, { backgroundColor: colors.primary }]} accessibilityRole="button">
                            {envoi ? <ActivityIndicator color="white" /> : <Icon name="add" size={20} color="white" />}
                            <Text style={{ color: 'white', fontFamily: fonts.title, fontSize: 16 }}>{t('album.add')}</Text>
                        </TouchableOpacity>
                    </View>
                }
                renderItem={({ item, index }) => (
                    <TouchableOpacity
                        onPress={() => setIndexVu(index)}
                        accessibilityRole="imagebutton"
                        accessibilityLabel={item.statut === 'en_attente' ? t('album.pending') : t('album.open', { pseudo: item.auteur.pseudo })}
                        style={{ width: cote, height: cote, backgroundColor: colors.border }}
                    >
                        <ImageChargement
                            source={{ uri: `${APIBaseURL}${item.url}` }}
                            style={[StyleSheet.absoluteFill, item.statut === 'en_attente' && s.enAttente]}
                            resizeMode="cover"
                        />
                        {item.statut === 'en_attente' && (
                            <View style={s.badge}>
                                <Icon name="time" size={14} color="white" />
                                <Text style={[s.texteBadge, { fontFamily: fonts.body }]}>{t('album.pending')}</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                )}
            />
        )
    }

    return (
        <View style={[s.page, { backgroundColor: colors.background }]}>
            <Stack.Screen options={options} />
            {contenu}
            {/* The photos picked to add (with the + to change them), then "Add to the album" */}
            <View
                style={photosAAjouter.length > 0 || preparation
                    ? [s.barreAjout, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: bottom + 8 }]
                    : undefined}
            >
                <SelecteurPhotos
                    ref={selecteur}
                    photos={photosAAjouter}
                    onChange={setPhotosAAjouter}
                    max={MAX_PHOTOS_PAR_ENVOI}
                    desactive={envoi}
                    onPreparation={setPreparation}
                />
                {photosAAjouter.length > 0 && (
                    <TouchableOpacity
                        onPress={envoyerPhotos}
                        disabled={envoi || preparation}
                        accessibilityRole="button"
                        accessibilityState={{ busy: envoi }}
                        style={[s.bouton, s.boutonAjout, { backgroundColor: colors.primary, opacity: envoi || preparation ? 0.6 : 1 }]}
                    >
                        {envoi ? <ActivityIndicator color="white" /> : <Icon name="cloud-upload-outline" size={20} color="white" />}
                        <Text style={{ color: 'white', fontFamily: fonts.title, fontSize: 16 }}>
                            {t('album.addSelected', { count: photosAAjouter.length })}
                        </Text>
                    </TouchableOpacity>
                )}
            </View>
            <VisionneusePhotos
                photos={grille}
                indexDepart={indexVu}
                onFermer={() => setIndexVu(null)}
                onSupprimer={(photo) => supprimer(photo, () => { if (grille.length <= 1) setIndexVu(null) })}
            />
            <VisionneusePhotos
                photos={photosRevues}
                indexDepart={lotRevu && photosRevues.length > 0 ? 0 : null}
                onFermer={() => setLotRevu(null)}
                revue={{
                    onAccepter: (photo) => decider([photo], 'acceptee'),
                    onRefuser: (photo) => decider([photo], 'refusee'),
                }}
            />
        </View>
    )
}

const s = StyleSheet.create({
    page: { flex: 1 },
    entete: { padding: 12, gap: 12 },
    reglage: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12 },
    centre: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
    vide: { fontSize: 16, textAlign: 'center' },
    bouton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 18,
        height: 46,
        borderRadius: 12,
    },
    enAttente: { opacity: 0.45 },
    barreAjout: { paddingHorizontal: 12, paddingTop: 10, gap: 10, borderTopWidth: 1 },
    boutonAjout: { justifyContent: 'center' },
    badge: {
        position: 'absolute',
        left: 6,
        bottom: 6,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 10,
        backgroundColor: 'rgba(0,0,0,0.6)',
    },
    texteBadge: { color: 'white', fontSize: 11 },
})
