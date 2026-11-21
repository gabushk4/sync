import React from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { usePathname } from "expo-router";
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useTutoriel } from "@/contextes/contexteTutoriel";
import { usePalette } from "@/contextes/contextePalette";
import { useFont } from "@/contextes/contexteFont";
import {
  nbExplications,
} from "@/constants/etapesTutoriel";
import Radius from "@/constants/Radius";
import { SpotlightOverlay } from "./spotlightOverlay";
import {SecondaryBtn, MainBtn} from "@/abstractions/touchableOpacityAbs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { measureSpotlightEvents } from "@/events/mesureSpotlightEvents";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type PositionCible = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * TutorielEcran : écran de guidage interactif.
 *
 * Affiche le trou lumineux sur la cible de l'étape courante, une bulle
 * explicative (titre + message), gère les explications intermédiaires
 * (clic sur l'écran → prochaine explication), et les boutons « Suivant »
 * / « Passer » (avec confirmation).
 *
 * Utilise usePalette() et useFont() pour les couleurs et polices de l'app.
 */
export function TutorielEcran() {
  const pathname = usePathname();
  const { t } = useTranslation();
  const { colors } = usePalette();
  const { fonts } = useFont();
  const {
    step,
    etapeCourante,
    explicationCourante,
    cibleCourante,
    isCompleted,
    isTutorialMode,
    explicationIndex,
    nextExplication,
    validerAction,
    skipTutorial,
  } = useTutoriel();

  const insets = useSafeAreaInsets()

  const etape = etapeCourante;
  const [mesureCible, setMesureCible] = React.useState<{
    cle: string;
    targetRef: NonNullable<NonNullable<typeof cibleCourante>["targetRef"]>;
    position: PositionCible;
  } | null>(null);
  const cleCible = `${pathname}:${step}:${explicationIndex}:${cibleCourante?.testID ?? ""}`;
  const sequenceMesure = React.useRef(0);
  const tutorielRef = React.useRef<View>(null);

  const mesurerCible = React.useCallback(() => {
    const targetRef = cibleCourante?.targetRef;
    const target = targetRef?.current;
    const tutoriel = tutorielRef.current;
    if (!target || !tutoriel) return;

    const sequenceCourante = ++sequenceMesure.current;
    tutoriel.measureInWindow((origineX, origineY) => {
      if (sequenceCourante !== sequenceMesure.current) return;
      target.measureInWindow((x, y, width, height) => {
        if (sequenceCourante !== sequenceMesure.current) return;
        setMesureCible({
          cle: cleCible,
          targetRef,
          position: { x: x - origineX, y: y - origineY, width, height },
        });
      });
    });
  }, [cibleCourante?.targetRef, cleCible]);

  React.useLayoutEffect(() => {
    if (!isTutorialMode || isCompleted || !etape) return;

    const unsubscribe = measureSpotlightEvents.onMeasureSpotlight(mesurerCible);
    mesurerCible();

    return () => {
      sequenceMesure.current += 1;
      unsubscribe();
    };
  }, [isTutorialMode, isCompleted, etape, mesurerCible]);

  const mesureCorrespondante =
    mesureCible?.cle === cleCible &&
    mesureCible.targetRef === cibleCourante?.targetRef;
  // Position du spotlight : la mesure de la ref (measureInWindow) est en priorité,
  // sinon la position définie dans l'objet (explicationCourante.position / cibleCourante.position).
  const positionCible: PositionCible | undefined = mesureCorrespondante
    ? mesureCible.position
    : cibleCourante?.position;

  const positionTexte =
    explicationCourante?.textPosition ??
    etape?.textPosition ??
    (positionCible
      ? { x: positionCible.x, y: positionCible.y + positionCible.height / 2 }
      : { x: 20, y: 100 });
  const positionTexteX = useSharedValue(positionTexte.x);
  const positionTexteY = useSharedValue(positionTexte.y);
  const dernierContextePosition = React.useRef({ pathname, step, explicationIndex });

  React.useLayoutEffect(() => {
    const contextePrecedent = dernierContextePosition.current;
    const animerPosition =
      contextePrecedent.pathname === pathname &&
      contextePrecedent.step === step &&
      contextePrecedent.explicationIndex !== explicationIndex;
    dernierContextePosition.current = { pathname, step, explicationIndex };

    if (animerPosition) {
      positionTexteX.value = withTiming(positionTexte.x, { duration: 300 });
      positionTexteY.value = withTiming(positionTexte.y, { duration: 300 });
    } else {
      positionTexteX.value = positionTexte.x;
      positionTexteY.value = positionTexte.y;
    }
  }, [pathname, step, explicationIndex, positionTexte.x, positionTexte.y, positionTexteX, positionTexteY]);

  const positionTexteAnimee = useAnimatedStyle(() => ({
    top: positionTexteY.value,
    left: positionTexteX.value,
  }));

  // Guard
  if (!isTutorialMode || isCompleted || !etape) return null;

  const afficherSpotlight = Boolean(positionCible);

  // Texte affiché : explication courante si disponible, sinon message de l'étape
  const explication = explicationCourante;
  const isLastExplication = explication?.isCompletion
  const afficherExplication =
    !!explication && explicationIndex < nbExplications(etape);
  const afficherZoneProchaineExplication =
    afficherExplication && explicationIndex < nbExplications(etape) - 1;
  const titre = afficherExplication && explication.title && t(explication.title);
  const message = afficherExplication && t(explication.text);

  return (
    <View ref={tutorielRef} style={styles.conteneur}>
      {/* Badge « Mode démo » */}
      <View style={[styles.badge, {top: insets.top, backgroundColor: colors.card, }]}>
        <Text style={[styles.badgeText, { fontFamily: fonts.body, color: colors.warning }]}>Tuto</Text>
      </View>

      {/* Spotlight : trou lumineux sur la cible */}
      {afficherSpotlight && positionCible && (
        <SpotlightOverlay
          key={`${pathname}:${step}`}
          pathname={pathname}
          step={step}
          explicationIndex={explicationIndex}
          x={positionCible.x}
          y={positionCible.y}
          width={positionCible.width}
          height={positionCible.height}
          radius={Radius.md}
        />
      )}

      {/* Conteneur bulle + bouton Passer (positionné selon l'étape/explication) */}
      <Animated.View style={[styles.bulleContainer, positionTexteAnimee]}>
        {/* Bulle explicative */}
        <View style={[styles.bulle, {backgroundColor: colors.card, borderColor: colors.border}]}>
          <Animated.View
            key={`${step}:${explicationIndex}`}
            entering={FadeIn.duration(180)}
            exiting={FadeOut.duration(180)}
          >
            {titre && (
              <Text style={[styles.titre, { color: colors.text, fontFamily: fonts.title }]}>
                {titre}
              </Text>
            )}
            {message && (
              <Text style={[styles.message, { color: colors.text, fontFamily: fonts.body }]}>
                {message}
              </Text>
            )}
          </Animated.View>
        </View>

        {/* Boutons*/}
        <View style={styles.btnContainer}>     
          {/* Bouton Passer*/}  
          <SecondaryBtn
            style={styles.boutonPasser}
            onPress={() => {
              Alert.alert(
                t("tuto.passer.titre"),
                t("tuto.passer.message"),
                [
                  { text: t("tuto.passer.annuler"), style: "cancel" },
                  {
                    text: t("tuto.passer.confirmer"),
                    onPress: async () => {
                      await skipTutorial();
                    },
                  },
                ],
                { cancelable: false }
              );
            }}
          >
            <Text style={[styles.boutonText, { color: colors.text, fontFamily: fonts.body }]}>
              {t("tuto.bouton_passer")}
            </Text>
          </SecondaryBtn>          
            {/* Bouton suivant (seulement si c'est une explication qui n'est pas la complétion de la tache) */}
            {afficherExplication && !isLastExplication &&
              <MainBtn
                style={styles.boutonSuivant}
                onPress={() => {
                  // Si on a une successCondition, on attend que l'écran cible la valide.
                  // Sinon (pas de condition, juste « toucher Suivant »), on avance.              
                  if (etape.successCondition && isLastExplication) {
                    validerAction(etape.successCondition);
                  } else {
                    nextExplication();
                  }
                }}
              >
                <Text style={[styles.boutonText, { color: colors.text, fontFamily: fonts.body }]}>
                  {t("tuto.bouton_suivant")}
                </Text>
              </MainBtn>
            }
        </View>

      </Animated.View>

      {/* Zone tactile pour passer à l'explication suivante */}
      {afficherZoneProchaineExplication && (
        <TouchableOpacity
          style={styles.zoneTactile}
          onPress={() => {
            nextExplication();
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  conteneur: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "transparent",
  },
  badge: {
    position: "absolute",
    width: 48,
    right: 16,
    zIndex: 100,
    borderRadius: Radius.md,
    justifyContent: "center",
    alignItems: "center"
  },
  badgeText: {
    fontSize: 14,
    fontWeight: "bold",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.sm,
  },
  bulle: {
    position: "relative",
    zIndex: 50,
    margin: 0,
    width: "100%",
    maxWidth: SCREEN_WIDTH - 40,
    borderRadius: Radius.lg,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    borderWidth:1
  },
  bulleContainer: {
    position: "absolute",
    zIndex: 50,
    width: SCREEN_WIDTH - 40,
  },
  titre: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
  },
  zoneTactile: {
    ...StyleSheet.absoluteFill,
    zIndex: 30,
    backgroundColor: "transparent",
  },
  boutons: {
    position: "absolute",
    bottom: 40,
    left: 0,
    right: 0,
    zIndex: 60,
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 20,
  },
  boutonPasser: {
    width:"48%",
    paddingVertical: 10,
    borderRadius: Radius.md,
    alignItems: "center",
  },
  boutonSuivant: {
    width: "48%",
    paddingVertical: 12,
    borderRadius: Radius.md,
    alignItems: "center",
  },
  boutonText: {
    fontSize: 15,
    fontWeight: "600",
  },
  btnContainer:{
    flexDirection:"row",
    width:'100%',
    justifyContent:'center',
    alignItems:"center",
    gap:12,
    padding:8
  }
});
