import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";

import { useFont } from "@/contextes/contexteFont";

export default function InboxLayout() {
    const { t } = useTranslation('inbox')
    const { fonts } = useFont()
    return (
        <Stack screenOptions={{ headerTransparent: false, headerTitleStyle: { fontFamily: fonts.title } }}>
            {/* The conversations list: a header like the other tabs ("Messages"). New
                message: the tab bar's middle button (chat bubble with a +) */}
            <Stack.Screen
                name="index"
                options={{ headerTitle: t('title') }}
            />
            <Stack.Screen
                name="[conversationId]"
                // seulement la flèche "<", sans le nom de l'écran précédent
                options={{ headerBackButtonDisplayMode: 'minimal' }}
            />
            {/* Conversation info (tap on its title) and a member's profile opened from it */}
            <Stack.Screen
                name="infos/[conversationId]"
                options={{ headerBackButtonDisplayMode: 'minimal', headerTitle: '' }}
            />
            <Stack.Screen
                name="profil/[membreId]"
                options={{ headerBackButtonDisplayMode: 'minimal', headerTitle: '' }}
            />
            {/* All the photos of a conversation (from its info; the screen sets its title) */}
            <Stack.Screen
                name="photos/[conversationId]"
                options={{ headerBackButtonDisplayMode: 'minimal' }}
            />
        </Stack>
    )
}
