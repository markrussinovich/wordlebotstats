import React, { useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';

function focusBoard(frame: HTMLIFrameElement) {
  const board =
    frame.contentDocument?.querySelector<HTMLElement>('.play-board');
  if (
    board?.dataset.ready === 'true' &&
    (document.activeElement === document.body ||
      document.activeElement === frame)
  ) {
    frame.focus({ preventScroll: true });
    board.focus({ preventScroll: true });
  }
}

const PlayPage: React.FC = () => {
  const { date } = useParams();
  const frameRef = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    const listener = (event: MessageEvent) => {
      const frame = frameRef.current;
      if (
        !frame ||
        event.origin !== window.location.origin ||
        event.source !== frame.contentWindow ||
        event.data?.type !== 'WORDLE_PLAY_READY' ||
        event.data.date !==
          frame.contentDocument?.querySelector<HTMLElement>('.play-board')
            ?.dataset.date
      )
        return;
      focusBoard(frame);
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, []);
  return (
    <main className="dashboard-container">
      <Link to="/">Overview</Link>
      <iframe
        ref={frameRef}
        title="Play Wordle"
        src={
          chrome.runtime.getURL('play.html') +
          (date ? `?date=${encodeURIComponent(date)}` : '')
        }
        onLoad={(event) => focusBoard(event.currentTarget)}
        style={{
          display: 'block',
          width: '100%',
          height: '820px',
          border: 'none',
          marginTop: '16px',
        }}
      />
    </main>
  );
};

export default PlayPage;
