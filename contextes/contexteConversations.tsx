import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AxiosInstance } from "axios";
import { DateTime } from "luxon";

import { useAPI } from "./contexteAPI";
import { useAuth } from "./contexteAuth";
import AutoRefresh from "@/functions/autoRefresh";
import catcher from "@/functions/catcher";
import log from "@/functions/log";
// convertirUTCversLocale was renamed convertUTCToLocal on master (it throws on an invalid date).
import { convertUTCToLocal } from "@/functions/convertirUTCenLocal";
import { Conversation, ConversationBrute, EnvoiMessage, Message, MessageBrut, Vu } from "@/types/messaging";

/**
 * Story #1 et #16 (Isma) : messagerie texte et vocale.
 *
 * - La liste des conversations est rafraîchie en arrière-plan (AutoRefresh, GET /conversations)
 * - Les messages de la conversation ouverte sont rafraîchis plus souvent (GET /conversations/:id/messages)
 *   seulement pendant que l'écran est ouvert (ouvrirConversation / fermerConversation)
 */

const INTERVALLE_CONVERSATIONS_MS = 10000
const INTERVALLE_MESSAGES_MS = 3000

type ConversationsContextType = {
    conversations: Conversation[]
    nonLusTotal: number
    messages: Message[]
    /** group conversations: who has seen up to which message */
    vus: Vu[]
    conversationOuverte: string | undefined
    /** id of the conversation whose messages have arrived at least once (vs still loading) */
    messagesChargesPour: string | undefined
    ouvrirConversation: (conversationId: string) => void
    fermerConversation: () => void
    envoyerMessage: (conversationId: string, message: EnvoiMessage) => Promise<Message | undefined>
    demarrerConversationAvecAmi: (amiId: string) => Promise<string | undefined>
    rafraichirConversations: () => void
    /** erases a conversation on my side only (the others keep it); throws if it failed */
    effacerConversation: (conversationId: string) => Promise<void>
}

const ConversationsContexte = createContext<ConversationsContextType | undefined>(undefined)

/* ---------- conversions serveur -> app ---------- */

function versLocale(date?: string | null): DateTime {
    if (!date) return DateTime.invalid('date manquante')
    try {
        return convertUTCToLocal(date)
    } catch {
        return DateTime.invalid('date invalide')
    }
}

/**
 * Le serveur construit l'adresse des vocaux et des photos avec son BASE_URL, qui devient faux
 * dès que l'IP du Mac change (autre Wi-Fi, partage de connexion...). On garde seulement le
 * chemin (/audio/xxx.m4a, /img/messages/xxx.jpg) et on le colle à l'adresse que l'app
 * utilise déjà pour joindre le serveur.
 */
function versUrlMedia(url: string | undefined, baseApp: string, dossier: '/audio/' | '/img/'): string | undefined {
    if (!url) return undefined
    const debutChemin = url.indexOf(dossier)
    if (debutChemin === -1) return url
    return `${baseApp.replace(/\/$/, '')}${url.slice(debutChemin)}`;
}

function convertirMessage(m: MessageBrut, baseApp: string): Message {
    return {
        ...m,
        audioUrl: versUrlMedia(m.audioUrl, baseApp, '/audio/'),
        imageUrls: m.imageUrls?.map((url) => versUrlMedia(url, baseApp, '/img/') ?? url),
        envoyeLe: versLocale(m.envoyeLe),
    }
}

/**
 * Conversation open right now (see ouvrirConversation), for code outside React:
 * a push for a new message in it doesn't show a toast (useNotificationsPush).
 */
let conversationAffichee: string | undefined
export function conversationOuverteMaintenant(): string | undefined {
    return conversationAffichee
}

function convertirConversation(c: ConversationBrute): Conversation {
    return {
        ...c,
        dernierMessage: c.dernierMessage
            ? { ...c.dernierMessage, envoyeLe: versLocale(c.dernierMessage.envoyeLe) }
            : undefined,
        nonLus: c.nonLus ?? 0,
    }
}

function typeMimeAudio(nomFichier: string) {
    const ext = nomFichier.split('.').pop()?.toLowerCase()
    switch (ext) {
        case 'm4a':
        case 'mp4': return 'audio/mp4'
        case 'caf': return 'audio/x-caf'
        case '3gp': return 'audio/3gpp'
        case 'wav': return 'audio/wav'
        case 'webm': return 'audio/webm'
        default: return 'audio/mpeg'
    }
}

function typeMimeImage(nomFichier: string) {
    switch (nomFichier.split('.').pop()?.toLowerCase()) {
        case 'png': return 'image/png'
        case 'gif': return 'image/gif'
        case 'webp': return 'image/webp'
        case 'heic': return 'image/heic'
        default: return 'image/jpeg'
    }
}

/* ---------- provider ---------- */

