import {S, L} from '@/constants/EventsSL'
import { ColorSchemeName } from "react-native";
import log from './log';

export default function RenderCalendarColor(colorFromAPI: number, colorScheme: ColorSchemeName) {
    log("RenderCalendarColor", colorFromAPI)
    return `hsl(${colorFromAPI}, ${colorScheme === 'dark' ? S.dark : S.light }, ${colorScheme === 'dark' ? L.dark : L.light })`
}