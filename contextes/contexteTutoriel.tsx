import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const TUTORIAL_COMPLETED_KEY = "tutorial_completed";

export type CibleTutoriel = {
  testID: string;
  targetRef?: React.RefObject<any> | null;
};

export type TutorielContextType = {
  /** Le tutoriel a-t-il déjà été complété ? */
  isCompleted: boolean;
  /** Chargement initial en cours (lecture AsyncStorage) */
  isLoading: boolean;
  /** Met à jour l'état du tutoriel après sa complétion. */
  marquerTermine: () => void;
  /** Réinitialise l'état persisté et affiche de nouveau le tutoriel. */
  rejouerTutoriel: () => Promise<void>;
  /** Enregistre une cible de spotlight (no-op depuis la suppression du moteur d'étapes) */
  enregistrerCible: (
    testID: string,
    targetRef: React.RefObject<any> | null,
  ) => () => void;
};

const TutorielContexte = createContext<TutorielContextType | undefined>(
  undefined,
);

export const TutorielProvider = ({ children }: { children: ReactNode }) => {
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let actif = true;
    AsyncStorage.getItem(TUTORIAL_COMPLETED_KEY).then((value) => {
      if (!actif) return;
      setIsCompleted(value === "true");
      setIsLoading(false);
    });
    return () => {
      actif = false;
    };
  }, []);

  const enregistrerCible = useCallback(
    (_testID: string, _targetRef: React.RefObject<any> | null) => {
      // No-op : le moteur d'étapes (spotlight) a été supprimé.
      // Cette fonction est conservée pour ne pas casser les appelants existants.
      return () => {};
    },
    [],
  );

  const marquerTermine = useCallback(() => {
    setIsCompleted(true);
  }, []);

  const rejouerTutoriel = useCallback(async () => {
    await AsyncStorage.setItem(TUTORIAL_COMPLETED_KEY, "false");
    setIsCompleted(false);
  }, []);

  const value: TutorielContextType = {
    isCompleted,
    isLoading,
    marquerTermine,
    rejouerTutoriel,
    enregistrerCible,
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
