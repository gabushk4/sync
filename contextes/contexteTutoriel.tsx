import seed from "@/assets/tutorial_seed";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { openDatabaseSync, SQLiteDatabase } from "expo-sqlite";
import {
  createContext,
  ReactNode,
  RefObject,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { View } from "react-native";
import {
  ETAPES_TUTORIEL,
  EtapeTutoriel,
  ExplicationTutoriel,
  getEtape,
  getExplication,
  nbExplications,
} from "@/constants/etapesTutoriel";

const TUTORIAL_COMPLETED_KEY = "tutorial_completed";
const TUTORIAL_STEP_KEY = "tutorial_step";
const TUTO_DB_NAME = "tutorial.db";

export type CibleTutoriel = {
  testID: string;
  targetRef?: RefObject<View | null>;
  position?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
};

export type TutorielContextType = {
  /** Étape courante (0 = pas commencé, 1..11 = étapes du parcours) */
  step: number;
  /** Configuration de l'étape courante */
  etapeCourante: EtapeTutoriel | undefined;
  /** Explication affichée et cible associée à l'étape courante */
  explicationCourante: ExplicationTutoriel | undefined;
  cibleCourante: CibleTutoriel | null;
  /** Le tutoriel a-t-il déjà été complété ? */
  isCompleted: boolean;
  /** Chargement initial en cours (lecture AsyncStorage + ouverture DB) */
  isLoading: boolean;
  /** L'app est-elle actuellement en mode tutoriel ? */
  isTutorialMode: boolean;
  /** Base de données fictive ouverte (null si pas en mode tuto) */
  db: SQLiteDatabase | null;
  /** Données fictives du seed (disponibles immédiatement) */
  seed: typeof seed;
  /** Index de l'explication intermédiaire affichée (0 = première) */
  explicationIndex: number;

  /** Démarre le tutoriel (ouvre la base fictive, met step = 1) */
  startTutorial: () => Promise<void>;
  /** Passe à l'étape suivante */
  nextStep: () => void;
  /** Définit une étape précise */
  setStep: (n: number) => void;
  /** Passe à l'explication intermédiaire suivante, puis au message de l'étape */
  nextExplication: () => void;
  /** Enregistre une vue par testID et retourne sa fonction de désinscription */
  enregistrerCible: (
    testID: string,
    targetRef: RefObject<View | null>,
  ) => () => void;
  /** Valide une condition de succès : si elle correspond à l'étape courante, avance */
  validerAction: (condition: string) => void;
  /** Termine le tutoriel : ferme/supprime la base fictive, écrit completed=true */
  completeTutorial: () => Promise<void>;
  /** Passe le tutoriel : écrit completed=true sans ouvrir la base fictive */
  skipTutorial: () => Promise<void>;
  /** Recharge l'étape courante depuis le stockage (pour reprise après fermeture) */
  reloadStep: () => Promise<void>;
};

const TutorielContexte = createContext<TutorielContextType | undefined>(
  undefined,
);

export const TutorielProvider = ({ children }: { children: ReactNode }) => {
  const [step, setStepState] = useState<number>(0);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isTutorialMode, setIsTutorialMode] = useState<boolean>(false);
  const [db, setDb] = useState<SQLiteDatabase | null>(null);
  const [explicationIndex, setExplicationIndex] = useState<number>(0);
  const [ciblesEnregistrees, setCiblesEnregistrees] = useState<
    Record<string, RefObject<View | null>>
  >({});

  const seedRef = seed;
  const etapeCourante = getEtape(step);
  const explicationCourante = etapeCourante
    ? getExplication(etapeCourante, explicationIndex)
    : undefined;
  const cibleCourante = useMemo<CibleTutoriel | null>(() => {
    if (!etapeCourante) return null;

    const testID = explicationCourante?.target ?? etapeCourante.target;
    return {
      testID,
      targetRef: ciblesEnregistrees[testID],
      position: explicationCourante?.position,
    };
  }, [ciblesEnregistrees, etapeCourante, explicationCourante]);

  const enregistrerCible = useCallback(
    (testID: string, targetRef: RefObject<View | null>) => {
      setCiblesEnregistrees((cibles) =>
        cibles[testID] === targetRef
          ? cibles
          : { ...cibles, [testID]: targetRef },
      );

      return () => {
        setCiblesEnregistrees((cibles) => {
          if (cibles[testID] !== targetRef) return cibles;
          const nouvellesCibles = { ...cibles };
          delete nouvellesCibles[testID];
          return nouvellesCibles;
        });
      };
    },
    [],
  );

  // ── Chargement initial : flag terminé + étape courante ──────────────────
  useEffect(() => {
    let actif = true;

    const charger = async () => {
      try {
        const [completedRaw, stepRaw] = await Promise.all([
          AsyncStorage.getItem(TUTORIAL_COMPLETED_KEY),
          AsyncStorage.getItem(TUTORIAL_STEP_KEY),
        ]);

        if (!actif) return;

        setIsCompleted(completedRaw === "true");
        setStepState(stepRaw ? parseInt(stepRaw, 10) : 0);
      } catch (error) {
        console.warn("Erreur lecture état tutoriel", error);
      } finally {
        if (actif) setIsLoading(false);
      }
    };

    charger();

    return () => {
      actif = false;
    };
  }, []);

  // ── Sauvegarde de l'étape à chaque changement ───────────────────────────
  useEffect(() => {
    if (step > 0) {
      AsyncStorage.setItem(TUTORIAL_STEP_KEY, String(step)).catch(() => {});
    }
  }, [step]);

  // ── Ouverture / fermeture de la base fictive ────────────────────────────
  // ── Ouverture / fermeture de la base fictive ────────────────────────────
  const ouvrirBaseFictive = useCallback(async (): Promise<SQLiteDatabase> => {
    const database = openDatabaseSync(TUTO_DB_NAME);

    // Création des tables à partir du seed (une table par entité)
    await database.execAsync(`
      PRAGMA journal_mode = WAL;

      CREATE TABLE IF NOT EXISTS membres (
        id INTEGER PRIMARY KEY,
        id_publique TEXT,
        pseudo TEXT,
        courriel TEXT,
        prenom TEXT,
        nom TEXT,
        bio TEXT,
        fuseau_horaire TEXT,
        role TEXT,
        statut_disponibilite TEXT,
        etat_ame TEXT
      );

      CREATE TABLE IF NOT EXISTS amities (
        id_membre_a INTEGER,
        id_membre_b INTEGER,
        temps_creation_jour INTEGER,
        temps_creation_heure TEXT
      );

      CREATE TABLE IF NOT EXISTS parametres (
        id_membre INTEGER PRIMARY KEY,
        notifications_push INTEGER,
        notifications_email INTEGER,
        visibilite_horaire TEXT,
        theme TEXT,
        langue TEXT
      );

      CREATE TABLE IF NOT EXISTS evenements (
        id INTEGER PRIMARY KEY,
        id_publique TEXT,
        slug TEXT,
        titre TEXT,
        description TEXT,
        debut_jour INTEGER,
        debut_heure TEXT,
        fin_jour INTEGER,
        fin_heure TEXT,
        prive INTEGER,
        regle_recurrence TEXT,
        createur_id INTEGER,
        nature TEXT,
        source TEXT,
        jour_ferie INTEGER,
        depuis_dispo_commune INTEGER
      );

      CREATE TABLE IF NOT EXISTS participants_evenements (
        id_evenement INTEGER,
        id_membre INTEGER,
        privilege TEXT,
        statut TEXT
      );

      CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY,
        id_publique TEXT,
        titre TEXT,
        serial_number INTEGER,
        temps_creation_jour INTEGER,
        temps_creation_heure TEXT
      );

      CREATE TABLE IF NOT EXISTS participants_conversations (
        id_conversation INTEGER,
        id_membre INTEGER,
        role TEXT
      );

      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY,
        id_publique TEXT,
        id_conversation INTEGER,
        id_auteur INTEGER,
        type TEXT,
        temps_envoi_jour INTEGER,
        temps_envoi_heure TEXT
      );

      CREATE TABLE IF NOT EXISTS messages_texte (
        id_message INTEGER PRIMARY KEY,
        contenu TEXT
      );

      CREATE TABLE IF NOT EXISTS scenario (
        cle TEXT PRIMARY KEY,
        valeur TEXT
      );
    `);

    // Insertion des données du seed dans une transaction
    await database.withTransactionAsync(async () => {
      // Membres
      for (const m of seedRef.membres) {
        await database.runAsync(
          "INSERT OR REPLACE INTO membres (id, id_publique, pseudo, courriel, prenom, nom, bio, fuseau_horaire, role, statut_disponibilite, etat_ame) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [
            m.id,
            m.id_publique,
            m.pseudo,
            m.courriel,
            m.prenom,
            m.nom,
            m.bio ?? null,
            m.fuseau_horaire,
            m.role,
            m.statut_disponibilite,
            m.etat_ame ?? null,
          ],
        );
      }

      // Amitiés
      for (const a of seedRef.amities) {
        await database.runAsync(
          "INSERT OR REPLACE INTO amities (id_membre_a, id_membre_b, temps_creation_jour, temps_creation_heure) VALUES (?, ?, ?, ?)",
          [
            a.id_membre_a,
            a.id_membre_b,
            a.temps_creation.jour,
            a.temps_creation.heure,
          ],
        );
      }

      // Paramètres
      for (const p of seedRef.parametres) {
        await database.runAsync(
          "INSERT OR REPLACE INTO parametres (id_membre, notifications_push, notifications_email, visibilite_horaire, theme, langue) VALUES (?, ?, ?, ?, ?, ?)",
          [
            p.id_membre,
            p.notifications_push,
            p.notifications_email,
            p.visibilite_horaire,
            p.theme,
            p.langue,
          ],
        );
      }

      // Événements
      for (const e of seedRef.evenements) {
        await database.runAsync(
          `INSERT OR REPLACE INTO evenements (id, id_publique, slug, titre, description, debut_jour, debut_heure, fin_jour, fin_heure, prive, regle_recurrence, createur_id, nature, source, jour_ferie, depuis_dispo_commune)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            e.id,
            e.id_publique,
            e.slug,
            e.titre,
            e.description ?? null,
            e.debut.jour,
            e.debut.heure,
            e.fin.jour,
            e.fin.heure,
            e.prive,
            e.regle_recurrence ?? null,
            e.createur_id,
            e.nature,
            e.source,
            e.jour_ferie,
            e.depuis_dispo_commune,
          ],
        );
      }

      // Participants événements
      for (const p of seedRef.participants_evenements) {
        await database.runAsync(
          "INSERT OR REPLACE INTO participants_evenements (id_evenement, id_membre, privilege, statut) VALUES (?, ?, ?, ?)",
          [p.id_evenement, p.id_membre, p.privilege, p.statut],
        );
      }

      // Conversations
      for (const c of seedRef.conversations) {
        await database.runAsync(
          "INSERT OR REPLACE INTO conversations (id, id_publique, titre, serial_number, temps_creation_jour, temps_creation_heure) VALUES (?, ?, ?, ?, ?, ?)",
          [
            c.id,
            c.id_publique,
            c.titre,
            c.serial_number,
            c.temps_creation.jour,
            c.temps_creation.heure,
          ],
        );
      }

      // Participants conversations
      for (const p of seedRef.participants_conversations) {
        await database.runAsync(
          "INSERT OR REPLACE INTO participants_conversations (id_conversation, id_membre, role) VALUES (?, ?, ?)",
          [p.id_conversation, p.id_membre, p.role],
        );
      }

      // Messages
      for (const m of seedRef.messages) {
        await database.runAsync(
          "INSERT OR REPLACE INTO messages (id, id_publique, id_conversation, id_auteur, type, temps_envoi_jour, temps_envoi_heure) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [
            m.id,
            m.id_publique,
            m.id_conversation,
            m.id_auteur,
            m.type,
            m.temps_envoi.jour,
            m.temps_envoi.heure,
          ],
        );
      }

      // Messages texte
      for (const m of seedRef.messages_texte) {
        await database.runAsync(
          "INSERT OR REPLACE INTO messages_texte (id_message, contenu) VALUES (?, ?)",
          [m.id_message, m.contenu],
        );
      }

      // Scénario (sérialisé)
      await database.runAsync(
        "INSERT OR REPLACE INTO scenario (cle, valeur) VALUES (?, ?)",
        ["scenario", JSON.stringify(seedRef.scenario)],
      );
    });

    return database;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fermerBaseFictive = useCallback(async (database: SQLiteDatabase) => {
    try {
      await database.closeAsync();
    } catch (error) {
      console.warn("Erreur fermeture base fictive", error);
    }
    try {
      // Suppression du fichier SQLite (expo-sqlite ne propose pas de deleteDatabase direct,
      // on laisse le fichier ; on peut aussi le supprimer via expo-file-system si nécessaire)
    } catch (error) {
      console.warn("Erreur suppression base fictive", error);
    }
  }, []);

  // ── Actions publiques ──────────────────────────────────────────────────
  const startTutorial = useCallback(async () => {
    try {
      setIsLoading(true);
      const database = await ouvrirBaseFictive();
      setDb(database);
      setIsTutorialMode(true);
      setIsCompleted(false);
      setExplicationIndex(0);
      setStepState(1);
      await AsyncStorage.setItem(TUTORIAL_COMPLETED_KEY, "false");
      await AsyncStorage.setItem(TUTORIAL_STEP_KEY, "1");
    } catch (error) {
      console.warn("Erreur démarrage tutoriel", error);
    } finally {
      setIsLoading(false);
    }
  }, [ouvrirBaseFictive]);

  const nextStep = useCallback(() => {
    setExplicationIndex(0);
    setStepState((s) => s + 1);
  }, []);

  const setStep = useCallback((n: number) => {
    setExplicationIndex(0);
    setStepState(n);
  }, []);

  const completeTutorial = useCallback(async () => {
    try {
      setIsLoading(true);
      if (db) {
        await fermerBaseFictive(db);
        setDb(null);
      }
      setIsTutorialMode(false);
      setIsCompleted(true);
      setExplicationIndex(0);
      setStepState(0);
      await AsyncStorage.setItem(TUTORIAL_COMPLETED_KEY, "true");
      await AsyncStorage.setItem(TUTORIAL_STEP_KEY, "0");
    } catch (error) {
      console.warn("Erreur fin tutoriel", error);
    } finally {
      setIsLoading(false);
    }
  }, [db, fermerBaseFictive]);

  const skipTutorial = useCallback(async () => {
    try {
      setIsLoading(true);
      setIsTutorialMode(false);
      setIsCompleted(true);
      setExplicationIndex(0);
      setStepState(0);
      await AsyncStorage.setItem(TUTORIAL_COMPLETED_KEY, "true");
      await AsyncStorage.setItem(TUTORIAL_STEP_KEY, "0");
    } catch (error) {
      console.warn("Erreur passage tutoriel", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reloadStep = useCallback(async () => {
    try {
      const stepRaw = await AsyncStorage.getItem(TUTORIAL_STEP_KEY);
      if (stepRaw) {
        setExplicationIndex(0);
        setStepState(parseInt(stepRaw, 10));
      }
    } catch (error) {
      console.warn("Erreur rechargement étape", error);
    }
  }, []);

  // ── Explications intermédiaires ─────────────────────────────────────────
  const nextExplication = useCallback(() => {
    const etape = getEtape(step);
    if (!etape) return;

    const nb = nbExplications(etape);
    if (explicationIndex < nb) {
      setExplicationIndex((i) => Math.min(i + 1, nb));
    }
  }, [step, explicationIndex]);

  const validerAction = useCallback(
    (condition: string) => {
      const etape = getEtape(step);
      if (!etape || condition !== etape.successCondition) return;

      setExplicationIndex(0);
      if (etape.id === ETAPES_TUTORIEL.length) {
        void completeTutorial();
        return;
      }

      setStepState((s) => s + 1);
    },
    [step, completeTutorial],
  );

  const value: TutorielContextType = {
    step,
    etapeCourante,
    explicationCourante,
    cibleCourante,
    isCompleted,
    isLoading,
    isTutorialMode,
    db,
    seed: seedRef,
    explicationIndex,
    startTutorial,
    nextStep,
    setStep,
    nextExplication,
    enregistrerCible,
    validerAction,
    completeTutorial,
    skipTutorial,
    reloadStep,
  };

  return (
    <TutorielContexte.Provider value={value}>
      {children}
    </TutorielContexte.Provider>
  );
};

export const useTutoriel = (): TutorielContextType => {
  const ctx = useContext(TutorielContexte);
  if (!ctx)
    throw new Error("useTutoriel doit être utilisé dans un TutorielProvider");
  return ctx;
};
