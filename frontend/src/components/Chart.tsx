import ReactEChartsCore from "echarts-for-react/lib/core";
import * as echarts from "echarts/core";
import { BarChart, LineChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  AriaComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { EChartsOption } from "echarts";
import { useEffect, useRef, useState } from "react";

echarts.use([
  BarChart,
  LineChart,
  GridComponent,
  TooltipComponent,
  AriaComponent,
  CanvasRenderer,
]);
export const chartColors = ["#ecb76a", "#61c9ed", "#42d6a4", "#a59beb"];
export function barOption(
  labels: string[],
  values: (number | undefined)[],
  unit = "MW",
): EChartsOption {
  return {
    grid: { left: 56, right: 22, top: 25, bottom: 40 },
    tooltip: { trigger: "axis", valueFormatter: (value) => `${value} ${unit}` },
    xAxis: {
      type: "category",
      data: labels,
      axisTick: { show: false },
      axisLabel: {
        interval: 0,
        fontSize: 10,
        formatter: (value: string) => value.replace(" forecast", "\nforecast"),
      },
    },
    yAxis: {
      type: "value",
      name: unit,
      splitLine: { lineStyle: { color: "#20313d" } },
    },
    series: [
      {
        type: "bar",
        barMaxWidth: 40,
        data: values.map((value, index) => ({
          value: value ?? null,
          itemStyle: {
            color: chartColors[index % chartColors.length],
            borderRadius: [4, 4, 0, 0],
          },
        })),
      },
    ],
  };
}
export function Chart({
  option,
  label,
  height = 270,
}: {
  option: EChartsOption;
  label: string;
  height?: number;
}) {
  const wrapper = useRef<HTMLDivElement>(null);
  const chart = useRef<ReactEChartsCore>(null);
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const listener = () => setReducedMotion(media.matches);
    media.addEventListener("change", listener);
    const observer = new ResizeObserver(() =>
      chart.current?.getEchartsInstance().resize(),
    );
    if (wrapper.current) observer.observe(wrapper.current);
    return () => {
      observer.disconnect();
      media.removeEventListener("change", listener);
    };
  }, []);
  const themed: EChartsOption = {
    color: chartColors,
    textStyle: {
      color: "#95a9b8",
      fontFamily: "Inter, -apple-system, sans-serif",
    },
    animation: !reducedMotion,
    animationDuration: 300,
    aria: { enabled: true },
    ...option,
    tooltip: {
      backgroundColor: "#14242e",
      borderColor: "#324956",
      textStyle: { color: "#edf4f6" },
      confine: true,
      ...option.tooltip,
    },
  };
  return (
    <div ref={wrapper} className="chart" role="img" aria-label={label}>
      <ReactEChartsCore
        ref={chart}
        echarts={echarts}
        option={themed}
        notMerge
        style={{ height, width: "100%" }}
      />
    </div>
  );
}
