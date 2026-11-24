import Icon from "@react-native-vector-icons/ionicons";
import * as Brightness from 'expo-brightness';
import { router } from 'expo-router';
import { useFocusEffect } from "expo-router/react-navigation";
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
    createAnimatedComponent,
    interpolate,
    interpolateColor,
    SharedValue,
    useAnimatedProps,
    useAnimatedStyle,
    useDerivedValue,
    useSharedValue,
    withDelay,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { interpolatePath, parse } from 'react-native-redash';
import Svg, { Path } from 'react-native-svg';

import { path1 as closeMenuPath1, path2 as closeMenuPath2, path3 as closeMenuPath3 } from '@/svgs/closeMenu';
import { path1 as hamburgerMenuPath1, path2 as hamburgerMenuPath2, path3 as hamburgerMenuPath3 } from '@/svgs/hamburgerMenu';

import { useFont } from '@/contextes/contexteFont';
import { useMembre } from '@/contextes/contexteMembre';
import { usePalette } from '@/contextes/contextePalette';
import { useRouteAbs } from '@/contextes/contexteRoute';

import log from '@/functions/log';
import { useActionFab } from '@/hooks/useActionFAB';

import Haptics from '@/abstractions/haptics';
import MemberCode from '@/components/memberCode';
import PfpWithAvailability from "@/components/pfpWithAvailability";
import { withSpringConfig, withTimingConfig } from '@/constants/ReanimatedConfs';
import { convertirTimestampDateCourte } from "@/functions/convertirTimestamp";
import IntroTodoList from "@/components/introTodoList";

//#region Constantes (module) — calculées UNE fois, pas à chaque render
const BANNIERE_H = 228
const AVATAR_SIZE = 120
const FLOATING_BTN_HEIGHT = 64
const MENU_OPTIONS_GAP = 8
const OPTION_STEP = FLOATING_BTN_HEIGHT + MENU_OPTIONS_GAP
const STAGGER_MS = 40
const SPRING_DURATION_ESTIMATE = 250
const FAB_MARGIN = 16
// Espace réservé en bas de la carte pour que le contenu futur ne passe pas sous le FAB
const FAB_CLEARANCE = FAB_MARGIN * 2 + FLOATING_BTN_HEIGHT
const MIN_BRIGHTNESS = 0.1

type Statut = 'disponible' | 'silencieux' | 'indisponible'
const STATUTS: readonly Statut[] = ['disponible', 'silencieux', 'indisponible']
const STATUT_COULEURS: Record<Statut, string> = {
    disponible: '#35B86B',
    silencieux: '#E6B422',
    indisponible: '#E05252',
}

// parse() est coûteux : on le fait au chargement du module, pas dans le composant
const HAMBURGER_PATHS = [parse(hamburgerMenuPath1), parse(hamburgerMenuPath2), parse(hamburgerMenuPath3)]
const CLOSE_PATHS = [parse(closeMenuPath1), parse(closeMenuPath2), parse(closeMenuPath3)]

// IMPORTANT : createAnimatedComponent doit être appelé hors du composant.
// Sinon un NOUVEAU type de composant est créé à chaque render => React démonte/remonte le bouton.
const AnimatedTouchableOpacity = createAnimatedComponent(TouchableOpacity)
const AnimatedPath = createAnimatedComponent(Path)
//#endregion

const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

//#region Icône hamburger -> croix
function HamburgerIcon({ progress, color }: { progress: SharedValue<number>, color: string }) {
    const p1 = useAnimatedProps(() => ({ d: interpolatePath(progress.value, [0, 1], [HAMBURGER_PATHS[0], CLOSE_PATHS[0]]) }))
    const p2 = useAnimatedProps(() => ({ d: interpolatePath(progress.value, [0, 1], [HAMBURGER_PATHS[1], CLOSE_PATHS[1]]) }))
    const p3 = useAnimatedProps(() => ({ d: interpolatePath(progress.value, [0, 1], [HAMBURGER_PATHS[2], CLOSE_PATHS[2]]) }))
    const common = { fill: 'none', stroke: color, strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: 8 } as const

    return (
        <Svg style={{ width: '100%', height: '100%' }} viewBox='0 0 256 256'>
            <AnimatedPath {...common} animatedProps={p1} />
            <AnimatedPath {...common} animatedProps={p2} />
            <AnimatedPath {...common} animatedProps={p3} />
        </Svg>
    )
}
//#endregion

//#region Menu flottant (FAB)
type FabOptionProps = {
    index: number
    open: boolean
    target: SharedValue<number>
    opacity: SharedValue<number>
    onPress: () => void
    iconName: string
    iconColor?: string
    borderColor?: string
    label?: string
}

