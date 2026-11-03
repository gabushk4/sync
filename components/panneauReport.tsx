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
import { usePalette } from '@/contextes/contextePalette'
import catcher from '@/functions/catcher'
import useReportEvenement, { Suggestion } from '@/hooks/useReportEvenement'

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
 * Postponement on an event's page (user story 23): the open proposals. An invitee
 * votes yes / no on each; the creator sees their counts, selects one and "change the
 * time" moves the event (yes → attending, no → not attending, the others answer
 * again). Only while everyone is still free at their time: the API closes the others
 * (a vote / apply on one answers 409). Proposals are made from the invitation review.
 * Recurring events and unavailabilities can't be postponed (the API says so).
 *
 * @author Philip — user story 23 (postponement votes)
 * @author Philip — rectification: common free slots removed from the event's page
 * @param {Props} props
 * @returns {JSX.Element | null}
 */
export default function PanneauReport({ idEvenement, onPlageChangee, integre = false, enBloc = false }: Props) {
    const { t } = useTranslation('events')
    const { colors } = usePalette()
    const { fonts } = useFont()
    const { api } = useAPI()

    const { donnees, charger, enCours, setEnCours, plage, alerterRefus } = useReportEvenement(idEvenement, { onPlageChangee })
    const [ouvertSuggestions, setOuvertSuggestions] = useState(false)
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
        // No flex: 1 — inside the row's column (flex: 1) it collapsed the text to 0 height.
        plage: { color: colors.text, fontFamily: fonts.body, fontSize: 15 },
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
    const { est_createur, suggestions } = donnees
    if (suggestions.length === 0) return null

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
        </View>
    )
}
