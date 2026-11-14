import { BlurView } from "expo-blur"
import { LinearGradient } from "expo-linear-gradient"
import { router } from "expo-router"
import { useFocusEffect } from "expo-router/react-navigation"
import React, { useEffect, useState } from "react"
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TouchableOpacity, View } from "react-native"
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler"
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming, } from "react-native-reanimated"

import Haptics from "@/abstractions/haptics"

import log from "@/functions/log"

import { useFont } from "@/contextes/contexteFont"
import { usePalette } from "@/contextes/contextePalette"

import { withSpringConfig, withTimingConfig } from "@/constants/ReanimatedConfs"

import { useModal } from "@/contextes/contexteModals"
import { modalEvents } from "@/events/modalEvents"
import Ionicons from "@react-native-vector-icons/ionicons"

const noop = () => {}

/**
 * @param {Object} props
 * @param {React.ReactNode} [props.children] - The sheet's content.
 * @param {boolean} [props.canDismiss=true] - Closing dismisses the modal route.
 * @param {() => void} [props.onDismiss] - Called once closed.
 * @param {boolean} [props.afficherBoutonFermer=true] - The round close button at the bottom
 *   (false: closed by swiping down or tapping outside only — e.g. the invitation review's
 *   availability details). Philip.
 */
export default function ModalBase({ children, canDismiss = true, onDismiss = noop, afficherBoutonFermer = true }){
    const { colors } = usePalette()
    const {dismissButton, runDismissButtonAction} = useModal()

    const { fonts } = useFont()
    
    const s = StyleSheet.create({
        flexFill: {
            flex: 1,
        },
        keyboardAvoidingView: {
            alignItems: 'center',
            justifyContent: 'flex-end',
            flex:1
        },

        overlayPressable: {
            position: 'absolute',
            height: '55%',
            width: '100%',
        },
        blurBackdrop: {
            zIndex: -1,
            position: 'absolute',
            top: 0,
            left: 0,
            height: '100%',
            width: '100%',
            backgroundColor: colors.background,
        },

        sheetWrapper: {
            width: '100%',
        },
        sheetContent: {
            position: 'absolute',
            zIndex: 3,
            bottom: -2,
            height: '100%',
            width: '100%',
            backgroundColor: colors.card,
            paddingHorizontal: 16,
            paddingVertical: 4,
            paddingBottom:32,
            gap: 4,
            borderTopLeftRadius: 32,
            borderTopRightRadius: 32,
            borderWidth: 1,
            borderColor: colors.border,
        },
        bottomGradient: {
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            width: '100%',
            height: 32,
        },

        dragHandleContainer: {
            width: '100%',
            alignItems: 'center',
        },
        dragHandleWrapper: {
            borderRadius: 8,
            overflow: 'hidden',
        },
        dragHandle: {
            height: 2.7,
            width: 48,
            backgroundColor: colors.muted,
            borderRadius: 8,
        },

        placeholderText: {
            fontFamily: fonts.title,
            fontSize: 24,
            color: colors.text,
            alignSelf: 'center',
            marginTop: '40%',
        },

        optionsRow: {
            position: 'absolute',
            zIndex: 5,
            width: '100%',
            flexDirection: 'row',
            justifyContent: 'space-between',
        },

        circleButtonBase: {
            borderRadius: 100,
            justifyContent: 'center',
            alignItems: 'center',
        },
        closeButton: {
            width: 64,
            height: 64,
            left: 16,
            backgroundColor: colors.error,
        },
        expandButton: {
            position: 'absolute',
            zIndex: 20,
            bottom: 388,
            width: 40,
            height: 40,
            borderWidth: 0.7,
            borderColor: colors.text,
            backgroundColor: colors.secondary,
        },
        collapseButton: {
            position: 'absolute',
            zIndex: 20,
            right: 16,
            width: 64,
            height: 64,
            borderWidth: 0.7,
            borderColor: colors.muted,
            backgroundColor: colors.card,
        },

        arrowIconBase: {
            height: '64%',
        },
        expandIcon: {
            transform: [{ rotate: '-90deg' }],
            marginBottom: 2,
        },
        collapseIcon: {
            transform: [{ rotate: '90deg' }],
            marginTop: 2,
        },
        closeIcon: {
            height: '60%',
            transform: [{ rotate: '45deg' }],
        },
    });

    const [fullScreen, setFullScreen] = useState(false)
    const [closing, setClosing] = useState(false)

    const opacityFlou = useSharedValue(0)
    const modalHeight = useSharedValue('0%')
    const modalOpacity = useSharedValue(0)

    const optionBottom = useSharedValue(-s.closeButton.height)
    const optionsOpacity = useSharedValue(1)

    const dismissModalRoute = React.useCallback(() => {
        if (router.canDismiss() && canDismiss) {
            router.dismiss()
        }
        onDismiss?.()
    }, [canDismiss, onDismiss])

    const LEVELS = [0, 45, 94]; // 0 = closed, 1 = 45, 2 = fullscreen
    const actualLevel = useSharedValue(1); // starts at 45%   

    const flouAnime = useAnimatedStyle(()=>{
        "worklet"
        return{
            opacity:opacityFlou.get()
        }
    })
    const modalAnime = useAnimatedStyle(()=>{
        "worklet"
        return{
            height: modalHeight.get(),
            opacity: modalOpacity.get()
        }
    })
    const optionsAgrandirAnime = useAnimatedStyle(()=>{
        "worklet"
        return{
            bottom:optionBottom.get(),
            opacity:optionsOpacity.get()
        }
    })

    const closeButtonHeight = s.closeButton.height

    const fermerModalBase = React.useCallback(() => {
        if (closing) return
        setClosing(true)

        opacityFlou.set(withTiming(0, withTimingConfig));
        modalOpacity.set(withTiming(0, withTimingConfig, (finished) => {
            if (finished) runOnJS(dismissModalRoute)()
        }));
        modalHeight.set(withSpring('0%', withSpringConfig));
        optionBottom.set(withSpring(-closeButtonHeight, withSpringConfig));
        optionsOpacity.set(withTiming(0, withTimingConfig));
    }, [closing, closeButtonHeight, dismissModalRoute, modalHeight, modalOpacity, opacityFlou, optionBottom, optionsOpacity])

    const panGesture = Gesture.Pan()
        .onChange((e) => {
            const base = LEVELS[actualLevel.get()];
            const heightWanted = base + (-e.translationY / 10);
            modalHeight.set(`${Math.max(0, Math.min(LEVELS[LEVELS.length-1], heightWanted))}%`);
        })
        .onEnd((e) => {
            const MIN_DIST = 40;   // px 
            const MIN_VEL = 800;  // px/sec (good swipe)

            let direction = 0;
            if (e.translationY < -MIN_DIST || e.velocityY < -MIN_VEL) {
                direction = 1;  
            } else if (e.translationY > MIN_DIST || e.velocityY > MIN_VEL) {
                direction = -1; 
            }

            const newIndex = Math.max(0, Math.min(LEVELS.length - 1, actualLevel.get() + direction));

            if (newIndex === 0) {
                runOnJS(fermerModalBase)();
            } else {
                actualLevel.set(newIndex);
                runOnJS(setFullScreen)(newIndex === 2);
                modalHeight.set(withSpring(`${LEVELS[newIndex]}%`, withSpringConfig));
            
                optionBottom.set(withSpring(newIndex === 2 ?32 : -s.closeButton.height, withSpringConfig));                                
            }
        });
        
    useFocusEffect(React.useCallback(() => {
        if (closing) return

        const clavierAffiche = Keyboard.addListener("keyboardWillShow", () => {
            log("keyboard did show")
            setFullScreen(true)
            modalHeight.set(withSpring('90%', withSpringConfig))
            actualLevel.set(2)
        })             
        
        setFullScreen(false)
        modalHeight.set(withSpring('45%', withSpringConfig))
        modalOpacity.set(withTiming(1, withTimingConfig))
        opacityFlou.set(withTiming(1, withTimingConfig))

        Haptics.modalDebut()

        const unsubscribe = modalEvents.onClose(fermerModalBase)
        
        return () => {
            // Only this modal's own listener. removeAllListeners("keyboardDidShow" /
            // "keyboardWillShow") also removed React Native's (KeyboardAvoidingView,
            // ScrollView, TextInput) and the chat's: when those later removed theirs,
            // iOS warned "Attempted to remove more RCTKeyboardObserver listeners than
            // added", and they stopped reacting to the keyboard. Rectification (Philip).
            clavierAffiche.remove()
            unsubscribe()
        }
    }, [actualLevel, closing, fermerModalBase, modalHeight, modalOpacity, opacityFlou]))
    
    useEffect(() => {
        log("fullscreen", fullScreen)
        log('keyboard visible', Keyboard.isVisible())
        if (!fullScreen) {
            log("dismiss keyboard")
            Keyboard.dismiss()
        }
    }, [fullScreen])

    return (        
        <GestureHandlerRootView style={s.flexFill} pointerEvents={closing ? 'none' : 'auto'}>
            <View style={s.flexFill}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'height' : 'padding'} style={s.keyboardAvoidingView}>
                <Pressable 
                    onPress={() => {
                        log('fermer modal')
                        opacityFlou.set(withTiming(0, {duration:300}))
                        fermerModalBase()                  
                    }} 
                    style={s.overlayPressable}
                />                
            <Animated.View style={[flouAnime, s.blurBackdrop]} />         
            
            <Animated.View style={[modalAnime, s.sheetWrapper]}>                
                <GestureDetector gesture={panGesture}>  
                    <Pressable style={{flex:1} } onPress={() => {
                        Keyboard.dismiss()
                    }}>               
                    <View style={s.sheetContent}>   
                        <View style={s.dragHandleContainer}>
                            <View style={s.dragHandleWrapper}>
                                <BlurView tint="dark" intensity={70} style={s.dragHandle} />
                            </View>                        
                        </View>
                        {children}
                    </View>    
                </Pressable>             
                </GestureDetector>
                <LinearGradient
                    style={s.bottomGradient}
                    start={{x:0, y:1}}
                    end={{x:0, y:0}}
                    colors={[colors.card, 'transparent']}
                />
            </Animated.View>
            </KeyboardAvoidingView>
            {/* Fullscreen options */}
            {afficherBoutonFermer && (
            <Animated.View style={[optionsAgrandirAnime, s.optionsRow]}>
                <TouchableOpacity 
                        onPress={() => {
                            runDismissButtonAction()
                            fermerModalBase()
                        }}
                    style={[s.circleButtonBase, s.closeButton, {backgroundColor:dismissButton.bgColor}, dismissButton.style]}
                >
                        <Ionicons name={dismissButton.icon} size={40} color={colors.text} />
                </TouchableOpacity>
            </Animated.View>
            )}
            </View>
        </GestureHandlerRootView>
    )         
}