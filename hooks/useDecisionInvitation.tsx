import { router } from 'expo-router'
import { DateTime } from 'luxon'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import ToastAbs from '@/abstractions/toastAbs'
import ConflitEvenement, { SortieConflit } from '@/components/conflitEvenement'
import PropositionApresRefus, { CLE_MODAL_APRES_REFUS } from '@/components/propositionApresRefus'
import { toastTypes } from '@/constants/toastConfig'
import { useAPI } from '@/contextes/contexteAPI'
import { useModal } from '@/contextes/contexteModals'
import catcher from '@/functions/catcher'
import { conflitsDeLaReponse, EvenementEnConflit } from '@/types/conflit'
import { bornesLocales, InvitationInfo } from '@/types/invitation'

type Options = {
    /** The invitation got an answer ('acceptee' | 'refusee'). */
    onRepondu?: (statut: 'acceptee' | 'refusee') => void
    /** "Adjust my schedule": show the invitation review screen. */
    onVoirHoraire: () => void
}

/**
 * Answers an event invitation, shared by the feed (notification buttons) and the
 * decision page (the invited event's details):
 * - `accepter`: accepts it; when it overlaps the member's schedule (API 409), the
 *   conflict screen (`conflit`, to render) offers to remove the conflicts and
 *   accept, or to see everyone's schedule that day (`onVoirHoraire`);
 * - `refuser`: refuses it, then asks whether to propose another date instead
 *   (PropositionApresRefus, in the generic modal) when the event can still be postponed.
 *
 * @author Philip — user story 8 (answering an invitation in conflict)
 * @author Philip — user story 23: a postponement proposal offered on refusal
 * @param {InvitationInfo | null} invitation - Invitation to answer (null: nothing to do).
 * @param {Options} options
 * @returns {{ accepter: () => Promise<void>, refuser: () => Promise<void>,
 *   conflit: JSX.Element | null, enCours: false | 'acceptee' | 'refusee' }}
 */
export default function useDecisionInvitation(invitation: InvitationInfo | null, { onRepondu, onVoirHoraire }: Options) {
    const { t } = useTranslation('events')
    const { api } = useAPI()
    const { setDataRendererContent } = useModal()

    const [existants, setExistants] = useState<EvenementEnConflit[] | null>(null)
    // The answer being sent (spinner on its button, every button disabled), or false.
    const [enCours, setEnCours] = useState<false | 'acceptee' | 'refusee'>(false)

    const url = invitation ? `/evenements/invitations/${invitation.id}` : ''

    /**
     * After a refusal: the event's time (local) when the member may still propose another
     * one (the API's `peut_proposer` — not a recurring event, not over), else null.
     *
     * @author Philip — user story 23 (a postponement proposal offered on refusal)
     * @param {InvitationInfo} inv - The invitation just refused.
     * @returns {Promise<{ debut: DateTime, fin: DateTime } | null>}
     */
    const plageSiProposable = async (inv: InvitationInfo) => {
        const { debut, fin } = bornesLocales(inv)
        if (!debut || !fin) return null
        try {
            const reponse = await api.get(`/postpone/evenements/${inv.id_evenement}`)
            return reponse.data?.peut_proposer ? { debut, fin } : null
        } catch {
            // The refusal went through: just don't offer it.
            return null
        }
    }

    /**
     * "Would you like to propose another date?" (PropositionApresRefus) in the generic
     * modal: a route of its own, since the feed's card leaves the list once refused
     * (polling) and the decision page goes back to the timeline.
     *
     * @author Philip — user story 23 (a postponement proposal offered on refusal)
     * @param {InvitationInfo} inv - The invitation just refused.
     * @param {{ debut: DateTime, fin: DateTime }} plageActuelle - The event's time (local).
     * @returns {void}
     */
    const ouvrirPropositionApresRefus = (inv: InvitationInfo, plageActuelle: { debut: DateTime, fin: DateTime }) => {
        // Keyed by invitation: a new refusal never shows the previous one's step.
        setDataRendererContent(CLE_MODAL_APRES_REFUS, (
            <PropositionApresRefus
                key={inv.id}
                idEvenement={inv.id_evenement}
                titre={inv.titre_evenement}
                plageActuelle={plageActuelle}
            />
        ))
        router.push({
            pathname: '/(modals)/dataRenderer',
            params: { key: CLE_MODAL_APRES_REFUS, title: t('invitationDecision.refusedTitle'), sansBoutonFermer: '1' },
        } as any)
    }

    /**
     * Sends the answer. Accepting may answer 409 (the event overlaps the member's
     * schedule): the conflict screen then opens instead of an error. Refusing may then
     * offer to propose another date (its modal says it was refused: no toast then).
     *
     * @author Philip — user story 8
     * @param {'acceptee' | 'refusee'} statut
     * @returns {Promise<void>}
     */
    const repondre = async (statut: 'acceptee' | 'refusee') => {
        if (!invitation || enCours) return
        setEnCours(statut)
        try {
            const reponse = await api.patch(url, { statut })
            // Checked before moving on: the screen under it and the modal change together.
            const plageProposable = statut === 'refusee' ? await plageSiProposable(invitation) : null
            onRepondu?.(statut)
            if (plageProposable) ouvrirPropositionApresRefus(invitation, plageProposable)
            else ToastAbs.show({ type: toastTypes.success, text2: reponse.data?.message })
        } catch (error: any) {
            if (statut === 'acceptee' && error.response?.status === 409) {
                setExistants(conflitsDeLaReponse(error.response.data))
            } else {
                catcher(error, t(statut === 'acceptee' ? 'conflict.acceptFailed' : 'invitationDecision.refuseFailed'))
            }
        } finally {
            setEnCours(false)
        }
    }

    /**
     * The conflict screen is left (see SortieConflit).
     *
     * @author Philip — user story 8 (answering an invitation)
     * @param {SortieConflit} sortie
     * @returns {void}
     */
    const quitterConflit = (sortie: SortieConflit) => {
        setExistants(null)
        if (sortie === 'accueil') onRepondu?.('acceptee')
        else if (sortie === 'retour') onVoirHoraire()
    }

    const conflit = invitation && existants ? (
        <ConflitEvenement
            mode="invitation"
            existants={existants}
            evenement={{ titre: invitation.titre_evenement, debut: invitation.debut, fin: invitation.fin }}
            confirmer={() => api.patch(url, { statut: 'acceptee' })}
            onSortie={quitterConflit}
        />
    ) : null

    return {
        accepter: () => repondre('acceptee'),
        refuser: () => repondre('refusee'),
        conflit,
        enCours,
    }
}
