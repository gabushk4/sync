import { useFont } from '@/contextes/contexteFont';
import { usePalette } from '@/contextes/contextePalette';

import Radius from '@/constants/Radius';

import type { CalendrierImport } from '@/functions/imports';

import RenderCalendarColor from '@/functions/renderCalendarColor';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, useColorScheme, View } from 'react-native';
import { FlatList } from 'react-native-gesture-handler';
import Overlay from './overlay';

type Props<TCalendrier extends CalendrierImport> = {
    selectedCalendar: TCalendrier | undefined;
    onSave: (calendar: TCalendrier, changes: Partial<TCalendrier>) => void | Promise<void>;
    onClose: () => void;
}

const CALENDAR_COLORS = [
    0,
    35,
    75,
    145,
    185,
    215,
    270,
    325,
]

export default function CalendarOptions<TCalendrier extends CalendrierImport>({ selectedCalendar, onSave, onClose }: Props<TCalendrier>) {
    const { colors } = usePalette();
    const { fonts } = useFont();
    const scheme = useColorScheme() ?? 'light'
    
    const [overlayVisible, setOverlayVisible] = useState(false);
    const [draftCalendar, setDraftCalendar] = useState(selectedCalendar);
    const [saving, setSaving] = useState(false);

    const modifications = selectedCalendar && draftCalendar
        ? Object.fromEntries(
            Object.keys(draftCalendar)
                .filter(key => draftCalendar[key as keyof TCalendrier] !== selectedCalendar[key as keyof TCalendrier])
                .map(key => [key, draftCalendar[key as keyof TCalendrier]]),
            ) as Partial<TCalendrier>
        : {};

    const enregistrer = async () => {
        if (!selectedCalendar || !draftCalendar || saving) return;
        setSaving(true);
        try {
            await onSave(selectedCalendar, modifications);
            onClose();
        } finally {
            setSaving(false);
        }
    };

    const styles = StyleSheet.create({
        center: { paddingVertical: 12, alignItems: 'stretch' },
        header: { width: '100%', minHeight: 44, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
        heading: { color: colors.text, fontFamily: fonts.title, fontSize: 22, textAlign: 'center' },
        row: {
            minHeight: 56,
            paddingHorizontal: 12,
            paddingVertical: 10,
            marginBottom: 8,
            borderRadius: Radius.md,
            borderBottomWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
        },
        rowText: { flex: 1, color: colors.text, fontFamily: fonts.body, fontSize: 16 },
        input: {
            flex: 1,
            minHeight: 44,
            paddingHorizontal: 10,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: Radius.sm,
            color: colors.text,
            fontFamily: fonts.body,
        },
        actions: { width: '100%', gap: 8, marginTop: 16 },
        actionButton: { width: '100%', minHeight: 52, paddingHorizontal: 14, borderRadius: Radius.md, justifyContent: 'center', alignItems: 'center' },
        cancelButton: { borderWidth: 1, borderColor: colors.border },
        saveButton: { backgroundColor: colors.secondary },
        cancelText: { color: colors.text, fontFamily: fonts.title },
        saveText: { color: colors.background, fontFamily: fonts.title, fontSize: 16 },
        roundColor: {
            borderRadius: 100, width: 40,
            aspectRatio: 1, borderWidth: 1,
            borderColor: colors.border 
        }
    })    

    return (
        <>
        <View style={styles.center}>
            <View style={styles.header}>
                <Text style={styles.heading}>options</Text>
            </View>
            <View style={styles.row}>
                <Text style={styles.rowText}>Nom</Text>
                <TextInput
                    accessibilityLabel="Nom du calendrier"
                    value={draftCalendar?.nom ?? ''}
                    onChangeText={nom => setDraftCalendar(current => current ? { ...current, nom } : current)}
                    style={styles.input}
                    maxLength={120}
                />
            </View>
            <View style={[styles.row, { borderWidth: 0, borderBottomWidth: 1 }]}>
                <Text style={styles.rowText}>couleur: </Text>
                    <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel="Choisir la couleur du calendrier"
                        onPress={() => setOverlayVisible(true)}
                        style={[styles.roundColor, { backgroundColor: draftCalendar?.couleur ? RenderCalendarColor(draftCalendar.couleur, scheme): colors.primary }]}
                    />
            </View>
            <View style={styles.actions}>
                <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityState={{ disabled: saving || Object.keys(modifications).length === 0 }}
                    disabled={saving || Object.keys(modifications).length === 0}
                    onPress={enregistrer}
                    style={[styles.actionButton, styles.saveButton, (saving || Object.keys(modifications).length === 0) && { opacity: 0.5 }]}
                >
                    <Text style={styles.saveText}>Enregistrer</Text>
                </TouchableOpacity>
            </View>
            </View>
            <Overlay
                visible={overlayVisible}
                onDismiss={() => setOverlayVisible(false)}
                style={{flexDirection:'row', flexWrap:'wrap', justifyContent:'center', alignItems:'center'}}
            >
                <FlatList
                    data={CALENDAR_COLORS}
                    contentContainerStyle={{alignItems:'center', justifyContent:'center', }}
                    renderItem={({ item: H }) => {                        
                            return (
                        <TouchableOpacity
                            accessibilityRole="radio"
                            accessibilityState={{ selected: draftCalendar?.couleur === H }}
                            onPress={() => setDraftCalendar(current => current ? { ...current, couleur:H} : current)}
                            key={H}
                            style={[
                                styles.roundColor,
                                {
                                    width: 56,
                                    backgroundColor: RenderCalendarColor(H, scheme),
                                    marginHorizontal: 8,
                                    marginVertical: 6,
                                    borderWidth: draftCalendar?.couleur === H ? 3 : 1,
                                },
                            ]}
                        />
                    )}}
                    numColumns={4}
                />
            </Overlay>
        </>
    )
}
