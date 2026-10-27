import {S, L} from '@/constants/EventsSL'
import { ColorSchemeName } from "react-native";

export default function RenderCalendarColor(colorFromAPI: number, colorScheme: ColorSchemeName){
    return `hsl(${colorFromAPI}, ${colorScheme === 'dark' ? S.dark : S.light }, ${colorScheme === 'dark' ? L.dark : L.light })`
}