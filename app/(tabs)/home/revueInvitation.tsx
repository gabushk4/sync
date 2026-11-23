import Ionicons from '@react-native-vector-icons/ionicons'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { DateTime } from 'luxon'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { useSharedValue, withDecay, withTiming } from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

import Haptics from '@/abstractions/haptics'
import ToastAbs from '@/abstractions/toastAbs'
import BlocDispoCommune from '@/components/blocDispoCommune'
import DetailDispoCommune, { EtatSegment } from '@/components/detailDispoCommune'
import EventsList, { RETRAIT_RANGEE } from '@/components/eventsList'
import ProfilPic from '@/components/pfp'
import SelectionGlissee from '@/components/selectionGlissee'
import Spinner from '@/components/spinner'
import Timeline from '@/components/timeline'
import { toastTypes } from '@/constants/toastConfig'
import { useAPI } from '@/contextes/contexteAPI'
import { useFont } from '@/contextes/contexteFont'
import { useGestionScroll } from '@/contextes/contexteGestionListes'
import { useMembre } from '@/contextes/contexteMembre'
import { useModal } from '@/contextes/contexteModals'
import { usePalette } from '@/contextes/contextePalette'
import { useTimeline } from '@/contextes/contexteTimeline'
import catcher from '@/functions/catcher'
import ceilBy5 from '@/functions/ceilBy5'
import { convertUTCToLocal } from '@/functions/convertirUTCenLocal'
import couleurStatutInvitation, { assombrir } from '@/functions/couleurStatutInvitation'
import { BlocDispo, disponibilitesCommunes, SegmentDispo } from '@/functions/disponibilitesCommunes'
import { estJourFerie, paramsJour } from '@/functions/evenementsMembre'
import { ouvrirDecisionInvitation } from '@/functions/ouvrirRevueInvitation'
import useReportEvenement, { Creneau, creneauDepuisPlage } from '@/hooks/useReportEvenement'
import { PlageChoisie, ZoneSelection } from '@/hooks/useSelectionGlissee'
import { modalEvents } from '@/events/modalEvents'
import { Event } from '@/types/calendar'
import { bornesLocales, InvitationInfo } from '@/types/invitation'

/** Photo column width and row height, like the home timeline. */
const LARGEUR_COLONNE = 80
const HAUTEUR_RANGEE = 104
/** Key of an availability's details in the modal context (dataRenderer). */
const CLE_MODAL_DISPO = 'revueInvitation-dispo'
/** Step (minutes) of a range picked by hold & drag in the member's row (ceilBy5 matches it). */
const PAS_PROPOSITION_MINUTES = 5

/** Who a row is: the inviter, another invitee, or the member. */
type Role = 'leader' | 'invite' | 'moi'

/**
 * Events that make a person busy, for the common availabilities: everything but the
 * invited event while it isn't accepted (a pending invitation doesn't take the time).
 *
 * @author Philip — user story 8 (answering an invitation)
 * @param {Event[]} evenements - A row's events (evenementsDe).
 * @returns {Event[]}
 */
const occupes = (evenements: Event[]) =>
    evenements.filter((ev: any) => !ev.est_invitation || ev.statut_invitation === 'acceptee')

/** One person of GET /evenements/invitations/:id/horaires. */
type PersonneHoraire = {
    id: string
    pseudo: string
    fp_url: string | null
    /** Their answer to the invitation. */
    statut: string
    /** Friend of the member: their other events come with titles. */
    ami: boolean
    evenements: Record<string, any>[]
}

type Horaires = {
    /** The invited event (dates: UTC ISO without offset). */
    evenement?: { id: string, titre: string, debut: string, fin: string }
    leader: PersonneHoraire | null
    invites: PersonneHoraire[]
    moi: PersonneHoraire | null
}

