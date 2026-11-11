import Constants from 'expo-constants'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import { router } from 'expo-router'
import type { AxiosInstance } from 'axios'
import { Platform } from 'react-native'

import categorieNotification from '@/functions/categorieNotification'

/**
 * User story 45: push notifications received while the app is open.
 *
 * In the foreground the app shows its own toast (useNotificationsPush), so the system
 * banner, sound and notification-center entry are turned off: the same notification
 * is never shown twice. Only called for a notification received in the foreground;
 * in the background or closed, the system shows it as usual.
 *
 * @returns {void}
 */
export function configurerAffichagePremierPlan(): void {
    Notifications.setNotificationHandler({
        handleNotification: async () => ({
            shouldShowBanner: false,
            shouldShowList: false,
            shouldPlaySound: false,
            shouldSetBadge: false,
        }),
    })
}

/**
 * Asks for the push permission and sends this device's Expo push token to the API
 * (POST /notifications/push_token), which sends the pushes. Without it no push arrives.
 * Silently does nothing on a simulator or when the permission is refused.
 *
 * @param {AxiosInstance} api
 * @returns {Promise<boolean>} Whether the token was saved.
 */
export async function enregistrerPushToken(api: AxiosInstance): Promise<boolean> {
    if (!Device.isDevice) return false

    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.DEFAULT,
        })
    }

    const { status: statutExistant } = await Notifications.getPermissionsAsync()
    let statut = statutExistant
    if (statutExistant !== 'granted') {
        statut = (await Notifications.requestPermissionsAsync()).status
    }
    if (statut !== 'granted') return false

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId
    const { data: pushToken } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)
    await api.post('/notifications/push_token', { push_token: pushToken })
    pushTokenEnregistre = pushToken
    return true
}

/** This device's token, once sent to the API (US-52: removed again on sign-out). */
let pushTokenEnregistre: string | null = null

/**
 * US-52: removes this device's push token from the signed-in member
 * (DELETE /notifications/push_token), so its notifications stop coming here after
 * sign-out. Only removed if it is still this member's token (a sign-out on an old phone
 * keeps the one used since). Never throws and never waits more than 3 s: signing out
 * must not depend on the network.
 *
 * @param {AxiosInstance} api - Still signed in (called before the tokens are emptied).
 * @returns {Promise<void>}
 */
export async function retirerPushToken(api: AxiosInstance): Promise<void> {
    if (!pushTokenEnregistre) return
    const pushToken = pushTokenEnregistre
    pushTokenEnregistre = null
    await Promise.race([
        api.delete('/notifications/push_token', { data: { push_token: pushToken } }).catch(() => undefined),
        new Promise((resolve) => setTimeout(resolve, 3000)),
    ])
}

/** The `data` of a push (sync_api envoyerNotification: its `data` + `type` + `id_metier`). */
type DonneesPush = Record<string, any>

/**
 * Public id found in the push's links: `evenement_url.url`, `url.string` or
 * `onPress.string` depending on the notification (e.g. "/evenements/E0ufwtyw3v").
 *
 * @param {DonneesPush} data
 * @param {string} ressource - 'evenements' or 'membres'.
 * @returns {string | null}
 */
function idDansLiens(data: DonneesPush, ressource: 'evenements' | 'membres'): string | null {
    const liens = [
        data?.evenement_url?.url, data?.evenement_url?.string,
        data?.url?.string, data?.url?.url,
        data?.onPress?.string, data?.onPress?.url,
    ]
    const motif = new RegExp(`${ressource}/([A-Za-z0-9_-]+)`)
    for (const lien of liens) {
        if (typeof lien !== 'string') continue
        const trouve = lien.match(motif)
        if (trouve) return trouve[1]
    }
    return null
}

/**
 * Where a notification leads when its toast (or system notification) is tapped:
 *  - invitation or postponement vote: the notifications tab, where it is answered;
 *  - other event notification (accepted, moved, new slot): the event's page;
 *  - new friendship: the friend's profile;
 *  - anything else: the notifications tab.
 *
 * @param {DonneesPush} data
 * @returns {{ pathname: string, params?: Record<string, string> }}
 */
export function destinationNotification(data: DonneesPush): { pathname: string, params?: Record<string, string> } {
    const type = data?.type
    if (type === 'invitation_evenement' || type === 'postpone_vote') {
        return { pathname: '/(tabs)/feed' }
    }
    if (categorieNotification(type) === 'evenements') {
        const idEvenement = idDansLiens(data, 'evenements')
        if (idEvenement) return { pathname: '/(tabs)/home/details/[eventId]', params: { eventId: idEvenement } }
    }
    if (type === 'amis') {
        const idMembre = idDansLiens(data, 'membres')
        if (idMembre) return { pathname: '/(tabs)/home/profil/[membreId]', params: { membreId: idMembre } }
    }
    return { pathname: '/(tabs)/feed' }
}

/**
 * Opens the notification's destination (see destinationNotification).
 *
 * @param {DonneesPush} data
 * @returns {void}
 */
export function ouvrirNotification(data: DonneesPush): void {
    const destination = destinationNotification(data)
    if (destination.params) router.push(destination as any)
    else router.navigate(destination.pathname as any)
}

/**
 * The toast's title key, per notification type. Kept short and generic: no event title,
 * names, dates or message content (the push's own text), so nothing sensitive shows on
 * screen; the details are one tap away.
 *
 * @param {string | null | undefined} type
 * @returns {string} Key in the notifications namespace.
 */
export function cleTitreToast(type: string | null | undefined): string {
    switch (type) {
        case 'invitation_evenement': return 'push.title.invitation'
        case 'postpone_vote': return 'push.title.vote'
        case 'evenements': return 'push.title.event'
        case 'amis': return 'push.title.friendship'
        case 'demande_ami': return 'push.title.friendRequest'
        default: return 'push.title.other'
    }
}
