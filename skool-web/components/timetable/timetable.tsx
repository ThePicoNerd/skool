import classNames from "classnames/bind";
import { DateTime, Duration } from "luxon";
import {
  createContext,
  FunctionComponent,
  useContext,
  useState,
} from "react";
import { Lesson, useLessons } from "../../lib/schedule";
import { Scale } from "./scale";
import styles from "./timetable.module.scss";
import { useContainerQuery } from 'react-container-query';
import { Query } from "react-container-query/lib/interfaces";

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
  "horizontal": {
    maxHeight: 64,
  },
};

const FloatingLesson: FunctionComponent<{ lesson: Lesson }> = ({ lesson }) => {
  const start = DateTime.fromISO(lesson.start);
  const end = DateTime.fromISO(lesson.end);
  const duration = end.diff(start);
  const [params, containerRef] = useContainerQuery(lessonContainerQuery, {});

  return (
    <div
      key={lesson.start}
      ref={containerRef}
      className={cx("event", params)}
      style={{
        ["--start-secs" as any]:
          start.hour * 3600 + start.minute * 60 + start.second,
        ["--duration-secs" as any]: duration.as("seconds"),
      }}
    >
      <h3>{lesson.course}</h3>
      <span>
        <time>
          {DateTime.fromISO(lesson.start).toLocaleString(DateTime.TIME_SIMPLE)}
        </time>
        –
        <time>
          {DateTime.fromISO(lesson.end).toLocaleString(DateTime.TIME_SIMPLE)}
        </time>
        {["", lesson.location, lesson.teacher]
          .filter((v) => typeof v == "string")
          .join(" · ")}
      </span>
    </div>
  );
};

const DayColumn: FunctionComponent<{ day?: DateTime }> = ({ day }) => {
  const { year, week, id, cursor } = useTimetableContext();
  const { data } = useLessons({ timetable: id, year, week });
  const lessons =
    (day
      ? data?.filter((d) =>
          DateTime.fromISO(d.start).setZone(day.zone).hasSame(day, "day")
        )
      : undefined) ?? [];

  return (
    <div className={styles.col}>
      {lessons.map((lesson) => (
        <FloatingLesson lesson={lesson} key={lesson.start} />
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
  // const { data: lessons } = useLessons({ timetable: id, year: 2022, week: 2 });

  const days = Array.from({ length: 5 }).map((_, i) =>
    cursor?.set({ weekday: i + 1 })
  );

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
              {d?.toLocaleString({weekday: "long"})}
              {" "}
              {d?.toLocaleString({day: "numeric", month: "numeric"})}
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
    </TimetableContext.Provider>
  );
};
