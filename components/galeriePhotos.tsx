import { useCallback, useEffect, useRef, useState } from 'react'
import { FlatList, Modal, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native'
import { Image } from 'expo-image'
import * as MediaLibrary from 'expo-media-library/legacy'
import { useTranslation } from 'react-i18next'

import Spinner from '@/components/spinner'
import { useFont } from '@/contextes/contexteFont'
import { usePalette } from '@/contextes/contextePalette'

/** One photo checked in the gallery: its library id, and the asset when it's on screen */
export type ChoixGalerie = { id: string, asset?: MediaLibrary.Asset }

type Props = {
    /** library ids of the photos already picked: shown checked, in that order */
    dejaChoisies: string[]
    /** most photos per message */
    max: number
    onFermer: () => void
    /** the checked photos, in the order they were checked */
    onValider: (choix: ChoixGalerie[]) => void
    /** no access to the photos (refused, or not possible here, e.g. Expo Go on Android) */
    onIndisponible: () => void
}

const COLONNES = 4
const ESPACE = 2
const PAR_PAGE = 60

/**
 * The phone's photos in a grid, inside the app, to pick the ones to send. Unlike the
 * system picker, it opens with the photos already picked checked (numbered in their
 * order): tap one to add or remove it, then "Add". Mounted each time it opens.
 */
export default function GaleriePhotos({ dejaChoisies, max, onFermer, onValider, onIndisponible }: Props) {
    const { t } = useTranslation('inbox')
    const { colors } = usePalette()
    const { fonts } = useFont()
    const { width } = useWindowDimensions()
    const cote = (width - ESPACE * (COLONNES - 1)) / COLONNES

    const [assets, setAssets] = useState<MediaLibrary.Asset[]>([])
    const [chargement, setChargement] = useState(true)
    const [accesLimite, setAccesLimite] = useState(false)
    const [selection, setSelection] = useState<string[]>(dejaChoisies)
    // the assets checked here, kept even if their row scrolled away
    const assetsChoisis = useRef(new Map<string, MediaLibrary.Asset>())
    const suite = useRef<{ apres?: string, encore: boolean, enCours: boolean }>({ encore: true, enCours: false })

    const chargerPage = useCallback(async (depuisDebut: boolean) => {
        if (suite.current.enCours || (!depuisDebut && !suite.current.encore)) return
        suite.current.enCours = true
        try {
            const page = await MediaLibrary.getAssetsAsync({
                first: PAR_PAGE,
                after: depuisDebut ? undefined : suite.current.apres,
                mediaType: MediaLibrary.MediaType.photo,
                sortBy: [[MediaLibrary.SortBy.creationTime, false]],
            })
            suite.current = { apres: page.endCursor, encore: page.hasNextPage, enCours: false }
            setAssets((avant) => (depuisDebut ? page.assets : [...avant, ...page.assets]))
        } catch {
            suite.current.enCours = false
        } finally {
            setChargement(false)
        }
    }, [])

    // Access to the photos (asked once), then the most recent ones
    useEffect(() => {
        let actif = true
        MediaLibrary.requestPermissionsAsync(false, ['photo'])
            .then((permission) => {
                if (!actif) return
                if (!permission.granted) {
                    onIndisponible()
                    return
                }
                setAccesLimite(permission.accessPrivileges === 'limited')
                chargerPage(true)
            })
            .catch(() => { if (actif) onIndisponible() })
        return () => { actif = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // iOS "selected photos only": the system sheet to give access to more, then reload
    const gererAcces = async () => {
        try {
            await MediaLibrary.presentPermissionsPickerAsync()
        } finally {
            chargerPage(true)
        }
    }

    const basculer = (asset: MediaLibrary.Asset) => {
        assetsChoisis.current.set(asset.id, asset)
        setSelection((avant) => {
            if (avant.includes(asset.id)) return avant.filter((id) => id !== asset.id)
            if (avant.length >= max) return avant
            return [...avant, asset.id]
        })
    }

    const valider = () => {
        onValider(selection.map((id) => ({ id, asset: assetsChoisis.current.get(id) })))
    }

    const nouvelles = selection.filter((id) => !dejaChoisies.includes(id)).length
    const retirees = dejaChoisies.filter((id) => !selection.includes(id)).length
    const aChange = nouvelles > 0 || retirees > 0

    return (
        <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onFermer}>
            <View style={[s.page, { backgroundColor: colors.background }]}>
                <View style={[s.entete, { borderBottomColor: colors.border }]}>
                    <TouchableOpacity onPress={onFermer} hitSlop={10} accessibilityRole="button">
                        <Text style={{ color: colors.text, fontFamily: fonts.body, fontSize: 16 }}>{t('gallery.cancel')}</Text>
                    </TouchableOpacity>
                    <Text style={{ color: colors.text, fontFamily: fonts.title, fontSize: 17 }}>
                        {selection.length > 0 ? t('gallery.count', { count: selection.length, max }) : t('gallery.title')}
                    </Text>
                    <TouchableOpacity onPress={valider} disabled={!aChange} hitSlop={10} accessibilityRole="button" accessibilityState={{ disabled: !aChange }}>
                        <Text style={{ color: aChange ? colors.secondary : colors.muted, fontFamily: fonts.title, fontSize: 16 }}>
                            {t('gallery.done')}
                        </Text>
                    </TouchableOpacity>
                </View>

                {accesLimite && (
                    <TouchableOpacity onPress={gererAcces} style={[s.limite, { backgroundColor: colors.card }]} accessibilityRole="button">
                        <Text style={{ flex: 1, color: colors.muted, fontFamily: fonts.body, fontSize: 13 }}>{t('gallery.limited')}</Text>
                        <Text style={{ color: colors.secondary, fontFamily: fonts.title, fontSize: 13 }}>{t('gallery.manage')}</Text>
                    </TouchableOpacity>
                )}

                {chargement ? (
                    <View style={s.centre}><Spinner size={32} color={colors.muted} /></View>
                ) : assets.length === 0 ? (
                    <View style={s.centre}>
                        <Text style={{ color: colors.muted, fontFamily: fonts.body }}>{t('gallery.empty')}</Text>
                    </View>
                ) : (
                    <FlatList
                        data={assets}
                        keyExtractor={(a) => a.id}
                        numColumns={COLONNES}
                        columnWrapperStyle={{ gap: ESPACE }}
                        contentContainerStyle={{ gap: ESPACE, paddingBottom: 32 }}
                        onEndReached={() => chargerPage(false)}
                        onEndReachedThreshold={1.5}
                        renderItem={({ item }) => {
                            const rang = selection.indexOf(item.id)
                            const choisie = rang >= 0
                            const pleine = !choisie && selection.length >= max
                            return (
                                <TouchableOpacity
                                    activeOpacity={0.8}
                                    onPress={() => basculer(item)}
                                    disabled={pleine}
                                    accessibilityRole="checkbox"
                                    accessibilityState={{ checked: choisie, disabled: pleine }}
                                    style={{ width: cote, height: cote, backgroundColor: colors.border, opacity: pleine ? 0.4 : 1 }}
                                >
                                    {/* expo-image: it reads the library's ph:// addresses on iOS
                                        (React Native's Image can't: empty squares) and loads
                                        small versions, fast in a grid */}
                                    <Image
                                        source={{ uri: item.uri }}
                                        style={StyleSheet.absoluteFill}
                                        contentFit="cover"
                                        recyclingKey={item.id}
                                        transition={100}
                                    />
                                    {choisie && <View style={[s.cadreChoisi, { borderColor: colors.secondary }]} />}
                                    <View style={[s.pastille, choisie ? { backgroundColor: colors.secondary, borderColor: 'white' } : s.pastilleVide]}>
                                        {choisie && <Text style={[s.numero, { fontFamily: fonts.title }]}>{rang + 1}</Text>}
                                    </View>
                                </TouchableOpacity>
                            )
                        }}
                    />
                )}
            </View>
        </Modal>
    )
}

const s = StyleSheet.create({
    page: { flex: 1 },
    entete: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    limite: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
    centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    cadreChoisi: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderWidth: 3 },
    pastille: {
        position: 'absolute',
        top: 6,
        right: 6,
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
    },
    pastilleVide: { borderColor: 'white', backgroundColor: 'rgba(0,0,0,0.25)' },
    numero: { color: 'white', fontSize: 12 },
})
