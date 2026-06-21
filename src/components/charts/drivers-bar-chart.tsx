"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface DriversBarChartProps {
  data: Array<{
    name: string;
    impact: number;
  }>;
  tone?: "positive" | "negative";
}

export function DriversBarChart({
  data,
  tone = "positive",
}: DriversBarChartProps) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical">
          <CartesianGrid stroke="rgba(255,255,255,0.08)" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fill: "#94A3B8", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            width={120}
            dataKey="name"
            tick={{ fill: "#CBD5E1", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 18,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(6, 10, 17, 0.96)",
            }}
          />
          <Bar
            dataKey="impact"
            fill={tone === "positive" ? "#F7CF2F" : "#FB7185"}
            radius={[0, 12, 12, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
