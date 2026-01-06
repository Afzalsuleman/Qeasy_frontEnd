"use client";

import React from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface ChartDataItem {
  name?: string;
  value?: number;
  [key: string]: unknown;
  color?: string;
}

interface AnalyticsChartProps {
  data: ChartDataItem[];
  type: "bar" | "line" | "pie";
  dataKey: string;
  nameKey?: string;
  title?: string;
  color?: string;
}

export default function AnalyticsChart({
  data,
  type,
  dataKey,
  nameKey = "name",
  title,
  color = "#4f46e5",
}: AnalyticsChartProps) {
  const renderChart = () => {
    switch (type) {
      case "bar":
        return (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={nameKey} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey={dataKey} fill={color} />
          </BarChart>
        );
      case "line":
        return (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={nameKey} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} />
          </LineChart>
        );
      case "pie":
        // Filter out zero values for better visualization
        const filteredData = data.filter((item) => {
          const value = item[dataKey];
          return typeof value === "number" && value > 0;
        });
        
        if (filteredData.length === 0) {
          return (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="text-4xl mb-2">📊</div>
              <p className="text-gray-500">No data to display</p>
              <p className="text-sm text-gray-400 mt-1">Data will appear as customers are served</p>
            </div>
          );
        }

        return (
          <PieChart>
            <Pie
              data={filteredData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => {
                if (percent < 0.05) return ""; // Don't show labels for very small slices
                return `${name}\n${(percent * 100).toFixed(0)}%`;
              }}
              outerRadius={100}
              innerRadius={30}
              fill="#8884d8"
              dataKey={dataKey}
              paddingAngle={2}
            >
              {filteredData.map((entry: ChartDataItem, index) => (
                <Cell key={`cell-${index}`} fill={entry.color || color} />
              ))}
            </Pie>
            <Tooltip 
              formatter={(value: number) => [value, "Count"]}
              labelFormatter={(label) => label}
              contentStyle={{
                backgroundColor: "white",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                padding: "8px",
              }}
            />
            <Legend 
              verticalAlign="bottom"
              height={36}
              formatter={(value) => <span style={{ color: "#374151" }}>{value}</span>}
            />
          </PieChart>
        );
      default:
        return null;
    }
  };

  // Check if data is empty
  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
        {title && (
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
        )}
        <div className="flex items-center justify-center h-[300px]">
          <p className="text-gray-500">No data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
      {title && (
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      )}
      <div style={{ width: "100%", height: "300px", minHeight: "300px" }}>
        <ResponsiveContainer width="100%" height="100%">
          {renderChart()}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

