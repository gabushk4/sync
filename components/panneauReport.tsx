import Ionicons from '@react-native-vector-icons/ionicons'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import ToastAbs from '@/abstractions/toastAbs'
import ConfirmationEnvoi from '@/components/confirmationEnvoi'
import Spinner from '@/components/spinner'
import { toastTypes } from '@/constants/toastConfig'
import { useAPI } from '@/contextes/contexteAPI'
import { useFont } from '@/contextes/contexteFont'
import { useMembre } from '@/contextes/contexteMembre'
import { usePalette } from '@/contextes/contextePalette'
import catcher from '@/functions/catcher'
import { convertUTCToLocal } from '@/functions/convertirUTCenLocal'
import { convertirTimestampJourCourt } from '@/functions/convertirTimestamp'
import useReportEvenement, { Creneau, Suggestion } from '@/hooks/useReportEvenement'

type Props = {
    /** Public id of the event. */
    idEvenement: string
    /** The creator moved the event: reload it. */
    onPlageChangee?: () => void
    /** Inside another panel (the invitation decision one): no background nor padding of its own. */
    integre?: boolean
    /** A block of the event's form (details page): its rounded card and label style. */
    enBloc?: boolean
}

/**
 * Postponement on an event's page (user story 23).
 * - "Common availabilities": a drop-down of the slots where every participant is free
 *   (next 7 days), gold blocks by day. Tap one, then the send button: an invitee
 *   proposes it (the other invitees vote), the creator moves the event there (the
 *   invitees confirm again). Confirmed in place (ConfirmationEnvoi), no native alert.
 * - The open proposals: an invitee votes yes / no on each; the creator sees their
 *   counts, selects one and "change the time" moves the event (yes → attending, no →
 *   not attending, the others answer again). Only while everyone is still free at
 *   their time: the API closes the others (a vote / apply on one answers 409).
 * Recurring events and unavailabilities can't be postponed (the API says so).
 *
 * @author Philip — user story 23 (postponement votes)
 * @author Philip — user story 23 (common free slots): gold blocks in a drop-down, for
 *   the creator too (move), confirmed in place instead of an iOS / Android alert
 * @param {Props} props
 * @returns {JSX.Element | null}
 */
