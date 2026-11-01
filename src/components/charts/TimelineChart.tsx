// Interactive timeline chart showing game performance with zoomable date range
import React, { useState, useMemo, useRef, useCallback, useEffect, CSSProperties } from 'react';
import {
  ComposedChart,
  Scatter,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Brush
} from 'recharts';
import { GameResult, GuessResult } from '@/types/gameTypes';
import { SolverResult } from '@/solver/solver';
import { buildSolveComparison, comparisonTrend, pairedComparison, userTurns } from '@/utils/solveComparison';

interface TimelineChartProps {
  games: GameResult[];
  onRangeChange?: (startDate: Date, endDate: Date) => void;
  turnDistribution?: React.ReactNode;
  streakData?: { current: number; max: number } | null;
  solverResults?: Record<string, SolverResult>;
}

type LegacyGuessCell =
  | string
  | {
      letter?: string;
      status?: string;
      state?: string;
      result?: string;
      value?: string;
    };

type LegacyGuessRow = LegacyGuessCell[] | string;

interface ChartDataPoint {
  date: string;
  dateObj: Date;
  turns: number;
  won: boolean | null;
  gameNumber: number | undefined;
  displayDate: string;
  runningAverage?: number;
  runningSkillAvg?: number;
  runningLuckAvg?: number;
  solution?: string;
  boardImageUrl?: string;
  guessPattern?: GuessResult[][];
  skillScore?: number;
  luckScore?: number;
  user?: number | null;
  solver?: number | null;
  readers?: number | null;
  skill?: number | null;
  luck?: number | null;
  localReplay?: boolean;
}

const CHART_MARGINS = { top: 20, right: 5, left: 5, bottom: 20 } as const;
const METRICS = [
  { key: 'user', label: 'Your turns', color: 'var(--cp-wordle-green)', axis: 'turns' },
  { key: 'solver', label: 'Local solver', color: 'var(--cp-text)', axis: 'turns' },
  { key: 'readers', label: 'NYT readers', color: 'var(--cp-warning)', axis: 'turns' },
  { key: 'skill', label: 'Skill', color: 'var(--cp-link)', axis: 'score' },
  { key: 'luck', label: 'Luck', color: 'var(--cp-orange)', axis: 'score' },
] as const;
type MetricKey = typeof METRICS[number]['key'] | 'games';

const BRUSH_TRAVELLER_WIDTH = 14;

const BrushGrip = ({ x = 0, y = 0, width = 0, height = 0 }: { x?: number; y?: number; width?: number; height?: number }) => {
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  return (
    <g className="brush-grip">
      <rect className="brush-grip-handle" x={x} y={y - 3} width={width} height={height + 6} rx={3} />
      {[-3, 0, 3].map((offset) => (
        <line
          key={offset}
          className="brush-grip-line"
          x1={centerX + offset}
          x2={centerX + offset}
          y1={centerY - 6}
          y2={centerY + 6}
        />
      ))}
    </g>
  );
};

const normalizeGuessStatus = (rawStatus: string | undefined): GuessResult['status'] => {
  if (!rawStatus) {
    return 'absent';
  }

  const lower = rawStatus.toLowerCase();

  if (lower.includes('incorrect') || lower.includes('gray') || lower.includes('grey')) return 'absent';
  if (lower.includes('green')) return 'correct';
  if (lower.includes('yellow')) return 'present';

  if (lower.includes('correct') || lower.includes('right') || lower.includes('exact')) {
    return 'correct';
  }

  if (
    lower.includes('present') ||
    lower.includes('misplaced') ||
    lower.includes('close') ||
    lower.includes('partial')
  ) {
    return 'present';
  }

  if (
    lower.includes('absent') ||
    lower.includes('miss') ||
    lower.includes('wrong') ||
    lower.includes('bad') ||
    lower.includes('unused') ||
    lower.includes('empty')
  ) {
    return 'absent';
  }

  // Emoji handling
  if (rawStatus === '🟩' || rawStatus === '🟢' || rawStatus === '✅') {
    return 'correct';
  }
  if (rawStatus === '🟨' || rawStatus === '🟡') {
    return 'present';
  }
  if (rawStatus === '⬛' || rawStatus === '⬜' || rawStatus === '⬜️' || rawStatus === '⬛️') {
    return 'absent';
  }

  return 'absent';
};

