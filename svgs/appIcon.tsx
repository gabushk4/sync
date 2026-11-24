import * as React from "react"
import Svg, { Path, SvgProps } from "react-native-svg"

interface AppIconProps extends SvgProps {
    size?: number
}

const VIEWBOX_SIZE = 480;
const CX = 241.055;
const CY = 241.055;

// Ajuster l'anneau extérieur
const OUTER_RADIUS = 241.055; // Rayon extérieur total
const OUTER_STROKE_WIDTH = 12; // Plus cette valeur est petite, plus le trait extérieur est fin
const INNER_HOLE_RADIUS = OUTER_RADIUS - OUTER_STROKE_WIDTH;

// Ajuster le cercle intérieur plein
const INNER_CIRCLE_RADIUS = 56;

// Helper pour tracer un cercle dans le sens horaire (CW) ou anti-horaire (CCW)
const createCirclePath = (cx: number, cy: number, r: number, clockwise = true) => {
    const sweep = clockwise ? 1 : 0;
    return [
        `M ${cx} ${cy - r}`,
        `A ${r} ${r} 0 1 ${sweep} ${cx} ${cy + r}`,
        `A ${r} ${r} 0 1 ${sweep} ${cx} ${cy - r}`,
        "Z",
    ].join(" ");
};

// Anneau extérieur : contour extérieur (CW) + trou intérieur (CCW)
const outerRingPath = `${createCirclePath(CX, CY, OUTER_RADIUS, true)} ${createCirclePath(CX, CY, INNER_HOLE_RADIUS, false)}`;
// Cercle intérieur plein
const innerCirclePath = createCirclePath(CX, CY, INNER_CIRCLE_RADIUS, true);
function AppIcon({ size = 24, ...svgProps }: AppIconProps) {
    return (
        <Svg
            viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`}
            width={size}
            height={size}
            fill="white"
            strokeWidth={1}
            {...svgProps}
        >
            <Path
                d={outerRingPath}
            />
            <Path
                d={innerCirclePath}
            />
        </Svg>
  )
}

export default AppIcon