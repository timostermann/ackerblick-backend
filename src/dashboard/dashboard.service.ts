import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { ReadingsService } from "../readings/readings.service";

import type { SensorReading } from "../generated/prisma/client";

@Injectable()
export class DashboardService {
  private readonly defaultLimit = 200;

  constructor(
    private readonly readingsService: ReadingsService,
    private readonly config: ConfigService,
  ) {}

  async renderHtml(): Promise<string> {
    const readings = await this.readingsService.findRecent(this.resolveLimit());
    return this.buildPage(readings);
  }

  // Env vars are always strings; coerce and guard against invalid values.
  private resolveLimit(): number {
    const raw = this.config.get<string>("DASHBOARD_READING_LIMIT");
    const parsed = Number.parseInt(raw ?? "", 10);
    return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 1000) : this.defaultLimit;
  }

  private buildPage(readings: SensorReading[]): string {
    // Chart expects chronological order (oldest → newest); query returns newest first.
    const chronological = [...readings].reverse();
    const chartLabels = chronological.map((r) => r.recordedAt.toISOString());
    const chartValues = chronological.map((r) => r.soilMoisturePercent);
    const chartTemp = chronological.map((r) => r.airTemperatureCelsius);
    const chartHumidity = chronological.map((r) => r.relativeHumidityPercent);

    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Ackerblick Dashboard</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
    <style>
      :root { color-scheme: light dark; }
      body { font-family: system-ui, sans-serif; margin: 0; padding: 2rem; max-width: 960px; }
      h1 { margin: 0 0 0.25rem; }
      p.subtitle { color: #6b7280; margin-top: 0; }
      .card { border: 1px solid #e5e7eb; border-radius: 12px; padding: 1rem 1.25rem; margin-bottom: 2rem; }
      table { border-collapse: collapse; width: 100%; font-variant-numeric: tabular-nums; }
      th, td { text-align: left; padding: 0.5rem 0.75rem; border-bottom: 1px solid #e5e7eb; }
      th { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.04em; color: #6b7280; }
      .empty { color: #6b7280; padding: 1rem 0; }
    </style>
  </head>
  <body>
    <h1>Ackerblick Dashboard</h1>
    <p class="subtitle">Last ${String(readings.length)} sensor readings (newest first).</p>

    <div class="card">
      <canvas id="sensorChart" height="120"></canvas>
    </div>

    <div class="card">
      ${this.buildTable(readings)}
    </div>

    <script>
      const labels = ${safeJson(chartLabels)};
      const moisture = ${safeJson(chartValues)};
      const temp = ${safeJson(chartTemp)};
      const humidity = ${safeJson(chartHumidity)};
      const canvas = document.getElementById("sensorChart");
      if (labels.length > 0) {
        new Chart(canvas, {
          type: "line",
          data: {
            labels,
            datasets: [
              {
                label: "Soil moisture (%)",
                data: moisture,
                borderColor: "#16a34a",
                backgroundColor: "rgba(22,163,74,0.15)",
                tension: 0.25,
                spanGaps: true,
                yAxisID: "yMoisture",
              },
              {
                label: "Air temp (°C)",
                data: temp,
                borderColor: "#ea580c",
                backgroundColor: "rgba(234,88,12,0.1)",
                tension: 0.25,
                spanGaps: true,
                yAxisID: "yTemp",
              },
              {
                label: "Humidity (% RH)",
                data: humidity,
                borderColor: "#0ea5e9",
                backgroundColor: "rgba(14,165,233,0.1)",
                tension: 0.25,
                spanGaps: true,
                yAxisID: "yMoisture",
              },
            ],
          },
          options: {
            scales: {
              yMoisture: { position: "left",  min: 0, max: 100, title: { display: true, text: "Moisture (%)" } },
              yTemp:     { position: "right", title: { display: true, text: "Temp (°C)" }, grid: { drawOnChartArea: false } },
            },
            plugins: { legend: { display: true } },
          },
        });
      }
    </script>
  </body>
</html>`;
  }

  private buildTable(readings: SensorReading[]): string {
    if (readings.length === 0) {
      return '<p class="empty">No readings yet.</p>';
    }

    const rows = readings
      .map(
        (r) => `<tr>
          <td>${escapeHtml(r.recordedAt.toISOString())}</td>
          <td>${escapeHtml(r.deviceId ?? "—")}</td>
          <td>${r.soilMoisturePercent === null ? "—" : String(r.soilMoisturePercent)}</td>
          <td>${r.airTemperatureCelsius === null ? "—" : String(r.airTemperatureCelsius)}</td>
          <td>${r.relativeHumidityPercent === null ? "—" : String(r.relativeHumidityPercent)}</td>
          <td>${r.airPressureHpa === null ? "—" : String(r.airPressureHpa)}</td>
        </tr>`,
      )
      .join("");

    return `<table>
      <thead>
        <tr><th>Recorded at (UTC)</th><th>Device</th><th>Soil moisture (%)</th><th>Air temp (°C)</th><th>Humidity (%)</th><th>Pressure (hPa)</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
  }
}

function safeJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
