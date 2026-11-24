import { Ref, useImperativeHandle, useState } from 'react'
import { Image, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import * as MediaLibrary from 'expo-media-library/legacy'
import { useTranslation } from 'react-i18next'
import Icon from '@react-native-vector-icons/ionicons'

import GaleriePhotos, { type ChoixGalerie } from '@/components/galeriePhotos'
import Spinner from '@/components/spinner'
import { usePalette } from '@/contextes/contextePalette'
import catcher from '@/functions/catcher'

/** A photo picked from the library, waiting to be sent */
export type PhotoAEnvoyer = {
    uri: string,
    mimeType?: string,
    nomFichier?: string,
    /** the photo's library id: the same photo, whatever copy was made of it */
    cle?: string,
}

/** What the screen can do with the picker: open the gallery from its own button */
export type SelecteurPhotosRef = { ouvrir: () => void }

type Props = {
    photos: PhotoAEnvoyer[]
    onChange: (photos: PhotoAEnvoyer[]) => void
    /** most photos at once */
    max: number
    /** while sending: nothing can be added or removed */
    desactive?: boolean
    /** new photos being made ready (the screen waits before sending) */
    onPreparation?: (enCours: boolean) => void
    ref?: Ref<SelecteurPhotosRef>
}

/** Longest side of a photo sent (the server shrinks it anyway) */
const COTE_MAX = 2048

/**
 * Which photo of the library a system picker asset is: its library id, else its name,
 * size and dimensions (each pick gives a new copy, so not its uri).
 */
const clePhoto = (a: ImagePicker.ImagePickerAsset) =>
    a.assetId ?? `${a.fileName ?? ''}-${a.fileSize ?? ''}-${a.width}x${a.height}`

/**
 * A photo checked in the gallery, made ready to send: the file itself (downloaded from
 * iCloud if needed), as a JPEG at quality 0.7 (an iPhone photo is a HEIC the server
 * can't read).
 */
async function preparerPhoto(asset: MediaLibrary.Asset): Promise<PhotoAEnvoyer> {
    const info = await MediaLibrary.getAssetInfoAsync(asset, { shouldDownloadFromNetwork: true })
    const contexte = ImageManipulator.manipulate(info.localUri ?? asset.uri)
    if (Math.max(asset.width, asset.height) > COTE_MAX) {
        contexte.resize(asset.width >= asset.height ? { width: COTE_MAX } : { height: COTE_MAX })
    }
    const image = await contexte.renderAsync()
    const resultat = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.7 })
    const nom = (asset.filename || 'photo').replace(/\.[^.]+$/, '')
    return { uri: resultat.uri, mimeType: 'image/jpeg', nomFichier: `${nom}.jpg`, cle: asset.id }
}

/**
 * The app's way to add photos, the same everywhere (messages, event album...): the
 * picked photos in a strip, with on its left a + that stays there however far they're
 * scrolled. The + (or the screen's own button, through `ref.ouvrir()`) opens the app's
 * gallery with the photos already picked checked: add some, uncheck some, never the
 * same one twice. Without access to the photos (refused, Expo Go on Android), the
 * system picker instead (a photo picked again is skipped).
 *
 * @example
 * const selecteur = useRef<SelecteurPhotosRef>(null)
 * <SelecteurPhotos ref={selecteur} photos={photos} onChange={setPhotos} max={10} />
 * <Button onPress={() => selecteur.current?.ouvrir()} />
 */
