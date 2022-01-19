import classNames from "classnames/bind";
import { DateTime, Duration } from "luxon";
import { createContext, FunctionComponent, useContext, useEffect, useRef, useState } from "react";
import { Lesson, useLessons } from "../../lib/schedule";
import { Scale } from "./scale";
import styles from "./timetable.module.scss";
import { useContainerQuery } from "react-container-query";
import { Query } from "react-container-query/lib/interfaces";
import { useTime } from "../../lib/time";
import { useToken } from "../../lib/auth";

const cx = classNames.bind(styles);

interface Context {
  cursor?: DateTime;
  setCursor: (cursor?: DateTime) => void;
  year?: number;
  week?: number;
  id?: string;
}

export const TimetableContext = createContext<Context>({ setCursor: () => {} });

export const useTimetableContext = () => useContext(TimetableContext);

interface Props {
  id?: string;
}

const lessonContainerQuery: Query = {
  horizontal: {
    maxHeight: 48,
  },
  narrow: {
    maxWidth: 192,
  }
};

const Indicator: FunctionComponent = () => {
  const now = useTime();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof ref.current?.scrollIntoView === "function") {
      ref.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, []);

  return (
    <div ref={ref} className={cx("indicator")} style={{["--secs" as any]: now.hour * 3600 + now.minute * 60 + now.second}} />
  );
}

const FloatingLesson: FunctionComponent<{ lesson: OptimizedLesson }> = ({ lesson }) => {
  const [params, containerRef] = useContainerQuery(lessonContainerQuery, {});
  const now = useTime();

  return (
    <div
      ref={containerRef}
      className={cx("event", params, {past: now >= lesson.end})}
      style={{
        ["--start-secs" as any]: lesson.startSecs,
        ["--duration-secs" as any]: lesson.durationSecs,
      }}
    >
      <div className={cx("content")}>
      <h3>{lesson.course}</h3>
      <span>
        <time>
          {lesson.start.toLocaleString(DateTime.TIME_SIMPLE)}
        </time>
        –
        <time>
          {lesson.end.toLocaleString(DateTime.TIME_SIMPLE)}
        </time>
        {["", lesson.location, lesson.teacher]
          .filter((v) => typeof v == "string")
          .join(" · ")}
      </span>
      </div>
    </div>
  );
};

interface OptimizedLesson extends Omit<Lesson, "start" | "end"> {
  startSecs: number;
  durationSecs: number;
  start: DateTime;
  end: DateTime;
}

const DayColumn: FunctionComponent<{ day?: DateTime }> = ({ day }) => {
  const now = useTime(undefined, "day"); // if performance hurts, make sure this only updates when the day changes
  const { year, week, id } = useTimetableContext();
  const { data } = useLessons({ timetable: id, year, week });
  const isToday = day?.hasSame(now, "day") ?? false;
  const lessons: OptimizedLesson[] =
    (day
      ? data?.reduce((acc, l) => {
        const start = DateTime.fromISO(l.start).setZone(day.zone);
        const end = DateTime.fromISO(l.end).setZone(day.zone);

          if (start.hasSame(day, "day")) {
            acc.push({
              ...l,
              startSecs: start.hour * 3600 + start.minute * 60 + start.second,
              durationSecs: end.diff(start).as("seconds"),
              start,
              end,
            })
          }

          return acc;
    }, [] as OptimizedLesson[])
      : undefined) ?? [];

  return (
    <div className={styles.col}>
      {isToday && (
        <Indicator />
      )}
      {lessons.map((lesson) => (
        <FloatingLesson lesson={lesson} key={lesson.id} />
      ))}
    </div>
  );
};

const Controls: FunctionComponent = () => {
  const { cursor, setCursor } = useTimetableContext();

  return (
    <div>
      <button onClick={() => setCursor(cursor?.minus({ weeks: 1 }))}>
        prev
      </button>
      {cursor?.toLocaleString(DateTime.DATE_FULL)}
      <button onClick={() => setCursor(cursor?.plus({ weeks: 1 }))}>
        next
      </button>
    </div>
  );
};

export const Timetable: FunctionComponent<Props> = ({ id }) => {
  const [cursor, setCursor] = useState<DateTime | undefined>(DateTime.now);
  const {data: token} = useToken();

  const days = Array.from({ length: 5 }).map((_, i) =>
    cursor?.set({ weekday: i + 1 })
  );

  const icalUrl = id && token ? `http://localhost:8000/schedule/timetables/${id}/lessons.ics?token=${token}` : undefined;

  return (
    <TimetableContext.Provider
      value={{
        cursor,
        setCursor,
        year: cursor?.year,
        week: cursor?.weekNumber,
        id,
      }}
    >
      <Controls />
      <div className={styles.table} style={{ ["--days" as any]: days.length }}>
        <header>
          <div />
          {days.map((d) => (
            <div key={d?.toISODate()}>
              {d?.toLocaleString({ weekday: "long" })}{" "}
              {d?.toLocaleString({ day: "numeric", month: "numeric" })}
            </div>
          ))}
        </header>
        <main>
          <Scale />
          {days.map((d) => (
            <DayColumn day={d} key={d?.toISODate()} />
          ))}
        </main>
      </div>
      <a href={icalUrl}><code>{icalUrl}</code></a>
    </TimetableContext.Provider>
  );
};
