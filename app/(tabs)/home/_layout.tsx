import { useFont } from "@/contextes/contexteFont";

import { Stack } from "expo-router";
import { useTranslation } from 'react-i18next';

export default function HomeLayout() {
    const {fonts} = useFont()
    const { t } = useTranslation('events')
    return (
        <Stack
            screenOptions={{
                headerShown: true,
                headerTransparent: false,
                headerTitleStyle: { fontFamily: fonts.title },
                headerBackVisible: false,
            }}
        >
            <Stack.Screen
                name="index" options={{ headerTitle: 'sync'}}
            />
            {/* Month calendar, its own page since 2026-10-10.
                Philip — user story 5 (month calendar). */}
            <Stack.Screen
                name="calendrier" options={{headerBackVisible:true, headerBackButtonDisplayMode:'minimal', headerTitle:t('navigation.calendar')}}
            />
            {/* Event and unavailability pages, swiped (Philip — user story 20). */}
            <Stack.Screen
                name="create" options={{headerBackVisible:true, headerBackButtonDisplayMode:'minimal', headerTitle:t('navigation.create')}}
            />
            {/* Invitation review ("adjust my schedule" for an invitation in conflict).
                Philip — user story 8. */}
            <Stack.Screen
                name="revueInvitation" options={{headerBackVisible:true, headerBackButtonDisplayMode:'minimal', headerTitle:t('navigation.invitationReview')}}
            />
            <Stack.Screen
                name="details/[eventId]" options={{headerBackVisible:true, headerBackButtonDisplayMode:'minimal', headerTitle:t('navigation.details')}}
            />
            <Stack.Screen
                name="edit/[event]" options={{headerBackVisible:true, headerBackButtonDisplayMode:'minimal', headerTitle:t('navigation.edit')}}
            />
            {/* A friend's profile, opened from their row (the page shows their pseudo). */}
            <Stack.Screen
                name="profil/[membreId]" options={{headerBackVisible:true, headerBackButtonDisplayMode:'minimal', headerTitle:''}}
            />
            {/* Story #21: an event's group conversation, opened from its details page
                (the title is the event's, set by the screen). */}
            <Stack.Screen
                name="conversation/[conversationId]" options={{headerBackVisible:true, headerBackButtonDisplayMode:'minimal'}}
            />
            {/* Its info (tap on its title) */}
            <Stack.Screen
                name="conversation/infos/[conversationId]" options={{headerBackVisible:true, headerBackButtonDisplayMode:'minimal', headerTitle:''}}
            />
        </Stack>
    )
}
