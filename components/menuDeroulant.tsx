import { useFont } from '@/contextes/contexteFont'
import { usePalette } from '@/contextes/contextePalette'
import { Recurrence } from '@/types/calendar'
import Icon from "@react-native-vector-icons/ionicons"
import { Picker } from '@react-native-picker/picker'
import React, { useCallback, useMemo, useRef, useState } from 'react'
import { FlatList, Modal, Platform, Pressable, StyleSheet, Text, TextStyle, TouchableOpacity, TouchableWithoutFeedback, View, ViewProps } from 'react-native'
import Animated, { createAnimatedComponent, Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'

type Props = {
  values: Recurrence[]
  selected: Recurrence | { value: string | null }
  onSelection: (val: string | null) => void
  disabled: boolean
  style?: ViewProps['style']
}

// Created once, outside the component (inside, it was a new component on every render)
const AnimatedPressable = createAnimatedComponent(Pressable)

// Layout constants (real constants: they used to be read back from StyleSheet.create)
const CHEVRON_SIZE = 20
const ITEM_HEIGHT = 40
const ITEM_NUMBER = 4
const TRIGGER_PADDING = 8
const TRIGGER_BORDER = 1
const TRIGGER_GAP = 16
const DEFAULT_TRIGGER_WIDTH = 96
const LIST_MAX_HEIGHT = ITEM_HEIGHT * ITEM_NUMBER + ITEM_HEIGHT / 2
const ANIM_DURATION = 300

// Static styles: created once at module scope
const staticStyles = StyleSheet.create({
  trigger: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: TRIGGER_PADDING,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: TRIGGER_BORDER,
    width: 'auto',
    alignSelf: 'flex-end',
    gap: TRIGGER_GAP,
  },
  triggerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  triggerRowIOS: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  triggerDisabled: {
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  androidTriggerContainer: {
    flex: 1,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayBottom: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  overlayAndroid: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  sheetContainer: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  pickerIOS: {
    marginTop: -24,
    marginBottom: 48,
  },
  androidItemList: {
    position: 'absolute',
    overflow: 'hidden',
  },
  item: {
    padding: TRIGGER_PADDING,
    height: ITEM_HEIGHT,
  },
})

// Real item height is ITEM_HEIGHT (RN is border-box, padding is included).
// It used to be computed as height + padding * 2 = 56, which made every offset wrong.
const getItemLayout = (_: unknown, index: number) => ({
  length: ITEM_HEIGHT,
  offset: ITEM_HEIGHT * index,
  index,
})

const keyExtractor = (item: Recurrence) => item.value ?? item.title

// ───────────────────────────── iOS ─────────────────────────────

function MenuDeroulantIOS({ values, selected, onSelection, disabled, style }: Props) {
  const { colors } = usePalette()
  const { fonts } = useFont()

  const [visible, setVisible] = useState(false)

  // Controlled: derived from the prop (no duplicated state to resynchronise)
  const selectedValue = selected.value

  const dyn = useMemo(() => ({
    trigger: { backgroundColor: colors.primary, borderColor: colors.border },
    triggerBase: { borderColor: colors.border },
    text: {
      fontSize: disabled ? 18 : 16,
      color: colors.text,
      maxWidth: '90%',
      fontFamily: fonts.body,
    } as TextStyle,
    sheet: { backgroundColor: colors.primary },
  }), [colors.primary, colors.border, colors.text, fonts.body, disabled])

  const title = useMemo(
    () => values.find((v) => v.value === selectedValue)?.title,
    [values, selectedValue]
  )

  const pickerItems = useMemo(
    () => values.map((v) => (
      <Picker.Item key={v.value ?? v.title} label={v.title} value={v.value} color={colors.text} />
    )),
    [values, colors.text]
  )

  const open = useCallback(() => setVisible(true), [])
  const close = useCallback(() => setVisible(false), [])
  const handleChange = useCallback((newVal: unknown) => {
    onSelection(newVal as string | null)
    setVisible(false)
  }, [onSelection])

  return (
    <View style={style}>
      <TouchableOpacity
        style={[
          staticStyles.trigger,
          dyn.triggerBase,
          disabled ? staticStyles.triggerDisabled : [staticStyles.triggerRowIOS, dyn.trigger],
        ]}
        onPress={open}
        disabled={disabled}
      >
        <Text numberOfLines={1} style={dyn.text}>{title}</Text>
        {!disabled &&
          <Icon name={visible ? 'chevron-down' : 'chevron-forward'} color={colors.muted} />
        }
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
        <TouchableOpacity onPress={close} style={staticStyles.overlayBottom}>
          <TouchableWithoutFeedback>
            <View style={[staticStyles.sheetContainer, dyn.sheet]}>
              <Picker
                style={staticStyles.pickerIOS as any}
                selectedValue={selectedValue}
                numberOfLines={1}
                onValueChange={handleChange}
                selectionColor={colors.primary}
              >
                {pickerItems}
              </Picker>
            </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>
    </View>
  )
}

// ──────────────────────────── Android ────────────────────────────

type Anchor = { left: number; top: number; width: number }

function MenuDeroulantAndroid({ values, selected, onSelection, style }: Props) {
  const { colors } = usePalette()

  const triggerRef = useRef<View>(null)
  // Needed only when opening, not for rendering: refs, no re-render
  const triggerHeight = useRef(0)
  const triggerWidth = useRef(DEFAULT_TRIGGER_WIDTH)
  const closing = useRef(false)

  // One state for position + visibility. null = closed (Modal unmounted).
  const [anchor, setAnchor] = useState<Anchor | null>(null)

  const selectedValue = selected.value

  const listHeight = useSharedValue(0)
  const listOpacity = useSharedValue(0)

  const listAnimated = useAnimatedStyle(() => ({
    height: listHeight.get(),
    opacity: listOpacity.get(),
  }))
  const overlayAnimated = useAnimatedStyle(() => ({
    opacity: listOpacity.get(),
  }))

  const dyn = useMemo(() => ({
    trigger: { borderColor: colors.border },
    list: { backgroundColor: colors.primary },
    text: { fontSize: 16, color: colors.text, maxWidth: '90%' } as TextStyle,
    textSelected: { fontSize: 16, color: colors.primary, maxWidth: '90%' } as TextStyle,
    itemSelected: { backgroundColor: colors.secondary },
  }), [colors.border, colors.primary, colors.secondary, colors.text])

  const title = useMemo(
    () => values.find((v) => v.value === selectedValue)?.title,
    [values, selectedValue]
  )

  // -1 (value not found) would crash scrollToIndex / initialScrollIndex
  const selectedIndex = useMemo(
    () => Math.max(0, values.findIndex((v) => v.value === selectedValue)),
    [values, selectedValue]
  )

  // Don't leave an empty gap when there are fewer items than the max height
  const targetHeight = Math.min(values.length * ITEM_HEIGHT, LIST_MAX_HEIGHT)

  const open = useCallback(() => {
    triggerRef.current?.measure((_x, _y, _w, _h, pX, pY) => {
      closing.current = false
      listHeight.set(withTiming(targetHeight, { duration: ANIM_DURATION, easing: Easing.in(Easing.ease) }))
      listOpacity.set(withTiming(1, { duration: ANIM_DURATION, easing: Easing.in(Easing.ease) }))
      setAnchor({
        left: pX,
        top: pY - triggerHeight.current - TRIGGER_PADDING - TRIGGER_BORDER,
        width: triggerWidth.current - (CHEVRON_SIZE + TRIGGER_GAP / 2) - TRIGGER_PADDING,
      })
    })
  }, [listHeight, listOpacity, targetHeight])

  const unmount = useCallback(() => setAnchor(null), [])

  const close = useCallback(() => {
    if (closing.current) return
    closing.current = true
    listOpacity.set(withTiming(0, { duration: ANIM_DURATION, easing: Easing.out(Easing.ease) }))
    // Unmount only once the animation is really finished
    // (replaces the setTimeout(180) that cut the 300 ms animation short)
    listHeight.set(withTiming(0, { duration: ANIM_DURATION, easing: Easing.out(Easing.ease) }, (finished) => {
      if (finished) runOnJS(unmount)()
    }))
  }, [listHeight, listOpacity, unmount])

  const handleSelect = useCallback((value: string | null) => {
    onSelection(value)
    close()
  }, [onSelection, close])

  const renderItem = useCallback(({ item }: { item: Recurrence }) => {
    const isSelected = item.value === selectedValue
    return (
      <TouchableOpacity
        style={isSelected ? [staticStyles.item, dyn.itemSelected] : staticStyles.item}
        onPress={() => handleSelect(item.value)}
      >
        <Text style={isSelected ? dyn.textSelected : dyn.text} ellipsizeMode='tail' numberOfLines={1}>
          {item.title}
        </Text>
      </TouchableOpacity>
    )
  }, [selectedValue, dyn, handleSelect])

  return (
    <View style={[staticStyles.androidTriggerContainer, style]}>
      <TouchableOpacity
        ref={triggerRef}
        style={[staticStyles.trigger, staticStyles.triggerRow, dyn.trigger]}
        onPress={open}
        onLayout={(e) => {
          triggerHeight.current = e.nativeEvent.layout.height
          triggerWidth.current = e.nativeEvent.layout.width
        }}
      >
        <Text style={dyn.text}>{title}</Text>
        <Icon name='chevron-down' color={colors.muted} size={CHEVRON_SIZE} />
      </TouchableOpacity>

      <Modal
        visible={anchor !== null}
        onRequestClose={close}
        animationType='none'
        transparent={true}
      >
        {anchor && (
          <AnimatedPressable style={[staticStyles.overlayAndroid, overlayAnimated]} onPress={close}>
            <Animated.View
              style={[
                staticStyles.androidItemList,
                dyn.list,
                listAnimated,
                { top: anchor.top, left: anchor.left, width: anchor.width },
              ]}
            >
              <FlatList
                // Mounted only while open, so the initial scroll works
                // (scrollToIndex used to run on a FlatList that did not exist yet).
                initialScrollIndex={selectedIndex}
                getItemLayout={getItemLayout}
                showsVerticalScrollIndicator={false}
                data={values}
                extraData={selectedValue}
                keyExtractor={keyExtractor}
                renderItem={renderItem}
              />
            </Animated.View>
          </AnimatedPressable>
        )}
      </Modal>
    </View>
  )
}

// ─────────────────────────── Entry point ───────────────────────────

function MenuDeroulant(props: Props) {
  // Platform.OS is constant: each platform only mounts (and pays for) its own hooks
  return Platform.OS === 'ios'
    ? <MenuDeroulantIOS {...props} />
    : <MenuDeroulantAndroid {...props} />
}

// The parent must pass a stable `onSelection` (useCallback) for memo to be effective.
export default React.memo(MenuDeroulant)