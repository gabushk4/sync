import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, Mask, Rect } from 'react-native-svg';
import { useLayoutEffect, useRef } from 'react';

const ARect = Animated.createAnimatedComponent(Rect);

type Props = {
  pathname: string;
  step: number;
  explicationIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  radius?: number;
  /** Couleur du fond obscurcissant (défaut : noir semi-transparent) */
  overlayColor?: string;
};

/**
 * SpotlightOverlay : trou lumineux cliquable.
 *
 * Principe : on ne fait PAS un trou dans une vue parente (qui capterait
 * toutes les touches). On place 4 rectangles transparents autour de la zone
 * du trou. À l'intérieur du trou, il n'y a rien : la touche traverse et
 * atteint l'UI située en dessous.
 *
 * Le visuel arrondi est dessiné par une couche SVG avec masque, en
 * pointerEvents="none" (décoratif uniquement).
 *
 * Les boutons « Passer » et la bulle explicative doivent être placés
 * AU-DESSUS de ce composant (zIndex plus élevé) pour rester cliquables.
 */
export function SpotlightOverlay({
  pathname,
  step,
  explicationIndex,
  x,
  y,
  width,
  height,
  radius = 12,
  overlayColor = 'rgba(0,0,0,0.8)',
}: Props) {
  const { width: W, height: H } = useWindowDimensions();

  const X = useSharedValue(x);
  const Y = useSharedValue(y);
  const w = useSharedValue(width);
  const h = useSharedValue(height);
  const dernierContextePosition = useRef({ pathname, step, explicationIndex });

  // X, Y, w, h sont des useSharedValue (refs stables) : leur référence ne
  // change jamais, donc pas de boucle infinie. On les liste pour satisfaire
  // eslint, tout en réagissant aux primitives x/y/width/height.
  useLayoutEffect(() => {
    const contextePrecedent = dernierContextePosition.current;
    const animerPosition =
      contextePrecedent.pathname === pathname &&
      contextePrecedent.step === step &&
      contextePrecedent.explicationIndex !== explicationIndex;
    dernierContextePosition.current = { pathname, step, explicationIndex };

    if (!animerPosition) {
      X.value = x;
      Y.value = y;
      w.value = width;
      h.value = height;
      return;
    }

    const cfg = { duration: 300 };
    X.value = withTiming(x, cfg);
    Y.value = withTiming(y, cfg);
    w.value = withTiming(width, cfg);
    h.value = withTiming(height, cfg);
  }, [pathname, step, explicationIndex, x, y, width, height, X, Y, w, h]);

  // ───── Bloqueurs de touches (transparent, captent le toucher) ─────
  const topBlocker = useAnimatedStyle(() => ({
    top: 0,
    left: 0,
    right: 0,
    height: Y.value, // bas du bloc = haut du trou
  }));

  const bottomBlocker = useAnimatedStyle(() => ({
    top: Y.value + h.value, // haut du bloc = bas du trou
    left: 0,
    right: 0,
    bottom: 0,
  }));

  const leftBlocker = useAnimatedStyle(() => ({
    top: Y.value, // même top que le trou
    left: 0,
    width: X.value, // droite du bloc = gauche du trou
    height: h.value, // même hauteur que le trou
  }));

  const rightBlocker = useAnimatedStyle(() => ({
    top: Y.value, // même top que le trou
    left: X.value + w.value, // gauche du bloc = droite du trou
    right: 0,
    height: h.value, // même hauteur que le trou
  }));

  // ───── Propriétés animées du trou (pour le masque SVG) ─────
  const holeProps = useAnimatedProps(() => ({
    x: X.value,
    y: Y.value,
    width: w.value,
    height: h.value,
  }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Visuel décoratif uniquement : masque SVG arrondi */}
      <Svg width={W} height={H} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <Mask id="spotlight-mask">
            <Rect width={W} height={H} fill="white" />
            <ARect
              animatedProps={holeProps}
              rx={radius}
              ry={radius}
              fill="black"
            />
          </Mask>
        </Defs>
        <Rect
          width={W}
          height={H}
          fill={overlayColor}
          mask="url(#spotlight-mask)"
        />
      </Svg>

      {/* Bloqueurs de touches (transparents) autour du trou */}
      <Animated.View style={[styles.blocker, topBlocker]} />
      <Animated.View style={[styles.blocker, bottomBlocker]} />
      <Animated.View style={[styles.blocker, leftBlocker]} />
      <Animated.View style={[styles.blocker, rightBlocker]} />
    </View>
  );
}

const styles = StyleSheet.create({
  blocker: {
    position: 'absolute',
    backgroundColor: 'transparent',
  },
});
