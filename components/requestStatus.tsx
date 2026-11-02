import Spinner from '@/components/spinner'
import { usePalette } from '@/contextes/contextePalette'
import { requestListener } from '@/events/requestEvents'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const DELAI_MESSAGE_MS = 5000

export default function RequestStatus() {
    const { colors } = usePalette()
    const { t } = useTranslation('common')
    const insets = useSafeAreaInsets()
    const isFetching = useSyncExternalStore(
        (callback) => requestListener.subscribe(() => callback()),
        () => requestListener.isFetching,
    )
    const [afficherStatut, setAfficherStatut] = useState(false)

    useEffect(() => {
        if (!isFetching) {
            setAfficherStatut(false)
            return
        }

        const timeout = setTimeout(() => setAfficherStatut(true), DELAI_MESSAGE_MS)
        return () => clearTimeout(timeout)
    }, [isFetching])

    if (!afficherStatut) return null

    return (
        <View
            accessibilityLiveRegion="polite"
            pointerEvents="none"
            style={{
                position: 'absolute',
                top: insets.top + 8,
                alignSelf: 'center',
                zIndex: 1000,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 7,
                paddingHorizontal: 12,
                paddingVertical: 8,
                maxWidth: '90%',
                borderRadius: 20,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.card,
                elevation: 4,
            }}
        >
            <Spinner size={16} color={colors.muted} accessibilityLabel={t('loadingLong')} />
            <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12 }}>
                {t('loadingLong')}
            </Text>
        </View>
    )
}