const normalizeGuessLetter = (rawLetter: string | undefined): string => {
  if (!rawLetter) {
    return '';
  }
  return rawLetter.slice(0, 1).toUpperCase();
};

const normalizeGuessCell = (cell: LegacyGuessCell): GuessResult => {
  if (typeof cell === 'string') {
    // When the legacy cell is a single emoji or status string, treat it as status only
    if (cell.length === 1 && /[A-Z]/i.test(cell)) {
      return {
        letter: cell.toUpperCase(),
        status: 'absent'
      };
    }

    return {
      letter: '',
      status: normalizeGuessStatus(cell)
    };
  }

  if (!cell || typeof cell !== 'object') {
    return {
      letter: '',
      status: 'absent'
    };
  }

  const letter = normalizeGuessLetter(cell.letter || cell.value);
  const status = normalizeGuessStatus(cell.status || cell.state || cell.result);

  return { letter, status };
};

const normalizeGuessPattern = (rawPattern: LegacyGuessRow[] | GuessResult[][] | undefined): GuessResult[][] => {
  if (!rawPattern || !Array.isArray(rawPattern) || rawPattern.length === 0) {
    return [];
  }

  return rawPattern
    .map((rawRow) => {
      if (typeof rawRow === 'string') {
        // Legacy share text row (emoji string)
        const cells = Array.from(rawRow);
        return cells.map((cell) => normalizeGuessCell(cell));
      }

      if (!Array.isArray(rawRow)) {
        return null;
      }

      const normalizedRow = rawRow.map((cell) => normalizeGuessCell(cell));
      return normalizedRow;
    })
    .filter((row): row is GuessResult[] => Array.isArray(row) && row.length > 0);
};

