/** A photo of an event's shared album (GET /evenements/:id/photos) */
export type PhotoEvenement = {
    id: string
    /** relative address (/img/evenements/...): shown with the app's server address in front */
    url: string
    /** 'en_attente': waiting for an admin of the event (seen only by its author and the admins) */
    statut: 'en_attente' | 'acceptee'
    /** the photos sent together (an admin accepts them in one tap) */
    id_lot: string | null
    auteur: { id: string, pseudo: string, fp_url: string | null }
    /** UTC */
    cree_le: string
    de_moi: boolean
    /** its author, or an admin of the event */
    peut_supprimer: boolean
}

/** The whole album as the member sees it */
export type AlbumEvenement = {
    /** accepted photos, most recent first */
    photos: PhotoEvenement[]
    /** waiting for approval: all of them for an admin, one's own for the others */
    enAttente: PhotoEvenement[]
    /** the event's creator or an editor: accepts / refuses photos, sets the approval */
    estAdmin: boolean
    /** photos from non-admins must be approved */
    approbation: boolean
}

/** Photos waiting for approval, grouped by sending */
export type LotEnAttente = {
    id: string
    auteur: PhotoEvenement['auteur']
    photos: PhotoEvenement[]
}
