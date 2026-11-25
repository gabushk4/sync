import type { AxiosInstance } from 'axios'

import type { PhotoAEnvoyer } from '@/components/selecteurPhotos'

import { AlbumEvenement, LotEnAttente, PhotoEvenement } from '@/types/albumEvenement'

/** Photos per upload (the photo picker stops there; the API accepts as many) */
export const MAX_PHOTOS_PAR_ENVOI = 20

const base = (idEvenement: string) => `/evenements/${encodeURIComponent(idEvenement)}/photos`

/**
 * The album of an event as the member sees it. `null` when they can't see it (not in
 * the event: 403, or the event is gone: 404): the album isn't shown then.
 *
 * @param {AxiosInstance} api
 * @param {string} idEvenement - Public id.
 * @returns {Promise<AlbumEvenement | null>}
 */
export async function chargerAlbumEvenement(api: AxiosInstance, idEvenement: string): Promise<AlbumEvenement | null> {
    try {
        const { data } = await api.get(base(idEvenement))
        return {
            photos: data?.photos ?? [],
            enAttente: data?.en_attente ?? [],
            estAdmin: !!data?.est_admin,
            approbation: data?.approbation !== false,
        }
    } catch (error: any) {
        const statut = error?.response?.status
        if (statut === 403 || statut === 404) return null
        throw error
    }
}

/**
 * Adds the photos picked with the app's photo picker (SelecteurPhotos) to the event's
 * album (waiting for approval when the member isn't an admin and the approval is on).
 *
 * @param {AxiosInstance} api
 * @param {string} idEvenement - Public id.
 * @param {PhotoAEnvoyer[]} photos - The picked photos.
 * @returns {Promise<{ photos: PhotoEvenement[], enAttente: boolean }>}
 */
export async function ajouterPhotosEvenement(
    api: AxiosInstance,
    idEvenement: string,
    photos: PhotoAEnvoyer[],
): Promise<{ photos: PhotoEvenement[], enAttente: boolean }> {
    if (photos.length === 0) return { photos: [], enAttente: false }
    const form = new FormData()
    photos.slice(0, MAX_PHOTOS_PAR_ENVOI).forEach((p, i) => {
        const nom = p.nomFichier || p.uri.split('/').pop() || `photo-${i + 1}.jpg`
        form.append('photos', { uri: p.uri, name: nom, type: p.mimeType || 'image/jpeg' } as any)
    })
    const { data } = await api.post(base(idEvenement), form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        transformRequest: (d) => d, // axios ne doit pas sérialiser le FormData en React Native
        timeout: 120000,
    })
    return { photos: data?.photos ?? [], enAttente: !!data?.en_attente }
}

/**
 * An admin accepts or refuses photos waiting for approval: a whole sending (`lot`) or
 * some photos. Refused photos are deleted.
 *
 * @returns {Promise<string[]>} The ids of the photos decided.
 */
export async function deciderPhotosEvenement(
    api: AxiosInstance,
    idEvenement: string,
    cible: { lot: string } | { photos: string[] },
    decision: 'acceptee' | 'refusee',
): Promise<string[]> {
    const { data } = await api.post(`${base(idEvenement)}/decision`, { ...cible, decision })
    return data?.photos ?? []
}

/** An admin turns the approval of the event's photos on or off. */
export async function changerApprobationAlbum(api: AxiosInstance, idEvenement: string, approbation: boolean): Promise<void> {
    await api.patch(`${base(idEvenement)}/reglages`, { approbation })
}

/** Removes a photo from the album (its author, or an admin of the event). */
export async function supprimerPhotoEvenement(api: AxiosInstance, idEvenement: string, idPhoto: string): Promise<void> {
    await api.delete(`${base(idEvenement)}/${encodeURIComponent(idPhoto)}`)
}

/** Photos waiting for approval grouped by sending, the oldest sending first. */
export function grouperParLot(enAttente: PhotoEvenement[]): LotEnAttente[] {
    const lots = new Map<string, LotEnAttente>()
    for (const p of [...enAttente].reverse()) {
        const id = p.id_lot ?? p.id
        const lot = lots.get(id) ?? { id, auteur: p.auteur, photos: [] }
        lot.photos.push(p)
        lots.set(id, lot)
    }
    return [...lots.values()]
}