// Une option = son propre shared value. Plus de 5 shared values + 5 styles copiés-collés dans le parent.
function FabOption({ index, open, target, opacity, onPress, iconName, iconColor, borderColor, label }: FabOptionProps) {
    const { colors } = usePalette()
    // Le spring démarre sur le thread UI dès que `target` change (dans toggle),
    // sans attendre un re-render React : même timing que l'original.
    const progress = useDerivedValue(() => withDelay(index * STAGGER_MS, withSpring(target.value, withSpringConfig)))

    const animatedStyle = useAnimatedStyle(() => ({
        bottom: progress.value * OPTION_STEP * (index + 1),
        opacity: opacity.value,
    }))

    return (
        <AnimatedTouchableOpacity
            disabled={!open}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={label}
            style={[
                floatingButtonStyle(colors.primary, colors.border),
                styles.floatingOption,
                borderColor ? { borderColor } : null,
                animatedStyle,
            ]}
        >
            <Icon name={iconName as any} color={iconColor ?? colors.text} size={28} />
        </AnimatedTouchableOpacity>
    )
}

function FabMenu({ isAdmin, onSignOut }: { isAdmin: boolean, onSignOut: () => void }) {
    const { t } = useTranslation('profile')
    const { colors } = usePalette()
    const [open, setOpen] = useState(false)
    const progress = useSharedValue(0)        // morph hamburger -> croix
    const bgProgress = useSharedValue(0)      // couleur du bouton
    const optionOpacity = useSharedValue(0)   // opacité des options + backdrop
    const optionTarget = useSharedValue(0)    // cible du spring de position des options
    const hapticTimers = useRef<ReturnType<typeof setTimeout>[]>([])

    // Nettoyage des timers si l'écran est démonté pendant l'animation
    useEffect(() => () => hapticTimers.current.forEach(clearTimeout), [])

    // Liste data-driven : ajouter une option = ajouter une ligne ici
    const options = useMemo(() => {
        const list: Omit<FabOptionProps, 'index' | 'open' | 'target' | 'opacity'>[] = [
            { iconName: 'pencil', onPress: () => router.push('/(tabs)/profile/edit') },
            { iconName: 'cog', onPress: () => router.push('/(tabs)/profile/settings') },
            { iconName: 'log-out', iconColor: colors.error, borderColor: colors.error, onPress: onSignOut },
        ]
        if (isAdmin) {
            list.push({
                iconName: 'shield-checkmark-outline',
                label: t('admin.dashboard'),
                onPress: () => router.push('/(tabs)/profile/admin'),
            })
        }
        return list
    }, [isAdmin, colors.error, onSignOut, t])

    const toggle = useCallback(() => {
        const next = !open
        setOpen(next)
        progress.value = withTiming(next ? 1 : 0) // config par défaut, comme l'original
        optionTarget.value = next ? 1 : 0
        bgProgress.value = withTiming(next ? 1 : 0, withTimingConfig)
        optionOpacity.value = withDelay(next ? 0 : 160, withTiming(next ? 1 : 0, withTimingConfig))

        hapticTimers.current.forEach(clearTimeout)
        hapticTimers.current = options.map((_, i) =>
            setTimeout(() => (i % 2 === 0 ? Haptics.click() : Haptics.clickLeger()), i * STAGGER_MS + SPRING_DURATION_ESTIMATE)
        )
    }, [open, options, progress, bgProgress, optionOpacity, optionTarget])

    const backdropStyle = useAnimatedStyle(() => ({ opacity: interpolate(optionOpacity.value, [0, 1], [0, 0.5]) }))
    const triggerStyle = useAnimatedStyle(() => ({
        backgroundColor: interpolateColor(bgProgress.value, [0, 1], [colors.primary, 'transparent']),
    }))

    return (
        <>
            {/* pointerEvents : sans ça, le backdrop invisible bloquait tous les touchers de l'écran */}
            <Animated.View
                pointerEvents={open ? 'auto' : 'none'}
                style={[StyleSheet.absoluteFill, { zIndex: 11, backgroundColor: colors.background }, backdropStyle]}
            >
                <Pressable onPress={toggle} style={StyleSheet.absoluteFill} />
            </Animated.View>

            <View style={{ position: 'absolute', bottom: FAB_MARGIN, right: FAB_MARGIN, zIndex: 12 }}>
                <AnimatedTouchableOpacity
                    accessibilityRole="button"
                    accessibilityState={{ expanded: open }}
                    style={[floatingButtonStyle(colors.primary, colors.border), { zIndex: 1 }, triggerStyle]}
                    onPress={toggle}
                >
                    <HamburgerIcon progress={progress} color={colors.text} />
                </AnimatedTouchableOpacity>

                {options.map((opt, i) => (
                    <FabOption
                        key={opt.iconName}
                        index={i}
                        open={open}
                        target={optionTarget}
                        opacity={optionOpacity}
                        {...opt}
                        // On referme le menu après navigation, sauf pour la déconnexion (modal de confirmation)
                        onPress={opt.iconName === 'log-out' ? opt.onPress : () => { toggle(); opt.onPress() }}
                    />
                ))}
            </View>
        </>
    )
}
//#endregion

