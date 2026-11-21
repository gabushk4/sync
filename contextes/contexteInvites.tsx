import { ajouterAuBrouillon, BROUILLON_VIDE, BrouillonInvites, marquerRetrait, retirerDuBrouillon } from "@/functions/brouillonInvites";
import log from "@/functions/log";
import { Participant } from "@/types/invites";
import React, { createContext, useCallback, useContext, useState } from 'react';

type InvitesContextValue = {
    /** Friends added in the form, not invited yet (sent with ✓). */
    invites: Participant[]
    /** Participants already in the event, to remove with ✓ (event being edited). */
    retraits: Participant[]
    ajouterInvite: (invite: Participant | Participant[]) => void
    supprimerInvite: (inviteSupp: Participant) => void
    retirerParticipant: (participant: Participant) => void
    resetInvites: () => void
}

export const InvitesContexte = createContext<InvitesContextValue | undefined>(undefined)

/**
 * The participants changes of the event form being filled (creation or edit): friends
 * added (`invites`) and existing participants removed (`retraits`), in one state since
 * adding a friend may cancel a removal (rules: functions/brouillonInvites). Nothing is
 * sent from here: the form's ✓ sends them (POST /evenements with the creation, or the
 * edit page's save), and leaving without ✓ drops them (resetInvites).
 *
 * @author Philip — invitations only sent on the form's ✓: "Invite" in the friend picker
 *   used to POST the invitation right away (and the X to DELETE the participant), even
 *   when the edit was then cancelled
 */
export const InvitesProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
    const [{ invites, retraits }, setBrouillon] = useState<BrouillonInvites>(BROUILLON_VIDE)

    const ajouterInvite = useCallback((invite: Participant | Participant[]) => {
        const amis = Array.isArray(invite) ? invite : [invite]
        log('ajouter invite', amis.map((ami) => ami.id))
        setBrouillon((prev) => ajouterAuBrouillon(prev, amis))
    }, [])

    const supprimerInvite = useCallback((inviteSupp: Participant) => {
        setBrouillon((prev) => retirerDuBrouillon(prev, inviteSupp.id))
    }, [])

    const retirerParticipant = useCallback((participant: Participant) => {
        setBrouillon((prev) => marquerRetrait(prev, participant))
    }, [])

    const resetInvites = useCallback(() => setBrouillon(BROUILLON_VIDE), [])

    return (
        <InvitesContexte.Provider value={{ invites, retraits, ajouterInvite, supprimerInvite, retirerParticipant, resetInvites }}>
            {children}
        </InvitesContexte.Provider>
    )
}

/**
 * @returns {InvitesContextValue} The form's pending participants changes.
 */
export const useInvites = (): InvitesContextValue => {
    const ctx = useContext(InvitesContexte)
    if (!ctx) throw new Error('useInvites must be used within an InvitesProvider')
    return ctx
}
