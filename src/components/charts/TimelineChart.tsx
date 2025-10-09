// Interactive timeline chart showing game performance with zoomable date range
import React, { useState, useMemo, CSSProperties } from 'react';
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
import { isGameWon } from '@/utils/streakCalculation';

interface TimelineChartProps {
  games: GameResult[];
  onRangeChange?: (startDate: Date, endDate: Date) => void;
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
}

const CHART_MARGINS = { top: 20, right: 30, left: 20, bottom: 20 } as const;

const normalizeGuessStatus = (rawStatus: string | undefined): GuessResult['status'] => {
  if (!rawStatus) {
    return 'absent';
  }

  const lower = rawStatus.toLowerCase();

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

const TimelineChart: React.FC<TimelineChartProps> = ({ games, onRangeChange }) => {
  const [selectedRange, setSelectedRange] = useState<{ start: number; end: number } | null>(null);
  
  // Detect dark mode
  const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

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
      const dateObj = new Date(game.date);
      const actualAttempts = game.attempts || game.guesses || 0;
      
      // Use shared utility functions to determine game status
  const isWin = isGameWon(game);
      
      const point: ChartDataPoint = {
        date: game.date,
        dateObj,
        turns: actualAttempts,
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
        const dateString = currentDate.toISOString().split('T')[0];
        
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
            dateObj: new Date(currentDate),
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

    // Calculate cumulative running averages (turns, skill, luck)
    let sumTurns = 0;
    let countTurns = 0;
    let sumSkill = 0; let countSkill = 0;
    let sumLuck = 0; let countLuck = 0;

    const dataWithRunningAvg = filledData.map((point) => {
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

    return dataWithRunningAvg;
  }, [games]);

  // Get visible data based on selected range
  const visibleData = useMemo(() => {
    if (!selectedRange || selectedRange.start === selectedRange.end) {
      return chartData;
    }
    return chartData.slice(selectedRange.start, selectedRange.end + 1);
  }, [chartData, selectedRange]);

  const averageTurns = useMemo(() => {
    const wonGames = visibleData.filter(d => d.won === true);
    if (wonGames.length === 0) return 0;
    
    const sum = wonGames.reduce((acc, game) => acc + (game.turns || 0), 0);
    return sum / wonGames.length;
  }, [visibleData]);

  const playedGames = useMemo(
    () => visibleData.filter(d => d.turns > 0 && d.won !== null),
    [visibleData]
  );
  const playedGamesCount = playedGames.length;

  // Format date for X-axis
  const formatXAxis = (dateString: string) => {
    const date = new Date(dateString);
    
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
    const getTileColor = (status: GuessResult['status']) => {
      switch (status) {
        case 'correct':
          return '#6aaa64';
        case 'present':
          return '#c9b458';
            case 'absent':
            default:
              return '#787c7e';
      }
    };

    return (
      <div className="tooltip-grid" role="presentation" aria-hidden="true">
        {pattern.map((row, rowIndex) => (
          <div key={`row-${rowIndex}`} className="tooltip-grid-row">
            {row.map((cell, cellIndex) => (
              <span
                key={`cell-${rowIndex}-${cellIndex}`}
                className={`tooltip-grid-cell tooltip-grid-cell-${cell.status}`}
                style={{ 
                  backgroundColor: getTileColor(cell.status),
                  color: '#ffffff',
                  fontWeight: 'bold',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
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
      
      const shouldRenderResult = !(hasBoard && resultClass === 'won');

      return (
        <div className="chart-tooltip">
          <div className="tooltip-date">{data.displayDate}</div>
          {data.gameNumber && (
            <div className="tooltip-game">Wordle #{data.gameNumber}</div>
          )}
          {data.solution && (
            <div className="tooltip-word">{data.solution.toUpperCase()}</div>
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
            color = '#d3d6da'; // Grey for unplayed
    } else if (payload.won === false || payload.turns >= 7) {
      color = '#d73a49'; // Red for losses
    } else {
      color = '#6aaa64'; // Green for wins
    }
    
    return (
      <circle
        cx={cx}
        cy={cy}
        r={4}
        fill={color}
        stroke="white"
        strokeWidth={1.5}
        style={{ cursor: 'pointer' }}
      />
    );
  };

  const handleBrushChange = (range: any) => {
    if (range && range.startIndex !== undefined && range.endIndex !== undefined) {
      setSelectedRange({ start: range.startIndex, end: range.endIndex });
      
      // Notify parent component of range change for streak recalculation
      if (onRangeChange && chartData.length > 0) {
        const startDate = chartData[range.startIndex]?.dateObj;
        const endDate = chartData[range.endIndex]?.dateObj;
        if (startDate && endDate) {
          onRangeChange(startDate, endDate);
        }
      }
    }
  };

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
            <span className="chart-stat-label">Average Turns</span>
            <span className="chart-stat-value">
            {averageTurns > 0 ? averageTurns.toFixed(2) : '—'}
            </span>
        </div>
        <div className="chart-stat">
          <span className="chart-stat-label">Win Rate</span>
          <span className="chart-stat-value">
            {playedGames.length > 0
              ? ((visibleData.filter(d => d.won === true).length / playedGames.length) * 100).toFixed(1) + '%'
              : '—'}
          </span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={400}>
        <ComposedChart data={chartData} margin={CHART_MARGINS}>
          <CartesianGrid 
            strokeDasharray="3 3" 
            stroke={isDarkMode ? "#4a4a4a" : "#e5e7eb"} 
            strokeOpacity={isDarkMode ? 0.5 : 1}
          />
          
          <XAxis
            dataKey="date"
            tickFormatter={formatXAxis}
            stroke={isDarkMode ? "#9ca3af" : "#6b7280"}
            style={{ fontSize: '12px' }}
          />
          
          <YAxis
            yAxisId="turns"
            domain={[0, 8]}
            ticks={[1, 2, 3, 4, 5, 6, 7]}
            stroke={isDarkMode ? "#9ca3af" : "#6b7280"}
            style={{ fontSize: '12px' }}
            label={{ value: 'Turns', angle: -90, position: 'insideLeft' }}
          />
          <YAxis
            yAxisId="score"
            orientation="right"
            domain={[0, 100]}
            ticks={[0,20,40,60,80,100]}
            stroke={isDarkMode ? "#9ca3af" : "#64748b"}
            style={{ fontSize: '12px' }}
            label={{ value: 'Score', angle: 90, position: 'insideRight' }}
          />

          <Tooltip content={<CustomTooltip />} />

          {/* Running averages - more vibrant in dark mode */}
          <Line
            type="monotone"
            dataKey="runningAverage"
            stroke={isDarkMode ? "#f0ad4e" : "#c9b458"}
            strokeWidth={isDarkMode ? 3.5 : 3}
            dot={false}
            name="Avg Turns"
            yAxisId="turns"
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="runningSkillAvg"
            stroke={isDarkMode ? "rgba(59,130,246,0.85)" : "rgba(29,78,216,0.55)"}
            strokeWidth={isDarkMode ? 2.5 : 2}
            strokeOpacity={1}
            dot={false}
            name="Avg Skill"
            yAxisId="score"
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="runningLuckAvg"
            stroke={isDarkMode ? "rgba(168,85,247,0.85)" : "rgba(147,51,234,0.55)"}
            strokeWidth={isDarkMode ? 2.5 : 2}
            strokeOpacity={1}
            dot={false}
            name="Avg Luck"
            yAxisId="score"
            connectNulls
          />

          {/* Scatter plot for individual games */}
          <Scatter
            name="Games"
            dataKey="turns"
            fill="#6aaa64"
            shape={<CustomDot />}
            yAxisId="turns"
          />

          {/* Brush for range selection */}
          <Brush
            dataKey="date"
            height={30}
            stroke="#6aaa64"
            tickFormatter={formatXAxis}
            onChange={handleBrushChange}
          />
        </ComposedChart>
      </ResponsiveContainer>

      <div className="chart-legend-custom">
        <div className="legend-item">
          <span className="legend-dot legend-dot-win"></span>
          <span>Won</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot legend-dot-loss"></span>
          <span>Lost</span>
        </div>
        <div className="legend-item">
          <span className="legend-line legend-line-avg"></span>
          <span>Avg Turns</span>
        </div>
        <div className="legend-item">
          <span className="legend-line legend-line-skill"></span>
          <span>Avg Skill</span>
        </div>
        <div className="legend-item">
          <span className="legend-line legend-line-luck"></span>
          <span>Avg Luck</span>
        </div>
      </div>
    </div>
  );
};

export default TimelineChart;

// Exported for unit tests
export const __timelineChartTestUtils = {
  normalizeGuessStatus,
  normalizeGuessCell,
  normalizeGuessPattern
};
