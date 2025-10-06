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
import { GameResult } from '@/types/gameTypes';
import { isGameWon } from '@/utils/streakCalculation';

interface TimelineChartProps {
  games: GameResult[];
  onRangeChange?: (startDate: Date, endDate: Date) => void;
}

interface ChartDataPoint {
  date: string;
  dateObj: Date;
  turns: number;
  won: boolean;
  gameNumber: number | undefined;
  displayDate: string;
  runningAverage?: number;
}

const TimelineChart: React.FC<TimelineChartProps> = ({ games, onRangeChange }) => {
  const [selectedRange, setSelectedRange] = useState<{ start: number; end: number } | null>(null);

  // Prepare chart data - only show days with games played
  const chartData = useMemo(() => {
    const data: ChartDataPoint[] = games.map((game) => {
      const dateObj = new Date(game.date);
      const actualAttempts = game.attempts || game.guesses || 0;
      
      // Use shared utility functions to determine game status
      const isWin = isGameWon(game);
      
      return {
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
    }).sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());

    // Calculate running average for each point in the full dataset
    const dataWithRunningAvg = data.map((point, index) => {
      // Get all games up to and including this point
      const gamesUpToHere = data.slice(0, index + 1);
      const wonGames = gamesUpToHere.filter(g => g.won && g.turns > 0);
      
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
    const wonGames = visibleData.filter(d => d.won);
    if (wonGames.length === 0) return 0;
    
    const sum = wonGames.reduce((acc, game) => acc + (game.turns || 0), 0);
    return sum / wonGames.length;
  }, [visibleData]);

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
      
      // Determine result text based on attempts
      let resultText;
      let resultClass;
      if (data.turns === 0 || !data.turns) {
        resultText = 'Unplayed';
        resultClass = 'lost';
      } else if (data.turns >= 7) {
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
    if (payload.turns === 0 || !payload.turns) {
      color = '#787c7e'; // Grey for unplayed
    } else if (payload.won) {
      color = '#6aaa64'; // Green for wins
    } else {
      color = '#d73a49'; // Red for losses
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
          <span className="chart-stat-label">Average Turns:</span>
          <span className="chart-stat-value">
            {averageTurns > 0 ? averageTurns.toFixed(2) : '—'}
          </span>
        </div>
        <div className="chart-stat">
          <span className="chart-stat-label">Win Rate:</span>
          <span className="chart-stat-value">
            {((visibleData.filter(d => d.won).length / visibleData.length) * 100).toFixed(1)}%
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
