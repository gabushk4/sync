import { Text, TouchableOpacity, TouchableOpacityProps, View } from "react-native"
import ProfilPic from "./pfp"
import { Participant } from "@/types/invites"
import { useFont } from "@/contextes/contexteFont"
import { usePalette } from "@/contextes/contextePalette"
import Ionicons from "@react-native-vector-icons/ionicons"
import { useTranslation } from "react-i18next"
import { convertirTimestampDateLongue } from "@/functions/convertirTimestamp"
import log from "@/functions/log"
import { ListType } from "@/app/(modals)/listeAmis"
import { Interval } from "@/types/availabilities"

type Props = {
    friend: Participant;
    onPress: TouchableOpacityProps['onPress'];
    listType: ListType;
    selected: boolean;
    suggestedIntervals?: Interval[];
    /** Has an unavailability over the event's range: greyed out, can't be picked. */
    indisponible?: boolean;
}

/**
 * One friend in the friends list.
 *
 * @author Philip — user story 20: `indisponible` greys the friend out with "unavailable
 *   then" instead of their friendship date and suggestions, and they can't be picked —
 *   the app warns before inviting someone who said "don't disturb me then"
 */
export default function FriendLine({ friend, onPress, listType, selected, suggestedIntervals = [], indisponible = false }: Props) {
    const { fonts } = useFont();
    const { colors } = usePalette();
    const { t, i18n } = useTranslation('friends');

    const dateAmitie = convertirTimestampDateLongue(friend.temps_amitie)

    return (
        <View style={{ width: '100%', paddingHorizontal: 4, paddingVertical: 4, opacity: indisponible ? 0.55 : 1 }}>
            <TouchableOpacity style={{ minHeight: 72, width: '100%', flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12, borderWidth: 1, borderColor: indisponible ? colors.indisponible : colors.border, backgroundColor: selected ? colors.secondary : colors.card, paddingHorizontal: 12, paddingVertical: 8 }}
                onPress={onPress} disabled={indisponible}>
                <ProfilPic size={52} pfp={friend.fp_url}/>
                <View style={{ flex: 1, justifyContent: 'center', minWidth: 0 }}>
                    <Text numberOfLines={1} style={{ fontFamily: fonts.body, color: colors.text, fontSize: 17 }}>{friend.pseudo}</Text>
                    {indisponible
                        ? <Text numberOfLines={1} style={{ fontFamily: fonts.body, color: colors.indisponible, fontSize: 13 }}>{t('list.unavailable')}</Text>
                        : <>
                        <Text numberOfLines={1} style={{ fontFamily: fonts.body, color: colors.muted, fontSize: 13 }}>{t('list.friendSince', { date: dateAmitie.substring(dateAmitie.indexOf('.') + 2) })}</Text>
                        {suggestedIntervals.slice(0, 2).map((interval) => (
                            <Text key={interval.id} numberOfLines={1} style={{ fontFamily: fonts.body, color: colors.primary, fontSize: 12 }}>
                                {t('list.suggestedAvailability', { range: `${interval.debut.setLocale(i18n.language).toFormat('ccc d LLL HH:mm')}–${interval.fin.setLocale(i18n.language).toFormat('ccc d LLL HH:mm')}` })}
                            </Text>
                        ))}
                        {suggestedIntervals.length > 2 && (
                            <Text numberOfLines={1} style={{ fontFamily: fonts.body, color: colors.muted, fontSize: 12 }}>
                                {t('list.moreSuggestions', { count: suggestedIntervals.length - 2 })}
                            </Text>
                        )}
                        </>}
                </View>
                <View style={{ width: 40, height: '100%', justifyContent: 'center', alignItems: 'center' }}>
                    {listType === 'consult' &&
                        <TouchableOpacity style={{ width: '88%', height: '72%', justifyContent: 'center', alignItems: 'center' }}
                            onPress={() => log("supprimer ami:", friend.pseudo, friend.id)}>
                            <Ionicons name="trash" color={colors.text}/>
                        </TouchableOpacity>}
                </View>
            </TouchableOpacity>
        </View>
    )
}
