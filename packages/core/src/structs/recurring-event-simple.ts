import { startOfDay, addDays, DateMarker } from '../datelib/marker.js'
import { Duration, subtractDurations } from '../datelib/duration.js'
import { arrayToHash } from '../util/object.js'
import { RecurringType } from './recurring-event.js'
import { EventRefined } from './event-parse.js'
import { DateRange, intersectRanges } from '../datelib/date-range.js'
import { DateEnv } from '../datelib/env.js'
import { createPlugin } from '../plugin-system.js'
import { SIMPLE_RECURRING_REFINERS } from './recurring-event-simple-refiners.js'
import './recurring-event-simple-declare.js'

/*
An implementation of recurring events that only supports every-day or weekly recurrences.
*/

interface SimpleRecurringData {
  daysOfWeek: number[] | null
  startTime: Duration | null
  endTime: Duration | null
  startRecur: DateMarker | null
  endRecur: DateMarker | null
  dateEnv: DateEnv // DateEnv when the recurring definition was created
}

let recurring: RecurringType<SimpleRecurringData> = {

  parse(refined: EventRefined, dateEnv: DateEnv) {
    if (refined.daysOfWeek || refined.startTime || refined.endTime || refined.startRecur || refined.endRecur) {
      let recurringData: SimpleRecurringData = {
        daysOfWeek: refined.daysOfWeek || null,
        startTime: refined.startTime || null,
        endTime: refined.endTime || null,
        startRecur: refined.startRecur ? dateEnv.createMarker(refined.startRecur) : null,
        endRecur: refined.endRecur ? dateEnv.createMarker(refined.endRecur) : null,
        dateEnv,
      }

      let duration: Duration

      if (refined.duration) {
        duration = refined.duration
      }
      if (!duration && refined.startTime && refined.endTime) {
        duration = subtractDurations(refined.endTime, refined.startTime)
      }

      return {
        allDayGuess: Boolean(!refined.startTime && !refined.endTime),
        duration,
        typeData: recurringData, // doesn't need endTime anymore but oh well
      }
    }

    return null
  },

  expand(typeData: SimpleRecurringData, framingRange: DateRange, dateEnv: DateEnv): DateMarker[] {
    let clippedFramingRange = intersectRanges(
      framingRange,
      { start: typeData.startRecur, end: typeData.endRecur },
    )

    if (clippedFramingRange) {
      return expandRanges(
        typeData.daysOfWeek,
        typeData.startTime,
        typeData.dateEnv,
        dateEnv,
        clippedFramingRange,
      )
    }
    return []
  },

}

export const simpleRecurringEventsPlugin = createPlugin({
  name: 'simple-recurring-event',
  recurringTypes: [recurring],
  eventRefiners: SIMPLE_RECURRING_REFINERS,
})

function expandRanges(
  daysOfWeek: number[] | null,
  startTime: Duration | null,
  eventDateEnv: DateEnv,
  calendarDateEnv: DateEnv,
  framingRange: DateRange,
): DateMarker[] {
  let dowHash: { [num: string]: true } | null = daysOfWeek ? arrayToHash(daysOfWeek) : null
  let dayMarker = startOfDay(framingRange.start)
  let endMarker = framingRange.end
  let instanceStarts: DateMarker[] = []

  while (dayMarker < endMarker) {
    let instanceStart

    // if everyday, or this particular day-of-week
    if (!dowHash || dowHash[dayMarker.getUTCDay()]) {
      if (startTime) {
        instanceStart = calendarDateEnv.add(dayMarker, startTime)
      } else {
        instanceStart = dayMarker
      }

      instanceStarts.push(
        calendarDateEnv.createMarker(
          eventDateEnv.toDate(instanceStart),
        ),
      )
    }

    dayMarker = addDays(dayMarker, 1)
  }

  return instanceStarts
}
