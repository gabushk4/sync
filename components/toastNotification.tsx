import Icon from '@react-native-vector-icons/ionicons'
import { View } from 'react-native'

import Haptics from '@/abstractions/haptics'
import { ToastBase } from '@/abstractions/toastAbs'
import { usePalette } from '@/contextes/contextePalette'

type Props = {
    text1?: string
    text2?: string
    onPress?: () => void
    props?: { categorie?: 'amis' | 'evenements' | 'sync' }
}

/**
 * User story 45: toast of a push notification received while the app is open. The
 * shared toast card (ToastBase) in the accent color, with the notification category's
 * icon and a chevron: the whole card opens the notification (onPress). It can also be
 * swiped away.
 *
 * @param {Props} props
 * @returns {JSX.Element}
 */
export default function ToastNotification({ text1, text2, onPress, props }: Props) {
    const { colors } = usePalette()
    Haptics.clickLeger()

    const icone = props?.categorie === 'amis'
        ? 'person-outline'
        : props?.categorie === 'evenements'
            ? 'calendar-clear-outline'
            : 'notifications-outline'

    return (
        <ToastBase
            couleur={colors.secondary}
            titre={text1}
            texte={text2}
            onPress={onPress}
            icone={
                <View style={{ width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary }}>
                    <Icon name={icone} size={26} color={colors.secondary} />
                </View>
            }
            droite={<Icon name="chevron-forward" size={20} color={colors.muted} style={{ marginRight: 12 }} />}
        />
    )
}
