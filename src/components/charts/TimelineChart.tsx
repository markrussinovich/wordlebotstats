// Interactive timeline chart showing game performance with zoomable date range
import React, { useState, useMemo } from 'react';
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

interface ChartDataPoint {
  date: string;
  dateObj: Date;
  turns: number;
  won: boolean | null;
  gameNumber: number | undefined;
  displayDate: string;
  runningAverage?: number;
  solution?: string;
  boardImageUrl?: string;
  guessPattern?: GuessResult[][];
  skillScore?: number;
  luckScore?: number;
}

const TimelineChart: React.FC<TimelineChartProps> = ({ games, onRangeChange }) => {
  const [selectedRange, setSelectedRange] = useState<{ start: number; end: number } | null>(null);

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
        point.guessPattern = game.guessPattern;
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

    // Calculate running average for each point in the full dataset
    const dataWithRunningAvg = filledData.map((point, index) => {
      // Get all games up to and including this point
      const gamesUpToHere = filledData.slice(0, index + 1);
  const wonGames = gamesUpToHere.filter(g => g.won === true && g.turns > 0);
      
      const runningAverage = wonGames.length > 0
        ? wonGames.reduce((sum, g) => sum + g.turns, 0) / wonGames.length
        : undefined;
      
      return {
        ...point,
        runningAverage
      };
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
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length > 0) {
      const data = payload[0].payload as ChartDataPoint;
      const preview = (() => {
        if (data.boardImageUrl) {
          return (
            <div className="tooltip-board">
              <img src={data.boardImageUrl} alt="Game board" />
            </div>
          );
        }
        if (data.guessPattern && data.guessPattern.length > 0) {
          return (
            <div className="tooltip-grid">
              {data.guessPattern.map((row, rowIndex) => (
                <div key={`row-${rowIndex}`} className="tooltip-grid-row">
                  {row.map((cell, cellIndex) => (
                    <span
                      key={`cell-${rowIndex}-${cellIndex}`}
                      className={`tooltip-grid-cell tooltip-grid-cell-${cell.status}`}
                    />
                  ))}
                </div>
              ))}
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
          <div className={`tooltip-result ${resultClass}`}>
            {resultText}
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
      color = '#787c7e'; // Grey for unplayed
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
    <div className="timeline-chart">
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
        <ComposedChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          
          <XAxis
            dataKey="date"
            tickFormatter={formatXAxis}
            stroke="#6b7280"
            style={{ fontSize: '12px' }}
          />
          
          <YAxis
            domain={[0, 8]}
            ticks={[1, 2, 3, 4, 5, 6, 7]}
            stroke="#6b7280"
            style={{ fontSize: '12px' }}
            label={{ value: 'Turns', angle: -90, position: 'insideLeft' }}
          />

          <Tooltip content={<CustomTooltip />} />

          {/* Running average line */}
          <Line
            type="monotone"
            dataKey="runningAverage"
            stroke="#c9b458"
            strokeWidth={2}
            dot={false}
            name="Running Average"
            connectNulls
          />

          {/* Scatter plot for individual games */}
          <Scatter
            name="Games"
            dataKey="turns"
            fill="#6aaa64"
            shape={<CustomDot />}
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
          <span>Running Average</span>
        </div>
      </div>
    </div>
  );
};

export default TimelineChart;