export default function SelecteurPhotos({ photos, onChange, max, desactive = false, onPreparation, ref }: Props) {
    const { colors } = usePalette()
    const { t } = useTranslation('inbox')
    const [galerieOuverte, setGalerieOuverte] = useState(false)
    const [preparation, setPreparation] = useState(false)

    const changerPreparation = (enCours: boolean) => {
        setPreparation(enCours)
        onPreparation?.(enCours)
    }

    const ouvrir = () => {
        if (desactive || preparation) return
        setGalerieOuverte(true)
    }
    useImperativeHandle(ref, () => ({ ouvrir }))

    // The gallery's choice: the photos already there stay as they were, the new ones are
    // made ready; unchecked ones leave the strip. In the order they were checked.
    const appliquerGalerie = async (choix: ChoixGalerie[]) => {
        setGalerieOuverte(false)
        const parCle = new Map(photos.map((p) => [p.cle ?? p.uri, p]))
        changerPreparation(true)
        try {
            const resultat: PhotoAEnvoyer[] = []
            for (const { id, asset } of choix) {
                const existante = parCle.get(id)
                if (existante) resultat.push(existante)
                else if (asset) resultat.push(await preparerPhoto(asset))
            }
            onChange(resultat.slice(0, max))
        } catch (error) {
            catcher(error, t('gallery.prepareFailed'))
        } finally {
            changerPreparation(false)
        }
    }

    // No access to the photos in the app: the system picker (it can't show the ones
    // already picked). Quality 0.7: lighter, still sharp.
    const choisirAvecLeSysteme = async () => {
        setGalerieOuverte(false)
        const place = max - photos.length
        if (place <= 0) return
        const resultat = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: 'images',
            quality: 0.7,
            allowsMultipleSelection: true,
            selectionLimit: place,
            orderedSelection: true,
        })
        if (resultat.canceled || !resultat.assets?.length) return
        const dejaLa = new Set(photos.map((p) => p.cle ?? p.uri))
        const nouvelles: PhotoAEnvoyer[] = []
        for (const a of resultat.assets) {
            const cle = clePhoto(a)
            if (dejaLa.has(cle)) continue
            dejaLa.add(cle)
            nouvelles.push({ uri: a.uri, mimeType: a.mimeType, nomFichier: a.fileName ?? undefined, cle })
        }
        if (nouvelles.length > 0) onChange([...photos, ...nouvelles].slice(0, max))
    }

    const retirer = (uri: string) => onChange(photos.filter((p) => p.uri !== uri))

    return (
        <>
            {(photos.length > 0 || preparation) && (
                <View style={s.rangee}>
                    {!desactive && (
                        <TouchableOpacity
                            onPress={ouvrir}
                            disabled={preparation}
                            accessibilityRole="button"
                            accessibilityLabel={t('photo.add')}
                            accessibilityState={{ busy: preparation }}
                            style={[s.miniature, s.ajouter, { borderColor: colors.border }]}
                        >
                            {preparation
                                ? <Spinner size={22} color={colors.muted} />
                                : <Icon name="add" size={26} color={colors.muted} />}
                        </TouchableOpacity>
                    )}
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                        style={s.defilement}
                        contentContainerStyle={s.bande}
                    >
                        {photos.map((p) => (
                            <View key={p.uri} style={[s.miniature, { borderColor: colors.border, opacity: desactive ? 0.6 : 1 }]}>
                                <Image source={{ uri: p.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                                {!desactive && (
                                    <TouchableOpacity
                                        onPress={() => retirer(p.uri)}
                                        hitSlop={8}
                                        accessibilityRole="button"
                                        accessibilityLabel={t('photo.remove')}
                                        style={s.retirer}
                                    >
                                        <Icon name="close" size={14} color="white" />
                                    </TouchableOpacity>
                                )}
                            </View>
                        ))}
                    </ScrollView>
                </View>
            )}
            {galerieOuverte && (
                <GaleriePhotos
                    dejaChoisies={photos.map((p) => p.cle ?? p.uri)}
                    max={max}
                    onFermer={() => setGalerieOuverte(false)}
                    onValider={appliquerGalerie}
                    onIndisponible={choisirAvecLeSysteme}
                />
            )}
        </>
    )
}

const s = StyleSheet.create({
    rangee: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingTop: 2 },
    defilement: { flex: 1 },
    bande: { gap: 8 },
    miniature: {
        width: 64,
        height: 64,
        borderRadius: 10,
        borderWidth: 1,
        overflow: 'hidden',
    },
    ajouter: { alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed' },
    retirer: {
        position: 'absolute',
        top: 3,
        right: 3,
        width: 20,
        height: 20,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.6)',
    },
})
