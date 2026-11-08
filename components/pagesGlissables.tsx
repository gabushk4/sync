/**
 * @author Philip Kvaratsheyla
 * 
 * Refactorisation US 36
 * 8 novembre 2026
 * Pour rendre les onglets scrollable sil le faut 
 * @author Gabriel P Levesque
 */

import React, { useRef, useState } from 'react'
import { Dimensions, Keyboard, LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent, StyleSheet, TouchableOpacity, View } from 'react-native'
import { ScrollView } from 'react-native-gesture-handler'
import Animated, { useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, useDerivedValue, interpolate, Extrapolation } from 'react-native-reanimated'

import Haptics from '@/abstractions/haptics'
import { useFont } from '@/contextes/contexteFont'
import { usePalette } from '@/contextes/contextePalette'

export type PageGlissable = {
    id: string
    titre: string
    contenu: React.ReactNode
}

type Props = {
    pages: PageGlissable[]
    /** Index of the page shown first. */
    pageInitiale?: number
    /** Called when another page becomes the current one (swipe or tab). */
    onChangerPage?: (index: number) => void
    /** Inside a modal that already has its padding (ModalBase): no margins of its own. */
    integre?: boolean
}

const HAUTEUR_BARRE_ONGLETS = 44
const HAUTEUR_INDICATEUR = 30
const AnimatedGestureScrollView = Animated.createAnimatedComponent(ScrollView)
const {width: SCREEN_W} = Dimensions.get("window")

/**
 * Affiche les onglets et les pages, avec un indicateur qui suit le swipe.
 */
