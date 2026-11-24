import { usePalette } from "@/contextes/contextePalette";
import Icon from "@react-native-vector-icons/ionicons";
import { BottomTabBar, type BottomTabBarProps } from 'expo-router/js-tabs';
import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useFabActions, useFabState } from "@/contextes/contexteFAB";
import ToastAbs from "@/abstractions/toastAbs";
import { toastTypes } from "@/constants/toastConfig";

const s = StyleSheet.create({
  container: { position: 'relative' },
  fab: {
    position: 'absolute',
    top: -12,
    alignSelf: 'center',
    zIndex: 10,
    width: 64,
    aspectRatio: 1,
    borderRadius: 100,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 6,
  },
});

// The tab's button shows right away when changing tabs: no fade-out of the previous
// tab's icon then fade-in of the new one (it took ~0.5 s before the right icon was there).
const Fab = React.memo(function Fab() {
    const config = useFabState();
    const { actionRef } = useFabActions();
    const { colors } = usePalette();
    const router = useRouter();

    if (!config || config.visible === false) return null;

    const onPress = () => {
        // Blocked FAB (e.g. a past day): explain why instead of navigating.
        if (config.bloque) {
            ToastAbs.show({ type: toastTypes.error, text2: config.bloque });
            return;
        }
        if (config.href) {
            router.push(
                config.params
                    ? ({ pathname: config.href as unknown as string, params: config.params } as any)
                    : (config.href as any)
            );
        } else {
            actionRef.current?.();
        }
    };

    return (
        <TouchableOpacity
            onPress={onPress}
            style={[s.fab, { borderColor: colors.border, backgroundColor: colors.secondary }]}
        >
            {config.icon ?? <Icon name="add" color={colors.text} size={24} />}
        </TouchableOpacity>
    );
});

export function CustomTabBar(props: BottomTabBarProps) {
  return (
    <View style={s.container}>
      <Fab />
      <BottomTabBar {...props} />
    </View>
  );
}