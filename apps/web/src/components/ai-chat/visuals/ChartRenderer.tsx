import React from 'react';
import ReactECharts from 'echarts-for-react';

interface ChartRendererProps {
  config: any;
}

export function ChartRenderer({ config }: ChartRendererProps) {
  if (!config) return null;
  
  return (
    <div className="my-4 p-4 bg-white dark:bg-[#161b22] rounded-xl border border-border/50 shadow-sm w-full h-[400px]">
      <ReactECharts
        option={config}
        style={{ height: '100%', width: '100%' }}
        theme="dark" // assuming dark theme based on other UI, can be made dynamic
        opts={{ renderer: 'canvas' }}
      />
    </div>
  );
}
