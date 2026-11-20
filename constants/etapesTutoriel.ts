import { homeIds, fab } from "./tutorialIds";

/**
 * Définition des 11 étapes du tutoriel interactif Sync.
 *
 * Chaque étape :
 * - id            : numéro d'étape (1..11)
 * - screen        : nom de la route Expo Router ciblée
 * - target        : testID de l'élément à éclairer par le trou lumineux
 * - title         : clé de traduction pour le titre de la bulle
 * - message       : clé de traduction pour le message de la bulle
 * - successCondition : condition qui fait avancer (action réelle requise)
 * - explications? : tableau d'explications intermédiaires affichées avant
 *                   la condition de succès. Chaque explication a une
 *                   position de bulle et un texte. Clic sur l'écran ou
 *                   flèche → explication suivante. Quand il n'y en a
 *                   plus, on attend la successCondition.
 */
export type ExplicationTutoriel = {
  /** Position du texte/bulle (text container) pour cette explication */
  textPosition?: { x: number; y: number };
  /** Position hardcodée du spotlight (trou lumineux) pour cette explication */
  position?: { x: number; y: number; width: number; height: number };
  target?: string;
  title?: string
  text: string; // clé de traduction
  isCompletion?: boolean
};

export type EtapeTutoriel = {
  id: number;
  screen: string;
  target: string;
  successCondition: string;
  /** Position du texte/bulle (text container) pour cette étape */
  textPosition?: { x: number; y: number };
  /** Position hardcodée du spotlight (trou lumineux) pour cette étape */
  position?: { x: number; y: number; width: number; height: number };
  explications?: ExplicationTutoriel[];
};

const fabTextPosition = { x: 20, y: 550 };

export const ETAPES_TUTORIEL: EtapeTutoriel[] = [
  
  //1 Accueil et création d'événement
  {
    id: 1,
    screen: '(tabs)/home',
    target: fab,
    successCondition: 'creation_evenement_ouverte',
    // Position du text container (bulle) pour l'étape 1.
    textPosition: { x: 20, y: 300 },
    explications:[
      {
        title: 'tuto.etape1.homeTitle',
        text:'tuto.etape1.home',
        target: homeIds.index,
        textPosition: { x: 20, y: 300 },
      },
      {
        target: homeIds.schedules,
        title: 'tuto.etape1.schedulesTitle',
        text: 'tuto.etape1.schedules',
        textPosition: { x: 20, y: 320 },
      },
      {
        target:fab,
        title: 'tuto.etape1.fabTitle',
        text:'tuto.etape1.fab',
        textPosition: fabTextPosition
      },
      {
        target: fab,
        title: 'tuto.etape1.creationTitle',
        text: 'tuto.etape1.creation',
        textPosition: {x: fabTextPosition.x, y: fabTextPosition.y + 40},
        isCompletion: true,      
      }
    ]
  },

  // 2 Indisponibilité (sommeil)
  {
    id: 2,
    screen: '(tabs)/home/create',
    target: 'tuto-bouton-creer-indisponibilite',
    successCondition: 'indisponibilite_creee', // indisponibilité créée (pré-remplie, récurrente)
    explications: [
      {
        position: { x: 20, y: 200, width: 300, height: 60 },
        text: 'tuto.etape2.explication1',
      },
    ],
  },

  // 3 Création d'événement
  {
    id: 3,
    screen: '(tabs)/home/create',
    target: 'tuto-bouton-creer-evenement',
    successCondition: 'evenement_cree', // événement créé avec un seul créneau commun proposé
  },

  // 4 Effet sur la timeline
  {
    id: 4,
    screen: '(tabs)',
    target: 'tuto-bloc-evenement-timeline',
    successCondition: 'tuto.etape4.suivant', // toucher « Suivant » après l'animation
  },

  // ─────────────────────────────────────────────────────────────
  // Étape 5 — Inviter un ami
  // ─────────────────────────────────────────────────────────────
  {
    id: 5,
    screen: '(modals)/ajouterAmi',
    target: 'tuto-choix-ami-lea',
    successCondition: 'invitation_envoyee', // ami choisi et invité (acceptation auto)
  },

  // ─────────────────────────────────────────────────────────────
  // Étape 6 — Groupe de discussion
  // ─────────────────────────────────────────────────────────────
  {
    id: 6,
    screen: '(tabs)',
    target: 'tuto-onglet-messages',
    successCondition: 'groupe_ouvert', // page des messages + groupe de l'événement ouverte
  },

  // ─────────────────────────────────────────────────────────────
  // Étape 7 — Profil
  // ─────────────────────────────────────────────────────────────
  {
    id: 7,
    screen: '(tabs)',
    target: 'tuto-onglet-profil',
    successCondition: 'profil_ouvert', // page profil ouverte
  },

  // ─────────────────────────────────────────────────────────────
  // Étape 8 — Ajouter un ami (QR)
  // ─────────────────────────────────────────────────────────────
  {
    id: 8,
    screen: 'scanQR',
    target: 'tuto-bouton-qr',
    successCondition: 'modal_qr_ouvert', // modal du code QR ouvert
  },

  // ─────────────────────────────────────────────────────────────
  // Étape 9 — Réglages et import de calendrier
  // ─────────────────────────────────────────────────────────────
  {
    id: 9,
    screen: '(tabs)',
    target: 'tuto-onglet-reglages',
    successCondition: 'ecran_import_ouvert', // réglages puis écran d'import ouverts
  },

  // ─────────────────────────────────────────────────────────────
  // Étape 10 — Thème
  // ─────────────────────────────────────────────────────────────
  {
    id: 10,
    screen: '(tabs)',
    target: 'tuto-option-theme',
    successCondition: 'option_theme_ouverte', // option du thème ouverte
  },

  // ─────────────────────────────────────────────────────────────
  // Étape 11 — Conclusion
  // ─────────────────────────────────────────────────────────────
  {
    id: 11,
    screen: '(tabs)',
    target: 'tuto-bouton-terminer',
    successCondition: 'tuto_termine', // terminer → base fictive supprimée, flag = true
  },
];

export const getEtape = (id: number): EtapeTutoriel | undefined =>
  ETAPES_TUTORIEL.find((e) => e.id === id);

export const getEtapeCourante = (step: number): EtapeTutoriel | undefined =>
  getEtape(step);

export const getExplication = (
  etape: EtapeTutoriel,
  index: number
): ExplicationTutoriel | undefined =>
  etape.explications?.[index];

export const nbExplications = (etape: EtapeTutoriel): number =>
  etape.explications?.length ?? 0;
