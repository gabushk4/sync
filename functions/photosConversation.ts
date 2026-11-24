import type { AxiosInstance } from 'axios'

import { PhotoEvenement } from '@/types/albumEvenement'

/**
 * Every photo sent in a conversation (most recent first), for the album of its info
 * screen. Same shape as an event album's photos, so the same viewer shows them
 * (they can't be deleted from there: delete the message instead).
 *
 * @param {AxiosInstance} api
 * @param {string} conversationId - Public id.
 * @returns {Promise<PhotoEvenement[]>}
 */
export async function chargerPhotosConversation(api: AxiosInstance, conversationId: string): Promise<PhotoEvenement[]> {
    const { data } = await api.get(`/conversations/${encodeURIComponent(conversationId)}/photos`)
    return (data?.photos ?? []).map((p: any) => ({
        id: p.id,
        url: p.url,
        statut: 'acceptee' as const,
        id_lot: null,
        auteur: p.auteur,
        cree_le: p.cree_le,
        de_moi: !!p.de_moi,
        peut_supprimer: false,
    }))
}