/**
 * Invitation review ("adjust my schedule" for an invitation in conflict): on the
 * invited event's day, the inviter (leader, at the top with a star), the other
 * people they invited, and the member — nobody else. Each row shows that person's
 * day (a friend's events with their titles, someone else's as grey "private"
 * blocks); the invited event is in every row, colored by each person's answer
 * (accepted green, pending orange, refused red; darker green for the leader's). The
 * invited event in the leader's row and in the member's own can be tapped: it opens the
 * decision page (the event, read-only, to accept or refuse); the member's other events
 * open their details, to move or delete one in conflict. Every row also shows the day's
 * common availabilities its person is part of (see disponibilitesCommunes): only their
 * count in the block, their details (ranges, who) and proposing one in a modal. The rows
 * scroll together, starting on the event's hour (once: coming back keeps the position).
 *
 * Route param `invitation`: {@link InvitationInfo} as JSON.
 *
 * @author Philip — user story 8 (reviewing an invitation in conflict)
 * @author Philip — user story 23 (common free slots): a slot where every participant is
 *   free can be proposed from the member's row, confirmed in place (ConfirmationEnvoi)
 * @author Philip — common availabilities on their exact times: wherever at least 2
 *   participants are free at once, in the rows of the people free then only — orange
 *   when some are, green when everyone is for at least the event's duration (legend),
 *   never over the invited event (split around it). They replace the fixed-size gold
 *   blocks and the free slots shared with the member; tapping one opens a modal with
 *   its exact ranges and who, each proposable (and, in the member's row, the slot of
 *   GET /postpone it holds, as before); sent, the modal closes back onto the review
 * @author Philip — a precise range inside a common availability of the member's row:
 *   hold & drag (SelectionGlissee, like the home screen's free blocks, but a 5-minute
 *   step), kept inside that availability; on release, "Propose" under the timeline sends
 *   it (envoyerCreneau, any duration), a tap elsewhere clears it
 * @returns {JSX.Element}
 */
