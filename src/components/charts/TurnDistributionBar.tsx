// Compact horizontal turn distribution bar chart
import React from 'react';
import type { GameResult } from '@/types/gameTypes';

interface TurnDistributionBarProps {
  games: GameResult[];
  className?: string;
}

const TurnDistributionBar: React.FC<TurnDistributionBarProps> = ({ games, className = '' }) => {
  // Calculate distribution for turns 1-6 and losses
  const distribution = React.useMemo(() => {
    const dist = [0, 0, 0, 0, 0, 0, 0]; // indices 0-5 for turns 1-6, index 6 for losses
    
    games.forEach(game => {
      const attempts = game.attempts || game.guesses || 0;
      
      if (attempts >= 1 && attempts <= 6 && game.won) {
        dist[attempts - 1]++;
      } else if (!game.won && attempts > 0) {
        dist[6]++; // losses
      }
    });
    
    return dist;
  }, [games]);

  const total = distribution.reduce((sum, count) => sum + count, 0);
  const maxCount = Math.max(...distribution);

  if (total === 0) {
    return null;
  }

  const getColor = (index: number): string => {
    if (index === 6) return '#d73027'; // red for losses
    const colors = ['#1a5f3f', '#2d7d4f', '#4a9d5f', '#6aaa64', '#87bc76', '#a3ce88'];
    return colors[index];
  };

  return (
    <div className={`turn-distribution-bar ${className}`}>
      <div className="turn-distribution-header">
        <h3>Turn Distribution</h3>
        <span className="total-games">{total} games</span>
      </div>
      
      <div className="distribution-bars">
        {distribution.map((count, index) => {
          const percentage = total > 0 ? (count / total) * 100 : 0;
          const widthPercentage = maxCount > 0 ? (count / maxCount) * 100 : 0;
          const label = index < 6 ? `${index + 1}` : 'X';
          
          return (
            <div key={index} className="distribution-row">
              <div className="turn-label">{label}</div>
              <div className="bar-container">
                <div
                  className="bar-fill"
                  style={{
                    width: `${Math.max(widthPercentage, count > 0 ? 8 : 0)}%`,
                    backgroundColor: getColor(index)
                  }}
                >
                  {count > 0 && (
                    <span className="bar-text">
                      {count} <span className="percentage">({percentage.toFixed(1)}%)</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TurnDistributionBar;
