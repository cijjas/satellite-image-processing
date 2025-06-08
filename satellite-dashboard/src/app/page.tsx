import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, TrendingDown, TrendingUp } from 'lucide-react';
import { TemporalChart } from '@/components/temporal-chart';
import { AreaCoverageChart } from '@/components/area-coverage-chart';
import { PredictionsChart } from '@/components/predictions-chart';
import { AOIMap } from '@/components/aoi-map';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import dashboardData from '@/data/dashboard_data.json';

export default function Dashboard() {
  const { timeseries, aoi, predictions, alerts, parameters } = dashboardData;

  return (
    <div className='min-h-screen bg-background p-4 md:p-6 lg:p-8'>
      <div className='mx-auto max-w-7xl space-y-6'>
        {/* Header */}
        <div className='space-y-2'>
          <h1 className='text-3xl font-bold tracking-tight'>
            Satellite Data Dashboard
          </h1>
          <p className='text-muted-foreground'>
            Monitoring area from {parameters.date_start} to{' '}
            {parameters.date_end}
          </p>
        </div>

        {/* Alerts */}
        {alerts.length > 0 && (
          <div className='space-y-2'>
            {alerts.map((alert, index) => (
              <Alert key={index} className='border-amber-200 bg-amber-50'>
                <AlertTriangle className='h-4 w-4 text-amber-600' />
                <AlertDescription className='text-amber-800'>
                  <strong>{alert.date}:</strong> {alert.msg} (Value:{' '}
                  {alert.value.toFixed(4)})
                </AlertDescription>
              </Alert>
            ))}
          </div>
        )}

        {/* Main Grid */}
        <div className='grid gap-6 lg:grid-cols-3'>
          {/* Map Section */}
          <div className='lg:col-span-1'>
            <Card>
              <CardHeader>
                <CardTitle>Area of Interest</CardTitle>
                <CardDescription>
                  Satellite view of monitored region
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AOIMap aoi={aoi} tileUrl={dashboardData.tile_url} />
              </CardContent>
            </Card>
          </div>

          {/* Charts Section */}
          <div className='space-y-6 lg:col-span-2'>
            {/* Predictions Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Current Predictions</CardTitle>
                <CardDescription>
                  Forecasted values for {predictions.NDVI.predicted_on}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className='grid grid-cols-2 gap-4 md:grid-cols-5'>
                  {Object.entries(predictions).map(([index, data]) => (
                    <div key={index} className='space-y-1 text-center'>
                      <div className='text-sm font-medium text-muted-foreground'>
                        {index}
                      </div>
                      <div className='text-lg font-bold'>
                        {data.value.toFixed(3)}
                      </div>
                      <Badge
                        variant={
                          data.trend_slope > 0 ? 'default' : 'destructive'
                        }
                        className='text-xs'
                      >
                        {data.trend_slope > 0 ? (
                          <TrendingUp className='mr-1 h-3 w-3' />
                        ) : (
                          <TrendingDown className='mr-1 h-3 w-3' />
                        )}
                        {(data.trend_slope * 100).toFixed(2)}%
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Self-contained Charts */}
            <TemporalChart data={timeseries} />
            <AreaCoverageChart data={timeseries} />
            <PredictionsChart data={timeseries} predictions={predictions} />
          </div>
        </div>
      </div>
    </div>
  );
}
