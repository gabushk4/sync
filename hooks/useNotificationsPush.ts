import * as Notifications from 'expo-notifications'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import Toast from 'react-native-toast-message'

import ToastAbs from '@/abstractions/toastAbs'
import { toastTypes } from '@/constants/toastConfig'
import { useAPI } from '@/contextes/contexteAPI'
import { useAuth } from '@/contextes/contexteAuth'
import { useNotifications } from '@/contextes/contexteNotifications'
import categorieNotification from '@/functions/categorieNotification'
import log from '@/functions/log'
import { cleTitreToast, enregistrerPushToken, ouvrirNotification } from '@/functions/notificationsPush'

/** How long a notification toast stays (ms); several in a row are shown one after the other. */
const DUREE_TOAST_NOTIFICATION = 5000

/**
 * Identifier of the last tapped notification already opened: the tap that launched the
 * app is also returned by getLastNotificationResponseAsync, and must open its screen once.
 */
let derniereReponseOuverte: string | null = null

/**
 * Opens a tapped system notification's destination, once per notification.
 *
 * @param {Notifications.NotificationResponse} reponse
 * @returns {void}
 */
function ouvrirReponse(reponse: Notifications.NotificationResponse): void {
    const id = reponse.notification.request.identifier
    if (id === derniereReponseOuverte) return
    derniereReponseOuverte = id
    ouvrirNotification(reponse.notification.request.content.data ?? {})
}

/**
 * User story 45: once signed in, registers the device for push notifications and,
 * while the app is open, shows each push as a toast instead of the system alert
 * (see configurerAffichagePremierPlan). Tapping the toast opens the notification's
 * destination; tapping a system notification does too, whether the app was in the
 * background or closed (then once signed in).
 * The notifications list is refreshed right away, so every push stays viewable there.
 *
 * @returns {void}
 */
export default function useNotificationsPush(): void {
    const { state } = useAuth()
    const { api } = useAPI()
    const { notifRefresh } = useNotifications()
    const { t } = useTranslation('notifications')

    // the listeners are added once per sign-in; they read the latest polling from here
    const notifRefreshRef = useRef(notifRefresh)
    useEffect(() => {
        notifRefreshRef.current = notifRefresh
    }, [notifRefresh])

    useEffect(() => {
        if (state !== 'authenticated') return
        enregistrerPushToken(api).catch((error) => log('enregistrement du push token impossible', error))
    }, [state, api])

    useEffect(() => {
        if (state !== 'authenticated') return

        const recue = Notifications.addNotificationReceivedListener((notification) => {
            const data = notification.request.content.data ?? {}
            ToastAbs.show({
                type: toastTypes.notification,
                text1: t(cleTitreToast(data.type as string | undefined)),
                text2: t('push.tapToOpen'),
                props: { categorie: categorieNotification(data.type as string | undefined) },
                visibilityTime: DUREE_TOAST_NOTIFICATION,
                onPress: () => {
                    // hiding it lets the next queued toast (another push) show
                    Toast.hide()
                    ouvrirNotification(data)
                },
            })
            void notifRefreshRef.current?.refresh(true)
        })

        // a system notification tapped while the app was in the background
        const touchee = Notifications.addNotificationResponseReceivedListener(ouvrirReponse)

        // ...or the one tapped while the app was closed: it launched the app before this
        // listener existed (start-up, sign-in), so it is read once signed in
        Notifications.getLastNotificationResponseAsync()
            .then((reponse) => { if (reponse) ouvrirReponse(reponse) })
            .catch((error) => log('notification de lancement illisible', error))

        return () => {
            recue.remove()
            touchee.remove()
        }
    }, [state, t])
}