const TimelineChart: React.FC<TimelineChartProps> = ({ games, onRangeChange, turnDistribution, streakData, solverResults = {} }) => {
  const [plot, setPlot] = useState('trend');
  const [metrics, setMetrics] = useState<Record<MetricKey, boolean>>({
    user: true, solver: true, readers: true, skill: false, luck: false, games: true
  });
  const [highlighted, setHighlighted] = useState<MetricKey | null>(null);
  // Track the "live" range during dragging (updates continuously)
  const [selectedRange, setSelectedRange] = useState<{ start: number; end: number } | null>(null);
  
  // Track the "committed" range that only updates when dragging stops
  // This prevents chart data from changing during drag, which would interrupt the brush
  const [committedRange, setCommittedRange] = useState<{ start: number; end: number } | null>(null);
  
  // Track if we're currently dragging
  const isDraggingRef = useRef(false);
  // Store the pending range to commit when dragging ends
  const pendingRangeRef = useRef<{ start: number; end: number } | null>(null);
  
  // Listen for global mouseup to detect when dragging ends
  useEffect(() => {
    const handleMouseUp = () => {
      if (isDraggingRef.current && pendingRangeRef.current) {
        // Commit the pending range now that dragging has stopped
        setCommittedRange(pendingRangeRef.current);
        isDraggingRef.current = false;
      }
    };
    
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchend', handleMouseUp);
    
    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchend', handleMouseUp);
    };
  }, []);
  
  const chartContainerStyle = useMemo(
    () =>
      ({
        '--chart-padding-left': `${CHART_MARGINS.left}px`,
        '--chart-padding-right': `${CHART_MARGINS.right}px`
      }) as CSSProperties,
    []
  );

  // Prepare chart data - show ALL games including unplayed (grey dots)
  const chartData = useMemo(() => {
    if (games.length === 0) return [];
    
    const data: ChartDataPoint[] = games.map((game) => {
      // Parse date safely to avoid timezone shifts
      const dateParts = game.date.split('-');
      const dateObj = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]));
      const actualAttempts = userTurns(game) ?? 0;
      
      // Use shared utility functions to determine game status
      const isWin = actualAttempts === 0 ? null : actualAttempts <= 6;
      
      const point: ChartDataPoint = {
        date: game.date,
        dateObj,
        turns: actualAttempts,
        localReplay: game.metadata?.extensionPlayMode === 'replay',
        won: isWin,
        gameNumber: game.gameNumber || game.puzzleNumber,
        displayDate: dateObj.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric',
          year: dateObj.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
        })
      };

      if (game.solution) {
        point.solution = game.solution;
      }
      if (game.boardImageUrl) {
        point.boardImageUrl = game.boardImageUrl;
      }
      if (game.guessPattern && game.guessPattern.length > 0) {
        const normalizedPattern = normalizeGuessPattern(game.guessPattern as unknown as LegacyGuessRow[]);
        if (normalizedPattern.length > 0) {
          point.guessPattern = normalizedPattern;
        }
      }
      if (typeof game.skillScore === 'number') {
        point.skillScore = game.skillScore;
      }
      if (typeof game.luckScore === 'number') {
        point.luckScore = game.luckScore;
      }

      return point;
    }).sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());

    // Fill in missing dates with "no game" points
    const filledData: ChartDataPoint[] = [];
    const firstGame = data[0];
    const lastGame = data[data.length - 1];
    if (data.length > 0 && firstGame && lastGame) {
      const startDate = new Date(firstGame.dateObj);
      const endDate = new Date(lastGame.dateObj);
      
      // Create a map of existing game dates for quick lookup
      const gameDateMap = new Map<string, ChartDataPoint>();
      data.forEach(game => {
        gameDateMap.set(game.date, game);
      });
      
      // Iterate through all dates in the range  
      const currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        const dateString = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
        
        if (dateString && gameDateMap.has(dateString)) {
          // Use existing game data
          const existingGame = gameDateMap.get(dateString);
          if (existingGame) {
            filledData.push(existingGame);
          }
        } else if (dateString) {
          // Add a "no game" point
          filledData.push({
            date: dateString,
            dateObj: new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate()),
            turns: 0,
            won: null,
            gameNumber: undefined,
            displayDate: currentDate.toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric',
              year: currentDate.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
            })
          });
        }
        
        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
      }
    } else {
      // If no valid data, just use what we have
      filledData.push(...data);
    }

    return filledData;
  }, [games]);

  // Get visible data based on committed range (only updates after dragging stops)
  const visibleData = useMemo(() => {
    if (!committedRange) {
      return chartData;
    }
    
    return chartData.slice(committedRange.start, committedRange.end + 1);
  }, [chartData, committedRange]);

  const visiblePoints = useMemo(() => {
    const dates = new Set(visibleData.map(point => point.date));
    return buildSolveComparison(games.filter(game => dates.has(game.date)), solverResults);
  }, [visibleData, games, solverResults]);

  const headToHead = useMemo(() => ([
    { key: 'solver', label: 'vs Solver', name: 'Local solver' },
    { key: 'readers', label: 'vs NYT Readers', name: 'NYT readers' },
  ] as const).map(item => ({ ...item, pair: pairedComparison(visiblePoints, item.key) })), [visiblePoints]);

  // Create chart data with zoomed running averages
  // This maintains the full dataset for Brush navigation,
  // but updates running average lines to reflect only the committed range
  const chartDataWithZoomedAverages = useMemo(() => {
    const points = visiblePoints;
    const values = plot === 'daily' ? points : comparisonTrend(points, plot === 'cumulative' ? points.length : 20);
    const byDate = new Map(values.map(point => [point.date, point]));
    return chartData.map(point => {
      const comparison = byDate.get(point.date);
      return {
        ...point,
        user: comparison?.user ?? null,
        solver: comparison?.solver ?? null,
        readers: comparison?.readers ?? null,
        skill: comparison?.skill ?? null,
        luck: comparison?.luck ?? null,
      };
    });
  }, [chartData, visiblePoints, plot]);

  const averageTurns = useMemo(() => {
    const wonGames = visibleData.filter(d => d.won === true);
    if (wonGames.length === 0) return 0;
    
    const sum = wonGames.reduce((acc, game) => acc + (game.turns || 0), 0);
    return sum / wonGames.length;
  }, [visibleData]);

  const averageSkill = useMemo(() => {
    const gamesWithSkill = visibleData.filter(d => Number.isFinite(d.skillScore));
    if (gamesWithSkill.length === 0) return null;
    
    const sum = gamesWithSkill.reduce((acc, game) => acc + (game.skillScore || 0), 0);
    return sum / gamesWithSkill.length;
  }, [visibleData]);

  const averageLuck = useMemo(() => {
    const gamesWithLuck = visibleData.filter(d => Number.isFinite(d.luckScore));
    if (gamesWithLuck.length === 0) return null;
    
    const sum = gamesWithLuck.reduce((acc, game) => acc + (game.luckScore || 0), 0);
    return sum / gamesWithLuck.length;
  }, [visibleData]);

  const playedGames = useMemo(
    () => visibleData.filter(d => d.turns > 0 && d.won !== null),
    [visibleData]
  );
  const playedGamesCount = playedGames.length;

  // Format date for X-axis
  const formatXAxis = (dateString: string) => {
    const dateParts = dateString.split('-');
    const date = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]));
    
    if (visibleData.length > 100) {
      // Show month/year for large ranges
      return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    } else if (visibleData.length > 30) {
      // Show month/day for medium ranges
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } else {
      // Show day of week for short ranges
      return date.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });
    }
  };

  // Custom tooltip
  const renderGuessPattern = (pattern: GuessResult[][]) => {
    return (
      <div className="tooltip-grid" role="presentation" aria-hidden="true">
        {pattern.map((row, rowIndex) => (
          <div key={`row-${rowIndex}`} className="tooltip-grid-row">
            {row.map((cell, cellIndex) => (
              <span
                key={`cell-${rowIndex}-${cellIndex}`}
                className={`tooltip-grid-cell tooltip-grid-cell-${cell.status}`}
              >
                {cell.letter?.toUpperCase() || ''}
              </span>
            ))}
          </div>
        ))}
      </div>
    );
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length > 0) {
      const data = payload[0].payload as ChartDataPoint;
      
      // Debug logging for tooltip data
      console.log('[TOOLTIP DEBUG] Raw game data:', {
        date: data.date,
        displayDate: data.displayDate,
        guessPattern: data.guessPattern,
        won: data.won,
        turns: data.turns,
        solution: data.solution
      });
      
      let hasBoard = false;
      const preview = (() => {
        if (data.guessPattern && data.guessPattern.length > 0) {
          hasBoard = true;
          console.log('[TOOLTIP DEBUG] Rendering guess pattern with', data.guessPattern.length, 'rows');
          data.guessPattern.forEach((row, idx) => {
            console.log(`[TOOLTIP DEBUG] Row ${idx}:`, row.map(cell => `${cell.letter}(${cell.status})`).join(' '));
          });
          return renderGuessPattern(data.guessPattern);
        }
        if (data.boardImageUrl) {
          hasBoard = true;
          return (
            <div className="tooltip-board">
              <img
                src={data.boardImageUrl}
                alt={data.solution ? `Game board for ${data.solution}` : `Game board on ${data.displayDate}`}
                loading="lazy"
              />
            </div>
          );
        }
        return null;
      })();
      
      // Determine result text based on won field first, then attempts
      let resultText;
      let resultClass;
      if (!data.turns || data.turns === 0 || data.won === null) {
        resultText = 'No game recorded';
        resultClass = 'unplayed';
      } else if (data.won === false || data.turns >= 7) {
        resultText = 'Failed ❌';
        resultClass = 'lost';
      } else {
        resultText = `Solved in ${data.turns}`;
        resultClass = 'won';
      }
      
      // Hide result text for won games with board, and for lost games (red word is sufficient)
      const shouldRenderResult = resultClass !== 'lost' && !(hasBoard && resultClass === 'won');

      return (
        <div className="chart-tooltip">
          <div className="tooltip-date">{data.displayDate}</div>
          {data.localReplay && <div className="tooltip-game">Local replay</div>}
          {data.gameNumber && (
            <div className="tooltip-game">Wordle #{data.gameNumber}</div>
          )}
          {data.solution && (
            <div className={`tooltip-word ${resultClass}`}>{data.solution.toUpperCase()}</div>
          )}
          {preview}
          {(typeof data.skillScore === 'number' || typeof data.luckScore === 'number') && (
            <div className="tooltip-metrics">
              {typeof data.skillScore === 'number' && (
                <span className="tooltip-metric">Skill {data.skillScore}</span>
              )}
              {typeof data.luckScore === 'number' && (
                <span className="tooltip-metric">Luck {data.luckScore}</span>
              )}
            </div>
          )}
          {shouldRenderResult && (
            <div className={`tooltip-result ${resultClass}`}>
              {resultText}
            </div>
          )}
          <div className="tooltip-comparisons">
            {METRICS.filter(metric => metrics[metric.key]).map(metric => (
              <React.Fragment key={metric.key}>
                <span style={{ '--metric-color': metric.color } as CSSProperties}>{metric.label}</span>
                <span>{typeof data[metric.key] === 'number' ? data[metric.key]!.toFixed(2) : 'N/A'}</span>
              </React.Fragment>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  // Custom dot for scatter plot
  const CustomDot = (props: any) => {
    const { cx, cy, payload } = props;
    if (!payload) return null;
    
    // Determine color based on won field (green for won, red for loss, grey for unplayed)
    let color;
    if (!payload.turns || payload.turns === 0 || payload.won === null) {
      color = 'var(--cp-border-strong)';
    } else if (payload.won === false || payload.turns >= 7) {
      color = 'var(--cp-danger)';
    } else {
      color = 'var(--cp-success)';
    }
    
    return (
      <circle
        cx={cx}
        cy={cy}
        r={4}
        fill={color}
        stroke="var(--cp-surface)"
        strokeWidth={1.5}
        opacity={highlighted && highlighted !== 'games' ? 0.2 : 1}
        style={{ cursor: 'pointer' }}
      />
    );
  };

  const handleBrushChange = useCallback((range: any) => {
    if (range && range.startIndex !== undefined && range.endIndex !== undefined) {
      const newRange = { start: range.startIndex, end: range.endIndex };
      setSelectedRange(newRange);
      
      // Mark that we're dragging and store the pending range
      isDraggingRef.current = true;
      pendingRangeRef.current = newRange;
      
      // Also notify parent of range change for stats display
      if (onRangeChange && chartData.length > 0) {
        const startDate = chartData[range.startIndex]?.dateObj;
        const endDate = chartData[range.endIndex]?.dateObj;
        if (startDate && endDate) {
          onRangeChange(startDate, endDate);
        }
      }
    }
  }, [chartData, onRangeChange]);

  if (chartData.length === 0) {
    return (
      <div className="chart-empty">
        <p>No games to display</p>
      </div>
    );
  }

  return (
    <div className="timeline-chart" style={chartContainerStyle}>
      <div className="chart-stats">
        <div className="chart-stat">
          <span className="chart-stat-label">Games Played</span>
          <span className="chart-stat-value">{playedGamesCount}</span>
        </div>
        <div className="chart-stat">
          <span className="chart-stat-label">Win Rate</span>
          <span className="chart-stat-value">
            {playedGames.length > 0
              ? ((visibleData.filter(d => d.won === true).length / playedGames.length) * 100).toFixed(1) + '%'
              : '—'}
          </span>
        </div>
        <div className="chart-stat">
            <span className="chart-stat-label">Avg Turns (wins)</span>
            <span className="chart-stat-value">
            {averageTurns > 0 ? averageTurns.toFixed(2) : '—'}
            </span>
        </div>
        {headToHead.map(({ key, label, name, pair }) => (
          <div className="chart-stat" key={key}
            title={pair
              ? `You ${pair.user.toFixed(2)} vs ${name} ${pair.benchmark.toFixed(2)} over ${pair.count} matched games (failures count as 7). Negative is better.`
              : `No games matched with ${name}.`}>
            <span className="chart-stat-label">{label}</span>
            <span className="chart-stat-value">
              {pair ? `${pair.delta > 0 ? '+' : ''}${pair.delta.toFixed(2)}` : '—'}
            </span>
          </div>
        ))}
        <div className="chart-stat">
          <span className="chart-stat-label">Longest Streak</span>
          <span className="chart-stat-value">{streakData?.max ?? '—'}</span>
        </div>
        <div className="chart-stat">
          <span className="chart-stat-label">Avg Skill</span>
          <span className="chart-stat-value">
            {averageSkill !== null ? averageSkill.toFixed(1) : '—'}
          </span>
        </div>
        <div className="chart-stat">
          <span className="chart-stat-label">Avg Luck</span>
          <span className="chart-stat-value">
            {averageLuck !== null ? averageLuck.toFixed(1) : '—'}
          </span>
        </div>
      </div>

      <div className="timeline-controls" role="group" aria-label="Chart metrics">
        {[
          ...METRICS,
          { key: 'games' as const, label: 'Game results', color: 'var(--cp-success)' },
        ].map(metric => metric.key === 'user' ? (
          <span key={metric.key} className="metric-toggle metric-fixed"
            style={{ '--metric-color': metric.color } as CSSProperties}>
            <svg className="metric-swatch" width="20" height="10" viewBox="0 0 20 10" aria-hidden="true">
              <line x1="1" x2="19" y1="5" y2="5" stroke="var(--metric-color)" strokeWidth="4.5" />
            </svg>
            {metric.label}
          </span>
        ) : (
          <button key={metric.key} type="button" className="metric-toggle"
            aria-pressed={metrics[metric.key]} aria-describedby="timeline-metric-help"
            onClick={() => {
              setMetrics(current => ({ ...current, [metric.key]: !current[metric.key] }));
              setHighlighted(null);
            }}
            onMouseEnter={() => setHighlighted(metrics[metric.key] ? metric.key : null)}
            onMouseLeave={() => setHighlighted(null)}
            onFocus={() => setHighlighted(metrics[metric.key] ? metric.key : null)}
            onBlur={() => setHighlighted(null)}
            style={{ '--metric-color': metric.color } as CSSProperties}
          >
            <svg className="metric-swatch" width="20" height="10" viewBox="0 0 20 10" aria-hidden="true">
              {metric.key === 'games'
                ? <circle cx="10" cy="5" r="4.5" fill="var(--metric-color)" />
                : <line x1="1" x2="19" y1="5" y2="5" stroke="var(--metric-color)" strokeWidth="3.5" />}
            </svg>
            {metric.label}
          </button>
        ))}
        <label className="solve-controls">
          Plot:
          <select aria-label="Timeline averaging" value={plot} onChange={event => setPlot(event.target.value)}>
            <option value="trend">20-game rolling average</option>
            <option value="cumulative">Cumulative average in selected range</option>
            <option value="daily">Individual games</option>
          </select>
        </label>
      </div>
      <p className="section-subtitle" id="timeline-metric-help">
        Your turns are always shown. Toggle other metrics to show or hide them; hover or focus to highlight. Failures count as 7 turns; lines connect across missing games.
      </p>

      <ResponsiveContainer width="100%" height={400}>
        <ComposedChart data={chartDataWithZoomedAverages} margin={CHART_MARGINS}>
          <CartesianGrid 
            strokeDasharray="3 3" 
            stroke="var(--cp-border)"
          />
          
          <XAxis
            dataKey="date"
            tickFormatter={formatXAxis}
            stroke="var(--cp-text-muted)"
            tick={{ fill: 'var(--cp-text-muted)' }}
            style={{ fontSize: '12px', fontWeight: 700 }}
          />
          
          <YAxis
            yAxisId="turns"
            domain={[0, 8]}
            ticks={[1, 2, 3, 4, 5, 6, 7]}
            stroke="var(--cp-text-muted)"
            tick={{ fill: 'var(--cp-text-muted)' }}
            style={{ fontSize: '12px', fontWeight: 700 }}
            width={34}
            label={{ value: 'Turns', angle: -90, position: 'insideLeft', offset: 0 }}
          />
          <YAxis
            yAxisId="score"
            hide={!metrics.skill && !metrics.luck}
            orientation="right"
            domain={[0, 100]}
            ticks={[0,20,40,60,80,100]}
            stroke="var(--cp-text-muted)"
            tick={{ fill: 'var(--cp-text-muted)' }}
            style={{ fontSize: '12px', fontWeight: 700 }}
            width={40}
            label={{ value: 'Score', angle: 90, position: 'insideRight', offset: 0 }}
          />

          <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--cp-border-strong)' }} />

          {METRICS.map(metric => (
            <Line key={metric.key} className={`metric-${metric.key}`}
              type="monotone" dataKey={metric.key} name={metric.label} connectNulls
              stroke={metric.color}
              strokeWidth={metric.key === 'user' || highlighted === metric.key ? 4.5 : 3}
              strokeOpacity={metric.key !== 'user' && highlighted && highlighted !== metric.key ? 0.2 : 1}
              hide={!metrics[metric.key]} yAxisId={metric.axis}
              dot={plot === 'daily' || chartDataWithZoomedAverages.filter(point => typeof point[metric.key] === 'number').length === 1
                ? { r: 3, stroke: 'var(--cp-surface)' }
                : false}
              activeDot={{ r: 5, stroke: 'var(--cp-surface)', strokeWidth: 2 }}
              isAnimationActive={false}
            />
          ))}

          {/* Scatter plot for individual games */}
          {metrics.games && <Scatter
            name="Games"
            dataKey="turns"
            fill="var(--cp-success)"
            shape={<CustomDot />}
            yAxisId="turns"
          />}

          {/* Brush for range selection */}
          <Brush
            dataKey="date"
            height={30}
            travellerWidth={BRUSH_TRAVELLER_WIDTH}
            traveller={<BrushGrip />}
            stroke="var(--cp-wordle-green)"
            fill="var(--cp-surface-soft)"
            tickFormatter={formatXAxis}
            onChange={handleBrushChange}
            startIndex={selectedRange?.start}
            endIndex={selectedRange?.end}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {metrics.games && <div className="chart-legend-custom">
        <div className="legend-item">
          <span className="legend-dot legend-dot-win"></span>
          <span>Won</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot legend-dot-loss"></span>
          <span>Lost</span>
        </div>
      </div>}
      {turnDistribution && (
        <div className="turn-distribution-wrapper">
          {turnDistribution}
        </div>
      )}
    </div>
  );
};

export default TimelineChart;

// Interface for chart data points (exported for tests)
export interface TestChartDataPoint {
  date: string;
  turns: number;
  won: boolean | null;
  skillScore?: number;
  luckScore?: number;
  runningAverage?: number;
  runningSkillAvg?: number;
  runningLuckAvg?: number;
}

// Calculate running averages for a set of data points
// Exported for unit testing
export const calculateRunningAverages = <T extends TestChartDataPoint>(
  data: T[]
): T[] => {
  let sumTurns = 0;
  let countTurns = 0;
  let sumSkill = 0;
  let countSkill = 0;
  let sumLuck = 0;
  let countLuck = 0;

  return data.map((point) => {
    // Turns (won games only with >0 turns)
    if (point.won === true && point.turns > 0) {
      sumTurns += point.turns;
      countTurns += 1;
    }
    const runningAverage = countTurns > 0 ? sumTurns / countTurns : undefined;

    // Skill score
    if (typeof point.skillScore === 'number') {
      sumSkill += point.skillScore;
      countSkill += 1;
    }
    const runningSkillAvg = countSkill > 0 ? sumSkill / countSkill : undefined;

    // Luck score
    if (typeof point.luckScore === 'number') {
      sumLuck += point.luckScore;
      countLuck += 1;
    }
    const runningLuckAvg = countLuck > 0 ? sumLuck / countLuck : undefined;

    return { ...point, runningAverage, runningSkillAvg, runningLuckAvg };
  });
};

// Merge zoomed running averages into full dataset
// Points outside the visible range will have undefined averages
export const mergeZoomedAverages = <T extends TestChartDataPoint>(
  fullData: T[],
  visibleData: T[]
): T[] => {
  const zoomedAveragesMap = new Map<string, { 
    runningAverage?: number; 
    runningSkillAvg?: number; 
    runningLuckAvg?: number; 
  }>();
  
  visibleData.forEach(point => {
    zoomedAveragesMap.set(point.date, {
      runningAverage: point.runningAverage,
      runningSkillAvg: point.runningSkillAvg,
      runningLuckAvg: point.runningLuckAvg
    });
  });
  
  return fullData.map(point => {
    const zoomedAvg = zoomedAveragesMap.get(point.date);
    if (zoomedAvg) {
      return {
        ...point,
        runningAverage: zoomedAvg.runningAverage,
        runningSkillAvg: zoomedAvg.runningSkillAvg,
        runningLuckAvg: zoomedAvg.runningLuckAvg
      };
    }
    // Outside visible range - clear running averages
    return {
      ...point,
      runningAverage: undefined,
      runningSkillAvg: undefined,
      runningLuckAvg: undefined
    };
  });
};

// Exported for unit tests
export const __timelineChartTestUtils = {
  normalizeGuessStatus,
  normalizeGuessCell,
  normalizeGuessPattern
};
