import ToastAbs from "@/abstractions/toastAbs"
import { toastTypes } from "@/constants/toastConfig"
import { capturerErreurPourSignalement } from "@/contextes/contexteSignalements"
import { router } from "expo-router"
import i18n from "../i18n"
import log from "./log"

// Forme des erreurs qu'on rencontre (axios + flags maison). Tout est optionnel :
// catcher reçoit n'importe quoi dans un catch (error est de type unknown).
interface ErreurApp {
    response?: {
        status?: number
        data?: { message?: string }
    }
    status?: number
    code?: string
    message?: string
    deconnecte?: boolean      // posé par contexteAPI quand la session expire
    __requeteLente?: boolean  // posé par contexteAPI sur une requête trop lente
}

interface DetailsErreur {
    title?: string
    message?: string
}

export default function catcher(error: unknown, titre?: string): void {
    const err = (error ?? {}) as ErreurApp

    log(`catcher ${titre}`, err.response?.data, err.code)

    // Session expired / signed out: contexteAPI already sends the member to the
    // login screen and flags the error, so there's nothing useful to show.
    if (err.deconnecte) return
    if (err.__requeteLente && router.canGoBack()) router.back()

    const status = err.response?.status ?? err.status
    capturerErreurPourSignalement(error, titre)

    const errorKey = String(status ?? err.code ?? 'default')
    const fallback = i18n.t('default', { ns: 'errors', returnObjects: true }) as unknown as DetailsErreur
    const localized = i18n.t(errorKey, { ns: 'errors', returnObjects: true }) as unknown
    const hasLocalizedError = i18n.exists(errorKey, { ns: 'errors' })
    const details: DetailsErreur =
        hasLocalizedError && typeof localized === 'object' && localized !== null
            ? (localized as DetailsErreur)
            : fallback
    const errorTitle = hasLocalizedError ? details.title : (titre ?? details.title)
    const errorMessage = err.response?.data?.message ?? details.message ?? err.message

    if (status === 304) {
        return
    }

    // Les deux branches d'origine (avec ou sans err.response) affichaient le même toast :
    // on garde seulement la différence de log.
    log(err.response ? 'Erreur serveur' : 'catcher toast erreur')
    ToastAbs.show({
        type: toastTypes.error,
        text1: errorTitle,
        text2: errorMessage,
        position: 'top',
        autoHide: false,
    })
    //TODO ajouter le titre et le message au contexte logs
}
