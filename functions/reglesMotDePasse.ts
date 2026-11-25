/** Minimum length of a password (same as the sign-up screen and the API). */
export const LONGUEUR_MIN_MDP = 12

/** Special characters a password must contain one of (same list as the sign-up screen). */
const CARACTERES_SPECIAUX = /[!@#$%^&*()?":{}|<>]/

/** Each rule of a password, met or not. */
export type ReglesMotDePasse = {
    /** At least LONGUEUR_MIN_MDP characters. */
    longueur: boolean
    /** A special character. */
    special: boolean
    /** An upper case and a lower case letter. */
    majMin: boolean
}

/**
 * Which rules a password meets — the sign-up screen's (app/(auth)/register.tsx), also
 * checked by the API when a member changes their password (PATCH /membres/mot_de_passe).
 *
 * @author Philip — user story 50 (changing one's password)
 * @param {string} mdp
 * @returns {ReglesMotDePasse}
 */
export function verifierMotDePasse(mdp: string): ReglesMotDePasse {
    return {
        longueur: mdp.length >= LONGUEUR_MIN_MDP,
        special: CARACTERES_SPECIAUX.test(mdp),
        majMin: /[A-Z]/.test(mdp) && /[a-z]/.test(mdp),
    }
}

/**
 * Whether a password meets every rule.
 *
 * @author Philip — user story 50
 * @param {string} mdp
 * @returns {boolean}
 */
export function motDePasseValide(mdp: string): boolean {
    const regles = verifierMotDePasse(mdp)
    return regles.longueur && regles.special && regles.majMin
}