export function ConversationsProvider({ children }: { children: React.ReactNode }) {
    const { api, APIBaseURL } = useAPI()
    const { state } = useAuth()

    // Refs read by the polling callbacks; updated after each render (a ref can't be
    // written during render)
    const baseRef = useRef(APIBaseURL)
    useEffect(() => {
        baseRef.current = APIBaseURL
    }, [APIBaseURL])

    const [conversations, setConversations] = useState<Conversation[]>([])
    const [messages, setMessages] = useState<Message[]>([])
    const [vus, setVus] = useState<Vu[]>([])
    const [conversationOuverte, setConversationOuverte] = useState<string | undefined>()
    const [messagesChargesPour, setMessagesChargesPour] = useState<string | undefined>()

    // Signed out: everything emptied. Done while rendering when the auth state changes
    // (React's "adjusting state when a prop changes"), not in the effect below: a setState
    // in an effect renders twice.
    const [etatPrecedent, setEtatPrecedent] = useState(state)
    if (state !== etatPrecedent) {
        setEtatPrecedent(state)
        if (state !== 'authenticated') {
            setConversations([])
            setMessages([])
            setVus([])
            setConversationOuverte(undefined)
            setMessagesChargesPour(undefined)
        }
    }

    // APIProvider recrée son instance axios à chaque rendu : on passe toujours par la plus récente,
    // sinon AutoRefresh garderait une vieille instance sans intercepteurs (donc sans token)
    const apiRef = useRef(api)
    useEffect(() => {
        apiRef.current = api
    }, [api])
    const apiStable = useMemo(() => ({
        get: (...args: Parameters<AxiosInstance['get']>) => apiRef.current.get(...args),
    }) as unknown as AxiosInstance, [])

    const refreshConversations = useRef<AutoRefresh | undefined>(undefined)
    const refreshMessages = useRef<AutoRefresh | undefined>(undefined)
    const idOuvertRef = useRef<string | undefined>(undefined)

    /* liste des conversations */
    useEffect(() => {
        refreshConversations.current?.stop()
        refreshConversations.current = undefined

        if (state !== 'authenticated') {
            // (the state itself is emptied above, while rendering)
            refreshMessages.current?.stop()
            refreshMessages.current = undefined
            idOuvertRef.current = undefined
            conversationAffichee = undefined
            return
        }

        refreshConversations.current = new AutoRefresh(apiStable, '/conversations', {
            intervalMs: INTERVALLE_CONVERSATIONS_MS,
            extraParams: { resource: 'conversations' },
            onData: (data) => {
                const liste: ConversationBrute[] = data?.conversations ?? []
                setConversations(liste.map(convertirConversation))
            },
            onError: (error) => log('erreur get conversations', error?.message ?? error),
        })

        return () => {
            refreshConversations.current?.stop()
            refreshConversations.current = undefined
        }
    }, [state, apiStable])

    /* conversation ouverte */
    // The messages are kept when the screen closes: emptying them made the chat go blank
    // while it slid away, and reopening the same conversation now shows them right away.
    const fermerConversation = useCallback(() => {
        refreshMessages.current?.stop()
        refreshMessages.current = undefined
        idOuvertRef.current = undefined
        conversationAffichee = undefined
        setConversationOuverte(undefined)
    }, [])

    const ouvrirConversation = useCallback((conversationId: string) => {
        refreshMessages.current?.stop()

        idOuvertRef.current = conversationId
        conversationAffichee = conversationId
        setConversationOuverte(conversationId)
        // another conversation's messages: emptied (the screen also filters them out)
        // (an old `vus` can stay: the screen only uses the ones on this conversation's messages)
        setMessages((ms) => (ms.length > 0 && ms[0].conversationId !== conversationId ? [] : ms))
        setMessagesChargesPour((id) => (id === conversationId ? id : undefined))

        refreshMessages.current = new AutoRefresh(apiStable, `/conversations/${conversationId}/messages`, {
            intervalMs: INTERVALLE_MESSAGES_MS,
            extraParams: { resource: 'messages' },
            onData: (data) => {
                // ignorer une réponse arrivée après avoir changé de conversation
                if (idOuvertRef.current !== conversationId) return
                const liste: MessageBrut[] = data?.messages ?? []
                setMessages(liste.map((m) => convertirMessage(m, baseRef.current)))
                setVus(data?.vus ?? [])
                setMessagesChargesPour(conversationId)
                // le serveur vient de marquer les messages comme lus (nouvelle liste seulement si ça change)
                setConversations((cs) => (cs.some((c) => c.id === conversationId && c.nonLus !== 0)
                    ? cs.map((c) => (c.id === conversationId ? { ...c, nonLus: 0 } : c))
                    : cs))
            },
            onError: (error) => {
                log('erreur get messages', error?.message ?? error)
                const status = error?.response?.status
                if (status === 403 || status === 404) catcher(error, 'conversation introuvable')
            },
        })
    }, [apiStable])

    useEffect(() => () => {
        refreshMessages.current?.stop()
        refreshConversations.current?.stop()
    }, [])

    /* envoi */
    const envoyerMessage = useCallback(async (conversationId: string, envoi: EnvoiMessage) => {
        const url = `/conversations/${conversationId}/messages`
        let reponse

        if (envoi.type === 'texte') {
            reponse = await apiRef.current.post(url, { type: 'texte', contenu: envoi.contenu })
        } else if (envoi.type === 'image') {
            // every photo in the same "image" field: one message (an album when several)
            const form = new FormData()
            form.append('type', 'image')
            envoi.photos.forEach((photo, i) => {
                const nomFichier = photo.nomFichier || photo.uri.split('/').pop() || `photo-${i + 1}.jpg`
                form.append('image', { uri: photo.uri, name: nomFichier, type: photo.mimeType || typeMimeImage(nomFichier) } as any)
            })

            reponse = await apiRef.current.post(url, form, {
                headers: { 'Content-Type': 'multipart/form-data' },
                transformRequest: (d) => d, // axios ne doit pas sérialiser le FormData en React Native
                timeout: 60000,
            })
        } else {
            const nomFichier = envoi.uri.split('/').pop() || 'vocal.m4a'
            const form = new FormData()
            // champs texte avant le fichier pour que multer les lise en premier
            form.append('type', 'vocal')
            form.append('duree_secondes', String(envoi.dureeSecondes))
            form.append('audio', { uri: envoi.uri, name: nomFichier, type: typeMimeAudio(nomFichier) } as any)

            reponse = await apiRef.current.post(url, form, {
                headers: { 'Content-Type': 'multipart/form-data' },
                transformRequest: (d) => d, // axios ne doit pas sérialiser le FormData en React Native
                timeout: 30000,
            })
        }

        const brut: MessageBrut | undefined = reponse?.data?.message
        if (!brut) return undefined
        const message = convertirMessage(brut, baseRef.current)

        // afficher tout de suite, sans attendre le prochain rafraîchissement
        if (idOuvertRef.current === conversationId) {
            setMessages((ms) => (ms.some((m) => m.id === message.id) ? ms : [...ms, message]))
        }
        setConversations((cs) => {
            const conv = cs.find((c) => c.id === conversationId)
            if (!conv) return cs
            const maj: Conversation = {
                ...conv,
                dernierMessage: {
                    type: message.type,
                    contenu: message.contenu,
                    envoyeLe: message.envoyeLe,
                    auteurId: message.auteurId,
                },
            }
            return [maj, ...cs.filter((c) => c.id !== conversationId)]
        })

        return message
    }, [])

    const demarrerConversationAvecAmi = useCallback(async (amiId: string) => {
        try {
            const { data } = await apiRef.current.post('/conversations', { ami_id: amiId })
            const id: string | undefined = data?.id ?? data?.conversation_id
            refreshConversations.current?.forceRefresh()
            return id
        } catch (error) {
            catcher(error, "impossible d'ouvrir la conversation")
            return undefined
        }
    }, [])

    const rafraichirConversations = useCallback(() => {
        refreshConversations.current?.forceRefresh()
    }, [])

    // Removed from the list right away (the list is reloaded from the server either way, so
    // it comes back if the server refused); its messages kept in memory are dropped, so
    // reopening it from a friend shows a fresh conversation.
    const effacerConversation = useCallback(async (conversationId: string) => {
        setConversations((cs) => cs.filter((c) => c.id !== conversationId))
        setMessages((ms) => (ms[0]?.conversationId === conversationId ? [] : ms))
        setMessagesChargesPour((id) => (id === conversationId ? undefined : id))
        try {
            await apiRef.current.post(`/conversations/${conversationId}/effacer`)
        } finally {
            refreshConversations.current?.forceRefresh()
        }
    }, [])

    const nonLusTotal = useMemo(() => conversations.reduce((total, c) => total + (c.nonLus || 0), 0), [conversations])

    // same object until something changes: every screen using the conversations
    // (inbox list, tab badge...) no longer re-renders on each provider render
    const value: ConversationsContextType = useMemo(() => ({
        conversations,
        nonLusTotal,
        messages,
        vus,
        conversationOuverte,
        messagesChargesPour,
        ouvrirConversation,
        fermerConversation,
        envoyerMessage,
        demarrerConversationAvecAmi,
        rafraichirConversations,
        effacerConversation,
    }), [conversations, nonLusTotal, messages, vus, conversationOuverte, messagesChargesPour, ouvrirConversation,
        fermerConversation, envoyerMessage, demarrerConversationAvecAmi, rafraichirConversations, effacerConversation])

    return (
        <ConversationsContexte.Provider value={value}>
            {children}
        </ConversationsContexte.Provider>
    )
}

export const useConversations = () => {
    const ctx = useContext(ConversationsContexte)
    if (!ctx) throw new Error('useConversations doit être utilisé à l\'intérieur de ConversationsProvider')
    return ctx
}
