'use client';

import { TrendingUp } from 'lucide-react';
import { CartesianGrid, Line, LineChart, XAxis } from 'recharts';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';

interface TimeseriesData {
  date: string;
  NDVI_mean: number;
  NDRE_mean: number;
  GNDVI_mean: number;
  NDWI_mean: number;
  SAVI_mean: number;
}

interface TemporalChartProps {
  data: TimeseriesData[];
}

/* ---------- FIX:  use the variable itself, no wrapping  ---------- */
const chartConfig = {
  NDVI: { label: 'NDVI', color: 'var(--chart-1)' },
  NDRE: { label: 'NDRE', color: 'var(--chart-2)' },
  GNDVI: { label: 'GNDVI', color: 'var(--chart-3)' },
  NDWI: { label: 'NDWI', color: 'var(--chart-4)' },
  SAVI: { label: 'SAVI', color: 'var(--chart-5)' },
} satisfies ChartConfig;
/* ---------------------------------------------------------------- */

export function TemporalChart({ data }: TemporalChartProps) {
  const chartData = data.map(item => ({
    date: new Date(item.date).toLocaleDateString('en-US', {
      month: 'short',
      year: '2-digit',
    }),
    NDVI: item.NDVI_mean,
    NDRE: item.NDRE_mean,
    GNDVI: item.GNDVI_mean,
    NDWI: item.NDWI_mean,
    SAVI: item.SAVI_mean,
  }));

  const latestNDVI = chartData.at(-1)?.NDVI ?? 0;
  const previousNDVI = chartData.at(-2)?.NDVI ?? 0;
  const trendPct =
    previousNDVI !== 0
      ? (((latestNDVI - previousNDVI) / previousNDVI) * 100).toFixed(1)
      : '0';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vegetation Index Temporal Analysis</CardTitle>
        <CardDescription>Mean vegetation indices over time</CardDescription>
      </CardHeader>

      <CardContent>
        <ChartContainer config={chartConfig}>
          <LineChart data={chartData} margin={{ left: 12, right: 12 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey='date'
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            {Object.keys(chartConfig).map(key => (
              <Line
                key={key}
                dataKey={key}
                type='natural'
                stroke={chartConfig[key as keyof typeof chartConfig].color}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        </ChartContainer>
      </CardContent>

      <CardFooter className='flex-col items-start gap-2 text-sm'>
        <div className='flex gap-2 font-medium leading-none'>
          NDVI trending {parseFloat(trendPct) >= 0 ? 'up' : 'down'} by&nbsp;
          {Math.abs(parseFloat(trendPct))}% <TrendingUp className='h-4 w-4' />
        </div>
        <div className='text-muted-foreground leading-none'>
          Showing vegetation health indicators across multiple indices
        </div>
      </CardFooter>
    </Card>
  );
}
