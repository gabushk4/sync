import { friendsAvailabilityEvents } from "@/events/friendsAvailabilityEvents"
import catcher from "@/functions/catcher"
import ceilBy5 from "@/functions/ceilBy5"
import { convertLocalToUTC, convertUTCToLocal } from "@/functions/convertirUTCenLocal"
import formaterDatePourServeur from "@/functions/formaterDatePourServeur"
import log from "@/functions/log"
import versCreneauxLocaux from "@/functions/versCreneauxLocaux"
import { FriendIntervals, Interval } from "@/types/availabilities"
import { Participant } from "@/types/invites"
import { isCancel } from "axios"
import { DateTime } from "luxon"
import { createContext, Dispatch, ReactNode, SetStateAction, useCallback, useContext, useEffect, useRef, useState } from "react"
import { useAPI } from "./contexteAPI"
import { useInvites } from "./contexteInvites"

type EventDraftContextType = {
    invites: Participant[];
    start: DateTime;
    setStart: Dispatch<SetStateAction<DateTime<boolean>>>;
    end: DateTime;
    setEnd: Dispatch<SetStateAction<DateTime<boolean>>>;
    slotSuggestions: Array<Interval>;
    friendsSuggestions: Array<FriendIntervals>;
    friendsHasMore: boolean;
    setRequestsEnabled: Dispatch<SetStateAction<boolean>>;
}

const EventDraftContext = createContext<EventDraftContextType | undefined>(undefined)

type Props = {
    makeReq?: boolean;
    initialStart?: DateTime;
    initialEnd?: DateTime;
    children: ReactNode
}

export const EventDraftProvider = ({makeReq = true, initialStart, initialEnd, children } : Props) => {

    const { invites } = useInvites()
    const { api } = useAPI()

    const now = DateTime.now()
    const suggestionsOffset = useRef(0) 
    const friendsListOffset = useRef(0)
    const commonAvailController = useRef<AbortController>(new AbortController())
    const friendsAvailController = useRef<AbortController>(new AbortController())

    const DEBOUNCE_MS = 350

    const [requestsEnabled, setRequestsEnabled] = useState(makeReq)

    const [start, setStart] = useState<DateTime>(ceilBy5(initialStart ?? now.plus({hour:1})))
    const [end, setEnd] = useState<DateTime>(ceilBy5(initialEnd ?? start.plus({ hour: 1 })))
    
    const [slotSuggestions, setSlotSuggestions] = useState<Array<Interval>>([])
    const [friendsSuggestions, setFriendsSuggestions] = useState<Array<FriendIntervals>>([])
    const [friendsHasMore, setFriendsHasMore] = useState(false)

    const getCommonAvail = async () => {
        try {
            //cant proceed if interval between start and end is invalid
            if (start.toMillis() > end.toMillis()) return
            
            const res = await api.post("/disponibilites/communes", {
                debut: formaterDatePourServeur(ceilBy5(convertLocalToUTC(start))),
                fin: formaterDatePourServeur(ceilBy5(convertLocalToUTC(end))),
                offset: suggestionsOffset.current,
                ids: invites.map(i => i.id)
            },
            {                
                signal: commonAvailController.current.signal
            })            

            suggestionsOffset.current = res.data.offset
            log("getCommonAvail:", res.data)
            if (res.data.disponibilites && res.status === 200) {
                // Shared with a friend's profile widget (Philip — user story 25).
                setSlotSuggestions(versCreneauxLocaux(res.data.disponibilites))
            }
        } catch (err) {
            if (isCancel(err)) return
            catcher(err, "Impossible de suggérer des crénaux")
        }
    } 

    const getFriendsAvail = useCallback(async (append = false) => {
        try {
            if (!start || !end || start.toMillis() > end.toMillis()) {
                return { append, hasMore: false, friendIds: [] }
            }
            
            const requestOffset = friendsListOffset.current
            log("getFriendsAvail", start, end, requestOffset)

            const res = await api.get("/disponibilites/amis", 
                {
                    params: {
                        debut: formaterDatePourServeur(convertLocalToUTC(start)),
                        fin: formaterDatePourServeur(convertLocalToUTC(end)),
                        offset_ami: requestOffset,
                        //seuil: could be specified in settings 
                    },
                    signal: friendsAvailController.current.signal
                }
            )
            log("getFriendsAvail", res.data)

            const fetchedFriends = ((res.data.amis ?? []) as Array<{
                id: string;
                intervales: Interval[];
            }>).map(friend => ({
                id: friend.id,
                intervales: friend.intervales.map(interval => ({
                    ...interval,
                    debut: convertUTCToLocal(interval.debut),
                    fin: convertUTCToLocal(interval.fin),
                })),
            }))
            friendsListOffset.current = requestOffset + fetchedFriends.length

            setFriendsSuggestions(current => {
                if (!append) return fetchedFriends
                const merged = new Map(current.map(friend => [friend.id, friend]))
                fetchedFriends.forEach(friend => merged.set(friend.id, friend))
                return [...merged.values()]
            })
            const hasMore = Boolean(res.data.has_more)
            setFriendsHasMore(hasMore)
            const friendIds = fetchedFriends.map(friend => friend.id)
            const page = { append, hasMore, friendIds }
            friendsAvailabilityEvents.publishPage(page)
            return page
        } catch (error) {
            if (isCancel(error)) return { append, hasMore: true, friendIds: [] }
            catcher(error, "Impossible de suggérer des amis")
            return { append, hasMore: true, friendIds: [] }
        }
    }, [api, end, start])

    useEffect(() => {      
        if (requestsEnabled) {
            //log("invites", invites)
            
            commonAvailController.current.abort()
            const controller = new AbortController()
            commonAvailController.current = controller

            let timeout: number
            if (invites.length > 0) {
                log("timeout set")
                timeout = setTimeout(() => {
                    log("timeout entered")
                    getCommonAvail()
                }, DEBOUNCE_MS)
            }
            if (invites.length == 0) {
                setSlotSuggestions([])
            }

            return () => {
                clearTimeout(timeout)
                controller.abort()
            }
        }
    }, [invites, requestsEnabled])

    useEffect(() => {
        if (requestsEnabled) {
            friendsAvailController.current.abort()
            const controller = new AbortController()
            friendsAvailController.current = controller
            friendsListOffset.current = 0
            setFriendsSuggestions([])
            setFriendsHasMore(false)
            friendsAvailabilityEvents.publishPage({ append: false, hasMore: false, friendIds: [] })

            const timeout = setTimeout(() => {
                getFriendsAvail(false)
            }, DEBOUNCE_MS)

            return () => {
                clearTimeout(timeout)
                controller.abort()
            }
        }
    }, [start, end, requestsEnabled])

    useEffect(() => {
        if (!requestsEnabled) return
        return friendsAvailabilityEvents.onRequestMore(() => getFriendsAvail(true))
    }, [getFriendsAvail, requestsEnabled])

    return (
        <EventDraftContext.Provider value={{invites, start, setStart, end, setEnd, slotSuggestions, friendsSuggestions, friendsHasMore, setRequestsEnabled}}>
            {children}
        </EventDraftContext.Provider>
    )
}

export const useEventDraft = (): EventDraftContextType => {
    const ctx = useContext(EventDraftContext);
    if(!ctx) throw new Error("useEventDraft doit être utilisé dans un EventDraftProvider");
    return ctx;
}