import { StyleSheet, View } from "react-native";
import Icon from '@react-native-vector-icons/ionicons'
import { usePalette } from "@/contextes/contextePalette";

export default function NewChatIcon({}){
    const {colors} = usePalette()
    return(
        <View style={styles.iconeNouveauMessage}>
            <Icon name="chatbubble-outline" size={28} color={colors.text} />
            <Icon name="add" size={18} color={colors.text} style={styles.plusDansBulle} />
        </View>
    )
}

const styles = StyleSheet.create({
    iconeNouveauMessage: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
     plusDansBulle: { position: 'absolute', top: 5 },
})