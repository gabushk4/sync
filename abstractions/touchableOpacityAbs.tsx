import { StyleSheet, Text, TouchableOpacity, TouchableOpacityProps} from "react-native";
import { usePalette } from "@/contextes/contextePalette";

export function SecondaryBtn({onPress, children, style} : TouchableOpacityProps) {
    const {colors} = usePalette()
    
    return (
       <TouchableOpacity 
            style={[s.bouton,{ borderWidth:1, borderColor:colors.border, backgroundColor: colors.background }, style]}
            onPress={onPress}
        >
            {children}
        </TouchableOpacity>     
    )
}

export function MainBtn({onPress, children, style} : TouchableOpacityProps) {
    const {colors} = usePalette()
    
    return (
       <TouchableOpacity 
            style={[s.bouton, { borderWidth:1, borderColor:colors.border, backgroundColor: colors.primary }, style]}
            onPress={onPress}
        >
            {children}
        </TouchableOpacity>     
    )
}

const s = StyleSheet.create({
        bouton:{
            height:44,
            alignItems:'center',
            justifyContent:'center',
            borderRadius:8, 
            paddingVertical:4,
            paddingHorizontal: 8,
            
        }    
    })
