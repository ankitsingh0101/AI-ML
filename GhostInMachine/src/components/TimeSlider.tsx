import React from 'react';
import { Clock, RotateCcw } from 'lucide-react';

interface TimeSliderProps {
  daysOffset: number;
  onChangeDays: (days: number) => void;
}

export const TimeSlider: React.FC<TimeSliderProps> = ({ daysOffset, onChangeDays }) => {
  return (
    <div className="w-full max-w-2xl mx-auto rounded-xl bg-[#121026]/85 border border-[#f5f0e6]/12 px-4 sm:px-5 py-3.5 backdrop-blur-md">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <label
          htmlFor="time-travel-slider"
          className="inline-flex items-center gap-2 text-xs sm:text-sm font-medium text-[#f5f0e6]/90"
        >
          <Clock className="w-4 h-4 text-[#ff9f1c]" aria-hidden="true" />
          <span>Time Travel</span>
          <span className="text-[#f5f0e6]/45 font-normal">· Demo decay preview</span>
        </label>

        <div className="flex items-center gap-3 tabular-nums">
          <span className="text-xs font-medium text-[#ffbf69]">
            {daysOffset === 0
              ? 'Present night (+0 days)'
              : `+${daysOffset} ${daysOffset === 1 ? 'day' : 'days'} into the future`}
          </span>
          {daysOffset > 0 && (
            <button
              type="button"
              onClick={() => onChangeDays(0)}
              aria-label="Reset time travel to present day"
              className="inline-flex items-center gap-1 text-xs text-[#f5f0e6]/65 hover:text-[#f5f0e6] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          )}
        </div>
      </div>

      <input
        id="time-travel-slider"
        type="range"
        min={0}
        max={60}
        step={1}
        value={daysOffset}
        onChange={(e) => onChangeDays(Number(e.target.value))}
        aria-valuemin={0}
        aria-valuemax={60}
        aria-valuenow={daysOffset}
        aria-valuetext={`${daysOffset} days forward`}
        className="w-full h-1.5 rounded-lg appearance-none bg-[#231e42] accent-[#ff9f1c] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff9f1c]"
      />

      <div className="mt-1.5 flex justify-between text-[11px] text-[#f5f0e6]/45 tabular-nums select-none">
        <span>Today</span>
        <span>+15 days</span>
        <span>+30 days (fading)</span>
        <span>+60 days (unvisited flames go out)</span>
      </div>
    </div>
  );
};
