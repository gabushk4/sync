import ModalBase from "@/components/modalBase";
import { useFont } from "@/contextes/contexteFont";
import { RenderContent, useModal } from "@/contextes/contexteModals";
import { usePalette } from "@/contextes/contextePalette";
import log from "@/functions/log";
import { useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { Text, View } from "react-native";

export default function DataRenderModal() {
    const { dataRendererContent } = useModal();
    const { colors } = usePalette()
    const {fonts} = useFont()
    // `sansBoutonFermer`: '1' hides the round close button (swipe down / tap outside only).
    const { key, title, sansBoutonFermer } = useLocalSearchParams<{ key?: string, title?: string, sansBoutonFermer?: string }>();
    const contentKey = key as RenderContent['key'] | undefined;
    const content = dataRendererContent.find(d => d.key === contentKey)?.child;

    useEffect(() => {
        log("dataRenderer", content)
    }, [content]);

    return (
        <ModalBase afficherBoutonFermer={sansBoutonFermer !== '1'}>
            <Text style={{ width: '100%', textAlign: 'center', fontSize: 24, letterSpacing: 0.8, fontFamily: fonts.title, color: colors.text }}>{title}</Text>
            <View style={{ flex:1, width:'100%', height:'100%', paddingHorizontal:20}}>
                {content}
            </View>
        </ModalBase>
    )
}