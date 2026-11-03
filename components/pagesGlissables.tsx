import React, { useRef, useState } from 'react'
import { Dimensions, Keyboard, LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent, StyleSheet, TouchableOpacity, View } from 'react-native'
import { ScrollView } from 'react-native-gesture-handler'
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated'

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

/**
 * Pages side by side, reached by a horizontal swipe or by their tab on top: the same
 * look and feel as the "add a friend" modal (titles, highlight sliding under them,
 * light haptic on a tab, snapping swipe). Every page stays mounted, so a form keeps
 * what was typed when coming back to it.
 *
 * @author Philip — user story 20
 * @author Philip — user story 20 (review): "add a friend" uses it too (`integre`), so
 *   both screens share one implementation instead of two copies
 * @param {Props} props
 * @returns {JSX.Element}
 */
export default function PagesGlissables({ pages, pageInitiale = 0, onChangerPage, integre = false }: Props) {
    const { colors } = usePalette()
    const { fonts } = useFont()

    const scrollViewRef = useRef<ScrollView>(null)
    const pageRef = useRef(pageInitiale)
    const [largeurPage, setLargeurPage] = useState(Dimensions.get('window').width)

    const contentOffset = useSharedValue(pageInitiale * largeurPage)
    const largeurPageSV = useSharedValue(largeurPage)
    const largeurOngletsSV = useSharedValue(0)

    // Read outside the worklet: capturing `pages` (React elements) would make
    // Reanimated copy them to the UI thread, which it can't.
    const nbPages = pages.length

    // The highlight follows the swipe: page offset scaled to the tabs' row.
    const animatedTab = useAnimatedStyle(() => {
        const progres = largeurPageSV.value > 0 ? contentOffset.value / largeurPageSV.value : 0
        const borne = Math.min(Math.max(progres, 0), nbPages - 1)
        return { transform: [{ translateX: borne * (largeurOngletsSV.value / nbPages) }] }
    })

    const s = StyleSheet.create({
        onglets: {
            position: 'relative',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            marginHorizontal: integre ? 0 : 20,
            marginTop: integre ? 0 : 12,
            marginBottom: 8,
        },
        onglet: {
            width: `${100 / pages.length}%`,
        },
        title: {
            color: colors.text,
            fontSize: 20,
            letterSpacing: 0.7,
            fontFamily: fonts.title,
            textAlign: 'center',
        },
        tab: {
            position: 'absolute',
            backgroundColor: colors.secondary,
            opacity: 0.5,
            width: `${100 / pages.length}%`,
            height: '112%',
            borderRadius: 16,
            left: 0,
        },
    })

    const changerPage = (index: number) => {
        if (index === pageRef.current) return
        pageRef.current = index
        Keyboard.dismiss()
        onChangerPage?.(index)
    }

    const allerA = (index: number) => {
        Haptics.clickLeger()
        scrollViewRef.current?.scrollTo({ x: largeurPage * index })
        changerPage(index)
    }

    const onLayoutPages = (e: LayoutChangeEvent) => {
        const largeur = e.nativeEvent.layout.width
        if (largeur <= 0) return
        largeurPageSV.value = largeur
        setLargeurPage(largeur)
        // Keeps the current page in view (first layout: the initial page).
        scrollViewRef.current?.scrollTo({ x: largeur * pageRef.current, animated: false })
    }

    const onFinDefilement = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        changerPage(Math.round(e.nativeEvent.contentOffset.x / largeurPage))
    }

    return (
        <View style={{ flex: 1 }}>
            <View
                style={s.onglets}
                onLayout={(e) => { largeurOngletsSV.value = e.nativeEvent.layout.width }}
            >
                <Animated.View style={[s.tab, animatedTab]} />
                {pages.map((p, index) =>
                    <TouchableOpacity
                        key={'tab' + p.id}
                        style={s.onglet}
                        onPress={() => allerA(index)}
                        accessibilityRole="tab"
                    >
                        <Animated.Text style={s.title}>{p.titre}</Animated.Text>
                    </TouchableOpacity>
                )}
            </View>
            <ScrollView
                ref={scrollViewRef}
                horizontal={true}
                style={{ flex: 1 }}
                onLayout={onLayoutPages}
                snapToInterval={largeurPage}
                decelerationRate={'fast'}
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                scrollEventThrottle={16}
                onScroll={(e) => {
                    contentOffset.value = e.nativeEvent.contentOffset.x
                }}
                onMomentumScrollEnd={onFinDefilement}
            >
                {pages.map((p) =>
                    <View key={p.id} style={{ width: largeurPage, flex: 1 }}>
                        {p.contenu}
                    </View>
                )}
            </ScrollView>
        </View>
    )
}
