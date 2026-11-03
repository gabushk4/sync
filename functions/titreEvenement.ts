import i18n from '../i18n'

/**
 * Title to show for an event. An unavailability without a reason (or whose reason is
 * private, the API then sends no title) reads "Unavailable" in the member's language:
 * the API stores an empty title for it instead of the word in French.
 * Returns '' for any other event without a title (callers keep their own fallback,
 * e.g. a lock for a friend's private event).
 *
 * @author Philip — user story 20 (review)
 * @param {{ titre?: string | null, nature?: string }} evenement
 * @returns {string}
 */
export default function titreEvenement(evenement: { titre?: string | null, nature?: string }): string {
    const titre = evenement.titre?.trim()
    if (titre) return titre
    return evenement.nature === 'indisponibilite' ? i18n.t('events:unavailability.defaultTitle') : ''
}
