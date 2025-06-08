'use client';

import * as React from 'react';
import { Area, AreaChart, CartesianGrid, XAxis } from 'recharts';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface TimeseriesData {
  date: string;
  area_NDVI_0_4: number;
  area_NDVI_0_6: number;
  area_NDRE_0_3: number;
  area_NDWI_0_05: number;
}

interface AreaCoverageChartProps {
  data: TimeseriesData[];
}

const chartConfig = {
  area_NDVI_0_4: {
    label: 'NDVI > 0.4',
    color: 'hsl(var(--chart-1))',
  },
  area_NDVI_0_6: {
    label: 'NDVI > 0.6',
    color: 'hsl(var(--chart-2))',
  },
  area_SAVI_0_3: {
    label: 'SAVI > 0.3',
    color: 'hsl(var(--chart-3))',
  },
  area_ND_800_680_0_3: {
    label: 'ND 800/680 > 0.3',
    color: 'hsl(var(--chart-4))',
  },
  area_CCCI_0_3: {
    label: 'CCCI > 0.3',
    color: 'hsl(var(--chart-5))',
  },
} satisfies ChartConfig;

export function AreaCoverageChart({ data }: AreaCoverageChartProps) {
  const [timeRange, setTimeRange] = React.useState('all');

  const filteredData = React.useMemo(() => {
    if (timeRange === 'all') return data;

    const sortedData = [...data].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
    const referenceDate = new Date(
      sortedData[sortedData.length - 1]?.date || new Date(),
    );

    let daysToSubtract = 365;
    if (timeRange === '6m') {
      daysToSubtract = 180;
    } else if (timeRange === '3m') {
      daysToSubtract = 90;
    } else if (timeRange === '1m') {
      daysToSubtract = 30;
    }

    const startDate = new Date(referenceDate);
    startDate.setDate(startDate.getDate() - daysToSubtract);

    return sortedData.filter(item => new Date(item.date) >= startDate);
  }, [data, timeRange]);

  return (
    <Card>
      <CardHeader className='flex items-center gap-2 space-y-0 border-b py-5 sm:flex-row'>
        <div className='grid flex-1 gap-1'>
          <CardTitle>Vegetation Index Coverage</CardTitle>
          <CardDescription>
            Area coverage by vegetation health indices over time
          </CardDescription>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger
            className='w-[160px] rounded-lg'
            aria-label='Select time range'
          >
            <SelectValue placeholder='All time' />
          </SelectTrigger>
          <SelectContent className='rounded-xl'>
            <SelectItem value='all' className='rounded-lg'>
              All time
            </SelectItem>
            <SelectItem value='1y' className='rounded-lg'>
              Last year
            </SelectItem>
            <SelectItem value='6m' className='rounded-lg'>
              Last 6 months
            </SelectItem>
            <SelectItem value='3m' className='rounded-lg'>
              Last 3 months
            </SelectItem>
            <SelectItem value='1m' className='rounded-lg'>
              Last month
            </SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className='px-2 pt-4 sm:px-6 sm:pt-6'>
        <ChartContainer
          config={chartConfig}
          className='aspect-auto h-[350px] w-full'
        >
          <AreaChart data={filteredData}>
            <defs>
              <linearGradient id='fillNDVI_0_4' x1='0' y1='0' x2='0' y2='1'>
                <stop
                  offset='5%'
                  stopColor='var(--color-area_NDVI_0_4)'
                  stopOpacity={0.8}
                />
                <stop
                  offset='95%'
                  stopColor='var(--color-area_NDVI_0_4)'
                  stopOpacity={0.1}
                />
              </linearGradient>
              <linearGradient id='fillNDVI_0_6' x1='0' y1='0' x2='0' y2='1'>
                <stop
                  offset='5%'
                  stopColor='var(--color-area_NDVI_0_6)'
                  stopOpacity={0.8}
                />
                <stop
                  offset='95%'
                  stopColor='var(--color-area_NDVI_0_6)'
                  stopOpacity={0.1}
                />
              </linearGradient>
              <linearGradient id='fillNDRE_0_3' x1='0' y1='0' x2='0' y2='1'>
                <stop
                  offset='5%'
                  stopColor='var(--color-area_NDRE_0_3)'
                  stopOpacity={0.8}
                />
                <stop
                  offset='95%'
                  stopColor='var(--color-area_NDRE_0_3)'
                  stopOpacity={0.1}
                />
              </linearGradient>
              <linearGradient id='fillNDWI_0_05' x1='0' y1='0' x2='0' y2='1'>
                <stop
                  offset='5%'
                  stopColor='var(--color-area_NDWI_0_05)'
                  stopOpacity={0.8}
                />
                <stop
                  offset='95%'
                  stopColor='var(--color-area_NDWI_0_05)'
                  stopOpacity={0.1}
                />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey='date'
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={value => {
                const date = new Date(value);
                return date.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                });
              }}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={value => {
                    return new Date(value).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    });
                  }}
                  indicator='dot'
                />
              }
            />
            <Area
              dataKey='area_NDWI_0_05'
              type='natural'
              fill='url(#fillNDWI_0_05)'
              stroke='var(--color-area_NDWI_0_05)'
              stackId='a'
            />
            <Area
              dataKey='area_NDRE_0_3'
              type='natural'
              fill='url(#fillNDRE_0_3)'
              stroke='var(--color-area_NDRE_0_3)'
              stackId='a'
            />
            <Area
              dataKey='area_NDVI_0_6'
              type='natural'
              fill='url(#fillNDVI_0_6)'
              stroke='var(--color-area_NDVI_0_6)'
              stackId='a'
            />
            <Area
              dataKey='area_NDVI_0_4'
              type='natural'
              fill='url(#fillNDVI_0_4)'
              stroke='var(--color-area_NDVI_0_4)'
              stackId='a'
            />
            <ChartLegend content={<ChartLegendContent />} />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
