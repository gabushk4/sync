import Radius from "@/constants/Radius"
import { useEventDraft } from "@/contextes/contexteEventDraft"
import { useFont } from "@/contextes/contexteFont"
import { usePalette } from "@/contextes/contextePalette"

import { LinkAbs } from "@/abstractions/linkAbs"
import { checkMark } from "@/constants/dismissButtons"
import { withTimingConfig } from "@/constants/ReanimatedConfs"
import { useModal } from "@/contextes/contexteModals"
import { convertirTimestampDateCourte, convertirTimestampHeure } from "@/functions/convertirTimestamp"
import { Interval } from "@/types/availabilities"
import { DateTime } from "luxon"
import React, { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { FlatList, StyleSheet, Text, TextStyle, TouchableOpacity, View, ViewStyle } from "react-native"
import Animated, { useAnimatedStyle, withTiming } from "react-native-reanimated"

// Layout constants (module scope: they were re-declared on every render)
const SUGG_LINE_H = 32 + 16
const SUGG_TITLE_H = 40
const MAX_SUGG = 4
const DATA_RENDERER_KEY = "CommonSlotsSuggestions"

const staticStyles = StyleSheet.create({
    suggestionsContainer: {
        marginTop: 4,
        paddingTop: 8,
        overflow: 'scroll',
        width: '100%',
        alignItems: 'center',
    },
    lineWrapper: {
        marginTop: 8,
        paddingHorizontal: 8,
    },
    suggestionLine: {
        height: SUGG_LINE_H,
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        paddingHorizontal: 8,
        borderWidth: 1,
        borderRadius: Radius.xl,
    },
    linePast: { opacity: 0.4 },
    colDay:   { width: 64, alignItems: 'center' },
    colStart: { width: 88, alignItems: 'center' },
    colTo:    { width: 24, alignItems: 'center' },
    colEnd:   { flex: 1, alignItems: 'center' },
    text: {
        fontSize: 16,
        textAlign: 'center',
    },
    title: {
        fontSize: 20,
        width: '100%',
        textAlign: 'left',
        marginBottom: 4,
    },
    listWrapper: { marginBottom: 8, width: '100%' },
    showMore: { position: 'absolute', bottom: 0 },
    flex1: { flex: 1 },
})

type LineDyn = {
    line: ViewStyle
    lineSelected: ViewStyle
    text: TextStyle
}

type LineProps = {
    sugg: Interval
    selected: boolean
    onSelect: (sugg: Interval) => void
    dyn: LineDyn
}

/**
 * One suggested slot. Module-level and memoized: it used to be re-created as a NEW
 * component type whenever the selection changed (every line unmounted and remounted),
 * and it captured the colors of the render that created it (a theme change was not
 * reflected). Everything it needs now comes through its props.
 */
const LigneSuggestion = React.memo(function LigneSuggestion({ sugg, selected, onSelect, dyn }: LineProps) {
    if (!sugg) return null

    const now = DateTime.now()
    const today = now.startOf('day')
    const isPast = sugg.debut.toMillis() < now.toMillis()
    const sameDay = sugg.fin.startOf('day').diff(sugg.debut.startOf('day'), 'days').days < 1
    const sameWeekDebut = sugg.debut.startOf('day').diff(today, 'days').days < 7
    const sameWeekFin = sugg.fin.startOf('day').diff(today, 'days').days < 7

    return (
        <View style={staticStyles.lineWrapper}>
            <TouchableOpacity
                style={[
                    staticStyles.suggestionLine,
                    selected ? dyn.lineSelected : dyn.line,
                    isPast && staticStyles.linePast,
                ]}
                disabled={isPast}
                onPress={() => onSelect(sugg)}
            >
                <View style={staticStyles.colDay}>
                    <Text style={[staticStyles.text, dyn.text]}>
                        {sameWeekDebut ? sugg.debut.weekdayShort : convertirTimestampDateCourte(sugg.debut)}
                    </Text>
                </View>

                <View style={staticStyles.colStart}>
                    <Text style={[staticStyles.text, dyn.text]}>de {convertirTimestampHeure(sugg.debut)}</Text>
                </View>

                <View style={staticStyles.colTo}>
                    <Text style={[staticStyles.text, dyn.text]}>à</Text>
                </View>

                <View style={staticStyles.colEnd}>
                    <Text style={[staticStyles.text, dyn.text]} numberOfLines={1}>
                        {sameDay
                            ? convertirTimestampHeure(sugg.fin)
                            : `${sameWeekFin ? sugg.fin.weekdayShort : convertirTimestampDateCourte(sugg.fin)} ${convertirTimestampHeure(sugg.fin)}`}
                    </Text>
                </View>
            </TouchableOpacity>
        </View>
    )
})

export default function CommonSlotsSuggestions() {    
    const {t} = useTranslation()
    const { slotSuggestions, setStart, setEnd, start, end } = useEventDraft();
    const { setDataRendererContent, setDismissButton, removeDataRenderContent, resetDismissButton } = useModal();
    
    const { colors } = usePalette()
    const { fonts } = useFont()    

    const suggestionsCount = slotSuggestions.length
    // The list shows MAX_SUGG - 1 lines: "show more" must appear as soon as there are more
    // than that (it used to need > 4, so the 4th suggestion was unreachable).
    const hasMore = suggestionsCount > MAX_SUGG - 1

    const [suggSelected, setSuggSelected] = useState<string|undefined>()
    const orderedSuggestions = useMemo(() => {
        if (!suggSelected) return slotSuggestions
        return [...slotSuggestions].sort((a, b) => Number(b.id === suggSelected) - Number(a.id === suggSelected))
    }, [slotSuggestions, suggSelected])

    // Only what depends on the palette/fonts
    const dyn = useMemo(() => ({
        container: { borderColor: colors.border } as ViewStyle,
        line: { borderColor: colors.border, backgroundColor: 'transparent' } as ViewStyle,
        lineSelected: { borderColor: colors.border, backgroundColor: colors.border } as ViewStyle,
        text: { color: colors.text } as TextStyle,
        title: { fontFamily: fonts.body, color: colors.muted } as TextStyle,
    }), [colors.border, colors.text, colors.muted, fonts.body])

    const animatedSuggestions = useAnimatedStyle(() => (
        {
            height: withTiming(Math.min((suggestionsCount * SUGG_LINE_H + (suggestionsCount > 0 ? SUGG_LINE_H + SUGG_TITLE_H : 0)), SUGG_LINE_H * MAX_SUGG + SUGG_TITLE_H), withTimingConfig)        
        }
    ))

    // Stable (setStart/setEnd are stable in the context) so memoized lines aren't re-rendered
    const handleSelect = useCallback((sugg: Interval) => {
        if (sugg.debut.toMillis() < DateTime.now().toMillis()) return
        setSuggSelected(sugg.id)
        setStart(sugg.debut)
        setEnd(sugg.fin)
    }, [setStart, setEnd])

    const showMoreModal = useMemo(() => (
        <FlatList
            style={staticStyles.flex1}
            data={slotSuggestions}
            keyExtractor={(item, index) => `FL-${item.id}-${index}`}
            renderItem={({item}) => (
                <LigneSuggestion sugg={item} selected={item.id === suggSelected} onSelect={handleSelect} dyn={dyn} />
            )}
        />
    ), [suggSelected, slotSuggestions, handleSelect, dyn])

    // Registered in the modals context only when the "show more" link exists. It used to
    // be done on every opening of the form, even with no suggestion at all.
    useEffect(() => {
        if (!hasMore) return
        setDataRendererContent(DATA_RENDERER_KEY, showMoreModal)
        setDismissButton(checkMark(colors))   
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasMore, showMoreModal])

    // Released when the link goes away, or on unmount
    useEffect(() => {
        if (!hasMore) return
        return () => {
            removeDataRenderContent(DATA_RENDERER_KEY)
            resetDismissButton()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasMore])


    // The start / end were moved outside the picked suggestion: it's no longer picked.
    // Done during the render (not in an effect, which drew the old selection once more
    // before clearing it); the condition stops it once cleared.
    const suggCourante = suggSelected ? slotSuggestions.find(sugg => sugg.id === suggSelected) : undefined
    if (suggCourante && (start.toMillis() < suggCourante.debut.toMillis() || end.toMillis() > suggCourante.fin.toMillis())) {
        setSuggSelected(undefined)
    }
        
    return (
        <Animated.View style={[staticStyles.suggestionsContainer, dyn.container, {borderTopWidth: suggestionsCount > 0 ? 1 : 0}, animatedSuggestions]}>
            {suggestionsCount > 0 && 
                <Text style={[staticStyles.title, dyn.title]}>suggestions - { suggestionsCount}</Text>
            }
            <View style={staticStyles.listWrapper}>
            {orderedSuggestions.slice(0, MAX_SUGG - 1).map((sugg) => (
                <LigneSuggestion
                    key={sugg.id}
                    sugg={sugg}
                    selected={sugg.id === suggSelected}
                    onSelect={handleSelect}
                    dyn={dyn}
                />
            ))}
            </View>
            {hasMore &&
                <LinkAbs href={{pathname: "/(modals)/dataRenderer", params:{ key: DATA_RENDERER_KEY}}} style={staticStyles.showMore}>
                    {t('common:showMore')}
                </LinkAbs> 
            }
            
        </Animated.View>
    )
}