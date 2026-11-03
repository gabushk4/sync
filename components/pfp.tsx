import { useAPI } from "@/contextes/contexteAPI";
import { usePalette } from "@/contextes/contextePalette";
import { FPType } from "@/types/pfp";
import { Image, ImageSourcePropType, StyleSheet, useColorScheme, View, ViewStyle } from "react-native";


type Props = {
    size: number,
    pfp: FPType,
    style?: ViewStyle
}

export default function ProfilPic({ size, pfp, style}: Props) {
    const { colors } = usePalette()
    const {APIBaseURL} = useAPI()
    const colorScheme = useColorScheme()
    
    const icones = {
        pfpDefault: colorScheme === 'dark' ? require('@/assets/icones/profil-dark-icon.png') : require('@/assets/icones/profil-light-icon.png')
    }

    const source: ImageSourcePropType = !pfp || pfp === 'null' || pfp === 'undefined'
        ? icones.pfpDefault
        : typeof pfp === 'string'
            ? { uri: `${APIBaseURL}${pfp}` }
            : { uri: pfp.uri }
    
    const s = StyleSheet.create({
        imageContainer: {
            height: size,
            width:size,
            borderRadius: 100,
            borderWidth: 1, 
            borderColor: colors.border,
            overflow:'hidden'
        },
        image: {
            height: '100%',
            width: '100%'
        }
    })

    return (
        <View style={[s.imageContainer, style]}>
            <Image
                style={s.image}
                source={source}
            />
        </View>
    )
}
