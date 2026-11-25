import { SharedValue, useAnimatedStyle, useDerivedValue } from 'react-native-reanimated'

type Axis = 'x' | 'y'

type Params = {
    axis: Axis
    itemOffset: number
    itemSize: number
    labelSize: number
    listOffset: SharedValue<number>
    inset: number
    centerThreshold?: number
    timelineLength?: number
}

/**
 * Position of an event's / free slot's label while the rows scroll: it sticks to the
 * visible edge, stays inside its block, and is centered on short blocks.
 *
 * Same signature and same result as before, but cheaper on every frame of a drag:
 *
 * - The position is a DERIVED VALUE, and the animated style reads it. A shared value only
 *   wakes up what depends on it when it really changes. Before, each item's useAnimatedStyle
 *   ran on every frame and returned a new `{ transform: [...] }` object, which counts as a
 *   change even when the number inside is the same: every item sent a native update on
 *   every frame, including those far off screen. Now only the labels that actually move
 *   (the ones stuck to the left edge, about one per row) update the native view.
 * - Everything that doesn't depend on the scroll (centered position, max position, whether
 *   the label is centered or sticky at all) is computed once per render, not on every frame.
 * - It no longer reads `clampOffset` from the scroll context: the final clamp of `position`
 *   already bounds the result, so clamping the offset first changed nothing, and the item
 *   no longer depends on a function the provider re-creates on each of its renders.
 */
export default function useTimelineLabelOffset({
    axis,
    itemOffset,
    itemSize,
    labelSize,
    listOffset,
    inset,
    centerThreshold = labelSize + 2 * inset,
    timelineLength,
}: Params) {
    const centered = (itemSize - labelSize) / 2
    const maxWithinItem = itemSize - labelSize - inset
    const maxWithinTimeline = timelineLength === undefined
        ? maxWithinItem
        : timelineLength - itemOffset - labelSize - inset
    const maxPosition = Math.min(maxWithinItem, maxWithinTimeline)
    // Short block (or no room to slide): the label never moves.
    const fixe = itemSize < centerThreshold || maxPosition < inset

    const position = useDerivedValue(() => {
        if (fixe) return centered
        const desired = listOffset.get() - itemOffset + inset
        return Math.min(Math.max(desired, inset), maxPosition)
    })

    return useAnimatedStyle(() => (
        axis === 'x'
            ? { transform: [{ translateX: position.get() }] }
            : { transform: [{ translateY: position.get() }] }
    ))
}