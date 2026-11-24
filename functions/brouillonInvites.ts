import { Participant } from "@/types/invites";

/**
 * The participants changes of an event form, before its ✓: friends added (`invites`, not
 * invited yet) and participants already in the event to remove (`retraits`).
 */
export type BrouillonInvites = { invites: Participant[], retraits: Participant[] }

export const BROUILLON_VIDE: BrouillonInvites = { invites: [], retraits: [] }

/**
 * Adds friends to the pending invitations, deduplicated by id. A participant removed in
 * this edit and picked again stays: the removal is cancelled, no new invitation.
 *
 * @author Philip — invitations only sent on the form's ✓
 * @param {BrouillonInvites} prev
 * @param {Participant[]} amis - Friends picked (as the friend list gives them).
 * @returns {BrouillonInvites}
 */
export function ajouterAuBrouillon(prev: BrouillonInvites, amis: Participant[]): BrouillonInvites {
    const nouveaux = amis.map((ami): Participant => ({
        id: ami.id,
        privilege: 'lecteur',
        pseudo: ami.pseudo,
        fp_url: ami.fp_url,
        statut: 'en_attente',
    }))
    const retires = new Set(prev.retraits.map((p) => p.id))
    const parId = new Map(prev.invites.map((i) => [i.id, i]))
    nouveaux.filter((i) => !retires.has(i.id)).forEach((i) => parId.set(i.id, i))
    const ids = new Set(nouveaux.map((i) => i.id))
    return { invites: [...parId.values()], retraits: prev.retraits.filter((p) => !ids.has(p.id)) }
}

/**
 * Drops a friend added in the form (nothing was sent yet).
 *
 * @param {BrouillonInvites} prev
 * @param {string} id - Public id of the friend.
 * @returns {BrouillonInvites}
 */
export function retirerDuBrouillon(prev: BrouillonInvites, id: string): BrouillonInvites {
    return { ...prev, invites: prev.invites.filter((invite) => invite.id !== id) }
}

/**
 * Marks a participant already in the event to be removed with ✓ (once).
 *
 * @param {BrouillonInvites} prev
 * @param {Participant} participant
 * @returns {BrouillonInvites}
 */
export function marquerRetrait(prev: BrouillonInvites, participant: Participant): BrouillonInvites {
    return prev.retraits.some((p) => p.id === participant.id)
        ? prev
        : { ...prev, retraits: [...prev.retraits, participant] }
}
