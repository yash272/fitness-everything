import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { buildWeightChartModel } from "./weightChartUtils";

function formatDate(date) {
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric"
  });
}

export default function WeightChart({ logs, range }) {
  const [selectedPointId, setSelectedPointId] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState(null);
  const plotRef = useRef(null);
  const tooltipRef = useRef(null);
  const model = useMemo(() => buildWeightChartModel(logs, range), [logs, range]);
  const selectedPoint = model.points.find((point) => point.id === selectedPointId);

  useEffect(() => setSelectedPointId(null), [range]);

  useLayoutEffect(() => {
    const plot = plotRef.current;
    const tooltip = tooltipRef.current;
    if (!selectedPoint || !plot || !tooltip) return undefined;

    const positionTooltip = () => {
      const plotRect = plot.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();
      const anchorX = (selectedPoint.x / 100) * plotRect.width;
      const anchorY = (selectedPoint.y / 100) * plotRect.height;
      const halfWidth = tooltipRect.width / 2;

      setTooltipPosition({
        id: selectedPoint.id,
        left: Math.min(plotRect.width - halfWidth - 1, Math.max(halfWidth + 1, anchorX)),
        top: Math.min(plotRect.height - 1, Math.max(tooltipRect.height + 1, anchorY - 8))
      });
    };

    positionTooltip();
    const observer = new ResizeObserver(positionTooltip);
    observer.observe(plot);
    observer.observe(tooltip);
    return () => observer.disconnect();
  }, [selectedPoint]);

  if (model.points.length < 2) {
    return (
      <div className="chart empty-chart" role="img" aria-label="Weight trend chart">
        <span>Log two weights to see your trend</span>
      </div>
    );
  }

  return (
    <div className="chart graph-chart" role="group" aria-label="Weight trend">
      <div className="chart-y-axis" aria-hidden="true">
        <span>{model.max.toFixed(1)}</span>
        <span>{model.mid.toFixed(1)}</span>
        <span>{model.min.toFixed(1)}</span>
      </div>
      <div className="chart-plot" ref={plotRef} key={range}>
        <svg className="chart-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {[16, 52, 88].map((y) => <line key={y} className="chart-gridline" x1="0" y1={y} x2="100" y2={y} />)}
          <polygon className="chart-area" points={model.areaPoints} />
          <polyline className="chart-line" points={model.svgPoints} />
        </svg>
        {model.points.map((point) => (
          <button
            type="button"
            key={point.id}
            className={`chart-hit ${selectedPointId === point.id ? "selected" : ""}`}
            style={{
              left: `${point.hitLeft}%`,
              right: `calc(100% - ${point.hitRight}%)`
            }}
            aria-label={`${formatDate(point.log_date)}, ${Number(point.weight).toFixed(1)} kilograms`}
            onClick={() => setSelectedPointId(point.id)}
            onFocus={() => setSelectedPointId(point.id)}
          />
        ))}
        {selectedPoint ? (
          <output
            className="chart-tooltip"
            ref={tooltipRef}
            style={{
              left: tooltipPosition?.id === selectedPoint.id ? tooltipPosition.left : 0,
              top: tooltipPosition?.id === selectedPoint.id ? tooltipPosition.top : 0,
              visibility: tooltipPosition?.id === selectedPoint.id ? "visible" : "hidden"
            }}
          >
            {formatDate(selectedPoint.log_date)} · {Number(selectedPoint.weight).toFixed(1)} kg
          </output>
        ) : null}
      </div>
      <div className="chart-x-axis" aria-hidden="true">
        {model.labelIndexes.map((index) => (
          <span key={model.points[index].id}>{formatDate(model.points[index].log_date)}</span>
        ))}
      </div>
    </div>
  );
}