export default function PanneauReport({ idEvenement, onPlageChangee, integre = false, enBloc = false }: Props) {
    const { t } = useTranslation('events')
    const { colors } = usePalette()
    const { fonts } = useFont()
    const { api } = useAPI()
    const { membre } = useMembre()

    const { donnees, charger, enCours, setEnCours, plage, envoyerCreneau, alerterRefus } = useReportEvenement(idEvenement, { onPlageChangee })
    const [ouvertCreneaux, setOuvertCreneaux] = useState(false)
    const [ouvertSuggestions, setOuvertSuggestions] = useState(false)
    // Start of the selected common free slot.
    const [creneauChoisi, setCreneauChoisi] = useState<string | null>(null)
    // Id of the suggestion the creator selected to apply.
    const [selection, setSelection] = useState<string | null>(null)

    const voter = async (suggestion: Suggestion, vote: 'oui' | 'non') => {
        if (suggestion.mon_vote === vote) return
        setEnCours(suggestion.id)
        try {
            await api.put(`/postpone/${suggestion.id}/vote`, { vote })
            await charger()
        } catch (error: any) {
            catcher(error, t('postpone.voteFailed'))
            // 409: the vote ended (someone isn't free then anymore): it leaves the list.
            if (error?.response?.status === 409) await charger()
        } finally {
            setEnCours(null)
        }
    }

    const envoyer = async () => {
        const creneau = donnees?.creneaux.find((c) => c.debut === creneauChoisi)
        if (creneau && await envoyerCreneau(creneau)) setCreneauChoisi(null)
    }

    const appliquer = async () => {
        const suggestion = donnees?.suggestions.find((s) => s.id === selection)
        if (!suggestion) return
        setEnCours('appliquer')
        try {
            await api.post(`/postpone/${suggestion.id}/appliquer`, {})
            ToastAbs.show({ type: toastTypes.success, text1: t('postpone.appliedTitle'), text2: t('postpone.appliedMessage'), position: 'top' })
            setSelection(null)
            await charger()
            onPlageChangee?.()
        } catch (error: any) {
            if (await alerterRefus(error)) setSelection(null)
            else catcher(error, t('postpone.applyFailed'))
        } finally {
            setEnCours(null)
        }
    }

    const s = StyleSheet.create({
        panneau: integre
            ? { gap: 10 }
            : enBloc
            ? { backgroundColor: colors.card, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 12, gap: 10 }
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
        // in the form: the label style of its other blocks (Visibility, Participants…)
        titre: enBloc
            ? { color: colors.muted, fontFamily: fonts.body, fontSize: 20 }
            : { color: colors.text, fontFamily: fonts.title, fontSize: 16 },
        texte: { color: colors.muted, fontFamily: fonts.body, fontSize: 14 },
        jour: { color: colors.text, fontFamily: fonts.title, fontSize: 13, marginTop: 2 },
        blocs: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
        bloc: {
            paddingVertical: 8,
            paddingHorizontal: 10,
            borderRadius: 10,
            borderWidth: 2,
            borderColor: 'transparent',
            backgroundColor: colors.or,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
        },
        blocChoisi: { borderColor: colors.text },
        texteBloc: { color: colors.text, fontFamily: fonts.number, fontSize: 13 },
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
    })

    if (!donnees) return null
    const { est_createur, peut_proposer, peut_deplacer, suggestions, creneaux } = donnees
    if (!peut_proposer && !peut_deplacer && suggestions.length === 0) return null

    // Common free slots grouped by the member's local day, in order.
    const parJour: { jour: string, creneaux: Creneau[] }[] = []
    for (const c of creneaux) {
        // formats.json, not Luxon's month names ('LLLL' gave "null" on the phone)
        const jour = convertirTimestampJourCourt(convertUTCToLocal(c.debut, membre?.timezone))
        const groupe = parJour.find((g) => g.jour === jour)
        if (groupe) groupe.creneaux.push(c)
        else parJour.push({ jour, creneaux: [c] })
    }
    const heures = (c: Creneau) =>
        `${convertUTCToLocal(c.debut, membre?.timezone).toFormat('HH:mm')} – ${convertUTCToLocal(c.fin, membre?.timezone).toFormat('HH:mm')}`
    const creneau = creneaux.find((c) => c.debut === creneauChoisi)
    const suggestionChoisie = suggestions.find((sg) => sg.id === selection)

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
            {(peut_proposer || peut_deplacer) && (
                <>
                    <TouchableOpacity style={s.entete} onPress={() => setOuvertCreneaux((o) => !o)} accessibilityRole="button">
                        <Text style={s.titre}>{t('postpone.commonSlots', { count: creneaux.length })}</Text>
                        <Ionicons name={ouvertCreneaux ? 'chevron-up' : 'chevron-down'} size={20} color={colors.text} />
                    </TouchableOpacity>
                    {ouvertCreneaux && (creneaux.length === 0
                        ? <Text style={s.texte}>{t('postpone.noSlot')}</Text>
                        : <>
                            {parJour.map((groupe) => (
                                <View key={groupe.jour} style={{ gap: 4 }}>
                                    <Text style={s.jour}>{groupe.jour}</Text>
                                    <View style={s.blocs}>
                                        {groupe.creneaux.map((c) => (
                                            <TouchableOpacity
                                                key={c.debut}
                                                style={[s.bloc, creneauChoisi === c.debut && s.blocChoisi, c.deja_propose && { opacity: 0.45 }]}
                                                onPress={() => setCreneauChoisi(creneauChoisi === c.debut ? null : c.debut)}
                                                disabled={c.deja_propose || !!enCours}
                                                accessibilityRole="radio"
                                                accessibilityLabel={plage(c.debut, c.fin)}
                                                accessibilityState={{ selected: creneauChoisi === c.debut, disabled: c.deja_propose }}
                                            >
                                                <Text style={s.texteBloc}>{heures(c)}</Text>
                                                {c.deja_propose && <Text style={[s.texteBloc, { fontFamily: fonts.body }]}>· {t('postpone.alreadyProposed')}</Text>}
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>
                            ))}
                            <ConfirmationEnvoi
                                libelle={t(peut_deplacer ? 'postpone.move' : 'postpone.propose')}
                                question={creneau ? t(peut_deplacer ? 'postpone.confirmMove' : 'postpone.confirmPropose', { plage: plage(creneau.debut, creneau.fin) }) : ''}
                                desactive={!creneau}
                                enCours={enCours === 'creneau'}
                                onConfirmer={envoyer}
                            />
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
                        <ConfirmationEnvoi
                            libelle={t('postpone.apply')}
                            icone="swap-horizontal"
                            question={suggestionChoisie ? t('postpone.applyMessage', {
                                plage: plage(suggestionChoisie.debut, suggestionChoisie.fin), oui: suggestionChoisie.oui, non: suggestionChoisie.non,
                            }) : ''}
                            desactive={!suggestionChoisie}
                            enCours={enCours === 'appliquer'}
                            onConfirmer={appliquer}
                        />
                    )}
                </>
            )}
        </View>
    )
}
