import { ReactNode } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import Toast, {ToastShowParams as ToastShowParamsBase} from 'react-native-toast-message';

import { useFont } from '@/contextes/contexteFont';
import { usePalette } from '@/contextes/contextePalette';

// `text3` is an extra muted line shown by the custom warning toast (components/toastAvertissement.js).
type ToastShowParams = ToastShowParamsBase & { text3?: string };

/** react-native-toast-message's default display time (ms). */
const DUREE_PAR_DEFAUT = 4000
/** Extra time for the hide animation before the watchdog moves on (ms). */
const MARGE_ANIMATION = 800
/**
 * Time the hide animation takes before the next queued toast shows (ms).
 * react-native-toast-message calls onHide when the hide STARTS: showing the next toast
 * right then caught the card while it slid away, so a second toast only changed the
 * text of the first. Waiting lets the first one leave and the next one come in.
 */
const DELAI_SORTIE = 450

const queue: ToastShowParams[] = [];
let isShowing = false;
// Whether the toast on screen stays until dismissed (autoHide: false).
let courantPersistant = false;
// Identifies the toast on screen, so a late onHide / watchdog of an older one is ignored.
let idCourant = 0;
let surveillant: ReturnType<typeof setTimeout> | null = null;

/**
 * Shows the next queued toast. Toasts are chained through their onHide, with a
 * watchdog as a fallback: a toast shown by the modals' own <Toast/> never calls
 * onHide when that modal closes first (e.g. the conflict screen), which used to
 * leave the queue stuck — every later toast was queued and never shown (e.g.
 * "the event must have a name" after creating a multi-day event).
 *
 * @author Philip — rectification for a more conventional display:
 *   every message is shown, none stays stuck behind a closed screen
 * @returns {void}
 */
function processQueue() {
    if (surveillant) clearTimeout(surveillant);
    surveillant = null;

    if (queue.length === 0) {
        isShowing = false;
        courantPersistant = false;
        return;
    }

    isShowing = true;
    const config = queue.shift() as ToastShowParams;
    const id = ++idCourant;
    courantPersistant = config.autoHide === false;

    // On intercepte onHide pour enchaîner sur le prochain toast de la queue,
    // tout en respectant le onHide original de l'appelant (s'il y en a un).
    const originalOnHide = config.onHide;

    Toast.show({
        ...config,
        onHide: () => {
            if (originalOnHide) originalOnHide();
            // after the hide animation, so the next toast slides in as a new one
            if (id === idCourant) setTimeout(() => { if (id === idCourant) processQueue(); }, DELAI_SORTIE);
        },
    });

    if (!courantPersistant) {
        surveillant = setTimeout(() => {
            if (id === idCourant) processQueue();
        }, (config.visibilityTime ?? DUREE_PAR_DEFAUT) + MARGE_ANIMATION);
    }
}

const ToastAbs = {
    /**
     * Shows a toast, after the ones already waiting. A toast that stays until
     * dismissed (autoHide: false, e.g. server errors) is replaced right away
     * instead of holding every later message back.
     *
     * @param {ToastShowParams} config
     * @returns {void}
     */
    show(config: ToastShowParams) {
        queue.push(config);
        if (!isShowing || courantPersistant) {
            processQueue();
        }
    },

    hide() {
        // Vide le toast affiché ET la queue en attente
        queue.length = 0;
        isShowing = false;
        courantPersistant = false;
        idCourant++;
        if (surveillant) clearTimeout(surveillant);
        surveillant = null;
        Toast.hide();
    },
};

export default ToastAbs;

type ToastBaseProps = {
    /** Border and title color (e.g. colors.success, colors.secondary). */
    couleur: string
    /** Left column (an icon or image), vertically centered. */
    icone?: ReactNode
    titre?: string
    texte?: string
    /** Right of the texts (e.g. a chevron when the toast opens something). */
    droite?: ReactNode
    /** Makes the whole card tappable. */
    onPress?: () => void
    accessibilityLabel?: string
    /** Drawn under the row, inside the card (e.g. an extra line or a link). */
    children?: ReactNode
}

/**
 * The card shared by the app's custom toasts (constants/toastConfig): rounded card in the
 * palette's card color with a colored border, the icon on the left, the title (in that
 * color) and the text. A new toast type only gives its color, icon and texts instead of
 * copying these styles. Tappable when given onPress.
 *
 * @param {ToastBaseProps} props
 * @returns {JSX.Element}
 */
export function ToastBase({ couleur, icone, titre, texte, droite, onPress, accessibilityLabel, children }: ToastBaseProps) {
    const { colors } = usePalette()
    const { fonts } = useFont()

    const contenu = (
        <>
            <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 80, paddingVertical: 8 }}>
                <View style={{ width: '20%', alignItems: 'center', justifyContent: 'center' }}>
                    {icone}
                </View>
                <View style={{ flex: 1, paddingRight: 4 }}>
                    {!!titre && <Text style={{ color: couleur, fontFamily: fonts.title, fontSize: 18 }} numberOfLines={2}>{titre}</Text>}
                    {!!texte && <Text style={{ color: colors.text, fontFamily: fonts.body, fontSize: 15 }} numberOfLines={2}>{texte}</Text>}
                </View>
                {droite}
            </View>
            {children}
        </>
    )
    const style = {
        width: '90%' as const, marginTop: 16, overflow: 'hidden' as const,
        backgroundColor: colors.card, borderColor: couleur, borderWidth: 1, borderRadius: 16,
    }

    return onPress ? (
        <TouchableOpacity
            activeOpacity={0.8}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel ?? [titre, texte].filter(Boolean).join('. ')}
            style={style}
        >
            {contenu}
        </TouchableOpacity>
    ) : (
        <View accessibilityLabel={accessibilityLabel} style={style}>{contenu}</View>
    )
}