export default function RevueInvitation() {
    const { t } = useTranslation('events')
    const { t: tHome } = useTranslation('home')
    const { colors } = usePalette()
    const { fonts } = useFont()
    const { api } = useAPI()
    const { membre } = useMembre()
    const { offset } = useGestionScroll()
    const { setDataRendererContent, removeDataRenderContent } = useModal()
    const { pxHeures, L_HEURES } = useTimeline()
    const { width: largeurEcran } = useWindowDimensions()
    // This screen shows one day: the shared bounds (GestionScrollProvider) now cover
    // the home screen's seven days and let the rows scroll into empty days.
    // Rectification (Philip) after the seven-day window.
    const maxOffset = Math.max(0, 24 * (pxHeures + L_HEURES) - (largeurEcran - LARGEUR_COLONNE))
    const clampOffset = (valeur: number) => {
        'worklet'
        return Math.min(Math.max(valeur, 0), maxOffset)
    }

    const { invitation: invitationParam } = useLocalSearchParams<{ invitation?: string }>()
    const invitation = useMemo<InvitationInfo | null>(
        () => (invitationParam ? JSON.parse(invitationParam) : null),
        [invitationParam]
    )
    // The invited event's local bounds (from the invitation) and its day — memoized: the
    // day is a dependency of the rows' computations and of the hold & drag.
    const bornesInvitation = useMemo(
        () => (invitation ? bornesLocales(invitation, membre.timezone) : null),
        [invitation, membre.timezone]
    )
    const debutEvenement = bornesInvitation?.debut
    const jour = useMemo(() => (debutEvenement ?? DateTime.now()).startOf('day'), [debutEvenement])

    // Slots where every participant is free (GET /postpone), proposable from the member's
    // row (Philip — user story 23).
    const { donnees: report, enCours: envoiCreneau, plage, envoyerCreneau } = useReportEvenement(invitation?.id_evenement)
    // The common availability tapped (its row's person and its start): outlined while its
    // details are open in the modal.
    const [choix, setChoix] = useState<{ personne: string, debut: number } | null>(null)

    const [horaires, setHoraires] = useState<Horaires | null>(null)
    // The invited event as the schedules send it (UTC ISO).
    const evenementInvite = horaires?.evenement
    // The request failed: a retry button instead of an endless spinner.
    const [erreur, setErreur] = useState(false)
    // Bumped by the retry button to run the request again.
    const [essai, setEssai] = useState(0)

    /**
     * Converts a row's events to the timeline's format, with this screen's
     * display: the invited event colored by its answer (couleurStatutInvitation) —
     * a darker green in the leader's row — and tappable in the leader's row and the
     * member's own (both open the decision page); the member's other events are
     * tappable too (their details); every other event is a plain block that
     * can't be tapped — with its title for a friend, or grey and
     * "private" for someone who isn't a friend (`masque`, the API sends no title).
     * The invited event is in every row: the API leaves it out of a pending or refused
     * invitee's (not in their schedule), so it's added here with their answer — it still
     * doesn't make them busy (occupes).
     *
     * @author Philip — user story 8 (answering an invitation)
     * @author Philip — the invited event in every row, colored by the person's answer
     * @param {PersonneHoraire} personne
     * @param {Role} role
     * @returns {Event[]}
     */
    const evenementsDe = (personne: PersonneHoraire, role: Role): Event[] => {
        const avecInvitation = evenementInvite && !personne.evenements.some((ev) => ev.est_invitation)
            ? [...personne.evenements, {
                id_publique: evenementInvite.id,
                titre: evenementInvite.titre,
                debut: evenementInvite.debut,
                fin: evenementInvite.fin,
                est_invitation: true,
                statut_invitation: personne.statut,
            }]
            : personne.evenements
        // Holidays don't occupy the day (like the home screen): no block.
        return avecInvitation.filter((ev) => !estJourFerie(ev)).map((ev) => (({
            ...ev,
            id: ev.id_publique,
            debut: convertUTCToLocal(ev.debut, membre.timezone),
            fin: convertUTCToLocal(ev.fin, membre.timezone),
            ...(ev.masque ? { titre: t('invitationReview.private') } : {}),

            couleur: ev.est_invitation
                ? role === 'leader'
                    ? assombrir(colors.success)
                    : couleurStatutInvitation(ev.statut_invitation, colors)
                : ev.masque ? colors.muted : undefined,

            // The member's own events too: they open their details, to move or
            // delete one in conflict (Philip — user story 8).
            cliquable: role === 'moi' || (!!ev.est_invitation && role === 'leader')
        }) as Event))
    }

    /**
     * Tap on an event of the review: the invited event opens the decision page;
     * one of the member's own events opens its details (edit / delete / leave),
     * pushed over this screen so going back returns here (reloaded on focus).
     *
     * @author Philip — user story 8 (adjusting my schedule)
     * @param {Event} ev
     * @returns {void}
     */
    const ouvrirEvenement = (ev: Event) => {
        if ((ev as any).est_invitation) {
            if (invitation) ouvrirDecisionInvitation(invitation, { depuisRevue: true })
            return
        }
        if (!ev.id || !ev.debut) return
        router.push({
            pathname: '/(tabs)/home/details/[eventId]',
            params: { eventId: ev.id, start: ev.debut.toISO(), end: (ev.fin ?? ev.debut).toISO() },
        } as any)
    }

    // Every row's person and role, in display order (leader, invitees, member): every
    // person shown is a participant, the member included.
    const lignes = useMemo<[PersonneHoraire, Role][]>(() => (horaires ? [
        ...(horaires.leader ? [[horaires.leader, 'leader'] as [PersonneHoraire, Role]] : []),
        ...horaires.invites.map((p) => [p, 'invite'] as [PersonneHoraire, Role]),
        ...(horaires.moi ? [[horaires.moi, 'moi'] as [PersonneHoraire, Role]] : []),
    ] : []), [horaires])

    // Each row's events in the timeline's format, converted once per load (shared by the
    // rows and the availabilities, instead of on every render of every row).
    const evenementsParPersonne = useMemo(
        () => new Map(lignes.map(([personne, role]) => [personne.id, evenementsDe(personne, role)])),
        // evenementsDe only reads what these change with (the invited event comes with `lignes`).
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [lignes, colors, membre.timezone, t]
    )

    // The invited event as first scheduled (local; the invitation's bounds until the
    // schedules load): its time is left out of everyone's availabilities, and its
    // duration is the shortest "everyone available" (green) — shorter, it's partial.
    const plageInitiale = useMemo(() => {
        const debut = evenementInvite ? convertUTCToLocal(evenementInvite.debut, membre.timezone) : bornesInvitation?.debut
        const fin = evenementInvite ? convertUTCToLocal(evenementInvite.fin, membre.timezone) : bornesInvitation?.fin
        return debut && fin ? { debut, fin } : null
    }, [evenementInvite, bornesInvitation, membre.timezone])
    const dureeEvenementMinutes = plageInitiale
        ? Math.max(0, Math.round(plageInitiale.fin.diff(plageInitiale.debut, 'minutes').minutes))
        : 0

    // Every row's common availabilities (by person id). The invited event's time is busy
    // for everyone — its block is in every row, and a block never sits inside another: an
    // availability over it is split around it (e.g. event 4-5, free 3-7: 3-4 and 5-7).
    const blocsParPersonne = useMemo(() => disponibilitesCommunes(lignes.map(([personne, role]) => ({
        id: personne.id,
        nom: role === 'moi' ? t('invitationReview.me') : personne.pseudo,
        occupations: [...occupes(evenementsParPersonne.get(personne.id) ?? []), ...(plageInitiale ? [plageInitiale] : [])],
    })), jour, { dureeMinTous: dureeEvenementMinutes }), [lignes, evenementsParPersonne, plageInitiale, jour, dureeEvenementMinutes, t])

    // GET /postpone's slots with their local start, converted once per load — only when the
    // member may propose (`peut_proposer`: an invitee who hasn't accepted yet).
    const creneauxLocaux = useMemo(
        () => (report?.peut_proposer ? report.creneaux : []).map((c) => ({ c, debut: convertUTCToLocal(c.debut, membre.timezone) })),
        [report, membre.timezone]
    )

    // The tapped availability (gone once the schedules reload without it).
    const blocChoisi = choix ? blocsParPersonne.get(choix.personne)?.find((b) => b.debut.toMillis() === choix.debut) ?? null : null
    const blocDuMembre = !!blocChoisi && choix?.personne === horaires?.moi?.id

    /**
     * Slots of GET /postpone (every participant free, the event's duration) starting in a
     * block of the member's row: the one not proposed yet is offered, as the gold blocks
     * did. Only an invitee who hasn't accepted yet proposes (`peut_proposer`).
     *
     * @author Philip — common availabilities on their exact times
     * @param {BlocDispo} bloc
     * @returns {{ aProposer: Creneau | undefined, dejaPropose: boolean }}
     */
    const creneauxDans = (bloc: BlocDispo): { aProposer: Creneau | undefined, dejaPropose: boolean } => {
        const dedans = creneauxLocaux.filter(({ debut }) => debut >= bloc.debut && debut < bloc.fin).map(({ c }) => c)
        return { aProposer: dedans.find((c) => !c.deja_propose), dejaPropose: dedans.length > 0 && dedans.every((c) => c.deja_propose) }
    }

    /**
     * Now, rounded up to the proposal step (5 minutes), in the rows' timezone (positions
     * are wall-clock hours): the earliest start the API accepts for a proposal.
     *
     * @returns {DateTime}
     */
    const prochainPas = () => ceilBy5(DateTime.now().setZone(jour.zone))

    /**
     * An exact range of a tapped availability as a slot to propose: from now on (on the
     * 5-minute step) when it already started, null once over.
     *
     * @author Philip — proposing an exact range from an availability's details
     * @param {SegmentDispo} segment
     * @returns {Creneau | null}
     */
    const creneauDuSegment = (segment: SegmentDispo): Creneau | null => {
        const maintenant = prochainPas()
        const debut = segment.debut < maintenant ? maintenant : segment.debut
        return debut < segment.fin ? creneauDepuisPlage(debut, segment.fin) : null
    }
    /**
     * Whether an exact range can be proposed: only by an invitee who hasn't accepted yet
     * (`peut_proposer`; once accepted, the details only show who's free), not over, not already
     * an open proposal (same start and end). In any row's availability.
     *
     * @param {SegmentDispo} segment
     * @returns {EtatSegment}
     */
    const etatSegment = (segment: SegmentDispo): EtatSegment => {
        if (!report?.peut_proposer) return null
        const c = creneauDuSegment(segment)
        if (!c) return 'passe'
        return report.suggestions.some((sg) => sg.debut === c.debut && sg.fin === c.fin) ? 'dejaPropose' : 'proposable'
    }

    /**
     * What the availability's modal shows (DetailDispoCommune): its ranges, who, and
     * proposing one — or, in the member's row, the slot of GET /postpone it holds. Sent,
     * the modal closes back onto this screen as it was, to propose another one.
     *
     * @author Philip — availability details in a modal
     * @param {BlocDispo} bloc
     * @param {boolean} duMembre - A block of the member's row.
     * @returns {JSX.Element}
     */
    const contenuDispo = (bloc: BlocDispo, duMembre: boolean) => {
        const { aProposer, dejaPropose } = duMembre ? creneauxDans(bloc) : { aProposer: undefined, dejaPropose: false }
        return (
            <DetailDispoCommune
                bloc={bloc}
                etatSegment={etatSegment}
                creneauDuSegment={creneauDuSegment}
                creneauParDefaut={aProposer ?? null}
                noteParDefaut={dejaPropose ? t('invitationReview.alreadyProposed') : undefined}
                plage={plage}
                enCours={envoiCreneau === 'creneau'}
                onProposer={async (c) => {
                    // Closed once sent (ModalBase listens), back onto the review.
                    if (await envoyerCreneau(c)) modalEvents.emitClosing()
                }}
            />
        )
    }

    /**
     * Tap on an availability: outlined, and its details in a modal (the generic
     * dataRenderer, content given through the modal context).
     *
     * @param {string} personne - Id of the row's person.
     * @param {BlocDispo} bloc
     * @returns {void}
     */
    const ouvrirDispo = (personne: string, bloc: BlocDispo) => {
        setChoix({ personne, debut: bloc.debut.toMillis() })
        // Set before opening, so the modal never shows the previous block for a frame.
        setDataRendererContent(CLE_MODAL_DISPO, contenuDispo(bloc, personne === horaires?.moi?.id))
        // Without the round close button: closed by swiping down or tapping outside.
        router.push({ pathname: '/(modals)/dataRenderer', params: { key: CLE_MODAL_DISPO, title: t('invitationReview.availabilityTitle'), sansBoutonFermer: '1' } } as any)
    }

    // Kept up to date while the modal is open (a proposal sent, the slots reloaded).
    useEffect(() => {
        if (blocChoisi) setDataRendererContent(CLE_MODAL_DISPO, contenuDispo(blocChoisi, blocDuMembre))
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [blocChoisi, blocDuMembre, report, envoiCreneau])

    // Back on this screen (the modal closed): the block isn't outlined anymore.
    useFocusEffect(useCallback(() => { setChoix(null) }, [setChoix]))
    // Leaving the screen: nothing of it left in the modal context.
    useEffect(() => () => removeDataRenderContent(CLE_MODAL_DISPO), [removeDataRenderContent])

    // A precise range picked by hold & drag inside a common availability of the member's
    // row (5-minute step), sent with "Propose" under the timeline; null: none.
    const [plageDispo, setPlageDispo] = useState<PlageChoisie | null>(null)
    // Where it may be picked: the member's availabilities, only while they may propose
    // (`peut_proposer`: not the creator, not once accepted). Their elapsed part can't (the API refuses a start already
    // past): holding it warns, like the home screen's past blocks.
    const zonesProposables = useMemo<ZoneSelection[]>(() => {
        const moi = horaires?.moi?.id
        if (!moi || !report?.peut_proposer) return []
        const maintenant = prochainPas()
        return (blocsParPersonne.get(moi) ?? []).flatMap((bloc): ZoneSelection[] => {
            if (bloc.fin <= maintenant) return [{ debut: bloc.debut, fin: bloc.fin, refusee: true }]
            if (bloc.debut >= maintenant) return [{ debut: bloc.debut, fin: bloc.fin }]
            return [{ debut: bloc.debut, fin: maintenant, refusee: true }, { debut: maintenant, fin: bloc.fin }]
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [blocsParPersonne, horaires?.moi?.id, report?.peut_proposer])

    const avertirPasse = () => {
        Haptics.avertissement()
        ToastAbs.show({ type: toastTypes.warning, text1: tHome('plageLibre.passeTitre'), text2: tHome('plageLibre.passe') })
    }

    /**
     * Sends the picked range as a postponement proposal, like a common free slot
     * (useReportEvenement's envoyerCreneau): the others vote. Cleared once sent.
     *
     * @author Philip — a precise range inside a common availability
     * @returns {Promise<void>}
     */
    const creneauPlage = plageDispo ? creneauDepuisPlage(plageDispo.debut, plageDispo.fin) : null
    const proposerPlage = async () => {
        if (!creneauPlage) return
        if (await envoyerCreneau(creneauPlage)) setPlageDispo(null)
    }

    // A tap elsewhere ("click off") clears the picked range. Shorter than the hold that
    // starts one (200 ms), so that hold never counts as a tap (like the home screen).
    // One gesture per detector (rows, header).
    const effacerPlage = () => setPlageDispo(null)
    const toucherPourEffacer = () => Gesture.Tap()
        .maxDuration(180)
        .onEnd((_e, reussi) => {
            if (reussi) scheduleOnRN(effacerPlage)
        })

    // (Re)loaded on focus: e.g. back from the decision page after answering.
    useFocusEffect(useCallback(() => {
        if (!invitation) return
        let actif = true
        setErreur(false)
        api.get(`/evenements/invitations/${invitation.id}/horaires`, { params: paramsJour(jour) })
            .then((reponse) => { if (actif) setHoraires(reponse.data) })
            .catch((error) => {
                if (actif) setErreur(true)
                catcher(error, t('invitationReview.loadFailed'))
            })
        return () => { actif = false }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [invitation?.id, essai]))

    // Start on the event's hour (the rows don't jump to the current hour here) — once per
    // invitation: coming back from a modal or a page pushed over this one (the screen
    // focuses again) keeps where the member was, to propose another range from there.
    // Rectification (Philip).
    const defileVers = useRef<string | null>(null)
    useFocusEffect(useCallback(() => {
        if (!invitation || defileVers.current === invitation.id) return
        defileVers.current = invitation.id
        // `.set()` rather than `.value =`: Reanimated's form for the React Compiler lint.
        if (debutEvenement) offset.set(withTiming(clampOffset(debutEvenement.hour * (pxHeures + L_HEURES)), { duration: 300 }))
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [invitation?.id]))

    // Horizontal drag scrolls every row (and the hours header) together.
    const base = useSharedValue(0)
    const glisser = Gesture.Pan()
        .activeOffsetX([-10, 10])
        .onBegin(() => { base.set(offset.get()) })
        .onChange((e) => { offset.set(clampOffset(base.get() - e.translationX)) })
        .onEnd((e) => { offset.set(withDecay({ velocity: -e.velocityX, clamp: [0, maxOffset] })) })

    const s = StyleSheet.create({
        ecran: { flex: 1, backgroundColor: colors.background },
        entete: { paddingHorizontal: 16, paddingVertical: 10, gap: 6, backgroundColor: colors.card },
        titre: { color: colors.text, fontFamily: fonts.title, fontSize: 18 },
        aide: { color: colors.muted, fontFamily: fonts.body, fontSize: 13 },
        legende: { flexDirection: 'row', gap: 14, flexWrap: 'wrap' },
        itemLegende: { flexDirection: 'row', alignItems: 'center', gap: 6 },
        pastille: { width: 10, height: 10, borderRadius: 5 },
        pastilleDispo: { width: 14, height: 10, borderRadius: 3, borderWidth: 1.5, overflow: 'hidden' },
        fondPastille: { opacity: 0.28 },
        texteLegende: { color: colors.text, fontFamily: fonts.body, fontSize: 12 },
        timeline: { flexDirection: 'row', height: 32, backgroundColor: colors.card },
        colonneVide: { width: LARGEUR_COLONNE },
        rangee: { flexDirection: 'row', height: HAUTEUR_RANGEE, marginBottom: 4 },
        rangeeMoi: { borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
        colonne: {
            width: LARGEUR_COLONNE,
            paddingVertical: RETRAIT_RANGEE,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
        },
        // Star on the leader's photo.
        etoile: { position: 'absolute', top: RETRAIT_RANGEE, right: 8 },
        pseudo: { color: colors.muted, fontFamily: fonts.body, fontSize: 11, maxWidth: LARGEUR_COLONNE - 8 },
        chargement: { flex: 1, alignItems: 'center', justifyContent: 'center' },
        barreProposer: {
            paddingHorizontal: 16,
            paddingVertical: 8,
            backgroundColor: colors.card,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderColor: colors.border,
        },
        boutonProposer: {
            height: 46,
            borderRadius: 10,
            backgroundColor: colors.secondary,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            paddingHorizontal: 12,
        },
        texteProposer: { flexShrink: 1, color: colors.card, fontFamily: fonts.title, fontSize: 14 },
    })

    /**
     * One person's row: photo (+ star for the leader), pseudo, and their schedule —
     * with, behind the events, the common availabilities they are part of.
     *
     * @author Philip — user story 8 (answering an invitation)
     * @author Philip — common availabilities on their exact times (instead of the free
     *   slots shared with the member, and of the gold blocks in the member's row)
     * @param {PersonneHoraire} personne
     * @param {Role} role
     * @returns {JSX.Element}
     */
    const rangee = (personne: PersonneHoraire, role: Role) => {
        const evenements = evenementsParPersonne.get(personne.id) ?? []
        // Behind the events (EventsList `arrierePlan`); they never overlap them: an
        // availability is where the person is free, and never over the invited event.
        const dispos = (blocsParPersonne.get(personne.id) ?? []).map((bloc) => (
            <BlocDispoCommune
                key={`dispo-${bloc.debut.toMillis()}`}
                bloc={bloc}
                jour={jour}
                listOffset={offset}
                choisi={choix?.personne === personne.id && choix.debut === bloc.debut.toMillis()}
                proposable={role === 'moi' && !!creneauxDans(bloc).aProposer}
                // Its details, the people and proposing a range: in a modal.
                onPress={() => ouvrirDispo(personne.id, bloc)}
            />
        ))
        return (
        <View key={`${role}-${personne.id}`} style={[s.rangee, role === 'moi' && s.rangeeMoi]}>
            <View style={s.colonne}>
                <ProfilPic pfp={personne.fp_url} size={52} />
                {role === 'leader' && (
                    <Ionicons name="star" size={18} color={colors.warning} style={s.etoile} accessibilityLabel={t('invitationReview.leader')} />
                )}
                <Text style={s.pseudo} numberOfLines={1}>{role === 'moi' ? t('invitationReview.me') : personne.pseudo}</Text>
            </View>
            <EventsList
                owner={personne}
                events={evenements}
                eventsColor={role === 'moi' ? colors.primary : undefined}
                textColor={colors.text}
                offsetSnap={L_HEURES + pxHeures}
                listSize={HAUTEUR_RANGEE}
                displayedDate={jour}
                horizontal
                commonFreeSlots={undefined}
                arrierePlan={role === 'moi' ? (
                    // The member's row: hold & drag inside an availability picks a precise
                    // range to propose (5-minute step, kept inside it).
                    <SelectionGlissee
                        zones={zonesProposables}
                        debutFenetre={jour}
                        pasMinutes={PAS_PROPOSITION_MINUTES}
                        selection={plageDispo}
                        onSelection={setPlageDispo}
                        onDebutRefuse={avertirPasse}
                        clampOffset={clampOffset}
                        // Cleared by this screen's own "tap elsewhere" (rows and header).
                        effacerAuToucher={false}
                    >
                        {dispos}
                    </SelectionGlissee>
                ) : dispos}
                getEvenements={() => {}}
                // The invited event (leader's or member's row): the decision page; the
                // member's own events: their details.
                onPressEvenement={ouvrirEvenement}
            />
        </View>
        )
    }

    return (
        <View style={s.ecran}>
            <GestureDetector gesture={toucherPourEffacer()}>
            <View>
            <View style={s.entete}>
                <Text style={s.titre} numberOfLines={1}>
                    {invitation?.titre_evenement} · {jour.toFormat('cccc d MMMM')}
                </Text>
                {/* No help texts (tap / hold): as much room as possible for the schedules. */}
                <View style={s.legende}>
                    {(['acceptee', 'en_attente', 'refusee'] as const).map((statut) => (
                        <View key={statut} style={s.itemLegende}>
                            <View style={[s.pastille, { backgroundColor: couleurStatutInvitation(statut, colors) }]} />
                            <Text style={s.texteLegende}>{t(`participantStatus.${statut}`)}</Text>
                        </View>
                    ))}
                </View>
                {/* The two colors of the common availabilities (outlined, like their blocks). */}
                <View style={s.legende}>
                    {([['availabilityPartial', colors.dispoPartielle], ['availabilityAll', colors.dispoTous]] as const).map(([cle, couleur]) => (
                        <View key={cle} style={s.itemLegende}>
                            <View style={[s.pastilleDispo, { borderColor: couleur }]}>
                                <View style={[StyleSheet.absoluteFill, s.fondPastille, { backgroundColor: couleur }]} />
                            </View>
                            <Text style={s.texteLegende}>{t(`invitationReview.${cle}`)}</Text>
                        </View>
                    ))}
                </View>
            </View>

            <View style={s.timeline}>
                <View style={s.colonneVide} />
                {/* The invited event's day (midnight's label is that day, not the home
                    screen's window); the focus effect above scrolls to the event's hour. */}
                <Timeline horizontal={true} windowStart={jour} defilerAuDemarrage={false} />
            </View>
            </View>
            </GestureDetector>

            {!horaires ? (
                <View style={s.chargement}>
                    {erreur ? (
                        <TouchableOpacity onPress={() => setEssai((n) => n + 1)} accessibilityRole="button">
                            <Text style={s.aide}>{t('invitationReview.retry')}</Text>
                        </TouchableOpacity>
                    ) : (
                        <Spinner size={32} color={colors.muted} accessibilityLabel={t('common:loading')} />
                    )}
                </View>
            ) : (
                <GestureDetector gesture={Gesture.Simultaneous(glisser, toucherPourEffacer())}>
                    <View style={{ flex: 1 }}>
                        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                            {horaires.leader && rangee(horaires.leader, 'leader')}
                            {horaires.invites.map((personne) => rangee(personne, 'invite'))}
                        </ScrollView>
                        {horaires.moi && rangee(horaires.moi, 'moi')}
                    </View>
                </GestureDetector>
            )}
            {/* The range picked in an availability (released): "Propose", under the
                timeline — outside the rows' detector, so pressing it isn't a "tap elsewhere". */}
            {plageDispo && (
                <View style={s.barreProposer}>
                    <TouchableOpacity
                        style={s.boutonProposer}
                        onPress={proposerPlage}
                        disabled={envoiCreneau === 'creneau'}
                        accessibilityRole="button"
                    >
                        {envoiCreneau === 'creneau'
                            ? <Spinner size={18} color={colors.card} />
                            : <Ionicons name="paper-plane-outline" size={18} color={colors.card} />}
                        <Text style={s.texteProposer} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                            {creneauPlage && t('invitationReview.proposeRange', { plage: plage(creneauPlage.debut, creneauPlage.fin) })}
                        </Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    )
}