export default function PagesGlissables({ pages, pageInitiale = 0, onChangerPage, integre = false }: Props) {
    const { colors } = usePalette()
    const { fonts } = useFont()

    const scrollViewRef = useRef<ScrollView>(null)
    const ongletsScrollViewRef = useRef<ScrollView>(null)
    const pageRef = useRef(pageInitiale)

    const contentOffset = useSharedValue(pageInitiale * SCREEN_W)

    // Largeur totale des onglets et largeur visible de la ScrollView (mesurées après layout)
    const largeurContenuOnglets = useSharedValue(0)
    const largeurViewportOnglets = useSharedValue(0)

    const [mesuresInitiales] = useState(() => pages.map(() => ({ x: 0, w: 0 })))
    const mesuresOngletsRef = useRef(mesuresInitiales)
    const inputRange = useSharedValue(mesuresInitiales.map((_, index) => index * SCREEN_W))
    const outputRangeX = useSharedValue(mesuresInitiales.map(({ x }) => x))
    const outputRangeW = useSharedValue(mesuresInitiales.map(({ w }) => w))

    /**
     * Met à jour les plages d'interpolation à chaque changement de layout.
     */
    const publierPlagesOnglets = (mesures: { x: number; w: number }[], largeur: number) => {
        const nombreMesures = Math.min(pages.length, mesures.length)
        const mesuresUtiles = mesures.slice(0, nombreMesures)
        inputRange.value = mesuresUtiles.map((_, index) => index * largeur)
        outputRangeX.value = mesuresUtiles.map(({ x }) => x)
        outputRangeW.value = mesuresUtiles.map(({ w }) => w)
    }

    // Indicateur animé : position + largeur réelles de l'onglet actif
    const animatedTab = useAnimatedStyle(() => {
        // L'offset des pages pilote en continu la position et la largeur de l'indicateur.
        const rangeEntree = inputRange.value
        const rangeX = outputRangeX.value
        const rangeW = outputRangeW.value
        const nombreMesures = Math.min(rangeEntree.length, rangeX.length, rangeW.length)
        if (nombreMesures === 0) {
            return { transform: [{ translateX: 0 }], width: 0 }
        }

        if (nombreMesures === 1) {
            return { transform: [{ translateX: rangeX[0] }], width: rangeW[0] }
        }

        return {
            transform: [{
                translateX: interpolate(
                    contentOffset.value,
                    rangeEntree,
                    rangeX,
                    Extrapolation.CLAMP,
                ),
            }],
            width: interpolate(
                contentOffset.value,
                rangeEntree,
                rangeW,
                Extrapolation.CLAMP,
            ),
        }
    })

    // Rétro-compat : on ne scroll les onglets que si leur contenu dépasse le viewport
    const doitScroller = useDerivedValue(() => largeurContenuOnglets.value > largeurViewportOnglets.value)
    // Le handler tourne sur le thread UI, ce qui garde l'animation fluide pendant le swipe.
    const onScroll = useAnimatedScrollHandler({
        onScroll: (event) => {
            contentOffset.set(event.contentOffset.x)
        },
    })


    const s = StyleSheet.create({
        conteneur: { flex: 1, width:SCREEN_W},
        onglets: {
            maxWidth: SCREEN_W,
            marginHorizontal: integre ? 0 : 20,
            marginTop: integre ? 0 : 12,
            marginBottom: 8,
            maxHeight: HAUTEUR_BARRE_ONGLETS,
            overflow: 'hidden',
            borderBottomWidth:1,
            borderBottomColor: colors.border
        },
        ongletsContent: {
            width:SCREEN_W,            
            height: HAUTEUR_BARRE_ONGLETS,
            alignItems: 'center',
            flexDirection: 'row',
            overflow: 'hidden',
        },
        onglet: {
            paddingHorizontal: 14,
            paddingVertical: 4,
            maxHeight: HAUTEUR_INDICATEUR,
        },
        title: {
            color: colors.text,
            fontSize: 16,
            letterSpacing: 0.4,
            fontFamily: fonts.title,
            textAlign: 'center',
        },
        tab: {
            position: 'absolute',
            bottom: 6,
            backgroundColor: colors.secondary,
            opacity: 0.9,
            borderRadius: 8,
            left: 0,
            height: HAUTEUR_INDICATEUR,
        },
    })

    /**
     * Décale la barre pour amener l'onglet actif dans la zone visible.
     */
    const scrollOnglets = ()=> {
        const x = interpolate(
                    contentOffset.value,
                    inputRange.value,
                    outputRangeX.value,
                    Extrapolation.CLAMP,
                )
        
        ongletsScrollViewRef.current?.scrollTo({x:x, animated:true})
    }
    
    /**
     * Synchronise l'index actif et avertit le parent si la page a changé.
     */
    const changerPage = (index: number) => {
        if (index === pageRef.current) return
        pageRef.current = index
        Keyboard.dismiss()
        
        const currentOnglet = mesuresInitiales[index]
        if(currentOnglet.x + currentOnglet.w > largeurViewportOnglets.value)
            scrollOnglets()
        onChangerPage?.(index)
    }

    /**
     * Passe à la page choisie depuis un onglet.
     */
    const allerA = (index: number) => {
        Haptics.clickLeger()
        scrollViewRef.current?.scrollTo({ x: SCREEN_W * index })
        changerPage(index)
    }

    /**
     * Enregistre la largeur visible de la barre d'onglets.
     */
    const onLayoutOngletsViewport = (e: LayoutChangeEvent) => {
        const w = e.nativeEvent.layout.width
        if (w > 0) largeurViewportOnglets.value = w
    }

    /**
     * Enregistre la position et la largeur d'un onglet après son layout.
     */
    const onLayoutOnglet = (index: number) => (e: LayoutChangeEvent) => {
        const { x, width } = e.nativeEvent.layout
        // Chaque layout complète la dernière liste de mesures avant de republier les plages.
        const mesures = mesuresOngletsRef.current.slice(0, pages.length)
        while (mesures.length < pages.length) mesures.push({ x: 0, w: 0 })
        mesures[index] = { x, w: width }
        mesuresOngletsRef.current = mesures
        publierPlagesOnglets(mesures, SCREEN_W)
    }

    /**
     * Calibre la largeur des pages et replace le scroll sur la page active.
     */
    const onLayoutPages = (e: LayoutChangeEvent) => {
        const largeur = e.nativeEvent.layout.width
        if (largeur <= 0) return
        publierPlagesOnglets(mesuresOngletsRef.current, largeur)
        scrollViewRef.current?.scrollTo({ x: largeur * pageRef.current, animated: false })
    }

    /**
     * Met à jour l'index actif quand le swipe s'arrête.
     */
    const onFinDefilement = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        changerPage(Math.round(e.nativeEvent.contentOffset.x / SCREEN_W))
    }

    return (
        <View style={s.conteneur}>
            <ScrollView
                ref={ongletsScrollViewRef}
                horizontal={true}
                showsHorizontalScrollIndicator={false}
                scrollEnabled={doitScroller.value}
                style={s.onglets}
                contentContainerStyle={s.ongletsContent}
                onLayout={onLayoutOngletsViewport}
                onContentSizeChange={(contentWidth) => {
                    if (contentWidth > 0) largeurContenuOnglets.value = contentWidth
                }}
            >
                <Animated.View style={[s.tab, animatedTab]} />
                {pages.map((p, index) =>
                    <TouchableOpacity
                        key={'tab' + p.id}
                        style={s.onglet}
                        onPress={() => allerA(index)}
                        accessibilityRole="tab"
                        onLayout={onLayoutOnglet(index)}
                    >
                        <Animated.Text style={s.title}>{p.titre}</Animated.Text>
                    </TouchableOpacity>
                )}
            </ScrollView>
            <AnimatedGestureScrollView
                ref={scrollViewRef}
                horizontal={true}
                style={{ flex: 1 }}
                onLayout={onLayoutPages}
                snapToInterval={SCREEN_W}
                decelerationRate={'fast'}
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                scrollEventThrottle={16}
                onScroll={onScroll}
                onMomentumScrollEnd={onFinDefilement}
            >
                {pages.map((p) =>
                    <View key={p.id} style={{ width: SCREEN_W, flex: 1 }}>
                        {p.contenu}
                    </View>
                )}
            </AnimatedGestureScrollView>
        </View>
    )
}
