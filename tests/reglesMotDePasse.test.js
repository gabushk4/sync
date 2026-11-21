import { motDePasseValide, verifierMotDePasse } from '../functions/reglesMotDePasse';

// Philip — user story 50: the rules of a new password (same as the sign-up screen and the API).
describe('règles du mot de passe', () => {
    test('un mot de passe qui suit toutes les règles est valide', () => {
        expect(verifierMotDePasse('Abcdefghijk!')).toEqual({ longueur: true, special: true, majMin: true });
        expect(motDePasseValide('Abcdefghijk!')).toBe(true);
    });

    test('moins de 12 caractères', () => {
        expect(verifierMotDePasse('Abcdefghij!').longueur).toBe(false);
        expect(motDePasseValide('Abcdefghij!')).toBe(false);
    });

    test('sans caractère spécial', () => {
        expect(verifierMotDePasse('Abcdefghijkl').special).toBe(false);
        expect(motDePasseValide('Abcdefghijkl')).toBe(false);
    });

    test('sans majuscule ou sans minuscule', () => {
        expect(verifierMotDePasse('abcdefghijk!').majMin).toBe(false);
        expect(verifierMotDePasse('ABCDEFGHIJK!').majMin).toBe(false);
        expect(motDePasseValide('ABCDEFGHIJK!')).toBe(false);
    });

    test('vide', () => {
        expect(verifierMotDePasse('')).toEqual({ longueur: false, special: false, majMin: false });
    });
});
