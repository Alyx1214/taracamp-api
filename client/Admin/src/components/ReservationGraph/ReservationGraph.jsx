import React, { useEffect, useRef } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Filler,
} from "chart.js";
import "./ReservationGraph.module.css";

// Register required components
ChartJS.register(
  Title,
  Tooltip,
  Legend,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Filler
);

const ReservationGraph = () => {
  const chartRef = useRef(null);

  useEffect(() => {
    if (chartRef.current && chartRef.current.chartInstance) {
      chartRef.current.chartInstance.destroy();  // Destroy previous chart instance
    }
  }, []);

  const data = {
    labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    datasets: [
      {
        label: "Completed",
        data: [20, 30, 40, 50, 60, 40, 50, 60, 70, 40, 30, 20],
        borderColor: "green",
        backgroundColor: "rgba(0,255,0,0.2)",
        fill: true,
      },
      {
        label: "Cancelled",
        data: [10, 20, 30, 40, 30, 20, 30, 20, 10, 20, 30, 10],
        borderColor: "red",
        backgroundColor: "rgba(255,0,0,0.2)",
        fill: true,
      },
    ],
  };

  const options = {
    responsive: true,
    scales: {
      x: {
        grid: {
          display: false,
        },
      },
      y: {
        beginAtZero: true,
      },
    },
  };

  return (
    <div className="reservation-graph">
      <h3>Monthly Reservations</h3>
      <Line ref={chartRef} data={data} options={options} />
    </div>
  );
};

export default ReservationGraph;
