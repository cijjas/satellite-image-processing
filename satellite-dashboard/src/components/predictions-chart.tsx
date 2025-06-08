'use client';

import { TrendingUp } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis } from 'recharts';
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
}

interface Prediction {
  predicted_on: string;
  value: number;
  trend_slope: number;
}

interface PredictionsChartProps {
  data: TimeseriesData[];
  predictions: Record<string, Prediction>;
}

const chartConfig = {
  NDVI: { label: 'NDVI', color: 'var(--chart-1)' },
  NDRE: { label: 'NDRE', color: 'var(--chart-2)' },
} satisfies ChartConfig;

export function PredictionsChart({ data, predictions }: PredictionsChartProps) {
  const chartData = data.map(item => ({
    date: new Date(item.date).toLocaleDateString('en-US', {
      month: 'short',
      year: '2-digit',
    }),
    NDVI: item.NDVI_mean,
    NDRE: item.NDRE_mean,
  }));

  const predictionDate = new Date(
    predictions.NDVI.predicted_on,
  ).toLocaleDateString('en-US', {
    month: 'short',
    year: '2-digit',
  });

  // Add prediction point
  chartData.push({
    date: predictionDate,
    NDVI: predictions.NDVI.value,
    NDRE: predictions.NDRE.value,
  });

  const trendPercentage = (predictions.NDVI.trend_slope * 100).toFixed(1);

  // Helper to show "highlighted" dot on predicted point
  const renderPredictionDot = (predictionDate: string) => (props: any) => {
    const { cx, cy, payload, index } = props;
    const isPrediction = payload.date === predictionDate;

    if (isPrediction) {
      return (
        <circle
          key={`dot-${index}`} // add unique key
          cx={cx}
          cy={cy}
          r={6}
          stroke='var(--destructive)'
          strokeWidth={2}
          fill='#fff'
        />
      );
    }

    return (
      <circle
        key={`dot-${index}`} // add unique key even for invisible dots
        cx={cx}
        cy={cy}
        r={0}
        fill='transparent'
      />
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Trend Analysis & Predictions</CardTitle>
        <CardDescription>
          Historical data with forecasted values
        </CardDescription>
      </CardHeader>

      <CardContent>
        <ChartContainer config={chartConfig}>
          <LineChart
            data={chartData}
            margin={{
              left: 12,
              right: 12,
            }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey='date'
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            <ReferenceLine
              x={predictionDate}
              stroke='var(--destructive)'
              strokeDasharray='5 5'
              label={{
                value: 'Prediction',
                position: 'top',
                fill: 'var(--destructive)',
                fontSize: 12,
              }}
            />
            <Line
              dataKey='NDVI'
              type='natural'
              stroke={chartConfig.NDVI.color}
              strokeWidth={2}
              dot={renderPredictionDot(predictionDate)}
            />
            <Line
              dataKey='NDRE'
              type='natural'
              stroke={chartConfig.NDRE.color}
              strokeWidth={2}
              dot={renderPredictionDot(predictionDate)}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>

      <CardFooter className='flex-col items-start gap-2 text-sm'>
        <div className='flex gap-2 font-medium leading-none'>
          Predicted trend{' '}
          {Number.parseFloat(trendPercentage) >= 0 ? 'up' : 'down'} by{' '}
          {Math.abs(Number.parseFloat(trendPercentage))}%{' '}
          <TrendingUp className='h-4 w-4' />
        </div>
        <div className='text-muted-foreground leading-none'>
          Dashed line indicates prediction date: {predictions.NDVI.predicted_on}
        </div>
      </CardFooter>
    </Card>
  );
}
