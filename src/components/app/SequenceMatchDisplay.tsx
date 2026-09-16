'use client';

import { Card } from '@/components/ui/card';
import { SequenceMatchData } from '@/lib/types';
import { formatTime } from '@/lib/format';

interface SequenceMatchDisplayProps {
  sequenceMatch: SequenceMatchData | null;
  isLoading?: boolean;
}

export function SequenceMatchDisplay({ sequenceMatch, isLoading }: SequenceMatchDisplayProps) {
  if (isLoading) {
    return (
      <Card title="Sequence Matching Analysis">
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-muted rounded w-3/4" />
          <div className="h-4 bg-muted rounded w-1/2" />
          <div className="h-4 bg-muted rounded w-5/6" />
        </div>
      </Card>
    );
  }

  if (!sequenceMatch) {
    return (
      <Card title="Sequence Matching Analysis">
        <p className="text-xs text-muted-foreground">
          Sequence matching not enabled or no data available. Use the sequence matching toggle to enable historical pattern analysis.
        </p>
      </Card>
    );
  }

  const { detected_mode, confidence, similarity_details, reasoning } = sequenceMatch;

  // Mode color mapping
  const modeColors: Record<string, string> = {
    easy: 'text-emerald-600 dark:text-emerald-400',
    medium: 'text-blue-600 dark:text-blue-400',
    hard: 'text-orange-600 dark:text-orange-400',
    sequence_loop: 'text-violet-600 dark:text-violet-400',
  };

  const modeColor = modeColors[detected_mode] || 'text-muted-foreground';

  return (
    <Card title="Sequence Matching Analysis">
      <div className="space-y-4">
        {/* Game Mode Detection */}
        <div>
          <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Detected Game Mode
          </div>
          <div className={`text-sm font-semibold ${modeColor}`}>
            {detected_mode.charAt(0).toUpperCase() + detected_mode.slice(1)}
          </div>
          <div className="text-xs text-muted-foreground">
            Confidence: {Math.round(confidence * 100)}%
          </div>
        </div>

        {/* Similarity Details */}
        <div>
          <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Pattern Analysis
          </div>
          <div className="space-y-1 text-xs text-muted-foreground">
            <p>Analyzed {similarity_details.historical_analyzed} historical draws</p>
            <p>Found {similarity_details.matches_count} similar sequences (lookback: {similarity_details.lookback_n})</p>
          </div>
        </div>

        {/* Time Loops */}
        {similarity_details.time_loops.length > 0 && (
          <div>
            <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Detected Time Loops
            </div>
            <div className="space-y-1">
              {similarity_details.time_loops.slice(0, 3).map((loop, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{loop.loop_pattern}</span>
                  <span className="font-medium">
                    {loop.occurrences}x · {Math.round(loop.avg_similarity * 100)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top Matches */}
        {similarity_details.top_matches.length > 0 && (
          <div>
            <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Top Sequence Matches
            </div>
            <div className="space-y-1">
              {similarity_details.top_matches.slice(0, 3).map((match, idx) => (
                <div key={idx} className="text-xs text-muted-foreground">
                  <span className="font-medium">{Math.round(match.similarity * 100)}%</span>
                  {' '}similarity · {match.time_delta_hours.toFixed(1)}h loop
                  <span className="ml-2 text-muted-foreground/70">
                    → [{match.continuation.slice(0, 5).join(', ')}{match.continuation.length > 5 ? '...' : ''}]
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reasoning */}
        {reasoning.length > 0 && (
          <div>
            <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Analysis Reasoning
            </div>
            <div className="space-y-1">
              {reasoning.slice(0, 4).map((reason, idx) => (
                <div key={idx} className="text-xs text-muted-foreground">
                  • {reason}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Generated At */}
        <div className="pt-2 border-t border-border">
          <div className="text-xs text-muted-foreground">
            Generated {formatTime(new Date(sequenceMatch.generated_at * 1000).toISOString())}
          </div>
        </div>
      </div>
    </Card>
  );
}
