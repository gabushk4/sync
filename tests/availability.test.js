import { DateTime, Settings } from 'luxon';
import { getCommonFreeSlots } from '../functions/availability.js';

const zone = 'America/Montreal';
// `zone` doit être défini comme dans ton fichier actuel (ex. 'America/Toronto')

const figerHorloge = (iso) => {
  Settings.now = () => DateTime.fromISO(iso, { zone }).toMillis()
}

describe('getCommonFreeSlots', () => {
  // Par défaut : "maintenant" = 15 juin 2026, un jour qu'aucun test n'utilise,
  // donc la logique `passe` ne se déclenche pas.
  beforeEach(() => {
    figerHorloge('2026-06-15T12:00:00')
  })

  afterEach(() => {
    Settings.now = () => Date.now() // remet l'horloge réelle
  })

  test('jour de changement heure (25 h) : 2 creneaux autour evenement', () => {
    const d = DateTime.fromISO('2026-11-01T00:00:00', { zone })
    const ev = [
      {
        debut: DateTime.fromISO('2026-11-01T14:00:00', { zone }),
        fin: DateTime.fromISO('2026-11-01T15:00:00', { zone }),
      },
    ]
    const slots = getCommonFreeSlots(ev, [], d)
    expect(slots).toHaveLength(2)
    expect(slots[0].end.toFormat('HH:mm')).toBe('14:00')
    expect(slots[1].start.toFormat('HH:mm')).toBe('15:00')
    expect(slots[0].duration).toBe(900)
    expect(slots[1].duration).toBe(540)
  })

  test('jour normal sans evenement : un seul creneau de 24 h', () => {
    const d = DateTime.fromISO('2026-10-01T00:00:00', { zone })
    const slots = getCommonFreeSlots([], [], d)
    expect(slots).toHaveLength(1)
    expect(slots[0].duration).toBe(1440)
    expect(slots[0].start.toISODate()).toBe('2026-10-01')
  })

  test('evenement de la veille : ignore', () => {
    const d = DateTime.fromISO('2026-10-02T00:00:00', { zone })
    const ev = [
      {
        debut: DateTime.fromISO('2026-10-01T10:00:00', { zone }),
        fin: DateTime.fromISO('2026-10-01T11:00:00', { zone }),
      },
    ]
    const slots = getCommonFreeSlots(ev, [], d)
    expect(slots).toHaveLength(1)
    expect(slots[0].duration).toBe(1440)
  })

  // Nouveau : le comportement `passe` d'aujourd'hui
  test("aujourd'hui à 10 h 30 : le créneau en cours est coupé en passé + futur", () => {
    figerHorloge('2026-11-01T10:30:00')

    const d = DateTime.fromISO('2026-11-01T00:00:00', { zone })
    const ev = [
      {
        debut: DateTime.fromISO('2026-11-01T14:00:00', { zone }),
        fin: DateTime.fromISO('2026-11-01T15:00:00', { zone }),
      },
    ]
    const slots = getCommonFreeSlots(ev, [], d)

    expect(slots).toHaveLength(3)

    expect(slots[0].passe).toBe(true)
    expect(slots[0].end.toFormat('HH:mm')).toBe('10:00')
    expect(slots[0].duration).toBe(660) // 00:00 EDT -> 10:00 EST (jour de 25 h)

    expect(slots[1].passe).toBeUndefined()
    expect(slots[1].start.toFormat('HH:mm')).toBe('10:00')
    expect(slots[1].end.toFormat('HH:mm')).toBe('14:00')

    expect(slots[2].start.toFormat('HH:mm')).toBe('15:00')
  })
})
