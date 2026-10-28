import { usePalette } from '@/contextes/contextePalette'
import { useTimeline } from '@/contextes/contexteTimeline'
import { BlurView } from 'expo-blur'
import { DateTime } from 'luxon'
import React from 'react'
import { StyleSheet, View } from 'react-native'

import { Event } from '@/types/calendar'


type Props = {
  event: Event
  blockColor?: string
  displayDate?: DateTime
  timezone?: string
  horizontal?: boolean
  /** Clipped length computed by the parent timeline item. */
  size?: number
}

/**
 * Background of one event on a timeline row: a blurred, rounded block (Gabriel's
 * style for the home screen), sized from the event's start/end on the displayed day.
 *
 * @param {Props} props
 * @param {Event} props.event - Event to draw.
 * @param {string} [props.blockColor] - Block color (member's row); translucent when omitted.
 * @param {DateTime} [props.displayDate] - Day the row shows.
 * @param {boolean} [props.horizontal=false] - Hours laid out left to right.
 * @returns {JSX.Element}
 */
export default function EventBloc({ event, blockColor, displayDate, horizontal = false, size } : Props) {
  const { pxHeures, L_HEURES, H_HEURES } = useTimeline() as any
  const { colors } = usePalette() 
  
  //log('event bloc displayed date', displayDate, event)

  // largeur/hauteur calculée
  const heureOffset = horizontal ? pxHeures + L_HEURES : pxHeures + H_HEURES
  const eventSize = size ?? Math.max(0, ((event.fin?.toMillis?.() ?? 0) - (event.debut?.toMillis?.() ?? 0)) / 3600000 * heureOffset)

  const backgroundColor = blockColor
  
  const s = StyleSheet.create({
      container: {
          minWidth: horizontal ? L_HEURES : H_HEURES,
          alignItems: 'center',
      justifyContent: 'center',
          backgroundColor:colors.card
      },
      innerStyle: {
          ...(horizontal
              ? { width: eventSize }
              : { height: eventSize }
          )
      }
  })

  return (
    <View style={[s.container, s.innerStyle]}>
      <BlurView
        intensity={40}
        tint="default"
        style={[
          {
            height: '100%',
            borderRadius: 12,
            borderColor: colors.border,
            backgroundColor,
            borderWidth: 1,
            overflow: 'hidden',
            padding: 4,
          },
          s.innerStyle,
        ]}
      />
    </View>
  )
}
