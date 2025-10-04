// Streak display component with streak history and achievements
import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui';
import { StatisticsPeriod } from '@/types/gameTypes';

export interface StreakDisplayProps {
  statistics: StatisticsPeriod;
  streakHistory?: Array<{ length: number; startDate: string; endDate?: string }>;
  showHistory?: boolean;
  className?: string;
}

const StreakDisplay: React.FC<StreakDisplayProps> = ({
  statistics,
  streakHistory = [],
  showHistory = true,
  className = ''
}) => {
  const currentStreak = statistics.currentStreak;
  const maxStreak = statistics.maxStreak;
  const isActiveStreak = currentStreak > 0;

  // Streak achievement levels
  const getStreakLevel = (streak: number) => {
    if (streak >= 100) return { label: 'Legendary', color: 'text-purple-600', bgColor: 'bg-purple-100' };
    if (streak >= 50) return { label: 'Master', color: 'text-indigo-600', bgColor: 'bg-indigo-100' };
    if (streak >= 25) return { label: 'Expert', color: 'text-blue-600', bgColor: 'bg-blue-100' };
    if (streak >= 10) return { label: 'Skilled', color: 'text-green-600', bgColor: 'bg-green-100' };
    if (streak >= 5) return { label: 'Getting Hot', color: 'text-yellow-600', bgColor: 'bg-yellow-100' };
    return { label: 'Building', color: 'text-gray-600', bgColor: 'bg-gray-100' };
  };

  const currentLevel = getStreakLevel(currentStreak);
  const maxLevel = getStreakLevel(maxStreak);

  // Next milestone calculation
  const getNextMilestone = (streak: number) => {
    const milestones = [5, 10, 15, 20, 25, 30, 50, 75, 100, 150, 200];
    return milestones.find(milestone => milestone > streak) || milestones[milestones.length - 1];
  };

  const nextMilestone = getNextMilestone(currentStreak);
  const progressToNext = currentStreak / nextMilestone;

  return (
    <Card className={className}>
      <CardHeader 
        title="Win Streak" 
        subtitle={isActiveStreak ? "Keep it going!" : "Start a new streak!"}
      />
      <CardContent>
        <div className="space-y-4">
          {/* Current Streak Display */}
          <div className="text-center">
            <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${currentLevel.bgColor} ${currentLevel.color} mb-2`}>
              {currentLevel.label}
            </div>
            <div className="text-4xl font-bold text-gray-900 mb-1">
              {currentStreak}
            </div>
            <div className="text-sm text-gray-500">
              {isActiveStreak ? 'Current streak' : 'Games since last win'}
            </div>
          </div>

          {/* Streak Progress to Next Milestone */}
          {isActiveStreak && nextMilestone > currentStreak && (
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">
                  Progress to {nextMilestone}
                </span>
                <span className="text-sm text-gray-500">
                  {currentStreak}/{nextMilestone}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(progressToNext * 100, 100)}%` }}
                />
              </div>
              <div className="text-xs text-gray-600 mt-1">
                {nextMilestone - currentStreak} more wins to reach {nextMilestone}!
              </div>
            </div>
          )}

          {/* Max Streak Achievement */}
          <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
            <div>
              <div className="text-sm font-medium text-gray-700">Best Streak</div>
              <div className={`text-xs ${maxLevel.color}`}>{maxLevel.label}</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-gray-900">{maxStreak}</div>
              <div className="text-xs text-gray-500">games</div>
            </div>
          </div>

          {/* Streak Fire Indicator */}
          {isActiveStreak && (
            <div className="flex items-center justify-center space-x-2 p-3 bg-orange-50 rounded-lg">
              <div className="flex space-x-1">
                {Array.from({ length: Math.min(currentStreak, 10) }).map((_, i) => (
                  <span key={i} className="text-orange-500 animate-pulse">
                    🔥
                  </span>
                ))}
                {currentStreak > 10 && (
                  <span className="text-sm font-medium text-orange-600 ml-2">
                    +{currentStreak - 10}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Streak History */}
          {showHistory && streakHistory.length > 0 && (
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Recent Streaks</h4>
              <div className="space-y-2">
                {streakHistory.slice(0, 5).map((streak, index) => {
                  const level = getStreakLevel(streak.length);
                  return (
                    <div key={index} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded">
                      <div className="flex items-center space-x-2">
                        <div className={`w-2 h-2 rounded-full ${level.color.replace('text-', 'bg-')}`} />
                        <span className="text-sm text-gray-700">{streak.length} games</span>
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(streak.startDate).toLocaleDateString()}
                        {streak.endDate && ` - ${new Date(streak.endDate).toLocaleDateString()}`}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Streak Tips */}
          {!isActiveStreak && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="text-sm font-medium text-blue-800 mb-1">
                💡 Streak Tips
              </div>
              <div className="text-xs text-blue-700">
                Start with common vowels (A, E, I, O, U) and frequent consonants (R, S, T, L, N) 
                to maximize information from your first few guesses.
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default StreakDisplay;