import { router } from 'expo-router'
import { useMemo, useState } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import Icon from '@react-native-vector-icons/ionicons'

import ImageChargement from '@/components/imageChargement'
import ApprobationsAlbum from '@/components/approbationsAlbum'
import VisionneusePhotos from '@/components/visionneusePhotos'
import { useAPI } from '@/contextes/contexteAPI'
import { useFont } from '@/contextes/contexteFont'
import { usePalette } from '@/contextes/contextePalette'
import { grouperParLot } from '@/functions/photosEvenement'
import useAlbumEvenement from '@/hooks/useAlbumEvenement'
import { PhotoEvenement } from '@/types/albumEvenement'

const TAILLE = 72
const MAX_APERCU = 10

type Props = {
    /** the event's public id */
    idEvenement: string
}

/**
 * The event's shared photo album, as a block of its page: the latest photos in a strip,
 * a + to add some (several at once), "See all" for the whole album. Every member of the
 * event (its creator and the participants who accepted) can add photos; those of a
 * member who isn't an admin wait for approval (shown faded, with a clock, to them only).
 * An admin sees the photos to approve on top. Not shown to someone who isn't in the event.
 */
export default function AlbumEvenement({ idEvenement }: Props) {
    const { t } = useTranslation('events')
    const { colors } = usePalette()
    const { fonts } = useFont()
    const { APIBaseURL } = useAPI()
    const { album, accessible, decider, supprimer } = useAlbumEvenement(idEvenement)
    // the strip opened full screen (index), or the sending reviewed by an admin (its id)
    const [indexVu, setIndexVu] = useState<number | null>(null)
    const [lotRevu, setLotRevu] = useState<string | null>(null)

    const lots = useMemo(() => grouperParLot(album?.estAdmin ? album.enAttente : []), [album])
    // the strip: an admin's pending photos are in the approval card; one's own, first here
    const bande = useMemo<PhotoEvenement[]>(
        () => [...(album && !album.estAdmin ? album.enAttente : []), ...(album?.photos ?? [])].slice(0, MAX_APERCU),
        [album]
    )

    if (!accessible || album === null) return null

    const total = album.photos.length
    const photosRevues = lots.find((l) => l.id === lotRevu)?.photos ?? []
    const ouvrirAlbum = () => router.push({ pathname: '/(tabs)/home/details/album/[eventId]', params: { eventId: idEvenement } })
    // + : the album screen, its photo picker opened right away (same picker as everywhere)
    const ajouterPhotos = () => router.push({ pathname: '/(tabs)/home/details/album/[eventId]', params: { eventId: idEvenement, ajouter: '1' } })

    return (
        <View style={[s.bloc, { backgroundColor: colors.card }]}>
            <View style={s.entete}>
                <View style={s.titre}>
                    <Icon name="images-outline" size={22} color={colors.text} />
                    <Text style={[s.texteTitre, { color: colors.text, fontFamily: fonts.body }]}>
                        {t('album.title')}{total > 0 ? ` · ${total}` : ''}
                    </Text>
                </View>
                <TouchableOpacity onPress={ouvrirAlbum} hitSlop={8} style={s.voirTout} accessibilityRole="button">
                    <Text style={{ color: colors.muted, fontFamily: fonts.body, fontSize: 14 }}>{t('album.seeAll')}</Text>
                    <Icon name="chevron-forward" size={16} color={colors.muted} />
                </TouchableOpacity>
            </View>

            {album.estAdmin && (
                <ApprobationsAlbum
                    lots={lots}
                    onToutAccepter={(lot) => decider(lot.photos, 'acceptee')}
                    onRevoir={(lot) => setLotRevu(lot.id)}
                />
            )}

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.bande}>
                <TouchableOpacity
                    onPress={ajouterPhotos}
                    accessibilityRole="button"
                    accessibilityLabel={t('album.add')}
                    style={[s.case, s.ajouter, { borderColor: colors.border }]}
                >
                    <Icon name="add" size={30} color={colors.muted} />
                </TouchableOpacity>
                {bande.map((p, i) => (
                    <TouchableOpacity
                        key={p.id}
                        onPress={() => setIndexVu(i)}
                        accessibilityRole="imagebutton"
                        accessibilityLabel={p.statut === 'en_attente' ? t('album.pending') : t('album.open', { pseudo: p.auteur.pseudo })}
                        style={[s.case, { backgroundColor: colors.border }]}
                    >
                        <ImageChargement
                            source={{ uri: `${APIBaseURL}${p.url}` }}
                            style={[StyleSheet.absoluteFill, p.statut === 'en_attente' && s.enAttente]}
                            resizeMode="cover"
                        />
                        {p.statut === 'en_attente' && (
                            <View style={s.badge}>
                                <Icon name="time" size={14} color="white" />
                            </View>
                        )}
                    </TouchableOpacity>
                ))}
                {total + (album.estAdmin ? 0 : album.enAttente.length) > MAX_APERCU && (
                    <TouchableOpacity onPress={ouvrirAlbum} style={[s.case, s.ajouter, { borderColor: colors.border }]} accessibilityRole="button">
                        <Icon name="ellipsis-horizontal" size={24} color={colors.muted} />
                    </TouchableOpacity>
                )}
            </ScrollView>

            {bande.length === 0 && (
                <Text style={[s.vide, { color: colors.muted, fontFamily: fonts.body }]}>
                    {t(album.approbation && !album.estAdmin ? 'album.emptyWithApproval' : 'album.empty')}
                </Text>
            )}

            <VisionneusePhotos
                photos={bande}
                indexDepart={indexVu}
                onFermer={() => setIndexVu(null)}
                onSupprimer={(photo) => supprimer(photo, () => { if (bande.length <= 1) setIndexVu(null) })}
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
    bloc: { borderRadius: 16, padding: 14, gap: 12 },
    entete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    titre: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    texteTitre: { fontSize: 18 },
    voirTout: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    bande: { gap: 8 },
    case: { width: TAILLE, height: TAILLE, borderRadius: 10, overflow: 'hidden' },
    ajouter: { borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
    enAttente: { opacity: 0.45 },
    badge: {
        position: 'absolute',
        right: 4,
        bottom: 4,
        width: 22,
        height: 22,
        borderRadius: 11,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.6)',
    },
    vide: { fontSize: 14 },
})
