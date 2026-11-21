import { DateTime } from 'luxon';
import { disponibilitesCommunes } from '../functions/disponibilitesCommunes';

const zone = 'America/Montreal';
const jour = DateTime.fromISO('2026-06-16T00:00:00', { zone });
const h = (heure, minute = 0) => jour.set({ hour: heure, minute });
const occupe = (debut, fin) => ({ debut, fin });
// Busy all day except [debut, fin[.
const libreSeulement = (debut, fin) => [occupe(jour, debut), occupe(fin, jour.plus({ days: 1 }))];
const heures = (bloc) => `${bloc.debut.toFormat('HH:mm')}-${bloc.fin.toFormat('HH:mm')}`;

describe('disponibilitesCommunes', () => {
  test('blocs exacts, coupés seulement entre partiel et tout le monde', () => {
    const blocs = disponibilitesCommunes([
      { id: 'a', nom: 'A', occupations: libreSeulement(h(9), h(17)) },
      { id: 'b', nom: 'B', occupations: libreSeulement(h(10, 15), h(16)) },
      { id: 'c', nom: 'C', occupations: libreSeulement(h(12), h(15, 45)) },
    ], jour);

    // 9:00-10:15 A alone (nothing), 10:15-12:00 A+B, 12:00-15:45 all, 15:45-16:00 A+B.
    expect(blocs.get('a').map((b) => [heures(b), b.tous])).toEqual([
      ['10:15-12:00', false],
      ['12:00-15:45', true],
      ['15:45-16:00', false],
    ]);
    expect(blocs.get('b').map(heures)).toEqual(['10:15-12:00', '12:00-15:45', '15:45-16:00']);
    // C is only free while everyone is.
    expect(blocs.get('c').map((b) => [heures(b), b.tous])).toEqual([['12:00-15:45', true]]);
    expect(blocs.get('a')[1].segments[0].noms).toEqual(['A', 'B', 'C']);
  });

  test('un bloc partiel reste entier quand les personnes libres changent', () => {
    const blocs = disponibilitesCommunes([
      { id: 'a', nom: 'A', occupations: libreSeulement(h(9), h(12)) },
      { id: 'b', nom: 'B', occupations: libreSeulement(h(9), h(10)) },
      { id: 'c', nom: 'C', occupations: libreSeulement(h(10), h(12)) },
      { id: 'd', nom: 'D', occupations: [occupe(jour, jour.plus({ days: 1 }))] },
    ], jour);

    const [bloc] = blocs.get('a');
    expect(blocs.get('a')).toHaveLength(1);
    expect(heures(bloc)).toBe('09:00-12:00');
    expect(bloc.tous).toBe(false);
    expect(bloc.segments.map((sg) => [heures(sg), sg.noms])).toEqual([
      ['09:00-10:00', ['A', 'B']],
      ['10:00-12:00', ['A', 'C']],
    ]);
    // Only in the rows of the people free then.
    expect(blocs.get('b').map(heures)).toEqual(['09:00-10:00']);
    expect(blocs.get('c').map(heures)).toEqual(['10:00-12:00']);
    expect(blocs.get('d')).toEqual([]);
  });

  test('à deux, une dispo commune est toujours « tout le monde »', () => {
    const blocs = disponibilitesCommunes([
      { id: 'a', nom: 'A', occupations: [occupe(h(0), h(8))] },
      { id: 'b', nom: 'B', occupations: [occupe(h(0), h(9)), occupe(h(20), h(23, 30))] },
    ], jour);

    expect(blocs.get('a').map((b) => [heures(b), b.tous])).toEqual([
      ['09:00-20:00', true],
      ['23:30-00:00', true],
    ]);
    expect(blocs.get('a')[1].fin.toMillis()).toBe(jour.plus({ days: 1 }).toMillis());
  });

  test('tout le monde libre moins longtemps que l’évènement : partiel, fondu avec les voisins', () => {
    const personnes = [
      { id: 'a', nom: 'A', occupations: libreSeulement(h(9), h(12)) },
      { id: 'b', nom: 'B', occupations: libreSeulement(h(9), h(12)) },
      { id: 'c', nom: 'C', occupations: libreSeulement(h(10), h(10, 30)) },
    ];
    // Event of 1 h: everyone free only 10:00-10:30, too short.
    const blocs = disponibilitesCommunes(personnes, jour, { dureeMinTous: 60 });
    expect(blocs.get('a').map((b) => [heures(b), b.tous])).toEqual([['09:00-12:00', false]]);
    expect(blocs.get('a')[0].segments.map((sg) => [heures(sg), sg.noms])).toEqual([
      ['09:00-10:00', ['A', 'B']],
      ['10:00-10:30', ['A', 'B', 'C']],
      ['10:30-12:00', ['A', 'B']],
    ]);
    expect(blocs.get('c').map((b) => [heures(b), b.tous])).toEqual([['10:00-10:30', false]]);

    // Event of 30 min: it fits, green as before.
    const assezLong = disponibilitesCommunes(personnes, jour, { dureeMinTous: 30 });
    expect(assezLong.get('a').map((b) => [heures(b), b.tous])).toEqual([
      ['09:00-10:00', false],
      ['10:00-10:30', true],
      ['10:30-12:00', false],
    ]);
  });

  test('jamais un bloc dans un bloc : la plage de l’évènement (occupée pour tous) coupe la dispo', () => {
    // Event 4-5 (16:00-17:00), everyone free 15:00-19:00 otherwise.
    const evenement = occupe(h(16), h(17));
    const blocs = disponibilitesCommunes([
      { id: 'a', nom: 'A', occupations: [...libreSeulement(h(15), h(19)), evenement] },
      { id: 'b', nom: 'B', occupations: [...libreSeulement(h(15), h(19)), evenement] },
    ], jour, { dureeMinTous: 60 });
    expect(blocs.get('a').map((b) => [heures(b), b.tous])).toEqual([
      ['15:00-16:00', true],
      ['17:00-19:00', true],
    ]);
  });

  test('moins de deux participants : aucun bloc', () => {
    expect(disponibilitesCommunes([{ id: 'a', nom: 'A', occupations: [] }], jour).get('a')).toEqual([]);
  });
});
