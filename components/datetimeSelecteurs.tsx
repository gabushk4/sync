import { useFont } from '@/contextes/contexteFont';
import { usePalette } from "@/contextes/contextePalette";

import ceilBy5 from '@/functions/ceilBy5';
import { debutCreationPourJour, estJourneeEntiere } from '@/functions/jourCreation';
import { convertirTimestampDateLongue, convertirTimestampHeure } from "@/functions/convertirTimestamp";

import SwitchAbs from '@/abstractions/switchAbs';
import RNDateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { DateTime } from "luxon";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, Text, TextStyle, TouchableOpacity, View } from "react-native";

import { useEventDraft } from '@/contextes/contexteEventDraft';
import CommonSlotsSuggestions from './commonSlotsSuggestions';

type Props = {
    timezone: string | 'local',
    disabled?: boolean,
    minimumStart: DateTime | undefined,
    maximum?: DateTime,
    /** @deprecated Unused: start/end come from useEventDraft. To remove from EventForm's call. */
    start?: DateTime,
    /** @deprecated See `start`. */
    setStart?: Function,
    /** @deprecated See `start`. */
    end?: DateTime,
    /** @deprecated See `start`. */
    setEnd?: Function,
}

const END_DELAY_FROM_START = 60 //minutes
// Height of a compact iOS picker, used by the placeholder shown until the real pickers mount
const IOS_PICKER_PLACEHOLDER_HEIGHT = 34

// Static styles: created once at module scope
const staticStyles = StyleSheet.create({
    label: {
        fontSize: 20,
    },
    container: {
        flexDirection: 'column',
        flex: 3,
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        borderRadius: 8,
        overflow: 'hidden',
        paddingHorizontal: 8,
        paddingVertical: 4,
        marginBottom: 8,
        gap: 8,
    },
    dateTimeContainer: {
        flex: 3,
        width: '100%',
        paddingTop: 0,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: Platform.OS === 'android' ? 0 : 4,
    },
    allDayRow: {
        flex: 2,
        marginBottom: 4,
    },
    allDayLabel: {
        flex: 1,
    },
    allDaySwitch: {
        width: '20%',
    },
    pickerContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
    },
    dateTimePicker: {
        width: 'auto',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 8,
        paddingVertical: 4,
        paddingHorizontal: 8,
        marginBottom: 4,
    },
    androidTimeLabel: {
        flex: 0,
        width: '20%',
        marginRight: 18,
    },
    dateFontSize: {
        fontSize: 17,
    },
    inputTemps: {
        fontSize: 20,
    },
    pickerPlaceholder: {
        height: IOS_PICKER_PLACEHOLDER_HEIGHT,
    },
})

/**
 * Start/end date and time pickers for an event, with an "all day" toggle.
 * Keeps the event's duration constant when the start date/time moves, and
 * keeps end >= start when either bound is edited directly. Start and end come
 * from the event draft context (useEventDraft), not from the props.
 *
 * @param {Props} props
 * @param {string} props.timezone - IANA timezone name (or 'local') used for the iOS pickers' display.
 * @param {boolean} [props.disabled] - Disables the Android picker trigger buttons.
 * @param {DateTime} [props.minimumStart] - Earliest selectable start.
 * @param {DateTime} [props.maximum] - Latest selectable date/time, for both start and end pickers.
 * @author Philip — rectification for a more conventional display: the "all day" switch works (it never
 *   toggled, then reset the dates), turns itself on for whole days from the
 *   calendar, and each Android date picker opens alone
 * @returns {JSX.Element}
 */
