import { useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import { Alert } from 'react-native'
import { useTranslation } from 'react-i18next'

import ToastAbs from '@/abstractions/toastAbs'
import { toastTypes } from '@/constants/toastConfig'
import { useAPI } from '@/contextes/contexteAPI'
import catcher from '@/functions/catcher'
import {
    ajouterPhotosEvenement, changerApprobationAlbum, chargerAlbumEvenement, deciderPhotosEvenement, supprimerPhotoEvenement,
} from '@/functions/photosEvenement'
import { AlbumEvenement, PhotoEvenement } from '@/types/albumEvenement'
import type { PhotoAEnvoyer } from '@/components/selecteurPhotos'

/**
 * An event's shared album: loaded each time the screen is shown; photos added (picked
 * with the app's photo picker; waiting for approval when the member isn't an admin), accepted or
 * refused by an admin, deleted (after a confirmation); the approval turned on or off.
 * Used by the album block of the event page and by the album screen.
 *
 * @param {string | undefined} idEvenement - Public id.
 */
export default function useAlbumEvenement(idEvenement: string | undefined) {
    const { t } = useTranslation('events')
    const { api } = useAPI()
    // null: not loaded yet, or the member can't see this album (not in the event)
    const [album, setAlbum] = useState<AlbumEvenement | null>(null)
    const [accessible, setAccessible] = useState(true)
    const [envoi, setEnvoi] = useState(false)

    const recharger = useCallback(async () => {
        if (!idEvenement) return
        const resultat = await chargerAlbumEvenement(api, idEvenement)
        setAccessible(resultat !== null)
        setAlbum(resultat ?? { photos: [], enAttente: [], estAdmin: false, approbation: true })
    }, [api, idEvenement])

    useFocusEffect(useCallback(() => {
        recharger().catch((error) => catcher(error, t('album.loadFailed')))
    }, [recharger, t]))

    /** Uploads the picked photos; true once they're in (the picker can then be emptied). */
    const ajouter = useCallback(async (aEnvoyer: PhotoAEnvoyer[]) => {
        if (!idEvenement || envoi || aEnvoyer.length === 0) return false
        setEnvoi(true)
        try {
            const { photos, enAttente } = await ajouterPhotosEvenement(api, idEvenement, aEnvoyer)
            if (photos.length === 0) return false
            setAlbum((a) => a && (enAttente
                ? { ...a, enAttente: [...photos, ...a.enAttente] }
                : { ...a, photos: [...photos, ...a.photos] }))
            ToastAbs.show({
                type: toastTypes.success,
                text2: t(enAttente ? 'album.sentForApproval' : 'album.added', { count: photos.length }),
            })
            return true
        } catch (error) {
            catcher(error, t('album.addFailed'))
            return false
        } finally {
            setEnvoi(false)
        }
    }, [api, idEvenement, envoi, t])

    /** An admin accepts or refuses photos waiting for approval (a whole sending, or one). */
    const decider = useCallback(async (photos: PhotoEvenement[], decision: 'acceptee' | 'refusee') => {
        if (!idEvenement || photos.length === 0) return
        try {
            const ids = await deciderPhotosEvenement(api, idEvenement, { photos: photos.map((p) => p.id) }, decision)
            const decidees = new Set(ids)
            setAlbum((a) => {
                if (!a) return a
                const acceptees = a.enAttente
                    .filter((p) => decidees.has(p.id))
                    .map((p) => ({ ...p, statut: 'acceptee' as const }))
                return {
                    ...a,
                    enAttente: a.enAttente.filter((p) => !decidees.has(p.id)),
                    photos: decision === 'acceptee'
                        ? [...acceptees, ...a.photos].sort((x, y) => y.cree_le.localeCompare(x.cree_le))
                        : a.photos,
                }
            })
        } catch (error) {
            catcher(error, t('album.decisionFailed'))
        }
    }, [api, idEvenement, t])

    /** An admin turns the approval on or off (shown at once, put back if it fails). */
    const changerApprobation = useCallback(async (approbation: boolean) => {
        if (!idEvenement) return
        setAlbum((a) => a && { ...a, approbation })
        try {
            await changerApprobationAlbum(api, idEvenement, approbation)
        } catch (error) {
            setAlbum((a) => a && { ...a, approbation: !approbation })
            catcher(error, t('album.settingsFailed'))
        }
    }, [api, idEvenement, t])

    /** Asks first; `onSupprimee` once it's gone (e.g. to close the viewer). */
    const supprimer = useCallback((photo: PhotoEvenement, onSupprimee?: () => void) => {
        if (!idEvenement) return
        const enAttente = photo.statut === 'en_attente'
        Alert.alert(
            t(enAttente ? 'album.cancelTitle' : 'album.deleteTitle'),
            t(enAttente ? 'album.cancelMessage' : 'album.deleteMessage'),
            [
                { text: t('album.cancel'), style: 'cancel' },
                {
                    text: t(enAttente ? 'album.cancelConfirm' : 'album.deleteConfirm'),
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await supprimerPhotoEvenement(api, idEvenement, photo.id)
                            setAlbum((a) => a && {
                                ...a,
                                photos: a.photos.filter((p) => p.id !== photo.id),
                                enAttente: a.enAttente.filter((p) => p.id !== photo.id),
                            })
                            onSupprimee?.()
                        } catch (error) {
                            catcher(error, t('album.deleteFailed'))
                        }
                    },
                },
            ],
        )
    }, [api, idEvenement, t])

    return { album, accessible, envoi, ajouter, decider, changerApprobation, supprimer }
}
