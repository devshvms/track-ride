// src/app/history/ride-detail/speed-graph/speed-graph.component.ts
import { Component, Input, AfterViewInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GpsPoint, RideBreak } from '../../../models/ride.model';
import { Chart, ChartConfiguration, Plugin, registerables } from 'chart.js';
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

    // Prepare data - convert m/s to km/h or mph
    const conversionFactor = this.units === 'miles' ? 2.237 : 3.6;
    const startTime = this.points[0].timestamp;
    
    const labels = this.points.map(p => {
      const elapsed = (p.timestamp - startTime) / 1000 / 60; // minutes
      return elapsed.toFixed(1);
    });

    const speedData = this.points.map(p => {
      const speed = (p.speed ?? 0) * conversionFactor;
      return Math.round(speed * 10) / 10;
    });

    // Calculate max for y-axis
    const maxSpeed = Math.max(...speedData);

    // Create pause interval annotations
    const pauseAnnotations = this.createPauseAnnotations(startTime);

    const config: ChartConfiguration = {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Speed',
            data: speedData,
            borderColor: '#3880ff',
            backgroundColor: 'rgba(56, 128, 255, 0.1)',
            fill: true,
            tension: 0.3,
            pointRadius: 0,
            pointHitRadius: 10,
            borderWidth: 2
          }
        ]
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
              label: (item) => `${item.raw} ${this.units === 'miles' ? 'mph' : 'km/h'}`
            }
          },
          annotation: {
            annotations: pauseAnnotations
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
              maxTicksLimit: 6,
              font: { size: 10 },
              color: '#999'
            }
          },
          y: {
            display: true,
            beginAtZero: true,
            suggestedMax: maxSpeed * 1.1,
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

  private createPauseAnnotations(startTime: number): Record<string, any> {
    const annotations: Record<string, any> = {};
    
    this.breaks.forEach((brk, index) => {
      if (brk.endTime) {
        const startMin = (brk.startTime - startTime) / 1000 / 60;
        const endMin = (brk.endTime - startTime) / 1000 / 60;
        
        annotations[`pause${index}`] = {
          type: 'box',
          xMin: startMin.toFixed(1),
          xMax: endMin.toFixed(1),
          backgroundColor: 'rgba(255, 196, 9, 0.2)',
          borderColor: 'rgba(255, 196, 9, 0.5)',
          borderWidth: 1,
          label: {
            display: false
          }
        };
      }
    });
    
    return annotations;
  }
}
