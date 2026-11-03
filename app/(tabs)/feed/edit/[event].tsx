import EditEvent from "@/app/(tabs)/home/edit/[event]";

/**
 * Event edit opened from a notification card, in the feed stack: saving (router.back)
 * returns straight to the notifications, whose card then reloads the event. Pushed
 * into the home stack, it left the member on the home tab and the card kept the old
 * values. Same screen as the home tab's edit.
 *
 * @author Philip — rectification (event managed from its notification)
 * @returns {JSX.Element}
 */
export default function EditDepuisFil() {
    return <EditEvent />
}
