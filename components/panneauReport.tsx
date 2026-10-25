import Ionicons from '@react-native-vector-icons/ionicons'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import ToastAbs from '@/abstractions/toastAbs'
import Spinner from '@/components/spinner'
import { toastTypes } from '@/constants/toastConfig'
import { useAPI } from '@/contextes/contexteAPI'
import { useFont } from '@/contextes/contexteFont'
import { useMembre } from '@/contextes/contexteMembre'
import { usePalette } from '@/contextes/contextePalette'
import catcher from '@/functions/catcher'
import { convertUTCToLocal } from '@/functions/convertirUTCenLocal'

/** A slot the member may propose (participants' common free slot). Dates: UTC ISO. */
type Creneau = { debut: string, fin: string, deja_propose: boolean }

/** An open suggestion with its votes. Dates: UTC ISO. */
type Suggestion = {
    id: string
    debut: string
    fin: string
    proposeur: string
    oui: number
    non: number
    mon_vote: 'oui' | 'non' | null
}

/** GET /postpone/evenements/:id */
type DonneesReport = {
    est_createur: boolean
    reportable: boolean
    peut_proposer: boolean
    suggestions: Suggestion[]
    creneaux: Creneau[]
}

type Props = {
    /** Public id of the event. */
    idEvenement: string
    /** The creator moved the event: reload it. */
    onPlageChangee?: () => void
    /** Inside another panel (the invitation decision one): no background nor padding of its own. */
    integre?: boolean
}

/**
 * Postponement votes on an event's page (user story 23).
 * - An invitee: "propose another time" (folded list of the slots where every
 *   participant is free, next 7 days; tap one, then propose and confirm — the other
 *   invitees get a vote notification), and the open proposals with yes / no votes.
 * - The creator: the open proposals with their yes / no counts; tap one, then
 *   "change the time" moves the event (yes → attending, no → not attending, the
 *   others answer again). Nothing is shown to the creator while nobody proposed.
 * Recurring events and unavailabilities can't be postponed (the API says so).
 *
 * @author Philip — user story 23 (postponement votes)
 * @param {Props} props
 * @returns {JSX.Element | null}
 */