//#region Modal de statut
function StatutModal({ visible, current, onClose, onSelect }: {
    visible: boolean
    current: Statut
    onClose: () => void
    onSelect: (s: Statut) => void
}) {
    const { t } = useTranslation('profile')
    const { colors } = usePalette()
    const { fonts } = useFont()

    return (
        <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
            <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.42)' }}>
                <Pressable onPress={onClose} style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel={t('availability.close')} />
                <View style={{ width: '100%', maxWidth: 360, alignSelf: 'center', padding: 18, borderRadius: 18, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, elevation: 12 }}>
                    <Text style={{ color: colors.text, fontFamily: fonts.title, fontSize: 18, marginBottom: 12 }}>{t('availability.change')}</Text>
                    {STATUTS.map(statut => {
                        const couleur = STATUT_COULEURS[statut]
                        const actif = current === statut
                        return (
                            <TouchableOpacity
                                key={statut}
                                accessibilityRole="button"
                                accessibilityState={{ selected: actif }}
                                onPress={() => onSelect(statut)}
                                style={{ minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 10, borderRadius: 10, backgroundColor: actif ? `${couleur}22` : 'transparent' }}
                            >
                                <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: couleur }} />
                                <Text style={{ flex: 1, color: colors.text, fontFamily: fonts.body, fontSize: 15 }}>{t(`availability.${statut}`)}</Text>
                                {actif && <Icon name="checkmark" size={20} color={couleur} />}
                            </TouchableOpacity>
                        )
                    })}
                </View>
            </View>
        </Modal>
    )
}
//#endregion