function DateTimeSelecteur({timezone, disabled=false, minimumStart, maximum} : Props){
    const { t } = useTranslation('calendar')

    const { colors } = usePalette();
    const { fonts } = useFont()
    const { setStart, setEnd, start, end } = useEventDraft();

    // Defensive floor: whatever `maximum` arrives as, it must never end up
    // before this form's own minimum references (minimumStart, or a few
    // minutes after `start` for the end-time picker below) — otherwise the
    // native picker's "minimumDate < maximumDate" invariant crashes,
    // regardless of what upstream miscalculated. Found via the month
    // calendar's range selection (user story 5).
    const maximumSur = useMemo(() => {
        if (!maximum) return undefined
        let max = maximum
        if (minimumStart && max < minimumStart) max = minimumStart
        const plancherFin = start.plus({ minutes: 5 })
        if (max < plancherFin) max = plancherFin
        return max
    }, [maximum, minimumStart, start])

    // Dates handed to the native pickers: memoized so they aren't re-created (and
    // re-sent to native) on every render. `start`/`end` only change identity when the
    // dates really change (see the context's setters).
    const startDayJS = useMemo(() => start.startOf('day').toJSDate(), [start])
    const startJS = useMemo(() => start.toJSDate(), [start])
    const endDayJS = useMemo(() => end.startOf('day').toJSDate(), [end])
    const endJS = useMemo(() => end.toJSDate(), [end])
    const minEndJS = useMemo(() => start.plus({ minutes: 5 }).toJSDate(), [start])
    const minStartDayJS = useMemo(() => minimumStart?.startOf('day').toJSDate(), [minimumStart])
    const minStartJS = useMemo(() => minimumStart?.toJSDate(), [minimumStart])
    const maxJS = useMemo(() => maximumSur?.toJSDate(), [maximumSur])

    // Times before "all day" was switched on, restored when it's switched off
    // (null: none, e.g. a whole-day range from the calendar).
    const startRef = useRef<DateTime | null>(null)
    const endRef = useRef<DateTime | null>(null)

    // Android shows each picker as a dialog: one flag per picker. The start and end
    // date pickers shared one, so tapping either date opened both dialogs.
    const [showDatePicker, setShowDatePicker] = useState(Platform.OS === 'ios');
    const [showFinDatePicker, setShowFinDatePicker] = useState(Platform.OS === 'ios');
    const [showDebutPicker, setShowStartPicker] = useState(Platform.OS === 'ios');
    const [showFinPicker, setShowEndPicker] = useState(Platform.OS === 'ios');
    const [isAllDay, setIsAllDay] = useState(false)
    // The switch is turned on by itself once, when the pre-filled dates are whole
    // days (a range selected in the month calendar).
    const allDayDetecte = useRef(false)

    // iOS draws its 4 pickers inline: creating 4 native UIDatePickers while the screen
    // transition runs made it stutter. A placeholder of the same height is shown until
    // the JS thread is idle. Android opens dialogs on demand, nothing to defer.
    // (InteractionManager was removed in React Native 0.87: requestIdleCallback replaces
    // it. The timeout guarantees the pickers show up even if the thread stays busy.)
    const [pickersReady, setPickersReady] = useState(Platform.OS !== 'ios')
    useEffect(() => {
        if (pickersReady) return
        const handle = requestIdleCallback(() => setPickersReady(true), { timeout: 500 })
        return () => cancelIdleCallback(handle)
    }, [pickersReady])

    const iosPickerProps = useMemo(
        () => (Platform.OS === 'ios' ? { timeZoneName: timezone, accentColor: colors.text } : {}),
        [timezone, colors.text]
    )

    /**
     * Applies a new start date (keeping the existing start time). The end is kept,
     * or moved after the new start when it would come before it. All day: the
     * start stays at midnight and the end at least at the end of that day.
     *
     * @author Philip — rectification for a more conventional display (all-day mode, end kept)
     * @param {Date} jsDate - The date picked in the native picker.
     * @returns {void}
     */
    const handleStartDateChange = (jsDate : Date) => {
        if (isAllDay) {
            const debutJour = DateTime.fromJSDate(jsDate).startOf('day')
            setStart(debutJour)
            if (end < debutJour.endOf('day')) setEnd(debutJour.endOf('day'))
            return
        }
        const newDate = ceilBy5(DateTime.fromJSDate(jsDate).startOf('day'));
        // The end used to be reset to its day's midnight here, losing its time.
        let newFin = end

        const newStart = newDate.set({ 
            hour: start.hour, 
            minute: start.minute, 
            second: 0 
        });

        if (newFin <= newStart) {
            newFin = newStart.plus({ minutes: END_DELAY_FROM_START }); // default event length
        }  

        setStart(newStart);
        //TODO: keep same length as a setting
        setEnd(newFin)
    };

    /**
     * Applies a new end date, keeping the existing end time.
     *
     * @author Philip — rectification for a more conventional display (closes its own Android dialog)
     * @param {Date} jsDate - The date picked in the native picker.
     * @returns {void}
     */
    const handleEndDateChange = (jsDate: Date) => {
        const newDate = ceilBy5(DateTime.fromJSDate(jsDate).set({second:0}));

        // Change only the date not the time
        const newEnd = end.set({
            year: newDate.year,
            month: newDate.month,
            day: newDate.day,
        });

        setEnd(newEnd);        
    };

    /**
     * Applies a new start time, keeping the event's duration the same,
     * and pushes the end forward if it would otherwise land before the
     * new start.
     *
     * @param {Date} jsDate - The time picked in the native picker.
     * @returns {void}
     */
    const handleStartTimeChange = (jsDate: Date) => {
        const newDebut = ceilBy5(DateTime.fromJSDate(jsDate).set({ second: 0 }));        
        let newFin = end;

        // If end is before the start, end delayed from start
        if (newFin <= newDebut) {
            newFin = newDebut.plus({ minutes: END_DELAY_FROM_START }); // default event length
        }   

        setStart(newDebut);
        //TODO: keep same length as a setting
        setEnd(newFin)
    };

    /**
     * Applies a new end time directly.
     *
     * @param {Date} jsDate - The time picked in the native picker.
     * @returns {void}
     */
    const handleEndTimeChange = (jsDate: Date) => {
        setEnd(ceilBy5(DateTime.fromJSDate(jsDate).set({ second: 0 })))
    };

    /**
     * Builds a picker's onChange. On Android the dialog must close whatever the outcome:
     * when the person cancelled ('dismissed', no date), the flag used to stay true, so
     * the next tap changed nothing and the dialog never reopened.
     */
    const surChangement = (fermer: () => void, appliquer: (d: Date) => void) =>
        (e: DateTimePickerEvent, date?: Date) => {
            if (Platform.OS === 'android') fermer()
            if (e.type === 'set' && date) appliquer(date)
        }

    const onChangeStartDate = surChangement(() => setShowDatePicker(false), handleStartDateChange)
    const onChangeStartTime = surChangement(() => setShowStartPicker(false), handleStartTimeChange)
    const onChangeEndDate = surChangement(() => setShowFinDatePicker(false), handleEndDateChange)
    const onChangeEndTime = surChangement(() => setShowEndPicker(false), handleEndTimeChange)

    // Pre-filled whole days (a range from the month calendar): "all day" on.
    useEffect(() => {
        if (allDayDetecte.current || isAllDay || !estJourneeEntiere(start, end)) return
        allDayDetecte.current = true
        setIsAllDay(true)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [start, end])

    /**
     * "All day" switch. On: keeps the current times, then covers the start day's
     * midnight to the end day's 23:59:59. Off: brings the kept times back; with none
     * kept (a range pre-filled from the calendar, "all day" turned on by itself) or
     * past ones, keeps the event's DAYS and only suggests times: the start day at the
     * next hour (not before now), the end day an hour after that time. Switching off
     * a calendar range used to drop its dates (back to now + 1h → start + 1h).
     *
     * @author Philip — rectification for a more conventional display
     *   (user story 5: ranges selected in the month calendar)
     * @param {boolean} active - New value of the switch.
     * @returns {void}
     */
    const basculerJourEntier = (active: boolean) => {
        setIsAllDay(active)
        if (active) {
            startRef.current = start
            endRef.current = end
            setStart(start.startOf('day'))
            setEnd(end.endOf('day'))
            return
        }
        const maintenant = ceilBy5(DateTime.now())
        const heuresGardees = !!startRef.current && startRef.current >= maintenant
        const debut = heuresGardees
            ? startRef.current as DateTime
            : DateTime.max(maintenant, debutCreationPourJour(start))
        let fin = heuresGardees && endRef.current && endRef.current > debut
            ? endRef.current
            // Same end DAY as the all-day event, an hour after the start's time.
            : end.startOf('day').set({ hour: debut.hour, minute: debut.minute }).plus({ minutes: END_DELAY_FROM_START })
        // Never past the event's last day (e.g. a start at 23:00 on a one-day range).
        if (!heuresGardees && fin > end.endOf('day')) fin = end.endOf('day')
        if (fin <= debut) fin = debut.plus({ minutes: END_DELAY_FROM_START })
        startRef.current = null
        endRef.current = null
        setStart(debut)
        setEnd(fin)
    }

    // Only what depends on the palette/fonts; recomputed when they change
    const dyn = useMemo(() => ({
        label: { color: colors.muted, fontFamily: fonts.body } as TextStyle,
        inputTemps: { color: colors.text, fontFamily: fonts.body } as TextStyle,
        container: { backgroundColor: colors.card, borderColor: colors.border },
        dateTimePicker: { borderColor: colors.border, backgroundColor: colors.primary },
    }), [colors.muted, colors.text, colors.card, colors.border, colors.primary, fonts.body])

    const isAndroid = Platform.OS === 'android'
    const labelStyle = [staticStyles.label, dyn.label, staticStyles.pickerContainer, isAndroid ? staticStyles.androidTimeLabel : null]
    const placeholder = <View style={staticStyles.pickerPlaceholder} />

    return (
        <View style={[staticStyles.container, dyn.container]}>    
            <View style={[staticStyles.dateTimeContainer, staticStyles.allDayRow]}>
                <Text style={[staticStyles.label, dyn.label, staticStyles.allDayLabel]}>{t('dateTime.allDay')}</Text>
                    <SwitchAbs
                        style={staticStyles.allDaySwitch}
                        value={isAllDay}
                        // onValueChange: SwitchAbs only forwards that one; the
                        // onChange used here was dropped, so the switch never toggled.
                        onValueChange={(active) => basculerJourEntier(active)}
                    />
            </View>    
            {/* --- Start --- */}
            <View style={staticStyles.dateTimeContainer}>
                <Text style={labelStyle}>{t('dateTime.starts')}</Text>
                {/* Date */}
                <View style={staticStyles.pickerContainer}>
                    {isAndroid && (
                        <TouchableOpacity onPress={() => setShowDatePicker(true)} disabled={disabled} style={[staticStyles.dateTimePicker, dyn.dateTimePicker]} >
                            <Text style={[staticStyles.inputTemps, dyn.inputTemps, staticStyles.dateFontSize]}>{convertirTimestampDateLongue(start.startOf('day'))}</Text>
                        </TouchableOpacity>
                    )}
                    {showDatePicker && (pickersReady ? (
                        <RNDateTimePicker
                            value={startDayJS}
                            mode="date"
                            minimumDate={minStartDayJS}
                            maximumDate={maxJS}
                            display={isAndroid ? 'calendar' : 'default'}
                            onChange={onChangeStartDate}
                            {...iosPickerProps}
                        />
                    ) : placeholder)}
                </View>
                {/* Time */}
                {!isAllDay &&
                    <View style={staticStyles.pickerContainer}>
                        {isAndroid && (
                            <TouchableOpacity style={[staticStyles.dateTimePicker, dyn.dateTimePicker]} onPress={() => setShowStartPicker(true)} disabled={disabled}>
                                <Text style={[staticStyles.inputTemps, dyn.inputTemps]}>{convertirTimestampHeure(start)}</Text>
                            </TouchableOpacity>
                        )}
                        {showDebutPicker && (pickersReady ? (
                            <RNDateTimePicker                        
                                value={startJS}
                                minimumDate={minStartJS}
                                maximumDate={maxJS}
                                mode="time"
                                is24Hour={true}
                                minuteInterval={5}
                                display={isAndroid ? 'spinner' : 'default'}
                                onChange={onChangeStartTime}
                                {...iosPickerProps}
                            />
                        ) : placeholder)}
                    </View>
                }
            </View>

            {/* --- End --- */}
            <View style={staticStyles.dateTimeContainer}>            
                <Text style={labelStyle}>{t('dateTime.ends')}</Text>
                {/* Date */}
                <View style={staticStyles.pickerContainer}>                
                    {isAndroid && (
                        <TouchableOpacity onPress={() => setShowFinDatePicker(true)} disabled={disabled} style={[staticStyles.dateTimePicker, dyn.dateTimePicker]} >
                            <Text style={[staticStyles.inputTemps, dyn.inputTemps, staticStyles.dateFontSize]}>{convertirTimestampDateLongue(end.startOf('day'))}</Text>
                        </TouchableOpacity>
                    )}
                    {showFinDatePicker && (pickersReady ? (
                        <RNDateTimePicker
                            value={endDayJS}
                            mode="date"
                            minimumDate={startDayJS}
                            maximumDate={maxJS}
                            display={isAndroid ? 'calendar' : 'default'}
                            onChange={onChangeEndDate}
                            {...iosPickerProps}
                        />
                    ) : placeholder)}
                </View>
                {/* Time */}
                {!isAllDay &&
                    <View style={staticStyles.pickerContainer}>
                        {isAndroid && (
                            <TouchableOpacity style={[staticStyles.dateTimePicker, dyn.dateTimePicker]} onPress={() => setShowEndPicker(true)} disabled={disabled}>
                                <Text style={[staticStyles.inputTemps, dyn.inputTemps]}>{convertirTimestampHeure(end)}</Text>
                            </TouchableOpacity>
                        )}
                        {showFinPicker && (pickersReady ? (
                            <RNDateTimePicker
                                value={endJS}
                                minimumDate={minEndJS}
                                maximumDate={maxJS}
                                mode="time"
                                is24Hour={true}
                                minuteInterval={5}
                                display={isAndroid ? 'spinner' : 'default'}
                                onChange={onChangeEndTime}
                                {...iosPickerProps}
                            />
                        ) : placeholder)}
                    </View>
                }
            </View> 

            {/* --- Suggestions --- */}
            <CommonSlotsSuggestions/>
        </View>
    );
}

export default React.memo(DateTimeSelecteur)