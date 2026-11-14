import { ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { GestureDetector } from 'react-native-gesture-handler'
import Animated from 'react-native-reanimated'

import { useFont } from '@/contextes/contexteFont'
import { usePalette } from '@/contextes/contextePalette'
import useSelectionGlissee, { ParamsSelectionGlissee } from '@/hooks/useSelectionGlissee'

type Props = ParamsSelectionGlissee & {
    /** The row's blocks the selection is made over (drawn under the highlight). */
    children?: ReactNode
}

/**
 * A timeline row's background where a range is picked by hold & drag
 * (useSelectionGlissee): the gesture over the whole row, its blocks (children), and the
 * range being picked, outlined in the theme's color with its start and end hours (against
 * the end following the finger). Holds the drag's state itself, so a step of the drag
 * only re-renders this, not the screen.
 * Used by the home screen's free blocks (TrousHoraire, 15 minutes) and the member's
 * common availabilities in the invitation review (5 minutes).
 *
 * @author Philip — taken out of TrousHoraire (user story 20), shared with the invitation review
 * @param {Props} props
 * @returns {JSX.Element}
 */
export default function SelectionGlissee({ children, ...params }: Props) {
    const { colors } = usePalette()
    const { fonts } = useFont()
    const { geste, styleSelection, styleEtiquette, etiquette } = useSelectionGlissee(params)

    const s = StyleSheet.create({
        selection: {
            position: 'absolute',
            top: 0,
            bottom: 0,
            borderRadius: 12,
            borderWidth: 2,
            borderColor: colors.secondary,
            backgroundColor: colors.primary,
            overflow: 'hidden',
        },
        etiquette: {
            position: 'absolute',
            top: 0,
            bottom: 0,
            justifyContent: 'center',
        },
        texteSelection: {
            color: colors.text,
            fontFamily: fonts.number,
            fontSize: 12,
            textAlign: 'center',
            paddingHorizontal: 2,
        },
    })

    return (
        <GestureDetector gesture={geste}>
            <View style={StyleSheet.absoluteFill}>
                {children}
                <Animated.View style={[s.selection, styleSelection]} pointerEvents="none">
                    <Animated.View style={[s.etiquette, styleEtiquette]}>
                        <Text style={s.texteSelection} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                            {etiquette}
                        </Text>
                    </Animated.View>
                </Animated.View>
            </View>
        </GestureDetector>
    )
}
