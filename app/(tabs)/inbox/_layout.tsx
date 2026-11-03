import { Stack } from "expo-router";

export default function InboxLayout() {
    return (
        <Stack screenOptions={{ headerTransparent: false }}>
            <Stack.Screen
                name="index" options={{headerShown:false}}
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
        </Stack>
    )
}
