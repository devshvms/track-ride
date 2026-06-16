// src/app/history/ride-detail/speed-graph/speed-graph.component.ts
import { Component, Input, AfterViewInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GpsPoint, RideBreak } from '../../../models/ride.model';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';

Chart.register(...registerables, annotationPlugin);

@Component({
  selector: 'app-speed-graph',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="speed-graph-container">
      <div class="graph-header">
        <span class="graph-title">Speed Over Time</span>
        <div class="graph-legend">
          <span class="legend-item"><span class="legend-color speed"></span>Speed</span>
          <span class="legend-item" *ngIf="breaks.length > 0"><span class="legend-color pause"></span>Paused</span>
        </div>
      </div>
      <canvas #chartCanvas></canvas>
    </div>
  `,
  styles: [`
    .speed-graph-container {
      background: var(--ion-item-background, var(--ion-background-color));
      border-radius: 12px;
      padding: 16px;
      margin: 16px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }
    
    .graph-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }
    
    .graph-title {
      font-weight: 600;
      font-size: 0.95rem;
      color: var(--ion-color-dark);
    }
    
    .graph-legend {
      display: flex;
      gap: 12px;
      font-size: 0.75rem;
      color: var(--ion-color-medium);
    }
    
    .legend-item {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    
    .legend-color {
      width: 12px;
      height: 12px;
      border-radius: 2px;
    }
    
    .legend-color.speed {
      background: #3880ff;
    }
    
    .legend-color.pause {
      background: rgba(255, 196, 9, 0.3);
      border: 1px solid rgba(255, 196, 9, 0.6);
    }
    
    canvas {
      width: 100% !important;
      height: 180px !important;
    }
  `]
})
export class SpeedGraphComponent implements AfterViewInit, OnDestroy {
  @Input() points: GpsPoint[] = [];
  @Input() breaks: RideBreak[] = [];
  @Input() units: 'km' | 'miles' = 'km';
  
  @ViewChild('chartCanvas') chartCanvas!: ElementRef<HTMLCanvasElement>;
  
  private chart: Chart | null = null;

  ngAfterViewInit(): void {
    setTimeout(() => this.initChart(), 100);
  }

  ngOnDestroy(): void {
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
  }

  private initChart(): void {
    if (!this.chartCanvas?.nativeElement || this.points.length < 2) return;

    const ctx = this.chartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    // Prepare uniform time series data
    const { labels, speedData, pauseData, maxSpeed } = this.prepareUniformTimeSeriesData();

    // Create datasets - one for active riding, one for paused periods
    const datasets: any[] = [
      {
        label: 'Speed',
        data: speedData,
        borderColor: '#3880ff',
        backgroundColor: 'rgba(56, 128, 255, 0.1)',
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        pointHitRadius: 10,
        borderWidth: 2,
        spanGaps: false
      }
    ];

    // Add pause dataset if there are pauses
    if (pauseData.some(d => d !== null)) {
      datasets.push({
        label: 'Paused',
        data: pauseData,
        borderColor: 'rgba(255, 196, 9, 0.6)',
        backgroundColor: 'rgba(255, 196, 9, 0.3)',
        fill: true,
        tension: 0,
        pointRadius: 0,
        borderWidth: 2,
        spanGaps: false
      });
    }

    const config: ChartConfiguration = {
      type: 'line',
      data: {
        labels,
        datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          intersect: false,
          mode: 'index'
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: 'rgba(0,0,0,0.8)',
            titleFont: { size: 12 },
            bodyFont: { size: 14 },
            padding: 10,
            displayColors: false,
            callbacks: {
              title: (items) => `${items[0].label} min`,
              label: (item) => {
                if (item.dataset.label === 'Paused') {
                  return 'Paused';
                }
                return `${item.raw} ${this.units === 'miles' ? 'mph' : 'km/h'}`;
              }
            },
            filter: (item) => item.raw !== null
          },
          annotation: {
            annotations: {}
          }
        },
        scales: {
          x: {
            display: true,
            title: {
              display: true,
              text: 'Time (min)',
              font: { size: 11 },
              color: '#999'
            },
            grid: {
              display: false
            },
            ticks: {
              maxTicksLimit: 8,
              font: { size: 10 },
              color: '#999'
            }
          },
          y: {
            display: true,
            beginAtZero: true,
            suggestedMax: maxSpeed > 0 ? maxSpeed * 1.1 : 10,
            grid: {
              color: 'rgba(0,0,0,0.05)'
            },
            ticks: {
              maxTicksLimit: 5,
              font: { size: 10 },
              color: '#999'
            }
          }
        }
      }
    };

    this.chart = new Chart(ctx, config);
  }

  private prepareUniformTimeSeriesData(): {
    labels: string[];
    speedData: (number | null)[];
    pauseData: (number | null)[];
    maxSpeed: number;
  } {
    const conversionFactor = this.units === 'miles' ? 2.237 : 3.6;
    const startTime = this.points[0].timestamp;
    const endTime = this.points[this.points.length - 1].timestamp;
    const totalDurationMs = endTime - startTime;
    const totalDurationMin = totalDurationMs / 1000 / 60;

    // Determine interval based on total duration
    // For rides < 30 min: 30 second intervals
    // For rides 30-120 min: 1 minute intervals
    // For rides > 120 min: 2 minute intervals
    let intervalMs: number;
    if (totalDurationMin < 30) {
      intervalMs = 30 * 1000; // 30 seconds
    } else if (totalDurationMin < 120) {
      intervalMs = 60 * 1000; // 1 minute
    } else {
      intervalMs = 2 * 60 * 1000; // 2 minutes
    }

    // Create uniform time intervals
    const labels: string[] = [];
    const speedData: (number | null)[] = [];
    const pauseData: (number | null)[] = [];
    let maxSpeed = 0;

    // Create a map of breaks for quick lookup
    const breakMap = new Map<number, boolean>();
    this.breaks.forEach(brk => {
      if (brk.endTime) {
        const breakStart = brk.startTime;
        const breakEnd = brk.endTime;
        for (let t = breakStart; t <= breakEnd; t += intervalMs) {
          breakMap.set(Math.floor(t / intervalMs) * intervalMs, true);
        }
      }
    });

    // Generate data points at uniform intervals
    let pointIndex = 0;
    for (let t = startTime; t <= endTime; t += intervalMs) {
      const elapsedMin = (t - startTime) / 1000 / 60;
      labels.push(elapsedMin.toFixed(1));

      // Check if this time is during a break
      const isDuringBreak = this.isTimeDuringBreak(t);

      if (isDuringBreak) {
        // During pause: show 0 in pause dataset
        speedData.push(null);
        pauseData.push(0);
      } else {
        // Find the closest GPS point to this time
        while (pointIndex < this.points.length - 1 && 
               Math.abs(this.points[pointIndex + 1].timestamp - t) < Math.abs(this.points[pointIndex].timestamp - t)) {
          pointIndex++;
        }

        const point = this.points[pointIndex];
        const timeDiff = Math.abs(point.timestamp - t);

        // Only use the point if it's within the interval window
        if (timeDiff <= intervalMs) {
          const speed = (point.speed ?? 0) * conversionFactor;
          const roundedSpeed = Math.round(speed * 10) / 10;
          speedData.push(roundedSpeed);
          pauseData.push(null);
          maxSpeed = Math.max(maxSpeed, roundedSpeed);
        } else {
          // No data available for this interval
          speedData.push(null);
          pauseData.push(null);
        }
      }
    }

    return { labels, speedData, pauseData, maxSpeed };
  }

  private isTimeDuringBreak(timestamp: number): boolean {
    return this.breaks.some(brk => {
      if (!brk.endTime) return false;
      return timestamp >= brk.startTime && timestamp <= brk.endTime;
    });
  }

}
