import { Stack } from "expo-router";
import { useTranslation } from 'react-i18next';

export default function ProfileLayout() {
    const { t } = useTranslation('profile')
    const { t: tEvents } = useTranslation('events')
    return (
        <Stack
            screenOptions={{
                headerTransparent: false,
                headerBackButtonDisplayMode:'minimal'
            }}
        >
            <Stack.Screen
                name="index" options={{headerTitle:t('navigation.profile')}}
            />
            <Stack.Screen
                name="edit" options={{headerTitle:t('navigation.edit')}}
            />
            <Stack.Screen
                name="settings" options={{ headerTitle: t('navigation.settings')}}
            />
            <Stack.Screen
                name="admin" options={{ headerTitle: t('admin.title') }}
            />
            <Stack.Screen
                name="importCalendar" options={{ headerTitle: t('navigation.importCalendar')}}
            />
            <Stack.Screen
                name="settings/calendars/google" options={{ headerTitle: 'Google Agenda' }}
            />
            <Stack.Screen
                name="settings/calendars/outlook" options={{ headerTitle: 'Outlook Calendar' }}
            />            
            {/* Event creation from a friend's profile: back returns to that profile.
                Philip — rectification (user story 20). */}
            <Stack.Screen
                name="create" options={{ headerTitle: tEvents('navigation.create')}}
            />
        </Stack>
    )
}
