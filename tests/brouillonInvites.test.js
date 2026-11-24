import { ajouterAuBrouillon, BROUILLON_VIDE, marquerRetrait, retirerDuBrouillon } from '../functions/brouillonInvites';

const ami = (id, statut = 'acceptee') => ({ id, pseudo: id, fp_url: null, privilege: 'lecteur', statut });
const ids = (liste) => liste.map((p) => p.id);

describe('brouillonInvites (participants envoyés seulement au ✓)', () => {
  test('ajouter met en attente, sans doublon, avec le statut en attente', () => {
    let b = ajouterAuBrouillon(BROUILLON_VIDE, [ami('a'), ami('b')]);
    b = ajouterAuBrouillon(b, [ami('a')]);
    expect(ids(b.invites)).toEqual(['a', 'b']);
    expect(b.invites.every((i) => i.statut === 'en_attente' && i.privilege === 'lecteur')).toBe(true);
    expect(b.retraits).toEqual([]);
  });

  test('retirer un ajout en attente le fait disparaître', () => {
    const b = retirerDuBrouillon(ajouterAuBrouillon(BROUILLON_VIDE, [ami('a'), ami('b')]), 'a');
    expect(ids(b.invites)).toEqual(['b']);
  });

  test('un participant existant n’est marqué à retirer qu’une fois', () => {
    let b = marquerRetrait(BROUILLON_VIDE, ami('x'));
    b = marquerRetrait(b, ami('x'));
    expect(ids(b.retraits)).toEqual(['x']);
    expect(b.invites).toEqual([]);
  });

  test('réajouter un participant retiré annule le retrait, sans nouvelle invitation', () => {
    let b = marquerRetrait(BROUILLON_VIDE, ami('x'));
    b = ajouterAuBrouillon(b, [ami('x'), ami('y')]);
    expect(b.retraits).toEqual([]);
    expect(ids(b.invites)).toEqual(['y']);
  });
});
