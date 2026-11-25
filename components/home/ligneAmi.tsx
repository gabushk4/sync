import Ionicons from '@react-native-vector-icons/ionicons'
import { router } from 'expo-router'
import { DateTime } from 'luxon'
import React, { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, TouchableOpacity, View } from 'react-native'

import { RETRAIT_RANGEE } from '@/components/eventsList'
import FreeSlotItem from '@/components/freeSlotItem'
import ListItem from '@/components/listItem'
import PfpWithAvailability from '@/components/pfpWithAvailability'
import { JOURS_FENETRE, LIST_HEIGHT, WIDTH_COL } from '@/constants/Timeline'
import { useGestionScroll } from '@/contextes/contexteGestionListes'
import { usePalette } from '@/contextes/contextePalette'
import { useTimeline } from '@/contextes/contexteTimeline'

const styles = StyleSheet.create({
    // Photo column: one cell per friend, as tall as the friend's timeline row.
    cellulePhoto: {
        width: WIDTH_COL,
        height: LIST_HEIGHT,
        marginBottom: 4,
    },
    // Inset like the row's blocks.
    colonneAmi: {
        width: '100%',
        height: '100%',
        paddingVertical: RETRAIT_RANGEE,
    },
    // Transparent: blends with the timeline behind it (the screen's background).
    photoAmi: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
        overflow: 'hidden',
    },
    badgeProche: {
        position: 'absolute',
        top: 5,
        right: 5,
        width: 24,
        height: 24,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
        borderWidth: 1,
    },
    // One friend's timeline: same height and gap as its photo cell, inset like it was.
    rangee: {
        height: LIST_HEIGHT,
        marginBottom: 4,
        paddingVertical: RETRAIT_RANGEE,
    },
})

type PhotoProps = {
    friend: any
}

/**
 * A friend's photo cell (opens their profile). Memoized: redrawn only when the friend changes.
 */
function PhotoAmiImpl({ friend }: PhotoProps) {
    const { t } = useTranslation('home')
    const { colors } = usePalette()

    const ouvrirProfil = useCallback(() => {
        router.push({ pathname: '/(tabs)/home/profil/[membreId]', params: { membreId: friend.id } })
    }, [friend.id])

    const badge = useMemo(
        () => ({ borderColor: colors.warning, backgroundColor: colors.card }),
        [colors.warning, colors.card]
    )

    return (
        <View style={styles.cellulePhoto}>
            {/* Same band as the row's events/free slots (RETRAIT_RANGEE above and below,
                rounded like the blocks) so the photo lines up with them. */}
            <TouchableOpacity
                style={styles.colonneAmi}
                accessibilityRole="button"
                accessibilityLabel={t('viewFriendProfile', { name: friend.pseudo })}
                onPress={ouvrirProfil}
            >
                <View style={styles.photoAmi}>
                    <PfpWithAvailability pfp={friend.fp_url} size={64} statut={friend.statut_disponibilite} />
                    {!!friend.proche && (
                        <View accessibilityLabel={t('closeFriendBadge')} style={[styles.badgeProche, badge]}>
                            <Ionicons name="star" size={14} color={colors.warning} />
                        </View>
                    )}
                </View>
            </TouchableOpacity>
        </View>
    )
}
export const PhotoAmi = React.memo(PhotoAmiImpl)

type RangeeProps = {
    friend: any
    commonFreeSlots: any[]
    windowStart: DateTime
}

/**
 * A friend's timeline row: their events and the free slots shared with the member.
 *
 * It is NOT a ScrollView: every row sits in ONE layer that the list translates with the
 * shared offset (see ListeAmis). Before, each row was a ScrollView driven by its own
 * scrollTo on every frame of a drag (one native command per row), and a row that wasn't
 * on screen would have had to be put back at the right offset when it came into view.
 * Now there is one transform for all of them, so every row is always at the right place.
 */
function RangeeAmiImpl({ friend, commonFreeSlots, windowStart }: RangeeProps) {
    const { offset } = useGestionScroll()
    const { pxHeures, L_HEURES } = useTimeline()
    const events: any[] = friend.evenements ?? []

    return (
        <View style={styles.rangee}>
            <View style={{ position: 'relative', width: JOURS_FENETRE * 24 * (pxHeures + L_HEURES), height: '100%' }}>
                {events.filter(Boolean).map((item) => (
                    <ListItem
                        // Occurrences of a recurring event share the parent's id: the start
                        // makes each key unique (duplicate keys could drop/mix up blocks).
                        key={`${item.id}-${item.debut?.toMillis?.() ?? ''}`}
                        event={item}
                        horizontal={true}
                        displayedDate={windowStart}
                        timelineDays={JOURS_FENETRE}
                        listOffset={offset}
                    />
                ))}
                {commonFreeSlots.map((freeSlot) => (
                    <FreeSlotItem
                        key={`${freeSlot.start}-${freeSlot.end}`}
                        freeSlot={freeSlot}
                        displayedDate={windowStart}
                        horizontal={true}
                        listOffset={offset}
                        owner={friend}
                        timelineDays={JOURS_FENETRE}
                    />
                ))}
            </View>
        </View>
    )
}
export const RangeeAmi = React.memo(RangeeAmiImpl)