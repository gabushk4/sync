import Radius from '@/constants/Radius';
import { useFont } from '@/contextes/contexteFont';
import { usePalette } from '@/contextes/contextePalette';
import { convertToWhen } from '@/functions/convertirTimestamp';
import { convertUTCToLocal } from '@/functions/convertirUTCenLocal';
import type { CalendrierImport } from '@/functions/imports';
import RenderCalendarColor from '@/functions/renderCalendarColor';
import Icon from '@react-native-vector-icons/ionicons';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, useColorScheme, View } from 'react-native';

type Props<TCalendrier extends CalendrierImport> = {
    fournisseur: 'google' | 'outlook';
    calendrier: TCalendrier;
    selectionne: boolean;
    occupe: boolean;
    onBasculer: (idExterne: string) => void;
    onResynchroniser: (calendrier: TCalendrier) => void;
    onOptions?: (calendrier: TCalendrier) => void;
};

export default function ExternalCalendarRow<TCalendrier extends CalendrierImport>({
    fournisseur,
    calendrier,
    selectionne,
    occupe,
    onBasculer,
    onResynchroniser,
    onOptions,
}: Props<TCalendrier>) {
    const { t } = useTranslation('calendar');
    const { colors } = usePalette();
    const { fonts } = useFont();
    const scheme = useColorScheme();
    const indisponible = !calendrier.disponible;

    const styles = StyleSheet.create({
        row: {
            minHeight: 56,
            paddingHorizontal: 12,
            paddingVertical: 10,
            marginBottom: 8,
            borderRadius: Radius.md,
            borderWidth: 1,
            borderColor: colors.border,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
        },
        disabled: { opacity: 0.5 },
        rowText: { flex: 1, color: colors.text, fontFamily: fonts.body, fontSize: 16, justifyContent: 'center' },
        subText: { color: colors.muted, fontFamily: fonts.body, fontSize: 13, marginTop: 2 },
        syncBadge: {
            maxWidth: 132,
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: Radius.sm,
            backgroundColor: colors.primary,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
        },
        syncBadgeText: { color: colors.muted, fontFamily: fonts.body, fontSize: 11 },
        action: {
            minHeight: 46,
            paddingHorizontal: 14,
            marginBottom: 8,
            borderRadius: Radius.md,
            borderWidth: 1,
            borderColor: colors.border,
            justifyContent: 'center',
            alignItems: 'center',
            flexDirection: 'row',
            gap: 8,
        },
        actionText: { color: colors.secondary, fontFamily: fonts.title, fontSize: 15 },
    });

    return (
        <View>
            <View style={[
                styles.row,
                indisponible && styles.disabled,
                { backgroundColor: RenderCalendarColor(calendrier.couleur ?? 275, scheme) },
            ]}>
                <TouchableOpacity
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selectionne, disabled: indisponible || occupe }}
                    disabled={indisponible || occupe}
                    onPress={() => onBasculer(calendrier.id_externe)}
                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}
                >
                    <Icon
                        name={selectionne ? 'checkbox' : 'square-outline'}
                        size={22}
                        color={selectionne ? colors.secondary : colors.muted}
                    />
                    <View style={styles.rowText}>
                        <Text numberOfLines={1} style={styles.rowText}>{calendrier.nom}</Text>
                        {calendrier.suggere ? <Text style={styles.subText}>{t(`${fournisseur}.suggested`)}</Text> : null}
                        {indisponible ? <Text style={styles.subText}>{t(`${fournisseur}.linkedElsewhere`)}</Text> : null}
                    </View>
                </TouchableOpacity>
                {calendrier.derniere_synchro ? (
                    <View style={styles.syncBadge}>
                        <Icon name="time" color={colors.secondary} size={16} />
                        <Text numberOfLines={1} style={styles.syncBadgeText}>
                            {convertToWhen(convertUTCToLocal(calendrier.derniere_synchro))}
                        </Text>
                    </View>
                ) : null}
                {onOptions && calendrier.actif && calendrier.id_publique ? (
                    <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel={t(`${fournisseur}.calendarOptions`)}
                        onPress={() => onOptions(calendrier)}
                    >
                        <Icon name="ellipsis-horizontal" size={24} color={colors.secondary} />
                    </TouchableOpacity>
                ) : null}
            </View>
            {calendrier.actif && calendrier.id_publique ? (
                <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityState={{ disabled: occupe }}
                    disabled={occupe}
                    style={[styles.action, occupe && styles.disabled]}
                    onPress={() => onResynchroniser(calendrier)}
                >
                    <Icon name="refresh-outline" size={18} color={colors.secondary} />
                    <Text style={styles.actionText}>{t(`${fournisseur}.resync`)}</Text>
                </TouchableOpacity>
            ) : null}
        </View>
    );
}