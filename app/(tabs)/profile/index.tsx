import Icon from "@react-native-vector-icons/ionicons";
import * as Brightness from 'expo-brightness';
import { router } from 'expo-router';
import { useFocusEffect, useIsFocused } from "expo-router/react-navigation";
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View, ViewStyle } from 'react-native';
import Animated, { createAnimatedComponent, interpolate, useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import { interpolatePath, parse } from 'react-native-redash';
import Svg, { Path } from 'react-native-svg';

import { path1 as closeMenuPath1, path2 as closeMenuPath2, path3 as closeMenuPath3 } from '@/svgs/closeMenu';
import { path1 as hamburgerMenuPath1, path2 as hamburgerMenuPath2, path3 as hamburgerMenuPath3 } from '@/svgs/hamburgerMenu';

import { useFont } from '@/contextes/contexteFont';
import { useMembre } from '@/contextes/contexteMembre';
import { usePalette } from '@/contextes/contextePalette';
import { useRouteAbs } from '@/contextes/contexteRoute';

import catcher from '@/functions/catcher';
import ChooseImage from '@/functions/choisirImage';
import log from '@/functions/log';

import { useActionFab } from '@/hooks/useActionFAB';

import Haptics from '@/abstractions/haptics';
import MemberCode from '@/components/memberCode';
import PfpWithAvailability from "@/components/pfpWithAvailability";
import { withSpringConfig, withTimingConfig } from '@/constants/ReanimatedConfs';
import { convertirTimestampDateCourte } from "@/functions/convertirTimestamp";
import IntroTodoList from "@/components/introTodoList";

//#region Constantes (module)
const MENU_OPTIONS_GAP = 8
const FLOATING_BTN_HEIGHT = 64
const FAB_MARGIN = 16
// Espace en bas de la carte pour que le contenu futur ne passe pas sous le bouton flottant
const FAB_CLEARANCE = FAB_MARGIN * 2 + FLOATING_BTN_HEIGHT
const BANNIERE_RATIO = 1 / 4 // la bannière occupe un quart de l'écran
const MIN_BRIGHTNESS = 0.1
const SPRING_DURATION_ESTIMATE = 250

type Statut = 'disponible' | 'silencieux' | 'indisponible'
const STATUTS: readonly Statut[] = ['disponible', 'silencieux', 'indisponible']
const STATUT_COULEURS: Record<Statut, string> = {
    disponible: '#35B86B',
    silencieux: '#E6B422',
    indisponible: '#E05252',
}
const couleurStatut = (statut: string) => STATUT_COULEURS[statut as Statut] ?? STATUT_COULEURS.indisponible

// Created once, outside the component (created during render, they were new components
// on every render, which resets them)
const AnimatedTouchableOpacity = createAnimatedComponent(TouchableOpacity)
const AnimatedPath = createAnimatedComponent(Path)

// parse() fait une fois au chargement du module au lieu de 6 fois à chaque render
const hamburgerMenuP1 = parse(hamburgerMenuPath1)
const closeMenuP1 = parse(closeMenuPath1)
const hamburgerMenuP2 = parse(hamburgerMenuPath2)
const closeMenuP2 = parse(closeMenuPath2)
const hamburgerMenuP3 = parse(hamburgerMenuPath3)
const closeMenuP3 = parse(closeMenuPath3)
//#endregion

//#region Styles statiques (ne dépendent pas du thème : créés une seule fois)
const styles = StyleSheet.create({
    bio:{
        fontSize:16,
        width:'100%',
        flexShrink:1,
        lineHeight:22,
    },
    widgetEnEdit:{
        height:'95%', 
        width:132, 
        marginHorizontal:8,
        marginVertical:8,
        borderWidth:1,
        borderRadius: 12,
        alignItems:'center', 
        justifyContent:'center',
    },
    boutonEditer: {
        height: 42,
        borderRadius: 10,
        borderWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    // camera bottom left, mirroring the availability light (bottom right)
    badgeCrayon: {
        position: 'absolute',
        left: 4,
        bottom: 4,
        width: 28,
        height: 28,
        borderRadius: 14,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    floatingOption: {
        position: 'absolute',
        zIndex:0
    },
})
//#endregion

//#region Modal de statut
function StatutModal({ visible, current, onClose, onSelect }: {
    visible: boolean
    current: string
    onClose: () => void
    onSelect: (statut: Statut) => void
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
                    {STATUTS.map((statut) => {
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

export default function ProfilEcran(){
    const { t } = useTranslation('profile')
    const { colors } = usePalette()
    const { fonts } = useFont()

    const isFocused = useIsFocused()
    const { ajouterEcran } = useRouteAbs()
    const { membre, getMembre, patchStatutDisponibilite, patchProfil } = useMembre()

    const oldBrightness = useRef<number>(0)
    const hapticTimers = useRef<ReturnType<typeof setTimeout>[]>([])

    const [avertissementVisible, setAvertissementVisible] = useState(false)
    const [menuStatutVisible, setMenuStatutVisible] = useState(false)
    const [hamburgerMenuOpen, setHamburgerMenuOpen] = useState<boolean>(false)

    // Nettoyage des timers d'haptique si l'écran est démonté pendant l'animation
    useEffect(() => () => hapticTimers.current.forEach(clearTimeout), [])
//#region ValeursAnimé
    const opaciteAvertissement = useSharedValue(0)
    const { height: winH } = useWindowDimensions()
    const banniereH = useSharedValue(winH * BANNIERE_RATIO)
    useEffect(() => { banniereH.set(winH * BANNIERE_RATIO) }, [winH, banniereH]) // ex: rotation

    const hamburgerMenuOpenShared = useSharedValue<number>(0) 
    const hamburgerMenuBg = useSharedValue(colors.primary)

    const paramsOptionBottom = useSharedValue(0)
    const logOutOptionBottom = useSharedValue(0)
    const adminOptionBottom = useSharedValue(0)
    const optionOpacity = useSharedValue(0)

    const opaciteAnime = useSharedValue(1)

    const infosMembreAlignItems = useSharedValue<ViewStyle['alignItems']>('flex-start')
    const opaciteInfosMembre = useSharedValue(1)  

    const banniereAnimee = useAnimatedStyle(() => {
        "worklet"
        return{
            height: banniereH.get(),
            opacity: opaciteAnime.get(),
        }
    })
    const infosMembreAnime = useAnimatedStyle<ViewStyle>(()=>{
        "worklet"
        return{
            alignItems: infosMembreAlignItems.get(),
            opacity: opaciteInfosMembre.get()
        }
    })

    //Utils for animating hamburger menu to close icon - Path 1 (top line → top-left diagonal)
    const pathProps1 = useAnimatedProps(() => {
        "worklet"
        return {
            d: interpolatePath(hamburgerMenuOpenShared.get(), [0, 1], [hamburgerMenuP1, closeMenuP1])
        }
    })

    //Utils for animating hamburger menu to close icon - Path 2 (middle line → top-right diagonal)
    const pathProps2 = useAnimatedProps(() => {
        "worklet"
        return {
            d: interpolatePath(hamburgerMenuOpenShared.get(), [0, 1], [hamburgerMenuP2, closeMenuP2])
        }
    })

    //Utils for animating hamburger menu to close icon - Path 3 (bottom line → bottom-right diagonal)
    const pathProps3 = useAnimatedProps(() => {
        "worklet"
        return {
            d: interpolatePath(hamburgerMenuOpenShared.get(), [0, 1], [hamburgerMenuP3, closeMenuP3])
        }
    })

    const hamburgerMenuTriggerAnimated = useAnimatedStyle(() => {
        return {
            backgroundColor:hamburgerMenuBg.get()
        }
    })
    
    //Hamburger menu options animated styles
    const paramsOptionAnimated = useAnimatedStyle(() => {
        return {
            bottom: paramsOptionBottom.get(),
            opacity: optionOpacity.get()
        }
    })
    const logOutOptionAnimated = useAnimatedStyle(() => {
        return {
            bottom: logOutOptionBottom.get(),
            opacity: optionOpacity.get()
        }
    })
    const adminOptionAnimated = useAnimatedStyle(() => ({
        bottom: adminOptionBottom.get(),
        opacity: optionOpacity.get()
    }))
    const backdropAnimated = useAnimatedStyle(() => {
        return {
            opacity:interpolate(optionOpacity.get(), [0, 1], [0, 0.5])
        }
    })

    const avertissementAnime = useAnimatedStyle(()=>{
        return{
            opacity:opaciteAvertissement.get()
        }
    })

//#endregion  
   
    const ouvrirModalQRCode = async()=>{
        const permission = await Brightness.getPermissionsAsync()
        if(!permission.granted){
            Alert.alert(
                t('qrCode.brightnessTitle'),
                t('qrCode.brightnessMessage'),
                [
                {
                    text: t('qrCode.deny'),
                    onPress: () => log('Accès refusé'),
                    style: 'cancel',
                },
                {
                    text: t('qrCode.allow'),
                    onPress: async() => {await Brightness.requestPermissionsAsync()},
                },
                ],
                { cancelable: false }
            );            
        }
        oldBrightness.current = await Brightness.getBrightnessAsync()
        const luminositeBasse = oldBrightness.current <= MIN_BRIGHTNESS
        if(luminositeBasse){
            setAvertissementVisible(true)
            opaciteAvertissement.set(withTiming(1, {duration:500}))
        }
            
        setTimeout(async ()=>{            
            if(luminositeBasse){
                opaciteAvertissement.set(withTiming(0, {duration:500}))
                await Brightness.setBrightnessAsync(MIN_BRIGHTNESS)
            }
            router.push({ pathname: '/(modals)/ajouterAmi', params: { contexte: 'qrCode' } })
            // L'overlay (zIndex 20) restait monté après le fade-out et bloquait les touchers au retour
            if(luminositeBasse) setTimeout(() => setAvertissementVisible(false), 500)
        }, luminositeBasse ? 2000 : 0)       
        
    }   
    const ouvrirEdition = () => router.push('/(tabs)/profile/edit')

    // Tapping one's photo changes it right away: pick (square crop), upload, done.
    // The rest of the profile is edited with the "Modifier le profil" button.
    const [envoiPhoto, setEnvoiPhoto] = useState(false)
    const changerPhoto = async () => {
        if (envoiPhoto) return
        await ChooseImage(async (img) => {
            setEnvoiPhoto(true)
            try {
                await patchProfil(undefined, undefined, {
                    uri: img.uri,
                    mimeType: img.mimeType ?? 'image/jpeg',
                    fileName: img.fileName ?? img.uri.split('/').pop(),
                })
            } catch (error) {
                catcher(error, t('errors.updateFailed'))
            } finally {
                setEnvoiPhoto(false)
            }
        })
    }

    const choisirStatut = async (statut: Statut) => {
        setMenuStatutVisible(false)
        try { await patchStatutDisponibilite(statut) }
        catch { Alert.alert(t('availability.errorTitle'), t('availability.errorMessage')) }
    }

    const toggleHamburgerMenu = () => {   
        const isOpen = !hamburgerMenuOpen
        setHamburgerMenuOpen(isOpen)
        hamburgerMenuOpenShared.set(withTiming(isOpen ? 1 : 0))
        hamburgerMenuBg.set(withTiming(isOpen ? 'transparent' : colors.primary, withTimingConfig))
        // (editing the profile is now a button on the profile card, not in this menu)
        // log out closest to the menu button, settings above it
        logOutOptionBottom.set(withDelay(0, withSpring(isOpen ? FLOATING_BTN_HEIGHT + MENU_OPTIONS_GAP : 0, withSpringConfig)))
        paramsOptionBottom.set(withDelay(40, withSpring(isOpen ? (FLOATING_BTN_HEIGHT + MENU_OPTIONS_GAP) * 2 : 0, withSpringConfig)))
        adminOptionBottom.set(withDelay(80, withSpring(isOpen ? (FLOATING_BTN_HEIGHT + MENU_OPTIONS_GAP) * 3 : 0, withSpringConfig)))
        optionOpacity.set(withDelay(isOpen ? 0 : 160, withTiming(isOpen ? 1 : 0, withTimingConfig)))
        
        hapticTimers.current.forEach(clearTimeout)
        hapticTimers.current = [
            setTimeout(() => Haptics.click(), 0 + SPRING_DURATION_ESTIMATE),
            setTimeout(() => Haptics.clickLeger(), 40 + SPRING_DURATION_ESTIMATE),
            setTimeout(() => Haptics.click(), 80 + SPRING_DURATION_ESTIMATE),
        ]
    }
    /* 
        const getWidgetsMembre = async ()=>{
            let token = await getToken()
            try {
                const reponse = await api.get('/widgets', {
                    headers:{
                        'Authorization':`Bearer ${token}`
                    }
                })

                setWidgetsMembre(reponse.data.widgets)
            } catch (error) {
                catcher(error, t('errors.widgetsLoadFailed'))
            }
        } */

    /* const getWidgetsAmis = async()=>{}
     */
    useActionFab("profil", {
        action: ouvrirModalQRCode,
        config: {
            visible:true,
            icon: <Icon name='qr-code' color={colors.text} size={24} />
        }
    })

    useFocusEffect(
        React.useCallback(() => {
            ajouterEcran('profil')
            log("temps creation", membre.tempsCreation)
            
            if(!membre.fp || !membre.pseudo || !membre.bio || !membre.idPublique)
                getMembre()
            
            //getWidgetsMembre()
            // (the photo is shown by PfpWithAvailability from membre.fp: the unused
            // local copy of it was removed)
        // only when the screen gets the focus: with membre in the deps, getMembre (which
        // changes membre) could run again and again while a field stays empty
        // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [isFocused])
    );

//#region StyleSheet dynamique
    // Seulement ce qui dépend du thème. useMemo : recréé si colors/fonts changent, pas à chaque render
    const s = useMemo(() => StyleSheet.create({   
        // Carte qui "lévite" au-dessus de la bannière : grande ombre diffuse décalée vers le HAUT
        carte: {
            flexGrow: 1, // occupe tout l'espace restant jusqu'en bas, et grandit si on ajoute du contenu
            flexDirection: 'column',
            gap: 12,
            paddingBottom: FAB_CLEARANCE,
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            backgroundColor: colors.card,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -6 },
            shadowOpacity: 0.25,
            shadowRadius: 24,
            elevation: 12,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: 'rgba(255,255,255,0.08)',
        },
        pseudo:{
            fontSize: 24,
            color: colors.text,
            fontFamily: fonts.title 
        },
        button: {
            width: '90%',
            alignItems: 'center',
            borderWidth: 1,
            borderRadius: 8,
            borderColor: colors.border,
            paddingVertical: 16,
            backgroundColor: colors.primary,
            flexDirection: 'row',
            justifyContent: 'center',
            gap:8
        },
        floatingButton: {
            aspectRatio: 1 / 1,
            height: FLOATING_BTN_HEIGHT,
            borderRadius: 100,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
            zIndex:1
        },
        hamburgerMenuBackdrop: {
            zIndex: 11,
            height: '100%',
            width: '100%',
            position: 'absolute',
            backgroundColor: colors.background
        }
    }), [colors, fonts])
//#endregion

    const couleurDuStatut = couleurStatut(membre.statutDisponibilite)
    
    return (  
        <View style={{flex:1, backgroundColor:colors.background}}>
            {avertissementVisible && <Animated.View style={[avertissementAnime, StyleSheet.absoluteFill, {zIndex:20, alignItems:'center', justifyContent:'center', backgroundColor:colors.card }]}>
                <Text style={{color:colors.warning, fontFamily:fonts.body, fontSize:28}}>{t('brightness.warning')}</Text>
            </Animated.View>}

            {/* pointerEvents : sans ça, ce backdrop invisible (zIndex 11) interceptait tous les touchers de l'écran */}
            <Animated.View pointerEvents={hamburgerMenuOpen ? 'auto' : 'none'} style={[s.hamburgerMenuBackdrop, backdropAnimated]}>
                <Pressable
                    onPress={() => { if (hamburgerMenuOpen) toggleHamburgerMenu() }}
                    style={{ height: '100%', width: '100%' }}
                />
            </Animated.View>

            {/*
              ScrollView + flexGrow:1 : la carte remplit l'écran jusqu'en bas aujourd'hui.
              Si tu ajoutes du contenu dedans, elle s'allonge (et ça scrolle si ça déborde).
            */}
            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ flexGrow: 1, gap:16, paddingBottom:88 }}
                showsVerticalScrollIndicator={false}
                bounces={false}
            >
                {/* Bannière */}
                <Animated.View style={[{ width:'100%', overflow:'hidden' }, banniereAnimee]} />

                {/* Profil infos */}
                <View style={s.carte}>
                    {/* Pfp */}
                    <View style={{ height: 120, width: 120, zIndex: 2, marginLeft: 16, marginTop: -56, justifyContent: 'center', alignItems: 'center' }}>
                        {/* tapping one's own photo changes it (camera badge) */}
                        <TouchableOpacity
                            onPress={changerPhoto}
                            disabled={envoiPhoto}
                            activeOpacity={0.8}
                            accessibilityRole="button"
                            accessibilityLabel={t('changePhoto')}
                            accessibilityState={{ busy: envoiPhoto }}
                        >
                            <PfpWithAvailability size={120} pfp={membre.fp} statut={membre.statutDisponibilite} />
                            <View style={[styles.badgeCrayon, { backgroundColor: colors.primary, borderColor: colors.card }]}>
                                {envoiPhoto
                                    ? <ActivityIndicator size="small" color={colors.text} />
                                    : <Icon name="camera" size={14} color={colors.text} />}
                            </View>
                        </TouchableOpacity>
                    </View>

                    {/* Pseudo and Code */}
                    <Animated.View style={[{ justifyContent: 'center', paddingHorizontal: 16}, infosMembreAnime]}>
                        <View style={{flexDirection:'row', alignItems:'baseline', justifyContent:'space-between', width:'100%'}}>
                            <Text style={s.pseudo}>@{membre.pseudo}</Text>
                            <MemberCode code={membre.idPublique??''}/>
                        </View>                            
                        <Text style={{color:colors.muted, fontSize:14, paddingLeft:4, fontFamily:fonts.body}}>{t('memberSince', { date: convertirTimestampDateCourte(membre.tempsCreation) })}</Text>
                        <TouchableOpacity
                            accessibilityRole="button"
                            accessibilityLabel={t('availability.change')}
                            accessibilityState={{ expanded: menuStatutVisible }}
                            onPress={() => setMenuStatutVisible(true)}
                            style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: couleurDuStatut, backgroundColor: colors.card }}
                        >
                            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: couleurDuStatut }} />
                            <Text style={{ color: colors.text, fontFamily: fonts.body, fontSize: 13 }}>{t(`availability.${membre.statutDisponibilite}`)}</Text>
                            <Icon name="chevron-down" size={16} color={colors.muted} />
                        </TouchableOpacity>
                    </Animated.View>

                    {/* TODO: avoir un bouton avec le compte des amis qui affiche la liste des amis */}
                    {/* Bio */}
                    <View style={{ width:'100%', paddingHorizontal:16, paddingVertical:4, flexShrink:1 }}>
                        <Text style={[styles.bio,{color:colors.text, fontFamily:fonts.body, fontSize:16, width:'100%', maxHeight:66}]} numberOfLines={3} ellipsizeMode="tail">{membre.bio}</Text>
                    </View>

                    {/* Edit profile: on the profile itself, where people look for it (it was
                        hidden in the floating menu) */}
                    <View style={{ paddingHorizontal: 16 }}>
                        <TouchableOpacity
                            onPress={ouvrirEdition}
                            accessibilityRole="button"
                            style={[styles.boutonEditer, { borderColor: colors.border, backgroundColor: colors.background }]}
                        >
                            <Icon name="pencil-outline" size={18} color={colors.text} />
                            <Text style={{ color: colors.text, fontFamily: fonts.body, fontSize: 16 }}>{t('editProfile')}</Text>
                        </TouchableOpacity>
                    </View>
                    
                </View>
                {/* Todo list d'introduction */}
                <View style={{paddingHorizontal:8}}>
                    <IntroTodoList
                        forceShown={false}
                    />
                </View>
                {/* Futurs widgets : ajoute ici, la carte s'allonge toute seule */}
            </ScrollView>

            <StatutModal
                visible={menuStatutVisible}
                current={membre.statutDisponibilite}
                onClose={() => setMenuStatutVisible(false)}
                onSelect={choisirStatut}
            />

            {/* Hamburger Menu */}
            <View style={{ position: 'absolute', bottom: FAB_MARGIN, right: FAB_MARGIN, zIndex:12 }}>                        
                {/* Hamburger menu trigger */}
                <AnimatedTouchableOpacity style={[s.floatingButton, hamburgerMenuTriggerAnimated]}
                    onPress={() => {
                        toggleHamburgerMenu()
                    }}
                >
                    <Svg
                        style={{ width: '100%', height: '100%' }}
                        viewBox='0 0 256 256'
                    >
                        <AnimatedPath
                            fill="none"
                            stroke={colors.text}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={8}
                            animatedProps={pathProps1}
                        />
                        <AnimatedPath
                            fill="none"
                            stroke={colors.text}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={8}
                            animatedProps={pathProps2}
                        />
                        <AnimatedPath
                            fill="none"
                            stroke={colors.text}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={8}
                            animatedProps={pathProps3}
                        />
                    </Svg>
                </AnimatedTouchableOpacity>
                {/* Hamburger menu options */}
                <AnimatedTouchableOpacity style={[s.floatingButton, styles.floatingOption, paramsOptionAnimated]}
                onPress={() => {
                    toggleHamburgerMenu()
                    router.push('/(tabs)/profile/settings')
                }}
                >
                    <Icon name='cog' color={colors.text} size={28} />
                </AnimatedTouchableOpacity>
                <AnimatedTouchableOpacity
                    style={[s.floatingButton, styles.floatingOption, { borderColor: colors.error }, logOutOptionAnimated]}
                    onPress={() => {
                        router.push({
                            pathname: '/(modals)/confirm',
                            params: { action: 'signOut' },
                        })
                    }}
                >
                    <Icon name='log-out' color={colors.error} size={28} />
                </AnimatedTouchableOpacity>
                {membre.admin && (
                    <AnimatedTouchableOpacity
                        style={[s.floatingButton, styles.floatingOption, adminOptionAnimated]}
                        onPress={() => {
                            toggleHamburgerMenu()
                            router.push('/(tabs)/profile/admin')
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={t('admin.dashboard')}
                    >
                        <Icon name="shield-checkmark-outline" color={colors.text} size={28} />
                    </AnimatedTouchableOpacity>
                )}
            </View>
        </View>
    )                           
}