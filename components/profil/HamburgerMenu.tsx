import React, { memo, useCallback, useMemo } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import Animated, {
  createAnimatedComponent,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Icon from '@react-native-vector-icons/ionicons';

import { useTranslation } from 'react-i18next';
import { usePalette } from '@/contextes/contextePalette';
import { withSpringConfig, withTimingConfig } from '@/constants/ReanimatedConfs';
import Haptics from '@/abstractions/haptics';

type Option = {
  icon: React.ComponentProps<typeof Icon>['name'];
  label: string;
  onPress: () => void;
  color?: string;
  accessibleLabel?: string;
  visible?: boolean;
};

type Props = {
  isOpen: boolean;
  onToggle: () => void;
  colors: ReturnType<typeof usePalette>['colors'];
  options: Option[];
  adminVisible?: boolean;
  onAdminPress?: () => void;
};

const FLOATING_BTN_HEIGHT = 64;
const MENU_OPTIONS_GAP = 8;

const AnimatedTouchableOpacity = createAnimatedComponent(TouchableOpacity);

/**
 * Menu hamburger flottant avec options animées.
 * Transition : rotation + opacité entre l'icône hamburger et la croix.
 */
export const HamburgerMenu = memo(function HamburgerMenu({
  isOpen,
  onToggle,
  colors,
  options,
  adminVisible = false,
  onAdminPress,
}: Props) {
  const { t } = useTranslation('profile');

  // Valeurs animées partagées
  const hamburgerOpenShared = useSharedValue<number>(0);
  const hamburgerBg = useSharedValue(colors.primary);

  const paramsOptionBottom = useSharedValue(0);
  const editOptionBottom = useSharedValue(0);
  const logOutOptionBottom = useSharedValue(0);
  const importOptionBottom = useSharedValue(0);
  const adminOptionBottom = useSharedValue(0);
  const optionOpacity = useSharedValue(0);

  const toggleHamburgerMenu = useCallback(() => {
    const isOpenNext = !isOpen;
    onToggle();

    hamburgerOpenShared.value = withTiming(isOpenNext ? 1 : 0, withTimingConfig);
    hamburgerBg.value = withTiming(
      isOpenNext ? 'transparent' : colors.primary,
      withTimingConfig
    );

    const base = FLOATING_BTN_HEIGHT + MENU_OPTIONS_GAP;
    editOptionBottom.value = withDelay(
      0,
      withSpring(isOpenNext ? base : 0, withSpringConfig)
    );
    paramsOptionBottom.value = withDelay(
      40,
      withSpring(isOpenNext ? base * 2 : 0, withSpringConfig)
    );
    logOutOptionBottom.value = withDelay(
      80,
      withSpring(isOpenNext ? base * 3 : 0, withSpringConfig)
    );
    importOptionBottom.value = withDelay(
      120,
      withSpring(isOpenNext ? base * 4 : 0, withSpringConfig)
    );
    adminOptionBottom.value = withDelay(
      160,
      withSpring(isOpenNext ? base * 4 : 0, withSpringConfig)
    );
    optionOpacity.value = withDelay(
      isOpenNext ? 0 : 160,
      withTiming(isOpenNext ? 1 : 0, withTimingConfig)
    );

    const SPRING_DURATION_ESTIMATE = 250;
    setTimeout(() => Haptics.click(), SPRING_DURATION_ESTIMATE);
    setTimeout(() => Haptics.clickLeger(), 40 + SPRING_DURATION_ESTIMATE);
    setTimeout(() => Haptics.click(), 80 + SPRING_DURATION_ESTIMATE);
    setTimeout(() => Haptics.clickLeger(), 120 + SPRING_DURATION_ESTIMATE);
  }, [isOpen, onToggle, colors]);

  // Style du bouton trigger (fond qui change)
  const boutonStyle = useAnimatedStyle(() => ({
    backgroundColor: hamburgerBg.value,
  }));

  // Animation de rotation + opacité pour l'icône trigger
  const triggerAnimated = useAnimatedStyle(() => {
    const rotate = interpolate(
      hamburgerOpenShared.value,
      [0, 1],
      ['0deg', '180deg']
    );
    const opacity = interpolate(hamburgerOpenShared.value, [0, 1], [1, 0]);
    return {
      transform: [{ rotate }],
      opacity,
    };
  });

  // Animation de la croix (apparition quand ouvert)
  const closeAnimated = useAnimatedStyle(() => {
    const rotate = interpolate(
      hamburgerOpenShared.value,
      [0, 1],
      ['-45deg', '0deg']
    );
    const opacity = interpolate(hamburgerOpenShared.value, [0, 1], [0, 1]);
    return {
      transform: [{ rotate }],
      opacity,
    };
  });

  // Animations des options flottantes
  const paramsAnim = useAnimatedStyle(() => ({
    bottom: paramsOptionBottom.value,
    opacity: optionOpacity.value,
  }));
  const editAnim = useAnimatedStyle(() => ({
    bottom: editOptionBottom.value,
    opacity: optionOpacity.value,
  }));
  const logoutAnim = useAnimatedStyle(() => ({
    bottom: logOutOptionBottom.value,
    opacity: optionOpacity.value,
  }));
  const importAnim = useAnimatedStyle(() => ({
    bottom: importOptionBottom.value,
    opacity: optionOpacity.value,
  }));
  const adminAnim = useAnimatedStyle(() => ({
    bottom: adminOptionBottom.value,
    opacity: optionOpacity.value,
  }));

  // Références stables des animations par index (pas de useMemo dans .map)
  const animsParIndex = useMemo(
    () => [paramsAnim, editAnim, logoutAnim, importAnim, adminAnim],
    [paramsAnim, editAnim, logoutAnim, importAnim, adminAnim]
  );

  const boutonOption = useCallback(
    (item: Option, animatedStyle: any) => (
      <AnimatedTouchableOpacity
        key={item.icon}
        style={[
          styles.floatingButton,
          styles.floatingOption,
          animatedStyle,
          item.color ? { borderColor: item.color } : {},
        ]}
        onPress={() => {
          onToggle();
          item.onPress();
        }}
        accessibilityRole="button"
        accessibilityLabel={item.accessibleLabel || item.label}
      >
        <Icon name={item.icon} color={item.color ?? colors.text} size={28} />
      </AnimatedTouchableOpacity>
    ),
    [onToggle, colors]
  );

  return (
    <View style={styles.conteneur}>
      {/* Bouton trigger : hamburger qui tourne et disparaît, croix qui apparaît */}
      <AnimatedTouchableOpacity
        style={[styles.floatingButton, boutonStyle]}
        onPress={toggleHamburgerMenu}
        accessibilityRole="button"
        accessibilityLabel={isOpen ? t('common:fermerMenu') : t('common:ouvrirMenu')}
      >
        <View style={styles.iconWrapper}>
          <Animated.View style={[triggerAnimated, styles.triggerIcon]}>
            <Icon name="menu" color={colors.text} size={28} />
          </Animated.View>
          <Animated.View
            style={[closeAnimated, styles.triggerIcon, styles.closeIcon]}
          >
            <Icon name="close" color={colors.text} size={28} />
          </Animated.View>
        </View>
      </AnimatedTouchableOpacity>

      {/* Options du menu */}
      {options.map((item, index) => {
        if (!item.visible && item.visible !== undefined) return null;
        const anim = animsParIndex[index] ?? paramsAnim;
        return boutonOption(item, anim);
      })}

      {adminVisible && onAdminPress && (
        boutonOption(
          {
            icon: 'shield-checkmark-outline',
            label: t('admin.dashboard'),
            onPress: onAdminPress,
            accessibleLabel: t('admin.dashboard'),
          },
          adminAnim
        )
      )}
    </View>
  );
});

HamburgerMenu.displayName = 'HamburgerMenu';

const styles = StyleSheet.create({
  conteneur: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    zIndex: 12,
  },
  floatingButton: {
    aspectRatio: 1 / 1,
    height: FLOATING_BTN_HEIGHT,
    borderRadius: 100,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  iconWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  triggerIcon: {
    position: 'absolute',
  },
  closeIcon: {
    // La croix est centrée par le wrapper
  },
  floatingOption: {
    position: 'absolute',
    zIndex: 0,
  },
});
