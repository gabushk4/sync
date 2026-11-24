import { DateTime } from "luxon"

/** 'image': one photo, 'album': several photos in one message */
export type TypeMessage = 'texte' | 'vocal' | 'image' | 'album'

export type Message = {
    id: string
    conversationId: string
    auteurId: string
    /** pseudo and profile picture of the author (shown in group conversations) */
    auteurPseudo?: string
    auteurFpUrl?: string
    type: TypeMessage
    contenu?: string
    audioUrl?: string
    /** photo or album message: the photos' addresses, in order */
    imageUrls?: string[]
    dureeSecondes?: number
    envoyeLe: DateTime
    lu: boolean
}

export type Conversation = {
    id: string
    ami: {
        id: string
        pseudo: string
        fp_url?: string
    }
    dernierMessage?:{
        type: TypeMessage
        contenu?: string
        envoyeLe: DateTime
        auteurId: string
    }
    nonLus: number
    titre?: string
    /** the other members of the conversation (without me) */
    participants?: {
        id: string
        pseudo: string
        fp_url?: string
    }[]
    /** Story #21: public id of the event this group conversation belongs to */
    evenementId?: string
}

export type MessageBrut = Omit<Message,'envoyeLe'> & {envoyeLe: string}

/** Group conversations: the last message each other member has seen (GET .../messages `vus`) */
export type Vu = {
    membreId: string
    pseudo: string
    fp_url: string | null
    messageId: string
}
export type ConversationBrute = Omit<Conversation,'dernierMessage'> & {
    dernierMessage?: Omit<NonNullable<Conversation['dernierMessage']>,'envoyeLe'> & { envoyeLe: string}
}


/** Ce que l'écran de conversation envoie au contexte */
export type EnvoiMessage =
    | { type: 'texte', contenu: string }
    | { type: 'vocal', uri: string, dureeSecondes: number }
    | { type: 'image', photos: { uri: string, mimeType?: string, nomFichier?: string }[] }