export default function PanneauReport({ idEvenement, onPlageChangee, integre = false }: Props) {
    const { t } = useTranslation('events')
    const { colors } = usePalette()
    const { fonts } = useFont()
    const { api } = useAPI()
    const { membre } = useMembre()

    const [donnees, setDonnees] = useState<DonneesReport | null>(null)
    const [ouvertProposer, setOuvertProposer] = useState(false)
    const [ouvertSuggestions, setOuvertSuggestions] = useState(false)
    // Debut of the selected slot (invitee) or id of the selected suggestion (creator).
    const [selection, setSelection] = useState<string | null>(null)
    // What is being sent: 'proposer', 'appliquer', or a suggestion id (vote).
    const [enCours, setEnCours] = useState<string | null>(null)

    const charger = useCallback(async () => {
        try {
            const reponse = await api.get(`/postpone/evenements/${idEvenement}`)
            setDonnees(reponse.data)
        } catch (error) {
            catcher(error, t('postpone.loadFailed'))
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [idEvenement])

    useEffect(() => {
        if (!idEvenement) return
        api.get(`/postpone/evenements/${idEvenement}`)
            .then((reponse) => setDonnees(reponse.data))
            .catch((error) => catcher(error, t('postpone.loadFailed')))
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [idEvenement])

    /**
     * "Tue 12 Nov from 14:00 to 15:00", in the member's timezone.
     *
     * @param {string} debut - UTC ISO.
     * @param {string} fin - UTC ISO.
     * @returns {string}
     */
    const plage = (debut: string, fin: string) => {
        const d = convertUTCToLocal(debut, membre?.timezone)
        const f = convertUTCToLocal(fin, membre?.timezone)
        return t('postpone.range', { jour: d.toFormat('ccc d LLL'), debut: d.toFormat('HH:mm'), fin: f.toFormat('HH:mm') })
    }

    const proposer = () => {
        const creneau = donnees?.creneaux.find((c) => c.debut === selection)
        if (!creneau) return
        Alert.alert(t('postpone.confirmTitle'), t('postpone.confirmMessage', { plage: plage(creneau.debut, creneau.fin) }), [
            { text: t('postpone.cancel'), style: 'cancel' },
            {
                text: t('postpone.propose'), isPreferred: true, onPress: async () => {
                    setEnCours('proposer')
                    try {
                        await api.post(`/postpone/evenements/${idEvenement}`, { debut: creneau.debut, fin: creneau.fin })
                        ToastAbs.show({ type: toastTypes.success, text1: t('postpone.sentTitle'), text2: t('postpone.sentMessage'), position: 'top' })
                        setSelection(null)
                        setOuvertProposer(false)
                        setOuvertSuggestions(true)
                        await charger()
                    } catch (error) {
                        catcher(error, t('postpone.proposeFailed'))
                    } finally {
                        setEnCours(null)
                    }
                },
            },
        ])
    }

    const voter = async (suggestion: Suggestion, vote: 'oui' | 'non') => {
        if (suggestion.mon_vote === vote) return
        setEnCours(suggestion.id)
        try {
            await api.put(`/postpone/${suggestion.id}/vote`, { vote })
            await charger()
        } catch (error) {
            catcher(error, t('postpone.voteFailed'))
        } finally {
            setEnCours(null)
        }
    }

    const appliquer = () => {
        const suggestion = donnees?.suggestions.find((s) => s.id === selection)
        if (!suggestion) return
        Alert.alert(t('postpone.applyTitle'), t('postpone.applyMessage', {
            plage: plage(suggestion.debut, suggestion.fin), oui: suggestion.oui, non: suggestion.non,
        }), [
            { text: t('postpone.cancel'), style: 'cancel' },
            {
                text: t('postpone.apply'), isPreferred: true, onPress: async () => {
                    setEnCours('appliquer')
                    try {
                        await api.post(`/postpone/${suggestion.id}/appliquer`, {})
                        ToastAbs.show({ type: toastTypes.success, text1: t('postpone.appliedTitle'), text2: t('postpone.appliedMessage'), position: 'top' })
                        setSelection(null)
                        await charger()
                        onPlageChangee?.()
                    } catch (error: any) {
                        // Something in the creator's schedule at that time (same check as a creation).
                        const conflits = error?.response?.status === 409 ? error.response.data?.evenements : null
                        if (Array.isArray(conflits) && conflits.length) {
                            Alert.alert(t('postpone.conflictTitle'), t('postpone.conflictMessage', {
                                titres: conflits.map((c: any) => c.titre).filter(Boolean).join(', '),
                            }))
                        } else {
                            catcher(error, t('postpone.applyFailed'))
                        }
                    } finally {
                        setEnCours(null)
                    }
                },
            },
        ])
    }

    const s = StyleSheet.create({
        panneau: integre
            ? { gap: 10 }
            : {
                backgroundColor: colors.card,
                borderTopWidth: StyleSheet.hairlineWidth,
                borderColor: colors.border,
                paddingHorizontal: 16,
                paddingTop: 10,
                paddingBottom: 90, // room for the tab bar's FAB area
                gap: 10,
            },
        entete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
        titre: { color: colors.text, fontFamily: fonts.title, fontSize: 16 },
        texte: { color: colors.muted, fontFamily: fonts.body, fontSize: 14 },
        ligne: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            paddingVertical: 6,
            paddingHorizontal: 8,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: 'transparent',
        },
        ligneSelection: { borderColor: colors.secondary, backgroundColor: colors.primary },
        plage: { flex: 1, color: colors.text, fontFamily: fonts.body, fontSize: 15 },
        compte: { flexDirection: 'row', alignItems: 'center', gap: 2 },
        nombre: { fontFamily: fonts.number, fontSize: 14 },
        vote: {
            width: 34,
            height: 34,
            borderRadius: 100,
            borderWidth: 1,
            alignItems: 'center',
            justifyContent: 'center',
        },
        bouton: {
            height: 46,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: colors.secondary,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 6,
        },
        texteBouton: { color: colors.text, fontFamily: fonts.title, fontSize: 14 },
    })

    if (!donnees) return null
    const { est_createur, peut_proposer, suggestions, creneaux } = donnees
    if (!peut_proposer && suggestions.length === 0) return null

    const compteVotes = (suggestion: Suggestion) => (
        <>
            <View style={s.compte}>
                <Ionicons name="checkmark" size={16} color={colors.success} />
                <Text style={[s.nombre, { color: colors.success }]}>{suggestion.oui}</Text>
            </View>
            <View style={s.compte}>
                <Ionicons name="close" size={16} color={colors.error} />
                <Text style={[s.nombre, { color: colors.error }]}>{suggestion.non}</Text>
            </View>
        </>
    )

    const boutonVote = (suggestion: Suggestion, vote: 'oui' | 'non') => {
        const couleur = vote === 'oui' ? colors.success : colors.error
        const choisi = suggestion.mon_vote === vote
        return (
            <TouchableOpacity
                style={[s.vote, { borderColor: couleur, backgroundColor: choisi ? couleur : 'transparent' }]}
                onPress={() => voter(suggestion, vote)}
                disabled={!!enCours}
                accessibilityRole="button"
                accessibilityLabel={vote === 'oui' ? t('postpone.voteYes') : t('postpone.voteNo')}
                accessibilityState={{ selected: choisi }}
            >
                <Ionicons name={vote === 'oui' ? 'checkmark' : 'close'} size={18} color={choisi ? colors.card : couleur} />
            </TouchableOpacity>
        )
    }

    return (
        <View style={s.panneau}>
            {peut_proposer && (
                <>
                    <TouchableOpacity style={s.entete} onPress={() => setOuvertProposer((o) => !o)} accessibilityRole="button">
                        <Text style={s.titre}>{t('postpone.title')}</Text>
                        <Ionicons name={ouvertProposer ? 'chevron-up' : 'chevron-down'} size={20} color={colors.text} />
                    </TouchableOpacity>
                    {ouvertProposer && (creneaux.length === 0
                        ? <Text style={s.texte}>{t('postpone.noSlot')}</Text>
                        : <>
                            {creneaux.map((c) => (
                                <TouchableOpacity
                                    key={c.debut}
                                    style={[s.ligne, selection === c.debut && s.ligneSelection]}
                                    onPress={() => setSelection(selection === c.debut ? null : c.debut)}
                                    disabled={c.deja_propose || !!enCours}
                                    accessibilityRole="radio"
                                    accessibilityState={{ selected: selection === c.debut, disabled: c.deja_propose }}
                                >
                                    <Ionicons name="time-outline" size={16} color={c.deja_propose ? colors.muted : colors.text} />
                                    <Text style={[s.plage, c.deja_propose && { color: colors.muted }]}>{plage(c.debut, c.fin)}</Text>
                                    {c.deja_propose && <Text style={s.texte}>{t('postpone.alreadyProposed')}</Text>}
                                </TouchableOpacity>
                            ))}
                            <TouchableOpacity
                                style={[s.bouton, !selection && { opacity: 0.5 }]}
                                onPress={proposer}
                                disabled={!selection || !!enCours}
                                accessibilityRole="button"
                            >
                                {enCours === 'proposer'
                                    ? <Spinner size={18} color={colors.text} />
                                    : <Ionicons name="paper-plane-outline" size={18} color={colors.text} />}
                                <Text style={s.texteBouton}>{t('postpone.propose')}</Text>
                            </TouchableOpacity>
                        </>
                    )}
                </>
            )}

            {suggestions.length > 0 && (
                <>
                    <TouchableOpacity style={s.entete} onPress={() => setOuvertSuggestions((o) => !o)} accessibilityRole="button">
                        <Text style={s.titre}>{t('postpone.suggestionsCount', { count: suggestions.length })}</Text>
                        <Ionicons name={ouvertSuggestions ? 'chevron-up' : 'chevron-down'} size={20} color={colors.text} />
                    </TouchableOpacity>
                    {ouvertSuggestions && suggestions.map((suggestion) => {
                        const contenu = (
                            <>
                                <View style={{ flex: 1 }}>
                                    <Text style={s.plage}>{plage(suggestion.debut, suggestion.fin)}</Text>
                                    <Text style={s.texte}>{t('postpone.proposedBy', { pseudo: suggestion.proposeur })}</Text>
                                </View>
                                {compteVotes(suggestion)}
                                {!est_createur && (enCours === suggestion.id
                                    ? <Spinner size={22} color={colors.muted} />
                                    : <>
                                        {boutonVote(suggestion, 'oui')}
                                        {boutonVote(suggestion, 'non')}
                                    </>)}
                            </>
                        )
                        // The creator selects one to apply; an invitee votes on each.
                        return est_createur
                            ? (
                                <TouchableOpacity
                                    key={suggestion.id}
                                    style={[s.ligne, selection === suggestion.id && s.ligneSelection]}
                                    onPress={() => setSelection(selection === suggestion.id ? null : suggestion.id)}
                                    disabled={!!enCours}
                                    accessibilityRole="radio"
                                    accessibilityState={{ selected: selection === suggestion.id }}
                                >
                                    {contenu}
                                </TouchableOpacity>
                            )
                            : <View key={suggestion.id} style={s.ligne}>{contenu}</View>
                    })}
                    {ouvertSuggestions && est_createur && (
                        <TouchableOpacity
                            style={[s.bouton, !selection && { opacity: 0.5 }]}
                            onPress={appliquer}
                            disabled={!selection || !!enCours}
                            accessibilityRole="button"
                        >
                            {enCours === 'appliquer'
                                ? <Spinner size={18} color={colors.text} />
                                : <Ionicons name="swap-horizontal" size={18} color={colors.text} />}
                            <Text style={s.texteBouton}>{t('postpone.apply')}</Text>
                        </TouchableOpacity>
                    )}
                </>
            )}
        </View>
    )
}