//#region Écran
export default function ProfilEcran() {
    const { t } = useTranslation('profile')
    const { colors } = usePalette()
    const { fonts } = useFont()
    const { ajouterEcran } = useRouteAbs()
    const { membre, getMembre, patchStatutDisponibilite } = useMembre()

    const [avertissementVisible, setAvertissementVisible] = useState(false)
    const [menuStatutVisible, setMenuStatutVisible] = useState(false)
    const opaciteAvertissement = useSharedValue(0)
    const avertissementAnime = useAnimatedStyle(() => ({ opacity: opaciteAvertissement.value }))

    const statutCouleur = STATUT_COULEURS[membre.statutDisponibilite as Statut] ?? STATUT_COULEURS.indisponible

    // Styles dépendants du thème : recréés seulement si les couleurs/polices changent
    const s = useMemo(() => StyleSheet.create({
        carte: {
            flexGrow: 1, // <- la carte occupe tout l'espace restant, et grandit si on ajoute du contenu
            gap: 12,
            paddingBottom: FAB_CLEARANCE,
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            backgroundColor: colors.card,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.7,
            shadowRadius: 8,
            elevation: 5,
            borderBottomColor: colors.border,
            borderBottomWidth: 1,
        },
        pseudo: { fontSize: 24, color: colors.text, fontFamily: fonts.title },
        depuis: { color: colors.muted, fontSize: 14, paddingLeft: 4, fontFamily: fonts.body },
        bio: { color: colors.text, fontFamily: fonts.body, fontSize: 16, lineHeight: 22, maxHeight: 66 },
        badgeStatut: {
            alignSelf: 'flex-start',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            marginTop: 8,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 20,
            borderWidth: 1,
            backgroundColor: colors.card,
        },
    }), [colors, fonts])

    const ouvrirModalQRCode = useCallback(async () => {
        const permission = await Brightness.getPermissionsAsync()
        if (!permission.granted) {
            Alert.alert(
                t('qrCode.brightnessTitle'),
                t('qrCode.brightnessMessage'),
                [
                    { text: t('qrCode.deny'), onPress: () => log('Accès refusé'), style: 'cancel' },
                    { text: t('qrCode.allow'), onPress: async () => { await Brightness.requestPermissionsAsync() } },
                ],
                { cancelable: false }
            )
        }

        const luminosite = await Brightness.getBrightnessAsync()
        if (luminosite <= MIN_BRIGHTNESS) {
            setAvertissementVisible(true)
            opaciteAvertissement.value = withTiming(1, { duration: 500 })
            await wait(2000)
            opaciteAvertissement.value = withTiming(0, { duration: 500 })
            await Brightness.setBrightnessAsync(MIN_BRIGHTNESS)
            setAvertissementVisible(false) // l'overlay (zIndex 20) restait monté et bloquait les touchers
        }

        router.push({ pathname: '/(modals)/ajouterAmi', params: { contexte: 'qrCode' } })
    }, [t, opaciteAvertissement])

    useActionFab("profil", {
        action: ouvrirModalQRCode,
        config: {
            visible: true,
            icon: <Icon name='qr-code' color={colors.text} size={24} />,
        },
    })

    useFocusEffect(
        useCallback(() => {
            ajouterEcran('profil')
            if (!membre.fp || !membre.pseudo || !membre.bio || !membre.idPublique)
                getMembre()
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [])
    )

    const choisirStatut = useCallback(async (statut: Statut) => {
        setMenuStatutVisible(false)
        try {
            await patchStatutDisponibilite(statut)
        } catch {
            Alert.alert(t('availability.errorTitle'), t('availability.errorMessage'))
        }
    }, [patchStatutDisponibilite, t])

    const confirmerDeconnexion = useCallback(() => {
        router.push({ pathname: '/(modals)/confirm', params: { action: 'signOut' } })
    }, [])

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            {avertissementVisible && (
                <Animated.View style={[StyleSheet.absoluteFill, avertissementAnime, { zIndex: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card }]}>
                    <Text style={{ color: colors.warning, fontFamily: fonts.body, fontSize: 28 }}>{t('brightness.warning')}</Text>
                </Animated.View>
            )}

            {/*
              ScrollView + flexGrow:1 : la carte remplit l'écran jusqu'en bas aujourd'hui,
              et si tu ajoutes du contenu dedans, elle s'allonge (et ça scroll si ça déborde).
            */}
            <ScrollView
                style={{ flex: 1,  }}
                contentContainerStyle={{ flexGrow: 1, paddingBottom:88, gap:16 }}
                showsVerticalScrollIndicator={false}
                bounces={false}
            >
                {/* Bannière */}
                <View style={{ height: BANNIERE_H, width: '100%' }} />

                {/* Carte profil */}
                <View style={s.carte}>
                    <View style={{ height: AVATAR_SIZE, width: AVATAR_SIZE, marginLeft: 16, marginTop: -56, zIndex: 2 }}>
                        <PfpWithAvailability size={AVATAR_SIZE} pfp={membre.fp} statut={membre.statutDisponibilite} />
                    </View>

                    <View style={{ paddingHorizontal: 16 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
                            <Text style={s.pseudo}>@{membre.pseudo}</Text>
                            <MemberCode code={membre.idPublique ?? ''} />
                        </View>
                        <Text style={s.depuis}>{t('memberSince', { date: convertirTimestampDateCourte(membre.tempsCreation) })}</Text>

                        <TouchableOpacity
                            accessibilityRole="button"
                            accessibilityLabel={t('availability.change')}
                            accessibilityState={{ expanded: menuStatutVisible }}
                            onPress={() => setMenuStatutVisible(true)}
                            style={[s.badgeStatut, { borderColor: statutCouleur }]}
                        >
                            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: statutCouleur }} />
                            <Text style={{ color: colors.text, fontFamily: fonts.body, fontSize: 13 }}>{t(`availability.${membre.statutDisponibilite}`)}</Text>
                            <Icon name="chevron-down" size={16} color={colors.muted} />
                        </TouchableOpacity>
                    </View>

                    {/* TODO: bouton avec le compte d'amis qui affiche la liste des amis */}
                    <View style={{ paddingHorizontal: 16, paddingVertical: 4 }}>
                        <Text style={s.bio} numberOfLines={3} ellipsizeMode="tail">{membre.bio}</Text>
                    </View>

                    {/* Futurs widgets : ajoute ici, la carte s'allonge toute seule */}
                </View>
                <View style={styles.underCarte}>
                    <IntroTodoList/>
                </View>
            </ScrollView>

            <StatutModal
                visible={menuStatutVisible}
                current={membre.statutDisponibilite as Statut}
                onClose={() => setMenuStatutVisible(false)}
                onSelect={choisirStatut}
            />

            <FabMenu isAdmin={!!membre.admin} onSignOut={confirmerDeconnexion} />
        </View>
    )
}
//#endregion

//#region Styles partagés
const floatingButtonStyle = (backgroundColor: string, borderColor: string) => ({
    aspectRatio: 1,
    height: FLOATING_BTN_HEIGHT,
    borderRadius: 100,
    borderWidth: 1,
    borderColor,
    backgroundColor,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
})

const styles = StyleSheet.create({
    floatingOption: { position: 'absolute', zIndex: 0 },
    underCarte: {paddingHorizontal: 8}
})
//#endregion